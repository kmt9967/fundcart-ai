# Anti-fraud, anti-spam and bot defences

No system catches every fraud attempt. FundCart uses layered, deterministic defences so that a
single bypass does not move money or publish a misleading campaign, and records what happens so
people can review it. Everything below runs in PayPal Sandbox; no real money moves.

## Layers

| Layer | What it does | Where |
|---|---|---|
| Shared rate limits | Fixed-window counters in Postgres shared by every server instance; buckets are HMAC-hashed (no raw IP, email or user id stored). Falls back to per-instance limits if the database is unreachable | `lib/ratelimit.ts`, `rate_limit_hit()` |
| Assistant quotas | Per-IP per minute and per hour; per-visitor and global daily AI allowance; request size limit | `api/assistant` |
| Campaign velocity | Per IP (minute, day) and per creator (hour, day); at most three active campaigns per creator; repeated creation within 24 h adds risk | `api/campaigns` |
| Contribution velocity | Per IP and per user per campaign (10 minutes), per user per day, per IP per hour | `api/paypal/orders` |
| Minimum amount | $5 minimum contribution (small amounts are a common card-testing pattern), except to finish a campaign exactly | `lib/money.ts` |
| Honeypot fields | Hidden fields on campaign, contribution and report forms; filled ones are rejected and logged | forms + APIs |
| Duplicate-order reuse | The same person, campaign and amount within two minutes reuses the open PayPal order instead of creating another | `api/paypal/orders` |
| Idempotent capture | PayPal-Request-Id on capture; unique capture id and payment order id; repeated captures reconcile from PayPal's state | `lib/payments.ts` |
| Amount integrity | Captured amount and currency must equal the server-priced order, otherwise flagged | `lib/payments.ts` |
| Webhook replay defence | Signature verified via PayPal; events deduplicated by event id | `api/paypal/webhook` |
| Refund/reversal accuracy | Refunds and reversals reduce the verified total; a campaign drops back below goal and purchase locks again | `lib/payments.ts` |
| Decline-spike alert | Five or more failed captures platform-wide in ten minutes raise an alert event | `lib/payments.ts` |
| Campaign content scoring | PII scrub; contact or payment redirects (WhatsApp, wallets, crypto), links, spam patterns, shouting, unverifiable medical claims, charity/tax/guarantee claims, urgency pressure, luxury framing, child details, high amounts. False verification claims, abuse and injection text are refused outright | `lib/moderation.ts` |
| Duplicate detection | Same item already in an active campaign by the same creator is refused; copied stories (content fingerprint) from another creator are sent to review | `api/campaigns` |
| Moderation states | `auto_approved`, `pending_review`, `approved`, `rejected`, `hidden`; contributions and public listing only when allowed; kept separate from payment status | migration 005 |
| Public reports and auto-pause | One report per visitor per campaign; three open reports pause contributions until a moderator decides; supporters see a moderation update | `api/campaigns/[slug]/report` |
| Moderator queue | Server-side role check; conflict-of-interest rule; decisions logged | `admin/moderation` |
| Cheapest-adequate rule | Campaigns fund the cheapest item that met the requirements, or the creator pays the difference | `api/campaigns` |
| Itemised goal | Goal = price + shipping + tax + buffer − own funds, computed in integer cents and shown on the page | `lib/money.ts` `campaignGap` |
| Live price re-check | Before a campaign purchase the live price is fetched; a rise beyond the buffer pauses the purchase and posts an update | `api/paypal/orders` |
| Country gates | Fundraising and cross-border contributions only where the country policy allows | `lib/policy.ts` |
| Verification honesty | Every campaign is labelled "Not verified" because no verification provider is connected | campaign page |

## Privacy choices

No device fingerprinting and no third-party trackers. Abuse counters use one-way hashed buckets.
Report details and prompts are PII-redacted before storage.

## Residual risks

- Attackers with many IPs or accounts can stay under per-identity limits.
- No CAPTCHA or bot-challenge provider is configured.
- Moderation is rule-based plus a single moderator; no two-person approval.
- Campaign creators are not identity-verified, and need is not verified.
- In this prototype, contributions are paid to the creator's PayPal account; a production version
  would route funds through a licensed partner and pay the retailer directly.
