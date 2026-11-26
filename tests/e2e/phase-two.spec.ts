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
  await expect(page.locator('#campaign-review')).toBeHidden();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#campaign-need')).toBeVisible();
  await expect(page.locator('#campaign-need').getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await expect(page.locator('#campaign-product')).toBeVisible();
  await page.goBack();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: testInfo.outputPath('product-1440.png'), fullPage: true, animations: 'disabled' });
  await page.locator('a[href="/checkout/9kpreIm"]').click();
  await expect(page.getByRole('heading', { name: 'Vivobook 15 Laptop' })).toBeVisible();
});


test('Phase 2 owner status and staff review enforce separate roles', async ({ page, baseURL }, testInfo) => {
  test.skip(process.env.E2E_PHASE2_FIXTURE !== '1', 'Requires the loopback Phase 2 fixture');
  async function signIn(lastDigit: number) {
    const profile = `10000000-0000-4000-8000-00000000000${lastDigit}`;
    const account = '20000000-0000-4000-8000-000000000001';
    const payload = `${profile}.${account}.${Math.floor(Date.now() / 1000) + 600}`;
    const signature = createHmac('sha256', 'phase-two-local-fixture').update(`acct:${payload}`).digest('base64url');
    await page.context().addCookies([{ name: 'fc_acct', value: `${payload}.${signature}`, url: baseURL }]);
  }
  await signIn(4);
  expect((await page.goto('/c/fixture-campaign/status'))?.status()).toBe(404);
  expect((await page.goto('/admin/moderation/fixture-campaign'))?.status()).toBe(404);

  await signIn(1);
  await page.goto('/c/fixture-campaign/status');
  await expect(page.getByText('Under review', { exact: true })).toBeVisible();
  await expect(page.getByText(/No identity or need-verification provider/)).toBeVisible();
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    if (width === 390) await page.screenshot({ path: testInfo.outputPath('campaign-status-390.png'), fullPage: true });
  }

  await signIn(3);
  await page.goto('/admin/moderation/fixture-campaign');
  await expect(page.getByRole('heading', { name: 'Fixture study laptop' })).toBeVisible();
  await expect(page.getByText('A local fixture campaign for a study laptop.')).toBeVisible();
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath(`moderator-review-${width}.png`), fullPage: true });
  }
});

test('Phase 2 authenticated wizard fixture validates, restores and submits its draft', async ({ page, baseURL }) => {
  test.skip(process.env.E2E_PHASE2_FIXTURE !== '1', 'Requires the loopback Phase 2 fixture');
  const payload = `10000000-0000-4000-8000-000000000001.20000000-0000-4000-8000-000000000001.${Math.floor(Date.now() / 1000) + 600}`;
  const signature = createHmac('sha256', 'phase-two-local-fixture').update(`acct:${payload}`).digest('base64url');
  await page.context().addCookies([{ name: 'fc_acct', value: `${payload}.${signature}`, url: baseURL }]);
  let submission: Record<string, unknown> | undefined;
  await page.route('**/api/campaigns', async route => {
    submission = route.request().postDataJSON();
    await route.fulfill({ json: { slug: 'fixture-campaign' } });
  });
  await page.goto('/campaigns/new?product=9kpreIm&own=100');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const need = page.locator('#campaign-need');
  await expect(need.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await need.locator('#name').fill('Fixture creator');
  await need.locator('#need').selectOption('education');
  await need.locator('#purpose').fill('I need a laptop for a local education fixture.');
  await need.getByRole('button', { name: 'Continue', exact: true }).click();
  const story = page.locator('#campaign-story');
  await expect(story.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await story.locator('#title').fill('Fixture study laptop');
  await story.locator('#story').fill('A local fixture campaign for a study laptop.');
  await story.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('draft-restored')).toBeVisible();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByRole('heading', { name: 'Campaign status' })).toBeVisible();
  expect(submission).toMatchObject({ externalId: '9kpreIm', title: 'Fixture study laptop', needCategory: 'education' });
});

test('Phase 2 marketplace fixture filters real rendered campaign cards', async ({ page }, testInfo) => {
  test.skip(process.env.E2E_PHASE2_FIXTURE !== '1', 'Requires the loopback Phase 2 fixture');
  await page.setViewportSize({ width: 390, height: 960 });
  await page.goto('/campaigns');
  await expect(page.getByRole('heading', { name: 'Study laptop fixture' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('marketplace-390.png'), fullPage: true });
  await page.getByRole('searchbox', { name: 'Search needs' }).fill('headphones');
  await page.getByRole('searchbox', { name: 'Search needs' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Study laptop fixture' })).toHaveCount(0);
  await expect(page.getByText('No campaigns yet.')).toBeVisible();
});

test('Phase 2 receipt fixture protects ownership and distinguishes pending captures', async ({ page, baseURL }, testInfo) => {
  test.skip(process.env.E2E_PHASE2_FIXTURE !== '1', 'Requires the loopback Phase 2 fixture');
  await page.goto('/receipt/FIXTUREDONE123');
  await expect(page.getByText('FIXTURECAPTURE', { exact: true })).toHaveCount(0);
  const profileId = '10000000-0000-4000-8000-000000000001';
  const sig = createHmac('sha256', 'phase-two-local-fixture').update(profileId).digest('base64url').slice(0, 32);
  await page.context().addCookies([{ name: 'fc_uid', value: `${profileId}.${sig}`, url: baseURL }]);
  await page.goto('/receipt/FIXTUREPEND123');
  await expect(page.getByText('PENDING', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/verified capture/i)).toHaveCount(0);
  await page.goto('/receipt/FIXTUREDONE123');
  await expect(page.getByText('FIXTURECAPTURE', { exact: true })).toBeVisible();
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath(`receipt-${width}.png`), fullPage: true });
  }
});
