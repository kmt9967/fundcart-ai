'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Logo } from './Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Rich } from './Rich';
import { useT } from '@/i18n/client';
import type { DictKey } from '@/i18n';

const nav: Array<{ href: string; label: DictKey; hint: DictKey }> = [
  { href: '/assistant', label: 'nav.assistant', hint: 'nav.assistantHint' },
  { href: '/campaigns', label: 'nav.campaigns', hint: 'nav.campaignsHint' },
  { href: '/how-it-works', label: 'nav.how', hint: 'nav.howHint' },
  { href: '/me', label: 'nav.me', hint: 'nav.meHint' },
];

export function SiteHeader() {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close the menu whenever the route changes (adjusting state during render, per React guidance).
  if (pathname !== lastPath) { setLastPath(pathname); setOpen(false); }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !btnRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    panelRef.current?.querySelector<HTMLElement>('a')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6" aria-label={t('nav.main')}>
        <Logo />
        <div className="hidden items-center gap-1 text-sm font-semibold text-ink-2 md:flex">
          {nav.map(n => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-2.5 py-2 hover:bg-brand-soft hover:text-brand lg:px-3 ${isActive(n.href) ? 'text-brand' : ''}`}>{t(n.label)}</Link>
          ))}
          <LanguageSwitcher className="ms-1" />
          <Link className="btn btn-primary ms-1 hidden whitespace-nowrap lg:inline-flex" href="/assistant">{t('nav.start')}</Link>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <Link className="btn btn-primary min-h-10 px-3.5 text-sm" href="/assistant">{t('nav.shop')}</Link>
          <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="mobile-menu"
            aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
            className="grid size-11 place-items-center rounded-xl border border-line bg-white text-ink transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>
      <div id="mobile-menu" ref={panelRef} hidden={!open}
        className="menu-panel absolute inset-x-0 top-full border-b border-line bg-white shadow-[var(--shadow-lift)] md:hidden">
        <ul className="mx-auto max-w-6xl px-3 py-2">
          {nav.map(n => (
            <li key={n.href}>
              <Link href={n.href} onClick={() => setOpen(false)} aria-current={isActive(n.href) ? 'page' : undefined}
                className={`flex min-h-14 flex-col justify-center rounded-xl px-3 py-2 hover:bg-brand-soft ${isActive(n.href) ? 'bg-brand-soft' : ''}`}>
                <span className={`text-base font-bold ${isActive(n.href) ? 'text-brand' : 'text-ink'}`}>{t(n.label)}</span>
                <span className="text-sm text-mute">{t(n.hint)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-3">
          <p className="text-xs text-mute"><Rich text={t('banner.short')} /></p>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
