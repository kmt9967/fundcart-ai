# Fundraising production blockers

Real-money fundraising has a **NO-GO** decision in every jurisdiction. This is an engineering readiness assessment. Obtain local counsel and written partner decisions before enabling any jurisdiction.

## Universal gates

- Executed agreements with authorized fundraisers, licensed payment and custody providers, and approved merchant fulfillment. Document settlement segregation, insolvency treatment, donor consent, fees, chargebacks, cancellations and reconciliation.
- Approved AML, sanctions, donor and beneficiary verification, eligibility review and appeals procedures. Use a trusted evidence provider with limited access and documented retention. Sensitive document upload remains disabled.
- Merchant quote and inventory contracts, shipping and tax breakdown, verified fulfillment and returns, and explicit approval for any product substitution.
- Release gates include atomic reservation, staff MFA and dual control, layered abuse prevention, tested rollback, external security assessment, and on-call operational readiness.

| Jurisdiction | Current backend mode | Evidence required before legal and operational sign-off |
| --- | --- | --- |
| US | Sandbox | State-by-state launch review, platform and charity partner eligibility, support and custody contracts |
| GB | Sandbox | Local fundraising and payment structure review, fees and complaints procedure, approved partners |
| CA | Sandbox | Federal and applicable provincial review, registered partners and payment-provider approvals |
| AU | Sandbox | State and territory review, approved fundraising partner and payment provider |
| DE | Sandbox | Local fundraising and payment review, approved provider and privacy impact assessment |
| FR | Sandbox | Local fundraising and payment review, approved provider and privacy impact assessment |
| ES | Sandbox | Local fundraising and payment review, approved provider and privacy impact assessment |
| PK | Domestic Sandbox | Domestic launch review, licensed local partner and supported settlement provider |
| IN | Domestic Sandbox | Domestic launch review, local partner, foreign-contribution and tax review before any expansion |
| KE | Sandbox, moderator review | Local public fundraising review and an approved settlement partner |
| AE | Shopping only | Written permission and approved local partner and channels |
| SA | Shopping only | Approved channels and partner, domestic and cross-border review |
| CN | Shopping only | Written authorization, approved local channel and data-residency review |
| ID | Shopping only | Current permitting and partner confirmation |
| Unknown | Sandbox demo | Verified eligibility and serviceability are required before any live transaction |
| Other | Shopping only | Identify jurisdiction, approved providers and explicit rollout approval |

Keep the configured PayPal Sandbox merchant, country rules and disclosures in place while these gates remain open.
