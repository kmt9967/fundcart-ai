// Suitability-first evaluation and ranking. Pure functions (unit-tested).
//
// A product is:
//   suitable            – every minimum requirement is verified as met from the listing
//   needs_verification  – nothing fails, but at least one minimum requirement can't be confirmed
//                         (spec missing or sources conflict). Never labelled as a verified fit.
//   unsuitable          – wrong product type, or a minimum requirement is clearly not met
// Prices and gaps are integer cents computed here, never by the model.

import type { Product } from '../channel3';
import { extractSpecs, type Specs } from './specs';
import type { Requirement } from './types';

export type CheckStatus = 'met' | 'unmet' | 'unknown';
export type Check = { field: Requirement['field']; label: string; required: string; actual: string; status: CheckStatus; level: Requirement['level']; origin: Requirement['origin']; why: string; source?: Requirement['source']; inferred?: boolean; conflict?: boolean };

export type Evaluation = {
  status: 'suitable' | 'needs_verification' | 'unsuitable';
  tier: 'minimum' | 'recommended' | 'premium' | null;
  kindOk: boolean | null;
  kindNote: string | null;
  checks: Check[];
  failReasons: string[];
  unknownReasons: string[];
  brandExcluded: boolean;
  withinBudget: boolean | null;
  overkill: { extraCents: number; note: string } | null;
};

export type EvaluatedProduct = Product & { specs: Specs; evaluation: Evaluation; score: number };

const FIELD_LABEL: Record<Requirement['field'], string> = {
  ram_gb: 'RAM', storage_gb: 'Storage', storage_type: 'Storage type', cpu_modern: 'Processor generation', cpu_tier: 'Processor class',
  arm: 'Processor architecture', gpu_dedicated: 'Dedicated graphics', gpu_vram_gb: 'Graphics memory (VRAM)', os: 'Operating system',
  screen_in: 'Screen size', refresh_hz: 'Refresh rate', anc: 'Active noise cancelling', wireless: 'Wireless', microphone: 'Microphone',
  interchangeable_lens: 'Interchangeable lenses', condition: 'Condition',
};
const OS_LABEL: Record<string, string> = { windows: 'Windows', macos: 'macOS', chromeos: 'ChromeOS', linux: 'Linux', android: 'Android', ios: 'iOS/iPadOS' };
const TIER_LABEL = ['', 'Intel N-series / Celeron', 'pre-2017 CPU', 'Core i3 / Ryzen 3', 'Core i5 / Ryzen 5 (U-series)', 'H-series / Apple M3+', 'Core i9 / Ryzen 9 / HX'];

export function fmtRequired(r: Requirement): string {
  const v = r.value;
  switch (r.field) {
    case 'ram_gb': case 'storage_gb': case 'gpu_vram_gb': return `${opText(r.op)} ${v} GB`;
    case 'screen_in': return r.op === '~=' ? `≈ ${v}"` : `${opText(r.op)} ${v}"`;
    case 'refresh_hz': return `${opText(r.op)} ${v} Hz`;
    case 'cpu_tier': return `≥ ${TIER_LABEL[Number(v)] || v}`;
    case 'cpu_modern': return 'Intel 8th Gen+ / AMD Ryzen / Apple Silicon';
    case 'arm': return v === false ? 'x86 (Intel/AMD)' : 'ARM';
    case 'os': return Array.isArray(v) ? v.map(x => OS_LABEL[x] || x).join(' / ') : r.op === '!=' ? `≠ ${OS_LABEL[String(v)] || v}` : (OS_LABEL[String(v)] || String(v));
    case 'storage_type': return Array.isArray(v) ? v.map(x => x.toUpperCase()).join(' / ') : String(v).toUpperCase();
    default: return typeof v === 'boolean' ? (v ? '✓' : '✗') : Array.isArray(v) ? v.join(' / ') : String(v);
  }
}
function opText(op: Requirement['op']) { return op === '>=' ? '≥' : op === '<=' ? '≤' : op === '==' ? '' : op; }

