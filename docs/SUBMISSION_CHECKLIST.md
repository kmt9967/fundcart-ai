# Submission checklist — PayPal AI Hackathon 2026

Deadline: **Thu Nov 12, 2026, 12:00 PM PT** (Fri Nov 13, 01:00 PKT). Devpost submission 1268150 is a **DRAFT**. Final submission requires Talal's explicit approval.

## Rules requirements

| Requirement (Official Rules) | Status | Evidence |
|---|---|---|
| Uses the PayPal developer platform (Sandbox) meaningfully | ✅ | Orders v2 create/capture/get, JS SDK Smart Buttons, webhooks with signature verification (docs/PAYPAL_INTEGRATION.md) |
| Meaningfully incorporates AI | ✅ | Gemini intent extraction, grounded comparisons and campaign drafting; verified live (`aiUsed: true`) |
| Working prototype (not a mockup) | ✅ | https://fundcart-ai.vercel.app; Playwright E2E with real Sandbox payments against production |
| Text description of features | ✅ | Devpost "About" (docs/DEVPOST_SUBMISSION_DRAFT.md) |
| Functional demo: hosted URL or setup instructions | ✅ | Live URL + README "Run locally" + docs/DEPLOYMENT.md |
| AI tools used, and how | ✅ | README, docs/AI_AGENTS.md, Devpost "Built with" |
| Public open-source repo, license visible in About | ✅ | https://github.com/kmt9967/fundcart-ai (MIT shown in About) |
| Demo video < 3 minutes, public on YouTube | ✅ | https://youtu.be/K_xpS12dzB8 (154 s, public, playback verified signed out) |
| Video shows the project working on its intended device | ✅ | Real recording of the production web app in desktop Chrome |
| No third-party trademarks or copyrighted music without permission | ✅ | No music. PayPal UI appears only as the real Sandbox checkout. "Not affiliated with PayPal" is stated in the app and the video description |

## Quality gates

| Check | Status |
|---|---|
| `npm run typecheck`, `npm run lint`, `npm test` (16 unit tests) | ✅ |
| Playwright on production: smoke ×4 + full journey + direct checkout + refund authority | ✅ |
| Secrets: none in the repo or its history; `.env*` gitignored; staged diff scanned before each push | ✅ |
| Free tiers only (Vercel Hobby, Supabase Free, PayPal Sandbox, Channel3 credits, AI Studio free tier) | ✅ |
| Sponsor claims limited to tools actually used (Channel3, AG Grid Community) | ✅ |
| No real money, no live PayPal | ✅ (`PAYPAL_ENV` must be `sandbox`) |

## Devpost draft fields

| Field | Status |
|---|---|
| Project name, elevator pitch, thumbnail | ✅ saved |
| About (story), Built with (19 tags) | ✅ saved |
| "Try it out" links (live app, GitHub) | ✅ saved |
| Video link | ✅ saved (https://youtu.be/K_xpS12dzB8) |
| Image gallery (5 screenshots) | ✅ saved |
| Additional info: submitter type, country, new project, tech explanation, sponsor tools (AG Grid, Channel3), repo/demo URLs, testing instructions, PayPal feedback, AG Grid experience, AI tools, learning | ✅ saved (rating, learning level and career answers are drafts for Talal to adjust) |
| Eligibility attestations (age, jurisdiction, not a sponsor employee) | ⛔ left for Talal: personal legal attestations |
| "Open to PayPal contacting you?" | ⛔ left for Talal |
| Team members | ⚠️ Talal to confirm the Devpost team list |
| Terms checkbox + **Submit project** | ⛔ NOT clicked: draft only |

## Known open items (disclosed honestly)

- An end-to-end refund webhook has not been exercised. It needs a refund issued from the recipient sandbox account, which requires a PayPal developer-dashboard login.
- Single sandbox recipient model (documented as a limitation).

## Before final submission (Talal)

1. Review the Devpost draft text, video and screenshots.
2. Confirm the Devpost team list (Manage team) and the "Submitter Type" answer (currently Team).
3. Tick the three eligibility attestations and answer the PayPal-contact question yourself.
4. Click **Submit** on Devpost yourself, or tell Claude explicitly to submit.
