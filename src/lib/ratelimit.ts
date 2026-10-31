import 'server-only';

// Simple in-memory sliding-window limiter (per server instance). Good enough to stop
// accidental hammering of paid-credit APIs in a demo; documented as a limitation.
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, retryAfterSec: 0 };
}

export function clientKey(req: Request): string {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
}
