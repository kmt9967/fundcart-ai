import { createHmac } from 'node:crypto';
import { test, expect } from '@playwright/test';

test('Phase 2 public layouts fit the requested widths', async ({ page }, testInfo) => {
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const path of ['/', '/assistant', '/campaigns']) {
      expect((await page.goto(path))?.status()).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${path} at ${width}px`).toBeLessThanOrEqual(1);
      if (path === '/') {
        if (width < 1024) await expect(page.getByRole('link', { name: 'Discover', exact: true })).toHaveAttribute('aria-current', 'page');
        if (process.env.E2E_PHASE2_FIXTURE === '1') {
          const campaign = page.getByRole('listitem').filter({ hasText: 'Study laptop fixture' });
          await expect(campaign.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '37');
          await expect(campaign.getByRole('link')).toHaveAttribute('href', /^\/c\//);
        }
        await page.screenshot({ path: testInfo.outputPath(`homepage-${width}.png`), fullPage: true, animations: 'disabled' });
      }
    }
  }
});

test('Phase 2 sends a confirmed brief edit with the previous session', async ({ page, baseURL }, testInfo) => {
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
  const customName = page.getByLabel('Custom component', { exact: true });
  await customName.fill('Cable organizer');
  await page.getByRole('button', { name: 'Add component' }).click();
  const customSlot = page.getByRole('listitem').filter({ hasText: 'Cable organizer' });
  await customSlot.getByRole('button', { name: 'Find options' }).click();
  await customSlot.getByRole('combobox').selectOption(products[0].externalId);
  await expect(page.getByText('Known item total')).toContainText('$840.00');
  await page.getByRole('button', { name: 'Save selections on this device' }).click();
  await page.getByRole('button', { name: 'Remove Cable organizer' }).click();
  await page.getByRole('button', { name: 'Load from this device' }).click();
  await customSlot.getByRole('button', { name: 'Find options' }).click();
  await expect(customSlot.getByRole('combobox')).toHaveValue(products[0].externalId);
  await page.getByRole('button', { name: 'Remove Cable organizer' }).click();
  await desk.getByRole('button', { name: 'Find options' }).click();
  for (const card of await page.locator('article').all()) await card.getByRole('checkbox', { name: 'Compare' }).check();
  await expect(page.locator('#compare').getByRole('link')).toHaveCount(4);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`workspace-${width}.png`), fullPage: true, animations: 'disabled' });
    if (width === 390) {
      const briefToggle = page.getByRole('button', { name: 'Shopping Brief', exact: true });
      await expect(briefToggle).toHaveAttribute('aria-expanded', 'false');
      await briefToggle.click();
      await expect(brief.getByLabel('Maximum budget')).toHaveValue(/^600(?:\.00)?$/);
      await briefToggle.click();
      const candidate = page.locator('#compare').getByRole('button', { name: 'Fixture laptop B', exact: true });
      await candidate.click();
      await expect(candidate).toHaveAttribute('aria-pressed', 'true');
    }
    await page.locator('#compare').screenshot({ path: testInfo.outputPath(`comparison-${width}.png`), animations: 'disabled' });
  }
  for (const [lang, label] of [['ur', 'حسب ضرورت جزو'], ['es', 'Componente personalizado'], ['fr', 'Composant personnalisé']]) {
    await page.context().addCookies([{ name: 'fc_lang', value: lang, url: baseURL }]);
    await page.setViewportSize({ width: 390, height: 960 });
    await page.goto('/assistant?q=Home+office');
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ur' ? 'rtl' : 'ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
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
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`product-${width}.png`), fullPage: true, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 960 });
  await page.locator('a[href^="/campaigns/new"]').click();
  await expect(page.locator('#campaign-review')).toBeHidden();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#campaign-need')).toBeVisible();
  await expect(page.locator('#campaign-need').getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await expect(page.locator('#campaign-product')).toBeVisible();
  await page.goBack();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.locator('a[href="/checkout/9kpreIm"]').click();
  await expect(page.getByRole('heading', { name: 'Vivobook 15 Laptop' })).toBeVisible();
});


async function captureWidths(page: import('@playwright/test').Page, testInfo: import('@playwright/test').TestInfo, name: string, selector?: string) {
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const options = { path: testInfo.outputPath(`${name}-${width}.png`), animations: 'disabled' as const };
    if (selector) await page.locator(selector).screenshot(options);
    else await page.screenshot({ ...options, fullPage: true });
  }
}

test('Phase 2 campaign detail and checkout display recorded funding and validate the amount', async ({ page }, testInfo) => {
  test.skip(process.env.E2E_PHASE2_FIXTURE !== '1', 'Requires the loopback Phase 2 fixture');
  expect((await page.goto('/c/unavailable-campaign'))?.status()).toBe(404);
  await page.goto('/c/audio-fixture');
  await expect(page.getByRole('heading', { name: 'Audio production equipment fixture' })).toBeVisible();
  await expect(page.getByText('Fixture supporter', { exact: true })).toHaveCount(0);
  await page.goto('/c/market-fixture');
  await expect(page.getByRole('heading', { name: 'Study laptop fixture' })).toBeVisible();
  await expect(page.getByTestId('raised')).toContainText('$148.00');
  await expect(page.getByText('Fixture supporter', { exact: true })).toBeVisible();
  await captureWidths(page, testInfo, 'campaign-detail');
  await captureWidths(page, testInfo, 'contribution-checkout', '#support');
  await page.locator('#amt').fill('999');
  await expect(page.locator('#amt')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#support').getByRole('button', { name: '$25.00', exact: true }).click();
  await expect(page.locator('#amt')).toHaveAttribute('aria-invalid', 'false');
});

test('Phase 2 owner status and staff review enforce separate roles', async ({ page, baseURL }, testInfo) => {
  test.skip(process.env.E2E_PHASE2_FIXTURE !== '1', 'Requires the loopback Phase 2 fixture');
  async function signIn(lastDigit: number) {
    const profile = `10000000-0000-4000-8000-00000000000${lastDigit}`;
    const account = '20000000-0000-4000-8000-000000000001';
    const payload = `${profile}.${account}.${Math.floor(Date.now() / 1000) + 600}`;
    const signature = createHmac('sha256', 'phase-two-local-fixture').update(`acct:${payload}`).digest('base64url');
    const guest = createHmac('sha256', 'phase-two-local-fixture').update(profile).digest('base64url').slice(0, 32);
    await page.context().addCookies([
      { name: 'fc_acct', value: `${payload}.${signature}`, url: baseURL },
      { name: 'fc_uid', value: `${profile}.${guest}`, url: baseURL },
    ]);
  }
  await signIn(4);
  expect((await page.goto('/c/fixture-campaign/status'))?.status()).toBe(404);
  expect((await page.goto('/admin/moderation/fixture-campaign'))?.status()).toBe(404);

  await page.goto('/c/market-fixture/manage');
  await expect(page.getByTestId('ledger-rows')).toHaveCount(0);
  await page.goto('/admin/moderation');
  await expect(page.getByTestId('forbidden')).toBeVisible();

  await signIn(1);
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: 'Study laptop fixture' })).toBeVisible();
  await captureWidths(page, testInfo, 'creator-dashboard');
  await page.goto('/c/market-fixture/manage');
  await expect(page.getByTestId('ledger-rows')).toBeVisible();
  await expect(page.getByText('PAYMENT.CAPTURE.COMPLETED')).toBeVisible();
  await captureWidths(page, testInfo, 'funding-ledger');
  await page.goto('/c/workspace-fixture/manage');
  await expect(page.getByRole('heading', { name: 'Approve your purchase' })).toBeVisible();
  await captureWidths(page, testInfo, 'purchase-approval', '[data-testid="purchase-panel"]');

  await page.goto('/c/fixture-campaign/status');
  await expect(page.getByText('Under review', { exact: true })).toBeVisible();
  await expect(page.getByText(/No identity or need-verification provider/)).toBeVisible();
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`campaign-status-${width}.png`), fullPage: true });
  }

  await signIn(3);
  await page.goto('/admin/moderation');
  await expect(page.getByTestId('queue-item')).toHaveCount(1);
  await page.getByRole('link', { name: 'Reported 0' }).click();
  await expect(page.getByTestId('queue-empty')).toBeVisible();
  await page.getByRole('link', { name: 'Pending review 1' }).click();
  await expect(page.getByTestId('queue-item')).toHaveCount(1);
  await captureWidths(page, testInfo, 'moderator-queue');
  await page.getByTestId('queue-item').getByRole('link', { name: 'Fixture study laptop', exact: true }).click();
  await expect(page.getByTestId('mod-approve')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fixture study laptop' })).toBeVisible();
  await expect(page.getByText('A local fixture campaign for a study laptop.')).toBeVisible();
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`moderator-review-${width}.png`), fullPage: true });
  }
});

test('Phase 2 authenticated wizard fixture validates, restores and submits its draft', async ({ page, baseURL }, testInfo) => {
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
  await captureWidths(page, testInfo, 'wizard-product');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const need = page.locator('#campaign-need');
  await expect(need.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await need.locator('#name').fill('Fixture creator');
  await need.locator('#need').selectOption('education');
  await need.locator('#purpose').fill('I need a laptop for a local education fixture.');
  await captureWidths(page, testInfo, 'wizard-funding');
  await need.getByRole('button', { name: 'Continue', exact: true }).click();
  const story = page.locator('#campaign-story');
  await expect(story.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await story.locator('#title').fill('Fixture study laptop');
  await story.locator('#story').fill('A local fixture campaign for a study laptop.');
  await captureWidths(page, testInfo, 'wizard-story');
  await story.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('draft-restored')).toBeVisible();
  await captureWidths(page, testInfo, 'campaign-wizard');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByRole('heading', { name: 'Campaign status' })).toBeVisible();
  expect(submission).toMatchObject({ externalId: '9kpreIm', title: 'Fixture study laptop', needCategory: 'education' });
});

test('Phase 2 marketplace fixture filters real rendered campaign cards', async ({ page }, testInfo) => {
  test.skip(process.env.E2E_PHASE2_FIXTURE !== '1', 'Requires the loopback Phase 2 fixture');
  await page.setViewportSize({ width: 390, height: 960 });
  await page.goto('/campaigns');
  await expect(page.getByRole('heading', { name: 'Study laptop fixture' })).toBeInViewport();
  await expect(page.getByRole('complementary', { name: 'Campaigns shown' })).toContainText('$943.00');
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`marketplace-${width}.png`), fullPage: true, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 960 });
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
  await page.goto('/receipt/FIXTUREFAIL123');
  await expect(page.getByText('DECLINED', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/verified capture/i)).toHaveCount(0);
  await page.goto('/receipt/FIXTUREDONE123');
  await expect(page.getByText('FIXTURECAPTURE', { exact: true })).toBeVisible();
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`receipt-${width}.png`), fullPage: true });
  }
});


test('Phase 2 account shopping persists across independent contexts and is private', async ({ browser, baseURL }) => {
  test.skip(process.env.E2E_PHASE2_FIXTURE !== '1', 'Requires the loopback Phase 2 fixture');
  const source = await browser.newContext({ baseURL });
  const reopened = await browser.newContext({ baseURL });
  const unrelated = await browser.newContext({ baseURL });
  try {
    for (const [context, owner] of [[source, '1'], [reopened, '1'], [unrelated, '4']] as const) {
      const payload = `10000000-0000-4000-8000-00000000000${owner}.20000000-0000-4000-8000-000000000001.${Math.floor(Date.now() / 1000) + 600}`;
      const signature = createHmac('sha256', 'phase-two-local-fixture').update(`acct:${payload}`).digest('base64url');
      await context.addCookies([{ name: 'fc_acct', value: `${payload}.${signature}`, url: baseURL }]);
    }
    const path = '/api/assistant/bundle/saved';
    const bundle = {
      kitId: 'home_office', name: 'Independent context fixture',
      selections: [null, null, null, null, null, { label: 'Cable organizer', required: false, offerId: 'fixture-A' }],
    };
    expect((await source.request.put(path, { data: bundle })).status()).toBe(204);
    const get = (context: typeof reopened) => context.request.get(`${path}?kit=home_office`);
    const saved = await get(reopened);
    expect(saved.ok()).toBe(true);
    expect(await saved.json()).toEqual([expect.objectContaining({ name: bundle.name, selections: bundle.selections })]);
    const denied = await get(unrelated);
    expect(denied.ok()).toBe(true);
    expect(await denied.json()).toEqual([]);

    const history = '/api/assistant/history/10000000-0000-4000-8000-000000000009';
    const savedSet = { name: 'Independent context result', compare: ['fixture-A', 'fixture-B'] };
    expect((await unrelated.request.patch(history, { data: savedSet })).status()).toBe(404);
    expect((await source.request.patch(history, { data: savedSet })).status()).toBe(204);
    const secondPage = await reopened.newPage();
    await secondPage.goto('/assistant');
    await secondPage.getByText('Recent shopping sessions', { exact: true }).click();
    await expect(secondPage.getByRole('link', { name: /Independent context result/ })).toBeVisible();
    await secondPage.route('**/api/assistant', async route => {
      const products = ['A', 'B'].map((letter, index) => ({
        externalId: `fixture-${letter}`, title: `Refreshed laptop ${letter}`, priceCents: 49000 + index * 500,
        specs: { kind: 'laptop', condition: null }, keyFeatures: [],
        evaluation: { status: 'suitable', tier: 'minimum', checks: [], unknownReasons: [], failReasons: [], withinBudget: true },
      }));
      await route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'result', result: {
        kind: 'results', sessionId: null, state: null, profile: null, requirements: [], products, bestFit: products.map(product => product.externalId),
        cheapestAdequate: [], needsVerification: [], unsuitable: [], mode: 'best_fit', picks: [], summary: '', compareIds: [],
        safety: { flags: [], piiRedacted: false }, budget: { usable: false, rejections: [], note: '' },
        dataSource: { provider: 'Fixture', fetchedAt: '2026-11-26T00:00:00Z' }, funding: { available: false },
      } }) + '\n' });
    });
    await secondPage.getByRole('link', { name: /Independent context result/ }).click();
    const historical = secondPage.getByRole('region', { name: 'Historical offers' });
    await expect(historical.getByRole('listitem').filter({ hasText: 'Fixture laptop A' })).toContainText(/Saved \$420\.00.*Current \$490\.00/);
    await expect(historical.getByText(/Not in refreshed results/)).toBeVisible();
    await expect(secondPage.locator('#compare').getByRole('link')).toHaveCount(2);
    expect((await unrelated.request.delete(`${history}?scope=thread`)).status()).toBe(404);
    expect((await source.request.delete(`${history}?scope=thread`)).status()).toBe(204);
    await secondPage.reload();
    await expect(secondPage.getByRole('link', { name: /Independent context result/, includeHidden: true })).toHaveCount(0);
  } finally {
    await Promise.all([source.close(), reopened.close(), unrelated.close()]);
  }
});


test('local voice input fills the editable prompt without sending a request', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      processLocally = false;
      lang = '';
      onresult?: (event: { results: { transcript: string }[][] }) => void;
      onend?: () => void;
      start() {
        if (!this.processLocally || this.lang !== 'en-US') throw new Error('Wrong voice mode');
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: 'Find a laptop under $700' }]] });
          this.onend?.();
        }, 1);
      }
      abort() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition });
  });
  let requests = 0;
  await page.route('**/api/assistant', async route => {
    requests++;
    await route.fulfill({ json: {} });
  });
  const response = await page.goto('/assistant');
  expect(response?.headers()['permissions-policy']).toContain('microphone=(self)');
  await page.getByRole('button', { name: 'Dictate locally' }).click();
  await expect(page.getByLabel('Your request')).toHaveValue('Find a laptop under $700');
  expect(requests).toBe(0);
});


test('image-assisted shopping requires an account and leaves the suggestion editable', async ({ page, baseURL }) => {
  test.skip(process.env.E2E_PHASE2_FIXTURE !== '1', 'Requires the loopback account fixture');
  const api = '/api/assistant/image';
  expect((await page.request.post(api, { data: 'not an image' })).status()).toBe(401);
  const payload = `10000000-0000-4000-8000-000000000001.20000000-0000-4000-8000-000000000001.${Math.floor(Date.now() / 1000) + 600}`;
  const signature = createHmac('sha256', 'phase-two-local-fixture').update(`acct:${payload}`).digest('base64url');
  await page.context().addCookies([{ name: 'fc_acct', value: `${payload}.${signature}`, url: baseURL }]);
  expect((await page.request.post(api, { data: 'not an image' })).status()).toBe(415);
  let imageRequests = 0;
  let searchRequests = 0;
  await page.route('**/api/assistant', async route => {
    searchRequests++;
    await route.fulfill({ json: {} });
  });
  await page.route('**/api/assistant/image', async route => {
    imageRequests++;
    expect(route.request().headers()['content-type']).toBe('image/jpeg');
    const bytes = route.request().postDataBuffer();
    expect(bytes?.subarray(0, 3).toString('hex')).toBe('ffd8ff');
    await route.fulfill({ json: { query: 'compact mechanical keyboard' } });
  });
  await page.goto('/assistant');
  const png = await page.evaluate(() => document.createElement('canvas').toDataURL('image/png').split(',')[1]);
  await page.getByText('Search with a product photo', { exact: true }).click();
  await page.getByLabel('Search with a product photo').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  expect(imageRequests).toBe(0);
  await page.getByRole('button', { name: 'Suggest search terms' }).click();
  await expect(page.getByLabel('Your request')).toHaveValue('compact mechanical keyboard');
  expect(imageRequests).toBe(1);
  expect(searchRequests).toBe(0);
});
