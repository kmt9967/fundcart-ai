# Phase 2 Stitch inventory

## Current status

Phase 2 remains incomplete. This run used the newest supplied FundCart archive, `stitch_fundcart_ai_redesign (1).zip` (44 HTML and 26 PNG files). Group 1 has fixture captures at all four required widths and mobile comparisons. Group 1 still requires visual corrections. Homepage, workspace, and marketplace include desktop comparisons. The marketplace comparison renders the supplied HTML at 1440 CSS pixels. Groups 2 and 3 retain prior implementation and evidence.

| Screen | Desktop fidelity | Mobile fidelity | Functionality | Evidence | Blocker or gap |
| --- | --- | --- | --- | --- | --- |
| Homepage | Partially implemented | Partially implemented | Public search, collections and campaign entry. | [390](evidence/phase-two/group-one/homepage-390.jpg) · [768](evidence/phase-two/group-one/homepage-768.jpg) · [1024](evidence/phase-two/group-one/homepage-1024.jpg) · [1440](evidence/phase-two/group-one/homepage-1440.jpg) · [Stitch mobile comparison](evidence/phase-two/group-one/homepage-mobile-review.jpg) · [Stitch desktop comparison](evidence/phase-two/group-one/homepage-desktop-review.jpg) | Mobile follows the compact hero, two-tile collection grid and community list. Header, footer, collection photography and mock quote still differ. |
| Shopping workspace | Partially implemented | Partially implemented | Fixture covers brief edit and refreshed results. | [390](evidence/phase-two/group-one/workspace-390.jpg) · [768](evidence/phase-two/group-one/workspace-768.jpg) · [1024](evidence/phase-two/group-one/workspace-1024.jpg) · [1440](evidence/phase-two/group-one/workspace-1440.jpg) · [Stitch mobile comparison](evidence/phase-two/group-one/workspace-mobile-review.jpg) · [Stitch desktop comparison](evidence/phase-two/group-one/workspace-desktop-review.jpg) | Side rails and results composition differ. |
| Community marketplace | Partially implemented | Partially implemented | Fixture covers populated cards and search filtering. | [390](evidence/phase-two/group-one/marketplace-390.jpg) · [768](evidence/phase-two/group-one/marketplace-768.jpg) · [1024](evidence/phase-two/group-one/marketplace-1024.jpg) · [1440](evidence/phase-two/group-one/marketplace-1440.jpg) · [Stitch mobile comparison](evidence/phase-two/group-one/marketplace-mobile-review.jpg) · [Stitch desktop comparison](evidence/phase-two/group-one/marketplace-desktop-review.jpg) | Desktop cards use inset 16:10 images. The summary uses recorded totals for the campaigns shown. Status chips, cohort presentation and header differ. |
| Product Comparison Studio | Partially implemented | Partially implemented | Four real fixture selections with horizontal candidate cards on mobile. | [390](evidence/phase-two/group-one/comparison-390.jpg) · [768](evidence/phase-two/group-one/comparison-768.jpg) · [1024](evidence/phase-two/group-one/comparison-1024.jpg) · [1440](evidence/phase-two/group-one/comparison-1440.jpg) · [Stitch mobile comparison](evidence/phase-two/group-one/comparison-mobile-review.jpg) | Mobile matrix keeps all selected candidates visible together. Desktop is derived. |
| Product Details & Affordability | Partially implemented | Partially implemented | Fixture covers known funds, unquoted costs and buy/fund navigation. | [390](evidence/phase-two/group-one/product-390.jpg) · [768](evidence/phase-two/group-one/product-768.jpg) · [1024](evidence/phase-two/group-one/product-1024.jpg) · [1440](evidence/phase-two/group-one/product-1440.jpg) · [Stitch mobile comparison](evidence/phase-two/group-one/product-mobile-review.jpg) | Mobile has the three-metric card and fixed actions. Catalog supports a single image and this fixture has none. The title and long feature pills take more space than in Stitch. Desktop is derived. |
| Campaign Detail | Partially implemented | Partially implemented | Existing public route and campaign funding data. | See historical evidence below | Populated comparison and four-width capture pending. |
| Contribution Checkout | Partially implemented | Partially implemented | Existing Sandbox form. | See historical evidence below | Full responsive design and Sandbox verification pending. |
| Contribution Receipt | Partially implemented | Partially implemented | Owner and pending/completed fixture assertions passed. | See historical evidence below | Prior mobile comparison exists. Provider-backed receipt and exact layout remain open. |
| Campaign Status | Partially implemented | Partially implemented | Signed owner fixture passed. | See historical evidence below | Prior mobile comparison exists. Exact layout remains open. |
| Campaign Creation Wizard | Partially implemented | Partially implemented | Signed fixture covers validation, draft restoration and submission navigation. | See historical evidence below | Exact four-step visual matching and real submission pending. |
| Creator Dashboard | Partially implemented | Partially implemented | Existing creator summary and campaign controls. | See historical evidence below | Populated reference comparison pending. |
| Contribution Ledger & Timeline | Partially implemented | Partially implemented | Existing owner timeline and money display. | See historical evidence below | Populated responsive layout matching pending. |
| Human Purchase Approval | Partially implemented | Partially implemented | Existing quote-bound approval flow. | See historical evidence below | Reference comparison and authorized approval acceptance pending. |
| Admin Moderation Queue | Partially implemented | Partially implemented | Existing role-protected queue. | See historical evidence below | Populated reference comparison pending. |
| Detailed Admin Campaign Review | Partially implemented | Partially implemented | Signed staff role fixture passed. | See historical evidence below | Prior mobile comparison exists. Exact layout and live decision acceptance pending. |

