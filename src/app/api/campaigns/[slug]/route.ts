import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUserId } from '@/lib/identity';
import { getCampaignBySlug } from '@/lib/campaigns';
import { generateJson } from '@/lib/ai/llm';
import { formatUSD } from '@/lib/money';
import { cleanText } from '@/lib/channel3';
import { reviewCampaignContent } from '@/lib/moderation';
import { detectFraudIntent } from '@/lib/eligibility';
import { recordSecurityEvent } from '@/lib/security-events';
import { bucketId } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('cancel') }),
  z.object({ action: z.literal('post_update'), body: z.string().trim().min(5).max(800), aiGenerated: z.boolean().default(false) }),
  z.object({ action: z.literal('draft_update') }),
]);

// Owner-only campaign actions. Ownership is the signed guest identity that created the campaign.
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const data = await getCampaignBySlug(slug);
  if (!data) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
  const userId = await currentUserId();
  if (!userId || userId !== data.campaign.owner_id) return Response.json({ error: 'Only the creator can manage this campaign.' }, { status: 403 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: 'Invalid action.' }, { status: 400 });
  const { campaign, totals } = data;

  if (p.data.action === 'cancel') {
    if (campaign.status === 'purchased') return Response.json({ error: 'A completed campaign cannot be cancelled.' }, { status: 409 });
    await db().from('campaigns').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', campaign.id);
    await db().from('campaign_updates').insert({ campaign_id: campaign.id, kind: 'update', body: 'The creator cancelled this campaign. No further contributions are accepted. Existing sandbox contributions remain recorded and can be refunded through PayPal.' });
    return Response.json({ ok: true });
  }
  if (p.data.action === 'post_update') {
    // Updates go through the same content rules as the campaign itself: editing after review is not a bypass.
    const review = reviewCampaignContent({ title: 'update', story: p.data.body, creatorName: '', priceCents: 0, maxCampaignCents: 1 });
    const redirect = review.reasons.some(r => r === 'contact_or_payment_redirect' || r === 'external_links' || r === 'false_verification_claim' || r === 'charity_or_tax_claim');
    if (review.block || redirect) {
      void recordSecurityEvent('update_blocked', 'warn', campaign.id, { reasons: review.reasons });
      return Response.json({ error: 'This update can’t be posted as written. Remove contact details, links, payment redirects, verification or charity claims.', code: 'update_blocked', reasons: review.reasons }, { status: 422 });
    }
    if (detectFraudIntent(p.data.body)) {
      // Stated intent to deceive pauses the campaign until a moderator looks at it.
      await db().from('campaigns').update({ moderation_status: 'pending_review', updated_at: new Date().toISOString() }).eq('id', campaign.id).in('moderation_status', ['auto_approved', 'approved']);
      void recordSecurityEvent('fraud_intent', 'alert', bucketId('user', userId), { route: 'campaign_update', campaign: campaign.id });
      return Response.json({ error: 'This campaign is paused for review.', code: 'paused_for_review' }, { status: 422 });
    }
    await db().from('campaign_updates').insert({ campaign_id: campaign.id, kind: 'update', body: cleanText(review.story, 800), ai_generated: p.data.aiGenerated });
    return Response.json({ ok: true });
  }
  // draft_update: AI writes a factual progress update from verified numbers only.
  const facts = `Raised ${formatUSD(totals.raisedCents)} of ${formatUSD(campaign.target_cents)} (${totals.percent}%) from ${totals.supporterCount} verified supporter(s). Status: ${campaign.status}. Item: ${campaign.title}.`;
  const r = await generateJson<{ update: string }>({
    system: 'You write short, honest campaign progress updates (max 70 words) for a personal fundraising page. Use ONLY the facts given. Never exaggerate or invent numbers. Thank supporters warmly.',
    prompt: facts,
    purpose: 'update_draft',
    schema: { type: 'object', properties: { update: { type: 'string' } }, required: ['update'] },
    temperature: 0.6,
  });
  return Response.json({ draft: r.ok ? r.data.update.slice(0, 800) : `Quick update: ${facts} Thank you to everyone who has supported so far!`, aiGenerated: r.ok });
}
