# AI agents

The shopping pipeline lives in `src/lib/shopping/` and is orchestrated by `/api/assistant` (`runTurn` in `pipeline.ts`). The orchestrator streams an NDJSON timeline that the UI renders as "Agent activity". Campaign copy is drafted by the Campaign Assistant in `src/lib/ai/agents.ts`.

## Pipeline (one conversation turn)

1. **Safety gate** (`safety.ts`, rules): prompt injection, self-harm, restricted items, minors and age-restricted goods, covert surveillance, counterfeits, dangerous requests, deceptive campaign requests and promo-code extraction stop the turn before any search. Card numbers are redacted before the message is stored or sent to a model. Order and donor questions are routed instead of searched.
2. **Intent Agent** (Gemini JSON schema, then `validateIntent`): fills a versioned **IntentV2**:
   - the 29 intent families, the product category, and whether the product is physical or software;
   - use cases and software the product must run;
   - skill level, stated constraints, exclusions and colours;
   - `budgetRaw`, refinement controls and language.
   Unknown fields are dropped. The model can't set prices, verification or funding. Rules in `fallback-intent.ts` cross-check literal values and act as the multilingual fallback (EN, Urdu, Roman Urdu, ES, FR).
3. **Session merge** (`session.ts`, code): explicit rules keep earlier requirements across turns:
   - "cheaper" sets a price cap below the previous top pick;
   - "not HP" excludes a brand;
   - "16GB RAM" replaces any earlier RAM requirement;
   - "forget the budget" clears it;
   - "the second one" or "compare the first and third" resolve against the previous results.
   Memory is owner-checked and never grants identity or payment authority.
4. **Requirements Agent** (`knowledge.ts`): profiles turn needs into **minimum / recommended / premium** requirements, each tagged with its origin (official, derived, stated or AI) and its source. Stated requirements override derived ones. Example: Android Studio depends on how the learner will run their apps, so the agent asks. Testing on a physical Android phone uses Google's published minimum for Android Studio alone (8 GB RAM, post-2017 CPU, no dedicated GPU); the Android Emulator uses the Studio & Emulator minimum (16 GB RAM, a 4 GB-VRAM GPU on Windows/Linux). Until the user says, results meet the Android Studio minimum, ChromeOS is left out (it cannot run the Emulator), 16 GB is recommended, and the trade-off is explained. Source: developer.android.com/studio/install.
5. **Research Agent** (Channel3 `/v1/search`, 6 h DB cache): up to 2 targeted, category-filtered queries, plus one wider (optionally used/refurbished) query only when too few suitable products fit the price cap.
6. **Verification Agent** (`specs.ts`, `evaluate.ts`, code): extracts RAM, storage, CPU (generation and class), GPU/VRAM, OS, architecture, screen and more from each listing.
   - Conflicting values are flagged and the lower one is used.
   - A missing spec is "not confirmed", never "met".
   - Wrong product types are rejected: books, toys, accessories and software.
   - Implausibly low prices (deposits, monthly prices, data errors) move to "check before buying".
7. **Ranking** (code): **Best fit** weighs suitability tier, value, budget fit, preferences and ratings. **Cheapest adequate** is the lowest price that meets every minimum requirement, and is the basis for a fundraising goal. Expensive items are labelled as optional upgrades.
8. **Budget Agent** (money module): budget fit, the gap versus the budget, and the funding gap, all in integer cents. Non-USD budgets are shown back to the user and never silently converted.
9. **Comparison Agent** (Gemini): explains the top verified picks in the interface language, using only the fields given inside `<product_data>`. Template explanations are used if the model is unavailable.

## Prompt-injection and data defences

- Third-party text is stripped of control characters and markup, then length-clamped (`cleanText`).
- Product data reaches the model only inside a delimited block. The system prompt says to treat it as data.
- The model only returns JSON matching a schema. It cannot call tools, change prices or authorise payments.
- Product IDs the model returns that are not in the verified candidate set are discarded.
- Ranking uses structured specs, not marketing text, so a listing can't instruct its way to the top.
- Prices, totals, goals and budgets are never read from model output.

## Model and fallback

- **Model:** Gemini (`GEMINI_MODEL`, a comma-separated chain, default `gemini-flash-lite-latest,gemini-flash-latest`), with a total time budget per call so a slow model falls through quickly.
- **Fallback:** without a key, or when a call fails, the rule-based parser and templates are used. The UI says so ("Rule-based analysis").
