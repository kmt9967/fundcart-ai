import { expect, it, vi } from 'vitest';
const doubles = vi.hoisted(() => ({ from: vi.fn(), turn: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: () => ({ from: doubles.from }) }));
vi.mock('@/lib/identity', () => ({ ensureUser: async () => 'visitor' }));
vi.mock('@/lib/ratelimit', () => ({ clientKey: () => 'fixture', bucketId: () => 'opaque', sharedRateLimit: async () => ({ ok: true, shared: true }) }));
vi.mock('@/lib/security-events', () => ({ recordSecurityEvent: vi.fn() }));
vi.mock('@/lib/shopping/pipeline', () => ({ blockedTurn: vi.fn(), runTurn: doubles.turn }));
vi.mock('@/i18n/server', () => ({ getLocale: async () => 'en' }));

import { POST } from '@/app/api/assistant/route';
import { INTENT_VERSION } from '@/lib/shopping/types';

it('does not apply a brief update to another visitor or a historical sensitive session', async () => {
  doubles.from.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: vi.fn()
      .mockResolvedValueOnce({ data: { user_id: 'other', intent: { version: INTENT_VERSION } } })
      .mockResolvedValue({ data: { user_id: 'visitor', intent: { version: INTENT_VERSION }, safety: { notices: ['sensitive_purchase'] } } }) }) }),
  });
  const call = () => POST(new Request('http://localhost/api/assistant', {
    method: 'POST',
    body: JSON.stringify({ prompt: 'Refine search', locale: 'en', conversationId: '10000000-0000-4000-8000-000000000001', brief: { ramGb: 16 } }),
  }));
  expect((await call()).status).toBe(409);
  expect((await call()).status).toBe(409);
  expect(doubles.turn).not.toHaveBeenCalled();
});
