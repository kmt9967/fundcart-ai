import { beforeEach, describe, expect, it, vi } from 'vitest';

const doubles = vi.hoisted(() => ({ verify: vi.fn(), adjustment: vi.fn(), capture: vi.fn(), log: vi.fn() }));
vi.mock('@/lib/paypal', () => ({ verifyWebhook: doubles.verify }));
vi.mock('@/lib/payments', () => ({
  applyRefund: doubles.adjustment, captureAndRecord: doubles.capture, logPaymentEvent: doubles.log,
}));

import { POST } from '@/app/api/paypal/webhook/route';

const refund = {
  id: 'EVENT-1', event_type: 'PAYMENT.CAPTURE.REFUNDED',
  resource: {
    id: 'REFUND-1', amount: { value: '5.00', currency_code: 'USD' },
    links: [{ rel: 'up', href: 'https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE-1' }],
  },
};
const send = (event: unknown) => POST(new Request('http://localhost/api/paypal/webhook', {
  method: 'POST', body: JSON.stringify(event),
}));

describe('Verified webhook reconciliation boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    doubles.verify.mockResolvedValue(true);
  });

  it('WC-125 rejects unsigned input before ledger work', async () => {
    doubles.verify.mockResolvedValue(false);
    expect((await send(refund)).status).toBe(401);
    expect(doubles.adjustment).not.toHaveBeenCalled();
  });

  it('WC-126 retries an adjustment whose original capture has not been recorded', async () => {
    doubles.adjustment.mockResolvedValueOnce('missing').mockResolvedValueOnce('applied').mockResolvedValueOnce('duplicate');
    expect((await send(refund)).status).toBe(503);
    expect((await send(refund)).status).toBe(200);
    expect(await (await send(refund)).json()).toMatchObject({ duplicate: true });
    expect(doubles.adjustment).toHaveBeenCalledWith({
      eventId: 'EVENT-1', resourceId: 'REFUND-1', captureId: 'CAPTURE-1',
      amountCents: 500, currency: 'USD', reversed: false,
    });
    expect(doubles.log).not.toHaveBeenCalled();
  });

  it('does not acknowledge a failed adjustment write or a mismatched currency', async () => {
    doubles.adjustment.mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce('mismatch');
    expect((await send(refund)).status).toBe(503);
    expect((await send(refund)).status).toBe(409);
  });

  it('acknowledges a completed capture notification only after reconciliation succeeds', async () => {
    const event = { id: 'EVENT-2', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {
      id: 'CAPTURE-1', supplementary_data: { related_ids: { order_id: 'ORDER-1' } },
    } };
    doubles.capture.mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce({ state: 'completed' });
    doubles.log.mockResolvedValue(true);
    expect((await send(event)).status).toBe(503);
    expect(doubles.log).not.toHaveBeenCalled();
    expect((await send(event)).status).toBe(200);
    expect(doubles.log).toHaveBeenCalledOnce();
  });
});
