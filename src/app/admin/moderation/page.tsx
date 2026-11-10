import type { Metadata } from 'next';
import Link from 'next/link';
import { currentModerator, moderationQueue } from '@/lib/moderators';
import { getT } from '@/i18n/server';
import { ModerationActions } from './ModerationActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Moderation — FundCart AI', robots: { index: false } };

// Moderator-only queue. The role check runs on the server for the page and again in the API.
export default async function ModerationPage() {
  const { t, usd, dateTime } = await getT();
  const mod = await currentModerator();
  if (!mod) return <div className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="h-page">{t('admin.title')}</h1><p className="mt-3 text-mute" data-testid="forbidden">{t('admin.forbidden')}</p><Link className="btn btn-primary mt-6" href="/account">{t('auth.signInCta')}</Link></div>;
  const items = await moderationQueue();
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="h-page">{t('admin.title')}</h1>
      <p className="mt-2 text-sm text-ink-2">{t('admin.lead')}</p>
      {items.length === 0 ? <p className="mt-6 text-mute">{t('admin.empty')}</p> : (
        <ul className="mt-6 space-y-4">{items.map(c => (
          <li key={c.id} className="card p-4 text-sm" data-testid="queue-item">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link className="font-bold underline" href={`/c/${c.slug}`} dir="auto">{c.title}</Link>
              <span className="chip bg-paper text-ink-2">{c.moderationStatus}</span>
            </div>
            <p className="mt-1 text-xs text-mute">{c.creatorName} · <bdi>{usd(c.targetCents)}</bdi> · {dateTime(c.createdAt)}</p>
            <p className="mt-2 line-clamp-4 whitespace-pre-line text-ink-2" dir="auto">{c.story}</p>
            {c.reasons.length > 0 && <p className="mt-2 text-xs"><b>{t('admin.reasons')}:</b> {c.reasons.join(', ')}</p>}
            {c.reports.length > 0 && <div className="mt-2 text-xs"><b>{t('admin.reports')} ({c.reports.length}):</b><ul className="ms-4 list-disc">{c.reports.slice(0, 5).map((r, i) => <li key={i}>{r.reason}{r.details ? `: ${r.details}` : ''}</li>)}</ul></div>}
            <ModerationActions campaignId={c.id} />
          </li>
        ))}</ul>
      )}
    </div>
  );
}
