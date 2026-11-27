import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCampaignBySlug, paymentHistory } from '@/lib/campaigns';
import { currentUserId } from '@/lib/identity';
import { getT } from '@/i18n/server';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusChip } from '@/components/StatusChip';
import { LedgerGrid } from './LedgerGrid';
import { OwnerActions } from './OwnerActions';
import { PurchasePanel } from './PurchasePanel';

export const dynamic = 'force-dynamic';

export default async function Manage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCampaignBySlug(slug);
  if (!data) notFound();
  const uid = await currentUserId();
  const { t, usd: formatUSD, dateTime } = await getT();
  if (uid !== data.campaign.owner_id) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold">{t('mg.title')}</h1>
        <p className="mt-2 text-mute">{t('mg.ownerOnly')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2"><Link className="btn btn-primary" href="/account">{t('mg.signIn')}</Link><Link className="btn btn-ghost" href={`/c/${slug}`}>{t('mg.viewPublic')}</Link></div>
      </div>
    );
  }
  const { campaign: c, product, totals } = data;
  const history = await paymentHistory(c.id);
  const rows = history.orders.map(o => ({
    created: o.created_at as string, kind: o.kind as string, amount: Number(o.amount_cents), status: o.status as string,
    supporter: o.kind === 'purchase' ? t('mg.youPurchase') : o.is_anonymous ? t('mg.anonymous') : (o.supporter_name as string) || '—',
    orderId: o.paypal_order_id as string, captureId: (o.capture_id as string) || '', captureStatus: (o.capture_status as string) || '',
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href={`/c/${slug}`} className="tap -ml-1 rounded-lg px-1 text-sm font-semibold text-brand hover:underline">{t('mg.back')}</Link>
      <Link href={`/c/${slug}/status`} className="btn btn-ghost ms-2">{t('contrib.status')}</Link>
      <p className="eyebrow mt-2">{t('mg.title')}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3"><h1 className="h-page [overflow-wrap:anywhere]" dir="auto">{c.title}</h1><StatusChip status={c.status} /></div>

      <section data-testid="creator-ledger" className="card mt-5 p-4 sm:mt-6 sm:p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
        {[[t('mg.raised'), formatUSD(totals.raisedCents)], [t('mg.goal'), formatUSD(c.target_cents)], [t('mg.supporters'), String(totals.supporterCount)], [t('pu.own'), formatUSD(c.own_funds_cents)], [t('mg.remaining'), formatUSD(totals.remainingCents)]].map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-lg bg-brand-soft/40 p-3"><p className="wrap-anywhere text-xs font-semibold text-mute">{k}</p><p className="mt-1 wrap-anywhere text-lg font-extrabold sm:text-2xl"><bdi>{v}</bdi></p></div>
        ))}
      </div>
      <div className="mt-4"><ProgressBar percent={totals.percent} size="lg" /></div>
      </section>

      <div className="mt-6 grid gap-5 sm:mt-8 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card min-w-0 divide-y divide-line">
          <section data-testid="ledger-rows" className="p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h2 className="font-bold">{t('mg.ledger')}</h2><span className="text-xs text-mute">{t('mg.ledgerHint')}</span></div>
            <LedgerGrid rows={rows} />
            <p className="mt-2 text-xs text-mute">{t('mg.ledgerNote')}</p>
          </section>
          <section className="p-4 sm:p-5">
            <h2 className="font-bold">{t('mg.audit')}</h2>
            <p className="text-xs text-mute">{t('mg.auditHint')}</p>
            {history.events.length === 0 ? <p className="mt-3 text-sm text-mute">{t('mg.noActivity')}</p> : (
              <ol className="mt-4 space-y-3 border-s-2 border-brand-soft ps-3 text-sm">
                {history.events.map(e => (
                  <li key={e.id} className="relative grid gap-1 border-t border-line pt-2 first:border-0 first:pt-0 before:absolute before:start-[-17px] before:top-3 before:size-2 before:rounded-full before:bg-brand sm:grid-cols-[150px_1fr] sm:gap-3">
                    <span className="font-mono text-xs text-mute">{dateTime(e.created_at)}</span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5"><b className="[overflow-wrap:anywhere]">{e.event_type}</b> <span className="chip bg-paper text-ink-2">{e.source}</span> {e.status && <span className="chip bg-brand-soft text-brand [overflow-wrap:anywhere]">{e.status}</span>} {e.paypal_order_id && <span className="break-all font-mono text-xs text-mute">{e.paypal_order_id}</span>}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        {/* On phones the purchase panel comes first (it's the main action); on desktop both sit in a sticky sidebar. */}
        <aside className="contents lg:sticky lg:top-24 lg:block lg:space-y-4 lg:self-start">
          <div data-testid="purchase-panel" className="max-lg:order-first"><PurchasePanel slug={slug} status={c.status} clientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''} itemTitle={product?.title || c.title} itemPriceCents={c.item_price_cents} raisedCents={totals.raisedCents} ownFundsCents={c.own_funds_cents} targetCents={c.target_cents} /></div>
          <OwnerActions slug={slug} status={c.status} />
        </aside>
      </div>
    </div>
  );
}
