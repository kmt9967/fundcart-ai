// Country policy engine (trusted configuration; the AI can read decisions but never change them).
//
// IMPORTANT: a country entry here is NOT a legal opinion and does not make any activity lawful.
// Every entry is marked legalReview: 'unverified' until a qualified local lawyer signs off. The
// prototype has no licensed partner charity, no regulated escrow and no payout arrangement, so
// real-money fundraising is disabled everywhere. "sandbox_demo" only allows PayPal Sandbox
// simulations (no real money) so the product can be demonstrated; it is switched off for
// jurisdictions where the team's research reports that individual fundraising is a criminal
// offence or restricted to government-designated platforms. Sources: private/review/COUNTRY_POLICY_SOURCES.md.

export const POLICY_VERSION = 'policy-2026-11-10.1';

export const NEED_CATEGORIES = ['education', 'work_livelihood', 'health_mobility', 'disability_access', 'home_essentials', 'family_child'] as const;
export type NeedCategory = typeof NEED_CATEGORIES[number];

export type FundraisingMode = 'sandbox_demo' | 'disabled';

export type CountryPolicy = {
  country: string;               // ISO 3166-1 alpha-2, or 'XX' for unknown
  name: string;
  currency: string;
  shopping: boolean;
  fundraising: FundraisingMode;
  realMoneyFundraising: false;   // no licensed partner / provider arrangement exists anywhere yet
  /** Contributions from another country to a campaign created here. */
  crossBorderIn: boolean;
  /** People in this country contributing to campaigns created elsewhere. */
  crossBorderOut: boolean;
  allowedNeedCategories: readonly NeedCategory[];
  /** Product categories that may never be the subject of a campaign here. */
  restrictedCampaignCategories: readonly string[];
  paymentProviders: readonly ('paypal_sandbox')[];
  requiredDisclosures: readonly string[];  // i18n keys shown before campaign creation / contribution
  verificationRequired: boolean;           // identity + need verification before real-money launch
  adminReviewRequired: boolean;            // every new campaign waits for a moderator
  minContributionCents: number;
  maxCampaignCents: number;
  helpline: string | null;
  legalReview: 'unverified';
  notes: string;
};

const ALL_NEEDS = NEED_CATEGORIES;
const ALWAYS_RESTRICTED = ['weapons', 'tobacco', 'alcohol', 'vape', 'gift card', 'cryptocurrency', 'jewelry', 'luxury watch', 'designer handbag'];
const BASE_DISCLOSURES = ['policy.discSandbox', 'policy.discNotCharity', 'policy.discUnverified', 'policy.discPayee'] as const;

function make(country: string, name: string, over: Partial<CountryPolicy>): CountryPolicy {
  return {
    country, name, currency: 'USD', shopping: true, fundraising: 'sandbox_demo', realMoneyFundraising: false,
    crossBorderIn: true, crossBorderOut: true, allowedNeedCategories: ALL_NEEDS, restrictedCampaignCategories: ALWAYS_RESTRICTED,
    paymentProviders: ['paypal_sandbox'], requiredDisclosures: BASE_DISCLOSURES, verificationRequired: true, adminReviewRequired: false,
    minContributionCents: 500, maxCampaignCents: 250_000, helpline: null, legalReview: 'unverified', notes: '', ...over,
  };
}

const STRICT = { fundraising: 'disabled' as const, crossBorderIn: false, crossBorderOut: false };

