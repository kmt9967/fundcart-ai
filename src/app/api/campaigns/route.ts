import { z } from 'zod';
import { findRecentProduct, saveSnapshot, cleanText } from '@/lib/channel3';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/identity';
import { campaignGap, formatUSD, suggestedTiers, toCents } from '@/lib/money';
import { makeSlug } from '@/lib/campaigns';
import { sharedRateLimit, clientKey, bucketId } from '@/lib/ratelimit';
import { policyFor, requestCountry, canCreateCampaign, NEED_CATEGORIES, POLICY_VERSION } from '@/lib/policy';
import { reviewCampaignContent, contentFingerprint, scoreOf, REVIEW_THRESHOLD, type ModerationReason } from '@/lib/moderation';
import { recordSecurityEvent } from '@/lib/security-events';
import { getLocale } from '@/i18n/server';
import { t } from '@/i18n';

export const runtime = 'nodejs';

// Only these fields are read; anything else in the request (status, target_cents, verified, …) is
// dropped by zod. The goal is always recomputed on the server from live catalog data.
const Body = z.object({
  externalId: z.string().min(3).max(40),
  ownFunds: z.union([z.number(), z.string()]),
  creatorName: z.string().trim().min(1).max(40),
  title: z.string().trim().min(5).max(90),
  story: z.string().trim().min(20).max(1500),
  thankYou: z.string().trim().max(300).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  visibility: z.enum(['public', 'unlisted']).default('public'),
  needCategory: z.enum(NEED_CATEGORIES).optional().nullable(),
  /** The assistant turn that recommended this item (owner-checked): proves it was the cheapest adequate option. */
  sessionId: z.string().uuid().optional().nullable(),
  ownerPaysDifference: z.boolean().optional().default(false),
  /** Honeypot: hidden from people, often filled by bots. */
  website: z.string().max(200).optional().default(''),
});

const BUFFER_PCT = 5;
const MAX_ACTIVE_PER_OWNER = 3;