- **Unit and fixture-backed verification.** Vitest passed 320 tests with two skipped. The loopback browser evidence uses seeded fixtures.
- **Isolated database verification.** Vitest exercised migrations 001–007 against embedded PostgreSQL, including snapshot immutability, ownership and conversation cleanup. Hosted Supabase acceptance remains pending.
- **External provider acceptance.** Externally blocked. This checkout had no isolated Supabase, PayPal Sandbox, or test supporter configuration. See the isolated acceptance commands below for the full checklist.
- **Shopping persistence and bundles.** The earlier database and fixture evidence remains applicable. Custom slots, additional compatibility rules and authenticated cross-device acceptance remain open.

Based on open draft PR #1 at ede9328. The supplied archive contains 44 HTML exports and 26 PNGs, including four image-only references. Names below are folders containing code.html. Where a numbered alternative has uncertain approval, this branch uses the Plum Brand Edition desktop and Editorial White mobile conventions rather than combining earlier alternatives.

| Screen | Desktop reference | Mobile reference | Application surface | Initial gap |
| --- | --- | --- | --- | --- |
| Homepage | fundcart_ai_homepage_plum_brand_edition | fundcart_ai_homepage_mobile_2 | / | Editorial search, hero photo and catalog entry points |
| Shopping workspace | ai_shopping_workspace_plum_brand_edition_2 | ai_shopping_workspace_mobile | /assistant | Workspace rails and editable requirements |
| Community marketplace | community_needs_marketplace | community_needs_marketplace_mobile_editorial_white | /campaigns | Editorial cards and exact responsive parity |
| Contribution checkout | paypal_sandbox_contribution_checkout | paypal_sandbox_checkout_mobile_2 | /c/[slug], Contribute | Layout parity and Sandbox integration QA |
| Campaign detail | campaign_detail | campaign_detail_mobile_2 | /c/[slug] | Layout and funding timeline parity |
| Contribution receipt | contribution_success_and_receipt | contribution_success_and_receipt_mobile_editorial_white | /receipt/[orderId], Contribute | Separate contribution confirmation state |
| Submission and status | campaign_submission_and_verification_status | campaign_submission_and_status_mobile_2 | /campaigns/new, /c/[slug]/status | Ownership-protected submission timeline |
| Creator dashboard | creator_dashboard | creator_dashboard_mobile_2 | /me | Design parity and dashboard flows |
| Campaign creation | multi_step_campaign_creation_wizard | campaign_creation_wizard_mobile_editorial_white | /campaigns/new | Four-stage flow and draft recovery |
| Ledger and timeline | contribution_ledger_and_funding_timeline | contribution_ledger_and_timeline_mobile_cleaned | /c/[slug]/manage | Timeline and table parity |
| Moderation queue | admin_moderation_queue | admin_moderation_queue_mobile_2 | /admin/moderation | Queue design parity |
| Purchase approval | human_purchase_approval | human_purchase_approval_mobile_editorial_white | /c/[slug]/manage | Quote-bound approval and visual parity |
| Admin review | detailed_admin_campaign_review | detailed_admin_campaign_review_mobile_2 | /admin/moderation/[slug] | Dedicated review surface and state parity |
| Comparison studio | No desktop HTML found | product_comparison_studio_mobile | /assistant#compare | Add fourth item, detail navigation and differences |
| Product details | No desktop HTML found | product_details_affordability_mobile_2 | /products/[externalId] | Catalog and affordability view |

