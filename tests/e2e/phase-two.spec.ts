import { createHmac } from 'node:crypto';
import { test, expect } from '@playwright/test';

test('Phase 2 public layouts fit the requested widths', async ({ page }, testInfo) => {
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const path of ['/', '/assistant', '/campaigns']) {
      expect((await page.goto(path))?.status()).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${path} at ${width}px`).toBeLessThanOrEqual(1);
      if (path === '/') await page.screenshot({ path: testInfo.outputPath(`homepage-${width}.png`), fullPage: true, animations: 'disabled' });
    }
  }
});

test('Phase 2 sends a confirmed brief edit with the previous session', async ({ page }, testInfo) => {
  const sessionId = '2f7ebf34-8b38-4d00-9a77-9b77aa20bcfb';
  const requests: Array<Record<string, unknown>> = [];
  const products = ['A', 'B', 'C', 'D'].map((name, index) => ({
    externalId: `fixture-${name}`, title: `Fixture laptop ${name}`, brand: 'Fixture', priceCents: 42000 + index * 1500,
    imageUrl: '/stitch/hardware-studio.webp', specs: { kind: 'laptop', condition: null }, rank: index,
    evaluation: { status: 'suitable', tier: 'minimum', checks: [], unknownReasons: [], failReasons: [], withinBudget: true },
  }));
  await page.route('**/api/assistant/bundle', route => route.fulfill({
    json: { products },
  }));
  await page.route('**/api/assistant', async route => {
    const request = route.request().postDataJSON();
    requests.push(request);
    const amount = request.brief?.budget?.amountMinor ?? 70000;
    const result = {
      kind: 'results', sessionId, message: null, links: [], state: {
        turn: requests.length, category: 'laptop', goal: 'Android Studio', stated: [], brandsExclude: [], softPreferences: [],
        budget: { maxCents: amount, currency: 'USD', usable: true, raw: `$${amount / 100}` },
      },
      profile: null, requirements: [], products, bestFit: products.map(product => product.externalId), cheapestAdequate: [],
      unsuitable: [], needsVerification: [], kit: { id: 'home_office', title: 'Home office', items: ['Office desk', 'Monitor'] },
      mode: 'best_fit', picks: [], summary: '', compareIds: [], safety: { flags: [], piiRedacted: false },
      budget: { usable: true, budgetCents: amount, rejections: [], note: '' }, funding: { available: false },
      dataSource: { provider: 'Channel3 fixture', fetchedAt: '2026-11-26T00:00:00Z', cached: false, queries: 1 },
    };
    await route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'result', result }) + '\n' });
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/assistant?q=Find+a+laptop');
  const brief = page.getByRole('region', { name: 'Shopping Brief' });
  await expect(brief.getByLabel('Maximum budget')).toHaveValue('700.00');
  await brief.getByLabel('Maximum budget').fill('600');
  await brief.getByRole('button', { name: 'Apply and update results' }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]).toMatchObject({ conversationId: sessionId, brief: { budget: { amountMinor: 60000, currency: 'USD' } } });
  await expect(page.getByText('$600.00', { exact: false }).first()).toBeVisible();
  const desk = page.getByRole('listitem').filter({ hasText: 'Office desk' });
  await desk.getByRole('button', { name: 'Find options' }).click();
  await desk.getByRole('combobox').selectOption(products[0].externalId);
  await expect(page.getByText('Known item total')).toContainText('$420.00');
  for (const card of await page.locator('article').all()) await card.getByRole('checkbox', { name: 'Compare' }).check();
  await expect(page.locator('#compare').getByRole('link')).toHaveCount(4);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('workspace-1440.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('workspace-390.png'), fullPage: true, animations: 'disabled' });
});


test('Phase 2 product details connect to affordability, draft and Sandbox checkout', async ({ page, baseURL }, testInfo) => {
  test.skip(process.env.E2E_PHASE2_FIXTURE !== '1', 'Requires the loopback Phase 2 catalog fixture');
  const owner = '10000000-0000-4000-8000-000000000001';
  const session = '10000000-0000-4000-8000-000000000002';
  const signature = createHmac('sha256', 'phase-two-local-fixture').update(owner).digest('base64url').slice(0, 32);
  await page.context().addCookies([{ name: 'fc_uid', value: `${owner}.${signature}`, url: baseURL }]);
  await page.setViewportSize({ width: 390, height: 960 });
  await page.goto(`/products/9kpreIm?s=${session}`);
  await expect(page.getByRole('heading', { name: 'Vivobook 15 Laptop' })).toBeVisible();
  await expect(page.getByText('Unquoted', { exact: true })).toHaveCount(2);
  await expect(page.getByText('$100.00', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('product-390.png'), fullPage: true, animations: 'disabled' });
  await page.locator('a[href^="/campaigns/new"]').click();
  await expect(page.locator('#campaign-review')).toBeVisible();
  await expect(page.locator('#campaign-story')).toBeVisible();
  await expect(page.locator('#campaign-need')).toBeVisible();
  await expect(page.locator('#campaign-product')).toBeVisible();
  await page.goBack();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: testInfo.outputPath('product-1440.png'), fullPage: true, animations: 'disabled' });
  await page.locator('a[href="/checkout/9kpreIm"]').click();
  await expect(page.getByRole('heading', { name: 'Vivobook 15 Laptop' })).toBeVisible();
});