export const COUNTRY_POLICIES: Record<string, CountryPolicy> = {
  XX: make('XX', 'Unknown location', { adminReviewRequired: false, notes: 'Location unknown (local development or no geo header). Sandbox demo only.' }),
  US: make('US', 'United States', { helpline: '988', notes: 'Real-money fundraising would need state charitable-solicitation registration (or a registered platform charity) and a licensed payment provider.' }),
  GB: make('GB', 'United Kingdom', { currency: 'GBP', notes: 'Real money would need Fundraising Regulator alignment and an FCA-authorised payment provider.' }),
  CA: make('CA', 'Canada', { currency: 'CAD', notes: 'Not researched in detail.' }),
  AU: make('AU', 'Australia', { currency: 'AUD', notes: 'Real money would run through an ACNC-registered partner charity.' }),
  DE: make('DE', 'Germany', { currency: 'EUR', notes: 'EU: authorised payment provider (PSD2) and GDPR-grade consent for need data.' }),
  FR: make('FR', 'France', { currency: 'EUR', notes: 'EU: authorised payment provider (PSD2) and GDPR-grade consent for need data.' }),
  ES: make('ES', 'Spain', { currency: 'EUR', notes: 'EU: authorised payment provider (PSD2) and GDPR-grade consent for need data.' }),
  PK: make('PK', 'Pakistan', { currency: 'PKR', crossBorderIn: false, helpline: 'Umang 0311-7786264', notes: 'Source check: charities must register provincially (e.g. Punjab Charities Commission); foreign funding of non-profits is cleared mainly via the Interior Ministry / Economic Affairs Division. The SECP warning cited by the research dates from 2017 and targeted one scheme. Third-party sources report PayPal does not support receiving payments in Pakistan. Domestic contributions only in the demo.' }),
  IN: make('IN', 'India', { currency: 'INR', crossBorderIn: false, notes: 'Source check: foreign contributions to organisations need FCRA registration; individuals may receive up to Rs 10 lakh a year from relatives abroad. Platforms such as Ketto disable foreign donations without FCRA. Domestic contributions only in the demo.' }),
  KE: make('KE', 'Kenya', { currency: 'KES', adminReviewRequired: true, notes: 'Source check: the 2024 fundraising-appeals bill did not pass the Senate; the Public Collections Act still applies. Every campaign waits for review in the demo.' }),
  AE: make('AE', 'United Arab Emirates', { currency: 'AED', ...STRICT, notes: 'Source check: fundraising needs a permit or an authorised entity (Federal Law No. 3 of 2021); unauthorised fundraising is reported to carry fines up to AED 300,000 and imprisonment (higher for aggravated cases). Shopping only.' }),
  SA: make('SA', 'Saudi Arabia', { currency: 'SAR', ...STRICT, notes: 'Source check: only licensed entities through approved channels; foreign donations need committee approval. Shopping only.' }),
  CN: make('CN', 'China', { currency: 'CNY', ...STRICT, notes: 'Source check: online appeals and individual help-seeking only on platforms designated by the Ministry of Civil Affairs (Charity Law as amended, in force 5 Sep 2024). Shopping only.' }),
  ID: make('ID', 'Indonesia', { currency: 'IDR', ...STRICT, notes: 'Source check: collecting money or goods needs a permit held by a legal entity (3 months, extendable once); individuals cannot hold one. Shopping only.' }),
};

export function policyFor(country: string | null | undefined): CountryPolicy {
  const c = (country || 'XX').toUpperCase();
  return COUNTRY_POLICIES[c] ?? make(c, c, { notes: 'No research for this country: shopping only until a legal review and partner are in place.', fundraising: 'disabled', crossBorderIn: false, crossBorderOut: false });
}

/**
 * Country of the request. On Vercel the edge sets x-vercel-ip-country and clients cannot override it.
 * Outside production a test header is honoured so the gates can be tested locally.
 */
export function requestCountry(req: Request): string {
  const h = req.headers;
  const prod = process.env.VERCEL_ENV === 'production';
  const v = (prod ? h.get('x-vercel-ip-country') : h.get('x-fc-test-country') || h.get('x-vercel-ip-country')) || '';
  return /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : 'XX';
}

export type Decision = { allowed: true } | { allowed: false; reason: string; messageKey: string };

export function canCreateCampaign(p: CountryPolicy, needCategory: string | null, productCategory: string | null, title: string): Decision {
  if (p.fundraising === 'disabled') return { allowed: false, reason: 'fundraising_disabled_in_country', messageKey: 'policy.noFundraising' };
  if (!needCategory || !(p.allowedNeedCategories as readonly string[]).includes(needCategory)) return { allowed: false, reason: 'need_category_not_allowed', messageKey: 'policy.needCategory' };
  const hay = `${productCategory || ''} ${title}`.toLowerCase();
  const hit = p.restrictedCampaignCategories.find(c => new RegExp(`\\b${c.replace(/\s+/g, '\\s+')}s?\\b`).test(hay));
  if (hit) return { allowed: false, reason: `restricted_category:${hit}`, messageKey: 'policy.restrictedCategory' };
  return { allowed: true };
}

/** Contribution permission: both the campaign's and the contributor's country must allow it. */
export function canContribute(campaignCountry: string | null, payerCountry: string): Decision {
  const camp = policyFor(campaignCountry);
  const payer = policyFor(payerCountry);
  if (payer.fundraising === 'disabled' && payer.country !== camp.country) return { allowed: false, reason: 'payer_country_disabled', messageKey: 'policy.payerBlocked' };
  if (camp.fundraising === 'disabled') return { allowed: false, reason: 'campaign_country_disabled', messageKey: 'policy.noFundraising' };
  const cross = (campaignCountry || 'XX') !== 'XX' && payerCountry !== 'XX' && campaignCountry !== payerCountry;
  if (cross && (!camp.crossBorderIn || !payer.crossBorderOut)) return { allowed: false, reason: 'cross_border_not_allowed', messageKey: 'policy.crossBorder' };
  return { allowed: true };
}

/** What the shopping assistant may offer (read-only for the AI). */
export function fundingOffer(p: CountryPolicy): { available: boolean; mode: FundraisingMode; realMoney: false } {
  return { available: p.fundraising !== 'disabled', mode: p.fundraising, realMoney: false };
}

/** Same as requestCountry, for server components that only have the request headers. */
export function countryFromHeaders(h: Headers): string {
  return requestCountry(new Request('http://local/', { headers: h }));
}
