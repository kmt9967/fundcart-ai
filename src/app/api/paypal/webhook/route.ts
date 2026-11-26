import { z } from 'zod';
import { verifyWebhook } from '@/lib/paypal';
import { applyRefund, captureAndRecord, logPaymentEvent } from '@/lib/payments';
import { toCents } from '@/lib/money';

export const runtime = 'nodejs';

const providerId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const envelope = z.object({
  id: providerId,
  event_type: z.string().max(100),
  resource: z.object({
    id: providerId.optional(),
    status: z.string().max(50).optional(),
    amount: z.object({ value: z.string(), currency_code: z.string().regex(/^[A-Z]{3}$/) }).optional(),
    links: z.array(z.object({ rel: z.string(), href: z.string() })).max(20).optional(),
    supplementary_data: z.object({ related_ids: z.object({ order_id: providerId.optional() }).optional() }).optional(),
  }),
});

// Verify the original envelope before using any parsed fields.
export async function POST(req: Request) {
  const raw: unknown = await req.json().catch(() => null);
  const parsed = envelope.safeParse(raw);
  if (!parsed.success) return new Response('bad event', { status: 400 });
  const verified = await verifyWebhook(req.headers, raw).catch(() => null);
  if (verified === null) return new Response('verification temporarily unavailable', { status: 503 });
  if (!verified) return new Response('unverified', { status: 401 });

  const { id, event_type: type, resource } = parsed.data;
  const orderId = type.startsWith('CHECKOUT.ORDER') ? resource.id : resource.supplementary_data?.related_ids?.order_id;
  try {
    if (type === 'PAYMENT.CAPTURE.REFUNDED' || type === 'PAYMENT.CAPTURE.REVERSED') {
      const reversed = type === 'PAYMENT.CAPTURE.REVERSED';
      const up = resource.links?.find(link => link.rel === 'up')?.href;
      const captureId = reversed ? resource.id : up?.match(/\/v2\/payments\/captures\/([A-Za-z0-9_-]{1,128})\/?$/)?.[1];
      const amount = resource.amount;
      if (!captureId || !resource.id || !amount || !/^\d{1,9}(\.\d{1,2})?$/.test(amount.value) || toCents(amount.value) === 0) {
        return new Response('invalid adjustment', { status: 400 });
      }
      const outcome = await applyRefund({ eventId: id, resourceId: resource.id, captureId, currency: amount.currency_code, amountCents: toCents(amount.value), reversed });
      if (outcome === 'missing') return new Response('capture reconciliation pending', { status: 503 });
      if (outcome === 'mismatch') return new Response('adjustment mismatch', { status: 409 });
      return Response.json({ ok: true, duplicate: outcome === 'duplicate', unsupported: outcome === 'unsupported' });
    }

    if (type === 'CHECKOUT.ORDER.APPROVED' || type === 'PAYMENT.CAPTURE.COMPLETED') {
      if (!orderId) return new Response('missing order reference', { status: 400 });
      const outcome = await captureAndRecord(orderId, { source: 'webhook', reconcileOnly: type === 'PAYMENT.CAPTURE.COMPLETED' });
      if (outcome.state === 'campaign_closed' || outcome.state === 'approval_required') return Response.json({ ok: true, captureBlocked: true });
      if (outcome.state !== 'completed') return new Response('order reconciliation pending', { status: 503 });
    }
    const fresh = await logPaymentEvent({ paypalOrderId: orderId, source: 'webhook', eventType: type, paypalEventId: id, status: resource.status, summary: { resourceId: resource.id } });
    return Response.json({ ok: true, duplicate: !fresh });
  } catch {
    return new Response('reconciliation temporarily unavailable', { status: 503 });
  }
}
