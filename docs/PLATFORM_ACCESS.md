# FundCart AI — platform access status

This file never contains passwords, cookies, API keys, license keys or redemption codes.

- **Browser:** persistent Playwright Chrome profile (`F:\ClaudeWorkspace\automation\sideincome`).
- **Last updated:** 2026-11-01.

| Platform | Signed in | Account ready | Credits / trial | API access | Blockers | Next action |
|---|---|---|---|---|---|---|
| **PayPal Developer** | Yes | Yes, Sandbox mode | n/a (Sandbox is free) | **Verified end to end:** REST app "FundCart AI"; real Sandbox contribution + purchase captured and confirmed via the PayPal API; **verified webhook deliveries received in production** | — | — |
| PayPal Sandbox accounts | — | 4 accounts: campaign recipient (business, new), demo store (business, app owner), supporter buyer (personal, new), creator buyer (personal) | Sandbox balances | — | — | Test passwords set via the dashboard and stored only in `.env.local` |
| Devpost (PayPal AI Hackathon) | Yes | Registered (Edit/Create project visible) | n/a | n/a | — | Create the project draft at the end |
| GitHub (kmt9967) | Yes (gh CLI) | Yes | n/a | Yes | — | Repo created: github.com/kmt9967/fundcart-ai |
| Vercel (team Teqprotech, **Hobby**) | Yes (web) | Project `fundcart-ai`, auto-deploys from GitHub | Free Hobby | — | — | Live: https://fundcart-ai.vercel.app |
| **Channel3** | Yes | Yes | **Verified: 21,000 bonus credits, plus 1,000 free per month (0 used at check)** | **Verified:** a live `/v1/search` returns products | — | Used in the app |
| Supabase (kmt9967's Org, Free) | Yes | New project `fundcart-ai` (us-west-2, Nano, free) | Free plan | Verified (REST 200, migrations applied) | Free projects pause after 7 days idle | Daily Vercel cron keepalive |
| Google AI Studio (Gemini) | Yes | Terms accepted by Talal | **Free tier** (no billing set up) | **Verified:** key `FundCart AI app` (stored only in `.env.local` and Vercel); live production calls succeed | `gemini-2.5-flash` is closed to new keys and the flash models sometimes return 503, so the app falls back along a model chain | — |
| Render | Login page shown | ? | Reported $50 code. **Unverified** | — | Not signed in | Optional (Render prize) |
| KERNEL | ? | Reported account created | $50 sponsor credits **unverified** | — | — | Not needed for the core build |
| AG Studio / AG Grid | — | Eval licence reported (expires 2026-12-15) | Unverified | — | — | Using **AG Grid Community (MIT)**; no licence key needed |
| APIMatic | Yes (onboarding page open) | Account exists | 1-month Basic needs plugin usage first | — | — | Optional |
| Elastic Cloud | ? | Reported serverless project | Trial **unverified** | — | — | Not used |
| Astropods | ? | Reported $10 credit | Unverified | — | — | Not used |
| Bryntum | ? | Trial signup reported | Unverified | — | — | Not used |
| Postman (web) | Login page shown | Installed locally | — | — | — | Optional |
| Zapier | ? | Free | Nothing to claim | — | — | Not used |
| YouTube Studio | ? | — | — | — | — | Check at video upload |

Status values marked "unverified" have not been checked against the live account in this session.
