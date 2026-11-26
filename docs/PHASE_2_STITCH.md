# Phase 2 Stitch inventory

Based on open draft PR #1 at ede9328. The supplied archive contains 44 HTML exports and 26 PNGs, including four image-only references. Names below are folders containing code.html. Where a numbered alternative has uncertain approval, this branch uses the Plum Brand Edition desktop and Editorial White mobile conventions rather than combining earlier alternatives.

| Screen | Desktop reference | Mobile reference | Application surface | Initial gap |
| --- | --- | --- | --- | --- |
| Homepage | fundcart_ai_homepage_plum_brand_edition | fundcart_ai_homepage_mobile_2 | / | Editorial search, hero photo and catalog entry points |
| Shopping workspace | ai_shopping_workspace_plum_brand_edition_2 | ai_shopping_workspace_mobile | /assistant | Workspace rails and editable requirements |
| Community marketplace | community_needs_marketplace | community_needs_marketplace_mobile_editorial_white | /campaigns | Editorial cards and exact responsive parity |
| Contribution checkout | paypal_sandbox_contribution_checkout | paypal_sandbox_checkout_mobile_2 | /c/[slug], Contribute | Layout parity and Sandbox integration QA |
| Campaign detail | campaign_detail | campaign_detail_mobile_2 | /c/[slug] | Layout and funding timeline parity |
| Contribution receipt | contribution_success_and_receipt | contribution_success_and_receipt_mobile_editorial_white | /receipt/[orderId], Contribute | Separate contribution confirmation state |
| Submission and status | campaign_submission_and_verification_status | campaign_submission_and_status_mobile_2 | /campaigns/new, /c/[slug]/manage | Ownership-protected submission timeline |
| Creator dashboard | creator_dashboard | creator_dashboard_mobile_2 | /me | Design parity and dashboard flows |
| Campaign creation | multi_step_campaign_creation_wizard | campaign_creation_wizard_mobile_editorial_white | /campaigns/new | Four-stage flow and draft recovery |
| Ledger and timeline | contribution_ledger_and_funding_timeline | contribution_ledger_and_timeline_mobile_cleaned | /c/[slug]/manage | Timeline and table parity |
| Moderation queue | admin_moderation_queue | admin_moderation_queue_mobile_2 | /admin/moderation | Queue design parity |
| Purchase approval | human_purchase_approval | human_purchase_approval_mobile_editorial_white | /c/[slug]/manage | Quote-bound approval and visual parity |
| Admin review | detailed_admin_campaign_review | detailed_admin_campaign_review_mobile_2 | /admin/moderation | Dedicated review surface and state parity |
| Comparison studio | No desktop HTML found | product_comparison_studio_mobile | /assistant#compare | Add fourth item, detail navigation and differences |
| Product details | No desktop HTML found | product_details_affordability_mobile_2 | /products/[externalId] | Catalog and affordability view |

## Implementation status

“Partial” means the flow still needs design or integration work even where existing functionality remains available. No pixel-match score was measured.

| Screen family | Desktop | Mobile | Functionality and visual evidence | Remaining deviation |
| --- | --- | --- | --- | --- |
| Homepage | Partially implemented | Partially implemented | Editorial headline, catalog search and category cards, archive imagery and live community section. Compared with the desktop export and captured at the requested widths. | Collection panels and exact campaign-list treatment remain open. The hero in the desktop export was broken, so the supplied studio asset fills it. |
| Shopping workspace | Partially implemented | Partially implemented | Desktop rails, editable brief and stacked mobile layout. Fixture verifies an edit and refreshed result. | Main cards, side panels and mobile composition differ from the mock. No unsupported verification badges or delivery values. |
| Community marketplace | Partially implemented | Partially implemented | Existing live grid uses new tokens. Browser overflow checks ran at all requested widths. | Dedicated editorial card composition and live populated visual QA remain open. |
| Contribution checkout | Partially implemented | Partially implemented | PayPal Sandbox form has an explicit amount summary. | Full checkout screen parity and isolated Sandbox charge/capture test remain open. |
| Campaign detail | Partially implemented | Partially implemented | Existing campaign and contribution surfaces use shared tokens. | Full landing layout and populated timeline QA remain open. |
| Contribution receipt | Partially implemented | Partially implemented | Existing pending and confirmed states and receipt endpoint retain provider checks. | Stitch-specific layout and live Sandbox receipt verification remain open. |
| Submission status | Partially implemented | Partially implemented | Existing submission and moderation state remains authoritative. | Dedicated verification-status screen and authenticated acceptance remain open. |
| Creator dashboard | Partially implemented | Partially implemented | Existing account and creator controls use shared tokens. | Dashboard layout, populated savings and backer-count checks remain open. |
| Campaign creation | Partially implemented | Partially implemented | Product, need, story and review sections, existing draft recovery, navigation and error recovery. | Sections remain accessible together. Exact step-by-step gating and authenticated draft publication QA remain open. |
| Ledger and timeline | Partially implemented | Partially implemented | Existing ledger and timeline retain verified data. | Dedicated table and timeline redesign and populated mobile QA remain open. |
| Moderation queue | Partially implemented | Partially implemented | Wider layout and expandable full story. Existing moderator access checks still apply. | Queue redesign and signed-in moderator QA remain open. |
| Human purchase approval | Partially implemented | Partially implemented | Existing server-authorized Sandbox approval uses shared tokens. | Dedicated design and signed approval acceptance remain open. |
| Admin campaign review | Partially implemented | Partially implemented | Current review data remains available inside the authorized queue. | Dedicated review screen remains open. |
| Comparison studio | Partially implemented | Partially implemented | Compare two to four offers, remove items, inspect differences and open details. Browser fixture exercises four selections. | Desktop is inferred. Historical comparisons are not saved separately. |
| Product details | Partially implemented | Partially implemented | Dedicated catalog route, owned suitability context, wishlist and estimated affordability. | Desktop is inferred. Live merchant and provider acceptance remains open. |