export async function POST(req: Request) {
  const locale = await getLocale();
  const ip = clientKey(req);
  const rl = await sharedRateLimit([['create_ip_min', ip, 5, 60], ['create_ip_day', ip, 20, 86400]]);
  if (!rl.ok) { void recordSecurityEvent('rate_limited', 'warn', bucketId('ip', ip), { route: 'campaigns' }); return Response.json({ error: 'Too many campaigns created. Please wait a minute.' }, { status: 429 }); }
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: 'Please complete the title (5+ chars) and story (20+ chars).' }, { status: 400 });
  if (p.data.website) { void recordSecurityEvent('honeypot', 'warn', bucketId('ip', ip), { route: 'campaigns' }); return Response.json({ error: 'Could not create the campaign.' }, { status: 400 }); }

  const country = requestCountry(req);
  const policy = policyFor(country);
  const userId = await ensureUser(p.data.creatorName);
  // Attempt limits (validation retries count). Successful creations are capped separately: at most
  // MAX_ACTIVE_PER_OWNER active campaigns and a velocity review flag for 2+ new campaigns in 24 hours.
  const url = await sharedRateLimit([['create_user_hour', userId, 10, 3600], ['create_user_day', userId, 20, 86400]]);
  if (!url.ok) return Response.json({ error: 'Too many campaigns created. Please wait a while.' }, { status: 429 });

  let own: number;
  try { own = toCents(p.data.ownFunds); } catch { return Response.json({ error: 'Invalid amount.' }, { status: 400 }); }

  // Server re-derives the price from Channel3 data: the client never sets the goal.
  const product = await findRecentProduct(p.data.externalId);
  if (!product || product.priceCents == null) return Response.json({ error: 'Product price unavailable.' }, { status: 422 });

  // Country policy gate (trusted configuration; never decided by the AI).
  const decision = canCreateCampaign(policy, p.data.needCategory ?? null, product.category, `${product.title} ${p.data.title}`);
  if (!decision.allowed) {
    void recordSecurityEvent('policy_block', 'info', country, { reason: decision.reason });
    return Response.json({ error: t(locale, decision.messageKey as never), code: decision.reason }, { status: decision.reason === 'fundraising_disabled_in_country' ? 403 : 422 });
  }

  const reasons = new Set<ModerationReason>();
  // Cheapest adequate rule: campaigns fund the cheapest item that met the requirements in the assistant turn.
  let basisCents = product.priceCents;
  let rankingMode: 'cheapest_adequate' | 'owner_pays_difference' | 'unchecked' = 'unchecked';
  if (p.data.sessionId) {
    const s = await db().from('ai_sessions').select('user_id, result').eq('id', p.data.sessionId).maybeSingle();
    const cheapestId = s.data && s.data.user_id === userId ? ((s.data.result as { cheapestAdequate?: string[] } | null)?.cheapestAdequate?.[0] ?? null) : null;
    if (cheapestId && cheapestId !== product.externalId) {
      const cheap = await findRecentProduct(cheapestId);
      if (cheap?.priceCents != null && cheap.priceCents < product.priceCents) {
        if (!p.data.ownerPaysDifference) {
          return Response.json({ error: t(locale, 'builder.premiumBody', { title: cheap.title, price: formatUSD(cheap.priceCents) }), code: 'premium_over_adequate', cheapest: { externalId: cheap.externalId, title: cheap.title, priceCents: cheap.priceCents } }, { status: 409 });
        }
        basisCents = cheap.priceCents; rankingMode = 'owner_pays_difference'; reasons.add('premium_over_adequate');
      } else rankingMode = 'cheapest_adequate';
    } else if (cheapestId) rankingMode = 'cheapest_adequate';
  }
  if (rankingMode === 'unchecked') reasons.add('no_suitability_check');

  const gap = campaignGap({ priceCents: basisCents, bufferPct: BUFFER_PCT, ownFundsCents: own });
  const target = gap.totalCents;
  if (target <= 0) return Response.json({ error: 'No funding gap: you can already afford this item.' }, { status: 422 });
  if (p.data.deadline && new Date(p.data.deadline) < new Date(new Date().toDateString())) return Response.json({ error: 'The deadline must be in the future.' }, { status: 400 });

  // Content review (PII scrub, spam, deceptive claims) + abuse signals.
  const review = reviewCampaignContent({ title: p.data.title, story: p.data.story, creatorName: p.data.creatorName, priceCents: target, maxCampaignCents: policy.maxCampaignCents });
  if (review.block) {
    void recordSecurityEvent('campaign_flagged', 'warn', bucketId('user', userId), { reasons: review.reasons, blocked: true });
    return Response.json({ error: t(locale, 'mod.blocked'), code: 'content_blocked', reasons: review.reasons }, { status: 422 });
  }
  review.reasons.forEach(r => reasons.add(r));

  const active = await db().from('campaigns').select('id, product_snapshot_id, created_at').eq('owner_id', userId).in('status', ['active', 'goal_reached']);
  const activeRows = active.data || [];
  if (activeRows.length >= MAX_ACTIVE_PER_OWNER) return Response.json({ error: t(locale, 'mod.tooMany'), code: 'too_many_active' }, { status: 429 });
  if (activeRows.length) {
    const snaps = await db().from('product_snapshots').select('id').in('id', activeRows.map(r => r.product_snapshot_id).filter(Boolean)).eq('external_id', product.externalId);
    if (snaps.data?.length) return Response.json({ error: t(locale, 'mod.duplicate'), code: 'duplicate_item' }, { status: 409 });
    if (activeRows.filter(r => Date.now() - new Date(r.created_at).getTime() < 86_400_000).length >= 2) reasons.add('velocity');
  }
  const hash = contentFingerprint(review.title, review.story);
  const dup = await db().from('campaigns').select('id', { count: 'exact', head: true }).eq('content_hash', hash).neq('owner_id', userId);
  if ((dup.count ?? 0) > 0) reasons.add('duplicate_content');

  const reasonList = [...reasons];
  const score = scoreOf(reasonList);
  const moderation = policy.adminReviewRequired || score >= REVIEW_THRESHOLD ? 'pending_review' : 'auto_approved';

  const snapshotId = await saveSnapshot(product);
  const ins = await db().from('campaigns').insert({
    slug: makeSlug(review.title), owner_id: userId, creator_name: cleanText(p.data.creatorName, 40),
    title: cleanText(review.title, 90), story: review.story.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, 1500),
    category: product.category, product_snapshot_id: snapshotId, item_price_cents: product.priceCents, own_funds_cents: own,
    target_cents: target, suggested_amounts_cents: suggestedTiers(target), image_url: product.imageUrl,
    visibility: p.data.visibility, deadline: p.data.deadline || null,
    country, need_category: p.data.needCategory, ranking_mode: rankingMode, buffer_cents: gap.formula.buffer,
    gap_formula: { ...gap.formula, basisPrice: basisCents, ownerPaysDifferenceCents: product.priceCents - basisCents, shippingListed: false, taxListed: false },
    policy_version: POLICY_VERSION, price_rechecked_at: product.fetchedAt, live_price_cents: product.priceCents,
    moderation_status: moderation, moderation_reasons: reasonList, content_hash: hash,
  }).select('id, slug').single();
  if (ins.error) return Response.json({ error: 'Could not create the campaign.' }, { status: 500 });
  if (p.data.thankYou) await db().from('campaign_updates').insert({ campaign_id: ins.data.id, kind: 'thank_you', body: cleanText(reviewCampaignContent({ title: 'x', story: p.data.thankYou, creatorName: '', priceCents: 0, maxCampaignCents: 1 }).story, 300), ai_generated: true });
  await db().from('agent_events').insert({ campaign_id: ins.data.id, agent: 'Campaign Assistant', step: 'Campaign created from a live product snapshot', detail: { snapshotId, targetCents: target, rankingMode, moderation, policyVersion: POLICY_VERSION } });
  if (moderation === 'pending_review') void recordSecurityEvent('campaign_flagged', 'info', ins.data.id, { reasons: reasonList, score });
  return Response.json({ slug: ins.data.slug, moderation, reasons: reasonList });
}
