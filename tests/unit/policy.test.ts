// E. Policy and eligibility enforcement + payment arithmetic (deterministic, never decided by the AI).
import { afterEach, describe, expect, it } from 'vitest';
import { policyFor, canCreateCampaign, canContribute, fundingOffer, requestCountry, COUNTRY_POLICIES, POLICY_VERSION } from '@/lib/policy';
import { campaignGap, validateContribution, MIN_CONTRIBUTION_CENTS } from '@/lib/money';

describe('E1 country configuration', () => {
  it('real-money fundraising is disabled everywhere and every entry awaits legal review', () => {
    for (const p of Object.values(COUNTRY_POLICIES)) { expect(p.realMoneyFundraising).toBe(false); expect(p.legalReview).toBe('unverified'); expect(p.paymentProviders).toEqual(['paypal_sandbox']); expect(p.shopping).toBe(true); }
    expect(POLICY_VERSION).toMatch(/^policy-\d{4}-\d{2}-\d{2}/);
  });
  it('jurisdictions with criminal or designated-platform-only rules are shopping-only', () => {
    for (const c of ['AE', 'SA', 'CN', 'ID']) { expect(policyFor(c).fundraising).toBe('disabled'); expect(fundingOffer(policyFor(c)).available).toBe(false); }
  });
  it('unresearched countries default to shopping-only', () => {
    expect(policyFor('BR').fundraising).toBe('disabled');
    expect(policyFor('BR').shopping).toBe(true);
  });
  it('unknown location (no geo header) is a sandbox demo', () => {
    expect(policyFor(null).country).toBe('XX');
    expect(policyFor(undefined).fundraising).toBe('sandbox_demo');
  });
});

describe('E2 campaign creation gate (T19)', () => {
  it('blocks campaigns where fundraising is disabled', () => {
    const d = canCreateCampaign(policyFor('AE'), 'education', 'laptop', 'Laptop for school');
    expect(d).toEqual({ allowed: false, reason: 'fundraising_disabled_in_country', messageKey: 'policy.noFundraising' });
  });
  it('requires an allowed need category', () => {
    expect(canCreateCampaign(policyFor('US'), null, 'laptop', 'Laptop').allowed).toBe(false);
    expect(canCreateCampaign(policyFor('US'), 'vacation', 'laptop', 'Laptop').allowed).toBe(false);
    expect(canCreateCampaign(policyFor('US'), 'education', 'laptop', 'Laptop for school').allowed).toBe(true);
  });
  it('restricted categories can never be campaigns', () => {
    for (const title of ['Gift cards for my friends', 'Vape starter kit', 'Luxury watch for my wedding', 'Designer handbag']) {
      expect(canCreateCampaign(policyFor('US'), 'family_child', null, title).allowed).toBe(false);
    }
  });
});

describe('E3 contribution gate (cross-border)', () => {
  it('domestic contributions are allowed in sandbox countries', () => {
    expect(canContribute('US', 'US').allowed).toBe(true);
    expect(canContribute('PK', 'PK').allowed).toBe(true);
  });
  it('Pakistan and India campaigns accept domestic contributions only', () => {
    expect(canContribute('PK', 'US')).toMatchObject({ allowed: false, reason: 'cross_border_not_allowed' });
    expect(canContribute('IN', 'GB')).toMatchObject({ allowed: false, reason: 'cross_border_not_allowed' });
  });
  it('people in shopping-only countries cannot contribute elsewhere', () => {
    expect(canContribute('US', 'AE')).toMatchObject({ allowed: false, reason: 'payer_country_disabled' });
  });
  it('legacy campaigns without a country stay supportable (sandbox demo)', () => {
    expect(canContribute(null, 'US').allowed).toBe(true);
    expect(canContribute(null, 'XX').allowed).toBe(true);
  });
  it('interface language never changes the decision (functions take no locale)', () => {
    expect(canContribute.length).toBe(2);
    expect(canCreateCampaign.length).toBe(4);
  });
});

describe('E4 trusted country source', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });
  it('production trusts only the edge geo header, never a client test header', () => {
    process.env.VERCEL_ENV = 'production';
    expect(requestCountry(new Request('http://x/', { headers: { 'x-fc-test-country': 'US', 'x-vercel-ip-country': 'AE' } }))).toBe('AE');
    expect(requestCountry(new Request('http://x/', { headers: { 'x-fc-test-country': 'US' } }))).toBe('XX');
  });
  it('outside production the test header can exercise the gates', () => {
    delete process.env.VERCEL_ENV;
    expect(requestCountry(new Request('http://x/', { headers: { 'x-fc-test-country': 'pk' } }))).toBe('PK');
    expect(requestCountry(new Request('http://x/', { headers: { 'x-fc-test-country': 'evil' } }))).toBe('XX');
  });
});

describe('E5 gap math (T20) and contribution limits (T26)', () => {
  it('gap = price + shipping + tax + buffer − own funds, buffer rounded up', () => {
    const g = campaignGap({ priceCents: 70000, shippingCents: 2000, taxCents: 0, bufferPct: 5, ownFundsCents: 30000 });
    expect(g.totalCents).toBe(45500);
    expect(g.formula).toEqual({ price: 70000, shipping: 2000, tax: 0, buffer: 3500, bufferPct: 5, ownFunds: 30000 });
    expect(campaignGap({ priceCents: 999, bufferPct: 5, ownFundsCents: 0 }).formula.buffer).toBe(50);
    expect(campaignGap({ priceCents: 10000, ownFundsCents: 20000 }).totalCents).toBe(0);
  });
  it('rejects invalid inputs instead of guessing', () => {
    expect(() => campaignGap({ priceCents: -1, ownFundsCents: 0 })).toThrow();
    expect(() => campaignGap({ priceCents: 100, ownFundsCents: 0, bufferPct: 50 })).toThrow();
    expect(() => campaignGap({ priceCents: 10.5, ownFundsCents: 0 })).toThrow();
  });
  it('minimum $5 contribution (card-testing defence), except to finish a campaign exactly', () => {
    expect(MIN_CONTRIBUTION_CENTS).toBe(500);
    expect(validateContribution(100, 0, 50000, false).ok).toBe(false);
    expect(validateContribution(499, 0, 50000, false).ok).toBe(false);
    expect(validateContribution(500, 0, 50000, false).ok).toBe(true);
    expect(validateContribution(250, 49750, 50000, false).ok).toBe(true);
  });
});
