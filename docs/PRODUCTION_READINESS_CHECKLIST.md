# Production readiness checklist

**Decision: NO-GO for real-money fundraising or a production payment rollout.**

- [x] Active scope remains PayPal Sandbox with no new live payment path.
- [x] Local negative tests cover selected capture ownership, approval, webhook retry, privacy and data boundaries.
- [x] Migrations 001–006 apply in an isolated embedded PostgreSQL test. Adjustment rollback and deduplication are exercised.
- [ ] Apply migration 006 in an isolated staging Supabase project, verify service role permissions, and exercise signed PayPal Sandbox checkout, captures, multiple partial refunds and reversals.
- [ ] Exercise simultaneous contributors and different browser sessions with a reservation strategy. Reconcile prior captures and provider discrepancies.
- [ ] Complete staff authentication and privilege controls, escalation and appeals, token-bound confirmation, identity verification and privacy retention workflows.
- [ ] Complete provider, legal, custody, settlement, jurisdiction and merchant requirements in [production blockers](FUNDRAISING_PRODUCTION_BLOCKERS.md).
- [ ] Verify desktop, mobile, Urdu RTL, and screen-reader behavior for the complete fundraising and moderation journeys on approved Stitch screens.
- [ ] Configure monitored alerts and incident escalation. Have operations and security exercise rollback and obtain independent assessment.
- [ ] Obtain explicit approval for any production migration, deployment or payment configuration change.
