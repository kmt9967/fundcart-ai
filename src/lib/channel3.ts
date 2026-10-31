import 'server-only';
import crypto from 'node:crypto';
import { env } from './env';
import { db } from './db';
import { toCents } from './money';

export type Product = {
  snapshotId?: string;
  externalId: string;
  title: string;
  brand: string | null;
  category: string | null;
  priceCents: number | null; // null = no live price returned
  compareAtCents: number | null;
  currency: string;
  availability: string | null;
  merchantDomain: string | null;
  offerUrl: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  keyFeatures: string[];
  rating: number | null;
  ratingCount: number | null;
  description: string;
  fetchedAt: string;
};

export type SearchParams = {
  query: string;
  maxPriceCents?: number | null;
  minPriceCents?: number | null;
  limit?: number;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — conserves Channel3 credits

/** Strip control characters / markup and clamp length: product text is untrusted third-party data. */
export function cleanText(s: unknown, max = 400): string {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalize(p: any, fetchedAt: string): Product | null {
  if (!p || typeof p.id !== 'string' || typeof p.title !== 'string') return null;
  // Choose the cheapest in-stock USD offer; never invent a price.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const offers: any[] = Array.isArray(p.offers) ? p.offers : [];
  const usable = offers
    .filter(o => o?.price?.currency === 'USD' && typeof o?.price?.price === 'number' && o.price.price > 0)
    .sort((a, b) => a.price.price - b.price.price);
  const best = usable.find(o => o.availability === 'InStock') || usable[0] || offers[0] || null;
  let priceCents: number | null = null; let compareAtCents: number | null = null;
  try { if (best?.price?.price != null && best.price.currency === 'USD') priceCents = toCents(best.price.price); } catch { priceCents = null; }
  try { if (best?.price?.compare_at_price) compareAtCents = toCents(best.price.compare_at_price); } catch { compareAtCents = null; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const img = (Array.isArray(p.images) ? p.images : []).find((i: any) => i?.is_main_image) || p.images?.[0];
  const imageUrl = typeof (img?.cleaned_url || img?.url) === 'string' && /^https:\/\//.test(img.cleaned_url || img.url) ? (img.cleaned_url || img.url) : null;
  const offerUrl = typeof best?.url === 'string' && /^https:\/\//.test(best.url) ? best.url : null;
  return {
    externalId: cleanText(p.id, 40),
    title: cleanText(p.title, 160),
    brand: cleanText(p.brands?.[0]?.name, 60) || null,
    category: cleanText(p.category?.title, 60) || null,
    priceCents,
    compareAtCents,
    currency: 'USD',
    availability: cleanText(best?.availability, 20) || null,
    merchantDomain: cleanText(best?.domain, 80) || null,
    offerUrl,
    imageUrl,
    imageAlt: cleanText(img?.alt_text, 160) || null,
    keyFeatures: (Array.isArray(p.key_features) ? p.key_features : []).slice(0, 6).map((f: unknown) => cleanText(f, 120)).filter(Boolean),
    rating: typeof p.ratings?.value === 'number' ? p.ratings.value : null,
    ratingCount: typeof p.ratings?.count === 'number' ? p.ratings.count : null,
    description: cleanText(p.description, 600),
    fetchedAt,
  };
}

/** Search Channel3 (with a 6h DB cache). Returns normalized products and whether the result came from cache. */
export async function searchProducts(params: SearchParams): Promise<{ products: Product[]; cached: boolean; fetchedAt: string }> {
  const query = cleanText(params.query, 120);
  if (!query) return { products: [], cached: false, fetchedAt: new Date().toISOString() };
  const limit = Math.min(Math.max(params.limit ?? 12, 1), 20);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filters: any = { conditions: ['new'], availability: ['InStock'] };
  if (params.maxPriceCents || params.minPriceCents) {
    filters.price = {
      min_price: params.minPriceCents ? params.minPriceCents / 100 : null,
      max_price: params.maxPriceCents ? params.maxPriceCents / 100 : null,
    };
  }
  const body = { query, limit, filters, config: { mode: 'default', country: 'US', currency: 'USD' } };
  const cacheKey = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

  const cached = await db().from('search_cache').select('response, created_at').eq('cache_key', cacheKey).maybeSingle();
  if (cached.data && Date.now() - new Date(cached.data.created_at).getTime() < CACHE_TTL_MS) {
    const fetchedAt = cached.data.created_at as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const products = ((cached.data.response as any).products || []).map((p: any) => normalize(p, fetchedAt)).filter(Boolean) as Product[];
    return { products, cached: true, fetchedAt };
  }

  const res = await fetch('https://api.trychannel3.com/v1/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.channel3Key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  if (res.status === 402) throw new Error('Product search credits are exhausted.');
  if (res.status === 429) throw new Error('Product search is rate limited. Please retry in a few seconds.');
  if (!res.ok) throw new Error(`Product search failed (${res.status}).`);
  const json = await res.json();
  const fetchedAt = new Date().toISOString();
  await db().from('search_cache').upsert({ cache_key: cacheKey, response: { products: json.products ?? [] }, created_at: fetchedAt });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = (json.products || []).map((p: any) => normalize(p, fetchedAt)).filter(Boolean) as Product[];
  return { products, cached: false, fetchedAt };
}

/** Persist a product snapshot (exact data we showed the user) and return its id. */
export async function saveSnapshot(p: Product): Promise<string> {
  const ins = await db().from('product_snapshots').insert({
    external_id: p.externalId, title: p.title, brand: p.brand, category: p.category,
    price_cents: p.priceCents, currency: p.currency, availability: p.availability,
    merchant_domain: p.merchantDomain, offer_url: p.offerUrl, image_url: p.imageUrl,
    key_features: p.keyFeatures, rating: p.rating, rating_count: p.ratingCount,
    raw: { description: p.description, imageAlt: p.imageAlt, compareAtCents: p.compareAtCents },
    fetched_at: p.fetchedAt,
  }).select('id').single();
  if (ins.error) throw new Error(`saveSnapshot: ${ins.error.message}`);
  return ins.data.id as string;
}

/** Look up a cached product by Channel3 id among recent searches (avoids trusting client-supplied prices). */
export async function findRecentProduct(externalId: string): Promise<Product | null> {
  const rows = await db().from('search_cache').select('response, created_at').order('created_at', { ascending: false }).limit(200);
  for (const r of rows.data || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hit = ((r.response as any).products || []).find((p: any) => p?.id === externalId);
    if (hit) return normalize(hit, r.created_at as string);
  }
  // Fall back to the free product-detail endpoint.
  const res = await fetch(`https://api.trychannel3.com/v1/products/${encodeURIComponent(externalId)}?country=US&currency=USD`, {
    headers: { 'x-api-key': env.channel3Key }, signal: AbortSignal.timeout(15000), cache: 'no-store',
  });
  if (!res.ok) return null;
  return normalize(await res.json(), new Date().toISOString());
}
