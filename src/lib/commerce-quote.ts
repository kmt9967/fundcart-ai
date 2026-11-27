import type { Product } from './channel3';

export function checkApprovedOffer(
  offer: Pick<Product, 'priceCents' | 'currency' | 'availability' | 'merchantDomain'>,
  approved: { amountCents: number; merchantDomain: string | null },
): 'unavailable' | 'changed' | 'matched' {
  if (offer.currency !== 'USD' || !Number.isSafeInteger(offer.priceCents) || !offer.priceCents
    || offer.priceCents < 0 || offer.availability !== 'InStock' || !offer.merchantDomain) return 'unavailable';
  return offer.priceCents === approved.amountCents && offer.merchantDomain.toLowerCase() === approved.merchantDomain?.toLowerCase()
    ? 'matched' : 'changed';
}
