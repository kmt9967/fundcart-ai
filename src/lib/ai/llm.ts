import 'server-only';
import { chooseGeminiKey, parseGeminiModels, type KeySource } from './gemini-config';

// Gemini over plain REST with JSON-schema constrained output.
// If no key is usable or every model fails, callers fall back to deterministic logic and the UI labels
// the result accordingly. We never pretend a fallback answer came from the model.
//
// Quota safeguards (per server instance; serverless instances each learn within one request):
//   - Daily quota exhausted (429, "...PerDay..."): that model is skipped until the next midnight Pacific
//     (or Google's retry delay, if later). 429 responses cost no quota, but skipping saves latency.
//   - Per-minute limit (429, "...PerMinute..."): short cooldown for that model (Google's retry delay,
//     30 s by default); if the delay is tiny and time allows, one retry after it, else the next model.
//   - 5xx / network errors: one jittered retry on the same model when time allows, then the next model.
//   - All models cooling down: return immediately (no network call) so the fallback answers fast.
// Diagnostics record model choice, counts, error classes and fallback reasons. Never prompts, user
// text, responses or keys.

export type LlmPurpose = 'intent' | 'explain' | 'campaign_story' | 'update_draft' | 'compat_check' | 'eval' | 'other';
export type LlmResult<T> = { ok: true; data: T; model: string } | { ok: false; error: string };

type ModelStats = { requests: number; ok: number; errors: Record<string, number>; rateLimitedMinute: number; rateLimitedDay: number; lastOkAt: string | null; lastErrorAt: string | null; cooldownUntil: number; cooldownReason: string | null };
const stats = new Map<string, ModelStats>();
const fallbacks: Record<string, number> = {};
const byPurpose: Record<string, { calls: number; ok: number; fallback: number }> = {};
const startedAt = new Date().toISOString();
/** Models that rejected thinkingConfig (400); requests to them omit it. */
const noThinking = new Set<string>();
/** Thinking depth for these extraction/explanation tasks. "minimal" cut latency from ~4.2 s to ~1.7 s in a
 *  check on gemini-3.1-flash-lite with identical output. Set GEMINI_THINKING_LEVEL=off to omit it. */
function thinkingLevel(): string | null {
  const v = (process.env.GEMINI_THINKING_LEVEL || 'minimal').trim().toLowerCase();
  return v === 'off' || v === 'default' ? null : ['minimal', 'low', 'medium', 'high'].includes(v) ? v : 'minimal';
}

function modelStats(m: string): ModelStats {
  let s = stats.get(m);
  if (!s) { s = { requests: 0, ok: 0, errors: {}, rateLimitedMinute: 0, rateLimitedDay: 0, lastOkAt: null, lastErrorAt: null, cooldownUntil: 0, cooldownReason: null }; stats.set(m, s); }
  return s;
}

export function geminiConfig() {
  const key = chooseGeminiKey(process.env);
  const { models, rejected } = parseGeminiModels(process.env.GEMINI_MODEL);
  return { key, models, rejected };
}

export function llmAvailable(): boolean {
  return Boolean(geminiConfig().key.key);
}

/** Milliseconds until the next midnight in America/Los_Angeles (when Gemini daily quotas reset), +1 min margin. */
export function msUntilPacificMidnight(now = new Date()): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  const elapsed = ((Number(parts.hour) % 24) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000;
  return Math.max(60_000, 86_400_000 - elapsed + 60_000);
}

/** Classify a 429 body from the Gemini API. Exported for tests. */
export function classify429(body: unknown): { scope: 'day' | 'minute' | 'unknown'; retryMs: number | null } {
  const details: Array<Record<string, unknown>> = ((body as { error?: { details?: unknown[] } })?.error?.details as Array<Record<string, unknown>>) || [];
  let scope: 'day' | 'minute' | 'unknown' = 'unknown'; let retryMs: number | null = null;
  for (const d of details) {
    for (const v of (d.violations as Array<{ quotaId?: string; quotaMetric?: string }>) || []) {
      const id = `${v.quotaId || ''} ${v.quotaMetric || ''}`;
      if (/PerDay/i.test(id)) scope = 'day'; else if (/PerMinute/i.test(id) && scope !== 'day') scope = 'minute';
    }
    if (typeof d.retryDelay === 'string') { const s = parseFloat(d.retryDelay); if (Number.isFinite(s)) retryMs = Math.round(s * 1000); }
  }
  return { scope, retryMs };
}

function log(evt: Record<string, unknown>) {
  // One structured line per call, for Vercel logs. No prompt, response, user text or key.
  if (process.env.NODE_ENV === 'test') return;
  console.info(JSON.stringify({ evt: 'gemini', ...evt }));
}

