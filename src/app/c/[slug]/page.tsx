import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getCampaignBySlug, publicContributions, campaignUpdates, isPubliclyActive } from '@/lib/campaigns';
import { canContribute, countryFromHeaders, policyFor } from '@/lib/policy';
import { ReportCampaign } from './ReportCampaign';
import { currentUserId } from '@/lib/identity';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusChip } from '@/components/StatusChip';
import { getT } from '@/i18n/server';
import type { DictKey } from '@/i18n';
import { Contribute } from './Contribute';
import { ShareBox } from './ShareBox';
import { StickySupport } from './StickySupport';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getCampaignBySlug(slug);
  return { title: d ? `${d.campaign.title} — FundCart AI` : 'Campaign — FundCart AI', robots: d?.campaign.visibility === 'unlisted' ? { index: false } : undefined };
}

async function siteOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ created?: string }> }) {
  const { slug } = await params; const { created } = await searchParams;
  const data = await getCampaignBySlug(slug);
  if (!data) notFound();
  const { campaign: c, product, totals } = data;
  const [supporters, updates, uid] = await Promise.all([publicContributions(c.id), campaignUpdates(c.id), currentUserId()]);
  const { t, usd, date, dateTime, ago } = await getT();
  const isOwner = uid === c.owner_id;
  // Rejected or hidden campaigns are visible only to their creator.
  if ((c.moderation_status === 'rejected' || c.moderation_status === 'hidden') && !isOwner) notFound();
  const publicActive = isPubliclyActive(c);
  const viewerCountry = countryFromHeaders(await headers());
  const contributionGate = canContribute(c.country ?? null, viewerCountry);
  const gf = c.gap_formula;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {created && isOwner && <ShareBox url={`${await siteOrigin()}/c/${c.slug}`} title={c.title} />}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-x-8">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="flex flex-wrap items-center gap-2"><StatusChip status={c.status} /><span className="chip bg-white text-mute" title={t('trust.unverifiedHelp')} data-testid="verification">{c.verification_status === 'verified' ? '✓' : t('trust.unverified')}</span>{c.is_demo_seed && <span className="chip bg-ink text-white">{t('card.demo')}</span>}{c.category && <span className="chip bg-white text-ink-2">{c.category}</span>}</div>
          <h1 className="h-page mt-3 [overflow-wrap:anywhere]" dir="auto">{c.title}</h1>
          <p className="mt-2 text-sm text-mute">{t('camp.createdBy', { name: c.creator_name })} · {date(c.created_at)}{c.deadline ? ` · ${t('camp.target', { date: date(c.deadline) })}` : ''}</p>

          <div className="card mt-4 overflow-hidden sm:mt-6">
            {c.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={c.image_url} alt={product?.title || c.title} className="aspect-[16/10] w-full bg-white object-contain p-4 sm:aspect-[16/9] sm:p-8" decoding="async" />
              : <div className="aspect-[16/10] bg-gradient-to-br from-brand-soft to-sun-soft sm:aspect-[16/9]" />}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="card p-4 sm:p-5">
            <p className="text-3xl font-extrabold" data-testid="raised"><bdi>{usd(totals.raisedCents)}</bdi></p>
            <p className="text-sm text-mute">{t('camp.raisedOf', { goal: usd(c.target_cents) })}</p>
            <div className="mt-4"><ProgressBar percent={totals.percent} size="lg" /></div>
            <div className="mt-3 grid grid-cols-3 gap-1 text-center text-sm">
              <div><p className="font-extrabold">{totals.percent}%</p><p className="text-xs text-mute">{t('camp.funded')}</p></div>
              <div><p className="font-extrabold">{totals.supporterCount}</p><p className="text-xs text-mute">{t('camp.supporters')}</p></div>
              <div><p className="font-extrabold"><bdi>{usd(totals.remainingCents)}</bdi></p><p className="text-xs text-mute">{t('camp.toGo')}</p></div>
            </div>
            {isOwner && <Link href={`/c/${c.slug}/manage`} className="btn btn-ghost mt-4 w-full">{t('camp.dashboard')}</Link>}
          </div>

          {!publicActive && <div className="card border-warn/40 bg-sun-soft p-4 text-sm" role="status" data-testid="moderation-banner">{c.moderation_status === 'pending_review' ? t('trust.pending') : t('trust.unavailable')}{isOwner && c.moderation_status === 'pending_review' && <p className="mt-2" data-testid="owner-review-note">{t('elig.ownerPending')}</p>}</div>}
          {c.status === 'active' && publicActive && !contributionGate.allowed && <div className="card p-4 text-sm" role="status" data-testid="policy-gate">{t(contributionGate.messageKey as DictKey)}</div>}
          {c.status === 'active' && publicActive && contributionGate.allowed ? (
            <Contribute disclosures={[...policyFor(c.country ?? viewerCountry).requiredDisclosures]} receiptsEnabled={!!process.env.RESEND_API_KEY && !!process.env.RECEIPT_FROM} slug={c.slug} clientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''} remainingCents={totals.remainingCents} suggested={c.suggested_amounts_cents.filter(a => a <= totals.remainingCents || c.allow_overfunding)} />
          ) : c.status === 'active' ? null : (
            <div className="card p-5 text-sm">
              {c.status === 'goal_reached' && <p><b className="text-ok">{t('camp.goalReachedT')}</b> {t('camp.goalReachedB')}</p>}
              {c.status === 'purchased' && <p><b>{t('camp.completedT')}</b> {t('camp.completedB')}</p>}
              {c.status === 'cancelled' && <p><b className="text-bad">{t('camp.cancelledT')}</b> {t('camp.cancelledB')}</p>}
            </div>
          )}

          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-bold">{t('camp.supportersTitle')}</h2>
            {supporters.length === 0 ? <p className="mt-2 text-sm text-mute">{t('camp.beFirst')}</p> : (
              <ul className="mt-3 space-y-3">{supporters.slice(0, 12).map((s, i) => (
                <li key={i} className="flex gap-3 text-sm"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">{s.name.slice(0, 1)}</span>
                  <div className="min-w-0 [overflow-wrap:anywhere]"><p><b dir="auto">{s.name}</b> <span className="text-mute">· <bdi>{usd(s.amountCents)}</bdi> · {ago(s.at)}</span></p>{s.message && <p className="text-ink-2" dir="auto">{s.message}</p>}</div></li>
              ))}</ul>
            )}
          </div>
        </aside>
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <section className="mt-2 lg:mt-2"><h2 className="text-lg font-bold">{t('camp.story')}</h2><p className="mt-3 whitespace-pre-line leading-relaxed text-ink-2" dir="auto">{c.story}</p></section>

          {product && (
            <section className="card mt-6 p-4 sm:mt-8 sm:p-5">
              <h2 className="text-sm font-bold">{t('camp.moneyFor')}</h2>
              <div className="mt-3 flex gap-3 sm:gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {product.image_url && <img src={product.image_url} alt="" className="size-16 shrink-0 rounded-xl border border-line bg-white object-contain p-2 sm:size-20" loading="lazy" />}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold leading-snug" dir="auto">{product.title}</p>
                  <p className="mt-1 text-mute">{product.brand}{product.merchant_domain ? ` · ${t('camp.soldBy', { merchant: product.merchant_domain })}` : ''}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
                    <div><dt className="text-xs text-mute">{t('camp.itemPrice')}</dt><dd className="font-bold"><bdi>{usd(c.item_price_cents)}</bdi></dd></div>
                    <div><dt className="text-xs text-mute">{t('camp.creatorHas')}</dt><dd className="font-bold"><bdi>{usd(c.own_funds_cents)}</bdi></dd></div>
                    <div><dt className="text-xs text-mute">{t('camp.raising')}</dt><dd className="font-bold text-sun"><bdi>{usd(c.target_cents)}</bdi></dd></div>
                  </dl>
                  <p className="mt-2 text-xs text-mute">{t('camp.snapshot', { time: dateTime(product.fetched_at) })}</p>
                  <details className="mt-3 rounded-xl bg-paper p-3 text-xs" data-testid="gap-formula">
                    <summary className="cursor-pointer font-semibold">{t('trust.gapTitle')}</summary>
                    {gf ? (
                      <dl className="mt-2 space-y-1">
                        <div className="flex justify-between gap-2"><dt>{t('trust.gapPrice')}</dt><dd><bdi>{usd(gf.basisPrice ?? gf.price)}</bdi></dd></div>
                        <div className="flex justify-between gap-2"><dt>{t('trust.gapShipping')}</dt><dd><bdi>{usd(gf.shipping)}</bdi></dd></div>
                        <div className="flex justify-between gap-2"><dt>{t('trust.gapTax')}</dt><dd><bdi>{usd(gf.tax)}</bdi></dd></div>
                        <div className="flex justify-between gap-2"><dt>{t('trust.gapBuffer', { pct: gf.bufferPct })}</dt><dd><bdi>+{usd(gf.buffer)}</bdi></dd></div>
                        <div className="flex justify-between gap-2"><dt>{t('trust.gapOwn')}</dt><dd><bdi>−{usd(gf.ownFunds)}</bdi></dd></div>
                        <div className="flex justify-between gap-2 border-t border-line pt-1 font-bold"><dt>{t('trust.gapTotal')}</dt><dd><bdi>{usd(c.target_cents)}</bdi></dd></div>
                        {!!gf.ownerPaysDifferenceCents && gf.ownerPaysDifferenceCents > 0 && <p className="pt-1 text-mute">{t('trust.ownerPays', { diff: usd(gf.ownerPaysDifferenceCents) })}</p>}
                      </dl>
                    ) : <p className="mt-2 text-mute">{t('trust.legacy')}</p>}
                    {c.country && <p className="mt-2 text-mute">{t('trust.country', { country: c.country })}</p>}
                    <p className="mt-2 text-mute">{t('trust.unverifiedHelp')}</p>
                  </details>
                </div>
              </div>
            </section>
          )}

          {!isOwner && <div className="mt-4"><ReportCampaign slug={c.slug} /></div>}
          <section className="mt-6 sm:mt-8">
            <h2 className="text-lg font-bold">{t('camp.updates')}</h2>
            {updates.length === 0 ? <p className="mt-2 text-sm text-mute">{t('camp.noUpdates')}</p> : (
              <ol className="mt-3 space-y-3">{updates.map(u => (
                <li key={u.id} className="card p-4 text-sm"><div className="flex items-center justify-between gap-2 text-xs text-mute"><span className="font-semibold uppercase tracking-wide">{(['update', 'thank_you', 'goal_reached', 'purchase', 'refund', 'price_change', 'moderation'].includes(u.kind) ? t(`upd.${u.kind}` as DictKey) : u.kind.replace('_', ' '))}{u.ai_generated ? ` · ${t('camp.aiAssisted')}` : ''}</span><span>{ago(u.created_at)}</span></div><p className="mt-1.5 leading-relaxed text-ink-2" dir="auto">{u.body}</p></li>
              ))}</ol>
            )}
          </section>
        </div>

      </div>
      {c.status === 'active' && publicActive && contributionGate.allowed && <StickySupport remaining={usd(totals.remainingCents)} />}
    </div>
  );
}
