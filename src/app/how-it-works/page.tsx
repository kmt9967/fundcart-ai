import Link from 'next/link';
import type { Metadata } from 'next';
import { Rich } from '@/components/Rich';
import { getT } from '@/i18n/server';
import type { DictKey } from '@/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('how.eyebrow')} — FundCart AI` };
}

const agents = [1, 2, 3, 4, 5, 6, 7, 8].map(n => [`how.a${n}n`, `how.a${n}b`] as [DictKey, DictKey]);

export default async function HowItWorks() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-12">
      <p className="eyebrow">{t('how.eyebrow')}</p>
      <h1 className="h-page mt-2">{t('how.title')}</h1>

      <section className="mt-8 sm:mt-10"><h2 className="text-xl font-bold">{t('how.recTitle')}</h2>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed text-ink-2">
          {(['how.rec1', 'how.rec2', 'how.rec3', 'how.rec4'] as const).map(k => <li key={k}><Rich text={t(k)} boldClass="font-bold text-ink" /></li>)}
        </ol>
        <p className="mt-3 text-xs text-mute"><a className="tap inline-flex items-center underline hover:text-brand" href="https://developer.android.com/studio/install" target="_blank" rel="noopener noreferrer">developer.android.com/studio/install ↗</a></p>
      </section>

      <section className="mt-10 sm:mt-12"><h2 className="text-xl font-bold">{t('how.agentsTitle')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">{agents.map(([n, b]) => <div key={n} className="card p-4 sm:p-5"><h3 className="font-bold text-brand">{t(n)}</h3><p className="mt-2 text-sm leading-relaxed text-ink-2">{t(b)}</p></div>)}</div></section>

      <section className="mt-10 sm:mt-12"><h2 className="text-xl font-bold">{t('how.paymentsTitle')}</h2>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed text-ink-2">
          {(['how.p1', 'how.p2', 'how.p3', 'how.p4', 'how.p5'] as const).map(k => <li key={k}><Rich text={t(k)} boldClass="font-bold text-ink" /></li>)}
        </ol></section>

      <section className="card mt-10 p-5 sm:mt-12 sm:p-6"><h2 className="text-lg font-bold">{t('how.flowTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{t('how.flowBody')}</p></section>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:flex"><Link href="/assistant" className="btn btn-primary">{t('how.try')}</Link><Link href="/disclosures" className="btn btn-ghost">{t('how.disclosures')}</Link></div>
    </div>
  );
}
