# Architecture

```
src/
  app/
    page.tsx                     landing
    assistant/                   AI shopping assistant (streams agent timeline)
    campaigns/, campaigns/new/   campaign list and AI-assisted builder
    c/[slug]/                    public campaign + PayPal contribution
    c/[slug]/manage/             creator dashboard: AG Grid ledger, audit log, AI updates, purchase approval
    checkout/[externalId]/       direct human-approved sandbox checkout
    receipt/[orderId]/           receipt + event history (payer/owner only)
    me/, how-it-works/, disclosures/
    api/
      assistant/                 POST → NDJSON agent events + result
      campaigns/, campaigns/draft/, campaigns/[slug]/
      paypal/orders/, paypal/orders/[orderId]/capture/, paypal/webhook/
      wishlist/, cron/keepalive/
  lib/
    money.ts      integer-cent arithmetic (shared client/server)
    channel3.ts   search, normalize (untrusted data), cache, snapshots
    paypal.ts     OAuth token cache, Orders v2, refunds, webhook verification
    payments.ts   capture-and-record state machine, idempotency, goal detection
    ai/llm.ts     Gemini REST with JSON schema
    ai/agents.ts  agent team
    identity.ts   HMAC-signed guest cookie
    db.ts         server-only Supabase client (secret key)
db/migrations/    SQL schema (RLS on, no public policies, append-only triggers)
tests/unit, tests/e2e
```

## Data model

`profiles`, `product_snapshots`, `search_cache`, `ai_sessions`, `agent_events` (append-only), `wishlist_items`, `campaigns`, `campaign_updates`, `payment_orders`, `contributions` (verified only), `payment_events` (append-only), `purchase_approvals`, view `campaign_totals` (sums COMPLETED contributions only).

## Trust boundaries

- Browser → server: all inputs are Zod-validated; amounts are integer cents; prices and goals are recomputed server-side.
- Server → Channel3, Gemini and PayPal: keys stay server-side only.
- Server → DB: secret key. RLS denies everything to anon and authenticated roles.
- PayPal → server (webhooks): signature verified by the PayPal API; deduplicated.