function compare(op: Requirement['op'], actual: number | string | boolean, required: Requirement['value']): boolean {
  switch (op) {
    case '>=': return Number(actual) >= Number(required);
    case '<=': return Number(actual) <= Number(required);
    case '==': return String(actual).toLowerCase() === String(required).toLowerCase();
    case '!=': return String(actual).toLowerCase() !== String(required).toLowerCase();
    case 'in': return (required as string[]).map(x => x.toLowerCase()).includes(String(actual).toLowerCase());
    case 'not_in': return !(required as string[]).map(x => x.toLowerCase()).includes(String(actual).toLowerCase());
    case '~=': return Math.abs(Number(actual) - Number(required)) <= 0.6;
  }
}

/** Evaluate one requirement against extracted specs. */
export function checkRequirement(r: Requirement, s: Specs): Check {
  const base = { field: r.field, label: FIELD_LABEL[r.field], required: fmtRequired(r), level: r.level, origin: r.origin, why: r.why, source: r.source };
  const unknown = (actual = 'Not listed', extra: Partial<Check> = {}): Check => ({ ...base, actual, status: 'unknown', ...extra });
  const result = (ok: boolean, actual: string, extra: Partial<Check> = {}): Check => ({ ...base, actual, status: ok ? 'met' : 'unmet', ...extra });
  const num = (spec: Specs['ramGB'], unit: string) => {
    if (!spec) return unknown();
    const lo = compare(r.op, spec.value, r.value); const hi = compare(r.op, spec.max, r.value);
    const actual = spec.conflict ? `${spec.value}–${spec.max} ${unit} (listing is inconsistent)` : `${spec.value} ${unit}`;
    if (spec.conflict && lo !== hi) return unknown(actual, { conflict: true });
    return result(lo, actual, { inferred: spec.source === 'inferred', conflict: spec.conflict });
  };
  switch (r.field) {
    case 'ram_gb': return num(s.ramGB, 'GB');
    case 'storage_gb': return num(s.storageGB, 'GB');
    case 'screen_in': return num(s.screenInches, '"');
    case 'refresh_hz': return num(s.refreshHz, 'Hz');
    case 'gpu_vram_gb':
      if (s.gpuDedicated?.value === false) return result(compare(r.op, 0, r.value), 'Integrated graphics only');
      if (!s.gpuVramGB) return unknown(s.gpuLabel ? `${s.gpuLabel} (VRAM not listed)` : 'Not listed');
      return { ...num(s.gpuVramGB, 'GB'), actual: `${s.gpuLabel ? s.gpuLabel + ', ' : ''}${s.gpuVramGB.value} GB${s.gpuVramGB.source === 'inferred' ? ' (minimum for this GPU model)' : ''}` };
    case 'gpu_dedicated': return s.gpuDedicated ? result(compare(r.op, s.gpuDedicated.value, r.value), s.gpuDedicated.value ? (s.gpuLabel || 'Dedicated GPU') : 'Integrated graphics') : unknown();
    case 'storage_type': return s.storageType ? result(compare(r.op, s.storageType.value, r.value), s.storageType.value.toUpperCase()) : unknown();
    case 'os': return s.os ? result(compare(r.op, s.os.value, r.value), OS_LABEL[s.os.value] || s.os.value) : unknown();
    case 'cpu_modern':
      if (!s.cpu) return unknown();
      if (s.cpu.label.includes('generation not listed')) return unknown(s.cpu.label);
      return result(compare(r.op, s.cpu.modern, r.value), s.cpu.label);
    case 'cpu_tier':
      if (!s.cpu) return unknown();
      if (s.cpu.label.includes('generation not listed')) return unknown(s.cpu.label);
      return result(compare(r.op, s.cpu.tier, r.value), s.cpu.label);
    case 'arm': return s.arm ? result(compare(r.op, s.arm.value, r.value), s.cpu ? s.cpu.label : s.arm.value ? 'ARM' : 'x86') : unknown();
    case 'anc': return s.anc ? result(compare(r.op, s.anc.value, r.value), s.anc.value ? 'Yes' : 'No') : unknown();
    case 'wireless': return s.wireless ? result(compare(r.op, s.wireless.value, r.value), s.wireless.value ? 'Yes' : 'No') : unknown();
    case 'microphone': return s.microphone ? result(compare(r.op, s.microphone.value, r.value), s.microphone.value ? 'Yes' : 'No') : unknown();
    case 'interchangeable_lens': return s.interchangeableLens ? result(compare(r.op, s.interchangeableLens.value, r.value), s.interchangeableLens.value ? 'Yes' : 'No') : unknown();
    case 'condition': return s.condition ? result(compare(r.op, s.condition.value, r.value), s.condition.value) : unknown();
  }
}

