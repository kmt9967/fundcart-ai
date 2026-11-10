import { z } from 'zod';
import { runTurn, blockedTurn, type AgentEvent } from '@/lib/shopping/pipeline';
import { screenMessage } from '@/lib/shopping/safety';
import { INTENT_VERSION, type SessionState } from '@/lib/shopping/types';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/identity';
import { sharedRateLimit, clientKey, bucketId } from '@/lib/ratelimit';
import { policyFor, requestCountry, fundingOffer, POLICY_VERSION } from '@/lib/policy';
import { recordSecurityEvent } from '@/lib/security-events';
import { toCents } from '@/lib/money';
import { isLocale, DEFAULT_LOCALE, t, type Locale } from '@/i18n';
import { getLocale } from '@/i18n/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({
  prompt: z.string().trim().min(2).max(600),
  ownFunds: z.union([z.number(), z.string()]).optional().nullable(),
  /** Previous turn's session id: continues the conversation (server-side memory, owner-checked). */
  conversationId: z.string().uuid().optional().nullable(),
  locale: z.string().optional().nullable(),
  mode: z.enum(['best_fit', 'cheapest_adequate']).optional().nullable(),
});

// Streams the agent timeline as NDJSON lines: {type:'event'|'result'|'error', ...}
// Per-visitor and global daily allowances for model-backed turns (Gemini free tier is ~500 requests per
// model per day). Beyond them the assistant keeps working in rule-based mode instead of failing.
const AI_TURNS_PER_VISITOR_PER_DAY = 40;
const AI_TURNS_GLOBAL_PER_DAY = 600;

export async function POST(req: Request) {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > 8_000) return Response.json({ error: 'Request too large.' }, { status: 413 });
  const ip = clientKey(req);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const locale: Locale = parsed.success && isLocale(parsed.data.locale) ? parsed.data.locale : await getLocale().catch(() => DEFAULT_LOCALE);
  const rl = await sharedRateLimit([['assistant_ip_min', ip, 12, 60], ['assistant_ip_hour', ip, 120, 3600]]);
  if (!rl.ok) {
    void recordSecurityEvent('rate_limited', 'info', bucketId('ip', ip), { route: 'assistant', rule: rl.rule });
    return Response.json({ error: `Too many searches. Try again in ${rl.retryAfterSec}s.` }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } });
  }
  if (!parsed.success) return Response.json({ error: 'Please describe what you need (2–600 characters).' }, { status: 400 });
  const userId = await ensureUser();
  const policy = policyFor(requestCountry(req));
  const budget = await sharedRateLimit([['ai_user_day', userId, AI_TURNS_PER_VISITOR_PER_DAY, 86400], ['ai_global_day', 'all', AI_TURNS_GLOBAL_PER_DAY, 86400]]);
  if (!budget.ok) void recordSecurityEvent('ai_budget_exhausted', budget.rule === 'ai_global_day' ? 'warn' : 'info', budget.rule === 'ai_global_day' ? 'global' : bucketId('user', userId), {});
  let ownOverride: number | null = null;
  if (parsed.data.ownFunds != null && parsed.data.ownFunds !== '') {
    try { ownOverride = toCents(parsed.data.ownFunds); } catch { return Response.json({ error: 'Invalid amount for money you already have.' }, { status: 400 }); }
  }

  // Safety gate first. Card numbers are redacted before the text is stored, logged or sent to a model.
  const safety = screenMessage(parsed.data.prompt);

  // Conversation memory: only the same (signed) guest identity can continue its own session.
  let prev: SessionState | null = null;
  if (parsed.data.conversationId) {
    const row = await db().from('ai_sessions').select('intent, user_id').eq('id', parsed.data.conversationId).maybeSingle();
    const st = row.data?.intent as SessionState | undefined;
    if (row.data && row.data.user_id === userId && st && st.version === INTENT_VERSION) prev = st;
  }

  // Sensitive purchases are never stored in readable history; flags and policy version are kept for audit.
  const storedPrompt = safety.notices.includes('sensitive_purchase') ? '[sensitive purchase: not stored]' : safety.redacted;
  const session = await db().from('ai_sessions').insert({ user_id: userId, prompt: storedPrompt, safety: { flags: safety.flags, notices: safety.notices, piiRedacted: safety.piiRedacted }, policy_version: POLICY_VERSION }).select('id').single();
  if (safety.block) void recordSecurityEvent(safety.flags.some(f => ['injection', 'fake_authority', 'fake_verification'].includes(f)) ? 'injection_flag' : 'safety_block', 'info', bucketId('user', userId), { flags: safety.flags });
  const sessionId = session.data?.id as string | undefined;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const emit = (e: Omit<AgentEvent, 'at'>) => {
        const ev = { ...e, at: new Date().toISOString() };
        send({ type: 'event', event: ev });
        if (sessionId) void db().from('agent_events').insert({ session_id: sessionId, agent: ev.agent, step: ev.step, detail: ev.detail ?? {} });
      };
      try {
        if (safety.block) {
          emit({ agent: 'Safety', step: `Request stopped by the safety check (${safety.flags.join(', ')}); no products searched` });
          const result = blockedTurn(safety, locale);
          if (sessionId) await db().from('ai_sessions').update({ intent: prev, result: { kind: 'blocked', flags: safety.flags }, model: 'rules' }).eq('id', sessionId);
          send({ type: 'result', result: { ...result, state: prev, sessionId: prev ? sessionId : null } });
          return;
        }
        if (safety.piiRedacted) emit({ agent: 'Safety', step: 'Removed a card number from the message before processing' });
        const result = await runTurn({ raw: safety.redacted, prev, ownOverrideCents: ownOverride, locale, modeOverride: parsed.data.mode ?? null, safety, emit, allowModel: budget.ok, funding: fundingOffer(policy) });
        if (result.listingFlags.length) void recordSecurityEvent('injection_flag', 'info', 'listing', { count: result.listingFlags.length });
        emit({ agent: 'Orchestrator', step: t(locale, 'assistant.doneStep') });
        if (sessionId) await db().from('ai_sessions').update({
          intent: result.state,
          result: { kind: result.kind, bestFit: result.bestFit, cheapestAdequate: result.cheapestAdequate, picks: result.picks.map(p => p.externalId), parent: prev ? parsed.data.conversationId : null },
          model: result.aiUsed ? 'gemini' : 'rules',
        }).eq('id', sessionId);
        send({ type: 'result', result: { ...result, sessionId } });
      } catch (e) {
        send({ type: 'error', error: e instanceof Error ? e.message : t(locale, 'assistant.somethingWrong') });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
