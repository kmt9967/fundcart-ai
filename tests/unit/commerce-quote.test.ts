import { describe, expect, it } from 'vitest';
import { checkApprovedOffer } from '@/lib/commerce-quote';

const approved = { amountCents: 54000, merchantDomain: 'store.example' };
const offer = { priceCents: 54000, currency: 'USD', availability: 'InStock', merchantDomain: 'store.example' };

describe('Sandbox offer revalidation', () => {
  it('accepts only the approved USD amount and seller', () => {
    expect(checkApprovedOffer({ ...offer, merchantDomain: 'STORE.EXAMPLE' }, approved)).toBe('matched');
    for (const priceCents of [53999, 54001]) {
      expect(checkApprovedOffer({ ...offer, priceCents }, approved)).toBe('changed');
    }
    expect(checkApprovedOffer({ ...offer, merchantDomain: 'other.example' }, approved)).toBe('changed');
  });

  it('fails closed without provider evidence for stock, currency, price or merchant', () => {
    for (const patch of [{ availability: null }, { availability: 'OutOfStock' }, { currency: 'EUR' }, { priceCents: null }, { priceCents: -1 }, { merchantDomain: null }]) {
      expect(checkApprovedOffer({ ...offer, ...patch }, approved)).toBe('unavailable');
    }
  });
});
