import 'server-only';
import { cookies, headers } from 'next/headers';
import { isLocale, negotiate, t, LOCALE_COOKIE, type DictKey, type Locale } from './index';

/** The visitor's interface language: saved choice (cookie) first, then the browser's Accept-Language. */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const saved = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return negotiate((await headers()).get('accept-language'));
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: (key: DictKey, params?: Record<string, string | number>) => t(locale, key, params) };
}