function recordFallback(purpose: LlmPurpose, reason: string) {
  fallbacks[reason] = (fallbacks[reason] || 0) + 1;
  (byPurpose[purpose] ||= { calls: 0, ok: 0, fallback: 0 }).fallback++;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  /** Total time budget across all models (ms). Each model gets what is left. */
  timeoutMs?: number;
  purpose?: LlmPurpose;
  /** Test hook: replace fetch. */
  fetchImpl?: typeof fetch;
}): Promise<LlmResult<T>> {
  const purpose = opts.purpose ?? 'other';
  const { key, models } = geminiConfig();
  (byPurpose[purpose] ||= { calls: 0, ok: 0, fallback: 0 }).calls++;
  if (!key.key) { recordFallback(purpose, `no_key:${key.reason}`); return { ok: false, error: 'no_key' }; }
  const doFetch = opts.fetchImpl ?? fetch;
  const deadline = Date.now() + (opts.timeoutMs ?? 24000);
  let lastError = 'llm_error';
  const available = models.filter(m => modelStats(m).cooldownUntil <= Date.now());
  if (!available.length) {
    lastError = 'all_models_cooling_down';
    recordFallback(purpose, lastError); log({ purpose, outcome: 'skipped', reason: lastError, keySource: key.source });
    return { ok: false, error: lastError };
  }

  for (const model of available) {
    const s = modelStats(model);
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 2500) { lastError = 'timeout_budget'; break; }
      const t0 = Date.now();
      s.requests++;
      let retrySame = false;
      try {
        const res = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: opts.system }] },
            contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
            generationConfig: {
              temperature: opts.temperature ?? 0.3, maxOutputTokens: opts.maxOutputTokens ?? 4096, responseMimeType: 'application/json', responseSchema: opts.schema,
              ...(thinkingLevel() && !noThinking.has(model) ? { thinkingConfig: { thinkingLevel: thinkingLevel() } } : {}),
            },
          }),
          signal: AbortSignal.timeout(Math.min(left, 15000)),
          cache: 'no-store',
        });
        if (!res.ok) {
          lastError = `http_${res.status}`;
          s.errors[lastError] = (s.errors[lastError] || 0) + 1; s.lastErrorAt = new Date().toISOString();
          if (res.status === 429) {
            const c = classify429(await res.json().catch(() => null));
            if (c.scope === 'day') {
              s.rateLimitedDay++; lastError = 'quota_day';
              s.cooldownUntil = Date.now() + Math.max(msUntilPacificMidnight(), c.retryMs ?? 0); s.cooldownReason = 'daily_quota';
            } else {
              s.rateLimitedMinute++; lastError = 'quota_minute';
              const wait = c.retryMs ?? 30_000;
              s.cooldownUntil = Date.now() + Math.min(Math.max(wait, 5_000), 120_000); s.cooldownReason = 'minute_limit';
              if (attempt === 0 && wait <= 2_000 && deadline - Date.now() > wait + 4_000) { await sleep(wait); s.cooldownUntil = 0; retrySame = true; }
            }
          } else if ([500, 502, 503, 504].includes(res.status)) {
            if (attempt === 0 && deadline - Date.now() > 6_000) { await sleep(300 + Math.floor(Math.random() * 500)); retrySame = true; }
          } else if (res.status === 404) {
            s.cooldownUntil = Date.now() + 3_600_000; s.cooldownReason = 'model_not_found';
          } else if (res.status === 400 && attempt === 0 && thinkingLevel() && !noThinking.has(model) && /thinking/i.test(await res.clone().text().catch(() => ''))) {
            noThinking.add(model); retrySame = true; // this model does not take thinkingConfig: retry plainly
          } else if (res.status !== 408) {
            // 400/401/403: a configuration problem that another model will not fix.
            log({ purpose, model, outcome: 'error', status: res.status, ms: Date.now() - t0, keySource: key.source });
            recordFallback(purpose, lastError);
            return { ok: false, error: lastError };
          }
          log({ purpose, model, outcome: 'error', status: res.status, error: lastError, ms: Date.now() - t0, keySource: key.source });
          if (retrySame) continue;
          break;
        }
        const json = await res.json();
        const text: string | undefined = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('');
        if (!text) { lastError = 'empty'; s.errors.empty = (s.errors.empty || 0) + 1; log({ purpose, model, outcome: 'error', error: 'empty', ms: Date.now() - t0 }); break; }
        const data = JSON.parse(text) as T;
        s.ok++; s.lastOkAt = new Date().toISOString();
        byPurpose[purpose].ok++;
        log({ purpose, model, outcome: 'ok', ms: Date.now() - t0, keySource: key.source, served: json?.modelVersion });
        return { ok: true, data, model };
      } catch (e) {
        lastError = e instanceof SyntaxError ? 'bad_json' : e instanceof Error && /timeout|abort/i.test(e.name) ? 'timeout' : 'network';
        s.errors[lastError] = (s.errors[lastError] || 0) + 1; s.lastErrorAt = new Date().toISOString();
        log({ purpose, model, outcome: 'error', error: lastError, ms: Date.now() - t0, keySource: key.source });
        if (lastError === 'network' && attempt === 0 && deadline - Date.now() > 6_000) { await sleep(300 + Math.floor(Math.random() * 500)); continue; }
        break;
      }
    }
  }
  recordFallback(purpose, lastError);
  return { ok: false, error: lastError };
}

/** Snapshot for the protected diagnostics endpoint. Contains no secrets and no user content. */
export function llmDiagnostics() {
  const { key, models, rejected } = geminiConfig();
  const now = Date.now();
  return {
    instanceStartedAt: startedAt,
    keySource: key.source as KeySource, keyReason: key.reason,
    devKeyConfigured: Boolean(process.env.GEMINI_API_KEY_DEV), productionKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    vercelEnv: process.env.VERCEL_ENV || null,
    models, rejectedModelIds: rejected,
    perModel: Object.fromEntries([...stats].map(([m, s]) => [m, { ...s, cooldownUntil: s.cooldownUntil > now ? new Date(s.cooldownUntil).toISOString() : null, cooldownReason: s.cooldownUntil > now ? s.cooldownReason : null }])),
    byPurpose, fallbackReasons: fallbacks,
    note: 'Counters are per server instance and reset when the instance restarts.',
  };
}

/** Test hook. */
export function __resetLlmState() { stats.clear(); noThinking.clear(); for (const k of Object.keys(fallbacks)) delete fallbacks[k]; for (const k of Object.keys(byPurpose)) delete byPurpose[k]; }
