// Checks that PayPal Smart Buttons render fully inside the viewport on emulated phones (no payment is made).
// Usage: node tests/responsive/paypal-mobile.mjs <baseUrl> <outDir>
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:3200').replace(/\/$/, '');
const OUT = process.argv[3] || 'private/responsive/paypal';
fs.mkdirSync(OUT, { recursive: true });
const ACTIVE = process.env.AUDIT_ACTIVE || 'help-maya-get-a-inspiron-15-laptop-b86b31';
const PRODUCT = process.env.AUDIT_PRODUCT || 'Jno1842';

const targets = [
  { name: 'iphone13', device: devices['iPhone 13'] },
  { name: 'iphone-se', device: { ...devices['iPhone SE'] } },
  { name: 'pixel7', device: devices['Pixel 7'] },
  { name: 'galaxy-s-320', device: { ...devices['Galaxy S8'], viewport: { width: 320, height: 658 } } },
  { name: 'iphone13-landscape', device: devices['iPhone 13 landscape'] },
  { name: 'ipad-mini', device: devices['iPad Mini'] },
];
const pages = [
  { id: 'contribute', path: `/c/${ACTIVE}`, anchor: '#support' },
  { id: 'checkout', path: `/checkout/${PRODUCT}`, check: /I approve this PayPal Sandbox payment/ },
];

const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
for (const t of targets) {
  const dev = { ...t.device }; delete dev.defaultBrowserType;
  const ctx = await browser.newContext({ ...dev });
  for (const pg of pages) {
    const page = await ctx.newPage();
    await page.goto(BASE + pg.path, { waitUntil: 'domcontentloaded' });
    const iframe = page.locator('iframe[title*="PayPal"]').first();
    let ok = false, box = null, vw = dev.viewport.width, btnVisible = false;
    try {
      await iframe.waitFor({ timeout: 45000 });
      if (pg.check) await page.getByRole('checkbox', { name: pg.check }).check();
      await iframe.scrollIntoViewIfNeeded();
      const frame = await (await iframe.elementHandle()).contentFrame();
      const btn = frame.locator('[data-funding-source="paypal"]').first();
      await btn.waitFor({ state: 'visible', timeout: 45000 });
      btnVisible = true;
      box = await iframe.boundingBox();
      ok = box.x >= 0 && box.x + box.width <= vw + 1 && box.height >= 35;
      await page.waitForTimeout(1500);
      const card = pg.anchor ? page.locator(pg.anchor) : iframe.locator('xpath=ancestor::div[contains(@class,"card")][1]');
      await card.screenshot({ path: path.join(OUT, `${t.name}-${pg.id}.png`) });
    } catch (e) { results.push({ device: t.name, page: pg.id, ok: false, error: String(e).slice(0, 160) }); await page.close(); continue; }
    results.push({ device: t.name, page: pg.id, viewport: `${vw}x${dev.viewport.height}`, ok, btnVisible, iframe: box && { x: Math.round(box.x), w: Math.round(box.width), h: Math.round(box.height) } });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'paypal-mobile.json'), JSON.stringify(results, null, 1));
for (const r of results) console.log(r.ok ? 'OK  ' : 'FAIL', r.device.padEnd(20), r.page.padEnd(11), r.viewport || '', JSON.stringify(r.iframe || r.error));
