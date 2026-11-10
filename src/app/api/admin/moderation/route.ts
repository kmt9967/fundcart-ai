import { z } from 'zod';
import { db } from '@/lib/db';
import { currentModerator, moderationQueue } from '@/lib/moderators';
import { recordSecurityEvent } from '@/lib/security-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ campaignId: z.string().uuid(), decision: z.enum(['approve', 'reject', 'hide']), note: z.string().trim().max(300).optional().default('') });

// Moderator-only. Function-level authorization on every call (role from the signed-in account's
// database row). A moderator cannot decide on their own campaign. Every decision is logged.
export async function GET() {
  const mod = await currentModerator();
  if (!mod) return Response.json({ error: 'Moderators only.' }, { status: 403 });
  return Response.json({ items: await moderationQueue() }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: Request) {
  const mod = await currentModerator();
  if (!mod) return Response.json({ error: 'Moderators only.' }, { status: 403 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: 'Invalid decision.' }, { status: 400 });
  const c = await db().from('campaigns').select('id, owner_id, moderation_status').eq('id', p.data.campaignId).maybeSingle();
  if (!c.data) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
  if (c.data.owner_id === mod.profileId) return Response.json({ error: 'Conflict of interest: you cannot moderate your own campaign.' }, { status: 403 });
  const status = p.data.decision === 'approve' ? 'approved' : p.data.decision === 'reject' ? 'rejected' : 'hidden';
  await db().from('campaigns').update({ moderation_status: status, moderated_by: mod.profileId, moderated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', c.data.id);
  await db().from('campaign_reports').update({ status: p.data.decision === 'approve' ? 'dismissed' : 'actioned' }).eq('campaign_id', c.data.id).eq('status', 'open');
  const body = status === 'approved' ? 'A moderator reviewed this campaign and allowed it to accept contributions. This is not identity or need verification.'
    : 'A moderator reviewed this campaign and removed it from public view. Recorded contributions are unchanged and can be refunded through PayPal.';
  await db().from('campaign_updates').insert({ campaign_id: c.data.id, kind: 'moderation', body });
  void recordSecurityEvent('campaign_moderated', 'info', c.data.id, { from: c.data.moderation_status, to: status, by: mod.profileId });
  return Response.json({ ok: true, status });
}
