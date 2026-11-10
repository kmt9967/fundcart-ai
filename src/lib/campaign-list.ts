import 'server-only';
import { db } from './db';
import { fundingPercent } from './money';

export type CampaignSummary = {
  slug: string; title: string; creatorName: string; imageUrl: string | null; status: string; category: string | null;
  targetCents: number; raisedCents: number; supporterCount: number; percent: number; isDemoSeed: boolean;
};

export async function listPublicCampaigns(limit = 24, ownerId?: string): Promise<CampaignSummary[]> {
  let q = db().from('campaigns').select('id, slug, title, creator_name, image_url, status, category, target_cents, is_demo_seed, created_at').order('created_at', { ascending: false }).limit(limit);
  q = ownerId ? q.eq('owner_id', ownerId) : q.eq('visibility', 'public').neq('status', 'cancelled').in('moderation_status', ['auto_approved', 'approved']);
  const c = await q;
  const rows = c.data || [];
  if (!rows.length) return [];
  const t = await db().from('campaign_totals').select('campaign_id, raised_cents, supporter_count').in('campaign_id', rows.map(r => r.id));
  const totals = new Map((t.data || []).map(x => [x.campaign_id, x]));
  return rows.map(r => {
    const tt = totals.get(r.id);
    const raised = Number(tt?.raised_cents ?? 0); const target = Number(r.target_cents);
    return { slug: r.slug, title: r.title, creatorName: r.creator_name, imageUrl: r.image_url, status: r.status, category: r.category, targetCents: target, raisedCents: raised, supporterCount: Number(tt?.supporter_count ?? 0), percent: fundingPercent(raised, target), isDemoSeed: r.is_demo_seed };
  });
}
