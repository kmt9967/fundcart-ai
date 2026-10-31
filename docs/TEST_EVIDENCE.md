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

Database state after the localhost journey:
- The campaign moved `active` → `goal_reached` → `purchased`.
- `contributions` has exactly one row (35000 cents, capture `9D1088330R6882635`).
- `payment_orders` has two COMPLETED orders with their capture ids.

## Screenshots (`docs/evidence/`)

1. `01-assistant-results.png`: AI assistant with live Channel3 laptops, agent timeline and funding gaps.
2. `02-campaign-builder.png`: the builder with the server-computed goal ($550.00 − $200.00 = $350.00).
3. `03-contribution-verified.png`: the supporter's verified contribution with the PayPal order and capture ids.
4. `04-dashboard-goal-reached.png`: the creator dashboard (AG Grid ledger) with purchase approval unlocked.
5. `05-dashboard-history.png`: the audit history showing `order.captured`, `campaign.goal_reached` and the purchase.

## Not yet verified

- **Webhook deliveries.** A webhook is registered for the production URL, but no Sandbox webhook events had been delivered when last checked.
- **Gemini-powered paths.** No API key yet; the runs above used the labelled rule-based fallbacks.
- **Refund handling.** The code path exists but has not been exercised.
