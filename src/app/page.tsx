import Link from 'next/link';
import { listPublicCampaigns } from '@/lib/campaign-list';
import { CampaignCard } from '@/components/CampaignCard';
import { Rich } from '@/components/Rich';
import { getT } from '@/i18n/server';
import type { DictKey } from '@/i18n';

export const dynamic = 'force-dynamic';

const steps: Array<{ n: string; title: DictKey; body: DictKey; tone: string }> = [
  { n: '01', title: 'home.s1t', body: 'home.s1b', tone: 'brand' },
  { n: '02', title: 'home.s2t', body: 'home.s2b', tone: 'brand' },
  { n: '03', title: 'home.s3t', body: 'home.s3b', tone: 'sun' },
  { n: '04', title: 'home.s4t', body: 'home.s4b', tone: 'ok' },
];
const trust: Array<[DictKey, DictKey]> = [['home.t1t', 'home.t1b'], ['home.t2t', 'home.t2b'], ['home.t3t', 'home.t3b'], ['home.t4t', 'home.t4b']];

export default async function Home() {
  const campaigns = await listPublicCampaigns(3).catch(() => []);
  const { t, usd } = await getT();
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_80%_-10%,#e7e1ff,transparent),radial-gradient(40rem_24rem_at_0%_20%,#fff0e4,transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-8 sm:gap-12 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[1.1fr_.9fr] lg:pt-20">
          <div className="fade-up">
            <span className="chip bg-white text-brand shadow-[var(--shadow-card)]">
              <span className="size-1.5 rounded-full bg-ok" /> {t('home.chip')}
            </span>
            <h1 className="h-display mt-5">
              {t('home.h1a')}<br /><span className="bg-gradient-to-r from-brand to-sun bg-clip-text text-transparent">{t('home.h1b')}</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-2 sm:mt-5 sm:text-lg">{t('home.lead')}</p>
            <div className="mt-7 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap">
              <Link href="/assistant" className="btn btn-primary min-h-12 px-5 text-base">{t('home.ctaFind')}</Link>
              <Link href="/campaigns" className="btn btn-ghost min-h-12 px-5 text-base">{t('home.ctaSupport')}</Link>
            </div>
            <dl className="mt-8 grid max-w-lg grid-cols-3 gap-3 text-xs sm:mt-10 sm:gap-4 sm:text-sm">
              <div><dt className="text-mute">{t('home.statData')}</dt><dd className="font-bold">{t('home.statDataV')}</dd></div>
              <div><dt className="text-mute">{t('home.statPay')}</dt><dd className="font-bold">{t('home.statPayV')}</dd></div>
              <div><dt className="text-mute">{t('home.statSpend')}</dt><dd className="font-bold">{t('home.statSpendV')}</dd></div>
            </dl>
          </div>
          <HeroMock t={t} usd={usd} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="eyebrow">{t('home.journeyEyebrow')}</p>
        <h2 className="h-section mt-2">{t('home.journeyTitle')}</h2>
        <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {steps.map(s => (
            <div key={s.n} className="card p-4 sm:p-5">
              <span className={`text-sm font-extrabold ${s.tone === 'sun' ? 'text-sun' : s.tone === 'ok' ? 'text-ok' : 'text-brand'}`}>{s.n}</span>
              <h3 className="mt-2 font-bold">{t(s.title)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-mute">{t(s.body)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-6xl px-4 sm:mt-20 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div><p className="eyebrow">{t('home.liveEyebrow')}</p><h2 className="h-section mt-2">{t('home.liveTitle')}</h2></div>
          <Link href="/campaigns" className="tap shrink-0 text-sm font-semibold text-brand hover:underline">{t('home.seeAll')}</Link>
        </div>
        {campaigns.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">{campaigns.map(c => <CampaignCard key={c.slug} c={c} />)}</div>
        ) : (
          <div className="card mt-6 p-8 text-center text-mute">{t('home.noCampaigns')} <Link className="font-semibold text-brand" href="/assistant">{t('home.startFirst')}</Link></div>
        )}
      </section>

      <section className="mx-auto mt-14 max-w-6xl px-4 sm:mt-20 sm:px-6">
        <div className="card grid gap-6 overflow-hidden p-6 sm:grid-cols-3 sm:gap-8 sm:p-10">
          <div className="sm:col-span-1"><p className="eyebrow">{t('home.trustEyebrow')}</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight">{t('home.trustTitle')}</h2></div>
          <ul className="grid gap-4 text-sm text-ink-2 sm:col-span-2 sm:grid-cols-2">
            {trust.map(([a, b]) => <li key={a}><b className="text-ink">{t(a)}</b> {t(b)}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}

function HeroMock({ t, usd }: { t: (k: DictKey, p?: Record<string, string | number>) => string; usd: (c: number) => string }) {
  return (
    <div className="fade-up relative" style={{ animationDelay: '.1s' }} aria-hidden>
      <div className="card p-4 sm:rotate-[-1.5deg] sm:p-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-mute"><span className="size-2 rounded-full bg-ok" /> {t('home.mockAgent')}</div>
        <p className="mt-3 rounded-xl bg-paper p-3 text-sm">{t('home.mockQuote')}</p>
        <div className="mt-3 space-y-2 text-xs text-ink-2">
          {(['home.mock1', 'home.mock2', 'home.mock3'] as const).map(k => (
            <div key={k} className="flex items-center gap-2"><span className="grid size-4 shrink-0 place-items-center rounded-full bg-ok-soft text-xs text-ok">✓</span>{t(k)}</div>
          ))}
        </div>
      </div>
      <div className="card relative -mt-3 ms-auto w-[88%] rotate-[1.5deg] p-4 sm:absolute sm:-bottom-24 sm:end-[-1rem] sm:mt-0 sm:w-[78%] sm:rotate-[2deg] sm:p-5">
        <div className="flex items-center justify-between text-xs font-semibold"><span className="text-sun">{t('home.mockCampaign')}</span><span className="text-mute">{t('home.mockExample')}</span></div>
        <div className="mt-2 text-sm font-bold">{t('home.mockTitle')}</div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sun-soft"><div className="h-full w-[64%] rounded-full bg-gradient-to-r from-sun to-brand" /></div>
        <div className="mt-2 flex justify-between text-xs text-mute"><span><Rich text={t('home.mockOf', { raised: `<b>${usd(32000)}</b>`, goal: usd(50000) })} boldClass="font-bold text-ink" /></span><span>{t('home.mockSupporters')}</span></div>
      </div>
      <div className="hidden h-24 sm:block" />
    </div>
  );
}
