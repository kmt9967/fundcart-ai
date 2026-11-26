import { beforeEach, expect, it, vi } from 'vitest';

const doubles = vi.hoisted(() => ({ db: vi.fn(), order: vi.fn(), capture: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: doubles.db }));
vi.mock('@/lib/paypal', () => ({ getOrder: doubles.order, captureOrder: doubles.capture }));
vi.mock('@/lib/receipts', () => ({ sendReceiptIfPending: vi.fn() }));
vi.mock('@/lib/security-events', () => ({ recentEventCount: vi.fn(), recordSecurityEvent: vi.fn() }));

import { captureAndRecord } from '@/lib/payments';

beforeEach(() => {
  vi.resetAllMocks();
  const from = vi.fn((table: string) => {
    const query = {
      select: () => query, eq: () => query,
      maybeSingle: async () => ({
        data: table === 'payment_orders' ? { id: 'internal', user_id: 'owner', kind: 'purchase', campaign_id: null, amount_cents: 500 } : null,
      }),
    };
    return query;
  });
  doubles.db.mockReturnValue({ from });
  doubles.order.mockResolvedValue({ status: 'APPROVED' });
});

it('rejects a browser caller with no ownership before contacting the provider', async () => {
  expect(await captureAndRecord('ORDER', { source: 'api', userId: 'other' })).toMatchObject({ state: 'not_found' });
  expect(doubles.order).not.toHaveBeenCalled();
  expect(doubles.capture).not.toHaveBeenCalled();
});

it('refuses a purchase capture without a matching recorded approval', async () => {
  expect(await captureAndRecord('ORDER', { source: 'api', userId: 'owner' })).toMatchObject({ state: 'approval_required' });
  expect(doubles.capture).not.toHaveBeenCalled();
});
