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

export default async function Campaigns() {
  const list = await listPublicCampaigns(48).catch(() => []);
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">{t('camps.eyebrow')}</p><h1 className="h-page mt-2">{t('camps.title')}</h1><p className="mt-2 text-sm text-ink-2 sm:text-base">{t('camps.lead')}</p></div>
        <Link href="/assistant" className="btn btn-primary w-full sm:w-auto">{t('camps.start')}</Link>
      </div>
      {list.length ? <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">{list.map(c => <CampaignCard key={c.slug} c={c} />)}</div>
        : <div className="card mt-8 p-10 text-center text-mute">{t('camps.none')}</div>}
    </div>
  );
}
