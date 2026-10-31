import { z } from 'zod';
import { findRecentProduct, saveSnapshot, cleanText } from '@/lib/channel3';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/identity';
import { fundingGap, suggestedTiers, toCents } from '@/lib/money';
import { makeSlug } from '@/lib/campaigns';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const Body = z.object({
  externalId: z.string().min(3).max(40),
  ownFunds: z.union([z.number(), z.string()]),
  creatorName: z.string().trim().min(1).max(40),
  title: z.string().trim().min(5).max(90),
  story: z.string().trim().min(20).max(1500),
  thankYou: z.string().trim().max(300).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  visibility: z.enum(['public', 'unlisted']).default('public'),
});

export async function POST(req: Request) {
  if (!rateLimit(`create:${clientKey(req)}`, 5, 60_000).ok) return Response.json({ error: 'Too many campaigns created. Please wait a minute.' }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: 'Please complete the title (5+ chars) and story (20+ chars).' }, { status: 400 });
  const userId = await ensureUser(p.data.creatorName);
  let own: number;
  try { own = toCents(p.data.ownFunds); } catch { return Response.json({ error: 'Invalid amount.' }, { status: 400 }); }

  // Server re-derives the price from Channel3 data — the client never sets the goal.
  const product = await findRecentProduct(p.data.externalId);
  if (!product || product.priceCents == null) return Response.json({ error: 'Product price unavailable.' }, { status: 422 });
  const target = fundingGap(product.priceCents, own);
  if (target <= 0) return Response.json({ error: 'No funding gap — you can already afford this item.' }, { status: 422 });
  if (p.data.deadline && new Date(p.data.deadline) < new Date(new Date().toDateString())) return Response.json({ error: 'The deadline must be in the future.' }, { status: 400 });

  const snapshotId = await saveSnapshot(product);
  const ins = await db().from('campaigns').insert({
    slug: makeSlug(p.data.title), owner_id: userId, creator_name: cleanText(p.data.creatorName, 40),
    title: cleanText(p.data.title, 90), story: p.data.story.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, 1500),
    category: product.category, product_snapshot_id: snapshotId, item_price_cents: product.priceCents, own_funds_cents: own,
    target_cents: target, suggested_amounts_cents: suggestedTiers(target), image_url: product.imageUrl,
    visibility: p.data.visibility, deadline: p.data.deadline || null,
  }).select('id, slug').single();
  if (ins.error) return Response.json({ error: 'Could not create the campaign.' }, { status: 500 });
  if (p.data.thankYou) await db().from('campaign_updates').insert({ campaign_id: ins.data.id, kind: 'thank_you', body: cleanText(p.data.thankYou, 300), ai_generated: true });
  await db().from('agent_events').insert({ campaign_id: ins.data.id, agent: 'Campaign Assistant', step: 'Campaign created from a live product snapshot', detail: { snapshotId, targetCents: target } });
  return Response.json({ slug: ins.data.slug });
}
