import Link from 'next/link';
import type { QueueItem } from '@/lib/moderators';
import { getT } from '@/i18n/server';
import { ModerationActions } from './ModerationActions';

const RISK_CLASS: Record<string, string> = { high: 'bg-bad/10 text-bad', medium: 'bg-amber-100 text-amber-900', low: 'bg-paper text-ink-2' };

export async function ReviewCard({ c, expanded = false }: { c: QueueItem; expanded?: boolean }) {
  const { t, usd, dateTime, locale } = await getT();
  const reviewLabel = { en: 'Review', ur: 'جائزہ لیں', es: 'Revisar', fr: 'Examiner' }[locale];
  const risk = c.eligibility?.risk;
  const status = c.moderationStatus === 'pending_review' ? { en: 'Pending review', ur: 'زیر جائزہ', es: 'En revisión', fr: 'En cours d’examen' }[locale] : c.moderationStatus.replaceAll('_', ' ');
  const flags = [...new Set([...c.reasons, ...(c.eligibility?.reasons || [])])];
  return (
    <article className="card p-4 text-sm sm:p-6" data-testid="queue-item" data-slug={c.slug}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link className="font-bold underline" href={`/admin/moderation/${c.slug}`} dir="auto">{c.title}</Link>
        <span className="flex gap-1">
          {risk && <span className={`chip ${RISK_CLASS[risk] || RISK_CLASS.low}`} data-testid="mod-risk">{t('mod.risk')}: {risk}</span>}
          <span className="chip bg-paper text-ink-2">{status}</span>
        </span>
      </div>
      <p className="mt-1 text-xs text-mute">{c.creatorName} · {dateTime(c.createdAt)} · {t('mod.account')}: {c.ownerHasAccount ? (c.ownerVerified ? t('mod.verified') : t('mod.unverified')) : t('mod.guest')}</p>
      {!expanded && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
        <span className="text-xs font-semibold text-brand"><bdi>{usd(c.targetCents)}</bdi> · {t('mg.goal')}</span>
        <Link className="btn btn-primary min-h-11" href={`/admin/moderation/${c.slug}`}>{reviewLabel}</Link>
      </div>}
      {expanded && <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,.8fr)]">
      <div className="min-w-0">
      <div className="rounded-2xl border border-line bg-brand-soft p-4">
        <p className="text-xs font-semibold text-brand">{t('mg.goal')}</p>
        <p className="mt-1 text-3xl font-extrabold"><bdi>{usd(c.targetCents)}</bdi></p>
        <p className="mt-1 text-sm" dir="auto">{c.productTitle || t('assistant.notListed')}</p>
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        <div><dt className="inline font-semibold">{t('mod.product')}: </dt><dd className="inline" dir="auto">{c.productTitle || '—'}{c.merchant ? ` (${c.merchant})` : ''}</dd></div>
        <div><dt className="inline font-semibold">{t('mod.ranking')}: </dt><dd className="inline">{c.rankingMode || '—'}</dd></div>
        <div><dt className="inline font-semibold">{t('mod.category')}: </dt><dd className="inline">{c.needCategory || '—'}</dd></div>
        <div><dt className="inline font-semibold">{t('mod.purpose')}: </dt><dd className="inline" dir="auto" data-testid="mod-purpose">{c.creatorPurpose || '—'}</dd></div>
        <div className="sm:col-span-2"><dt className="inline font-semibold">{t('mod.gap')}: </dt><dd className="inline"><bdi>{usd(c.itemPriceCents)} − {usd(c.ownFundsCents)} + {usd(c.bufferCents)} = {usd(c.targetCents)}</bdi></dd></div>
        <div><dt className="inline font-semibold">{t('mod.outcome')}: </dt><dd className="inline">{c.eligibility?.outcome || '—'}</dd></div>
        <div><dt className="inline font-semibold">{t('mod.raised')}: </dt><dd className="inline"><bdi>{usd(c.raisedCents)}</bdi></dd></div>
      </dl>
      <details open className="mt-3 rounded-lg border border-line p-3"><summary className="cursor-pointer font-semibold text-brand">{t('b.story')}</summary><p className="mt-2 whitespace-pre-line wrap-anywhere text-ink-2" dir="auto">{c.story}</p></details>
      {flags.length > 0 && <p className="mt-2 text-xs" data-testid="mod-reasons"><b>{t('admin.reasons')}:</b> {flags.join(', ')}</p>}
      {c.reports.length > 0 && <div className="mt-2 text-xs"><b>{t('admin.reports')} ({c.reports.length}):</b><ul className="ms-4 list-disc">{c.reports.slice(0, 5).map((r, i) => <li key={i}>{r.reason}{r.details ? `: ${r.details}` : ''}</li>)}</ul></div>}
      {c.history.length > 0 && <div className="mt-2 text-xs text-mute"><b>{t('mod.history')}:</b><ul className="ms-4 list-disc">{c.history.map((h, i) => <li key={i}>{dateTime(h.createdAt)} — {h.body}</li>)}</ul></div>}
      </div>
      <div className="h-fit min-w-0 rounded-2xl border border-line bg-brand-soft/30 p-4 lg:sticky lg:top-24">
      {c.ownedByViewer ? <p className="mt-3 text-xs text-bad" data-testid="mod-own">{t('mod.own')}</p> : <ModerationActions campaignId={c.id} approved={['approved', 'auto_approved'].includes(c.moderationStatus)} />}
      </div>
      </div>}
    </article>
  );
}
