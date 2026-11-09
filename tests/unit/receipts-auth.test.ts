import { describe, expect, it, vi, beforeAll } from 'vitest';
import crypto from 'node:crypto';

vi.mock('server-only', () => ({}));

// In-memory stand-in for the supporter_receipts table, enough to exercise the atomic claim.
const rows: Array<Record<string, unknown>> = [];
vi.mock('@/lib/db', () => {
  const table = (name: string) => {
    const q: Record<string, unknown> & { filters: Array<[string, unknown]>; patch?: Record<string, unknown> } = { filters: [] } as never;
    const match = (r: Record<string, unknown>) => q.filters.every(([k, v]) => r[k] === v);
    const api = {
      update(p: Record<string, unknown>) { q.patch = p; return api; },
      eq(k: string, v: unknown) { q.filters.push([k, v]); return api; },
      select() {
        if (name === 'supporter_receipts' && q.patch) { const hit = rows.filter(match); hit.forEach(r => Object.assign(r, q.patch)); return Promise.resolve({ data: hit, error: null }); }
        return api;
      },
      maybeSingle() { return Promise.resolve({ data: name === 'supporter_receipts' ? rows.find(match) ?? null : null, error: null }); },
      single() { return Promise.resolve({ data: { paypal_order_id: 'ORDER123456', campaign_id: null, updated_at: '2026-11-10T00:00:00Z' }, error: null }); },
      then(res: (v: unknown) => void) { if (q.patch) rows.filter(match).forEach(r => Object.assign(r, q.patch)); res({ data: null, error: null }); },
    };
    return api;
  };
  return { db: () => ({ from: table }) };
});

beforeAll(() => { process.env.SESSION_SECRET = 'test-secret-'.padEnd(40, 'x'); });

import { renderReceipt, validEmail, sendReceiptIfPending } from '@/lib/receipts';

describe('supporter receipts', () => {
  it('validates emails conservatively', () => {
    expect(validEmail('maya@example.com')).toBe(true);
    expect(validEmail('not-an-email')).toBe(false);
    expect(validEmail('a@b')).toBe(false);
    expect(validEmail('<script>@x.com')).toBe(false);
  });
  it('renders an escaped receipt with the Sandbox disclosure, in the supporter’s language', () => {
    const r = renderReceipt({ campaignTitle: 'Help <b>Maya</b>', amountCents: 2550, currency: 'USD', paypalOrderId: 'ORDER123456', captureId: 'CAP987654', capturedAt: '2026-11-10T00:00:00Z', locale: 'en', receiptUrl: 'https://fundcart-ai.vercel.app/receipt/ORDER123456' });
    expect(r.html).not.toContain('<b>Maya</b>');
    expect(r.html).toContain('$25.50');
    expect(r.html).toContain('CAP987654');
    expect(r.text).toMatch(/Sandbox/);
    const ur = renderReceipt({ campaignTitle: 'x', amountCents: 100, currency: 'USD', paypalOrderId: 'O', captureId: 'C', capturedAt: '2026-11-10T00:00:00Z', locale: 'ur', receiptUrl: null });
    expect(ur.html).toContain('dir="rtl"');
  });
  it('sends at most once and never pretends to send without a provider', async () => {
    rows.push({ id: 'r1', payment_order_id: 'po-1', email: 'maya@example.com', locale: 'en', status: 'pending' });
    delete process.env.RESEND_API_KEY;
    expect(await sendReceiptIfPending('po-1', { captureId: 'CAP', amountCents: 1000, currency: 'USD' })).toBe('disabled');
    expect(rows[0].status).toBe('disabled');
    expect(await sendReceiptIfPending('po-1', { captureId: 'CAP', amountCents: 1000, currency: 'USD' })).toBe('already');

    rows.push({ id: 'r2', payment_order_id: 'po-2', email: 'sam@example.com', locale: 'fr', status: 'pending' });
    process.env.RESEND_API_KEY = 'test'; process.env.RECEIPT_FROM = 'FundCart <receipts@example.com>';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }));
    expect(await sendReceiptIfPending('po-2', { captureId: 'CAP2', amountCents: 500, currency: 'USD' }, fetchMock as unknown as typeof fetch)).toBe('sent');
    // A duplicate webhook delivery does not send again.
    expect(await sendReceiptIfPending('po-2', { captureId: 'CAP2', amountCents: 500, currency: 'USD' }, fetchMock as unknown as typeof fetch)).toBe('already');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await sendReceiptIfPending('po-none', { captureId: 'X', amountCents: 1, currency: 'USD' })).toBe('none');
  });
});

describe('account cookie', () => {
  it('accepts only untampered, unexpired tokens', async () => {
    vi.doMock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
    const { verifyAccountToken } = await import('@/lib/auth');
    const pid = crypto.randomUUID(); const uid = crypto.randomUUID(); const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = `${pid}.${uid}.${exp}`;
    const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET!).update(`acct:${payload}`).digest('base64url').slice(0, 43);
    expect(verifyAccountToken(`${payload}.${sig}`)).toMatchObject({ profileId: pid, authUserId: uid });
    expect(verifyAccountToken(`${crypto.randomUUID()}.${uid}.${exp}.${sig}`)).toBeNull(); // swapped profile
    const old = `${pid}.${uid}.${Math.floor(Date.now() / 1000) - 10}`;
    const oldSig = crypto.createHmac('sha256', process.env.SESSION_SECRET!).update(`acct:${old}`).digest('base64url').slice(0, 43);
    expect(verifyAccountToken(`${old}.${oldSig}`)).toBeNull(); // expired
    expect(verifyAccountToken('garbage')).toBeNull();
  });
});
