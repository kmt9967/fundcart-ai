import { expect, it, vi } from 'vitest';

const doubles = vi.hoisted(() => ({ db: vi.fn(), turn: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: doubles.db }));
vi.mock('@/lib/shopping/pipeline', () => ({ runTurn: doubles.turn, blockedTurn: vi.fn() }));
vi.mock('@/lib/identity', () => ({ ensureUser: async () => 'fixture-user' }));
vi.mock('@/lib/ratelimit', () => ({ clientKey: () => 'fixture', bucketId: () => 'opaque', sharedRateLimit: async () => ({ ok: true, shared: true }) }));
vi.mock('@/lib/security-events', () => ({ recordSecurityEvent: vi.fn() }));
vi.mock('@/i18n/server', () => ({ getLocale: async () => 'en' }));

import { POST } from '@/app/api/assistant/route';

it('WC-040 and WC-115 keep identified sensitive turns out of stored sessions, diagnostics and Gemini', async () => {
  doubles.turn.mockImplementation(async ({ emit }) => {
    emit({ agent: 'fixture', step: 'sensitive diagnostic sample' });
    return { kind: 'results', listingFlags: [], state: { goal: 'private' } };
  });
  const response = await POST(new Request('http://localhost/api/assistant', {
    method: 'POST',
    body: JSON.stringify({ prompt: 'Find a pregnancy test', locale: 'en', conversationId: '10000000-0000-4000-8000-000000000001' }),
  }));
  expect(await response.text()).not.toContain('sessionId');
  expect(doubles.turn).toHaveBeenCalledWith(expect.objectContaining({ allowModel: false, prev: null }));
  expect(doubles.db).not.toHaveBeenCalled();
});
