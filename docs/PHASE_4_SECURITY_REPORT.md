# Phase 4 security report

The payment code remains Sandbox-only. This branch adds a pre-order quote comparison to both purchase paths. The existing capture ownership, quote approval record, moderation, idempotency, webhook and migration 006 adjustment code is preserved. Embedded PostgreSQL applies migrations 001–007 during tests. No hosted migration, payment creation, capture or webhook dispatch was performed.

The gap between remaining-balance validation and provider capture still permits a race between different orders. Completing atomic reservations and reconciliation requires an explicit database state machine and tests for pending provider captures, failures and late webhooks. Staff MFA, dual control, incident readiness and external financial approval remain open.
