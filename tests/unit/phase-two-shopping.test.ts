import { describe, expect, it } from 'vitest';
import { applyShoppingBrief, ShoppingBriefPatch } from '@/lib/shopping/brief';
import { bundleTotal, componentSocket } from '@/lib/shopping/bundle';
import { mergeState } from '@/lib/shopping/session';
import { parseIntentFallback } from '@/lib/shopping/fallback-intent';

describe('Phase 2 shopping controls', () => {
  it('changes confirmed fields without dropping the earlier use case or compatibility state', () => {
    const prompt = 'Find a laptop for Android Studio under $900 with 16GB RAM and 512GB SSD, not HP';
    const initial = { ...mergeState(null, parseIntentFallback(prompt, false), prompt, 15000), requiresFitVerification: true };
    const changed = applyShoppingBrief(initial, ShoppingBriefPatch.parse({ budget: { currency: 'USD', amountMinor: 80000 }, ramGb: 32 }));
    expect(changed.budget?.maxCents).toBe(80000);
    expect(changed.stated).toEqual(expect.arrayContaining([
      { field: 'ram_gb', op: '>=', value: 32 },
      { field: 'storage_gb', op: '>=', value: 512 },
    ]));
    expect(changed).toMatchObject({ profileId: initial.profileId, goal: initial.goal, brandsExclude: ['hp'], ownFundsCents: 15000, requiresFitVerification: true });
    expect(initial.budget?.maxCents).toBe(90000);
  });

  it('marks a non-USD budget as unusable for filtering USD offers', () => {
    const initial = mergeState(null, parseIntentFallback('Find headphones', false), 'Find headphones', null);
    const changed = applyShoppingBrief(initial, { budget: { currency: 'EUR', amountMinor: 15000 } });
    expect(changed.budget).toMatchObject({ currency: 'EUR', maxCents: 15000, usable: false });
    expect(applyShoppingBrief(changed, { budget: null }).budget).toBeNull();
    expect(ShoppingBriefPatch.safeParse({ ramGb: -1, approved: true }).success).toBe(false);
  });

  it('only reports a CPU socket from a consistent structured attribute', () => {
    expect(componentSocket({ cpu_socket: ['AM5'], socket: ['am5'] })).toBe('AM5');
    expect(componentSocket({ cpu_socket: ['AM5'], socket: ['AM4'] })).toBeNull();
    expect(componentSocket({ description: ['Supports AM5'] })).toBeNull();
  });

  it('totals known prices in cents and counts unpriced or unselected components', () => {
    expect(bundleTotal([22999, null, undefined, 4625], 27000)).toEqual({ totalCents: 27624, unquoted: 2, overBudget: true });
    expect(bundleTotal([null], 40000)).toEqual({ totalCents: 0, unquoted: 1, overBudget: false });
  });
});
