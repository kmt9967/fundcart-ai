'use client';

import { createContext, useCallback, useContext } from 'react';
import { DICTS, LOCALE_TAGS, t as translate, type DictKey, type Locale } from './index';

const Ctx = createContext<Locale>('en');

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLocale(): Locale { return useContext(Ctx); }

export function useT() {
  const locale = useContext(Ctx);
  return useCallback((key: DictKey, params?: Record<string, string | number>) => translate(locale, key, params), [locale]);
}

/** Locale-aware number/date helpers (USD amounts stay in USD; only formatting changes). */
export function useFormat() {
  const locale = useContext(Ctx);
  const tag = LOCALE_TAGS[locale];
  return {
    usd: (cents: number | null | undefined) => cents == null ? translate(locale, 'common.priceUnavailable') : new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', numberingSystem: 'latn' }).format(cents / 100),
    date: (iso: string) => new Date(iso).toLocaleString(tag, { numberingSystem: 'latn' }),
    dict: DICTS[locale],
  };
}
