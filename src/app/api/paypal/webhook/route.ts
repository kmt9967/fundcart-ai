import { verifyWebhook } from '@/lib/paypal';
import { applyRefund, captureAndRecord, logPaymentEvent } from '@/lib/payments';
import { toCents } from '@/lib/money';

export const runtime = 'nodejs';

// PayPal webhooks: verified with PayPal's verify-webhook-signature API, deduplicated by event id
// (unique constraint on payment_events.paypal_event_id), then reconciled against the Orders API.
export async function POST(req: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try { event = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const verified = await verifyWebhook(req.headers, event).catch(() => false);
  if (!verified) return new Response('unverified', { status: 401 });

  const type: string = event?.event_type || 'unknown';
  const resource = event?.resource || {};
  const orderId: string | undefined = type.startsWith('CHECKOUT.ORDER') ? resource.id : resource?.supplementary_data?.related_ids?.order_id;
  const fresh = await logPaymentEvent({ paypalOrderId: orderId ?? null, source: 'webhook', eventType: type, paypalEventId: event.id, status: resource.status ?? null, summary: { resourceId: resource.id } });
  if (!fresh) return Response.json({ duplicate: true }); // already processed

  if (orderId && (type === 'CHECKOUT.ORDER.APPROVED' || type === 'PAYMENT.CAPTURE.COMPLETED')) {
    await captureAndRecord(orderId, 'webhook');
  }
  if (type === 'PAYMENT.CAPTURE.REFUNDED' || type === 'PAYMENT.CAPTURE.REVERSED') {
    // REFUNDED: resource is the refund; its "up" link points at the original capture.
    // REVERSED: resource is the capture itself.
    const up = resource?.links?.find((l: { rel: string; href: string }) => l.rel === 'up')?.href as string | undefined;
    const captureId = type.endsWith('REFUNDED') ? (up?.split('/').pop() || '') : resource.id;
    let cents = 0;
    try { cents = toCents(resource?.amount?.value ?? '0'); } catch { cents = 0; }
    if (captureId) await applyRefund(captureId, cents, type.endsWith('REFUNDED') ? 'REFUNDED' : 'REVERSED');
  }
  return Response.json({ ok: true });
}