function applies(r: Requirement, s: Specs): boolean {
  if (!r.when) return true;
  const os = s.os?.value;
  if (r.when.osNot && os && r.when.osNot.includes(os)) return false;
  if (r.when.osIn && (!os || !r.when.osIn.includes(os))) return false;
  return true;
}

export type EvalContext = {
  requirements: Requirement[];
  allowedKinds: string[] | null; // e.g. ["laptop"]; null = category unknown
  categoryNoun: string | null;
  brandsExclude: string[];
  brandsInclude: string[];
  colors: string[];
  budgetCents: number | null;
  priceCapCents: number | null;
  wantsPremium: boolean;
  usedOk: boolean | null;
};

const KIND_LABEL: Record<string, string> = { book: 'a book', software: 'software', toy: 'a toy', accessory: 'an accessory or part', furniture: 'furniture', laptop: 'a laptop', desktop: 'a desktop computer', tablet: 'a tablet', headphones: 'headphones', phone: 'a phone', monitor: 'a monitor', camera: 'a camera' };

export function evaluateProduct(p: Product, ctx: EvalContext): EvaluatedProduct {
  const specs = extractSpecs(p);
  let kindOk: boolean | null = null; let kindNote: string | null = null;
  if (ctx.allowedKinds?.length) {
    if (specs.kind) {
      kindOk = ctx.allowedKinds.includes(specs.kind);
      if (!kindOk) kindNote = `This is ${KIND_LABEL[specs.kind] || specs.kind}, not ${ctx.categoryNoun ? `a ${ctx.categoryNoun}` : 'what you asked for'}.`;
    } else {
      const noun = (ctx.categoryNoun || '').split(' ')[0];
      kindOk = noun && new RegExp(`\\b${noun}`, 'i').test(p.title) ? true : null;
      if (kindOk === null) kindNote = 'Product type could not be confirmed from the listing.';
    }
  }
  // Toy/kids "laptops" (e.g. Android tablets with keyboards for children) are not computers.
  if (kindOk && /\b(kids?|children|toddler|learning toy|educational)\b/i.test(p.title) && ctx.allowedKinds?.includes('laptop')) { kindOk = false; kindNote = 'This is a children\'s learning device, not a laptop computer.'; }

  const checks = ctx.requirements.filter(r => applies(r, specs)).map(r => checkRequirement(r, specs));
  const minChecks = checks.filter(c => c.level === 'minimum');
  const brand = (p.brand || '').toLowerCase(); const title = p.title.toLowerCase();
  const brandExcluded = ctx.brandsExclude.some(b => brand === b.toLowerCase() || new RegExp(`\\b${escapeRe(b.toLowerCase())}\\b`).test(title));
  const failReasons = [
    ...(kindOk === false ? [kindNote!] : []),
    ...(brandExcluded ? [`You asked to exclude ${p.brand || 'this brand'}.`] : []),
    ...minChecks.filter(c => c.status === 'unmet').map(c => `${c.label}: ${c.actual} (needs ${c.required}).`),
    ...(ctx.usedOk === false && /used|refurbished/.test(specs.condition?.value || '') ? ['Used/refurbished, but you asked for new.'] : []),
  ];
  const unknownReasons = [
    ...(kindOk === null && ctx.allowedKinds?.length ? [kindNote || 'Product type not confirmed.'] : []),
    ...minChecks.filter(c => c.status === 'unknown').map(c => `${c.label}: ${c.actual === 'Not listed' ? 'not listed' : c.actual} (needs ${c.required}).`),
  ];
  const status: Evaluation['status'] = failReasons.length ? 'unsuitable' : unknownReasons.length ? 'needs_verification' : 'suitable';
  let tier: Evaluation['tier'] = null;
  if (status === 'suitable') {
    const rec = checks.filter(c => c.level === 'recommended'); const prem = checks.filter(c => c.level === 'premium');
    tier = prem.length && prem.some(c => c.status === 'met') ? 'premium' : rec.length && rec.every(c => c.status === 'met') ? 'recommended' : 'minimum';
  }
  const withinBudget = p.priceCents == null || ctx.budgetCents == null ? null : p.priceCents <= ctx.budgetCents;
  return { ...p, specs, score: 0, evaluation: { status, tier, kindOk, kindNote, checks, failReasons, unknownReasons, brandExcluded, withinBudget, overkill: null } };
}

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export type Ranked = {
  all: EvaluatedProduct[];
  suitable: EvaluatedProduct[];
  needsVerification: EvaluatedProduct[];
  unsuitable: EvaluatedProduct[];
  bestFit: string[];
  cheapestAdequate: string[];
  cheapestAdequateId: string | null;
};

