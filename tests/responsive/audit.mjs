// Responsive layout audit: loads every route at many viewport sizes and measures layout defects.
// Usage: node tests/responsive/audit.mjs <baseUrl> <outDir>
// Metrics per page/size: horizontal document overflow, elements outside the viewport (not inside a
// scroll container), interactive targets smaller than 24px / 40px, text smaller than 12px.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:3100').replace(/\/$/, '');
const OUT = process.argv[3] || 'private/responsive/run';
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);

const PURCHASED = process.env.AUDIT_PURCHASED || 'help-maya-get-a-laptop-for-her-computer--e4b00d';
const ACTIVE = process.env.AUDIT_ACTIVE || 'help-maya-get-a-inspiron-15-laptop-b86b31';
const PRODUCT = process.env.AUDIT_PRODUCT || 'Jno1842';

async function ownerToken(slug) {
  const c = await db.from('campaigns').select('id, owner_id').eq('slug', slug).single();
  const id = c.data.owner_id;
  const sig = crypto.createHmac('sha256', env.SESSION_SECRET).update(id).digest('base64url').slice(0, 32);
  const o = await db.from('payment_orders').select('paypal_order_id').eq('campaign_id', c.data.id).eq('status', 'COMPLETED').limit(1);
  return { token: `${id}.${sig}`, order: o.data?.[0]?.paypal_order_id };
}

const MOBILE = [320, 360, 375, 390, 414, 430, 480].map(w => ({ w, h: 780, mobile: true }));
const TABLET = [600, 768, 820, 1024].map(w => ({ w, h: 1000, mobile: w < 1024 }));
const DESKTOP = [1280, 1440, 1920].map(w => ({ w, h: 900, mobile: false }));
const LANDSCAPE = [{ w: 667, h: 375, mobile: true, tag: 'land' }, { w: 844, h: 390, mobile: true, tag: 'land' }, { w: 915, h: 412, mobile: true, tag: 'land' }];
const SIZES = [...MOBILE, ...TABLET, ...DESKTOP, ...LANDSCAPE];
const SHOT_AT = new Set([320, 390, 768, 1280, 844]);

