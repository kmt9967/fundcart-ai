# FundCart production upgrade audit

Baseline `04a12bd` on `main`. This is a source audit. Status reflects the whole user journey, including UI and acceptance evidence.

## Application baseline

- Homepage and global navigation lead to the assistant, campaign directory, account and creator views. Product discovery, details and comparison live inside the assistant. The repository includes translated dictionaries and RTL support. Approved FundCart Stitch screens are needed for design integration and visual sign-off.
- The assistant streams events and results, with Gemini intent interpretation, a deterministic family and safety layer, Channel3 retrieval and evidence-based suitability checks. The fallback parser and family analyzer both label intents. The assistant client separately describes the response shape and derives the order it renders, which can drift from the server.
- The API resumes conversations under signed guest identity. It persists the state and prior product IDs in Supabase. The schema has ordinal references, but the result path resolves comparisons against IDs that may disappear during a new search. The browser and server can also disagree on the displayed order after family-specific ranking.
- Campaign creation, preview, moderation, campaign ownership, account sessions, contribution capture, purchase approval, and ledger views exist. The codebase has migrations 001–005 and PayPal Sandbox reconciliation. Runtime sign-off needs isolated Supabase and Sandbox credentials.
- Security includes ownership checks, policy gating, rate limits, PII screening and webhook signature verification. Priority follow-up areas are compatibility gating with prior sessions, sensitive-data retention, moderator access and provenance in explanations.
- Vitest has rules, evaluation, policy, payment and security coverage. Playwright has smoke, direct purchase, contribution journey and refund suites. Vercel configuration includes a keepalive cron. Review CI and integration evidence before designating any family complete.

## Research references

The local Shopping Intent Library (63 pages) and Hackathon Pitch (13 pages) were available. The library's taxonomy and acceptance scenarios inform this matrix. The pitch's funding and verification language predates current Sandbox and verification limitations. Repository policy and current service capabilities govern those claims.

## 29-intent implementation matrix

| # | Intent | Existing functionality | Remaining backend and UI work | External data | Security or trust requirement | Acceptance tests needed | Baseline status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Exact item | Model retrieval and match badges | Model aliases and exact-first ordering | Catalog model IDs | Avoid false exact match | Alias and alternative fixtures | Implemented but incomplete |
| 2 | Category browse | Canonical queries | Facets and dedicated discovery UI | Catalog taxonomy | Validate filter bounds | Category and empty states | Implemented but incomplete |
| 3 | Spec constrained | Typed minimums and evidence checks | Complete category-specific spec coverage | Structured merchant attributes | Unknown minimums require verification | Conflicting specs and mobile evidence | Implemented but incomplete |
| 4 | Budget-led | Integer caps and currency clarification | Budget controls and non-USD catalogs | Currency-specific offers | Keep monetary values in currency | Boundary and mixed-currency cases | Implemented but incomplete |
| 5 | Compatibility | Model clarification and fit badges | Persist fit requirements and require trusted compatibility evidence | Fitment data | Never assert fit from a title alone | Two-turn clarification and missing fit | Implemented but incomplete |
| 6 | Replacement parts | Model and vehicle clarification rules | Verified part IDs and multi-turn enforcement | Parts and fitment catalogs | Require exact safety-critical fit | Unrelated session and missing model | Implemented but incomplete |
| 7 | Substitutes | Alternative badges | Look up the reference offer and explain substitutions | Catalog reference price | Avoid unverified savings | Reference missing and cheaper alternative | Implemented but incomplete |
| 8 | Use case | Documented hardware profiles | Broader profiles and editable intended use | Documented requirements | Trace profile claims to sources | Android workflow journey | Implemented but incomplete |
| 9 | Problem-based | Mapped solution searches | Expand coverage and expose solution choices | Catalog coverage | Keep medical triage separate | Mapped and unknown problems | Implemented but incomplete |
| 10 | Skill and life stage | Profile tier selection | Category-specific tiers and UI controls | Product attributes | Avoid unwarranted suitability claims | Beginner and pro contrasts | Implemented but incomplete |
| 11 | Body and persona fit | Size clarification and cautions | Size filtering and country sizing | Seller fit and sizing data | Minimize personal data | Sizing and missing attributes | Implemented but incomplete |
| 12 | Occasion and theme | Search cues | Persistent theme filters | Catalog taxonomy | Avoid invented tags | Theme retention | Implemented but incomplete |
| 13 | Gifts | Recipient parsing | Grounded gift recommendations and editable criteria | Catalog gift metadata | Avoid sensitive profiling | Recipient and budget retention | Implemented but incomplete |
| 14 | Comparison | Named lookup and manual selection | Stable ordinal lookup and differences across listed attributes | Catalog attributes | Label missing fields | Reordered lists and missing attributes | Implemented but incomplete |
| 15 | Subjective preference | Soft cues | Evidence-backed ranking and preference controls | Category metadata | Disclose ranking proxies | Preference vs mandatory constraint | Implemented but incomplete |
| 16 | Trends | Rating-count proxy and notice | Verified trend signals and provenance | Sales velocity provider | Avoid invented trends | Proxy and missing signal | Blocked by external integration |
| 17 | Deals | Retailer listed discount | Verified coupons and history | Promotion and price history provider | Distinguish listed from verified | Absent or invalid comparison prices | Implemented but incomplete |
| 18 | Values and ethics | Certification limitation notice | Filter by verified certification | Certification provider | Avoid unsupported badges | Verified, absent and expired certifications | Blocked by external integration |
| 19 | Delivery and location | Availability limitation notice | Delivery filters and dates | Logistics and inventory provider | Avoid collecting unnecessary location | No-ETA and stale ETA cases | Blocked by external integration |
| 20 | Recurring purchases | Searches requested item and explains limits | History and repeat-purchase controls | Authorized order history | Require user action for payments | No history and permission boundaries | Blocked by external integration |
| 21 | Bundles | Starter kit checklists | Per-item search, budget totals, replacement and compatibility UI | Offer and fitment data | Expose unquoted costs and missing items | Incomplete kit and over-budget kit | Implemented but incomplete |
| 22 | Exploratory | One category question | Validate localized clarify-to-search journeys | None beyond catalog | Avoid unnecessary information collection | One-question and resumed search | Implemented but incomplete |
| 23 | Multi-turn | Stored session, constraints and references | Stable item selection, results history and shared editable brief | Supabase session store | Preserve session ownership | Mode changes and reordered results | Implemented but incomplete |
| 24 | Roman Urdu and slang | Normalization and multilingual parsing | Validate RTL and native-language journeys | Native-language review | Apply identical policy across languages | RTL and mixed-language refinements | Implemented but incomplete |
| 25 | Contradictions | Rule patterns and budget fallback | General constraint conflict detection and choice UI | None beyond catalog | Avoid silent relaxation | Conflicts and legitimate alternatives | Implemented but incomplete |
| 26 | Support | Deterministic policy answers | Broaden localized support coverage | Current platform policy | Keep transactions behind approval | No catalog calls on policy questions | Implemented but incomplete |
| 27 | Affordability | Cheapest adequate pick and cents-based gap | Explicit unquoted cost breakdown and quotes | Shipping and tax quote provider | Enforce country policy server-side | Quoted and unquoted costs | Implemented but incomplete |
| 28 | Donor-side | Campaign navigation and policy answers | Verified filters when supported | Identity and need verification provider | Protect beneficiary data | Cross-border and unauthorized verification | Implemented but incomplete |
| 29 | Image and voice | Unsupported-input notice | Validated uploads, visual matching and transcript confirmation | Authorized multimodal APIs | Protect uploads and confirm ambiguous numbers | Unavailable input and ambiguous transcription | Blocked by external integration |


