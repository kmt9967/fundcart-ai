# Campaign publication security

FundCart has two security boundaries:

| | Shopping | Fundraising (publishing a campaign) |
|---|---|---|
| Who | Anyone, no account | Signed-in account, checked on the server |
| What can go wrong | Bad recommendations | Strangers lose money to a deceptive page |
| Odd wording | Safety rules, then normal search | Counted as a risk signal for publication |
| Decided by | Rules + AI ranking | Deterministic eligibility engine + moderators |

Mentioning something suspicious while shopping does not block product research. It does count when the same account later asks other people for money.

## Who can do what

| Action | Guest | Signed-in creator | Demo session |
|---|---|---|---|
| Browse, use the assistant, compare, see funding gaps | ✓ | ✓ | ✓ |
| Prepare a campaign draft | ✓ (kept in the browser) | ✓ | — |
| Submit a campaign | ✗ (asked to sign in, draft kept) | ✓ | ✗ |
| Contribute through PayPal Sandbox | ✓ where policy allows | ✓ | — |
| Manage a campaign, approve its purchase | only the owner | only the owner | ✗ (read-only sample) |
| Moderation, verification | ✗ | ✗ (moderator role only) | ✗ |

The campaign API (`POST /api/campaigns`) reads the signed account session on the server and verifies it against the database. A guest cookie alone is not enough, and neither is a tampered or expired session.

When a guest clicks "Sign in to publish", the draft (product, amounts, purpose, story) is saved in the browser's session storage. Sign-in or sign-up returns them to the builder with the draft restored. Only same-site paths are accepted as a return address.

## Email verification

This build has no email delivery yet, so new accounts are created **without** a verified email and the interface says so. Until verification is configured, every new campaign from an unverified account is created as **pending review**: only its owner can see it, it is not listed, and contributions are refused until a moderator approves it. There is no bypass for the demo.

## Eligibility engine

`src/lib/eligibility.ts` runs on every submission, independently of the shopping assistant. It looks at:

1. Account: signed in, email verified
2. The creator's stated purpose, in their own words
3. The selected need category, and whether the purpose fits it (English, Urdu, Spanish, French)
4. The account's recent shopping requests (owner-checked, server-side)
5. Statements of intent to deceive supporters
6. Story claims the creator never made (work, hardship, health, family, achievements, verification, charity, guarantees)
7. Product-suitability evidence (the assistant turn that found the cheapest item meeting the requirements)
8. Content review findings (personal data, contact or payment redirects, links, charity/tax claims, false verification, abuse, injection)
9. Duplicate content, duplicate items, creation velocity, active-campaign limit
10. Country policy and earlier abuse signals on the account

### Outcomes

| Outcome | Stored as | Public? | Accepts support? |
|---|---|---|---|
| Needs clarification | nothing stored; the creator is asked a question | — | — |
| Rejected (blocked content) | nothing stored | — | — |
| Pending review | `moderation_status = pending_review` | owner only | no |
| Published | `auto_approved` (engine) or `approved` (moderator) | yes | yes |
| Paused | `pending_review` after reports or a flagged update | banner | no |
| Hidden / rejected by a moderator | `hidden` / `rejected` | no | no |
| Cancelled | `status = cancelled` | yes, marked | no |

Only the engine's `publish` outcome with a low content score, from a verified account with suitability evidence, goes live automatically. Everything uncertain waits for a person. Repeated clarification attempts (three in a day) go to review instead of being retried forever.

### Stated intent to deceive

The check looks for the speaker describing **themself** ("I am a scammer", "I want to trick donors", "this is a fake campaign", and equivalents in Spanish, French, Urdu and Roman Urdu). It ignores quoted speech, denials ("I am not a scammer"), other people's accusations ("they called me a scammer") and talk about scams ("how do I avoid scams", "a course on spotting scams"). A match makes the submission **high risk**: it is never published automatically, never bounced back for a quick re-word, and the signal stays on the account for 30 days, so rewording the purpose, starting a new conversation or submitting directly to the API does not clear it.

### Editing after review

Updates posted to a live campaign go through the same content rules. Contact details, payment redirects, links and verification or charity claims are refused. A stated intent to deceive in an update pauses the campaign for review.

## The AI never decides

- The AI drafts copy from a structured set of facts: the item, the listed price, the amount the creator says they have, and the creator's own reason. It is told not to add anything else.
- A deterministic filter then removes any sentence that carries a claim the creator didn't make. The builder tells the creator when this happened.
- The submitted text, AI-written or not, goes through the same eligibility checks.
- The AI cannot approve a campaign, mark anyone verified, set a goal, or start, capture or refund a payment.

## How product requirements are checked

Campaigns should fund the cheapest item that meets the stated need. The assistant turn that recommended the item is stored server-side. On submission, the server checks that the turn belongs to the same account and that the chosen item is the cheapest adequate one. A pricier item is refused unless the creator pays the difference. Submissions without that evidence go to review. See [Product suitability](PRODUCT_SUITABILITY.md).

## How the goal is calculated

```
base gap = live price − money the creator already has
buffer   = 5% of the live price (rounded up to the cent)
goal     = base gap + buffer
```

The server recomputes the goal from the latest catalog price. The browser and the AI cannot set it. The shopping results show the goal with the buffer before "Fund this" is clicked. The builder shows every line, and the campaign page stores and shows the same formula. The buffer exists because retailer prices can rise before the purchase. If the price ends up lower, the unused buffer is **not** refunded automatically: no such process exists in this prototype.

## Where Sandbox money goes

- Every contribution is a PayPal **Sandbox** test payment, so no real money moves.
- All contributions go to **one PayPal Sandbox merchant account configured by FundCart**, the same for every campaign. Campaign creators do not receive contributions in their own PayPal accounts.
- Each contribution is recorded against the chosen campaign, and progress counts only captures that PayPal confirms as completed for the exact amount.
- A purchase is a separate Sandbox checkout to the demo store account. It does not place an order with a real retailer.
- FundCart is not a licensed escrow service and does not pool or hold funds for creators. A production version would need a licensed partner and per-creator payouts.

## One-click demo account

"Try Demo Account" (homepage and sign-in page) starts a server-signed, two-hour, `httpOnly` demo cookie and opens `/demo`:

- a read-only creator dashboard rendered from fixed sample data (progress, payment ledger with `SAMPLE-` order ids, campaign controls shown disabled), labelled as sample data and PayPal Sandbox;
- no password exists, so none can leak;
- the demo cookie is not an account. No API accepts it, it maps to no profile, and the page never reads or writes the database. Supporter emails or private details cannot be reached, and moderator access is impossible;
- demo-session creation is rate-limited per network;
- "Exit demo" removes the cookie.

## Existing campaigns

Campaigns created before this release keep their records, payments, ownership and current status. The new rules apply to every new submission and every new update. Guest-created campaigns can move into an account only through the existing claim process (signing in from the browser that holds the campaign's signed guest cookie). Ownership is never moved automatically.

## Security regression test

The integration suite re-creates the adversarial case that exposed the original gap. A shopping request stating the shopper is a scammer is followed by a campaign with a livelihood category, the purpose "for fun", and a story claiming hard work and savings. The test expects:

- shopping still returns products;
- a guest cannot publish at all;
- a signed-in account gets **high-risk review**, the campaign is not listed and refuses contributions;
- a reworded follow-up from the same account stays high risk.

Alongside it are false-positive cases: scam-awareness courses, denials and quoted speech.