/** Score for "Best fit": suitability tier, value for money, budget fit, preferences, rating. */
function bestFitScore(p: EvaluatedProduct, cheapest: number | null, ctx: EvalContext): number {
  const e = p.evaluation;
  let s = e.tier === 'recommended' ? 40 : e.tier === 'premium' ? (ctx.wantsPremium ? 45 : 24) : e.tier === 'minimum' ? 24 : 0;
  if (p.priceCents != null && ctx.budgetCents) {
    // With a budget: anything inside it is fine; prefer better fit, with only a mild preference for spending less.
    s += e.withinBudget ? 15 - (p.priceCents / ctx.budgetCents) * 6 : -20 - Math.min(20, (p.priceCents / ctx.budgetCents - 1) * 20);
  } else if (p.priceCents != null && cheapest) {
    s -= Math.min(30, Math.max(0, (p.priceCents / cheapest - 1) * 25)); // value for money vs the cheapest suitable option
  }
  if (ctx.priceCapCents && p.priceCents != null && p.priceCents >= ctx.priceCapCents) s -= 25;
  if (ctx.brandsInclude.length && ctx.brandsInclude.some(b => (p.brand || '').toLowerCase() === b.toLowerCase() || p.title.toLowerCase().includes(b.toLowerCase()))) s += 10;
  if (ctx.colors.length && ctx.colors.some(c => p.title.toLowerCase().includes(c) || p.specs.colors.some(x => x.includes(c)))) s += 6;
  if (p.rating && (p.ratingCount ?? 0) >= 5) s += Math.min(8, p.rating * 1.6);
  if (e.checks.some(c => c.conflict)) s -= 6;
  if (p.priceCents == null) s -= 40;
  if (/used|refurbished/.test(p.specs.condition?.value || '') && !ctx.usedOk) s -= 4;
  return Math.round(s * 10) / 10;
}

/**
 * Conservative lowest believable *new* price for a listing, from its verified specs (cents). Deliberately
 * low (well under street prices) so it only catches obvious errors such as deposits or monthly prices.
 */
export function plausibleFloorCents(p: EvaluatedProduct): number | null {
  const s = p.specs; const used = /used|refurbished/.test(s.condition?.value || '');
  if (s.kind !== 'laptop' && s.kind !== 'desktop') return s.kind === 'phone' ? 2500 : null;
  let floor = 8000; // any working laptop/desktop
  if ((s.gpuVramGB?.value ?? 0) >= 8) floor = 45000; else if (s.gpuDedicated?.value) floor = 30000;
  if (s.cpu?.vendor === 'apple') floor = Math.max(floor, 25000);
  if ((s.ramGB?.value ?? 0) >= 16 && s.cpu?.modern) floor = Math.max(floor, 18000);
  return used ? Math.round(floor * 0.5) : floor;
}