function metricsFn() {
  const W = document.documentElement.clientWidth;
  const desc = el => {
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    const txt = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`;
  };
  const inScroller = el => { let p = el.parentElement; while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p.clientWidth < W + 1) return true; p = p.parentElement; } return false; };
  const off = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    if (el.closest('.sr-only')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if ((r.right > W + 1 || r.left < -1) && !inScroller(el)) {
      // keep only the outermost offender
      if (!off.some(o => o.el.contains(el))) off.push({ el, d: `${desc(el)} [${Math.round(r.left)}..${Math.round(r.right)}]` });
    }
  }
  const taps = { fail: [], warn: [] };
  for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], summary')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('.sr-only')) continue;
    let r = el.getBoundingClientRect();
    if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) r = el.closest('label').getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const m = Math.min(r.width, r.height);
    if (m < 24) taps.fail.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    else if (r.height < 40) taps.warn.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  const tiny = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 2)) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('.sr-only')) continue;
    const fs = parseFloat(cs.fontSize); const r = el.getBoundingClientRect(); if (r.width < 1) continue;
    if (fs < 12) tiny.push(`${desc(el)} ${fs}px`);
  }
  return { W, scrollW: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > W + 1, off: off.map(o => o.d).slice(0, 12), tapFail: taps.fail.slice(0, 15), tapFailCount: taps.fail.length, tapWarnCount: taps.warn.length, tapWarn: taps.warn.slice(0, 10), tiny: tiny.slice(0, 10), tinyCount: tiny.length, pageH: document.documentElement.scrollHeight };
}

const purchased = await ownerToken(PURCHASED);
const active = await ownerToken(ACTIVE);
const routes = [
  { id: 'home', path: '/' },
  { id: 'assistant-empty', path: '/assistant' },
  { id: 'campaigns', path: '/campaigns' },
  { id: 'campaign-active', path: `/c/${ACTIVE}`, wait: 'iframe[title*="PayPal"]' },
  { id: 'campaign-purchased', path: `/c/${PURCHASED}` },
  { id: 'manage-active', path: `/c/${ACTIVE}/manage`, owner: active.token, wait: '.ag-root' },
  { id: 'manage-purchased', path: `/c/${PURCHASED}/manage`, owner: purchased.token, wait: '.ag-root' },
  { id: 'builder', path: `/campaigns/new?product=${PRODUCT}&own=60` },
  { id: 'checkout', path: `/checkout/${PRODUCT}`, wait: 'iframe[title*="PayPal"]' },
  { id: 'receipt', path: `/receipt/${purchased.order}`, owner: purchased.token },
  { id: 'me', path: '/me' },
  { id: 'how', path: '/how-it-works' },
  { id: 'disclosures', path: '/disclosures' },
  { id: 'notfound', path: '/this-page-does-not-exist' },
];

const browser = await chromium.launch({ channel: 'chrome' });
const report = [];
async function ctxFor(mobile, owner) {
  const ctx = await browser.newContext({ isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, viewport: { width: 390, height: 780 } });
  if (owner) await ctx.addCookies([{ name: 'fc_uid', value: owner, url: BASE }]);
  // Optional interface language (e.g. AUDIT_LANG=ur to audit the RTL layout).
  if (process.env.AUDIT_LANG) await ctx.addCookies([{ name: 'fc_lang', value: process.env.AUDIT_LANG, url: BASE }]);
  return ctx;
}
async function measure(page, route, s) {
  await page.setViewportSize({ width: s.w, height: s.h });
  await page.waitForTimeout(500);
  const m = await page.evaluate(metricsFn);
  const key = `${route}@${s.w}x${s.h}${s.tag ? '-' + s.tag : ''}`;
  if (SHOT_AT.has(s.w)) await page.screenshot({ path: path.join(OUT, `${key}.png`), fullPage: true });
  report.push({ key, route, w: s.w, h: s.h, ...m });
  const flag = m.overflow ? 'OVERFLOW' : m.off.length ? 'OFFSCREEN' : 'ok';
  console.log(key.padEnd(40), flag, `taps<24:${m.tapFailCount} taps<40:${m.tapWarnCount} tiny:${m.tinyCount}`);
}

for (const r of routes) {
  for (const mobile of [true, false]) {
    const ctx = await ctxFor(mobile, r.owner);
    const page = await ctx.newPage();
    const sizes = SIZES.filter(s => s.mobile === mobile);
    await page.setViewportSize({ width: sizes[0].w, height: sizes[0].h });
    await page.goto(BASE + r.path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    if (r.wait) await page.locator(r.wait).first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    for (const s of sizes) await measure(page, r.id, s);
    await ctx.close();
  }
}

// Assistant with real results (one search per context, then resize through sizes).
for (const mobile of [true, false]) {
  const ctx = await ctxFor(mobile);
  const page = await ctx.newPage();
  const sizes = SIZES.filter(s => s.mobile === mobile);
  await page.setViewportSize({ width: sizes[0].w, height: sizes[0].h });
  await page.goto(BASE + '/assistant', { waitUntil: 'networkidle' });
  // Language-independent selectors (the audit can run with AUDIT_LANG=ur/es/fr).
  await page.locator('#prompt').fill('I need a laptop for university under $700');
  await page.locator('#own').fill('200');
  await page.locator('form button.btn-primary').first().click();
  await page.locator('article').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  const cmp = page.getByRole('checkbox', { name: 'Compare' });
  await cmp.nth(0).check().catch(() => {}); await cmp.nth(1).check().catch(() => {});
  await page.waitForTimeout(800);
  for (const s of sizes) await measure(page, 'assistant-results', s);
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
const bad = report.filter(r => r.overflow || r.off.length);
const lines = [`# Responsive audit — ${BASE} — ${new Date().toISOString()}`, '', `Pages × sizes: ${report.length}. With overflow/off-screen: ${bad.length}. Total targets <24px: ${report.reduce((a, r) => a + r.tapFailCount, 0)}. Tiny text instances: ${report.reduce((a, r) => a + r.tinyCount, 0)}.`, ''];
for (const r of bad) lines.push(`- **${r.key}** scrollW=${r.scrollW} vs ${r.W}: ${r.off.slice(0, 4).join('; ')}`);
fs.writeFileSync(path.join(OUT, 'summary.md'), lines.join('\n'));
console.log('\n' + lines.slice(0, 3).join('\n'));
