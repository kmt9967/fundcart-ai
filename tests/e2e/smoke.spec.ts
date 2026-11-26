import { test, expect } from '@playwright/test';

test('public pages render with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const path of ['/', '/assistant', '/campaigns', '/how-it-works', '/disclosures', '/me']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByText('PayPal Sandbox').filter({ visible: true }).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('assistant streams agent steps and returns real products', async ({ page }) => {
  test.skip(process.env.E2E_PHASE2_FIXTURE === '1', 'Requires an isolated catalog provider');
  await page.goto('/assistant');
  await page.getByLabel('Your request').fill('noise cancelling headphones under $200');
  await page.getByRole('button', { name: 'Find options' }).click();
  await expect(page.getByText('Research Agent').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('article').first()).toBeVisible({ timeout: 90_000 });
  const prices = await page.locator('article .text-xl').allInnerTexts();
  expect(prices.some(p => /^\$\d/.test(p))).toBe(true);
});

test('server rejects tampered payment requests', async ({ request }) => {
  test.skip(process.env.E2E_PHASE2_FIXTURE === '1', 'Requires isolated Sandbox payment configuration');
  const r1 = await request.post('/api/paypal/orders', { data: { kind: 'contribution', slug: 'does-not-exist', amountCents: 500 } });
  expect(r1.status()).toBe(404);
  const r2 = await request.post('/api/paypal/orders', { data: { kind: 'contribution', slug: 'x', amountCents: 'lots' } });
  expect(r2.status()).toBe(400);
  const r3 = await request.post('/api/paypal/orders/not-an-order/capture');
  expect(r3.status()).toBe(400);
  const r3b = await request.post('/api/paypal/orders/ABCDEFGHIJ123/capture');
  expect(r3b.status()).toBe(404); // unknown order ids are never captured
  const r4 = await request.post('/api/paypal/webhook', { data: { id: 'UNSIGNED-FIXTURE', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAPTURE-FIXTURE' } } });
  expect(r4.status()).toBe(401); // unverified webhooks are rejected
});

test('mobile navigation menu opens, navigates and closes', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open menu' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  const menu = page.locator('#mobile-menu');
  await expect(menu).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await menu.getByRole('link', { name: /Campaigns/ }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
  await expect(menu).toBeHidden();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
});

test('mobile layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ['/', '/assistant', '/campaigns', '/how-it-works', '/disclosures', '/me']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test('assistant shows an ordinal selection on desktop and in Urdu on mobile', async ({ page, baseURL }, testInfo) => {
  const product = {
    externalId: 'fixture-second', title: 'Fixture laptop — second result', brand: null, priceCents: 50000,
    compareAtCents: null, merchantDomain: null, offerUrl: null, imageUrl: null, imageAlt: null,
    keyFeatures: [], rating: null, ratingCount: null, fetchedAt: '2026-11-26T00:00:00Z',
    specs: { kind: 'laptop', condition: null }, rank: 0,
    evaluation: { status: 'suitable', tier: 'minimum', checks: [], unknownReasons: [], failReasons: [], withinBudget: true },
  };
  await page.route('**/api/assistant', async route => {
    const { prompt, conversationId, previousMode } = route.request().postDataJSON();
    const selection = prompt.includes('second');
    if (selection) {
      expect(conversationId).toBe('2f7ebf34-8b38-4d00-9a77-9b77aa20bcfb');
      expect(previousMode).toBe('best_fit');
    }
    const result = {
      kind: 'results', message: null, links: [], sessionId: '2f7ebf34-8b38-4d00-9a77-9b77aa20bcfb',
      state: null, profile: null, requirements: [], products: [product], bestFit: [product.externalId],
      cheapestAdequate: [product.externalId], needsVerification: [], unsuitable: [],
      mode: 'best_fit', picks: [], summary: '', followUp: null,
      budget: { usable: false, rejections: [], note: '' },
      compareIds: [], selectedId: selection ? product.externalId : undefined,
      dataSource: { provider: 'Channel3', fetchedAt: product.fetchedAt, cached: false, queries: 1 },
      safety: { flags: [], piiRedacted: false }, funding: { available: false },
    };
    await route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'result', result }) + '\n' });
  });

  for (const mobile of [false, true]) {
    await page.context().addCookies([{ name: 'fc_lang', value: mobile ? 'ur' : 'en', url: baseURL }]);
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/assistant?q=Find+a+laptop');
    const refinement = page.locator('#refine');
    await refinement.fill('Show the second one');
    await refinement.press('Enter');
    const selection = page.getByRole('region', { name: product.title });
    await expect(selection).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', mobile ? 'rtl' : 'ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await selection.screenshot({ path: testInfo.outputPath(mobile ? 'assistant-ordinal-urdu.png' : 'assistant-ordinal-desktop.png') });
  }
});
