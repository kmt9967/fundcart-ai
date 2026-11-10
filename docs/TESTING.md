# Testing

Tests are grouped by what they prove. Deterministic layers are tested without the AI model (no key
in unit tests, catalog responses replayed from recorded fixtures). Rule-based success is never
counted as evidence of model accuracy; model compatibility is checked separately with a small,
bounded number of requests on a development key.

## Categories

| Category | What it checks | Where |
|---|---|---|
| **A. Intent understanding** | All 29 intent families from the team's library are detected; act-or-clarify rules (ask for model numbers, vehicle details, sizes); kits, problems, comparisons, substitutes, contradictions; honest capability limits; Roman Urdu, slang and typos | `tests/unit/families.test.ts`, `tests/unit/shopping.test.ts` |
| **B. Product suitability and factual accuracy** | Requirements per profile, spec extraction, met/unmet/unknown checks, cheapest adequate, over-budget labelling, listing-injection has no effect on ranking, prices only from catalog data, missing attributes never become specs | `tests/unit/shopping.test.ts`, `tests/unit/journeys.test.ts` |
| **C. Complete user journeys** | Beginner, budget-constrained student, multi-turn refinement, support and donor routes without product search, kits, contradictions, AI allowance exhausted; end-to-end browser journeys | `tests/unit/journeys.test.ts`, `tests/agent/scenarios.json`, `tests/e2e/` |
| **D. Security and abuse resistance** | Prompt and listing injection, fake authority and verification, harmful and illegal requests, privacy requests, PII redaction, campaign moderation, duplicate fingerprints — with false-positive tests for legitimate shopping | `tests/unit/security.test.ts`, `tests/agent/trust-check.mjs` |
| **E. Policy and eligibility** | Country gates, need categories, restricted categories, cross-border rules, trusted country source, gap formula, contribution minimum | `tests/unit/policy.test.ts`, `tests/agent/trust-check.mjs` |
| **F. Multilingual consistency** | The same request in English, Roman Urdu, Spanish, French and Urdu yields the same category, software and budget; safety decisions are language-independent; translation completeness, placeholders and Urdu script | `tests/unit/families.test.ts`, `tests/unit/i18n.test.ts`, `tests/agent/auth-i18n-check.mjs` |
| **G. PayPal Sandbox integrity** | Money arithmetic, contribution validation, capture/refund state machine, Sandbox purchase and contribution journeys, authorization of owner-only actions | `tests/unit/money.test.ts`, `tests/e2e/`, `tests/agent/auth-i18n-check.mjs` |

## Running

```bash
npm run typecheck && npm run lint
npm test                                   # unit tests (A, B, C, D, E, F, money)
npm run build && npx next start -p 3200    # local production server
node --dns-result-order=ipv4first tests/agent/run-scenarios.mjs http://localhost:3200 tests/agent/scenarios.json
node --dns-result-order=ipv4first tests/agent/auth-i18n-check.mjs http://localhost:3200
node --dns-result-order=ipv4first tests/agent/trust-check.mjs http://localhost:3200
npm run test:e2e                           # browser journeys incl. PayPal Sandbox
```

## Production safeguards for tests

- Test scripts and browser tests refuse to target a remote host unless `ALLOW_PRODUCTION_AI=1` is
  set for a deliberate, bounded check, so automated runs never spend the production AI quota.
- The production AI key is used only by the production deployment; tests use a separate development
  key or run in rule-based mode.
- The model compatibility check is opt-in and capped to a few requests per model.
- Test campaigns created by integration runs are unlisted afterwards.

## Team test workbook

The team's 100-scenario workbook is evaluated by a separate runner that writes a scored copy; the
original is never modified. Cases whose expected result is subjective are listed separately for
team adjudication.
