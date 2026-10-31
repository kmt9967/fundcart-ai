import { test, expect } from '@playwright/test';

test('public pages render with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const path of ['/', '/assistant', '/campaigns', '/how-it-works', '/disclosures', '/me']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByText('PayPal Sandbox').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('assistant streams agent steps and returns real products', async ({ page }) => {
  await page.goto('/assistant');
  await page.getByLabel('Your request').fill('noise cancelling headphones under $200');
  await page.getByRole('button', { name: 'Find options' }).click();
  await expect(page.getByText('Research Agent').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('article').first()).toBeVisible({ timeout: 90_000 });
  const prices = await page.locator('article .text-xl').allInnerTexts();
  expect(prices.some(p => /^\$\d/.test(p))).toBe(true);
});

test('server rejects tampered payment requests', async ({ request }) => {
  const r1 = await request.post('/api/paypal/orders', { data: { kind: 'contribution', slug: 'does-not-exist', amountCents: 500 } });
  expect(r1.status()).toBe(404);
  const r2 = await request.post('/api/paypal/orders', { data: { kind: 'contribution', slug: 'x', amountCents: 'lots' } });
  expect(r2.status()).toBe(400);
  const r3 = await request.post('/api/paypal/orders/not-an-order/capture');
  expect(r3.status()).toBe(400);
  const r3b = await request.post('/api/paypal/orders/ABCDEFGHIJ123/capture');
  expect(r3b.status()).toBe(404); // unknown order ids are never captured
  const r4 = await request.post('/api/paypal/webhook', { data: { event_type: 'PAYMENT.CAPTURE.COMPLETED' } });
  expect(r4.status()).toBe(401); // unverified webhooks are rejected
});

test('mobile layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/assistant', '/campaigns', '/how-it-works']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
