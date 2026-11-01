# Progress log

## 2026-11-01

**Completed**
- Live rules audit (`docs/HACKATHON_REQUIREMENTS.md`) and account audit (`docs/PLATFORM_ACCESS.md`).
- PayPal Sandbox REST app created; OAuth verified; Orders v2 create with `payee` verified.
- Channel3 key verified (21,000 bonus credits plus 1,000 per month).
- Supabase project created; migrations 001–002 applied.
- Full app implemented: agents, payments, campaigns, UI.
- Unit tests 16/16 passing; typecheck and lint clean.
- Public repo: https://github.com/kmt9967/fundcart-ai (MIT).

- Deployed: https://fundcart-ai.vercel.app (auto-deploy from GitHub; production search verified).
- E2E smoke 4/4 passing locally (pages, streaming assistant with real products, tampered-request rejection, mobile overflow).
- Full journey Playwright spec written (needs sandbox buyer creds).

- Sandbox accounts (recipient, store, two buyers) created; payees configured.
- PayPal button reload bug found by E2E and fixed (memoized SDK options).
- Full journey E2E with real Sandbox payments passes on localhost and production (5/5).
- Gemini key created (free tier) and verified in production (`aiUsed: true`); model chain fallback added because `gemini-2.5-flash` is closed to new keys.
- Webhook deliveries verified in production (approved + capture completed, signature-verified, no double counting).

- Exposed Gemini key confirmed revoked (401); replacement verified (200).
- Refunds: partial/full accounting (migration 003), below-goal reopening, refund-authority test (platform gets PERMISSION_DENIED). End-to-end refund webhook still unverified (needs recipient sandbox dashboard access).
- Direct checkout E2E passing on production.
- Docs: DEPLOYMENT, DEMO_SCRIPT, SUBMISSION_CHECKLIST, DEVPOST_SUBMISSION_DRAFT; README feature-status table with live links.
- Demo video (2:34) recorded from production, narrated (edge-tts Andrew), published publicly: https://youtu.be/K_xpS12dzB8 on the Teqprotech channel.
- Hero illustration card relabelled "Example" (was "Verified").

**Next**
- Devpost draft (never submit), final readiness report.
