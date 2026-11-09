import { en, type Dict, type DictKey } from './dict/en';
import { ur } from './dict/ur';
import { es } from './dict/es';
import { fr } from './dict/fr';

export const LOCALES = ['en', 'ur', 'es', 'fr'] as const;
export type Locale = typeof LOCALES[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'fc_lang';
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', ur: 'اردو', es: 'Español', fr: 'Français' };
export const LOCALE_TAGS: Record<Locale, string> = { en: 'en', ur: 'ur-PK', es: 'es', fr: 'fr' };

export const DICTS: Record<Locale, Dict> = { en, ur, es, fr };

export function isLocale(x: unknown): x is Locale { return typeof x === 'string' && (LOCALES as readonly string[]).includes(x); }
export function dirOf(locale: Locale): 'rtl' | 'ltr' { return locale === 'ur' ? 'rtl' : 'ltr'; }

/** Translate a key with {placeholders}. Falls back to English, then to the key itself. */
export function t(locale: Locale, key: DictKey, params?: Record<string, string | number>): string {
  const s = (DICTS[locale] as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key;
  return params ? s.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`)) : s;
}

/** Pick a supported locale from an Accept-Language header. */
export function negotiate(accept: string | null | undefined): Locale {
  for (const part of (accept || '').split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase().slice(0, 2);
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

export type { DictKey };
