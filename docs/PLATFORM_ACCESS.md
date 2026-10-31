# FundCart AI — platform access status

This file never contains passwords, cookies, API keys, license keys or redemption codes.

- **Browser:** persistent Playwright Chrome profile (`F:\ClaudeWorkspace\automation\sideincome`).
- **Last updated:** 2026-11-01.

| Platform | Signed in | Account ready | Credits / trial | API access | Blockers | Next action |
|---|---|---|---|---|---|---|
| **PayPal Developer** | Yes (session expired again later) | Yes, Sandbox mode | n/a (Sandbox is free) | **Verified.** Created REST app "FundCart AI" (Merchant). OAuth token from the Sandbox API works. Orders v2 create works, including a custom `payee`. | Dashboard session expired, so the extra Sandbox test accounts can't be created yet | Talal re-signs in. Then create the recipient and buyer Sandbox accounts and the webhook |
| PayPal Sandbox accounts | — | 2 default accounts (US business that owns the app; US personal) | — | — | Buyer password is only visible in the dashboard | Create dedicated accounts after re-login |
| Devpost (PayPal AI Hackathon) | Yes | Registered (Edit/Create project visible) | n/a | n/a | — | Create the project draft at the end |
| GitHub (kmt9967) | Yes (gh CLI) | Yes | n/a | Yes | — | Repo created: github.com/kmt9967/fundcart-ai |
| Vercel (team Teqprotech, **Hobby**) | Yes (web); CLI logged out | Project `fundcart-ai` created with env vars | Free Hobby | — | **2FA re-auth required to deploy** | Talal completes the re-auth |
| **Channel3** | Yes | Yes | **Verified: 21,000 bonus credits, plus 1,000 free per month (0 used at check)** | **Verified:** a live `/v1/search` returns products | — | Used in the app |
| Supabase (kmt9967's Org, Free) | Yes | New project `fundcart-ai` (us-west-2, Nano, free) | Free plan | Verified (REST 200, migrations applied) | Free projects pause after 7 days idle | Daily Vercel cron keepalive |
| Google AI Studio (Gemini) | Google session yes | **Terms not yet accepted** | Free tier | — | Accepting Google's terms is Talal's action | Talal clicks Continue; then create the API key |
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
