// Currency-safe money helpers. Every amount inside FundCart is an integer number of cents (USD).
// LLM output is never used as a source of prices or totals — only these functions are.

export const CURRENCY = 'USD' as const;
export const MAX_CONTRIBUTION_CENTS = 1_000_000; // $10,000 sandbox cap per contribution
export const MIN_CONTRIBUTION_CENTS = 500; // $5.00: small amounts are the favourite card-testing pattern on donation forms

/** Parse a decimal dollar value (number or string like "12.50") into integer cents without float drift. */
export function toCents(value: number | string): number {
  const s = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid amount: ${value}`);
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}

/** Format cents as a PayPal amount string, e.g. 70000 -> "700.00". */
export function centsToPayPalValue(cents: number): string {
  assertCents(cents);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export function formatUSD(cents: number | null | undefined): string {
  if (cents == null) return 'Price unavailable';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error(`Invalid cents value: ${cents}`);
}

/** Funding gap = item price − own funds, never negative. */
export function fundingGap(priceCents: number, ownFundsCents: number): number {
  assertCents(priceCents); assertCents(ownFundsCents);
  return Math.max(0, priceCents - ownFundsCents);
}

export type GapFormula = { price: number; shipping: number; tax: number; buffer: number; bufferPct: number; ownFunds: number };

/**
 * Campaign gap = live price + shipping + tax + buffer − own funds (integer cents, buffer rounded up).
 * The buffer covers price rises during the campaign; it is shown to supporters before they pay.
 */
export function campaignGap(o: { priceCents: number; shippingCents?: number; taxCents?: number; bufferPct?: number; ownFundsCents: number }): { totalCents: number; formula: GapFormula } {
  const shipping = o.shippingCents ?? 0; const tax = o.taxCents ?? 0; const pct = o.bufferPct ?? 0;
  [o.priceCents, shipping, tax, o.ownFundsCents].forEach(assertCents);
  if (!(pct >= 0 && pct <= 25)) throw new Error(`Invalid buffer percent: ${pct}`);
  const buffer = Math.ceil((o.priceCents * pct) / 100);
  const totalCents = Math.max(0, o.priceCents + shipping + tax + buffer - o.ownFundsCents);
  return { totalCents, formula: { price: o.priceCents, shipping, tax, buffer, bufferPct: pct, ownFunds: o.ownFundsCents } };
}

/** Whole-number funding percentage, floored so we never round up to "100%" early. */
export function fundingPercent(raisedCents: number, targetCents: number): number {
  assertCents(raisedCents); assertCents(targetCents);
  if (targetCents === 0) return 100;
  return Math.min(100, Math.floor((raisedCents * 100) / targetCents));
}

export function remainingCents(raisedCents: number, targetCents: number): number {
  return Math.max(0, targetCents - raisedCents);
}

/**
 * Validate a contribution amount against the campaign. Returns the accepted amount or an error.
 * Overfunding is blocked unless the campaign explicitly allows it.
 */
export function validateContribution(amountCents: number, raisedCents: number, targetCents: number, allowOverfunding: boolean):
  { ok: true; amountCents: number } | { ok: false; error: string } {
  if (!Number.isSafeInteger(amountCents)) return { ok: false, error: 'Amount must be a whole number of cents.' };
  if (amountCents > MAX_CONTRIBUTION_CENTS) return { ok: false, error: 'The maximum sandbox contribution is $10,000.' };
  const remaining = remainingCents(raisedCents, targetCents);
  // Below the minimum is allowed only to finish a campaign exactly (otherwise the last few dollars could never be raised).
  if (amountCents < MIN_CONTRIBUTION_CENTS && !(amountCents > 0 && amountCents === remaining)) return { ok: false, error: 'The minimum contribution is $5.00.' };
  if (!allowOverfunding && remaining === 0) return { ok: false, error: 'This campaign has already reached its goal.' };
  if (!allowOverfunding && amountCents > remaining) return { ok: false, error: `Only ${formatUSD(remaining)} is still needed.` };
  return { ok: true, amountCents };
}

/** Suggested contribution tiers derived from the remaining gap (deterministic, not AI). */
export function suggestedTiers(remaining: number): number[] {
  if (remaining <= 0) return [];
  const candidates = [1000, 2500, 5000, 10000, 25000];
  const tiers = candidates.filter(c => c < remaining).slice(0, 3);
  tiers.push(remaining);
  return [...new Set(tiers)].sort((a, b) => a - b);
}
