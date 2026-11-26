import { z } from 'zod';
import { currentAccount } from '@/lib/auth';
import { db } from '@/lib/db';

const idSchema = z.string().uuid();
const selectionSchema = z.object({
  compare: z.array(z.string().regex(/^[A-Za-z0-9_-]{3,40}$/)).max(4),
  name: z.string().trim().min(1).max(80).optional(),
}).strict();

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const account = await currentAccount();
  if (!account) return new Response(null, { status: 401 });
  const { id } = await params;
  const parsed = selectionSchema.safeParse(await request.json().catch(() => null));
  if (!idSchema.safeParse(id).success || !parsed.success) return new Response(null, { status: 400 });
  const table = db().from('ai_sessions');
  const { data, error } = await table.select('result,prompt,safety').eq('id', id).eq('user_id', account.profileId).maybeSingle();
  if (error) return new Response(null, { status: 503 });
  if (data?.result?.kind !== 'results' || data.prompt === '[sensitive purchase: not stored]'
    || data.safety?.notices?.includes('sensitive_purchase')) return new Response(null, { status: 404 });

  const eligible = new Set([...(data.result.bestFit ?? []), ...(data.result.cheapestAdequate ?? []), ...(data.result.comparable ?? [])]);
  const comparison = [...new Set(parsed.data.compare)];
  if (comparison.some(product => !eligible.has(product))) return new Response(null, { status: 422 });
  const updated = await table.update({ result: { ...data.result, saved: true, comparison, name: parsed.data.name ?? data.result.name } })
    .eq('id', id).eq('user_id', account.profileId).eq('result->>kind', 'results').select('id').maybeSingle();
  return new Response(null, { status: updated.error ? 503 : updated.data ? 204 : 404 });
}

export async function DELETE(request: Request, { params }: Context) {
  const account = await currentAccount();
  if (!account) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return new Response(null, { status: 400 });
  if (new URL(request.url).searchParams.get('scope') === 'thread') {
    const removed = await db().rpc('remove_shopping_thread', { p_owner: account.profileId, p_turn: id });
    return new Response(null, { status: removed.error ? 503 : Number(removed.data) > 0 ? 204 : 404 });
  }
  const table = db().from('ai_sessions');
  const { data, error } = await table.select('result').eq('id', id).eq('user_id', account.profileId).maybeSingle();
  if (error) return new Response(null, { status: 503 });
  if (data?.result?.kind !== 'results') return new Response(null, { status: 404 });
  const removed = await table.update({
    intent: null, prompt: '[removed from shopping history]', result: { kind: 'removed', parent: data.result.parent ?? null },
  }).eq('id', id).eq('user_id', account.profileId).eq('result->>kind', 'results').select('id').maybeSingle();
  return new Response(null, { status: removed.error ? 503 : removed.data ? 204 : 404 });
}
