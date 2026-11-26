import Image from 'next/image';
import Link from 'next/link';
import { listPublicCampaigns } from '@/lib/campaign-list';
import { CampaignCard } from '@/components/CampaignCard';
import { getT } from '@/i18n/server';
import { DemoButton } from '@/components/DemoButton';

export const dynamic = 'force-dynamic';

const featured = ['featured-laptop', 'featured-audio', 'featured-workspace'] as const;

const searches = {
  en: ['Laptops for code', 'Noise cancelling headphones', 'Ergonomic workspace'],
  ur: ['کوڈنگ کے لیے لیپ ٹاپ', 'شور کم کرنے والے ہیڈفون', 'آرام دہ ورک اسپیس'],
  es: ['Portátiles para programar', 'Auriculares con cancelación de ruido', 'Espacio de trabajo ergonómico'],
  fr: ['Ordinateurs pour coder', 'Casques antibruit', 'Espace de travail ergonomique'],
};

export default async function Home() {
  const [campaigns, { t, locale }] = await Promise.all([listPublicCampaigns(3).catch(() => []), getT()]);
  return (
    <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
      <section className="pt-12 text-center sm:pt-16">
        <h1 className="h-display mx-auto max-w-xl">{locale === 'en' ? 'Your next find starts here.' : t('home.h1a')}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-mute sm:text-base">{locale === 'en' ? 'Intelligent curation for hardware and tools.' : t('home.lead')}</p>
        <form action="/assistant" className="mx-auto mt-7 flex max-w-2xl items-center gap-2 rounded-full border border-line bg-white p-2 shadow-card sm:mt-10">
          <label htmlFor="discover-query" className="sr-only">{t('assistant.requestLabel')}</label>
          <svg className="ms-3 size-4 shrink-0 text-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg>
          <input id="discover-query" name="q" required maxLength={600} className="min-w-0 flex-1 rounded-lg px-1 py-2 text-sm focus-visible:outline-brand" placeholder={t('assistant.placeholder')} dir="auto" />
          <button type="submit" className="btn btn-primary rounded-full">{t('assistant.search')}</button>
        </form>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {searches[locale].map(query => <Link key={query} href={`/assistant?q=${encodeURIComponent(query)}`} className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs text-ink-2 hover:bg-brand-soft">{query}</Link>)}
        </div>
        <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-2xl border border-line sm:mt-12 sm:aspect-[2.3/1]">
          <Image src="/stitch/hardware-studio.webp" alt="" fill preload className="object-cover" sizes="(max-width: 767px) 100vw, 1344px" />
        </div>
      </section>
      <section className="mt-12 border-t border-line pt-10 sm:mt-16 sm:pt-14">
        <h2 className="h-section">{locale === 'en' ? 'Featured Hardware' : t('nav.assistant')}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {featured.map((asset, index) => {
            const query = searches[locale][index];
            return <Link key={asset} href={`/assistant?q=${encodeURIComponent(query)}`} className="card group grid min-w-0 gap-3 p-4 hover:border-brand">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-brand-soft">
                <Image src={`/stitch/${asset}.webp`} alt="" fill sizes="(max-width: 639px) 90vw, 30vw" className="object-cover" />
              </div>
              <h3 dir="auto" className="font-semibold">{query}</h3>
              <span className="btn btn-primary">{t('assistant.search')}</span>
            </Link>;
          })}
        </div>
      </section>
      <section className="mt-12 border-t border-line pt-10 sm:mt-16 sm:pt-14">
        <h2 className="h-section">{locale === 'en' ? 'Curated Collections' : t('nav.assistant')}</h2>
        {locale === 'en' && <p className="mt-1 text-sm text-mute">Editorial spaces and tools.</p>}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {([['featured-workspace', 2, 'Creative Workspaces'], ['featured-audio', 1, 'Acoustic Reference']] as const).map(([asset, index, title]) =>
            <Link key={asset} href={`/assistant?q=${encodeURIComponent(searches[locale][index])}`} className="card group relative isolate flex aspect-[16/10] items-end overflow-hidden p-6 text-white">
              <Image src={`/stitch/${asset}.webp`} alt="" fill sizes="(max-width: 767px) 90vw, 45vw" className="-z-10 object-cover transition-transform motion-safe:group-hover:scale-105" />
              <span className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
              <h3 className="text-xl font-bold">{locale === 'en' ? title : searches[locale][index]}</h3>
            </Link>)}
        </div>
      </section>
      <section className="mt-12 border-t border-line pt-10 sm:mt-16 sm:pt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="h-section">{t('nav.campaigns')}</h2>
          <Link href="/campaigns" className="tap text-sm font-semibold text-brand hover:underline">{t('home.seeAll')}</Link>
        </div>
        {campaigns.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{campaigns.map(campaign => <CampaignCard key={campaign.slug} c={campaign} />)}</div>
        ) : <div className="card mt-5 p-6 text-sm text-mute">{t('home.noCampaigns')}</div>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/how-it-works" className="btn btn-ghost">{t('nav.how')}</Link>
          <DemoButton compact className="grid" />
        </div>
      </section>
    </div>
  );
}
