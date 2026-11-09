import 'server-only';
import { cookies, headers } from 'next/headers';
import { isLocale, negotiate, t, LOCALE_COOKIE, LOCALE_TAGS, type DictKey, type Locale } from './index';

/** The visitor's interface language: saved choice (cookie) first, then the browser's Accept-Language. */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const saved = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return negotiate((await headers()).get('accept-language'));
}

export async function getT() {
  const locale = await getLocale();
  const tag = LOCALE_TAGS[locale];
  return {
    locale,
    t: (key: DictKey, params?: Record<string, string | number>) => t(locale, key, params),
    /** USD amounts stay USD; only number formatting follows the interface language (Latin digits). */
    usd: (cents: number | null | undefined) => cents == null ? t(locale, 'common.priceUnavailable') : new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', numberingSystem: 'latn' }).format(cents / 100),
    date: (iso: string | Date) => new Date(iso).toLocaleDateString(tag, { numberingSystem: 'latn' }),
    dateTime: (iso: string | Date) => new Date(iso).toLocaleString(tag, { numberingSystem: 'latn' }),
    time: (iso: string | Date) => new Date(iso).toLocaleTimeString(tag, { numberingSystem: 'latn' }),
    ago: (iso: string) => {
      const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
      return s < 60 ? t(locale, 'ago.s', { n: s }) : s < 3600 ? t(locale, 'ago.m', { n: Math.round(s / 60) }) : s < 86400 ? t(locale, 'ago.h', { n: Math.round(s / 3600) }) : t(locale, 'ago.d', { n: Math.round(s / 86400) });
    },
  };
}
