import { captureAndRecord } from '@/lib/payments';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'nodejs';

// Called by the PayPal button's onApprove. The server — not the browser — captures and verifies.
export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params;
  if (!/^[A-Z0-9]{10,30}$/.test(orderId)) return Response.json({ error: 'Invalid order.' }, { status: 400 });
  if (!rateLimit(`capture:${clientKey(req)}`, 20, 60_000).ok) return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const outcome = await captureAndRecord(orderId, 'api');
  const status = outcome.state === 'completed' ? 200 : outcome.state === 'pending' ? 202 : outcome.state === 'not_approved' ? 409 : outcome.state === 'not_found' ? 404 : 502;
  return Response.json(outcome, { status });
}
