'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Logo } from './Logo';

const nav = [
  { href: '/assistant', label: 'Shop with AI', hint: 'Describe what you need' },
  { href: '/campaigns', label: 'Campaigns', hint: 'Support someone’s goal' },
  { href: '/how-it-works', label: 'How it works', hint: 'Agents, PayPal and safety' },
  { href: '/me', label: 'My FundCart', hint: 'Your campaigns and saved items' },
];

export function SiteHeader() {
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
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    panelRef.current?.querySelector<HTMLElement>('a')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6" aria-label="Main">
        <Logo />
        <div className="hidden items-center gap-1 text-sm font-semibold text-ink-2 md:flex">
          {nav.map(n => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 hover:bg-brand-soft hover:text-brand ${isActive(n.href) ? 'text-brand' : ''}`}>{n.label}</Link>
          ))}
          <Link className="btn btn-primary ml-1" href="/assistant">Start shopping</Link>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <Link className="btn btn-primary min-h-10 px-3.5 text-sm" href="/assistant">Shop</Link>
          <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
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
                <span className={`text-base font-bold ${isActive(n.href) ? 'text-brand' : 'text-ink'}`}>{n.label}</span>
                <span className="text-sm text-mute">{n.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-6 py-3 text-xs text-mute">Payments use the PayPal Sandbox. No real money moves.</p>
      </div>
    </header>
  );
}