## Implementation status

“Partial” means the flow still needs design or integration work even where existing functionality remains available. No pixel-match score was measured.

| Screen family | Desktop | Mobile | Functionality and visual evidence | Remaining deviation |
| --- | --- | --- | --- | --- |
| Homepage | Partially implemented | Partially implemented | Editorial headline, catalog search and category cards, archive imagery and live community section. Compared with the desktop export and captured at the requested widths. | Collection panels and exact campaign-list treatment remain open. The hero in the desktop export was broken, so the supplied studio asset fills it. |
| Shopping workspace | Partially implemented | Partially implemented | Desktop rails, editable brief and stacked mobile layout. Fixture verifies an edit and refreshed result. | Main cards, side panels and mobile composition differ from the mock. No unsupported verification badges or delivery values. |
| Community marketplace | Partially implemented | Partially implemented | Search, category chips and editorial two-column cards are implemented. Browser fixture verifies filtering; public overflow checks ran at all four widths. | Match mobile cohort strip and navigation after defining a real cohort data source. The live populated visual check remains open. |
| Contribution checkout | Partially implemented | Partially implemented | PayPal Sandbox form has an explicit amount summary. | Full checkout screen parity and isolated Sandbox charge/capture test remain open. |
| Campaign detail | Partially implemented | Partially implemented | Existing campaign and contribution surfaces use shared tokens and wrap funding figures. | Full landing layout and populated timeline QA remain open. |
| Contribution receipt | Partially implemented | Partially implemented | Receipt groups Sandbox confirmation and amount separately from the transaction record. Existing provider-backed statuses and receipt authorization are preserved. | Stitch-specific layout and live Sandbox receipt verification remain open. |
| Submission status | Partially implemented | Partially implemented | Dedicated owner-only status route displays actual submission, moderation history and verification limits. Signed local owner/stranger fixture and four-width overflow checks passed. | Independent verification, document upload and turnaround estimates are unavailable. Exact desktop parity and live acceptance remain open. |
| Creator dashboard | Partially implemented | Partially implemented | Campaign cards link to owner management and, for signed-in owners, the status page. | Dashboard layout, populated savings and backer-count checks remain open. |
| Campaign creation | Partially implemented | Partially implemented | Product, need, story and review are gated steps. Browser fixture verifies invalid-step blocking, draft restore, and authenticated submission navigation. | Real hosted campaign submission and exact wizard parity remain open. |
| Ledger and timeline | Partially implemented | Partially implemented | The owner timeline uses a vertical rule, and funding metrics wrap at narrow widths. Existing records remain the source of truth. | Dedicated table and timeline redesign and populated mobile QA remain open. |
| Moderation queue | Partially implemented | Partially implemented | Wider layout and expandable full story. Existing moderator access checks still apply. | Queue redesign and signed-in moderator QA remain open. |
| Human purchase approval | Partially implemented | Partially implemented | The purchase panel shows a Sandbox summary and keeps pending capture distinct from completion. Existing authorization remains enforced. | Dedicated design and signed approval acceptance remain open. |
| Admin campaign review | Partially implemented | Partially implemented | Dedicated moderator-only review renders funding target, available eligibility evidence and shared decision controls. Signed local role fixture and four-width overflow checks passed. | Mock quote evidence, creator ID documents and numerical risk scores are omitted because no trusted source is connected. Exact layout and live decisions remain open. |
| Comparison studio | Partially implemented | Partially implemented | Compare two to four offers, remove items, inspect differences and open details. Browser fixture exercises four selections. | Desktop is inferred. Saved result sets can restore a comparison. A separate comparison library is not available. |
| Product details | Partially implemented | Partially implemented | Dedicated catalog route, owned suitability context, wishlist and estimated affordability. | Desktop is inferred. Live merchant and provider acceptance remains open. |

