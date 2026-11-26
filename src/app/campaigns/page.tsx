import Link from 'next/link';
import type { Metadata } from 'next';
import { listPublicCampaigns } from '@/lib/campaign-list';
import { CampaignCard } from '@/components/CampaignCard';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('camps.title')} — FundCart AI` };
}

export default async function Campaigns({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const [campaigns, { t, locale }, { q, category }] = await Promise.all([listPublicCampaigns(48).catch(() => []), getT(), searchParams]);
  const query = typeof q === 'string' ? q.trim().slice(0, 100) : '';
  const categories = [...new Set(campaigns.flatMap(c => c.category ? [c.category] : []))].slice(0, 8);
  const selected = typeof category === 'string' && categories.includes(category) ? category : '';
  const list = campaigns.filter(c => (!selected || c.category === selected)
    && (!query || `${c.title} ${c.category ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  const [all, search] = { en: ['All', 'Search needs'], ur: ['سب', 'ضروریات تلاش کریں'], es: ['Todas', 'Buscar necesidades'], fr: ['Toutes', 'Rechercher des besoins'] }[locale];
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">{t('camps.eyebrow')}</p><h1 className="h-page mt-2">{t('camps.title')}</h1><p className="mt-2 text-sm text-ink-2 sm:text-base">{t('camps.lead')}</p></div>
        <Link href="/assistant" className="btn btn-primary w-full sm:w-auto">{t('camps.start')}</Link>
      </div>
      <form className="mt-5 flex gap-2" action="/campaigns">
        <label className="sr-only" htmlFor="needs-search">{search}</label>
        <input id="needs-search" name="q" type="search" className="input max-w-md" maxLength={100} placeholder={search} defaultValue={query} />
        {!!selected && <input type="hidden" name="category" value={selected} />}
        <button className="btn btn-primary" type="submit">{t('assistant.search')}</button>
      </form>
      {!!categories.length && <nav aria-label={t('need.label')} className="mt-3 flex flex-wrap gap-2 border-b border-line pb-4">
        {['', ...categories].map(value => {
          const params = new URLSearchParams();
          if (query) params.set('q', query);
          if (value) params.set('category', value);
          return <Link aria-current={selected === value ? 'true' : undefined} key={value} href={`/campaigns${params.size ? `?${params}` : ''}`}
            className={`btn min-h-9 rounded-full ${selected === value ? 'btn-primary' : 'btn-ghost'}`}>{value || all}</Link>;
        })}
      </nav>}
      {list.length ? <div className="mt-6 grid grid-cols-2 gap-2 sm:mt-8 sm:gap-5 lg:grid-cols-3">{list.map(c => <CampaignCard key={c.slug} c={c} editorial />)}</div>
        : <div className="card mt-8 p-10 text-center text-mute">{t('camps.none')}</div>}
    </div>
  );
}
