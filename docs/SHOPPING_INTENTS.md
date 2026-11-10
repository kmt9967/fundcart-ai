# Shopping intents: the 29 families

FundCart AI organises shopping requests into 29 intent families. The framework comes from our team's research document, the Shopping Intent Library. It builds on three things:

- Baymard Institute's 12 query types;
- Amazon's ESCI relevance labels (Exact, Substitute, Complement, Irrelevant);
- the way people describe needs to an assistant in full sentences.

Real sentences usually mix 2–4 families. "Cheap waterproof boots for hiking in Murree next week" is budget-led, spec-constrained, use-case and urgency all at once.

## How a family is handled

Two layers read every message.

1. **The model** (Gemini, schema-constrained) labels a primary family and fills a validated intent object. It never sets prices, stock, verification, payment state or policy.
2. **Deterministic code** (`src/lib/shopping/families.ts`) detects families from the text and decides the behaviour:
   - ask first, or ask alongside the results;
   - show a project kit;
   - map a problem to solution types;
   - compare two products;
   - label alternatives;
   - name contradictions;
   - state which data FundCart doesn't have.

The behaviour is identical when the model is unavailable or its daily allowance is used up, so the assistant degrades to rule-based mode instead of failing.

Every listing that is shown has been checked against the need's requirements:

- Prices come only from the live catalog (Channel3).
- A specification that isn't listed is reported as "not listed". It is never assumed.

## The families

| # | Family | What FundCart does | Limits |
|---|---|---|---|
| 1 | Exact item | Searches the model and labels each listing *Exact model* or *Alternative* | No live stock data |
| 2 | Category browse | Searches the canonical category | No faceted filters yet |
| 3 | Spec constrained | Stated specs become hard checks (RAM, storage, CPU, GPU, screen, OS, refresh rate, ANC and similar) | Clothing sizes and materials aren't in the catalog data |
| 4 | Budget-led | Filters by budget and never labels an over-budget item as a within-budget pick; ambiguous amounts ("5k") ask for the currency | Catalog prices are in USD |
| 5 | Compatibility | Without a model number it asks for the exact model and never guesses the fit; listings that don't name the model are labelled *Fit not confirmed* | No fitment database |
| 6 | Replacement part | Same as compatibility; safety-critical vehicle parts require make, model and year before anything is shown | No parts catalog |
| 7 | Substitute ("like X but…") | Results are labelled alternatives, never presented as the original | The reference product's price isn't looked up |
| 8 | Use case / task | Turns the task into requirements from documented sources, for example Android Studio on a physical phone versus the emulator, and explains why | Covers a defined set of uses |
| 9 | Problem / symptom | Searches solution types (for example a rising room temperature with power cuts → rechargeable fan or UPS) instead of matching words; medical symptoms get a "see a professional" answer, never products | Fixed set of problem maps |
| 10 | Skill level / life stage | Adjusts the requirement tier (minimum vs recommended) | |
| 11 | Body / persona fit | Shows results and asks for the size alongside; adds cautions for skin and health products | No size filtering |
| 12 | Occasion / theme | Adds the occasion to the search | No tag taxonomy |
| 13 | Gift | Records the recipient | No gift wrap or notes |
| 14 | Comparison | Searches both named products; the comparison table uses catalog fields only | |
| 15 | Subjective / vibe | Treated as a soft preference | Weak proxy |
| 16 | Trend / social proof | Says plainly that there is no sales or trend data; orders by number of ratings as a rough proxy | Needs a sales data source |
| 17 | Deal-seeking | Orders by the retailer's listed was/now discount, labelled as listed, not verified | No coupon codes |
| 18 | Values / ethics | Says certifications (halal, vegan, eco, origin) aren't verified in catalog data | Needs certification data |
| 19 | Urgency / delivery / location | Never promises delivery dates; says ETAs and local stock aren't available | Needs a logistics API |
| 20 | Recurring / replenishment | Says there is no order history; searches the named item | Needs order history |
| 21 | Bundle / project | Shows a starter checklist (home office, baking, camping, newborn, gym, first home, picnic, PC build) and searches the main item first | No whole-kit total yet |
| 22 | Vague / exploratory | Asks one open question | |
| 23 | Multi-turn refinement | Keeps every earlier constraint across "cheaper", "not HP", "16 GB", "forget the budget" and ordinal references | "Go back to the earlier ones" isn't supported |
| 24 | Roman Urdu / slang / typos | Normalises English, Urdu, Roman Urdu, Spanish, French and mixed text before parsing; one shared evaluation and policy engine for every language | |
| 25 | Contradictory | Names the conflict (for example a top-end graphics card on a small budget) and offers two paths: the best option within budget, or the requirement at its real price | Fixed set of conflict patterns plus the general "nothing suitable within budget" path |
| 26 | Non-product / support | Answers from FundCart's own policy (FundCart doesn't sell or ship, so it has no orders, returns or installments) without searching products | |
| 27 | Affordability gap | Switches to the cheapest adequate option, computes the exact gap in code, and offers a campaign only where the country policy allows fundraising | |
| 28 | Donor-side | Points to campaigns; explains zakat eligibility can't be verified; explains cross-border rules and the refund policy | Campaigns aren't identity-verified |
| 29 | Image / voice input | Says image and voice input aren't supported yet; links are never opened (protects against server-side request forgery) | Needs multimodal input |

## Act-or-clarify rules

The assistant asks at most one question per turn, and only when the answer would change the recommendation. The rules run in this order:

1. Category unknown and can't be inferred → one open question.
2. Hard constraints conflict → say which constraint breaks and offer two paths.
3. Compatibility item with no model → ask for the model; never guess the fit.
4. Size or fit item with no size → show results and ask for the size alongside.
5. High-value item without a budget → show results and ask for the budget.
6. Low-value item without a budget → show the best options without asking.
7. Everything needed is present → results with a one-line reason each, and no question.

## Cautions that don't block shopping

Some messages trigger a caution while shopping continues:

- health or medical claims;
- allergens;
- spending pressure: the assistant switches to the cheapest adequate options and doesn't upsell;
- sensitive purchases: these are not stored in readable history;
- large in-game purchases;
- personal details pasted into chat: these are removed before processing.

Harmful requests are stopped with an explanation and, where possible, a safe alternative. That includes:

- self-harm;
- prescription medicines without a prescription;
- weapons and dangerous chemicals;
- covert tracking of another person;
- counterfeits;
- age-restricted items for minors;
- return fraud;
- attempts to change prices or verification from chat;
- requests for other people's data.

## Families that depend on unavailable integrations

FundCart states these limits instead of inventing data:

- **Trend:** no sales-velocity data.
- **Deals:** no coupon or promotion API; only listed was/now prices.
- **Values and ethics:** no certification data.
- **Urgency and delivery:** no delivery-estimate or local-stock data.
- **Recurring:** no order history, reorders or subscriptions.
- **Image and voice:** no multimodal input yet.
- **Donor-side "verified" campaigns:** no identity or need-verification provider is connected, so every campaign is shown as not verified.
