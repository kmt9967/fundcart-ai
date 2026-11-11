import type { Metadata } from 'next';
import Link from 'next/link';
import { currentModerator, moderationQueue } from '@/lib/moderators';
import { getT } from '@/i18n/server';
import { ModerationActions } from './ModerationActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Moderation — FundCart AI', robots: { index: false } };

const RISK_CLASS: Record<string, string> = { high: 'bg-bad/10 text-bad', medium: 'bg-amber-100 text-amber-900', low: 'bg-paper text-ink-2' };

// Moderator-only queue. The role check runs on the server for the page and again in the API.
export default async function ModerationPage() {
  const { t, usd, dateTime } = await getT();
  const mod = await currentModerator();
  if (!mod) return <div className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="h-page">{t('admin.title')}</h1><p className="mt-3 text-mute" data-testid="forbidden">{t('admin.forbidden')}</p><Link className="btn btn-primary mt-6" href="/account">{t('auth.signInCta')}</Link></div>;
  const items = await moderationQueue(mod.profileId);
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="h-page">{t('admin.title')}</h1>
      <p className="mt-2 text-sm text-ink-2">{t('admin.lead')}</p>
      {items.length === 0 ? <p className="mt-6 text-mute" data-testid="queue-empty">{t('admin.empty')}</p> : (
        <ul className="mt-6 space-y-4">{items.map(c => {
          const risk = c.eligibility?.risk || 'low';
          const flags = [...new Set([...c.reasons, ...(c.eligibility?.reasons || [])])];
          return (
            <li key={c.id} className="card p-4 text-sm" data-testid="queue-item" data-slug={c.slug}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link className="font-bold underline" href={`/c/${c.slug}`} dir="auto">{c.title}</Link>
                <span className="flex gap-1">
                  <span className={`chip ${RISK_CLASS[risk] || RISK_CLASS.low}`} data-testid="mod-risk">{t('mod.risk')}: {risk}</span>
                  <span className="chip bg-paper text-ink-2">{c.moderationStatus}</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-mute">{c.creatorName} · {dateTime(c.createdAt)} · {t('mod.account')}: {c.ownerHasAccount ? (c.ownerVerified ? t('mod.verified') : t('mod.unverified')) : t('mod.guest')}</p>
              <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                <div><dt className="inline font-semibold">{t('mod.product')}: </dt><dd className="inline" dir="auto">{c.productTitle || '—'}{c.merchant ? ` (${c.merchant})` : ''}</dd></div>
                <div><dt className="inline font-semibold">{t('mod.ranking')}: </dt><dd className="inline">{c.rankingMode || '—'}</dd></div>
                <div><dt className="inline font-semibold">{t('mod.category')}: </dt><dd className="inline">{c.needCategory || '—'}</dd></div>
                <div><dt className="inline font-semibold">{t('mod.purpose')}: </dt><dd className="inline" dir="auto" data-testid="mod-purpose">{c.creatorPurpose || '—'}</dd></div>
                <div className="sm:col-span-2"><dt className="inline font-semibold">{t('mod.gap')}: </dt><dd className="inline"><bdi>{usd(c.itemPriceCents)} − {usd(c.ownFundsCents)} + {usd(c.bufferCents)} = {usd(c.targetCents)}</bdi></dd></div>
                <div><dt className="inline font-semibold">{t('mod.outcome')}: </dt><dd className="inline">{c.eligibility?.outcome || '—'}</dd></div>
                <div><dt className="inline font-semibold">{t('mod.raised')}: </dt><dd className="inline"><bdi>{usd(c.raisedCents)}</bdi></dd></div>
              </dl>
              <p className="mt-3 line-clamp-5 whitespace-pre-line text-ink-2" dir="auto">{c.story}</p>
              {flags.length > 0 && <p className="mt-2 text-xs" data-testid="mod-reasons"><b>{t('admin.reasons')}:</b> {flags.join(', ')}</p>}
              {c.reports.length > 0 && <div className="mt-2 text-xs"><b>{t('admin.reports')} ({c.reports.length}):</b><ul className="ms-4 list-disc">{c.reports.slice(0, 5).map((r, i) => <li key={i}>{r.reason}{r.details ? `: ${r.details}` : ''}</li>)}</ul></div>}
              {c.history.length > 0 && <div className="mt-2 text-xs text-mute"><b>{t('mod.history')}:</b><ul className="ms-4 list-disc">{c.history.map((h, i) => <li key={i}>{dateTime(h.createdAt)} — {h.body}</li>)}</ul></div>}
              {c.ownedByViewer ? <p className="mt-3 text-xs text-bad" data-testid="mod-own">{t('mod.own')}</p> : <ModerationActions campaignId={c.id} approved={['approved', 'auto_approved'].includes(c.moderationStatus)} />}
            </li>
          );
        })}</ul>
      )}
    </div>
  );
}
