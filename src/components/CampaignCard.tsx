import Link from 'next/link';
import type { CampaignSummary } from '@/lib/campaign-list';
import { getT } from '@/i18n/server';
import { Rich } from './Rich';
import { ProgressBar } from './ProgressBar';
import { StatusChip } from './StatusChip';

export async function CampaignCard({ c }: { c: CampaignSummary }) {
  const { t, usd } = await getT();
  return (
    <Link href={`/c/${c.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[16/10] bg-white">
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt="" className="size-full object-contain p-6 transition group-hover:scale-[1.02]" loading="lazy" />
        ) : <div className="size-full bg-gradient-to-br from-brand-soft to-sun-soft" />}
        <div className="absolute start-3 top-3 flex gap-1.5"><StatusChip status={c.status} />{c.isDemoSeed && <span className="chip bg-ink/80 text-white">{t('card.demo')}</span>}</div>
      </div>
      <div className="flex flex-1 flex-col border-t border-line p-5">
        <p className="text-xs font-semibold text-mute" dir="auto">{c.creatorName}{c.category ? ` · ${c.category}` : ''}</p>
        <h3 className="mt-1 line-clamp-2 font-bold leading-snug" dir="auto">{c.title}</h3>
        <div className="mt-auto pt-4">
          <ProgressBar percent={c.percent} />
          <div className="mt-2 flex justify-between text-xs text-mute">
            <span><Rich text={t('card.of', { raised: `<b>${usd(c.raisedCents)}</b>`, goal: usd(c.targetCents) })} boldClass="font-bold text-ink" /></span>
            <span>{c.supporterCount === 1 ? t('card.supporters1') : t('card.supportersN', { n: c.supporterCount })}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
