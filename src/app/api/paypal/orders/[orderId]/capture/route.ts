import { currentUserId } from '@/lib/identity';
import { captureAndRecord } from '@/lib/payments';
import { sharedRateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'nodejs';

// Called by the PayPal button's onApprove. The server — not the browser — captures and verifies.
export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params;
  if (!/^[A-Z0-9]{10,30}$/.test(orderId)) return Response.json({ error: 'Invalid order.' }, { status: 400 });
  const limit = await sharedRateLimit([['capture_ip_min', clientKey(req), 20, 60]]);
  if (!limit.shared) return Response.json({ error: 'Payment checks are temporarily unavailable.' }, { status: 503 });
  if (!limit.ok) return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'Unknown order.' }, { status: 404 });
  const outcome = await captureAndRecord(orderId, { source: 'api', userId }).catch(() => null);
  if (!outcome) return Response.json({ error: 'Payment confirmation is temporarily unavailable.' }, { status: 503 });
  const status = outcome.state === 'completed' ? 200 : outcome.state === 'pending' ? 202 : (outcome.state === 'not_approved' || outcome.state === 'approval_required' || outcome.state === 'campaign_closed') ? 409 : outcome.state === 'not_found' ? 404 : 502;
  return Response.json(outcome, { status });
}
