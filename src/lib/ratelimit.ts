import 'server-only';
import crypto from 'node:crypto';
import { db } from './db';

// Rate limiting.
//  - sharedRateLimit(): fixed-window counter in Postgres (rate_limit_hit), shared by every Vercel
//    instance. Buckets are HMAC-hashed so no raw IP address, email or user id is stored.
//  - rateLimit(): per-instance sliding window. Used as the fallback when the database is unreachable
//    (the limit still applies per instance; it never silently becomes unlimited).
const buckets = new Map<string, number[]>();

export type RateResult = { ok: boolean; retryAfterSec: number; shared: boolean; rule?: string };

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

const SALT = () => process.env.GUEST_SECRET || process.env.CRON_SECRET || 'fundcart-local';
/** One-way bucket id "scope:<hmac>": lets us count without storing who it was. */
export function bucketId(scope: string, subject: string): string {
  return `${scope}:${crypto.createHmac('sha256', SALT()).update(subject).digest('hex').slice(0, 24)}`;
}

/** A rule is [scope, subject, limit, windowSeconds]. Every rule is counted; the first exceeded one is returned. */
export type RateRule = [string, string, number, number];

export async function sharedRateLimit(rules: RateRule[]): Promise<RateResult> {
  let blocked: RateResult | null = null;
  for (const [scope, subject, limit, windowSec] of rules) {
    const local = rateLimit(`${scope}:${subject}`, limit, windowSec * 1000);
    let shared = true;
    let ok = true; let retry = 0;
    try {
      const r = await db().rpc('rate_limit_hit', { p_bucket: bucketId(scope, subject), p_window_seconds: windowSec, p_limit: limit });
      if (r.error) throw new Error(r.error.message);
      const row = Array.isArray(r.data) ? r.data[0] : r.data;
      if (row && row.allowed === false) { ok = false; retry = Number(row.retry_after) || windowSec; }
    } catch {
      // Database unavailable or migration not applied yet: this instance's memory decides.
      shared = false; ok = local.ok; retry = local.retryAfterSec;
    }
    if (!ok && !blocked) blocked = { ok: false, retryAfterSec: retry, shared, rule: scope };
  }
  return blocked ?? { ok: true, retryAfterSec: 0, shared: true };
}

/** Client IP as set by the hosting proxy (Vercel sets x-real-ip and overwrites x-forwarded-for). */
export function clientKey(req: Request): string {
  return (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
}
