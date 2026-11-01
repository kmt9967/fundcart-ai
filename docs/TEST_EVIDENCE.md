# Test evidence

All results below were produced by running the commands shown. Nothing here is hand-edited.

## Automated checks (2026-11-01)

| Check | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | ✅ clean |
| Lint | `npm run lint` | ✅ 0 problems |
| Unit tests | `npm test` | ✅ 16 / 16 (money math, intent parsing, untrusted-data normalization, ranking, budget) |
| E2E on localhost | `npx playwright test` | ✅ 5 / 5 |
| **E2E on production** | `E2E_BASE_URL=https://fundcart-ai.vercel.app npx playwright test` | ✅ **5 / 5 (1.4 min)** |

E2E specs:
- `smoke.spec.ts`:
  - All public pages return 200 with no page errors.
  - The assistant streams agent steps and shows real products.
  - Tampered payment requests are rejected: 404 for an unknown campaign, 400 for a malformed amount, 400 for a malformed order id, 404 for an unknown order, 401 for an unverified webhook.
  - No horizontal overflow at 390 px.
- `journey.spec.ts`: the full integrated journey with **real PayPal Sandbox payments** in two separate browser identities (creator and supporter).

## Real Sandbox transactions (verified with PayPal's own API)

Both captures were re-fetched from PayPal using `GET /v2/payments/captures/{id}` and the app's Sandbox credentials:

| Run | Payment | PayPal capture | Status | Amount | Received by (sandbox) |
|---|---|---|---|---|---|
| localhost | Contribution (supporter → campaign recipient) | `9D1088330R6882635` | COMPLETED | 350.00 USD | campaign recipient business account |
| localhost | Separate purchase (creator → demo store) | `8VY99001363273819` | COMPLETED | 550.00 USD | demo store business account |
| production | Contribution | `06M04038NB948573P` | COMPLETED (recorded in DB) | 350.00 USD | campaign recipient |
| production (Gemini on, 2026-11-01 01:43Z) | Contribution | capture `6KV001606B701045T` | COMPLETED | 59.00 USD | campaign recipient |
| production (Gemini on) | Separate purchase | order `49X6413676305223G` | COMPLETED | — | demo store |

Database state after the localhost journey:
- The campaign moved `active` → `goal_reached` → `purchased`.
- `contributions` has exactly one row (35000 cents, capture `9D1088330R6882635`).
- `payment_orders` has two COMPLETED orders with their capture ids.

Production run with Gemini on (`E2E_BASE_URL=https://fundcart-ai.vercel.app`, 5/5 passed):
- The assistant response carried `aiUsed: true`; the campaign draft carried `usedModel: true`.
- PayPal delivered `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED` webhooks. Each was verified with `verify-webhook-signature` and stored in `payment_events` (source `webhook`).
- The campaign `help-maya-get-her-cs-degree-laptop-dc6b1c` still holds exactly one contribution (5900 cents), so the webhooks and the browser capture did not double-count.

## Additional verification (2026-11-01, later run)

| Test | Result | Evidence |
|---|---|---|
| Gemini key rotation | The key that was exposed in a session log returns **HTTP 401 "API key not valid"** (revoked at Google); the replacement returns 200 | curl status codes only |
| Refund authority (`tests/e2e/refund.spec.ts`) | ✅ The platform credentials can **read** a recipient capture (200), but a refund attempt returns **403 `PERMISSION_DENIED`**. The platform cannot pull money back from a campaign recipient | capture `6T935709YP202380A` ($10.00 test contribution on `help-maya-get-a-inspiron-15-laptop-b86b31`) |
| Direct checkout (`tests/e2e/direct.spec.ts`, production) | ✅ Explicit approval → PayPal Sandbox → verified capture → receipt | capture `10Y594591W3828937` ($119.00 to the demo store), `docs/evidence/07-direct-receipt.png` |
| Demo-video recording run (production) | ✅ Full journey recorded: AI search → Gemini draft → $350.00 contribution → $550.00 purchase | campaign `help-maya-get-a-laptop-for-her-computer--e4b00d`, captures `08T70875YN521581B` (contribution) and `4KL93592RB651274B` (purchase) |

## Screenshots (`docs/evidence/`)

1. `01-assistant-results.png`: AI assistant with live Channel3 laptops, agent timeline and funding gaps.
2. `02-campaign-builder.png`: the builder with the server-computed goal (item price − money already saved) and the Gemini-drafted copy.
3. `03-contribution-verified.png`: the supporter's verified contribution with the PayPal order and capture ids.
4. `04-dashboard-goal-reached.png`: the creator dashboard (AG Grid ledger) with purchase approval unlocked.
5. `05-dashboard-history.png`: the audit history showing `order.captured`, `campaign.goal_reached` and the purchase.
6. `07-direct-receipt.png`: the receipt after a direct (no-campaign) Sandbox checkout.

## Not yet verified

- **Refund webhooks end to end.** The handler now applies partial and full refunds (`refunded_cents`, migration 003) and reopens a `goal_reached` campaign that drops below its goal. It has **not** been exercised with a real refund, because contributions are paid to the recipient sandbox account and only that account can issue a refund (see below). Doing so needs a PayPal developer-dashboard login to set the recipient account's sandbox password.