## Shopping feature status

| Feature | Status |
| --- | --- |
| Editable Shopping Brief | Implemented and verified for maximum budget, currency, minimum RAM and excluded brands. Existing use case and other constraints remain in the session. |
| Shopping history | Partially implemented. Recent and explicitly saved non-sensitive result sets appear for authenticated accounts. Removal clears the selected row’s prompt, intent, result IDs and saved comparison while preserving audit events and unrelated turns. Reopening refreshes prices and restores available comparison items. Rename, whole-thread deletion and immutable offer snapshots are open. |
| Saved results | Partially implemented. Individual offers use the existing wishlist. Owners can pin saved result IDs and comparison selections from eligible sessions. Prices are refreshed rather than saved as quotes. |
| Comparison Studio | Partially implemented. Comparison context can travel to product details and back. Only available offers survive a refreshed search. |
| Product Details | Partially implemented. Owner-scoped context drives suitability and product-gap estimates. Shipping and tax are unquoted. |
| Bundle builder | Partially implemented. Recognized kits use component searches, selectable offers and known USD totals. Required and optional slots are labeled and missing required items remain visible. Selected IDs can be saved on the device and resolve against fresh offers. CPU and motherboard socket matching uses consistent structured attributes. Other compatibility and cross-device persistence are open. |
| Follow-up refinement | Implemented and verified for the existing ordinal path and supported structured edits. Free-form requirement removal remains limited. |
| Responsive interface | Partially implemented. Public homepage, assistant and marketplace passed the four-width check. Protected or populated financial screens still need QA. |
| Campaign and payment UI | Partially implemented. Existing eligibility, PayPal Sandbox and moderator controls remain in use. |

## Git and safety

The dedicated branch is stacked on `feature/fundcart-production-upgrade` while PR #1 remains unmerged. Phase 2 does not add a migration. The inherited Phase 1 contribution-adjustment migration remains a staging prerequisite. No hosted environment or payment provider was used for testing.

## Verification evidence

- Vitest passed 315 tests, including the Phase 1 security and embedded PostgreSQL migration suites. Two opt-in tests were skipped.
- Seven Chromium tests passed against the production build on loopback. They cover no horizontal overflow at 390, 768, 1024 and 1440px on the public shopping routes; desktop and Urdu mobile ordinal selection; a session-bound structured brief edit; four-product comparison; bundle pricing; and fixture-backed product, campaign-draft and checkout navigation.
- Fixture boundaries. The Shopping Brief, comparison and bundle browser journey uses mocked assistant and catalog responses. Product details, draft page and Checkout are actual Next.js pages backed by a loopback catalog and session fixture. The suite does not submit campaigns, verify a moderator session, or capture a PayPal payment.
- TypeScript and the production build passed. ESLint passed with one existing campaign-report unused-import warning. The full dependency audit reported zero vulnerabilities after updating the transitive TypeScript ESLint toolchain.
- Visual review used the archive desktop homepage and workspace exports, mobile product references, and the implementation captures below. The export screenshots include scaled canvases of varying dimensions, so the captures are responsive checks at the listed CSS widths, not pixel-diff comparisons. We checked section hierarchy, image crops, button hierarchy, card spacing and rail position. The expanded FundCart controls, truthful checkout copy and empty or fixture-backed records account for visible differences.

