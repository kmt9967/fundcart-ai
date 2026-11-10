import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from './env';

// One-click demo: a server-signed, short-lived cookie that unlocks a READ-ONLY dashboard rendered from
// the fixed sample data below. It is not an account: no API accepts it, it maps to no profile, and it
// never touches the database. There is no shared password anywhere.

export const DEMO_COOKIE = 'fc_demo';
export const DEMO_MAX_AGE = 2 * 60 * 60;

function sign(payload: string) { return crypto.createHmac('sha256', env.sessionSecret).update(`demo:${payload}`).digest('base64url').slice(0, 43); }

export function newDemoToken(now = Date.now()): string {
  const payload = `${Math.floor(now / 1000) + DEMO_MAX_AGE}.${crypto.randomBytes(9).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyDemoToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || !/^\d{9,11}$/.test(parts[0]) || !/^[A-Za-z0-9_-]{8,20}$/.test(parts[1])) return false;
  const expected = sign(`${parts[0]}.${parts[1]}`);
  if (parts[2].length !== expected.length || !crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected))) return false;
  return Number(parts[0]) * 1000 > now;
}

export async function inDemo(): Promise<boolean> {
  return verifyDemoToken((await cookies()).get(DEMO_COOKIE)?.value);
}

export type DemoOrder = { at: string; kind: 'contribution' | 'purchase'; supporter: string; amountCents: number; orderId: string; captureStatus: 'COMPLETED' | 'PENDING' | 'REFUNDED' | 'DECLINED' };

/** Fixed sample data. Names are fictional; order ids are labelled SAMPLE and exist nowhere at PayPal. */
export const DEMO = {
  campaign: {
    title: 'Help Sana get a laptop for her graphic design course',
    creator: 'Sana (sample creator)',
    needCategory: 'education',
    item: 'Sample 14-inch laptop, 16 GB RAM, 512 GB SSD',
    priceCents: 64999, ownFundsCents: 15000, bufferPct: 5,
    status: 'active' as const, moderation: 'approved' as const, verification: 'unverified' as const,
    createdAt: '2026-11-02T10:15:00Z',
  },
  orders: [
    { at: '2026-11-02T12:40:00Z', kind: 'contribution', supporter: 'Bilal', amountCents: 5000, orderId: 'SAMPLE-7KQ2-001', captureStatus: 'COMPLETED' },
    { at: '2026-11-03T09:05:00Z', kind: 'contribution', supporter: 'Anonymous', amountCents: 2500, orderId: 'SAMPLE-7KQ2-002', captureStatus: 'COMPLETED' },
    { at: '2026-11-03T18:22:00Z', kind: 'contribution', supporter: 'Maria', amountCents: 10000, orderId: 'SAMPLE-7KQ2-003', captureStatus: 'COMPLETED' },
    { at: '2026-11-04T07:51:00Z', kind: 'contribution', supporter: 'Anonymous', amountCents: 2000, orderId: 'SAMPLE-7KQ2-004', captureStatus: 'REFUNDED' },
    { at: '2026-11-05T15:10:00Z', kind: 'contribution', supporter: 'Omar', amountCents: 7500, orderId: 'SAMPLE-7KQ2-005', captureStatus: 'COMPLETED' },
    { at: '2026-11-06T11:33:00Z', kind: 'contribution', supporter: 'Anonymous', amountCents: 1500, orderId: 'SAMPLE-7KQ2-006', captureStatus: 'DECLINED' },
    { at: '2026-11-07T20:02:00Z', kind: 'contribution', supporter: 'Lena', amountCents: 6000, orderId: 'SAMPLE-7KQ2-007', captureStatus: 'COMPLETED' },
    { at: '2026-11-08T08:45:00Z', kind: 'contribution', supporter: 'Anonymous', amountCents: 2500, orderId: 'SAMPLE-7KQ2-008', captureStatus: 'PENDING' },
  ] as DemoOrder[],
  updates: [
    { at: '2026-11-04T09:00:00Z', body: 'Thank you to the first supporters! The goal is fixed from the price snapshot taken when the campaign started.' },
  ],
};

/** Totals computed the same way as real campaigns: only COMPLETED captures count. */
export function demoTotals() {
  const c = DEMO.campaign;
  const buffer = Math.ceil((c.priceCents * c.bufferPct) / 100);
  const baseGap = Math.max(0, c.priceCents - c.ownFundsCents);
  const target = Math.max(0, c.priceCents + buffer - c.ownFundsCents);
  const counted = DEMO.orders.filter(o => o.kind === 'contribution' && o.captureStatus === 'COMPLETED');
  const raised = counted.reduce((s, o) => s + o.amountCents, 0);
  return { buffer, baseGap, target, raised, supporters: counted.length, percent: target ? Math.min(100, Math.floor((raised * 100) / target)) : 100, remaining: Math.max(0, target - raised) };
}
