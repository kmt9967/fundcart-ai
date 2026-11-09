// Multi-turn shopping memory: explicit, testable merge rules.
//   - A new topic (new category, not a refinement) starts fresh.
//   - Refinements keep everything and change only what was said:
//       "cheaper"            → price cap below the previous top pick, cheapest-adequate ranking
//       "not HP"             → brand added to exclusions (removed from includes)
//       "I need 16GB RAM"    → stated constraint replaces any earlier one on the same field
//       "forget the budget"  → budget removed
//       "actually Windows"   → OS constraint replaced
//       "the second one"     → ordinal resolved against the previous result list
// Memory never stores or grants identity, verification or payment authority.

import { INTENT_VERSION, type Constraint, type IntentV2, type Requirement, type SessionState } from './types';
import { parseBudget, parseOwnFunds } from './money-parse';
import { matchProfile, profileById, CATEGORY_MAP, type Profile } from './knowledge';

export function mergeConstraints(prev: Constraint[], next: Constraint[]): Constraint[] {
  const out = [...prev];
  for (const c of next) {
    // A stated value replaces earlier statements on the same field (and direction).
    const i = out.findIndex(x => x.field === c.field && (x.op === c.op || (x.field === 'os')));
    if (i >= 0) out[i] = c; else out.push(c);
  }
  return out.slice(0, 12);
}

