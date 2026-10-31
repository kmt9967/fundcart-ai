import { z } from 'zod';
import { campaignAgent } from '@/lib/ai/agents';
import { findRecentProduct } from '@/lib/channel3';
import { ensureUser } from '@/lib/identity';
import { fundingGap, suggestedTiers, toCents } from '@/lib/money';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const Body = z.object({
  externalId: z.string().min(3).max(40),
  ownFunds: z.union([z.number(), z.string()]),
  creatorName: z.string().trim().min(1).max(40),
  purpose: z.string().trim().max(400).default(''),
});

export async function POST(req: Request) {
  if (!rateLimit(`draft:${clientKey(req)}`, 10, 60_000).ok) return Response.json({ error: 'Too many requests, slow down a little.' }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: 'Missing campaign details.' }, { status: 400 });
  await ensureUser(p.data.creatorName);
  let own: number;
  try { own = toCents(p.data.ownFunds); } catch { return Response.json({ error: 'Enter how much you already have, e.g. 200 or 200.00.' }, { status: 400 }); }
  const product = await findRecentProduct(p.data.externalId);
  if (!product) return Response.json({ error: 'That product could not be found any more. Search again.' }, { status: 404 });
  if (product.priceCents == null) return Response.json({ error: 'This product has no live price, so a funding goal cannot be calculated.' }, { status: 422 });
  const gap = fundingGap(product.priceCents, own);
  if (gap === 0) return Response.json({ error: 'You already have enough to buy this item — no campaign needed.', canAfford: true }, { status: 422 });
  const draft = await campaignAgent({ creatorName: p.data.creatorName, itemTitle: product.title, itemPriceCents: product.priceCents, ownFundsCents: own, purpose: p.data.purpose });
  return Response.json({ product, ownFundsCents: own, gapCents: gap, suggestedCents: suggestedTiers(gap), draft });
}
