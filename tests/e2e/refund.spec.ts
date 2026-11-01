import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { payWithPayPalSandbox } from './helpers';

// Controlled PayPal Sandbox refund test (opt-in: RUN_REFUND_TEST=1).
// 1. A supporter contributes $10.00 to an active campaign (real Sandbox capture).
// 2. We refund $4.00, then the remaining $6.00, through the PayPal Refunds API.
// 3. PayPal's PAYMENT.CAPTURE.REFUNDED webhooks must reduce the verified total back to its start value.

const slug = process.env.REFUND_TEST_SLUG || 'help-maya-get-a-inspiron-15-laptop-b86b31';
const supporter = { email: process.env.SANDBOX_SUPPORTER_EMAIL || '', password: process.env.SANDBOX_SUPPORTER_PASSWORD || '' };
const BASE = 'https://api-m.sandbox.paypal.com';
const evidence = 'test-results/evidence';

test.skip(!process.env.RUN_REFUND_TEST || !supporter.email, 'Refund test is opt-in (RUN_REFUND_TEST=1)');

async function token() {
  const r = await fetch(`${BASE}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  return (await r.json()).access_token as string;
}
async function refund(captureId: string, value: string | null, key: string) {
  const r = await fetch(`${BASE}/v2/payments/captures/${captureId}/refund`, { method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `refund-test-${captureId}-${key}`, Prefer: 'return=representation' }, body: JSON.stringify(value ? { amount: { value, currency_code: 'USD' }, note_to_payer: 'FundCart AI sandbox refund test' } : { note_to_payer: 'FundCart AI sandbox refund test' }) });
  return { http: r.status, body: await r.json() };
}
async function raised(page: import('@playwright/test').Page) {
  await page.goto(`/c/${slug}`);
  const t = await page.locator('[data-testid="raised"]').first().innerText();
  return Math.round(parseFloat(t.replace(/[^0-9.]/g, '')) * 100);
}

test('sandbox refund: partial then full refund reduce the verified total', async ({ page, browser }) => {
  test.setTimeout(300_000);
  fs.mkdirSync(evidence, { recursive: true });
  const before = await raised(page);

  const sup = await (await browser.newContext()).newPage();
  await sup.goto(`/c/${slug}`);
  await sup.getByLabel('Amount (USD)').fill('10.00');
  await sup.getByLabel('Your name').fill('Refund test');
  await payWithPayPalSandbox(sup, supporter);
  await expect(sup.getByText('Thank you — contribution verified')).toBeVisible({ timeout: 90_000 });
  const captureId = (await sup.locator('dt:has-text("Capture") + dd').innerText()).trim();
  await expect.poll(() => raised(page), { timeout: 60_000 }).toBe(before + 1000);

  const partial = await refund(captureId, '4.00', 'partial');
  expect(partial.http, JSON.stringify(partial.body)).toBe(201);
  await expect.poll(() => raised(page), { timeout: 120_000, intervals: [5000] }).toBe(before + 600);

  const rest = await refund(captureId, null, 'rest');
  expect(rest.http, JSON.stringify(rest.body)).toBe(201);
  await expect.poll(() => raised(page), { timeout: 120_000, intervals: [5000] }).toBe(before);
  await page.screenshot({ path: `${evidence}/06-after-refund.png`, fullPage: true });

  fs.writeFileSync(`${evidence}/refund.json`, JSON.stringify({ slug, captureId, partialRefund: { id: partial.body.id, status: partial.body.status }, finalRefund: { id: rest.body.id, status: rest.body.status }, before, at: new Date().toISOString() }, null, 2));
});
