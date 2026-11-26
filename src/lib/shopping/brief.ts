import { z } from 'zod';
import type { SessionState } from './types';

export const ShoppingBriefPatch = z.object({
  budget: z.object({
    amountMinor: z.number().int().min(1).max(100_000_000),
    currency: z.enum(['USD', 'PKR', 'EUR', 'GBP', 'CAD', 'AUD']),
  }).nullable().optional(),
  ramGb: z.number().int().min(1).max(512).nullable().optional(),
  excludedBrands: z.array(z.string().trim().min(1).max(32).regex(/^[\p{L}\p{N}. &-]+$/u)).max(8).optional(),
}).strict();

export type BriefPatch = z.infer<typeof ShoppingBriefPatch>;

export function applyShoppingBrief(state: SessionState, patch: BriefPatch): SessionState {
  const next = { ...state, turn: state.turn + 1, primaryFamily: 'refinement' as const };
  if (patch.budget !== undefined) {
    next.budget = patch.budget && {
      maxCents: patch.budget.amountMinor,
      minCents: state.budget?.currency === patch.budget.currency
        && state.budget.minCents != null && state.budget.minCents <= patch.budget.amountMinor ? state.budget.minCents : null,
      currency: patch.budget.currency,
      raw: `${patch.budget.currency} ${(patch.budget.amountMinor / 100).toFixed(2)}`,
      usable: patch.budget.currency === 'USD',
    };
    next.priceCapCents = null;
  }
  if (patch.ramGb !== undefined) {
    next.stated = state.stated.filter(c => c.field !== 'ram_gb' || c.op !== '>=');
    if (patch.ramGb !== null) next.stated.push({ field: 'ram_gb', op: '>=', value: patch.ramGb });
  }
  if (patch.excludedBrands) {
    next.brandsExclude = [...new Set(patch.excludedBrands.map(brand => brand.toLowerCase()))];
    next.brandsInclude = state.brandsInclude.filter(brand => !next.brandsExclude.includes(brand));
  }
  return next;
}
