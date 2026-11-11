import 'server-only';
import { db } from './db';
import { currentAccount } from './auth';

// Moderator access: a signed-in account whose profile row has role 'moderator' or 'admin'. Roles are
// granted only by an operator in SQL (never by chat, API or the AI). Guests are never moderators.
export async function currentModerator(): Promise<{ profileId: string; role: string } | null> {
  const a = await currentAccount();
  if (!a || !['moderator', 'admin'].includes(a.role)) return null;
  return { profileId: a.profileId, role: a.role };
}

export type QueueItem = {
  id: string; slug: string; title: string; story: string; creatorName: string; moderationStatus: string; reasons: string[];
  targetCents: number; createdAt: string; reports: Array<{ reason: string; details: string | null; createdAt: string }>;
  status: string; visibility: string; needCategory: string | null; rankingMode: string | null;
  itemPriceCents: number; ownFundsCents: number; bufferCents: number; productTitle: string | null; merchant: string | null;
  ownerVerified: boolean; ownerHasAccount: boolean; ownedByViewer: boolean;
  eligibility: { outcome?: string; risk?: string; reasons?: string[] } | null; creatorPurpose: string | null;
  raisedCents: number; history: Array<{ body: string; createdAt: string }>;
};

const COLS = 'id, slug, title, story, creator_name, moderation_status, moderation_reasons, target_cents, created_at, status, visibility, need_category, ranking_mode, item_price_cents, own_funds_cents, buffer_cents, owner_id, product_snapshot_id';

// Pending campaigns plus any campaign with open reports. Risk details come from the server-side
// eligibility record written at creation; nothing here trusts client input.
export async function moderationQueue(viewerProfileId?: string): Promise<QueueItem[]> {
  const pending = await db().from('campaigns').select(COLS).eq('moderation_status', 'pending_review').order('created_at', { ascending: true }).limit(50);
  const reported = await db().from('campaign_reports').select('campaign_id, reason, details, created_at').eq('status', 'open').limit(200);
  const reportMap = new Map<string, QueueItem['reports']>();
  for (const r of reported.data || []) {
    const list = reportMap.get(r.campaign_id) || [];
    list.push({ reason: r.reason, details: r.details, createdAt: r.created_at });
    reportMap.set(r.campaign_id, list);
  }
  const ids = new Set((pending.data || []).map(c => c.id));
  const extraIds = [...reportMap.keys()].filter(id => !ids.has(id));
  const extra = extraIds.length ? await db().from('campaigns').select(COLS).in('id', extraIds) : { data: [] as never[] };
  const rows = [...(pending.data || []), ...(extra.data || [])];
  if (!rows.length) return [];
  const campaignIds = rows.map(c => c.id);
  const [owners, snaps, events, contribs, updates] = await Promise.all([
    db().from('profiles').select('id, auth_user_id, email_verified').in('id', [...new Set(rows.map(c => c.owner_id))]),
    db().from('product_snapshots').select('id, title, merchant_domain').in('id', rows.map(c => c.product_snapshot_id).filter(Boolean)),
    db().from('agent_events').select('campaign_id, detail, created_at').in('campaign_id', campaignIds).eq('agent', 'Campaign Assistant').order('created_at', { ascending: true }),
    db().from('contributions').select('campaign_id, amount_cents').in('campaign_id', campaignIds),
    db().from('campaign_updates').select('campaign_id, body, created_at').in('campaign_id', campaignIds).eq('kind', 'moderation').order('created_at', { ascending: false }),
  ]);
  const ownerMap = new Map((owners.data || []).map(o => [o.id, o]));
  const snapMap = new Map((snaps.data || []).map(s => [s.id, s]));
  const evMap = new Map<string, Record<string, unknown>>();
  for (const e of events.data || []) if (!evMap.has(e.campaign_id)) evMap.set(e.campaign_id, (e.detail || {}) as Record<string, unknown>);
  const raised = new Map<string, number>();
  for (const k of contribs.data || []) raised.set(k.campaign_id, (raised.get(k.campaign_id) || 0) + Number(k.amount_cents));
  const hist = new Map<string, QueueItem['history']>();
  for (const u of updates.data || []) { const l = hist.get(u.campaign_id) || []; if (l.length < 3) l.push({ body: u.body, createdAt: u.created_at }); hist.set(u.campaign_id, l); }
  return rows.map(c => {
    const o = ownerMap.get(c.owner_id); const s = c.product_snapshot_id ? snapMap.get(c.product_snapshot_id) : undefined; const d = evMap.get(c.id) || null;
    return {
      id: c.id, slug: c.slug, title: c.title, story: c.story, creatorName: c.creator_name, moderationStatus: c.moderation_status,
      reasons: c.moderation_reasons || [], targetCents: Number(c.target_cents), createdAt: c.created_at, reports: reportMap.get(c.id) || [],
      status: c.status, visibility: c.visibility, needCategory: c.need_category, rankingMode: c.ranking_mode,
      itemPriceCents: Number(c.item_price_cents), ownFundsCents: Number(c.own_funds_cents), bufferCents: Number(c.buffer_cents || 0),
      productTitle: s?.title || null, merchant: s?.merchant_domain || null,
      ownerVerified: o?.email_verified === true, ownerHasAccount: !!o?.auth_user_id, ownedByViewer: !!viewerProfileId && c.owner_id === viewerProfileId,
      eligibility: (d?.eligibility as QueueItem['eligibility']) || null, creatorPurpose: typeof d?.creatorPurpose === 'string' ? d.creatorPurpose : null,
      raisedCents: raised.get(c.id) || 0, history: hist.get(c.id) || [],
    };
  });
}
