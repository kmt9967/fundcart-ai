import Image from 'next/image';
import Link from 'next/link';
import { listPublicCampaigns } from '@/lib/campaign-list';
import { ProgressBar } from '@/components/ProgressBar';
import { Rich } from '@/components/Rich';
import { StatusChip } from '@/components/StatusChip';
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
  const [campaigns, { t, locale, usd }] = await Promise.all([listPublicCampaigns(3).catch(() => []), getT()]);
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
      <section className="pt-6 sm:pt-16 sm:text-center">
        <h1 className="h-display max-w-[15ch] max-sm:text-[28px] sm:mx-auto sm:max-w-xl">{locale === 'en' ? 'Your next find starts here.' : t('home.h1a')}</h1>
        <p className="mt-2 max-w-lg sm:mx-auto sm:mt-3 text-sm text-mute sm:text-base">{locale === 'en' ? 'Intelligent curation for hardware and tools.' : t('home.lead')}</p>
        <form action="/assistant" className="mx-auto mt-5 flex max-w-3xl items-center gap-2 rounded-full border border-line bg-white p-2 shadow-card sm:mt-10">
          <label htmlFor="discover-query" className="sr-only">{t('assistant.requestLabel')}</label>
          <svg className="ms-3 size-4 shrink-0 text-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg>
          <input id="discover-query" name="q" required maxLength={600} className="min-w-0 flex-1 rounded-lg px-1 py-2 text-sm focus-visible:outline-brand" placeholder={t('assistant.placeholder')} dir="auto" />
          <button type="submit" className="btn btn-primary rounded-full">{t('assistant.search')}</button>
        </form>
        <div className="mt-3 hidden flex-wrap justify-center gap-2 sm:flex">
          {searches[locale].map(query => <Link key={query} href={`/assistant?q=${encodeURIComponent(query)}`} className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs text-ink-2 hover:bg-brand-soft">{query}</Link>)}
        </div>
        <div className="card mt-5 overflow-hidden sm:mt-12">
          <div className="relative aspect-[16/10] sm:aspect-[2.3/1]">
            <Image src="/stitch/hardware-studio.webp" alt="" fill preload className="object-cover" sizes="(max-width: 767px) 100vw, 1344px" />
          </div>
          <div className="p-3 sm:hidden">
            <Link href="/assistant" className="btn btn-primary w-full">{t('nav.assistant')} <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
      <section className="mt-16 hidden border-t border-line pt-14 sm:block">
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
      <section className="mt-6 sm:mt-16 sm:border-t sm:border-line sm:pt-14">
        <h2 className="h-section">{locale === 'en' ? 'Curated Collections' : t('nav.assistant')}</h2>
        {locale === 'en' && <p className="mt-1 text-sm text-mute">Editorial spaces and tools.</p>}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-5">
          {([['featured-workspace', 2, 'Creative Workspaces'], ['featured-audio', 1, 'Acoustic Reference']] as const).map(([asset, index, title]) =>
            <Link key={asset} href={`/assistant?q=${encodeURIComponent(searches[locale][index])}`} className="card group overflow-hidden sm:relative sm:isolate sm:flex sm:aspect-[16/10] sm:items-end sm:p-6 sm:text-white">
              <div className="relative aspect-[3/2] sm:absolute sm:inset-0 sm:-z-10 sm:aspect-auto">
                <Image src={`/stitch/${asset}.webp`} alt="" fill sizes="45vw" className="object-cover transition-transform motion-safe:group-hover:scale-105" />
              </div>
              <span className="absolute inset-0 -z-10 hidden bg-gradient-to-t from-ink/85 via-ink/30 to-transparent sm:block" />
              <h3 className="p-2.5 text-xs font-bold sm:p-0 sm:text-xl">{locale === 'en' ? title : searches[locale][index]}</h3>
            </Link>)}
        </div>
      </section>
      <section className="mt-6 sm:mt-16 sm:border-t sm:border-line sm:pt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="h-section">{t('camps.title')}</h2>
          <Link href="/campaigns" className="tap text-sm font-semibold text-brand hover:underline">{t('home.seeAll')}</Link>
        </div>
        {campaigns.length ? (
          <ul className="mt-3 space-y-3 sm:mt-5">
            {campaigns.map(campaign => <li key={campaign.slug} className="card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,240px)_auto] sm:px-5">
              <div className="min-w-0">
                <h3 className="wrap-anywhere text-sm font-bold" dir="auto">{campaign.title}</h3>
                {campaign.isDemoSeed && <span className="chip mt-1 bg-brand-soft text-brand">{t('card.demo')}</span>}
                <p className="mt-1 text-xs text-mute"><Rich text={t('card.of', { raised: `<b>${usd(campaign.raisedCents)}</b>`, goal: usd(campaign.targetCents) })} boldClass="font-semibold text-ink" /></p>
              </div>
              <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:row-start-auto">
                <ProgressBar percent={campaign.percent} />
                <div className="mt-1 hidden items-center justify-between gap-2 text-xs text-mute sm:flex"><bdi>{campaign.percent}%</bdi><StatusChip status={campaign.status} /></div>
              </div>
              <Link href={`/c/${campaign.slug}`} aria-label={`${t('mg.viewPublic')} — ${campaign.title}`} className="btn btn-primary min-h-11 self-center px-3 text-xs">{t('mg.viewPublic')}</Link>
            </li>)}
          </ul>
        ) : <div className="card mt-5 p-6 text-sm text-mute">{t('home.noCampaigns')}</div>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/how-it-works" className="btn btn-ghost">{t('nav.how')}</Link>
          <DemoButton compact className="grid" />
        </div>
      </section>
    </div>
  );
}
