import { expect, type Page, type Frame } from '@playwright/test';

/** Click the PayPal button inside its iframe and complete Sandbox approval in the popup. */
export async function payWithPayPalSandbox(page: Page, buyer: { email: string; password: string }) {
  const frame = await paypalButtonFrame(page);
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 60_000 }),
    frame.locator('[data-funding-source="paypal"]').first().click(),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  // Login (email → next → password → login). PayPal varies the flow, so handle both layouts.
  const email = popup.locator('#email');
  await email.waitFor({ timeout: 60_000 });
  await email.fill(buyer.email);
  const next = popup.locator('#btnNext');
  if (await next.isVisible().catch(() => false)) await next.click();
  const pwd = popup.locator('#password');
  await pwd.waitFor({ timeout: 60_000 });
  await pwd.fill(buyer.password);
  await popup.locator('#btnLogin').click();
  // Review page → approve.
  const approve = popup.locator('[data-testid="submit-button-initial"], #payment-submit-btn, button:has-text("Complete Purchase"), button:has-text("Pay Now"), button:has-text("Continue to Review")').first();
  await approve.waitFor({ timeout: 90_000 });
  await approve.click();
  await popup.waitForEvent('close', { timeout: 90_000 }).catch(() => {});
}

async function paypalButtonFrame(page: Page): Promise<Frame> {
  await expect(page.locator('iframe[title*="PayPal"]').first()).toBeVisible({ timeout: 60_000 });
  const handle = await page.locator('iframe[title*="PayPal"]').first().elementHandle();
  const frame = await handle!.contentFrame();
  await frame!.locator('[data-funding-source="paypal"]').first().waitFor({ timeout: 60_000 });
  return frame!;
}

/** Local runs only: give a browser context its own simulated client address (x-fc-test-ip, ignored by the
 *  server in Vercel production) so per-IP abuse limits apply per simulated person, not to the whole machine.
 *  Only requests to the local app are tagged; PayPal and other origins are untouched. */
export async function tagLocalClient(ctx: import('@playwright/test').BrowserContext, ip: string) {
  const base = process.env.E2E_BASE_URL || 'http://localhost:3100';
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(base)) return;
  await ctx.route(`${base.replace(/\/$/, '')}/**`, route => route.continue({ headers: { ...route.request().headers(), 'x-fc-test-ip': ip } }));
}
