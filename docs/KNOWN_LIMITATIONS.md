# Known limitations and production blockers

FundCart is a hackathon prototype. The items below are not implemented, are implemented only as a
safe disabled state, or depend on external approvals, credentials or licensed providers.

## Payments and funding

- **PayPal Sandbox only.** No live payments. All payments are simulations.
- **No licensed partner, escrow or payout arrangement.** Real-money fundraising is disabled in every
  country. In the prototype, contributions go to the creator's Sandbox PayPal account; production
  would need a licensed partner charity or platform and direct payment to the retailer.
- **Refunds of contributions** are limited by the single-recipient payment model: the platform
  cannot refund captures made to a recipient's account. Refund webhooks are handled, but an end-to-end
  refund from the platform was not possible in this model.
- **Pakistan**: third-party sources report that PayPal does not support receiving payments in
  Pakistan; any real deployment there would need a different provider.
- **Shipping and tax** are not provided by the catalog data; they are shown as $0 "not listed" in the
  goal formula.
- **Delivery confirmation** (OTP/photo) does not exist; FundCart never claims an item was delivered.

## Trust and verification

- **No identity or need-verification provider.** Every campaign is labelled "Not verified". The
  `verifications` table holds references only; no documents are collected or passed to the AI.
- **Moderation** is rule-based scoring plus a single moderator. Two-person approval and
  phishing-resistant MFA for moderators are not implemented. Moderator roles are granted manually in
  the database.
- **Bot challenge** (CAPTCHA / Turnstile / BotID) is not configured; it needs provider keys.
  Honeypots and rate limits are in place instead.
- **No external penetration test or AI red-team** has been performed.

## Accounts and email

- **Email confirmation** requires a working email sender configured in Supabase (custom SMTP).
  Until then, sign-up creates accounts whose email is recorded as **not verified**, and the
  interface says so. The provider-confirmed sign-up path exists and is switched on by configuration.
- **Password-reset emails** may not arrive until custom SMTP is configured; the interface says this.
- **Supporter receipt emails** need an email provider key and sender (for example Resend). Without
  them the email field is hidden and no email is claimed as sent.

## Shopping data the catalog does not provide

- Image and voice understanding (text only; links are never opened).
- Order history, reorders and reminders.
- Delivery dates, local stock, store pickup, cash on delivery, international shipping.
- Coupons, verified discounts and price history (only retailer-listed was/now prices).
- Sales velocity and trends (rating counts are used as a stated proxy).
- Verified certifications (halal, vegan, eco, origin) and reliable allergen data.
- Product kits list essentials and search the main item; full multi-item kit budgeting is not built.

## Languages

- Urdu, Spanish and French translations are machine-assisted and need native-speaker review.

## Country policy

- Country entries are not legal opinions. Each needs local legal review before any real-money use.
- Country is taken from the hosting provider's geo header; VPNs can change it.

## Operations

- The trust, policy and moderation features use database tables and columns added by migration
  `005`; the migration must be applied before this version is deployed.
- Free-tier AI quota is limited per day; beyond the allowance the assistant runs in rule-based mode.
