import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { chooseGeminiKey, parseGeminiModels, DEFAULT_GEMINI_MODELS } from '@/lib/ai/gemini-config';
import { generateJson, classify429, msUntilPacificMidnight, llmDiagnostics, __resetLlmState } from '@/lib/ai/llm';

const P = 'prod-key-AAAAAAAAAAAAAAAAAAAA'; const D = 'dev-key-BBBBBBBBBBBBBBBBBBBB';

describe('Gemini key separation', () => {
  it('uses the production key only on the Vercel production deployment', () => {
    expect(chooseGeminiKey({ GEMINI_API_KEY: P, VERCEL_ENV: 'production' })).toMatchObject({ key: P, source: 'production' });
    expect(chooseGeminiKey({ GEMINI_API_KEY: P, GEMINI_API_KEY_DEV: D, VERCEL_ENV: 'production' })).toMatchObject({ key: P, source: 'production' });
  });
  it('never uses the production key locally, in tests or on preview deployments', () => {
    expect(chooseGeminiKey({ GEMINI_API_KEY: P })).toMatchObject({ key: '', source: 'none', reason: 'production_key_blocked_outside_production' });
    expect(chooseGeminiKey({ GEMINI_API_KEY: P, VERCEL_ENV: 'preview' })).toMatchObject({ key: '', source: 'none' });
    expect(chooseGeminiKey({ GEMINI_API_KEY: P, GEMINI_API_KEY_DEV: D })).toMatchObject({ key: D, source: 'development' });
    expect(chooseGeminiKey({ GEMINI_API_KEY: P, GEMINI_API_KEY_DEV: D, VERCEL_ENV: 'preview' })).toMatchObject({ key: D, source: 'development' });
  });
  it('rejects a "dev" key that is really the production key', () => {
    expect(chooseGeminiKey({ GEMINI_API_KEY: P, GEMINI_API_KEY_DEV: P })).toMatchObject({ key: '', reason: 'dev_key_equals_production_key' });
  });
  it('allows the production key outside production only with an explicit override', () => {
    expect(chooseGeminiKey({ GEMINI_API_KEY: P, GEMINI_ALLOW_PROD_KEY: '1' })).toMatchObject({ key: P, reason: 'explicit_override' });
    expect(chooseGeminiKey({ GEMINI_API_KEY: P, GEMINI_ALLOW_PROD_KEY: 'true' })).toMatchObject({ key: '' });
  });
  it('the test setup has removed any production override', () => {
    expect(process.env.GEMINI_ALLOW_PROD_KEY).toBeUndefined();
    expect(process.env.VERCEL_ENV).not.toBe('production');
  });
});

