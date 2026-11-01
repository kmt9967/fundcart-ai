# FundCart AI — Find what you need. Fund what you dream.

**FundCart AI is where smart shopping meets community support.** Describe what you need in your own words. FundCart's AI finds real products that fit your purpose and budget and shows exactly how far your money goes. If the right item costs more than you have, FundCart turns the gap into a campaign your friends and family can support through **PayPal**. When the goal is reached, you approve the purchase yourself.

Built for the **PayPal AI Hackathon 2026**.

- **Try it:** https://fundcart-ai.vercel.app
- **Demo video (2:17):** https://youtu.be/u3avKfEDRxQ

> **Sandbox demo.** Every payment uses the PayPal Sandbox. No real money moves and no real product is bought. FundCart AI is not a charity, bank or escrow service, and it is not affiliated with PayPal.

## The problem

People often know *roughly* what they need ("a laptop for university"), but not which product fits their purpose and budget. When the right item costs more than they have, asking for help usually means a vague message and a bank transfer, with no clear goal and no visible progress.

## How it works

Meet Maya. She needs a laptop for university, wants to spend under $700, and has $200 saved.

1. **She asks in plain words.** FundCart's AI understands her purpose and budget and searches a live product catalog.
2. **She compares real options.** Every result has a live price and retailer, an AI explanation of why it fits, and the exact funding gap. The top pick is a $550 laptop, which leaves a $350 gap.
3. **She clicks "Fund this".** The campaign goal comes from the live price. The AI drafts an honest campaign story, Maya edits it, and she publishes a shareable link.
4. **Supporters contribute through PayPal.** Progress moves only when PayPal confirms a payment for the exact amount.
5. **She approves the purchase.** Once the goal is reached, Maya ticks an explicit approval and pays the store in a **separate** PayPal checkout. Nothing is ever bought automatically.

Shoppers who can already afford an item can also check out directly, with the same explicit approval.

## Features

| | |
|---|---|
| **AI shopping assistant** | Plain-language requests, live product search within budget, ranked recommendations with grounded explanations, side-by-side comparison, wishlist |
| **Budget planning** | Exact funding gap for every product, calculated on the server |
| **AI-assisted campaigns** | Honest campaign story, thank-you note and progress updates drafted by AI; the creator edits before publishing |
| **PayPal contributions** | PayPal Checkout for supporters; progress counts only PayPal-confirmed payments; overfunding is rejected |
| **Creator dashboard** | Every PayPal payment with its status and reference, plus an audit history |
| **Human-approved purchase** | A separate PayPal checkout that the creator explicitly approves |

## AI agents

FundCart's assistant is a team of cooperating agents powered by **Google Gemini**:

- **Intent Agent:** turns a request into a shopping brief (category, purpose, budget, money already saved, must-haves).
- **Research Agent:** searches **Channel3's** live catalog within the budget, and widens the search when too few products fit.
- **Comparison Agent:** ranks products with a transparent score, then explains them using only the retrieved product data.
- **Budget Agent:** calculates funding gaps with exact integer-cent arithmetic.
- **Campaign Assistant:** drafts campaign copy from verified numbers only, with no charity claims and no invented urgency.
- **Payment Agent:** prepares the checkout summary. It **cannot** pay: payment requires explicit confirmation plus approval inside PayPal.

The AI never sets prices or totals. Third-party product text is treated as untrusted data. If the AI service is unavailable, the app uses clearly labelled rule-based logic.

## PayPal integration (Sandbox)

- **Orders API:** the server creates every order with an amount it calculates itself (the browser cannot change it), using an idempotency key.
- **JavaScript SDK (Smart Buttons):** buyers approve each payment inside PayPal. The server then captures the payment and confirms it with PayPal: status completed, exact amount, correct currency.
- **Webhooks:** PayPal's payment notifications are signature-verified, deduplicated and matched to their orders. A payment is never counted twice. Refunds and reversals reduce the campaign total, including partial refunds.
- **Separation of money flows:** contributions go to the campaign recipient; the purchase is a separate checkout to the store.

## Architecture

```
Browser (Next.js 16 App Router, React 19, Tailwind 4)
  │  live stream of agent steps
  ▼
Server route handlers ─────────────────────► Google Gemini       — understanding, explanations, campaign copy
  │   ├─ Agent orchestrator ───────────────► Channel3 API        — real products & live prices
  │   ├─ Money module (integer cents)
  │   ├─ PayPal module ────────────────────► PayPal Orders API   — create / capture / confirm
  │   └─ Webhook handler (verified) ◄──────── PayPal webhooks
  ▼
Supabase Postgres (row-level security on; server-only access)
```

More detail: [Architecture](docs/ARCHITECTURE.md) · [AI agents](docs/AI_AGENTS.md) · [PayPal integration](docs/PAYPAL_INTEGRATION.md) · [Sponsor integrations](docs/SPONSOR_INTEGRATIONS.md) · [Deployment](docs/DEPLOYMENT.md) · [Demo script](docs/DEMO_SCRIPT.md) · [Test evidence](docs/TEST_EVIDENCE.md)

## Built with

PayPal Orders API · PayPal JavaScript SDK · PayPal Webhooks · Google Gemini · Channel3 · AG Grid Community · Next.js · React · TypeScript · Tailwind CSS · Supabase (PostgreSQL) · Vercel

**Sponsor tools used:** **Channel3** (live product search) and **AG Grid Community** (the creator's payment ledger).

## Security

- All secrets stay on the server; the browser only receives the public PayPal client ID.
- The database uses row-level security with no public policies, and only server code can access it.
- Amounts and goals are calculated on the server; the client cannot set them.
- Campaign management and purchase approval are bound to a signed guest identity cookie.
- Sensitive endpoints are rate-limited.

## Limitations

- **Sandbox only:** no real money moves and no real products are purchased.
- **Not escrow or charity:** FundCart AI does not hold funds and is not a charity or bank.
- **Single recipient:** one authorized Sandbox account currently receives contributions on behalf of every campaign creator. A production version would let each creator connect their own PayPal account.
- **Refunds:** only the recipient can issue a refund. FundCart's handling of refund notifications is built but has not yet been exercised with a recipient-issued refund.
- Guest identity is per browser (no full accounts yet), and rate limiting is per server instance.
- Prices come from live retailer data and may change.

## What's next

Creator-owned PayPal accounts, full user accounts and campaign moderation, and retailer price alerts that keep goals in sync with live prices.

## Run locally

Requirements: Node.js 20+, a PayPal Developer account (Sandbox), a Channel3 API key and a Supabase project. A Gemini key is optional. Full setup: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

```bash
git clone https://github.com/kmt9967/fundcart-ai && cd fundcart-ai
npm install
cp .env.example .env.local      # fill in the values
npm run db:migrate              # applies db/migrations/*.sql
npm run dev                     # http://localhost:3000
```

Checks:

```bash
npm run typecheck && npm run lint
npm test             # unit tests
npm run test:e2e     # browser flows using PayPal Sandbox test accounts
```

## License

MIT, see [LICENSE](LICENSE).
