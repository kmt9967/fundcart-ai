# FundCart engineering roadmap

The integration branch starts at Phase 2 commit 1f370e8. It preserves draft PR #1 and draft PR #2 and keeps production main separate. The Vercel project owns fundcart-ai.vercel.app. Existing production and preview deployments are outside the acceptance evidence for this branch.

| Phase | Implemented and verified locally | Engineering work remaining | Hosted or external gate |
| --- | --- | --- | --- |
| 1 | Existing deterministic shopping ranking, authorization, privacy and moderation remain in the stack. The local suite covers the intent catalog and payment security regressions. | Provider-backed intent quality and operational hardening remain open. | Isolated catalog, AI and account setup for acceptance. |
| 2 | 15 screen families with earlier reference comparisons. Local isolated-browser ownership, named history, snapshot display and bundle journeys. | Exact Stitch parity and refreshed acceptance of affected voice surfaces remain open. See the [screen matrix](PHASE_2_STITCH.md#current-status). | Hosted account isolation, external checkout and email. |
| 3 | Existing Channel3 search and detail retrieval. Shorter search cache and exact-amount and merchant rechecks before Sandbox purchase. | Recoverable re-quote and explicit substitution acceptance, variant offers, display refresh and fuller provenance. | Authorized catalog credentials and a seeded commerce integration fixture. |
| 4 | Existing signed Sandbox processing, approvals, audit and adjustment accounting. Checkout now refuses changed offers before order creation. | Atomic cross-order reservations, reconciliation, staff MFA, dual control and operational readiness. | Isolated database, PayPal Sandbox, webhook and receipt sink. Real-money gates are separate. |
| 5 | Local-only browser dictation and signed-in photo-to-search suggestions with editable text fallback. | Account preference controls, image-specific follow-up questions, and multilingual physical microphone testing. | Compatible browser, microphone permission and installed device language recognition. Authorized visual model credentials and provider retention review for photo acceptance. |

## Release decision

Keep the current deployment separate. The integration branch has unresolved engineering requirements and no verified isolated staging. Rehearse migrations and rollback in staging before merging into main, which the repository documents as auto-deploying. The existing [financial launch gates](FUNDRAISING_PRODUCTION_BLOCKERS.md) remain open.
