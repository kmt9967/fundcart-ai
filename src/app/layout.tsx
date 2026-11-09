import type { Metadata, Viewport } from 'next';
import { Noto_Naskh_Arabic, Plus_Jakarta_Sans } from 'next/font/google';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { SiteHeader } from '@/components/SiteHeader';
import { Rich } from '@/components/Rich';
import { I18nProvider } from '@/i18n/client';
import { dirOf } from '@/i18n';
import { getT } from '@/i18n/server';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });
// Urdu (Arabic script) UI font. Naskh is used instead of Nastaliq so buttons and chips never clip.
const urdu = Noto_Naskh_Arabic({ subsets: ['arabic'], weight: ['400', '600', '700'], variable: '--font-urdu', display: 'swap' });

export const metadata: Metadata = {
  title: 'FundCart AI — Find what you need. Fund what you dream.',
  description: 'AI shopping research with real products, community funding through PayPal Sandbox, and purchases that only happen with your approval.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff', viewportFit: 'cover' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, t } = await getT();
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${jakarta.variable} ${urdu.variable}`}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">{t('nav.skip')}</a>
          <div className="bg-ink px-4 py-1.5 text-center text-xs font-medium text-white/85">
            <span className="sm:hidden"><Rich text={t('banner.short')} boldClass="text-white" /></span>
            <span className="hidden sm:inline"><Rich text={t('banner.long')} boldClass="text-white" /></span>
          </div>
          <SiteHeader />
          <main id="main">{children}</main>
          <footer className="mt-16 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:mt-24">
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-mute sm:grid-cols-3 sm:px-6">
              <div><Logo /><p className="mt-3">{t('footer.tagline')}</p></div>
              <nav aria-label={t('footer.nav')} className="-mx-2 flex flex-col">
                <Link className="flex min-h-11 items-center rounded-lg px-2 hover:text-brand" href="/how-it-works">{t('nav.how')}</Link>
                <Link className="flex min-h-11 items-center rounded-lg px-2 hover:text-brand" href="/disclosures">{t('footer.disclosures')}</Link>
                <a className="flex min-h-11 items-center rounded-lg px-2 hover:text-brand" href="https://github.com/kmt9967/fundcart-ai" rel="noreferrer">{t('footer.source')}</a>
              </nav>
              <p className="text-xs leading-relaxed">{t('footer.note')}</p>
            </div>
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