| Captures | Mobile | Tablet | Compact desktop | Desktop |
| --- | --- | --- | --- | --- |
| Homepage | [390](evidence/phase-two/homepage-390.png) | [768](evidence/phase-two/homepage-768.png) | [1024](evidence/phase-two/homepage-1024.png) | [1440](evidence/phase-two/homepage-1440.png) |
| Workspace and comparison fixture | [390](evidence/phase-two/workspace-390.png) | — | — | [1440](evidence/phase-two/workspace-1440.png) |
| Product details fixture | [390](evidence/phase-two/product-390.png) | — | — | [1440](evidence/phase-two/product-1440.png) |

Reproduce locally by running `npm run build`, then running the Phase 2 Playwright specs with `E2E_PHASE2_FIXTURE=1`. Playwright starts both the app and catalog fixture on loopback. FundCart remains Sandbox-only and the Phase 1 launch blockers still apply.


## Continuation on draft PR #2

The existing stacked branch now includes the dedicated owner status and staff review pages, guarded shopping-history changes, and a gated four-step builder. The earlier screen inventory and responsive evidence remain applicable where the page was unchanged. A side-by-side image is a visual review aid. Each source is the supplied mobile Stitch PNG, and each implementation is a 390 CSS-pixel Playwright capture of local fixture data. The images are rescaled to a common width and do not assert pixel parity.

| Screen | Side-by-side | Material observed differences |
| --- | --- | --- |
| Marketplace | [Mobile](evidence/phase-two/marketplace-side-by-side.png) | The implementation retains the shared menu and transparent Sandbox messaging. Search, filters and square card layout are present. The mock cohort progress, verification count and preset dollar actions are omitted. The capture has one seeded campaign, so it does not establish live grid parity. |
| Campaign status | [Mobile](evidence/phase-two/status-side-by-side.png) | The implementation uses the campaign’s actual submission time and moderation state. It omits a verified quote, due-time estimate and automatic marketplace publish step. |
| Detailed admin review | [Mobile](evidence/phase-two/review-side-by-side.png) | Funding target and actual review actions are shown. The design’s uploaded creator ID, OCR verification, quote match percentage and numerical risk score have no trusted data source. The live controls stay in the review card instead of a sticky action strip. |

Full parity for all 15 families remains open. In particular, the campaign detail, receipt, Sandbox contribution checkout, creator dashboard, contribution ledger and purchase approval still need complete desktop/mobile comparisons with populated states and more route-specific design work. No Phase 3 work was started.

The checkout has no isolated hosted Supabase or PayPal Sandbox configuration. To run the remaining acceptance suite, supply an isolated Supabase project with the existing migrations applied, Sandbox app and buyer/merchant accounts, an isolated moderator account, webhook configuration, and a receipt-mail test sink if testing delivery. The loopback tests exercise signed authorization and wizard UI with fixture data. They cannot establish real PayPal capture, receipt delivery, moderation decisions, or human purchase approval.

Continuation verification passed **318 Vitest tests** with two opt-in tests skipped, **10 Chromium fixture and public smoke tests**, TypeScript, the production build, and a full dependency audit with zero vulnerabilities. ESLint reported the existing unused-import warning. Browser checks covered 390, 768, 1024 and 1440 CSS pixels on the public shopping routes and the two dedicated authenticated fixture routes. The marketplace test caught a duplicate accessible name shared by search and filter navigation; the filter landmark now has a distinct label.

## Completion-brief continuation on PR #2

The latest available ZIP remains `C:\Users\BINARY\Downloads\stitch_fundcart_ai_redesign (1).zip` with 44 HTML and 26 PNG exports. This pass added the Stitch collection-panel composition, redesigned the receipt confirmation header, and added real campaign/remaining-goal context to the contribution form and contribution summaries to the creator dashboard. Collection panels reuse the already imported Stitch imagery because the intended collection photography was missing in the supplied render. Dashboard summaries cover only the campaigns loaded by the dashboard.

