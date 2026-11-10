// Opt-in, bounded compatibility check of each configured Gemini model against FundCart's REAL prompts
// and schemas: structured intent extraction (validated by validateIntent) and grounded explanations.
// At most 3 requests per model (2 intent + 1 explanation); 6 in total for the default two models.
//
// Run with the development/test project key:
//   RUN_GEMINI_COMPAT=1 npx vitest run tests/unit/gemini.compat.test.ts
// Only if no dev project exists yet, a deliberate check on the production key:
//   RUN_GEMINI_COMPAT=1 GEMINI_ALLOW_PROD_KEY=1 npx vitest run tests/unit/gemini.compat.test.ts
// A model whose DAILY quota is exhausted is reported as "not verifiable today" (429s cost no quota).
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: () => { throw new Error('no db in compat check'); } }));

const RUN = !!process.env.RUN_GEMINI_COMPAT;
const MAX_REQUESTS = 6;

describe.skipIf(!RUN)('Gemini model compatibility (bounded)', () => {
  it('each configured model returns valid structured intent and grounded explanations', async () => {
    const { intentStep, explainPicks } = await import('@/lib/shopping/pipeline');
    const { mergeState, buildRequirements } = await import('@/lib/shopping/session');
    const { evaluateProduct, rankEvaluated } = await import('@/lib/shopping/evaluate');
    const { normalize } = await import('@/lib/channel3');
    const { geminiConfig, llmDiagnostics, __resetLlmState } = await import('@/lib/ai/llm');
    const cfg = geminiConfig();
    expect(cfg.key.source, `no usable key (${cfg.key.reason})`).not.toBe('none');
    const models = cfg.models;
    expect(models.length * 3).toBeLessThanOrEqual(MAX_REQUESTS);
    const laptops = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'channel3-laptops.json'), 'utf8')).products.map((p: unknown) => normalize(p, 'now')).filter(Boolean);
    const report: Record<string, unknown> = { keySource: cfg.key.source };
    const verified: string[] = [];

    for (const model of models) {
      process.env.GEMINI_MODEL = model; __resetLlmState();
      const out: Record<string, unknown> = {};
      const events: string[] = []; const emit = (e: { step: string }) => events.push(e.step);
      // 1. Intent, English, Android Studio with an explicit testing method.
      const a = await intentStep('I want a laptop to learn Android Studio. I have an Android phone to test on, budget $700.', null, 'en', emit as never);
      const d1 = llmDiagnostics().perModel[model];
      if (d1?.cooldownReason === 'daily_quota') { report[model] = 'not verifiable today: daily quota exhausted (resets midnight Pacific)'; continue; }
      out.intentEn = { usedModel: a.usedModel, category: a.intent.category, software: a.intent.software, noEmulator: a.intent.noEmulator, language: a.intent.language };
      // 2. Intent, Urdu script, interface in Urdu.
      const b = await intentStep('مجھے یونیورسٹی کے لیے لیپ ٹاپ چاہیے، میرے پاس 200 ڈالر ہیں', null, 'ur', emit as never);
      out.intentUr = { usedModel: b.usedModel, category: b.intent.category, language: b.intent.language, ownFundsRaw: b.intent.ownFundsRaw };
      // 3. Grounded explanation in Spanish for real fixture listings.
      const state = mergeState(null, a.intent, 'I want a laptop to learn Android Studio. I have an Android phone to test on, budget $700.', null, 'es');
      const { requirements } = buildRequirements(state);
      const ctx = { requirements, allowedKinds: ['laptop'], categoryNoun: 'laptop', brandsExclude: [], brandsInclude: [], colors: [], budgetCents: 70000, priceCapCents: null, wantsPremium: false, usedOk: null };
      const ranked = rankEvaluated(laptops.map((p: never) => evaluateProduct(p, ctx as never)), ctx as never);
      const top = ranked.bestFit.slice(0, 3).map(id => ranked.suitable.find(p => p.externalId === id)!);
      const ex = await explainPicks(top, state, 'Android Studio', ranked.cheapestAdequateId, 'es');
      out.explain = { usedModel: ex.usedModel, picks: ex.picks.length, summaryChars: ex.summary.length, idsGrounded: ex.picks.every(p => top.some(t => t.externalId === p.externalId)) };
      out.diagnostics = llmDiagnostics().perModel[model];
      out.fallbackReasons = llmDiagnostics().fallbackReasons;
      report[model] = out;
      fs.mkdirSync('private/review', { recursive: true });
      fs.writeFileSync('private/review/gemini-compat.json', JSON.stringify({ at: new Date().toISOString(), verified, report }, null, 1));

      expect(a.usedModel, `${model}: English intent`).toBe(true);
      expect(a.intent.category).toBe('laptop');
      expect(a.intent.noEmulator).toBe(true);
      expect(b.usedModel, `${model}: Urdu intent`).toBe(true);
      expect(['ur', 'mixed']).toContain(b.intent.language);
      expect(ex.usedModel, `${model}: explanation`).toBe(true);
      expect(ex.picks.length).toBeGreaterThan(0);
      expect(ex.picks.every(p => top.some(t => t.externalId === p.externalId))).toBe(true); // only real, evaluated products
      verified.push(model);
    }
    fs.mkdirSync('private/review', { recursive: true });
    fs.writeFileSync('private/review/gemini-compat.json', JSON.stringify({ at: new Date().toISOString(), verified, report }, null, 1));
    console.log(JSON.stringify({ verified, report }, null, 1));
    expect(verified.length).toBeGreaterThan(0);
  }, 120_000);
});