export function rankEvaluated(items: EvaluatedProduct[], ctx: EvalContext): Ranked {
  // De-duplicate identical listings (same title and price) from multiple queries.
  const seen = new Set<string>(); const uniq: EvaluatedProduct[] = [];
  for (const p of items) { const k = `${p.title.toLowerCase().slice(0, 80)}|${p.priceCents}`; if (seen.has(k) || seen.has(p.externalId)) continue; seen.add(k); seen.add(p.externalId); uniq.push(p); }
  const priced = (x: EvaluatedProduct) => x.priceCents != null;
  // Price sanity: a suitable listing far below the median of comparable suitable listings is usually a
  // deposit, monthly price, accessory or data error. It must never become the "cheapest" pick or a campaign goal.
  for (const p of uniq) {
    const floor = plausibleFloorCents(p);
    if (p.evaluation.status === 'suitable' && priced(p) && floor && p.priceCents! < floor) {
      p.evaluation.status = 'needs_verification'; p.evaluation.tier = null;
      p.evaluation.unknownReasons.push('Price is implausibly low for these specs. It may be a deposit, a monthly price, an accessory or an error. Check the retailer page.');
    }
  }
  const pool = uniq.filter(p => p.evaluation.status === 'suitable' && priced(p)).map(p => p.priceCents!).sort((a, b) => a - b);
  if (pool.length >= 4) {
    const median = pool[Math.floor(pool.length / 2)];
    for (const p of uniq) if (p.evaluation.status === 'suitable' && priced(p) && p.priceCents! < median * 0.45) {
      p.evaluation.status = 'needs_verification'; p.evaluation.tier = null;
      p.evaluation.unknownReasons.push('Price is unusually low compared with similar suitable listings. It may be a deposit, a monthly price, an accessory or an error. Check the retailer page.');
    }
  }
  const suitable = uniq.filter(p => p.evaluation.status === 'suitable' && priced(p));
  const byPrice = [...suitable].sort((a, b) => a.priceCents! - b.priceCents!);
  const cheapest = byPrice[0]?.priceCents ?? null;
  for (const p of uniq) {
    p.score = bestFitScore(p, cheapest, ctx);
    if (p.evaluation.status === 'suitable' && cheapest && p.priceCents && !ctx.wantsPremium && p.priceCents > cheapest * 1.6 && p.priceCents - cheapest >= 15000) {
      const extra = p.priceCents - cheapest;
      p.evaluation.overkill = { extraCents: extra, note: p.evaluation.tier === 'premium' ? 'Optional premium upgrade: more performance than this need requires.' : 'Costs much more than the cheapest suitable option without being required for your need.' };
    }
  }
  const bestFit = [...suitable].sort((a, b) => b.score - a.score).map(p => p.externalId);
  const needsVerification = uniq.filter(p => p.evaluation.status === 'needs_verification').sort((a, b) => b.score - a.score);
  const unsuitable = uniq.filter(p => p.evaluation.status === 'unsuitable' || (p.evaluation.status === 'suitable' && !priced(p)));
  return { all: uniq, suitable: bestFit.map(id => suitable.find(p => p.externalId === id)!), needsVerification, unsuitable, bestFit, cheapestAdequate: byPrice.map(p => p.externalId), cheapestAdequateId: byPrice[0]?.externalId ?? null };
}

/** Explain why cheaper options were rejected (aggregated, e.g. "6 had less than 16 GB RAM"). */
export function rejectionSummary(ranked: Ranked, belowCents: number | null): Array<{ label: string; count: number }> {
  const pool = ranked.unsuitable.filter(p => belowCents == null || (p.priceCents != null && p.priceCents < belowCents));
  const counts = new Map<string, number>();
  for (const p of pool) {
    const keys = new Set<string>();
    if (p.evaluation.kindOk === false) keys.add('Not the right type of product');
    if (p.evaluation.brandExcluded) keys.add('Brand you excluded');
    for (const c of p.evaluation.checks) if (c.level === 'minimum' && c.status === 'unmet') keys.add(`${c.label} below ${c.required}`);
    for (const k of keys) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 5);
}
