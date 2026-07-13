// Cashier-composed offers for a single invoice. They're computed in-memory
// against the current cart and collapse into a single discount_amount on save.

import { CheckoutCartItem } from '@/types';

export type Offer =
  | {
      id: string;
      kind: 'invoice-percent';
      /** 0-100 */
      percent: number;
    }
  | {
      id: string;
      kind: 'items-percent';
      /** 0-100 */
      percent: number;
      /** productIds the discount applies to */
      productIds: string[];
    }
  | {
      id: string;
      kind: 'buy-x-pay-y';
      /** Total units the customer walks out with. */
      getCount: number;
      /** Units they actually pay for (the most expensive ones). */
      payCount: number;
    };

export interface OfferComputation {
  discount: number;
  /** Human-readable reason the offer didn't apply — used to grey the row out. */
  note?: string;
}

const clampPct = (p: number) => Math.max(0, Math.min(100, p));

const round2 = (n: number) => Math.round(n * 100) / 100;

const expandToUnits = (cart: CheckoutCartItem[]): number[] =>
  cart.flatMap((item) => Array(item.quantity).fill(item.unitPrice));

export const computeOfferDiscount = (
  offer: Offer,
  cart: CheckoutCartItem[]
): OfferComputation => {
  if (cart.length === 0) return { discount: 0, note: 'مفيش قطع في الفاتورة' };

  if (offer.kind === 'invoice-percent') {
    const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    return { discount: round2(subtotal * (clampPct(offer.percent) / 100)) };
  }

  if (offer.kind === 'items-percent') {
    const applicable = cart.filter((i) => offer.productIds.includes(i.productId));
    if (applicable.length === 0) {
      return { discount: 0, note: 'المنتجات المختارة مش موجودة في الفاتورة' };
    }
    const base = applicable.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    return { discount: round2(base * (clampPct(offer.percent) / 100)) };
  }

  // buy-x-pay-y
  const { getCount, payCount } = offer;
  if (getCount <= 0 || payCount < 0 || payCount >= getCount) {
    return { discount: 0, note: 'قيم العرض غير صحيحة' };
  }
  const units = expandToUnits(cart);
  if (units.length < getCount) {
    return {
      discount: 0,
      note: `العرض يشتغل لما تكون في الفاتورة ${getCount} قطعة على الأقل`,
    };
  }
  units.sort((a, b) => a - b);
  const freeCount = getCount - payCount;
  const discount = units.slice(0, freeCount).reduce((s, p) => s + p, 0);
  return { discount: round2(discount) };
};

export const computeTotalDiscount = (
  offers: Offer[],
  cart: CheckoutCartItem[]
): { discount: number; perOffer: OfferComputation[] } => {
  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const perOffer = offers.map((o) => computeOfferDiscount(o, cart));
  const raw = perOffer.reduce((s, r) => s + r.discount, 0);
  // Never let combined offers push the invoice below zero.
  return { discount: round2(Math.min(subtotal, raw)), perOffer };
};

export const describeOffer = (offer: Offer): string => {
  if (offer.kind === 'invoice-percent') {
    return `خصم ${offer.percent}% على كل الفاتورة`;
  }
  if (offer.kind === 'items-percent') {
    const n = offer.productIds.length;
    return `خصم ${offer.percent}% على ${n} صنف${n > 1 ? '' : ''} مختار`;
  }
  return `خد ${offer.getCount} قطعة وادفع تمن ${offer.payCount} فقط`;
};
