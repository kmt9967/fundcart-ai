import { z } from 'zod';
import { componentSocket, componentMemoryGeneration } from '@/lib/shopping/bundle';
import { bundleById } from '@/lib/shopping/families';
import { searchProducts } from '@/lib/channel3';
import { listingInjection, screenMessage } from '@/lib/shopping/safety';
import { clientKey, sharedRateLimit } from '@/lib/ratelimit';

const requestSchema = z.object({ kit: z.string().max(40), component: z.number().int().min(0).max(11), custom: z.string().trim().min(1).max(64).optional() }).strict();

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  const kit = parsed.success ? bundleById(parsed.data.kit) : null;
  const item = kit && parsed.success
    ? parsed.data.component < kit.items.length ? kit.items[parsed.data.component] : parsed.data.custom
    : null;
  if (!item) return Response.json({ error: 'Unknown bundle component.' }, { status: 400 });
  const screened = screenMessage(item);
  if (screened.block || screened.piiRedacted || screened.notices.includes('sensitive_purchase')) {
    return Response.json({ error: 'Choose a nonsensitive product component.' }, { status: 400 });
  }
  const limit = await sharedRateLimit([['bundle_ip_min', clientKey(request), 8, 60], ['bundle_global_hour', 'all', 240, 3600]]);
  if (!limit.shared) return Response.json({ error: 'Catalog access is temporarily unavailable.' }, { status: 503 });
  if (!limit.ok) return Response.json({ error: 'Too many catalog requests.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
  try {
    const { products } = await searchProducts({ query: item, limit: 6 });
    return Response.json({
      products: products
        .filter(p => p.currency === 'USD' && !listingInjection([p.title, p.description, ...p.keyFeatures].join(' ')))
        .map(({ externalId, title, priceCents, merchantDomain, attributes }) => ({ externalId, title, priceCents, merchantDomain, socket: componentSocket(attributes), memoryGeneration: componentMemoryGeneration(attributes) })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Catalog access is temporarily unavailable.' }, { status: 503 });
  }
}