## Shopping feature status

| Feature | Status |
| --- | --- |
| Editable Shopping Brief | Implemented and verified for maximum budget, currency, minimum RAM and excluded brands. Existing use case and other constraints remain in the session. |
| Shopping history | Partially implemented. Recent non-sensitive sessions appear for authenticated accounts. Reopening refreshes catalog results from the owned session. Rename, deletion and exact historical snapshots are open. |
| Saved results | Partially implemented. Individual offers use the existing wishlist. Saved result sets are open. |
| Comparison Studio | Partially implemented. Comparison context can travel to product details and back. Only available offers survive a refreshed search. |
| Product Details | Partially implemented. Owner-scoped context drives suitability and product-gap estimates. Shipping and tax are unquoted. |
| Bundle builder | Partially implemented. Recognized kits use component searches, selectable offers and known USD totals. Compatibility is unconfirmed. Saved bundles, project-specific validation and required/optional editing are open. |
| Follow-up refinement | Implemented and verified for the existing ordinal path and supported structured edits. Free-form requirement removal remains limited. |
| Responsive interface | Partially implemented. Public homepage, assistant and marketplace passed the four-width check. Protected or populated financial screens still need QA. |
| Campaign and payment UI | Partially implemented. Existing eligibility, PayPal Sandbox and moderator controls remain in use. |

## Git and safety

The dedicated branch is stacked on `feature/fundcart-production-upgrade` while PR #1 remains unmerged. Phase 2 does not add a migration. The inherited Phase 1 contribution-adjustment migration remains a staging prerequisite. No hosted environment or payment provider was used for testing.

## Verification evidence

- Vitest passed 315 tests, including the Phase 1 security and embedded PostgreSQL migration suites. Two opt-in tests were skipped.
- Seven Chromium tests passed against the production build on loopback. They cover no horizontal overflow at 390, 768, 1024 and 1440px on the public shopping routes; desktop and Urdu mobile ordinal selection; a session-bound structured brief edit; four-product comparison; bundle pricing; and fixture-backed product, campaign-draft and checkout navigation.
- Fixture boundaries. The Shopping Brief, comparison and bundle browser journey uses mocked assistant and catalog responses. Product details, draft page and Checkout are actual Next.js pages backed by a loopback catalog and session fixture. The suite does not submit campaigns, verify a moderator session, or capture a PayPal payment.
- TypeScript and the production build passed. ESLint passed with one existing campaign-report unused-import warning. Dependency audit reported zero vulnerabilities.
- Visual review used the archive desktop homepage and workplace exports, mobile product references, and the implementation captures below. The export screenshots include scaled canvases of varying dimensions, so the captures are responsive checks at the listed CSS widths, not pixel-diff comparisons. We checked section hierarchy, image crops, button hierarchy, card spacing and rail position. The expanded FundCart controls, truthful checkout copy and empty or fixture-backed records account for visible differences.

| Captures | Mobile | Tablet | Compact desktop | Desktop |
| --- | --- | --- | --- | --- |
| Homepage | [390](evidence/phase-two/homepage-390.png) | [768](evidence/phase-two/homepage-768.png) | [1024](evidence/phase-two/homepage-1024.png) | [1440](evidence/phase-two/homepage-1440.png) |
| Workspace and comparison fixture | [390](evidence/phase-two/workspace-390.png) | — | — | [1440](evidence/phase-two/workspace-1440.png) |
| Product details fixture | [390](evidence/phase-two/product-390.png) | — | — | [1440](evidence/phase-two/product-1440.png) |

Reproduce locally by running `npm run build`, then running the Phase 2 Playwright specs with `E2E_PHASE2_FIXTURE=1`. Playwright starts both the app and catalog fixture on loopback. FundCart remains Sandbox-only and the Phase 1 launch blockers still apply.
