import { z } from 'zod';
import { db } from '@/lib/db';
import { currentModerator, moderationQueue } from '@/lib/moderators';
import { recordSecurityEvent } from '@/lib/security-events';
import { cleanText } from '@/lib/channel3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  campaignId: z.string().uuid(),
  decision: z.enum(['approve', 'reject', 'hide', 'pause', 'clarify']),
  note: z.string().trim().max(300).optional().default(''),
});

// Moderator-only. Function-level authorization on every call (role from the signed-in account's
// database row). A moderator cannot decide on their own campaign. Every decision is logged.
export async function GET() {
  const mod = await currentModerator();
  if (!mod) return Response.json({ error: 'Moderators only.' }, { status: 403 });
  return Response.json({ items: await moderationQueue(mod.profileId) }, { headers: { 'cache-control': 'no-store' } });
}

const STATUS: Record<string, string> = { approve: 'approved', reject: 'rejected', hide: 'hidden', pause: 'pending_review', clarify: 'pending_review' };

export async function POST(req: Request) {
  const mod = await currentModerator();
  if (!mod) return Response.json({ error: 'Moderators only.' }, { status: 403 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: 'Invalid decision.' }, { status: 400 });
  const { decision } = p.data;
  const note = cleanText(p.data.note, 300);
  if ((decision === 'reject' || decision === 'clarify') && note.length < 5) return Response.json({ error: 'A reason is required for this decision.', code: 'note_required' }, { status: 400 });
  const c = await db().from('campaigns').select('id, owner_id, moderation_status, moderation_reasons, status').eq('id', p.data.campaignId).maybeSingle();
  if (!c.data) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
  if (c.data.owner_id === mod.profileId) return Response.json({ error: 'Conflict of interest: you cannot moderate your own campaign.' }, { status: 403 });
  if (c.data.status === 'cancelled' && decision === 'approve') return Response.json({ error: 'Cancelled campaigns cannot be approved.' }, { status: 409 });
  const status = STATUS[decision];
  const reasons = new Set<string>(c.data.moderation_reasons || []);
  if (decision === 'clarify') reasons.add('clarification_requested');
  if (decision === 'pause') reasons.add('paused_by_moderator');
  if (decision === 'approve') { reasons.delete('clarification_requested'); reasons.delete('paused_by_moderator'); }
  await db().from('campaigns').update({ moderation_status: status, moderation_reasons: [...reasons], moderated_by: mod.profileId, moderated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', c.data.id);
  if (decision !== 'clarify' && decision !== 'pause') await db().from('campaign_reports').update({ status: decision === 'approve' ? 'dismissed' : 'actioned' }).eq('campaign_id', c.data.id).eq('status', 'open');
  const body = {
    approve: 'A moderator reviewed this campaign and allowed it to accept contributions. This is not identity or need verification.',
    reject: `A moderator reviewed this campaign and did not approve it. Reason: ${note}`,
    hide: 'A moderator reviewed this campaign and removed it from public view. Recorded contributions are unchanged and can be refunded through PayPal.',
    pause: `A moderator paused new contributions while this campaign is reviewed.${note ? ` Note: ${note}` : ''} Recorded contributions are unchanged.`,
    clarify: `A moderator needs more information before deciding: ${note}`,
  }[decision];
  await db().from('campaign_updates').insert({ campaign_id: c.data.id, kind: 'moderation', body });
  void recordSecurityEvent('campaign_moderated', decision === 'approve' ? 'info' : 'warn', c.data.id, { from: c.data.moderation_status, to: status, decision, by: mod.profileId, note: note || undefined });
  return Response.json({ ok: true, status, decision });
}
