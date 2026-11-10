# Country policy engine

`src/lib/policy.ts` holds a versioned country configuration (`POLICY_VERSION`). The server reads it
for every campaign creation, contribution and assistant turn. The AI can see the decisions but can
never change them.

> **A feature flag is not legal compliance.** Every entry is marked `legalReview: 'unverified'`.
> No entry is a legal opinion, and switching a country on does not make any activity lawful there.
> A real-money launch in any country needs a qualified local lawyer's sign-off, a licensed partner
> charity or platform, and a licensed payment provider.

## What exists

- **Real-money fundraising is disabled everywhere** (`realMoneyFundraising: false`). The prototype
  has no licensed partner, no regulated escrow and no payout arrangement.
- **`sandbox_demo`** allows PayPal Sandbox simulations only, clearly labelled as such, so the product
  can be demonstrated. No real money moves and no real item is bought.
- **Shopping** is available everywhere.

Each entry configures: currency, shopping, fundraising mode, cross-border contributions in and out,
allowed need categories, restricted campaign categories, payment providers (PayPal Sandbox only),
required disclosures, verification requirement, admin-review requirement, minimum contribution,
maximum campaign amount, helpline and notes.

## Countries

| Code | Country | Fundraising | Cross-border in | Notes |
|---|---|---|---|---|
| XX | Unknown location | Sandbox demo | yes | No geo header (e.g. local development) |
| US | United States | Sandbox demo | yes | Real money would need state charitable-solicitation registration or a platform charity, and a licensed provider |
| GB | United Kingdom | Sandbox demo | yes | Fundraising Regulator code; FCA-authorised provider if the platform handles money |
| CA | Canada | Sandbox demo | yes | Not researched in detail |
| AU | Australia | Sandbox demo | yes | Through a registered partner charity |
| DE, FR, ES | EU members | Sandbox demo | yes | Authorised payment provider; GDPR-grade consent for need data |
| PK | Pakistan | Sandbox demo | **no** | Domestic contributions only in the demo |
| IN | India | Sandbox demo | **no** | Domestic contributions only in the demo |
| KE | Kenya | Sandbox demo, every campaign reviewed | yes | Public Collections Act still applies |
| AE | United Arab Emirates | **Disabled** | no | Shopping only |
| SA | Saudi Arabia | **Disabled** | no | Shopping only |
| CN | China | **Disabled** | no | Shopping only |
| ID | Indonesia | **Disabled** | no | Shopping only |
| any other | — | **Disabled** | no | Shopping only until legal review and a partner exist |

Restricted campaign categories everywhere: weapons, tobacco, alcohol, vapes, gift cards,
cryptocurrency, jewellery, luxury watches, designer handbags.

Allowed need categories: education, work and livelihood, health and mobility, disability and
access, home essentials, family and children.

## Enforcement points

| Decision | Function | Enforced in |
|---|---|---|
| Request country | `requestCountry()` — production trusts only the hosting edge's geo header; outside production a test header can exercise the gates | all routes |
| Offer funding in the assistant | `fundingOffer()` | `api/assistant` (the funding button is hidden when unavailable) |
| Create a campaign | `canCreateCampaign()` — fundraising mode, need category, restricted categories | `api/campaigns` (403 where disabled) and the builder page |
| Contribute | `canContribute()` — both countries' rules, including cross-border | `api/paypal/orders` (403) and the campaign page |
| Disclosures | `requiredDisclosures` | builder and contribution form |

Campaigns and payment orders record the country and policy version for audit. Campaigns created
before the policy engine have no country and remain supportable as Sandbox demos. Interface language
never affects a decision: the functions take no locale.

## Source check of the research claims

The team's research made country-level legal claims. A desk check against current sources
(government agencies, regulators, official news agencies, mainstream press and law-firm
publications) found:

- **Confirmed:** Saudi Arabia (licensed entities and approved channels; foreign donations need
  committee approval), China (online appeals and individual help-seeking only on designated
  platforms), Indonesia (permit held by a legal entity, about three months, extendable once), USA
  (about 40 states require registration; California registers online platforms), Kenya (the 2024
  bill did not pass; the Public Collections Act applies).
- **Partly confirmed:** UAE (permit or authorised entity required; the reported fine for an
  individual is up to AED 300,000 plus possible imprisonment, with higher bands for aggravated
  offences), India (FCRA governs organisations; individuals may receive limited amounts from
  relatives abroad), Pakistan (provincial charity registration confirmed; foreign-funding clearance
  sits mainly with federal ministries; the often-cited regulator warning is from 2017 and concerned
  one scheme), UK (the fundraising code covers platform fee transparency; payment regulation depends
  on whether the platform handles money), EU (donation crowdfunding is outside the crowdfunding
  regulation; the payment-provider point is a general principle), Australia (deemed licences for
  registered charities are spreading in 2025–26 but are not uniform), PayPal (pre-approval applies to
  collecting donations as a charity and to payment facilitators; third-party sources report that
  PayPal does not support receiving payments in Pakistan).
- **Not confirmed / contradicted:** none outright.

This check is not legal advice. The configuration above is deliberately more conservative than the
research where the sources were uncertain.
