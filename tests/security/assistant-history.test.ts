import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ account: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/auth', () => ({ currentAccount: mocks.account }));
vi.mock('@/lib/db', () => ({ db: () => ({ from: mocks.from }) }));
import { DELETE, PATCH } from '@/app/api/assistant/history/[id]/route';

const context = { params: Promise.resolve({ id: '10000000-0000-4000-8000-000000000001' }) };
const request = new Request('http://localhost/api/assistant/history', { method: 'PATCH', body: '{"compare":["different-product"]}' });

it('rejects guest history mutations before reading records', async () => {
  mocks.account.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
  expect((await PATCH(request.clone(), context)).status).toBe(401);
  expect((await DELETE(request.clone(), context)).status).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled();
});

it('rejects comparison IDs outside the owned result set', async () => {
  mocks.account.mockResolvedValueOnce({ profileId: 'owner' });
  const filters = vi.fn().mockReturnThis();
  const update = vi.fn();
  mocks.from.mockReturnValueOnce({
    select: () => ({ eq: filters, maybeSingle: async () => ({ data: { result: { kind: 'results', bestFit: ['known-product'] } } }) }),
    update,
  });
  expect((await PATCH(request.clone(), context)).status).toBe(422);
  expect(filters).toHaveBeenCalledWith('user_id', 'owner');
  expect(update).not.toHaveBeenCalled();
});
