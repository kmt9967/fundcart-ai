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
};

export async function moderationQueue(): Promise<QueueItem[]> {
  const pending = await db().from('campaigns').select('id, slug, title, story, creator_name, moderation_status, moderation_reasons, target_cents, created_at').eq('moderation_status', 'pending_review').order('created_at', { ascending: true }).limit(50);
  const reported = await db().from('campaign_reports').select('campaign_id, reason, details, created_at').eq('status', 'open').limit(200);
  const reportMap = new Map<string, QueueItem['reports']>();
  for (const r of reported.data || []) {
    const list = reportMap.get(r.campaign_id) || [];
    list.push({ reason: r.reason, details: r.details, createdAt: r.created_at });
    reportMap.set(r.campaign_id, list);
  }
  const ids = new Set((pending.data || []).map(c => c.id));
  const extraIds = [...reportMap.keys()].filter(id => !ids.has(id));
  const extra = extraIds.length ? await db().from('campaigns').select('id, slug, title, story, creator_name, moderation_status, moderation_reasons, target_cents, created_at').in('id', extraIds) : { data: [] };
  return [...(pending.data || []), ...(extra.data || [])].map(c => ({
    id: c.id, slug: c.slug, title: c.title, story: c.story, creatorName: c.creator_name, moderationStatus: c.moderation_status,
    reasons: c.moderation_reasons || [], targetCents: Number(c.target_cents), createdAt: c.created_at, reports: reportMap.get(c.id) || [],
  }));
}
