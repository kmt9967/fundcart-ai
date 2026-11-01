# Execution plan

Deadline: **Thu Nov 12, 2026, 12:00 PM PT**. Planning and build started on 2026-11-01.

## Decisions

| Area | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 | One deployable app; server route handlers keep the secrets server-side |
| Hosting | Vercel Hobby (free) | Reliable, no cold starts, Git integration |
| Database | Supabase Postgres, free plan (new project) | Free; RLS with no public policies; daily cron keepalive |
| AI | Gemini via Google AI Studio free tier, JSON-schema output | Zero cost, server-side key; deterministic fallbacks when unavailable |
| Products | Channel3 `/v1/search` + `/v1/products/{id}` | Real catalog, verified credits, sponsor prize |
| Payments | PayPal Orders v2 REST (server) + JS SDK Smart Buttons (client), Sandbox | Official APIs; server-side capture and verification |
| Grid | AG Grid Community (MIT) | Payment ledger in the creator dashboard; genuine use, free |
| Auth | Signed guest cookie (HMAC) | Judges can use the app instantly; ownership still enforced |

## Money model (truthful)

- **Contribution:** a Sandbox order paid to the account representing the campaign creator (`PAYPAL_CONTRIBUTION_PAYEE_EMAIL`, set via the Orders v2 `payee` field).
- **Purchase:** a **separate** Sandbox order paid to the account representing the store (`PAYPAL_STORE_PAYEE_EMAIL`). The creator approves it after the verified goal is met.
- FundCart never holds or transfers funds. No escrow and no split payouts.

## Milestones

1. ✅ Rules audit and account audit; credentials stored in `.env.local` without displaying them.
2. ✅ Schema, money module, Channel3 client, PayPal client, agent orchestrator, all API routes.
3. ✅ UI: landing, assistant, comparison, wishlist, campaign builder, public campaign, contribution, creator dashboard (AG Grid), purchase approval, direct checkout, receipts, profile, how-it-works, disclosures.
4. ✅ Unit tests; public GitHub repo (MIT).
5. ⏳ Vercel deployment (blocked on 2FA re-auth by Talal).
6. ⏳ Gemini key (blocked on Talal accepting the AI Studio terms).
7. ✅ Sandbox recipient and buyer accounts and the webhook (deliveries verified in production).
8. Browser end-to-end with real Sandbox payments (Playwright), on localhost and then on the deployed URL.
9. Docs, screenshots, demo video (LockSmith pipeline), YouTube upload.
10. Devpost draft (saved, **not submitted**).
