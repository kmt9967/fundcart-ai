import { describe, expect, it } from 'vitest';
import { toCents, centsToPayPalValue, fundingGap, fundingPercent, remainingCents, validateContribution, suggestedTiers, formatUSD } from '@/lib/money';

describe('money helpers', () => {
  it('parses dollars into exact cents without float drift', () => {
    expect(toCents('700')).toBe(70000);
    expect(toCents('0.1')).toBe(10);
    expect(toCents('19.99')).toBe(1999);
    expect(toCents(856.08)).toBe(85608);
    expect(toCents(0.1 + 0.2)).toBe(30); // 0.30000000000000004 → 30
  });
  it('rejects malformed amounts', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1e3', '12,50']) expect(() => toCents(bad)).toThrow();
  });
  it('formats PayPal amount strings', () => {
    expect(centsToPayPalValue(70000)).toBe('700.00');
    expect(centsToPayPalValue(5)).toBe('0.05');
    expect(centsToPayPalValue(123456)).toBe('1234.56');
    expect(() => centsToPayPalValue(1.5)).toThrow();
  });
  it('computes the funding gap (the brief example: $600 item, $150 saved → $450)', () => {
    expect(fundingGap(60000, 15000)).toBe(45000);
    expect(fundingGap(70000, 20000)).toBe(50000);
    expect(fundingGap(50000, 80000)).toBe(0);
  });
  it('floors the percentage so it never shows 100% early', () => {
    expect(fundingPercent(49999, 50000)).toBe(99);
    expect(fundingPercent(50000, 50000)).toBe(100);
    expect(fundingPercent(60000, 50000)).toBe(100);
    expect(remainingCents(32000, 50000)).toBe(18000);
  });
  it('validates contributions including overfunding rules', () => {
    expect(validateContribution(2500, 0, 50000, false)).toEqual({ ok: true, amountCents: 2500 });
    expect(validateContribution(50, 0, 50000, false).ok).toBe(false);          // below $1
    expect(validateContribution(20000, 40000, 50000, false).ok).toBe(false);   // more than remaining
    expect(validateContribution(10000, 40000, 50000, false).ok).toBe(true);    // exactly remaining
    expect(validateContribution(100, 50000, 50000, false).ok).toBe(false);     // already funded
    expect(validateContribution(20000, 40000, 50000, true).ok).toBe(true);     // overfunding allowed
    expect(validateContribution(1_000_001, 0, 5_000_000, true).ok).toBe(false); // sandbox cap
    expect(validateContribution(12.5, 0, 50000, false).ok).toBe(false);        // fractional cents
  });
  it('suggests deterministic tiers that end with the exact remaining amount', () => {
    expect(suggestedTiers(50000)).toEqual([1000, 2500, 5000, 50000]);
    expect(suggestedTiers(1800)).toEqual([1000, 1800]);
    expect(suggestedTiers(0)).toEqual([]);
  });
  it('formats USD and handles missing prices', () => {
    expect(formatUSD(45000)).toBe('$450.00');
    expect(formatUSD(null)).toBe('Price unavailable');
  });
});
