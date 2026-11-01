import { test, expect } from '@playwright/test';
import { payWithPayPalSandbox } from './helpers';

// Journey A checkout: a shopper buys a found product directly (no campaign), with explicit approval.
// Uses a product already in the 6 h search cache or fetched via Channel3's free product endpoint.
const externalId = process.env.DIRECT_TEST_PRODUCT || 'Jno1842';
const buyer = { email: process.env.SANDBOX_CREATOR_BUYER_EMAIL || '', password: process.env.SANDBOX_CREATOR_BUYER_PASSWORD || '' };

test.skip(!buyer.email || !buyer.password, 'Sandbox buyer credentials not configured');

test('direct checkout: explicit approval → PayPal Sandbox → verified capture → receipt', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(`/checkout/${externalId}`);
  await page.getByRole('checkbox', { name: /I approve this PayPal Sandbox payment/ }).check();
  await payWithPayPalSandbox(page, buyer);
  await expect(page.getByText('Sandbox payment verified ✓')).toBeVisible({ timeout: 90_000 });
  await page.getByRole('link', { name: 'View receipt' }).click();
  await expect(page).toHaveURL(/\/receipt\//);
  await expect(page.getByText(/COMPLETED/).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/evidence/07-direct-receipt.png', fullPage: true });
});
