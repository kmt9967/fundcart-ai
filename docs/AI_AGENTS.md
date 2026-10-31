# AI agents

The agents live in `src/lib/ai/agents.ts` and are orchestrated by `/api/assistant`. The orchestrator streams an NDJSON timeline that the UI renders as "Agent activity".

| Agent | Tooling | LLM role | Deterministic guarantees |
|---|---|---|---|
| Intent Agent | Gemini JSON-schema output | Extract category, query, purpose, budget, own funds, must-haves, brands, optional follow-up | Zod validation; dollars converted to integer cents in code; regex fallback parser |
| Research Agent | Channel3 `/v1/search` (price filter, InStock, new, US/USD), 6 h DB cache | none | Widens the search if fewer than 3 results; never invents products |
| Comparison Agent | ranking function + Gemini | Write labels, reasons and trade-offs **only from the provided fields** | Scores are code; LLM picks are filtered to real product IDs; product data wrapped in `<product_data>` and marked untrusted |
| Budget Agent | money module | none | `fundingGap`, `fundingPercent`, `remainingCents` on integer cents |
| Campaign Assistant | Gemini | Draft title, story, thank-you and progress updates | The goal comes from the server-side product price; the prompt forbids charity, tax or urgency claims; the user edits before publishing |
| Payment Agent | PayPal module | none | Prepares the summary only; payment requires a checkbox plus PayPal approval; capture happens only after PayPal approval |

## Prompt-injection defences

- Third-party text is stripped of control characters and markup, then length-clamped (`cleanText`).
- It is passed inside a delimited block. The system prompt says to treat it as data and ignore instructions in it.
- The model cannot call tools or payment functions. It only returns JSON matching a schema.
- Any product ID the model returns that is not in the candidate set is discarded.
- Prices, totals and goals are never read from model output.

## Model and fallback

- **Model:** Gemini (`GEMINI_MODEL`, default `gemini-2.5-flash`) via the Google AI Studio free tier, called server-side.
- **Fallback:** if the key is absent or a call fails, each agent falls back to deterministic logic. The UI says so ("Rule-based analysis", "Template draft").