describe('Gemini model configuration', () => {
  it('defaults to stable Flash-Lite models and rejects moving "-latest" aliases', () => {
    expect(parseGeminiModels(undefined).models).toEqual(DEFAULT_GEMINI_MODELS);
    expect(DEFAULT_GEMINI_MODELS).toEqual(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
    const r = parseGeminiModels('gemini-flash-latest, gemini-3.1-flash-lite');
    expect(r.models).toEqual(['gemini-3.1-flash-lite']); expect(r.rejected).toEqual(['gemini-flash-latest']);
    expect(parseGeminiModels('gemini-flash-lite-latest').models).toEqual(DEFAULT_GEMINI_MODELS);
  });
});

describe('rate-limit handling', () => {
  const day = { error: { code: 429, details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }, { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '22111s' }] } };
  const minute = (delay: string) => ({ error: { code: 429, details: [{ violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] }, { retryDelay: delay }] } });
  const ok = (data: unknown) => new Response(JSON.stringify({ modelVersion: 'x', candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] }), { status: 200 });
  const r429 = (b: unknown) => new Response(JSON.stringify(b), { status: 429 });
  const call = (fetchImpl: typeof fetch) => generateJson<{ a: number }>({ system: 's', prompt: 'p', schema: { type: 'object' }, purpose: 'intent', fetchImpl, timeoutMs: 20000 });

  beforeEach(() => { __resetLlmState(); process.env.GEMINI_API_KEY_DEV = D; delete process.env.GEMINI_MODEL; });

  it('classifies daily vs per-minute 429s and reads the retry delay', () => {
    expect(classify429(day)).toEqual({ scope: 'day', retryMs: 22111000 });
    expect(classify429(minute('7s'))).toEqual({ scope: 'minute', retryMs: 7000 });
    expect(classify429(null)).toEqual({ scope: 'unknown', retryMs: null });
  });
  it('computes the time to the next midnight Pacific', () => {
    const ms = msUntilPacificMidnight(new Date('2026-11-10T02:20:00Z')); // 18:20 PST → 5h40m (+1 min)
    expect(Math.round(ms / 60000)).toBe(341);
  });
  it('a daily-quota 429 puts that model in cooldown and the next model answers', async () => {
    const f = vi.fn(async (url: string) => (String(url).includes('gemini-3.5-flash-lite') ? r429(day) : ok({ a: 1 })));
    const r = await call(f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: true, model: 'gemini-3.1-flash-lite' });
    // Second call skips the exhausted model entirely (no wasted request).
    await call(f as unknown as typeof fetch);
    expect(f.mock.calls.filter(c => String(c[0]).includes('gemini-3.5-flash-lite'))).toHaveLength(1);
    const d = llmDiagnostics();
    expect(d.perModel['gemini-3.5-flash-lite']).toMatchObject({ rateLimitedDay: 1, cooldownReason: 'daily_quota' });
    expect(d.perModel['gemini-3.1-flash-lite']).toMatchObject({ ok: 2 });
  });
  it('when every model is exhausted it returns at once without calling the API, and records why', async () => {
    const f = vi.fn(async () => r429(day));
    expect(await call(f as unknown as typeof fetch)).toMatchObject({ ok: false, error: 'quota_day' });
    const before = f.mock.calls.length;
    expect(await call(f as unknown as typeof fetch)).toMatchObject({ ok: false, error: 'all_models_cooling_down' });
    expect(f.mock.calls.length).toBe(before);
    expect(llmDiagnostics().fallbackReasons).toMatchObject({ quota_day: 1, all_models_cooling_down: 1 });
  });
  it('retries once after a short per-minute delay, otherwise moves to the next model', async () => {
    let n = 0;
    const f = vi.fn(async () => (n++ === 0 ? r429(minute('0.2s')) : ok({ a: 2 })));
    expect(await call(f as unknown as typeof fetch)).toMatchObject({ ok: true, model: 'gemini-3.5-flash-lite' });
    expect(f).toHaveBeenCalledTimes(2);
    __resetLlmState();
    const g = vi.fn(async (url: string) => (String(url).includes('gemini-3.5-flash-lite') ? r429(minute('40s')) : ok({ a: 3 })));
    expect(await call(g as unknown as typeof fetch)).toMatchObject({ ok: true, model: 'gemini-3.1-flash-lite' });
    expect(llmDiagnostics().perModel['gemini-3.5-flash-lite']).toMatchObject({ rateLimitedMinute: 1, cooldownReason: 'minute_limit' });
  });
  it('retries a 503 once with backoff before giving up on a model', async () => {
    let n = 0;
    const f = vi.fn(async () => (n++ === 0 ? new Response('busy', { status: 503 }) : ok({ a: 4 })));
    expect(await call(f as unknown as typeof fetch)).toMatchObject({ ok: true, model: 'gemini-3.5-flash-lite' });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('stops on a configuration error (e.g. 403) and reports it, so the caller uses the fallback', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 403 }));
    expect(await call(f as unknown as typeof fetch)).toMatchObject({ ok: false, error: 'http_403' });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('without a usable key there is no network call and the fallback reason is recorded', async () => {
    delete process.env.GEMINI_API_KEY_DEV;
    const f = vi.fn();
    expect(await call(f as unknown as typeof fetch)).toMatchObject({ ok: false, error: 'no_key' });
    expect(f).not.toHaveBeenCalled();
    expect(Object.keys(llmDiagnostics().fallbackReasons)[0]).toMatch(/^no_key:/);
  });
  it('asks for minimal thinking, and retries without it if a model rejects the setting', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body)); bodies.push(b.generationConfig);
      return b.generationConfig.thinkingConfig ? new Response('{"error":{"message":"thinking_level is not supported for this model"}}', { status: 400 }) : ok({ a: 5 });
    });
    expect(await call(f as unknown as typeof fetch)).toMatchObject({ ok: true, model: 'gemini-3.5-flash-lite' });
    expect(bodies[0].thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
    expect(bodies[1].thinkingConfig).toBeUndefined();
    await call(f as unknown as typeof fetch);
    expect(bodies[2].thinkingConfig).toBeUndefined(); // remembered per model
  });
  it('diagnostics never contain a key', async () => {
    const f = vi.fn(async () => ok({ a: 1 }));
    await call(f as unknown as typeof fetch);
    expect(JSON.stringify(llmDiagnostics())).not.toContain(D);
  });
});
