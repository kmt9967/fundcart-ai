import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { payWithPayPalSandbox } from './helpers';

// Full integrated journey with REAL PayPal Sandbox payments:
// ask AI → real Channel3 products → compare → fund this → AI campaign draft → publish →
// supporter contributes (PayPal Sandbox) → verified progress → goal reached → creator approves
// a separate Sandbox purchase → receipt and audit history.

const supporter = { email: process.env.SANDBOX_SUPPORTER_EMAIL || '', password: process.env.SANDBOX_SUPPORTER_PASSWORD || '' };
const creatorBuyer = { email: process.env.SANDBOX_CREATOR_BUYER_EMAIL || process.env.SANDBOX_SUPPORTER_EMAIL || '', password: process.env.SANDBOX_CREATOR_BUYER_PASSWORD || process.env.SANDBOX_SUPPORTER_PASSWORD || '' };
const evidence = 'test-results/evidence';

test.skip(!supporter.email || !supporter.password, 'Sandbox buyer credentials not configured');

test('end-to-end: shop → fund → contribute → goal → approve purchase', async ({ browser }) => {
  fs.mkdirSync(evidence, { recursive: true });
  const creator = await browser.newContext(); // creator identity (guest cookie)
  const page = await creator.newPage();

  // 1-3. Ask the AI and get real products.
  await page.goto('/assistant');
  await page.getByLabel('Your request').fill('I need a laptop for university under $700');
  await page.getByLabel('I already have (optional)').fill('200');
  await page.getByRole('button', { name: 'Find options' }).click();
  await expect(page.locator('article').first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/Live data: Channel3/)).toBeVisible();
  await page.screenshot({ path: `${evidence}/01-assistant-results.png`, fullPage: true });

  // 4. Compare two products.
  const compare = page.getByRole('checkbox', { name: 'Compare' });
  await compare.nth(0).check(); await compare.nth(1).check();
  await expect(page.getByText('Side-by-side comparison')).toBeVisible();

  // 5-6. Choose the cheapest card with a gap and create a campaign.
  await page.getByRole('link', { name: 'Fund this' }).first().click();
  await expect(page.getByRole('heading', { name: 'Fund the gap together' })).toBeVisible();
  await page.getByLabel('Your first name').fill('Maya');
  await page.getByLabel('Why do you need it?').fill('I am starting my computer science degree and my old laptop cannot run the course software.');
  await page.getByRole('button', { name: /Draft my campaign with AI/ }).click();
  await expect(page.getByLabel('Campaign title')).not.toHaveValue('', { timeout: 60_000 });
  const goalText = await page.locator('dd.text-sun').first().innerText();
  await page.screenshot({ path: `${evidence}/02-campaign-builder.png`, fullPage: true });
  await page.getByRole('button', { name: 'Publish campaign' }).click();
  await page.waitForURL(/\/c\/[a-z0-9-]+/, { timeout: 60_000 });
  const campaignUrl = page.url().split('?')[0];
  await expect(page.getByText(/Your campaign is live/)).toBeVisible();

  // 7-9. A different person (new context) opens the public campaign and contributes the full goal.
  const sup = await browser.newContext();
  const sp = await sup.newPage();
  await sp.goto(campaignUrl);
  const goalCents = Math.round(parseFloat(goalText.replace(/[$,]/g, '')) * 100);
  await sp.getByLabel('Amount (USD)').fill((goalCents / 100).toFixed(2));
  await sp.getByLabel('Your name').fill('Sam');
  await sp.getByLabel('Message (optional)').fill('Good luck with your degree!');
  await payWithPayPalSandbox(sp, supporter);
  await expect(sp.getByText('Thank you — contribution verified')).toBeVisible({ timeout: 90_000 });
  const captureId = await sp.locator('dt:has-text("Capture") + dd').innerText();
  await sp.screenshot({ path: `${evidence}/03-contribution-verified.png`, fullPage: true });

  // 10. Goal reached with verified funds.
  await page.goto(campaignUrl);
  await expect(page.getByText('Goal reached').first()).toBeVisible();

  // 11. Creator approves a separate purchase.
  await page.goto(`${campaignUrl}/manage`);
  await expect(page.getByRole('heading', { name: 'Approve your purchase' })).toBeVisible();
  await page.screenshot({ path: `${evidence}/04-dashboard-goal-reached.png`, fullPage: true });
  await page.getByRole('checkbox', { name: /I approve a separate PayPal Sandbox payment/ }).check();
  await payWithPayPalSandbox(page, creatorBuyer);
  await expect(page.getByText('Purchase completed ✓')).toBeVisible({ timeout: 90_000 });

  // 12. History shows both payments with PayPal references.
  await page.reload();
  await expect(page.getByText('order.captured').first()).toBeVisible();
  await expect(page.getByText('campaign.goal_reached')).toBeVisible();
  await page.screenshot({ path: `${evidence}/05-dashboard-history.png`, fullPage: true });

  fs.writeFileSync(`${evidence}/journey.json`, JSON.stringify({ campaignUrl, goalCents, contributionCaptureId: captureId, at: new Date().toISOString() }, null, 2));
});
