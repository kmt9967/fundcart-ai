import { expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: () => ({ rpc }) }));

import { sharedRateLimit } from '@/lib/ratelimit';

it('WC-143 distinguishes a local allowance from an enforced shared quota', async () => {
  rpc.mockResolvedValueOnce({ data: { allowed: true } }).mockRejectedValueOnce(new Error('database offline'));
  const allowed = await sharedRateLimit([['first', 'fixture', 10, 60], ['second', 'fixture', 10, 60]]);
  expect(allowed).toMatchObject({ ok: true, shared: false });
});

it('WC-143 treats a missing quota decision as unavailable', async () => {
  rpc.mockResolvedValueOnce({ data: null });
  expect(await sharedRateLimit([['missing', 'fixture', 10, 60]])).toMatchObject({ ok: true, shared: false });
});
