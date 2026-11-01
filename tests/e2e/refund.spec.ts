import { test, expect } from '@playwright/test';

// Refund authority test (opt-in: RUN_REFUND_TEST=1, REFUND_TEST_CAPTURE=<a contribution capture id>).
// Contributions are paid directly to the campaign recipient's PayPal account (single-recipient model),
// so the FundCart platform credentials must NOT be able to refund (pull back) a recipient's money.
// Refunds are issued by the recipient in their own PayPal account; PayPal then reports them to our
// verified webhook (PAYMENT.CAPTURE.REFUNDED), which reduces the verified total (see src/lib/payments.ts applyRefund).

const captureId = process.env.REFUND_TEST_CAPTURE || '';
const BASE = 'https://api-m.sandbox.paypal.com';

test.skip(!process.env.RUN_REFUND_TEST || !captureId, 'Opt-in: RUN_REFUND_TEST=1 REFUND_TEST_CAPTURE=<id>');

test('platform credentials cannot refund a capture paid to the campaign recipient', async () => {
  const tok = await fetch(`${BASE}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const access = (await tok.json()).access_token as string;
  const auth = { Authorization: `Bearer ${access}` };

  // The platform can read the capture (to reconcile status)...
  const cap = await fetch(`${BASE}/v2/payments/captures/${captureId}`, { headers: auth });
  expect(cap.status).toBe(200);

  // ...but cannot move the recipient's money.
  const r = await fetch(`${BASE}/v2/payments/captures/${captureId}/refund`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', 'PayPal-Request-Id': `authority-test-${captureId}` }, body: JSON.stringify({ amount: { value: '1.00', currency_code: 'USD' } }) });
  const body = await r.json();
  expect(r.status).toBe(403);
  expect(body.details?.[0]?.issue).toBe('PERMISSION_DENIED');
});
