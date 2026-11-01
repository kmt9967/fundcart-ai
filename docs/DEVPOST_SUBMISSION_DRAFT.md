# Devpost submission draft — FundCart AI

Status: **saved as a DRAFT on Devpost** (submission 1268150, PayPal AI Hackathon). **Not submitted.** Final submission needs Talal's explicit approval.

## Project overview

- **Project name:** FundCart AI — Find What You Need. Fund What You Dream.
- **Elevator pitch (≤200 chars):** Describe what you need. AI agents find real products and your exact funding gap, your community closes it with PayPal, and you approve the final purchase. AI prepares; you decide.
- **Thumbnail:** `docs/evidence/devpost-thumbnail.png` (landing page, 3:2)

## Links

- **Live app:** https://fundcart-ai.vercel.app
- **Source (MIT):** https://github.com/kmt9967/fundcart-ai
- **Demo video (YouTube, public, 2:34):** https://youtu.be/K_xpS12dzB8

## Built with

PayPal Orders v2 API, PayPal JavaScript SDK (Smart Buttons), PayPal Webhooks, PayPal Sandbox, Google Gemini (Google AI Studio), Channel3 API, AG Grid Community, Next.js, React, TypeScript, Tailwind CSS, Supabase (PostgreSQL), Vercel, Zod, Playwright, Vitest

## About the project (story)

### Inspiration
People usually know roughly what they need ("a laptop for university"), but not which product fits their purpose and budget. When the right item costs more than they have, they ask friends and family for help with a vague message and a bank transfer, and nobody can see the goal or the progress. We wanted one honest flow from "I need something" to "I approve the purchase", where AI does the legwork and a human stays in control of every dollar.

### What it does
**Journey A: smart shopping.** You describe the need in plain words, plus the money you already have. A team of agents takes over:
- The **Intent Agent** (Gemini, JSON-schema output) extracts category, budget, purpose and must-haves.
- The **Research Agent** searches **Channel3's live product catalog**, filtered by price and availability.
- The **Comparison Agent** ranks the results with a transparent score, and Gemini explains the picks using only the retrieved product data.
- The **Budget Agent** computes each funding gap in integer cents.

You can compare products side by side, save them, or check out directly (human-approved PayPal Sandbox checkout).

**Journey B: fund together.** If the best option costs more than you have, choose *Fund this*.
- The server computes the goal from the live price snapshot. The AI never sets amounts.
- Gemini drafts an honest campaign: no charity claims, no invented urgency. The creator edits it and publishes.
- Supporters open the public page and pay with **PayPal (Sandbox)**.
- Progress counts **only captures that our server verified with PayPal**: status `COMPLETED`, amount and currency matched.
- When the goal is reached, the creator ticks an explicit approval and pays the store in a **separate** PayPal checkout. The agents never spend money on their own.

### How we built it
- **Next.js 16 (App Router) + React 19 + Tailwind 4**, deployed on **Vercel**. **Supabase Postgres** with RLS on every table and no public policies; only server code holding the secret key touches the data.
- **PayPal Orders v2:** server-side order creation with the amount computed on the server, `PayPal-Request-Id` idempotency, a per-order `payee`, and capture verification. The **JS SDK Smart Buttons** handle buyer approval.
- **Webhooks:** each event is verified with `verify-webhook-signature`, deduplicated by event ID (unique constraint), then reconciled against the Orders API. Contributions are unique per capture, so double clicks, refreshes and duplicate webhooks cannot double-count. Refunds and reversals reduce the verified total, including partial refunds.
- **AI:** Gemini through the Google AI Studio REST API, with JSON-schema constrained output and a model-fallback chain.
  - Third-party product text is sanitized and passed as untrusted data.
  - Product IDs the model returns are filtered against the real candidates.
  - Prices and totals never come from the model.
  - Every agent has a labelled rule-based fallback.
- **Agent timeline:** streamed to the browser as NDJSON and stored in an append-only `agent_events` table. `payment_events` is append-only too (a DB trigger forbids UPDATE and DELETE).
- **AG Grid Community** renders the creator's payment ledger.
- **Tests:**
  - 16 Vitest unit tests (money math, intent parsing, normalization, ranking).
  - Playwright end-to-end tests run against the live deployment and make **real PayPal Sandbox payments**: AI search → campaign → contribution → goal → separate purchase. They also check that tampered payment requests are rejected and that the platform cannot refund a recipient's capture.

### Challenges we ran into
- **PayPal buttons vanishing.** Typing an amount re-created the SDK options object, which made the PayPal script reload and destroy the buttons. Our end-to-end test caught it; memoizing the options fixed it.
- **Honest money flow.** Contributions go straight to the recipient's PayPal account, so the platform never holds funds and cannot pull them back. We verified this: a refund attempt with the platform credentials returns `PERMISSION_DENIED`. We designed the copy so it never claims escrow or charity status.
- **Keeping the AI out of the money.** Every amount is computed in integer cents on the server. The model only writes words, and its output is validated against real data.
- **Model availability.** `gemini-2.5-flash` was closed to new API keys, so we built a configurable fallback chain across Gemini models.

### Accomplishments that we're proud of
- A complete, working loop on the live site with real Sandbox money movement and verified webhooks, tested end to end by Playwright.
- A strict "AI prepares, human approves" design: the agents cannot pay for anything.
- Truthful status everywhere. Progress shows only PayPal-verified funds, and rule-based fallbacks are labelled.

### What we learned
- PayPal's verify-then-record pattern (capture, check status, amount and currency, then insert idempotently) makes a payment ledger robust against retries and duplicate events.
- Grounding the LLM in retrieved product data, and keeping arithmetic out of it, gives explanations people can trust.

### What's next for FundCart AI
- Onboard each creator's own PayPal account (PayPal partner onboarding) instead of the single sandbox recipient used in this demo.
- Full user accounts, campaign moderation and global rate limiting.
- Price-change alerts that keep the goal in sync with the retailer.

## Honest status / limitations (also in the README)

- **Sandbox only:** no real money moves and no real product is bought. FundCart is not a charity, bank or escrow service, and is not affiliated with PayPal.
- **Single recipient:** one sandbox business account stands in for every campaign creator; the purchase goes to one sandbox "store" account.
- **Refunds:** the code applies partial and full refunds reported by PayPal webhooks, but an end-to-end refund webhook has **not** been exercised. Only the recipient can issue a refund, and that needs the recipient sandbox account's dashboard access.
- **Identity:** guest identity is per browser (an HMAC-signed cookie).

## Sponsor tools (only those genuinely used)

- **Channel3:** live product search and detail lookups (core of Journey A).
- **AG Grid Community:** the creator's payment ledger grid.
- Not used, and not claimed: Render, KERNEL, APIMatic, Elastic, Astropods, Bryntum, Postman, Zapier.

## Team

- Talal Khawaja (solo). Aqeela Urooj's participation in this hackathon is **unverified**, so she is not listed.