## Changes in the first pull request

The matrix's remaining work and external dependencies still apply. No family advanced to Complete and tested. The following rows gained targeted coverage.

| Intent | Status after | Changes | Regression coverage |
| --- | --- | --- | --- |
| Exact item | Implemented but incomplete | Exact matches appear earlier in Best Fit when deterministic model tokens identify them | Existing model-labeling tests |
| Specification, budget and use case | Implemented but incomplete | Rules retain secondary families for compound requests | Combined Android Studio, RAM, budget and brand exclusion case |
| Compatibility and replacement | Implemented but incomplete | Ask for the missing model with an earlier session present, remember the pending request, and keep title-only fit out of suitable picks and funding estimates | Clarification and model-reply turn against a mocked catalog |
| Comparison and multi-turn refinement | Implemented but incomplete | Store each display order and resolve prior selections server-side. Look up missing offers by trusted product ID. Keep a wider catalog search from restoring the previous pick in Cheaper mode | Ordinal and cheaper regression cases against a mocked catalog |
| Trends | Blocked by external integration | Best Fit now displays the same disclosed rating-count proxy order the server remembers | Rating count and session ordering regression |
| Deals | Implemented but incomplete | Best Fit exposes the listed discount sort through the same response field the UI renders | Existing capability-note and ranking tests. Dedicated merchant offer acceptance remains open |
| Affordability | Implemented but incomplete | Show unquoted shipping and tax in the campaign preview and public goal breakdown across four languages | Existing cents, funding and locale suites. Browser coverage requires a configured staging campaign |

### Technical and design scope

- Shopping orchestration, fallback parsing, suitability, session types, assistant route and client, shopping tests, campaign builder and public campaign details, localized trust copy, and campaign types changed.
- The assistant accepts an optional previous display mode and returns an optional selected product ID. Two display-order arrays and pending fit clarification use optional fields in the existing session JSON. No database migrations are required.
- The assistant and campaign screens use existing shared styles. Approved FundCart Stitch screens remain needed for the homepage, shopping and comparison flows, campaign and creator flows, account, and moderation. The editable shopping brief, results history, full bundles, and broader design work remain open.
- Sandbox-only payments still require human approval. Production fundraising depends on licensed payment and custody arrangements, local legal review, and operational approval. Identity and need verification require a provider. The merchant and media data dependencies are listed per family above.
