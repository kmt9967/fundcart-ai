# FundCart incident response runbook

The current flow is Sandbox. The incident commander owns containment and authorizes operational changes. A payment operator verifies provider records. A privacy lead and counsel determine disclosure obligations and deadlines by jurisdiction and incident type.

## First actions

1. Open a restricted incident record. Record UTC time, affected service, deployment SHA, symptom, owner, and opaque record or event IDs.
2. Confirm the environment. Preserve access logs and signed provider evidence in restricted storage under the applicable preservation policy. Keep raw IDs, payment credentials, card data, and beneficiary documents out of tickets and chat.
3. Contain with the least disruptive authorized control. Pause affected campaigns or an affected payment entry point. Revoke implicated staff access and rotate exposed credentials through approved infrastructure. Preserve historical evidence.
4. Check for wider exposure, repeated attempts, and dependent services. Set the next status checkpoint and identify who may authorize reopening.

| Incident | Investigation and containment | Recovery evidence |
| --- | --- | --- |
| Payment discrepancy | Inspect provider order, capture, refund, currency, amount, recipient and event IDs against local ledger. If provider outcome is unknown, hold new attempts on affected orders. Never rerun a charge to repair a ledger. | Verified provider replay or explicitly approved manual reconciliation. Compare unique captures and campaign totals. Check for outstanding orders. |
| Fraud report | Review campaign content, eligibility signals, linked evidence and reports. Pause collection when warranted and record the reason. Use an independent reviewer and protect reporter identity. | Record the decision, scope, donor impact and communications approval. Remove the pause after an authorized reviewer signs off. |
| Account compromise | Revoke sessions and staff access, contain changes, and verify account ownership through the support process. Review moderation and payment history for the affected actor. | Confirm credentials have been rotated, malicious access removed and affected activity independently reconciled. |
| Data exposure | Restrict affected storage or endpoints, identify data type and recipients, and preserve access evidence. Escalate to counsel and privacy lead immediately for deadline and notice decisions. | Verify access boundaries and rotation, assess notification obligations and document authorized follow-up. |
| Provider or database outage | Check quotas, health status, and last known good deployment. Fail closed for payment operations. Preserve provider retries and monitor backlog. | Restore isolated smoke tests and reconcile queued events before reopening. |

## Migration and rollback

Migration 006 can be installed before the matching app because it adds a function. Test the migration on isolated data first. If the new application must be rolled back after receiving adjustments, pause refund handling and reconcile the event backlog with the payment operator. Returning to an older webhook implementation can reopen processing gaps. The function may stay installed while investigation proceeds. Do not delete payment events or replay unknown captures as a rollback mechanism.

Run a post-incident review with root cause, customer impact, evidence links, owners, and tested follow-up actions.
