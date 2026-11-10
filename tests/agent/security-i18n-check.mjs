// Four-language + phone-width checks for the publication-security and demo pages (local server only).
// Usage: PLAYWRIGHT_BROWSERS_PATH=... node tests/agent/security-i18n-check.mjs [baseUrl] [productExternalId]
import { chromium } from '@playwright/test';
const BASE = (process.argv[2] || 'http://localhost:3200').replace(/\/$/, '');
const PRODUCT = process.argv[3];
const expectText = {
  en: { guest: 'You can prepare a draft as a guest', demo: 'Demo account · sample data · PayPal Sandbox', kept: 'Your campaign draft is saved in this browser' },
  ur: { guest: 'آپ مہمان کے طور پر مسودہ تیار کر سکتے ہیں', demo: 'ڈیمو اکاؤنٹ · نمونہ ڈیٹا · PayPal سینڈ باکس', kept: 'آپ کی مہم کا مسودہ اس براؤزر میں محفوظ ہے' },
  es: { guest: 'Puedes preparar un borrador como invitado', demo: 'Cuenta demo · datos de ejemplo · PayPal Sandbox', kept: 'El borrador de tu campaña está guardado' },
  fr: { guest: 'Vous pouvez préparer un brouillon en tant qu’invité', demo: 'Compte démo · données d’exemple · PayPal Sandbox', kept: 'Le brouillon de votre campagne est enregistré' },
};
const results = []; const ok = (n, p, d = '') => { results.push(p); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? `  (${d})` : ''}`); };
const browser = await chromium.launch({ channel: 'chrome' });
for (const [lang, txt] of Object.entries(expectText)) {
  for (const vp of [{ width: 390, height: 844, name: 'phone' }, { width: 1280, height: 900, name: 'desktop' }]) {
    const ctx = await browser.newContext({ viewport: vp, extraHTTPHeaders: { 'x-fc-test-ip': '198.51.100.240' } });
    await ctx.addCookies([{ name: 'fc_lang', value: lang, url: BASE }]);
    const page = await ctx.newPage();
    const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const raw = async () => (await page.content()).match(/>(elig|demo|gap|pay)\.[a-z.]+</g);
    // Demo
    await page.goto(`${BASE}/`);
    await page.getByTestId('try-demo').first().click();
    await page.waitForURL(/\/demo$/);
    const dir = await page.getAttribute('html', 'dir');
    ok(`${lang} ${vp.name}: demo opens from the homepage button, labelled, ${lang === 'ur' ? 'RTL' : 'LTR'}`, (await page.getByTestId('demo-banner').innerText()).includes(txt.demo) && dir === (lang === 'ur' ? 'rtl' : 'ltr'));
    ok(`${lang} ${vp.name}: demo has no horizontal overflow and no raw keys`, (await overflow()) <= 1 && !(await raw()), `overflow ${await overflow()}`);
    await page.getByTestId('exit-demo').click();
    // Account page with a preserved draft
    await page.goto(`${BASE}/account?next=${encodeURIComponent('/campaigns/new?product=x')}`);
    ok(`${lang} ${vp.name}: sign-in page explains the kept draft and offers the demo`, (await page.getByTestId('draft-kept').innerText()).includes(txt.kept) && await page.getByTestId('try-demo').isVisible());
    if (PRODUCT) {
      await page.goto(`${BASE}/campaigns/new?product=${PRODUCT}&own=10`);
      ok(`${lang} ${vp.name}: builder shows the guest note, goal breakdown, sign-in-to-publish`, (await page.getByTestId('guest-note').innerText()).includes(txt.guest) && await page.getByTestId('base-gap').isVisible() && await page.getByTestId('login-to-publish').isVisible());
      ok(`${lang} ${vp.name}: builder has no horizontal overflow and no raw keys`, (await overflow()) <= 1 && !(await raw()), `overflow ${await overflow()}`);
    }
    await ctx.close();
  }
}
await browser.close();
const failed = results.filter(x => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
