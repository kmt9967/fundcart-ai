# Deployment

FundCart AI runs on free tiers only: **Vercel Hobby** (app), **Supabase Free** (Postgres), **PayPal Sandbox**, **Channel3** free credits and the **Google AI Studio** free tier (Gemini).

- **Production:** https://fundcart-ai.vercel.app
- **Repository:** https://github.com/kmt9967/fundcart-ai (MIT)
- Every push to `main` is built and deployed by Vercel automatically.

## 1. Accounts you need

| Service | Plan | Used for |
|---|---|---|
| PayPal Developer | Sandbox (free) | REST app (client ID + secret), sandbox business and personal accounts, webhook |
| Supabase | Free | Postgres database |
| Channel3 | Free credits | Live product search |
| Google AI Studio | Free tier | Gemini API key (optional; the app falls back to labelled rule-based logic without it) |
| Vercel | Hobby | Hosting, cron |

## 2. PayPal Sandbox setup

1. In the PayPal Developer Dashboard (Sandbox), create a REST app. Copy the **client ID** and **secret**.
2. Create sandbox accounts:
   - a **business** account that receives contributions (`PAYPAL_CONTRIBUTION_PAYEE_EMAIL`), standing in for the campaign creator;
   - a **business** account for the demo store (`PAYPAL_STORE_PAYEE_EMAIL`), which receives the separate purchase;
   - one or two **personal** buyer accounts for testing (supporter, creator-as-buyer).
3. Deploy once (step 4), then register a webhook for `https://<your-domain>/api/paypal/webhook` with these events: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`. Put its ID in `PAYPAL_WEBHOOK_ID`.

The server refuses to start payments unless `PAYPAL_ENV=sandbox`.

## 3. Database

1. Create a Supabase project. Copy the project URL, the **secret** key (server only) and the database password.
2. Locally, fill `.env.local` (see `.env.example`) and run:

   ```bash
   npm install
   npm run db:migrate   # applies db/migrations/001..003 through the Supabase session pooler
   ```

   Migrations are tracked in a `_migrations` table, so re-running is safe.
3. RLS is enabled on every table with no public policies. Only server code holding the secret key can read or write.

## 4. Vercel

1. Import the GitHub repository in Vercel (framework preset: Next.js; no build overrides needed).
2. Add the environment variables below for **Production**. Vercel's "Import .env" button accepts a file, which avoids pasting secrets into chat or the terminal. Use a gitignored file and delete it afterwards.
3. Deploy. Changes to environment variables apply only to **new** deployments, so redeploy after editing them.

| Variable | Notes |
|---|---|
| `PAYPAL_ENV` | `sandbox` (required) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | REST app credentials (secret is server-only) |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | same client ID, exposed to the JS SDK |
| `PAYPAL_CONTRIBUTION_PAYEE_EMAIL` | sandbox business account that receives contributions |
| `PAYPAL_STORE_PAYEE_EMAIL` | sandbox business account for the purchase |
| `PAYPAL_WEBHOOK_ID` | from step 2.3 |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | server-only |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public values (the app does not query Supabase from the browser) |
| `CHANNEL3_API_KEY` | server-only |
| `GEMINI_API_KEY` | optional, server-only |
| `GEMINI_MODEL` | optional; comma-separated chain, default `gemini-flash-latest,gemini-flash-lite-latest` |
| `SESSION_SECRET` | random 32+ bytes; signs the guest identity cookie |
| `CRON_SECRET` | random; Vercel sends it to the cron route |

`SUPABASE_DB_PASSWORD` is only needed locally for migrations. Do not add it to Vercel.

## 5. Cron

`vercel.json` schedules `/api/cron/keepalive` daily at 09:00 UTC. It runs a tiny query so the free Supabase project is not paused after 7 idle days. It requires `Authorization: Bearer $CRON_SECRET`.

## 6. Verify a deployment

```bash
npm run typecheck && npm run lint && npm test
E2E_BASE_URL=https://<your-domain> npm run test:e2e   # needs SANDBOX_* buyer credentials in .env.local
```

The full journey test makes **real Sandbox payments** (no real money) and creates a test campaign in the database.

## 7. Secrets hygiene

- `.env*` is gitignored except `.env.example`, which holds names only.
- Scan the staged diff for keys before every push.
- Never log access tokens. The PayPal module keeps its OAuth token in memory only.
