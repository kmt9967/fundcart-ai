// Authentication, authorization and four-language checks against a running FundCart server.
// Usage: node --dns-result-order=ipv4first tests/agent/auth-i18n-check.mjs [baseUrl]
// Needs DEMO_CREATOR_EMAIL / DEMO_CREATOR_PASSWORD in the environment (never printed).
// Creates no accounts and no payments; only reads pages and calls sign-in / sign-out.
import fs from 'node:fs';

const BASE = (process.argv[2] || 'http://localhost:3200').replace(/\/$/, '');
const EMAIL = process.env.DEMO_CREATOR_EMAIL; const PASSWORD = process.env.DEMO_CREATOR_PASSWORD;
const results = []; const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

class Jar { c = new Map(); add(res) { for (const h of res.headers.getSetCookie?.() || []) { const [kv] = h.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i); const v = kv.slice(i + 1); if (!v || /max-age=0|expires=thu, 01 jan 1970/i.test(h)) this.c.delete(k); else this.c.set(k, v); } } header() { return [...this.c].map(([k, v]) => `${k}=${v}`).join('; '); } }
async function req(jar, path, opts = {}) {
  const res = await fetch(BASE + path, { redirect: 'manual', ...opts, headers: { ...(opts.headers || {}), cookie: jar.header(), 'user-agent': 'fundcart-qa-check' } });
  jar.add(res); return { status: res.status, text: await res.text(), res };
}
// Auth allows 10 attempts per minute per client; pace calls so the check never trips its own limit.
const TEST_IP = `198.51.100.${1 + Math.floor(Math.random() * 250)}`;
const auth = async (jar, body) => { await new Promise(r => setTimeout(r, 6500)); return req(jar, '/api/auth', { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE, 'x-fc-test-ip': TEST_IP }, body: JSON.stringify(body) }); };

// ---------- Authentication ----------
const anon = new Jar();
const wrong = await auth(anon, { action: 'login', email: EMAIL, password: 'definitely-not-the-password-1' });
ok('wrong password is rejected', wrong.status === 401, `status ${wrong.status}`);
const badEmail = await auth(anon, { action: 'signup', email: 'not-an-email', password: 'longenough123' });
ok('sign-up with an invalid email is rejected (no account created)', badEmail.status === 400, `status ${badEmail.status}`);
const weak = await auth(anon, { action: 'signup', email: 'qa.weak@fundcart-demo.example', password: 'short' });
ok('sign-up with a weak password is rejected (no account created)', weak.status === 400, `status ${weak.status}`);
const rec = await auth(anon, { action: 'recover', email: `nobody-${Date.now()}@fundcart-demo.example` });
ok('password recovery for an unknown email gives the generic answer (no account enumeration)', rec.status === 200 && !/not found|no account/i.test(rec.text), `status ${rec.status}`);

const owner = new Jar();
const login = await auth(owner, { action: 'login', email: EMAIL, password: PASSWORD });
ok('demo creator can sign in', login.status === 200 && owner.c.has('fc_acct'), `status ${login.status}`);
const me = await req(owner, '/me');
ok('/me shows the signed-in account', me.status === 200 && me.text.includes(EMAIL), `status ${me.status}`);
const slug = (me.text.match(/href="\/c\/([a-z0-9-]+)"/) || [])[1];
ok('/me lists the owner’s campaign', !!slug, slug ? 'found' : 'no campaign link');

// ---------- Authorization ----------
if (slug) {
  const dash = await req(owner, `/c/${slug}/manage`);
  ok('owner sees the dashboard', dash.status === 200 && !dash.text.includes('Only the campaign’s creator can open its dashboard'), `status ${dash.status}`);
  const stranger = new Jar(); await req(stranger, '/');
  const sd = await req(stranger, `/c/${slug}/manage`);
  ok('a stranger with a guest cookie cannot open the dashboard', sd.text.includes('Only the campaign’s creator can open its dashboard'), `status ${sd.status}`);
  const tampered = new Jar(); const [p, u, e] = owner.c.get('fc_acct').split('.'); tampered.c.set('fc_acct', `${p}.${u}.${e}.AAAA${'x'.repeat(39)}`);
  const td = await req(tampered, `/c/${slug}/manage`);
  ok('a forged account cookie is ignored', td.text.includes('Only the campaign’s creator can open its dashboard'), `status ${td.status}`);
  const act = await req(stranger, `/api/campaigns/${slug}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ action: 'cancel' }) });
  ok('a stranger cannot cancel the campaign (API)', act.status === 403, `status ${act.status}`);
  const buy = await req(stranger, '/api/paypal/orders', { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ kind: 'purchase', slug, confirm: true }) });
  ok('a stranger cannot approve the purchase (API)', buy.status === 403, `status ${buy.status}`);
  const upd = await req(stranger, `/api/campaigns/${slug}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ action: 'post_update', body: 'not my campaign update' }) });
  ok('a stranger cannot post an update (API)', upd.status === 403, `status ${upd.status}`);
}
const out = await auth(owner, { action: 'logout' });
ok('sign-out succeeds and clears the account cookie', out.status === 200 && !owner.c.has('fc_acct'), `status ${out.status}`);
if (slug) { const after = await req(owner, `/c/${slug}/manage`); ok('after sign-out the dashboard is locked again', after.text.includes('Only the campaign’s creator can open its dashboard')); }

// ---------- Four languages ----------
const en = fs.readFileSync('src/i18n/dict/en.ts', 'utf8');
const probe = k => (en.match(new RegExp(`'${k.replace('.', '\\.')}': '([^']+)'`)) || [])[1];
const PROBES = ['nav.how', 'nav.me', 'nav.start', 'nav.campaignsHint'].map(probe).filter(Boolean);
const pages = ['/', '/how-it-works', '/campaigns', '/assistant', '/account', '/disclosures', '/campaigns/new', '/me', ...(slug ? [`/c/${slug}`] : [])];
for (const lang of ['en', 'ur', 'es', 'fr']) {
  const jar = new Jar(); jar.c.set('fc_lang', lang);
  for (const p of pages) {
    const r = await req(jar, p);
    const html = r.text.match(/<html[^>]*>/)?.[0] || '';
    const langOk = html.includes(`lang="${lang}"`) && html.includes(`dir="${lang === 'ur' ? 'rtl' : 'ltr'}"`);
    const leaks = lang === 'en' ? [] : PROBES.filter(s => r.text.includes(`>${s}<`));
    ok(`${lang} ${p}`, r.status === 200 && langOk && leaks.length === 0, `status ${r.status}${langOk ? '' : ' wrong lang/dir'}${leaks.length ? ' English: ' + leaks.join(', ') : ''}`);
  }
}

const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
fs.mkdirSync('private/review', { recursive: true });
fs.writeFileSync(`private/review/auth-i18n-${BASE.includes('localhost') ? 'local' : 'production'}.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 1));
process.exit(failed ? 1 : 0);
