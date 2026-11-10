// Gemini configuration: which API key and which models a process may use.
//
// Keys come from two separate Google AI projects so that testing can never drain the quota that the
// live site and demos depend on (Gemini limits are per project and per model, reset daily at
// midnight Pacific):
//   GEMINI_API_KEY      production project. Used ONLY by the Vercel production deployment, or when
//                       GEMINI_ALLOW_PROD_KEY=1 is set explicitly for a small, bounded check.
//   GEMINI_API_KEY_DEV  development/test project. Used everywhere else: local dev, `next start`,
//                       unit/E2E/scenario runs, workbook evaluation, Vercel preview deployments.
// With no usable key the app runs its deterministic rule-based fallback (never an error).
//
// Models are stable IDs, tried in order. Moving aliases ("-latest") are rejected because they switch
// to a different model, with different limits, without notice.

export const DEFAULT_GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

export type KeySource = 'production' | 'development' | 'none';
export type KeyChoice = { key: string; source: KeySource; reason: string };

/** Pure so it can be unit-tested with any environment. */
export function chooseGeminiKey(e: Record<string, string | undefined>): KeyChoice {
  const prod = (e.GEMINI_API_KEY || '').trim();
  const dev = (e.GEMINI_API_KEY_DEV || '').trim();
  const isProductionDeployment = e.VERCEL_ENV === 'production';
  if (isProductionDeployment) return prod ? { key: prod, source: 'production', reason: 'vercel_production' } : { key: '', source: 'none', reason: 'no_production_key' };
  if (dev && dev === prod) return { key: '', source: 'none', reason: 'dev_key_equals_production_key' }; // not a separate project
  if (dev) return { key: dev, source: 'development', reason: e.VERCEL_ENV ? `vercel_${e.VERCEL_ENV}` : 'local' };
  if (prod && e.GEMINI_ALLOW_PROD_KEY === '1') return { key: prod, source: 'production', reason: 'explicit_override' };
  return { key: '', source: 'none', reason: prod ? 'production_key_blocked_outside_production' : 'no_key' };
}

export function parseGeminiModels(raw: string | undefined): { models: string[]; rejected: string[] } {
  const list = (raw || '').split(',').map(m => m.trim()).filter(Boolean);
  const rejected = list.filter(m => /-latest$/i.test(m) || !/^[a-z0-9][a-z0-9.\-]{2,60}$/i.test(m));
  const models = [...new Set(list.filter(m => !rejected.includes(m)))];
  return { models: models.length ? models : DEFAULT_GEMINI_MODELS, rejected };
}
