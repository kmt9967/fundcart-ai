import 'server-only';
import { db } from './db';

// Append-only abuse/security log (table security_events, immutable by trigger). Never put raw IPs,
// emails, card numbers or message text here: use hashed buckets or object ids.
export type SecurityKind =
  | 'rate_limited' | 'injection_flag' | 'safety_block' | 'honeypot' | 'duplicate_payment' | 'decline_spike'
  | 'campaign_flagged' | 'campaign_reported' | 'campaign_auto_hidden' | 'campaign_auto_paused' | 'report_brigading' | 'campaign_moderated' | 'policy_block'
  | 'price_changed' | 'auth_failed' | 'ai_budget_exhausted' | 'cross_border_block';

export async function recordSecurityEvent(kind: SecurityKind, severity: 'info' | 'warn' | 'alert', subject: string | null, detail: Record<string, unknown> = {}): Promise<void> {
  try {
    await db().from('security_events').insert({ kind, severity, subject, detail });
    if (severity === 'alert') console.warn(JSON.stringify({ at: new Date().toISOString(), event: 'security.alert', kind, subject }));
  } catch { /* logging must never break the request */ }
}

/** Count recent events of a kind (used for spike alerts). Returns 0 if the table is unavailable. */
export async function recentEventCount(kind: string, minutes: number, table: 'security_events' | 'payment_events' = 'security_events', column = 'kind'): Promise<number> {
  try {
    const since = new Date(Date.now() - minutes * 60_000).toISOString();
    const r = await db().from(table).select('id', { count: 'exact', head: true }).eq(column, kind).gte('created_at', since);
    return r.count ?? 0;
  } catch { return 0; }
}
