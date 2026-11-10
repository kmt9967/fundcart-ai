import { z } from 'zod';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/identity';
import { getCampaignBySlug } from '@/lib/campaigns';
import { sharedRateLimit, clientKey, bucketId, networkKey } from '@/lib/ratelimit';
import { REPORT_REASONS, AUTO_HIDE_REPORTS, REPORTER_MIN_AGE_HOURS, shouldAutoPause } from '@/lib/moderation';
import { redactPii } from '@/lib/shopping/safety';
import { recordSecurityEvent } from '@/lib/security-events';
import { getLocale } from '@/i18n/server';
import { t } from '@/i18n';

export const runtime = 'nodejs';

const Body = z.object({ reason: z.enum(REPORT_REASONS), details: z.string().trim().max(300).optional().default(''), website: z.string().max(200).optional().default('') });

// Public reporting. One report per visitor per campaign. Every report reaches the moderator queue, but a
// report only counts toward an automatic pause when the reporter is established (profile older than a day,
// or a completed Sandbox contribution) and reports come from distinct networks. A pause is a review state,
// never a finding: contributions stop until a moderator decides, and a moderator's approval cannot be undone
// by further reports (they only queue). Reporters are never shown publicly.
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const locale = await getLocale();
  const { slug } = await ctx.params;
  const ip = clientKey(req);
  const rl = await sharedRateLimit([['report_ip_hour', ip, 10, 3600], ['report_ip_day', ip, 20, 86400]]);
  if (!rl.ok) return Response.json({ error: t(locale, 'auth.errRate') }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success || p.data.website) return Response.json({ error: 'Invalid report.' }, { status: 400 });
  const data = await getCampaignBySlug(slug);
  if (!data) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
  const userId = await ensureUser();
  if (userId === data.campaign.owner_id) return Response.json({ error: 'You cannot report your own campaign.' }, { status: 400 });

  const net = bucketId('net', networkKey(ip));
  const prof = await db().from('profiles').select('created_at').eq('id', userId).maybeSingle();
  const ageHours = prof.data?.created_at ? (Date.now() - new Date(prof.data.created_at).getTime()) / 3_600_000 : 0;
  let eligible = ageHours >= REPORTER_MIN_AGE_HOURS;
  if (!eligible) {
    const paid = await db().from('payment_orders').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('capture_status', 'COMPLETED');
    eligible = (paid.count ?? 0) > 0;
  }
  const ins = await db().from('campaign_reports').insert({ campaign_id: data.campaign.id, reporter_id: userId, reason: p.data.reason, details: redactPii(p.data.details).text || null, reporter_net: net, eligible });
  if (ins.error) {
    if (/duplicate key/.test(ins.error.message)) return Response.json({ ok: true, message: t(locale, 'trust.reportAlready') });
    return Response.json({ error: 'Could not save the report.' }, { status: 500 });
  }
  void recordSecurityEvent('campaign_reported', 'info', data.campaign.id, { reason: p.data.reason, reporter: bucketId('user', userId) });

  const open = await db().from('campaign_reports').select('reporter_net, eligible').eq('campaign_id', data.campaign.id).eq('status', 'open').limit(500);
  const decision = shouldAutoPause(open.data || [], data.campaign.moderation_status ?? 'auto_approved');
  if (decision.brigading) void recordSecurityEvent('report_brigading', 'warn', data.campaign.id, { sameNetwork: decision.maxPerNetwork });
  if (decision.pause) {
    const upd = await db().from('campaigns').update({ moderation_status: 'pending_review', updated_at: new Date().toISOString() }).eq('id', data.campaign.id).eq('moderation_status', 'auto_approved').select('id');
    if (upd.data?.length) {
      await db().from('campaign_updates').insert({ campaign_id: data.campaign.id, kind: 'moderation', body: 'This campaign received reports, so new contributions are paused while a moderator reviews it. Reports are not findings of wrongdoing. Recorded contributions are unchanged.' });
      void recordSecurityEvent('campaign_auto_paused', 'warn', data.campaign.id, { distinctNetworks: decision.distinctEligibleNetworks });
    }
  }
  return Response.json({ ok: true, message: t(locale, 'trust.reportThanks') });
}