- [Mobile homepage comparison](evidence/phase-two/homepage-completion-side-by-side.png) and [desktop capture](evidence/phase-two/homepage-completion-1440.png). Collection layout is present. Header, campaigns and content still differ from the supplied export.
- [Mobile receipt comparison](evidence/phase-two/receipt-completion-side-by-side.png) and [desktop capture](evidence/phase-two/receipt-completion-1440.png). The signed receipt fixture distinguishes pending and completed provider-record states and withholds capture details from an unrelated viewer. Receipt merchant, campaign and event content varies with actual records. No PayPal or mail provider call was made.
- The earlier 15-screen matrix remains the release acceptance inventory. All rows remain **Partially implemented** for exact visual parity. This pass did not complete per-screen reference comparisons for the other thirteen families.

### Persistence and migration

| Feature | Status | Verification and limitations |
| --- | --- | --- |
| Whole-thread removal | Implemented and verified | Migration 007 traverses the owner’s linked turns, clears private shopping contents and removes linked shopping diagnostics. Campaign, payment and security audit records are preserved. Rejects late child/diagnostic writes. Embedded PostgreSQL covers sibling turns, unrelated records and another owner. Links already discarded by older history removal cannot be reconstructed. |
| Historical saved offers | Implemented, verification pending | New results record server-observed offer identity, displayed price, merchant, currency, structured evaluation state, listed features, and timestamp. Embedded PostgreSQL rejects snapshot mutation; reopening separates the saved price from the refreshed result. Old result sets have no historical snapshot. Authenticated browser and current-price refresh integration remain open. |
| Named history and comparisons | Partially implemented | Owners can name or rename saved result sets. Comparisons retain offers available in the refreshed result. Whole-thread names independent of result sets are not implemented. |
| Account bundle persistence | Implemented, verification pending | Authenticated list, named save/update, reopen and delete use an owner-scoped table. Embedded PostgreSQL verifies per-owner uniqueness and denies direct authenticated-role reads. Account UI restores saved IDs against a fresh component search. Cross-device authenticated E2E is pending. |
| Bundle compatibility and editing | Partially implemented | Existing CPU socket comparison is retained. Unsupported pairs and power requirements remain unknown. Custom component slots and additional verified compatibility axes remain open. |

Apply `007_shopping_persistence.sql` after 006 in an isolated project before running these features against hosted Supabase. Do not apply it to production during this work. No hosted migration was run.

### Isolated acceptance commands

1. Configure a disposable Supabase project with migrations 001–007, a test moderator, an allowed Sandbox-only campaign jurisdiction, and catalog access. Configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, the publishable Supabase key, `SESSION_SECRET`, and `CHANNEL3_API_KEY` through local secrets.
2. Configure `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_CONTRIBUTION_PAYEE_EMAIL`, and `PAYPAL_STORE_PAYEE_EMAIL` against authorized isolated Sandbox accounts. Route events only to that environment. If testing email, configure a test sink via `RESEND_API_KEY` and `RECEIPT_FROM`.
3. Build and start the isolated app. Set `E2E_BASE_URL` to that target, with `E2E_PHASE2_FIXTURE` unset. Supply `DEMO_MODERATOR_EMAIL/PASSWORD`, `SANDBOX_SUPPORTER_EMAIL/PASSWORD` and `SANDBOX_CREATOR_BUYER_EMAIL/PASSWORD` separately. Run `npm run test:e2e -- tests/e2e/journey.spec.ts tests/e2e/direct.spec.ts` after confirming authorization to capture Sandbox funds. Keep refund checks opt-in and limited to a capture owned by the test merchant.
4. Record database status, moderation decision, PayPal order/capture status, webhook reconciliation and receipt evidence separately. Do not count navigation or a mocked response as provider acceptance.

No isolated provider credentials were configured in this checkout. Provider-backed submission, moderation, contribution, receipt delivery and purchase approval remain **Blocked**. Phase 2 and production readiness remain separate. No Phase 3 work was started.
Local verification for this continuation recorded 320 passing tests and 2 skips, 11 passing Chromium tests, a successful production build, and zero npm audit findings. Lint completed with the existing unused AUTO_HIDE_REPORTS warning. Chromium used isolated fixtures.
