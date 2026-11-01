# Sponsor integrations (honest status)

Last updated: 2026-11-01 (after the Gemini and webhook verification)

| Sponsor | Status | What exactly |
|---|---|---|
| **PayPal** (host) | **Implemented and tested end to end**: real Sandbox contributions and purchases captured via Smart Buttons in Playwright, confirmed via the Orders API; verified webhooks received in production | Orders v2 create / capture / get, refunds API wrapper, webhook verification, JS SDK Smart Buttons |
| **Channel3** | **Implemented and tested** (live searches from localhost and production) | `/v1/search` with price / availability / condition filters; free `/v1/products/{id}` detail lookup; 6 h cache |
| **AG Grid** | **Implemented** (Community edition, MIT) | Payment ledger grid in the creator dashboard (sorting, filtering, pagination, custom formatters) |
| Render | Available but unused | The $50 code redemption is unverified; the app is deployed on Vercel |
| KERNEL | Available but unused | The browser automation was not needed |
| APIMatic | Available but unused | The Context Plugin has not been used; no claim is made |
| Elastic | Available but unused | Vector search not needed at this scale |
| Astropods | Available but unused | — |
| Bryntum | Available but unused | — |
| Postman | Available but unused | — |
| Zapier | Available but unused | — |
| Supabase (not a sponsor) | Implemented | Postgres database |
| Google Gemini (AI) | **Implemented and verified in production** (free-tier key; `aiUsed: true` on live requests) | Intent, explanations, campaign copy; deterministic fallback |

We claim sponsor-prize eligibility only for tools that are actually used in the running app: **Channel3** and **AG Grid**.
