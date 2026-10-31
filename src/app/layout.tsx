import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: 'FundCart AI — Find what you need. Fund what you dream.',
  description: 'AI shopping research with real products, community funding through PayPal Sandbox, and purchases that only happen with your approval.',
};

const nav = [
  { href: '/assistant', label: 'Shop with AI' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/how-it-works', label: 'How it works' },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
        <div className="bg-ink px-3 py-1.5 text-center text-[11px] font-medium tracking-wide text-white/80">
          Hackathon demo · Payments use the <strong className="text-white">PayPal Sandbox</strong> — no real money moves and no real products are bought.
        </div>
        <header className="sticky top-0 z-30 border-b border-line/80 bg-white/85 backdrop-blur">
          <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Main">
            <Logo />
            <div className="flex items-center gap-1 text-sm font-semibold text-ink-2">
              {nav.map(n => (
                <Link key={n.href} className="hidden rounded-lg px-3 py-2 hover:bg-brand-soft hover:text-brand md:block" href={n.href}>{n.label}</Link>
              ))}
              <Link className="rounded-lg px-3 py-2 hover:bg-brand-soft hover:text-brand" href="/me">My FundCart</Link>
              <Link className="btn btn-primary ml-1" href="/assistant">Start shopping</Link>
            </div>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer className="mt-24 border-t border-line bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-mute sm:grid-cols-3 sm:px-6">
            <div><Logo /><p className="mt-3">Find what you need. Fund what you dream.</p></div>
            <div className="space-y-2">
              <Link className="block hover:text-brand" href="/how-it-works">How it works</Link>
              <Link className="block hover:text-brand" href="/disclosures">Demo disclosures &amp; privacy</Link>
              <a className="block hover:text-brand" href="https://github.com/kmt9967/fundcart-ai" rel="noreferrer">Source code (MIT)</a>
            </div>
            <p className="text-xs leading-relaxed">Built for the PayPal AI Hackathon 2026. An independent project, not affiliated with or endorsed by PayPal. Product data from Channel3; retailer prices can change.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
