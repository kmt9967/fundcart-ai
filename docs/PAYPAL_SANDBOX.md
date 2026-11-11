# PayPal Sandbox integration

**Everything payment-related in FundCart runs in the PayPal Sandbox. It is a simulation: no real
money moves and no real product is bought.** Live payments are not enabled.

## Flows

1. **Direct purchase** (no campaign): the person approves a Sandbox checkout for a product. The
   server prices the order from catalog data.
2. **Contribution**: a supporter contributes to an active, moderation-approved campaign that their
   country policy allows. Contributions count only after PayPal confirms a COMPLETED capture whose
   amount and currency match the server-priced order.
3. **Campaign purchase**: only the campaign owner, only when verified contributions reach the goal,
   only with explicit confirmation. The live price is re-checked first; if it rose beyond the
   disclosed buffer, the purchase is paused and supporters are told.

## Human-controlled payments

The AI never starts, approves, captures or refunds a payment. Every payment needs the person's
explicit approval inside PayPal's hosted flow, and FundCart never sees card details.

## Integrity

- Orders v2 with server-side pricing; client-supplied amounts are validated against limits.
- Capture with a PayPal-Request-Id; unique constraints on capture id and payment order id, so
  double clicks, refreshes and webhook retries cannot record a contribution twice.
- A repeated identical contribution request within two minutes reuses the open order.
- Webhooks are signature-verified through PayPal and deduplicated by event id.
- Refunds and reversals reduce the verified total; the campaign returns to "active" if it falls
  below the goal, which locks the purchase again.
- `payment_events` is append-only.
- Receipts are recorded after a verified capture; they are emailed only when an email provider is
  configured, and the interface never claims an email was delivered otherwise.

## Prototype payment model

In this prototype, every contribution order names **one Sandbox merchant account configured by
FundCart** as the payee (`PAYPAL_CONTRIBUTION_PAYEE_EMAIL`). It is the same for every campaign and is
never the creator's personal PayPal account. Each order is stored with its campaign id, and a campaign's
total counts only verified COMPLETED captures for the exact amount. The purchase is a separate Sandbox
checkout paid to a separate demo-store merchant (`PAYPAL_STORE_PAYEE_EMAIL`). A production version
would route contributions through a licensed partner and pay the retailer directly, so that donated
money never reaches the beneficiary as cash. Refunds of contributions can be issued only by the
receiving merchant account, not by the platform's API credentials.