/** Merge the new turn's intent into the session state. `raw` is the (redacted) user message. */
export function mergeState(prev: SessionState | null, intent: IntentV2, raw: string, ownOverrideCents: number | null): SessionState {
  const refining = !!prev && (intent.isRefinement || intent.category === 'unknown' || (intent.category === prev.category && intent.primaryFamily === 'refinement')
    || (intent.noEmulator != null && !!prev.profileId?.startsWith('android_studio')));
  const base: SessionState | null = refining ? prev : null;

  // Money: parsed by code from the raw text (and the model's budgetRaw), never taken from model numbers.
  // The model's budgetRaw is only a fallback, and never when it just repeats the money the user already has
  // ("I only have $200" is own funds, not a price cap).
  const ownParsed = parseOwnFunds(raw);
  const modelBudget = intent.budgetRaw ? parseBudget(intent.budgetRaw) : null;
  const b = parseBudget(raw) || (modelBudget && !(ownParsed && ownParsed.minor === modelBudget.maxMinor) && !(intent.ownFundsRaw && intent.ownFundsRaw.trim() === intent.budgetRaw?.trim()) ? modelBudget : null);
  let budget = base?.budget ?? null;
  if (b) {
    // An amount without a currency sign in an Urdu / Roman Urdu message ("5k tak") is almost certainly rupees.
    const currency = b.currency || (['ur', 'roman_ur', 'mixed'].includes(intent.language) ? 'PKR' : 'USD');
    budget = { maxCents: b.maxMinor, minCents: b.minMinor, currency, raw: b.raw, usable: currency === 'USD' };
  }
  if (intent.clearBudget) budget = null;
  const own = ownOverrideCents ?? (() => { const o = parseOwnFunds(raw) || (intent.ownFundsRaw ? parseOwnFunds(`I have ${intent.ownFundsRaw}`) : null); return o && (o.currency || 'USD') === 'USD' ? o.minor : null; })() ?? base?.ownFundsCents ?? null;

  let brandsExclude = [...new Set([...(base?.brandsExclude || []), ...intent.brandsExclude.map(b => b.toLowerCase())])];
  let brandsInclude = intent.brandsInclude.length ? intent.brandsInclude.map(b => b.toLowerCase()) : (base?.brandsInclude || []);
  brandsExclude = brandsExclude.filter(b => !intent.brandsInclude.map(x => x.toLowerCase()).includes(b));
  brandsInclude = brandsInclude.filter(b => !brandsExclude.includes(b));

  // "Cheaper": cap prices below the previous best pick (code-computed from stored prices).
  let priceCapCents = base?.priceCapCents ?? null;
  if (intent.priceDirection === 'cheaper' && prev?.lastProductIds.length) {
    const firstPrice = prev.lastPrices[prev.lastProductIds[0]];
    if (firstPrice) priceCapCents = Math.min(priceCapCents ?? Infinity, firstPrice - 1);
  }
  if (intent.clearBudget) priceCapCents = null;

  const category = intent.category !== 'unknown' ? intent.category : base?.category || 'unknown';
  const haystack = [intent.goal, intent.searchQuery, ...intent.useCases, ...intent.software, raw].join(' ');
  const matched = matchProfile(category === 'unknown' ? null : category, haystack);
  let profileId = matched?.id ?? base?.profileId ?? null;
  const noEmulator = intent.noEmulator ?? base?.noEmulator ?? false;
  if (profileId === 'android_studio' && noEmulator) profileId = 'android_studio_device';
  if (profileId === 'android_studio_device' && intent.noEmulator === false) profileId = 'android_studio';
  const profileCategory = profileId ? profileById(profileId)?.categories[0] : null;

  return {
    version: INTENT_VERSION,
    turn: (prev?.turn ?? 0) + 1,
    category: category === 'unknown' && profileCategory ? profileCategory : category,
    searchQuery: refining && intent.category === 'unknown' ? base!.searchQuery : intent.searchQuery,
    goal: refining ? base!.goal : intent.goal,
    useCases: [...new Set([...(base?.useCases || []), ...intent.useCases])].slice(0, 5),
    software: [...new Set([...(base?.software || []), ...intent.software])].slice(0, 5),
    skillLevel: intent.skillLevel !== 'unknown' ? intent.skillLevel : base?.skillLevel ?? 'unknown',
    recipient: refining ? base!.recipient : intent.recipient,
    stated: mergeConstraints(base?.stated || [], intent.hardConstraints),
    softPreferences: [...new Set([...(base?.softPreferences || []), ...intent.softPreferences])].slice(0, 8),
    brandsInclude, brandsExclude,
    colors: intent.colors.length ? intent.colors.map(c => c.toLowerCase()) : base?.colors || [],
    usedOk: intent.usedOk ?? base?.usedOk ?? null,
    budget,
    ownFundsCents: own,
    priceCapCents: Number.isFinite(priceCapCents) ? priceCapCents : null,
    rankingMode: intent.rankingMode ?? (intent.priceDirection === 'cheaper' ? 'cheapest_adequate' : base?.rankingMode ?? 'best_fit'),
    profileId,
    noEmulator,
    language: intent.language,
    primaryFamily: intent.primaryFamily,
    lastProductIds: prev?.lastProductIds || [],
    lastPrices: prev?.lastPrices || {},
  };
}

/** Requirements for a state: knowledge-base profile + user-stated constraints (stated ones override). */
export function buildRequirements(state: SessionState): { requirements: Requirement[]; profile: Profile | null } {
  const profile = state.profileId ? profileById(state.profileId) ?? null : null;
  const reqs: Requirement[] = profile ? profile.requirements.map(r => ({ ...r })) : [];
  for (const c of state.stated) {
    const req: Requirement = { field: c.field, op: c.op, value: c.value, level: 'minimum', origin: 'stated', why: 'You asked for this.' };
    // A stated requirement on a field replaces derived minimums on the same field when it is stricter or an OS choice.
    const i = reqs.findIndex(r => r.field === c.field && r.level === 'minimum');
    if (i >= 0) {
      const r = reqs[i];
      const stricter = c.op === '>=' && typeof c.value === 'number' && typeof r.value === 'number' ? c.value >= r.value : true;
      if (stricter) reqs[i] = req; else reqs.push({ ...req, level: 'recommended' });
    } else reqs.push(req);
  }
  return { requirements: reqs, profile };
}

/** Category → Channel3 slugs / allowed kinds. */
export function categoryInfo(category: string) {
  return CATEGORY_MAP[category] ?? null;
}
