# Adversarial test results

## Local execution

- `npm test` passed 311 tests. Two external or opt-in tests were skipped.
- `npm run typecheck` and `npm run build` passed. ESLint reported one existing unused import warning.
- `npm audit --omit=dev` reported zero vulnerabilities.
- No production target, hosted database migration or live transaction was used. The new PostgreSQL suite applies migrations 001–006 in a local PGlite instance.

| Group | Scenario and fixture | Expected and observed outcome | Evidence boundary |
| --- | --- | --- | --- |
| A. Direct injection | WC-001, WC-002, WC-085, rule and eligibility fixtures | Existing checks reject price, authority and verification claims | `tests/unit/security.test.ts` and `eligibility.test.ts`. Model red team pending |
| B. Catalog manipulation | WC-003, mixed ordinary and flagged catalog results | Flagged offer absent from picks and funding ladder | `tests/unit/shopping.test.ts`; mocked catalog |
| C. Hallucinations | WC-008 and WC-009, missing specs and price fixtures | Unknown data stays unknown; templates use evaluation | Shopping unit suite; independent merchant verification pending |
| D. Memory | WC-096, preferences and authorization review | Privileges are outside shopping state | Existing journey and security suites; full multi-turn abuse coverage pending |
| E. Object access | WC-100, different caller and order owner | Unknown order returned before provider lookup | `tests/security/capture-authorization.test.ts`; other protected endpoints need staged coverage |
| F. Payment integrity | WC-015, approved provider order without linked approval | Provider capture was never called | Capture authorization suite; quote expiry and concurrent-order tests open |
| G. Webhook retry | WC-125, WC-126, WC-134, capture read and persistence failure fixtures | Unverified event rejected; transient failure is retryable; duplicate refund does not change balance | `tests/security/paypal-webhook.test.ts` and `contribution-adjustments.test.ts` |
| H. Refunds and reversals | WC-125–129, partial, full, repeated and late adjustments, failed audit insert | Event and ledger rolled back together. Late refund could not reopen a reversal | Embedded PostgreSQL; concurrent separate connections and PayPal delivery remain open |
| I. Fraud | WC-059, WC-062, WC-084, unsupported claims and premium items | Existing rules route risky claims for review | Eligibility and security suites; identity evidence and linked-account detection remain open |
| J. Moderation | WC-103, function grant fixture | Anonymous role blocked and service role can call the adjustment function | Database privileges verified for the RPC; full moderator journey and concurrent reviews need staging |
| K. Privacy | WC-040 and WC-115, identified sensitive shopping turn | No stored session or Gemini call, and shared catalog cache was bypassed | `tests/security/assistant-privacy.test.ts` and shopping suite |
| L. Country policy | WC-053 and WC-092, backend policy test matrix | Restricted locations and contribution directions obey current Sandbox configuration | `tests/unit/policy.test.ts`; no legal or provider approval inferred |
| M. Vulnerable shoppers | WC-025–033, safety flags and spending pressure | Existing routed behavior passes fixture cases | Security suite; accessibility and broader safety review remain open |
| N. Compatibility | WC-048, model reply after missing fit | Prior fixture confirms title alone cannot establish fit | Shopping suite and provider gaps in the 29-intent audit |
| O. Merchant failure | WC-072–082 | App blocks certain stale and unavailable campaign purchases | Code reviewed. True stock, fulfillment and merchant quote acceptance pending |
| P. Outages | WC-143, unavailable shared quota response | Fallback reports degraded status; payment checks can fail closed | `tests/security/rate-limit-outage.test.ts`; provider and distributed recovery not run |
| Q. Languages | WC-041, WC-043 and WC-045 | Existing language, redaction and money fixtures passed | Unit suite; review locale-specific fraud and sensitive-shopping false negatives |
| R. Accessible UX | WC-034 and WC-048 | Prior PR browser evidence covers desktop and Urdu mobile assistant UI | Prior baseline evidence only. No new full payment or moderation accessibility run |

An initial run failed because the quota fixture omitted the shared-rate-limit result. The assistant now supplies an explicit fail-closed Boolean, and the test fixture matches the rate limiter's contract. The first database test also distinguishes migration execution from live deployment. No test credentials or provider traffic are required.
