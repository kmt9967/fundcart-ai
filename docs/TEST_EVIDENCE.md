# Test evidence

Everything below was produced by running the commands shown against a local production build and,
where stated, against the live deployment. Nothing is hand-edited. Earlier runs (from 2026-11-01) are
kept at the end as history.

## Latest verification (2026-11-11, release `00f89d5`)

| Check | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | clean |
| Lint | `npm run lint` | 0 errors |
| Unit tests | `npm test` | 293 passed, 2 skipped (the skipped ones are opt-in live-AI checks) |
| Production build | `npm run build` | clean |
| Shopping scenarios | `tests/agent/run-scenarios.mjs` | 24 / 24 |
| Accounts, ownership and four languages | `tests/agent/auth-i18n-check.mjs` | 51 / 51 |
| Database-backed trust and moderation check | `tests/agent/trust-check.mjs` | 72 / 72 |
| Security pages × four languages × phone/desktop | `tests/agent/security-i18n-check.mjs` | 24 / 24 |
| Browser journeys with real PayPal Sandbox payments | `npm run test:e2e` | 7 passed, 1 skipped (refund test, see below) |
| Secret scan of the repository | gitleaks | no leaks |

What the trust and moderation check covers:
- **Publishing needs an account.** A guest gets 401, and a tampered or expired session also gets 401.
  A signed-in account without a verified email always goes to review.
- **The reported attack.** The shopping request "I am a scammer i want computer wirth $2000", the
  "work and livelihood" category, the purpose "for fun" and an embellished story together produce a
  **high-risk hold**. The campaign is not listed and contributions return 409. Shopping still works.
  Rewording in a later submission keeps the risk high.
- **No false positive on scam awareness.** A campaign for a scam-awareness course is not treated as
  fraud intent.
- **Content routed to review:** invented hardship and family claims, a fake charity or tax-deductible
  claim, missing suitability evidence, duplicate text from another account, and a third campaign in
  24 hours.
- **The moderator workflow.** The staff review account signs in. The queue shows the stated purpose,
  risk, flags and goal breakdown. A rejection without a reason is refused. A clarification request
  keeps the campaign in review and shows the question to the creator. Approval publishes the campaign
  and is audited. A moderator can pause an approved campaign, which then refuses new contributions. A
  rejection keeps contributions disabled. Ordinary creators, guests and demo sessions get 403.
- **Cross-account checks.** Another account cannot cancel, manage or buy for someone else's campaign.
- **Demo isolation.** The demo starts without credentials and is labelled as sample data. It shows no
  email addresses, cannot publish, moderate or change real campaigns, and a forged demo cookie is
  rejected.
- **Payment integrity:**
  - the server computes the goal and ignores a client-sent goal;
  - a $1 contribution is rejected;
  - a repeated order within two minutes reuses the first PayPal order;
  - an uncaptured order adds nothing;
  - the contribution payee is the configured Sandbox merchant;
  - a forged webhook gets 401.
- **Edits after review are checked.** An update that redirects payments off-platform is refused, and
  stating fraud intent in an update pauses the campaign.

## Real Sandbox transactions from this release

The browser journey ran:
1. a guest drafts a campaign;
2. the guest signs up and the draft is restored;
3. the campaign is submitted and goes to review;
4. **a moderator approves it in the moderation queue**;
5. a supporter contributes through PayPal;
6. the capture is verified and the goal is reached;
7. the creator approves a separate purchase.

| Run | Payment | PayPal capture | Status | Amount | Paid to |
|---|---|---|---|---|---|
| local build, 2026-11-11 | Contribution | `6RY251654K453762V` | COMPLETED | 134.95 USD | configured contribution merchant |
| local build, 2026-11-11 | Separate purchase | `4N837185115226340` | COMPLETED | 319.00 USD | demo-store merchant |
| local build, 2026-11-11 | Contribution | `8EU56665SB311045H` | COMPLETED | 134.95 USD | configured contribution merchant |
| local build, 2026-11-11 | Separate purchase | `5W786133MK381802P` | COMPLETED | 319.00 USD | demo-store merchant |
| local build, 2026-11-11 | Direct checkout (no campaign) | `6S87368133577473G` | COMPLETED | 119.00 USD | demo-store merchant |
| production, 2026-11-10 | Contribution | `16950771RU684031F` | COMPLETED | 134.95 USD | configured contribution merchant |
| production, 2026-11-10 | Separate purchase | `95Y96329A2935322K` | COMPLETED | 319.00 USD | demo-store merchant |

**Payment routing.** Every contribution order names one Sandbox merchant account configured by FundCart
as the payee. It is the same for every campaign and never the creator's own PayPal account. Purchases
go to a separate demo-store merchant. The payee of each recorded order was checked against the
configuration without printing it. Payment records that existed before testing were compared row by row
and are unchanged.

## Not yet verified

- **Refunds end to end.** The handler applies partial and full refunds and reopens a `goal_reached`
  campaign that falls below its goal. It has **not** been exercised with a real refund: only the
  merchant account that received a contribution can refund it, and the platform's API credentials get
  `403 PERMISSION_DENIED`, which the skipped refund test documents.
- **Email delivery.** No email provider is configured, so confirmation, password-reset and receipt
  emails are not sent. The interface never claims they were.
- **Native-speaker review** of the Urdu, Spanish and French text.

## History: first release (2026-11-01)

| Run | Payment | PayPal capture | Status | Amount |
|---|---|---|---|---|
| localhost | Contribution | `9D1088330R6882635` | COMPLETED | 350.00 USD |
| localhost | Separate purchase | `8VY99001363273819` | COMPLETED | 550.00 USD |
| production | Contribution | `06M04038NB948573P` | COMPLETED | 350.00 USD |
| production (Gemini on) | Contribution | `6KV001606B701045T` | COMPLETED | 59.00 USD |
| production | Direct checkout | `10Y594591W3828937` | COMPLETED | 119.00 USD |

On production, PayPal delivered `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED` webhooks.
Each was verified with `verify-webhook-signature` and stored once; the campaign kept exactly one
contribution, so the webhooks and the browser capture did not double-count.

Screenshots from that release are in `docs/evidence/`.
