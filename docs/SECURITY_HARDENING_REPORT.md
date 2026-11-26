# FundCart security hardening

## Changes

| Boundary | Implementation |
| --- | --- |
| Browser capture | Requires the signed identity associated with the payment order. The upstream order is never fetched for a different owner. |
| Purchase authorization | Both order routes record approval linked to the server-priced payment order. Pending purchase capture requires that record. Previously completed provider activity still reconciles. Old pending direct orders may need a fresh checkout. |
| Campaign capture | Rechecks current campaign state, deadline, moderation, ownership or contribution policy, and verified balance before initiating provider capture. Campaign quote outages prevent creating a purchase order. |
| Webhook reconciliation | Signature check precedes processing. A completed notification can reconcile an existing capture but cannot create one. Transient verification or persistence failures return a retryable response. |
| Contribution adjustments | Migration 006 serializes adjustments per contribution and commits event deduplication, amount, status and campaign update together. Wrong currency or amount cannot mutate the ledger. Terminal reversals cannot be reset by later partial refunds. |
| Assistant privacy and integrity | Identified sensitive turns skip stored conversation state, Gemini and the shared catalog cache. Channel3 still receives search terms. Listings with detected instruction-like text are excluded. Pick explanations use localized evaluation templates. |
| Moderation and outages | Redacts recognized PII in review notes, removes notes from structured security events, checks concurrent campaign updates, and fails closed on payment endpoints when shared rate limiting is unavailable. |

Source changes are in the assistant, PayPal and moderation routes, shopping pipeline, catalog client, payments and rate-limit modules. Vitest now discovers tests under `tests/security`. Migration 006 is additive and has not been applied to any hosted database.

## Critical residual risks

- Order creation and provider capture are separate operations. Two different PayPal orders can still pass the remaining-balance check simultaneously. A reservation with expiry and a supervised reconciliation queue are necessary before moving real money.
- Campaign rechecks narrow the authorization window. They do not bind price, variant, merchant, quantity and quote expiry to an immutable confirmation token. Direct checkout still uses the available catalog product lookup.
- Existing refund events that were acknowledged before a write failure cannot safely be repaired from event IDs alone. Compare provider and database records before any authorized correction. Historical events recorded without an order reference can only be deduplicated by their original event ID.
- No automated dispute settlement, licensed custody, identity provider, staff MFA, dual approval, live bot challenge, or production incident alerting is available. Local test cases do not establish full cross-instance timing or provider results.
- Sensitive-topic and PII recognition is pattern-based. Historical retention and deletion, browser-session history, provider policy and multilingual false negatives require review. Merchant ranking inputs still depend on catalog quality.

See [PayPal's refund resource and capture reference contract](https://developer.paypal.com/api/payments/v2/captures-refund).

## Endpoint authorization review

| Surface | Observed boundary | Open verification |
| --- | --- | --- |
| Assistant and wishlist | Signed visitor/account context; shopping session owner comparison; private turns cannot resume stored state | Cross-account session and wishlist staging fixtures |
| Account and creator dashboard | Identity from signed session. Account flows use Supabase and persistent user records | Expired-cookie, password recovery abuse and staff reauthentication |
| Campaign publication and draft | Account required for publication, deterministic eligibility, server-priced goal and moderated claim handling | Concurrent duplicate creation, review appeals and verified needs |
| Campaign detail, edit, report and management | Public campaign data and report restrictions; mutation and private ledger require owner or authorized role | Donor visibility review, ID swaps and failure handling in staging |
| Direct and campaign checkout | Server price and approval record. Campaign owner and goal checks. Capture owner and current campaign checks | Quote token, replay across different order IDs, independent recipient and variant binding |
| PayPal webhooks and receipts | Signature verified before processing. Atomic adjustment RPC requires the service role. Receipt visibility relies on scoped access | Provider authentication, replay scheduling and chargeback/receipt lifecycle verification |
| Moderation | Moderator role, conflict-of-interest check and compare-and-set campaign update | Two-person approval, short privileged sessions, durable audit and appeals |

A future bot-provider adapter should accept an opaque server-verified challenge token bound to the endpoint and a short validity period. Payment routes should require a successful check when that integration is enabled. A provider outage should hold new payment attempts and preserve verified webhook reconciliation. Bot verification remains unconfigured.
