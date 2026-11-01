import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { SiteHeader } from '@/components/SiteHeader';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: 'FundCart AI — Find what you need. Fund what you dream.',
  description: 'AI shopping research with real products, community funding through PayPal Sandbox, and purchases that only happen with your approval.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff', viewportFit: 'cover' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
        <div className="bg-ink px-4 py-1.5 text-center text-xs font-medium text-white/85">
          <span className="sm:hidden"><strong className="text-white">PayPal Sandbox demo</strong> · no real money moves</span>
          <span className="hidden sm:inline">Hackathon demo · Payments use the <strong className="text-white">PayPal Sandbox</strong> — no real money moves and no real products are bought.</span>
        </div>
        <SiteHeader />
        <main id="main">{children}</main>
        <footer className="mt-16 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:mt-24">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-mute sm:grid-cols-3 sm:px-6">
            <div><Logo /><p className="mt-3">Find what you need. Fund what you dream.</p></div>
            <nav aria-label="Footer" className="-mx-2 flex flex-col">
              <Link className="flex min-h-11 items-center rounded-lg px-2 hover:text-brand" href="/how-it-works">How it works</Link>
              <Link className="flex min-h-11 items-center rounded-lg px-2 hover:text-brand" href="/disclosures">Demo disclosures &amp; privacy</Link>
              <a className="flex min-h-11 items-center rounded-lg px-2 hover:text-brand" href="https://github.com/kmt9967/fundcart-ai" rel="noreferrer">Source code (MIT)</a>
            </nav>
            <p className="text-xs leading-relaxed">Built for the PayPal AI Hackathon 2026. An independent project, not affiliated with or endorsed by PayPal. Product data from Channel3; retailer prices can change.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
