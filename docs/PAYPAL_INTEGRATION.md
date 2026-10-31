# PayPal integration (Sandbox)

FundCart uses the **PayPal Orders v2 REST API** on the server and the **PayPal JavaScript SDK (Smart Buttons)** in the browser. Everything runs in the Sandbox (`api-m.sandbox.paypal.com`). `src/lib/env.ts` throws if `PAYPAL_ENV` is anything but `sandbox`.

## Flows

### A. Direct checkout (`/checkout/[productId]`)

1. The server reloads the product from Channel3 data, so the price is never taken from the browser.
2. The user ticks the approval checkbox.
3. `POST /api/paypal/orders {kind:'direct'}` calls `createOrder`.
   - Request body: `intent: CAPTURE`, one item, `shipping_preference: NO_SHIPPING`.
   - Header: `PayPal-Request-Id: create-<uuid>`.
4. The buyer approves in the PayPal popup.
5. `POST /api/paypal/orders/{id}/capture` runs `captureAndRecord()`:
   - Calls `GET /v2/checkout/orders/{id}`.
   - If `APPROVED`, calls `POST /v2/checkout/orders/{id}/capture` with `PayPal-Request-Id: capture-<id>`.
   - Requires the capture to be `COMPLETED` with an **amount and currency equal** to the stored order.
6. The receipt page shows the order ID, capture ID, statuses, timestamps and event history.

### B. Contribution (`/c/[slug]`)

1. `validateContribution()` enforces min $1, the sandbox max $10,000, integer cents, no overfunding, and that the campaign is `active`.
2. The order is created with `payee.email_address = PAYPAL_CONTRIBUTION_PAYEE_EMAIL`, the sandbox account representing the creator.
3. After capture verification, a `contributions` row is inserted. Unique `payment_order_id` and unique `capture_id` make this **idempotent**.
4. `refreshCampaignStatus()` moves the campaign to `goal_reached` once the verified total is at or above the target. It uses a conditional update, so it runs exactly once.

### C. Purchase approval (`/c/[slug]/manage`)

- Only the campaign owner (HMAC-signed guest cookie) can start it, and only when the status is `goal_reached` **and** the verified total is at or above the target.
- The user must tick an explicit confirmation. That writes a `purchase_approvals` row before the PayPal order is created.
- It is a **separate** order with `payee = PAYPAL_STORE_PAYEE_EMAIL`. After verified capture the campaign becomes `purchased`.

## Webhooks (`/api/paypal/webhook`)

- Every event is verified with `POST /v1/notifications/verify-webhook-signature`. Unverified events get a 401.
- Events are deduplicated by `payment_events.paypal_event_id` (unique), so a repeated delivery is a no-op.
- `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED` reconcile through `captureAndRecord()`. This covers buyers who close the tab after approving.
- `PAYMENT.CAPTURE.REFUNDED` and `PAYMENT.CAPTURE.REVERSED` mark the contribution `REFUNDED` or `REVERSED`. Those are excluded from the verified total.

## Edge cases handled

| Case | Behaviour |
|---|---|
| Buyer cancels in PayPal | `onCancel` shows "Nothing was charged"; the order stays `CREATED`/`APPROVED` and never counts |
| Double click / refresh on capture | `PayPal-Request-Id` + `ORDER_ALREADY_CAPTURED` reconciliation + DB unique constraints |
| Duplicate webhook | Unique `paypal_event_id`; returns `{duplicate:true}` |
| Pending capture | Stored with its status; not counted until `COMPLETED` |
| Amount mismatch | Logged as `capture.mismatch`; not recorded |
| Invalid amount / currency | Rejected server-side (USD only, integer cents) |
| Overfunding | Rejected unless the campaign allows it (off by default) |
| Instrument declined | Friendly message; logged with PayPal `debug_id` |
| Unknown order id | 404, never captured |

## Truthful money model

- FundCart does **not** hold, pool, split or disburse money.
- In the Sandbox demo, contributions go to one sandbox account representing the creator, and the purchase goes to one sandbox account representing the store.
- A production version would onboard each creator's own PayPal account (multiparty / partner onboarding) instead of a single demo recipient.

## Audit trail

- `payment_orders`: one row per PayPal order, with status and capture ID.
- `payment_events`: append-only. A trigger forbids UPDATE and DELETE.
- `contributions`: verified captures only.
- `purchase_approvals`: the exact approval text, the user and the timestamp.
