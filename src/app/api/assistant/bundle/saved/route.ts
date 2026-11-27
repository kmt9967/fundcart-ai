import { z } from 'zod';
import { currentAccount } from '@/lib/auth';
import { db } from '@/lib/db';
import { screenMessage } from '@/lib/shopping/safety';
import { bundleById } from '@/lib/shopping/families';

const offerId = z.string().regex(/^[A-Za-z0-9_-]{3,40}$/).nullable();
const customSlot = z.object({ label: z.string().trim().min(1).max(64), required: z.boolean(), offerId }).strict();

const body = z.object({
  kitId: z.string().max(40),
  name: z.string().trim().min(1).max(80),
  selections: z.array(z.union([offerId, customSlot])).max(12),
}).strict();

export async function GET(request: Request) {
  const account = await currentAccount();
  if (!account) return new Response(null, { status: 401 });
  const kitId = new URL(request.url).searchParams.get('kit');
  if (!kitId || !bundleById(kitId)) return new Response(null, { status: 400 });
  const { data, error } = await db().from('saved_shopping_bundles').select('id,name,selections')
    .eq('owner_id', account.profileId).eq('kit_id', kitId).order('updated_at', { ascending: false }).limit(25);
  if (error) return new Response(null, { status: 503 });
  return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  const account = await currentAccount();
  if (!account) return new Response(null, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  const kit = parsed.success ? bundleById(parsed.data.kitId) : null;
  if (!parsed.success || !kit || parsed.data.selections.length < kit.items.length ||
      parsed.data.selections.some((slot, index) => (slot !== null && typeof slot === 'object') !== (index >= kit.items.length))) {
    return new Response(null, { status: 400 });
  }
  for (const slot of parsed.data.selections) {
    if (!slot || typeof slot !== 'object') continue;
    const screened = screenMessage(slot.label);
    if (screened.block || screened.piiRedacted || screened.notices.includes('sensitive_purchase')) return new Response(null, { status: 400 });
  }
  const { error } = await db().from('saved_shopping_bundles').upsert({
    owner_id: account.profileId, kit_id: parsed.data.kitId, name: parsed.data.name, selections: parsed.data.selections,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id,kit_id,name' });
  return new Response(null, { status: error ? 503 : 204 });
}

export async function DELETE(request: Request) {
  const account = await currentAccount();
  if (!account) return new Response(null, { status: 401 });
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get('id'));
  if (!id.success) return new Response(null, { status: 400 });
  const { data, error } = await db().from('saved_shopping_bundles').delete()
    .eq('owner_id', account.profileId).eq('id', id.data).select('id').maybeSingle();
  return new Response(null, { status: error ? 503 : data ? 204 : 404 });
}
