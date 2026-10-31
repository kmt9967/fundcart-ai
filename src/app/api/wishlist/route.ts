import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUserId, ensureUser } from '@/lib/identity';
import { findRecentProduct, saveSnapshot } from '@/lib/channel3';

export const runtime = 'nodejs';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ items: [] });
  const r = await db().from('wishlist_items').select('id, created_at, product_snapshots(external_id, title, brand, price_cents, image_url, merchant_domain, offer_url, fetched_at)').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  return Response.json({ items: r.data || [] });
}

export async function POST(req: Request) {
  const p = z.object({ externalId: z.string().min(3).max(40) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: 'Invalid product.' }, { status: 400 });
  const userId = await ensureUser();
  const product = await findRecentProduct(p.data.externalId);
  if (!product) return Response.json({ error: 'Product not found.' }, { status: 404 });
  const existing = await db().from('wishlist_items').select('id, product_snapshots!inner(external_id)').eq('user_id', userId).eq('product_snapshots.external_id', product.externalId).limit(1);
  if (existing.data?.length) return Response.json({ ok: true, duplicate: true });
  const snapshotId = await saveSnapshot(product);
  await db().from('wishlist_items').insert({ user_id: userId, product_snapshot_id: snapshotId });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const p = z.object({ id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  const userId = await currentUserId();
  if (!p.success || !userId) return Response.json({ error: 'Invalid request.' }, { status: 400 });
  await db().from('wishlist_items').delete().eq('id', p.data.id).eq('user_id', userId);
  return Response.json({ ok: true });
}
