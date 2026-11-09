// Opt-in evaluation of the team's 100-case workbook (intent + safety layer only; no product search).
// Run: RUN_WORKBOOK=1 WORKBOOK_JSON=private/research/test_cases.json npx vitest run tests/unit/workbook.eval.test.ts
// Writes private/research/workbook_run.json. Calls Gemini once per case when a key is configured.
import { describe, it, vi } from 'vitest';
import fs from 'node:fs';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: () => { throw new Error('no db in eval'); } }));

const RUN = !!process.env.RUN_WORKBOOK;

describe.skipIf(!RUN)('workbook evaluation', () => {
  it('runs every workbook input through safety + intent + session merge', async () => {
    const { screenMessage } = await import('@/lib/shopping/safety');
    const { validateIntent } = await import('@/lib/shopping/pipeline');
    const { parseIntentFallback } = await import('@/lib/shopping/fallback-intent');
    const { mergeState, buildRequirements } = await import('@/lib/shopping/session');
    const { generateJson } = await import('@/lib/ai/llm');
    const wb = JSON.parse(fs.readFileSync(process.env.WORKBOOK_JSON || 'private/research/test_cases.json', 'utf8'));
    const rows = (wb['Test Cases'] as unknown[][]).slice(1);
    const out: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      const [id, , family, , language, difficulty, critical, input] = r as string[];
      const safety = screenMessage(String(input));
      const rec: Record<string, unknown> = { id, family, language, difficulty, critical, input };
      if (safety.block) { Object.assign(rec, { action: 'blocked', safetyFlags: safety.flags }); out.push(rec); continue; }
      if (safety.supportRoute) { Object.assign(rec, { action: `support:${safety.supportRoute}` }); out.push(rec); continue; }
      let intent = null; let usedModel = false;
      const g = await generateJson<Record<string, unknown>>({ system: 'Extract the shopping intent as JSON. Normalize categories to English. Keep budgetRaw exactly as written.', prompt: `<user_message>${safety.redacted}</user_message>`, schema: { type: 'object', properties: { category: { type: 'string' }, productKind: { type: 'string' }, searchQuery: { type: 'string' }, goal: { type: 'string' }, useCases: { type: 'array', items: { type: 'string' } }, software: { type: 'array', items: { type: 'string' } }, budgetRaw: { type: 'string', nullable: true }, brandsExclude: { type: 'array', items: { type: 'string' } }, language: { type: 'string' }, requestedAction: { type: 'string' }, primaryFamily: { type: 'string' }, followUpQuestion: { type: 'string', nullable: true } }, required: ['category', 'searchQuery'] }, temperature: 0.1, timeoutMs: 20000 });
      if (g.ok) { intent = validateIntent(g.data, safety.redacted, false); usedModel = !!intent; }
      if (!intent) intent = parseIntentFallback(safety.redacted, false);
      const st = mergeState(null, intent, safety.redacted, null);
      const req = buildRequirements(st);
      Object.assign(rec, {
        model: usedModel ? 'gemini' : 'rules', action: intent.requestedAction, category: st.category, family: intent.primaryFamily, detectedLanguage: st.language,
        budget: st.budget ? `${st.budget.raw} → ${st.budget.currency} ${(st.budget.maxCents ?? 0) / 100}${st.budget.usable ? '' : ' (not applied: not USD)'}` : null,
        profile: req.profile?.id ?? null, minimum: req.requirements.filter(x => x.level === 'minimum').map(x => `${x.field} ${x.op} ${Array.isArray(x.value) ? x.value.join('/') : x.value}`),
        stated: st.stated.map(c => `${c.field} ${c.op} ${c.value}`), exclusions: st.brandsExclude, followUp: intent.followUpQuestion, piiRedacted: safety.piiRedacted,
      });
      out.push(rec);
      await new Promise(res => setTimeout(res, 3500)); // stay inside free-tier rate limits
    }
    fs.writeFileSync('private/research/workbook_run.json', JSON.stringify(out, null, 1));
  }, 1_200_000);
});
