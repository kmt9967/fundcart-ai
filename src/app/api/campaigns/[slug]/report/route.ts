import { z } from 'zod';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/identity';
import { getCampaignBySlug } from '@/lib/campaigns';
import { sharedRateLimit, clientKey, bucketId } from '@/lib/ratelimit';
import { REPORT_REASONS, AUTO_HIDE_REPORTS } from '@/lib/moderation';
import { redactPii } from '@/lib/shopping/safety';
import { recordSecurityEvent } from '@/lib/security-events';
import { getLocale } from '@/i18n/server';
import { t } from '@/i18n';

export const runtime = 'nodejs';

const Body = z.object({ reason: z.enum(REPORT_REASONS), details: z.string().trim().max(300).optional().default(''), website: z.string().max(200).optional().default('') });

// Public reporting. One report per visitor per campaign; enough distinct reports pause the campaign
// (moderation_status = pending_review) until a moderator decides. Reporters are never shown publicly.
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const locale = await getLocale();
  const { slug } = await ctx.params;
  const ip = clientKey(req);
  const rl = await sharedRateLimit([['report_ip_hour', ip, 10, 3600]]);
  if (!rl.ok) return Response.json({ error: t(locale, 'auth.errRate') }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success || p.data.website) return Response.json({ error: 'Invalid report.' }, { status: 400 });
  const data = await getCampaignBySlug(slug);
  if (!data) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
  const userId = await ensureUser();
  if (userId === data.campaign.owner_id) return Response.json({ error: 'You cannot report your own campaign.' }, { status: 400 });

  const ins = await db().from('campaign_reports').insert({ campaign_id: data.campaign.id, reporter_id: userId, reason: p.data.reason, details: redactPii(p.data.details).text || null });
  if (ins.error) {
    if (/duplicate key/.test(ins.error.message)) return Response.json({ ok: true, message: t(locale, 'trust.reportAlready') });
    return Response.json({ error: 'Could not save the report.' }, { status: 500 });
  }
  void recordSecurityEvent('campaign_reported', 'info', data.campaign.id, { reason: p.data.reason, reporter: bucketId('user', userId) });

  const open = await db().from('campaign_reports').select('id', { count: 'exact', head: true }).eq('campaign_id', data.campaign.id).eq('status', 'open');
  if ((open.count ?? 0) >= AUTO_HIDE_REPORTS && ['auto_approved', 'approved'].includes(data.campaign.moderation_status ?? 'auto_approved')) {
    const upd = await db().from('campaigns').update({ moderation_status: 'pending_review', updated_at: new Date().toISOString() }).eq('id', data.campaign.id).in('moderation_status', ['auto_approved', 'approved']).select('id');
    if (upd.data?.length) {
      await db().from('campaign_updates').insert({ campaign_id: data.campaign.id, kind: 'moderation', body: 'Several people reported this campaign, so new contributions are paused until a moderator reviews it. Recorded contributions are unchanged.' });
      void recordSecurityEvent('campaign_auto_hidden', 'warn', data.campaign.id, { reports: open.count });
    }
  }
  return Response.json({ ok: true, message: t(locale, 'trust.reportThanks') });
}
