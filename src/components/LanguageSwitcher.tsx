'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, type Locale } from '@/i18n';
import { useLocale, useT } from '@/i18n/client';

/**
 * Accessible language picker. Saves the choice in a cookie (1 year) and re-renders the current page
 * on the server; client state on the page (e.g. an open shopping conversation) is kept.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale(); const t = useT(); const router = useRouter();
  const [pending, start] = useTransition();
  function change(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    document.documentElement.lang = next === 'ur' ? 'ur' : next;
    document.documentElement.dir = next === 'ur' ? 'rtl' : 'ltr';
    start(() => router.refresh());
  }
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{t('nav.language')}</span>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-2.5 size-4 text-mute" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
      <select value={locale} onChange={e => change(e.target.value as Locale)} disabled={pending} aria-label={t('nav.language')}
        className="min-h-10 cursor-pointer appearance-none rounded-lg border border-line bg-white ps-8 pe-3 text-sm font-semibold text-ink-2 hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-brand">
        {LOCALES.map(l => <option key={l} value={l} lang={l}>{LOCALE_NAMES[l]}</option>)}
      </select>
    </label>
  );
}
