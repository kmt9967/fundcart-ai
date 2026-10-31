import { z } from 'zod';
import { intentAgent, researchAgent, rankProducts, comparisonAgent, budgetAgent, type AgentEvent } from '@/lib/ai/agents';
import { db } from '@/lib/db';
import { ensureUser } from '@/lib/identity';
import { rateLimit, clientKey } from '@/lib/ratelimit';
import { toCents } from '@/lib/money';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({
  prompt: z.string().trim().min(3).max(600),
  ownFunds: z.union([z.number(), z.string()]).optional().nullable(),
});

// Streams the agent timeline as NDJSON lines: {type:'event'|'result'|'error', ...}
export async function POST(req: Request) {
  const rl = rateLimit(`assistant:${clientKey(req)}`, 10, 60_000);
  if (!rl.ok) return Response.json({ error: `Too many searches. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Please describe what you need (3–600 characters).' }, { status: 400 });
  const userId = await ensureUser();
  let ownOverride: number | null = null;
  if (parsed.data.ownFunds != null && parsed.data.ownFunds !== '') {
    try { ownOverride = toCents(parsed.data.ownFunds); } catch { return Response.json({ error: 'Invalid amount for money you already have.' }, { status: 400 }); }
  }

  const session = await db().from('ai_sessions').insert({ user_id: userId, prompt: parsed.data.prompt }).select('id').single();
  const sessionId = session.data?.id as string | undefined;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const events: AgentEvent[] = [];
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const emit = (e: Omit<AgentEvent, 'at'>) => {
        const ev = { ...e, at: new Date().toISOString() };
        events.push(ev); send({ type: 'event', event: ev });
        if (sessionId) void db().from('agent_events').insert({ session_id: sessionId, agent: ev.agent, step: ev.step, detail: ev.detail ?? {} });
      };
      try {
        emit({ agent: 'Orchestrator', step: 'Planning: understand → search → compare → budget' });
        const { intent, usedModel } = await intentAgent(parsed.data.prompt, emit);
        if (ownOverride != null) intent.ownFundsCents = ownOverride;
        const research = await researchAgent(intent, emit);
        const ranked = rankProducts(research.products, intent);
        const comparison = await comparisonAgent(intent, ranked, emit);
        const budget = budgetAgent(intent, ranked, emit);
        emit({ agent: 'Orchestrator', step: 'Done. Nothing is purchased without your explicit approval.' });
        const result = {
          sessionId, intent, aiUsed: usedModel || comparison.usedModel,
          products: ranked.slice(0, 9), recommendations: comparison.recommendations, summary: comparison.summary,
          budget, dataSource: { provider: 'Channel3', fetchedAt: research.fetchedAt, cached: research.cached },
        };
        if (sessionId) await db().from('ai_sessions').update({ intent, result: { recommendations: comparison.recommendations, productIds: result.products.map(p => p.externalId) }, model: result.aiUsed ? 'gemini' : 'rules' }).eq('id', sessionId);
        send({ type: 'result', result });
      } catch (e) {
        send({ type: 'error', error: e instanceof Error ? e.message : 'Something went wrong.' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
