# FundCart AI — Find what you need. Fund what you dream.

FundCart AI is an agentic shopping and community-funding app built for the **PayPal AI Hackathon 2026**.

You describe what you need in plain words. A team of AI agents searches a **live product catalog (Channel3)**, compares options, and works out your budget with exact arithmetic. If you can't afford the best option, FundCart turns the **funding gap** into a campaign your community can support with **PayPal (Sandbox)** payments. When verified contributions reach the goal, you **explicitly approve** a separate PayPal checkout. The AI researches and prepares. Only you approve payments.

> **Sandbox demo.** Every payment uses the PayPal Sandbox. No real money moves and no real product is bought. FundCart is not a charity, a bank or an escrow service, and it is not affiliated with PayPal.

- **Live demo:** _added after deployment_
- **Demo video:** _added after upload_

## The problem

People often know *roughly* what they need ("a laptop for university"), but not which product fits their purpose and budget. When the right item costs more than they have, the gap is real. Asking friends and family for help usually means a vague message and a bank transfer, with no transparency about the goal or the progress.

## What FundCart does

| Journey | What happens |
|---|---|
| **A — Smart shopping** | Plain-language request → intent extraction → live Channel3 search filtered by budget → transparent ranking → grounded AI explanations → side-by-side comparison → wishlist → human-approved PayPal Sandbox checkout |
| **B — Fund together** | Pick a product → the exact funding gap is computed in cents on the server → the AI drafts an honest campaign (you edit) → public campaign page → supporters pay with PayPal Sandbox → progress counts **only PayPal-verified captures** → goal reached → creator approves a **separate** purchase checkout |

## Architecture

```
Browser (Next.js 16 App Router, React 19, Tailwind 4)
  │  NDJSON stream of agent events
  ▼
Route handlers (server only) ───────────────► Gemini (Google AI Studio)  — intent + explanations + copy
  │   ├─ Agent orchestrator ────────────────► Channel3 /v1/search        — real products & prices
  │   ├─ Money module (integer cents)
  │   ├─ PayPal module ─────────────────────► PayPal Orders v2 (Sandbox) — create / capture / verify
  │   └─ Webhook handler (verified, deduped) ◄─ PayPal webhooks
  ▼
Supabase Postgres (RLS on, no public policies; accessed only with the server secret key)
```

Details are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/AI_AGENTS.md`](docs/AI_AGENTS.md) and [`docs/PAYPAL_INTEGRATION.md`](docs/PAYPAL_INTEGRATION.md).

### AI agents (one orchestrated app, not separate services)

- **Intent Agent:** extracts category, purpose, budget, own funds, must-haves and brands. It uses JSON-schema constrained Gemini output, with a rule-based fallback.
- **Research Agent:** calls Channel3 with a price filter, widens the search if too few products fit, and caches results for 6 h to conserve credits.
- **Comparison Agent:** ranks products with a deterministic score, then writes grounded explanations using only the retrieved fields. Product text is wrapped as untrusted data, and the output is validated against the real product IDs.
- **Budget Agent:** computes funding gaps with integer-cent arithmetic. The LLM never sets prices or totals.
- **Campaign Assistant:** drafts the story, thank-you note and progress updates from verified numbers only.
- **Payment Agent:** prepares the checkout summary. It **cannot** pay; payment requires a checkbox confirmation plus approval inside PayPal.

### PayPal integration (Sandbox)

- The server creates every order (Orders v2, `intent: CAPTURE`) with a server-computed amount, using `PayPal-Request-Id` for idempotency.
- The buyer approves in PayPal (JS SDK Smart Buttons). The server then captures and **verifies** the capture: the status must be `COMPLETED`, and the amount and currency must match.
- Contributions are inserted once per capture (unique `payment_order_id` and `capture_id`). Double clicks, refreshes and duplicate webhooks cannot double-count.
- Webhooks are verified with `verify-webhook-signature`, deduplicated by event ID, and reconciled against the Orders API. Refunds and reversals reduce the verified total.
- `payment_events` and `agent_events` are append-only (a DB trigger forbids UPDATE and DELETE).

## Sponsor tools actually used

See [`docs/SPONSOR_INTEGRATIONS.md`](docs/SPONSOR_INTEGRATIONS.md) for the honest classification.

- **Channel3:** live product search and product-detail lookups.
- **AG Grid Community:** the payment ledger in the creator dashboard.

## Run locally

Requirements: Node.js 20+, a PayPal Developer account (Sandbox), a Channel3 API key, a Supabase project. A Gemini key is optional.

```bash
git clone https://github.com/kmt9967/fundcart-ai && cd fundcart-ai
npm install
cp .env.example .env.local      # fill in the values
npm run db:migrate              # applies db/migrations/*.sql
npm run dev                     # http://localhost:3000
```

## Tests

```bash
npm run typecheck && npm run lint
npm test            # unit tests: money math, intent parsing, untrusted-data normalization, ranking
npm run test:e2e    # Playwright browser flows (see docs/TEST_EVIDENCE.md)
```

## Security notes

- All secrets are server-side (`.env.local`, never committed). The browser only gets the public PayPal client ID.
- The database uses RLS with no public policies and is accessed only by server code holding the secret key.
- Amounts are validated and priced on the server. The client cannot set a campaign goal or a payment amount.
- Campaign management and purchase approval are bound to a signed (HMAC) guest identity cookie.
- Product data from third parties is sanitized and treated as untrusted input to the model.
- Sensitive endpoints are rate-limited (in-memory per instance; see limitations).

## Limitations

- **Single sandbox recipient model.** Contributions go to one sandbox account that stands in for the campaign creator, and the purchase goes to a sandbox "store" account. A production version would onboard each creator's own PayPal account.
- Guest identity is per browser (no full accounts).
- The rate limiting is per server instance, not global.
- Prices come from Channel3 and may change at the retailer.

## License

MIT, see [LICENSE](LICENSE).
