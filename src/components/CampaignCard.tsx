import Link from 'next/link';
import type { CampaignSummary } from '@/lib/campaign-list';
import { formatUSD } from '@/lib/money';
import { ProgressBar } from './ProgressBar';
import { StatusChip } from './StatusChip';

export function CampaignCard({ c }: { c: CampaignSummary }) {
  return (
    <Link href={`/c/${c.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[16/10] bg-white">
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt="" className="size-full object-contain p-6 transition group-hover:scale-[1.02]" loading="lazy" />
        ) : <div className="size-full bg-gradient-to-br from-brand-soft to-sun-soft" />}
        <div className="absolute left-3 top-3 flex gap-1.5"><StatusChip status={c.status} />{c.isDemoSeed && <span className="chip bg-ink/80 text-white">Demo data</span>}</div>
      </div>
      <div className="flex flex-1 flex-col border-t border-line p-5">
        <p className="text-xs font-semibold text-mute">{c.creatorName}{c.category ? ` · ${c.category}` : ''}</p>
        <h3 className="mt-1 line-clamp-2 font-bold leading-snug">{c.title}</h3>
        <div className="mt-auto pt-4">
          <ProgressBar percent={c.percent} />
          <div className="mt-2 flex justify-between text-xs text-mute">
            <span><b className="text-ink">{formatUSD(c.raisedCents)}</b> of {formatUSD(c.targetCents)}</span>
            <span>{c.supporterCount} supporter{c.supporterCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
