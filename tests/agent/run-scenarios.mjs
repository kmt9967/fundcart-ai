// Runs shopping-agent scenarios against a running FundCart instance (local or production).
// Each scenario is one or more turns; turns share the guest cookie and conversation id.
// Usage: node tests/agent/run-scenarios.mjs <baseUrl> <scenarios.json> [outFile] [--only=ID,ID]
// No payments are made; this only calls /api/assistant (Channel3 search results are cached for 6h).
import fs from 'node:fs';

const BASE = (process.argv[2] || 'http://localhost:3200').replace(/\/$/, '');
const FILE = process.argv[3] || 'tests/agent/scenarios.json';
const OUT = process.argv[4] && !process.argv[4].startsWith('--') ? process.argv[4] : null;
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const scenarios = JSON.parse(fs.readFileSync(FILE, 'utf8')).filter(s => !only.length || only.includes(s.id));

// The assistant allows 12 requests per minute per client; SCENARIO_DELAY_MS spaces turns out on long runs.
const DELAY = Number(process.env.SCENARIO_DELAY_MS || 0);
async function turn(prompt, ctx, extra = {}) {
  if (DELAY) await new Promise(r => setTimeout(r, DELAY));
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/assistant`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(ctx.cookie ? { cookie: ctx.cookie } : {}) },
    body: JSON.stringify({ prompt, conversationId: ctx.conversationId || null, locale: extra.locale || 'en', ownFunds: extra.ownFunds ?? null }),
  });
  const set = res.headers.get('set-cookie'); if (set) ctx.cookie = set.split(';')[0];
  if (!res.ok) return { error: `HTTP ${res.status} ${await res.text()}`, ms: Date.now() - t0 };
  const lines = (await res.text()).trim().split('\n').map(l => JSON.parse(l));
  const result = lines.find(l => l.type === 'result')?.result;
  const err = lines.find(l => l.type === 'error')?.error;
  if (result?.sessionId) ctx.conversationId = result.sessionId;
  return { result, error: err, events: lines.filter(l => l.type === 'event').map(l => `${l.event.agent}: ${l.event.step}`), ms: Date.now() - t0 };
}

function summarize(r) {
  if (!r.result) return { error: r.error };
  const x = r.result; const by = new Map((x.products || []).map(p => [p.externalId, p]));
  const top = (ids) => ids.slice(0, 3).map(id => { const p = by.get(id); return p && `${(p.priceCents / 100).toFixed(0)} ${p.title.slice(0, 55)}`; });
  return {
    kind: x.kind, message: x.message?.slice(0, 120), category: x.state?.category, profile: x.profile?.id ?? null, language: x.state?.language, aiUsed: x.aiUsed,
    budget: x.budget?.raw ? `${x.budget.raw} (${x.budget.usable ? 'applied' : 'not applied'})` : null, excluded: x.state?.brandsExclude, cap: x.state?.priceCapCents,
    stated: x.state?.stated?.map(c => `${c.field}${c.op}${c.value}`), suitable: x.bestFit?.length ?? 0, verify: x.needsVerification?.length ?? 0, rejected: x.unsuitable?.length ?? 0,
    bestFit: top(x.bestFit || []), cheapest: top(x.cheapestAdequate || []), note: x.budget?.note?.slice(0, 140), followUp: x.followUp, flags: x.safety?.flags, compareIds: x.compareIds?.length,
  };
}

// Assertions: simple, declarative checks on the final turn's result.
function check(sc, r) {
  const fails = []; const x = r.result; const a = sc.expect || {};
  if (!x) return [`no result: ${r.error}`];
  const by = new Map((x.products || []).map(p => [p.externalId, p]));
  const suitable = (x.bestFit || []).map(id => by.get(id)).filter(Boolean);
  if (a.kind && x.kind !== a.kind) fails.push(`kind ${x.kind} != ${a.kind}`);
  if (a.category && x.state?.category !== a.category) fails.push(`category ${x.state?.category} != ${a.category}`);
  if (a.profile && x.profile?.id !== a.profile) fails.push(`profile ${x.profile?.id} != ${a.profile}`);
  if (a.flag && !(x.safety?.flags || []).includes(a.flag)) fails.push(`missing flag ${a.flag}`);
  if (a.minRamGB) for (const p of suitable) { const c = p.evaluation.checks.find(c => c.field === 'ram_gb' && c.level === 'minimum'); if (!c || c.status !== 'met') fails.push(`suitable without verified RAM: ${p.title.slice(0, 40)}`); }
  if (a.noTitle) for (const p of suitable) if (new RegExp(a.noTitle, 'i').test(p.title)) fails.push(`forbidden in suitable: ${p.title.slice(0, 50)}`);
  if (a.excludedBrand) for (const p of suitable) if (new RegExp(`\\b${a.excludedBrand}\\b`, 'i').test(`${p.brand} ${p.title}`)) fails.push(`excluded brand present: ${p.title.slice(0, 40)}`);
  if (a.maxPriceRatioTopVsCheapest && suitable.length) { const cheapest = Math.min(...suitable.map(p => p.priceCents)); if (suitable[0].priceCents > cheapest * a.maxPriceRatioTopVsCheapest) fails.push(`top pick ${suitable[0].priceCents} > ${a.maxPriceRatioTopVsCheapest}× cheapest ${cheapest}`); }
  if (a.budgetNotApplied && (x.budget?.usable || !x.budget?.raw)) fails.push('non-USD budget was applied or not detected');
  if (a.noteMatches && !new RegExp(a.noteMatches, 'i').test(x.budget?.note || '')) fails.push(`budget note "${(x.budget?.note || '').slice(0, 80)}" !~ ${a.noteMatches}`);
  if (a.compare && (x.compareIds || []).length < 2) fails.push('compare ids not resolved');
  if (a.capSet && !x.state?.priceCapCents) fails.push('price cap not set');
  return fails;
}

const report = [];
for (const sc of scenarios) {
  const ctx = {}; const turns = [];
  for (const tn of sc.turns) {
    const r = await turn(tn.prompt ?? tn, ctx, tn);
    turns.push({ prompt: tn.prompt ?? tn, ms: r.ms, ...summarize(r) });
    if (!r.result) { turns[turns.length - 1].events = r.events; break; }
    ctx.last = r;
  }
  const fails = ctx.last ? check(sc, ctx.last) : ['no result'];
  report.push({ id: sc.id, title: sc.title, pass: fails.length === 0, fails, turns });
  console.log(`${fails.length ? 'FAIL' : 'PASS'}  ${sc.id.padEnd(16)} ${sc.title}${fails.length ? '\n      ' + fails.join('\n      ') : ''}`);
}
const passed = report.filter(r => r.pass).length;
console.log(`\n${passed}/${report.length} scenarios passed`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
