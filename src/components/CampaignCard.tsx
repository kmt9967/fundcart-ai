import Link from 'next/link';
import type { CampaignSummary } from '@/lib/campaign-list';
import { getT } from '@/i18n/server';
import { Rich } from './Rich';
import { ProgressBar } from './ProgressBar';
import { StatusChip } from './StatusChip';

export async function CampaignCard({ c, editorial = false }: { c: CampaignSummary; editorial?: boolean }) {
  const { t, usd } = await getT();
  return (
    <Link href={`/c/${c.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className={`relative bg-white ${editorial ? 'aspect-square' : 'aspect-[16/10]'}`}>
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt="" className={`size-full transition group-hover:scale-[1.02] ${editorial ? 'object-cover' : 'object-contain p-6'}`} loading="lazy" />
        ) : <div className="size-full bg-gradient-to-br from-brand-soft to-sun-soft" />}
        {editorial && <span className="chip absolute end-2 top-2 bg-white text-brand"><bdi>{c.percent}%</bdi></span>}
        <div className="absolute start-3 top-3 flex gap-1.5"><StatusChip status={c.status} />{c.isDemoSeed && <span className="chip bg-ink/80 text-white">{t('card.demo')}</span>}</div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col border-t border-line p-3 sm:p-5">
        <p className="text-xs font-semibold text-mute" dir="auto">{c.creatorName}{c.category ? ` · ${c.category}` : ''}</p>
        <h3 className="mt-1 line-clamp-2 font-bold leading-snug" dir="auto">{c.title}</h3>
        <div className="mt-auto pt-4">
          <ProgressBar percent={c.percent} />
          <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-mute">
            <span><Rich text={t('card.of', { raised: `<b>${usd(c.raisedCents)}</b>`, goal: usd(c.targetCents) })} boldClass="font-bold text-ink" /></span>
            <span>{c.supporterCount === 1 ? t('card.supporters1') : t('card.supportersN', { n: c.supporterCount })}</span>
          </div>
          {editorial && <span className="btn btn-primary mt-3 w-full">{t('mg.viewPublic')}</span>}
        </div>
      </div>
    </Link>
  );
}
