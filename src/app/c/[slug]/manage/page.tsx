import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCampaignBySlug, paymentHistory } from '@/lib/campaigns';
import { currentUserId } from '@/lib/identity';
import { formatUSD } from '@/lib/money';
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
  if (uid !== data.campaign.owner_id) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold">Creator dashboard</h1>
        <p className="mt-2 text-mute">Only the person who created this campaign (in this browser) can open its dashboard.</p>
        <Link className="btn btn-primary mt-6" href={`/c/${slug}`}>View the public campaign</Link>
      </div>
    );
  }
  const { campaign: c, product, totals } = data;
  const history = await paymentHistory(c.id);
  const rows = history.orders.map(o => ({
    created: o.created_at as string, kind: o.kind as string, amount: Number(o.amount_cents), status: o.status as string,
    supporter: o.kind === 'purchase' ? 'You (purchase)' : o.is_anonymous ? 'Anonymous' : (o.supporter_name as string) || '—',
    orderId: o.paypal_order_id as string, captureId: (o.capture_id as string) || '', captureStatus: (o.capture_status as string) || '',
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href={`/c/${slug}`} className="text-sm font-semibold text-brand hover:underline">← Public page</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{c.title}</h1><StatusChip status={c.status} /></div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[['Verified raised', formatUSD(totals.raisedCents)], ['Goal', formatUSD(c.target_cents)], ['Supporters', String(totals.supporterCount)], ['Remaining', formatUSD(totals.remainingCents)]].map(([k, v]) => (
          <div key={k} className="card p-4"><p className="text-xs font-semibold text-mute">{k}</p><p className="mt-1 text-2xl font-extrabold">{v}</p></div>
        ))}
      </div>
      <div className="mt-4"><ProgressBar percent={totals.percent} size="lg" /></div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            <div className="flex items-center justify-between"><h2 className="font-bold">Payment ledger</h2><span className="text-xs text-mute">Every PayPal order for this campaign</span></div>
            <LedgerGrid rows={rows} />
            <p className="mt-2 text-xs text-mute">Only rows with capture status COMPLETED count toward progress. Data grid powered by AG Grid Community.</p>
          </section>
          <section className="card p-5">
            <h2 className="font-bold">Audit history</h2>
            <p className="text-xs text-mute">Append-only log of what PayPal reported and what FundCart did.</p>
            {history.events.length === 0 ? <p className="mt-3 text-sm text-mute">No payment activity yet.</p> : (
              <ol className="mt-4 space-y-2 text-sm">
                {history.events.map(e => (
                  <li key={e.id} className="grid grid-cols-[150px_1fr] gap-3 border-t border-line pt-2 first:border-0 first:pt-0">
                    <span className="font-mono text-xs text-mute">{new Date(e.created_at).toLocaleString()}</span>
                    <span><b>{e.event_type}</b> <span className="chip bg-paper text-ink-2">{e.source}</span> {e.status && <span className="chip bg-brand-soft text-brand">{e.status}</span>} {e.paypal_order_id && <span className="font-mono text-xs text-mute">{e.paypal_order_id}</span>}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <PurchasePanel slug={slug} status={c.status} clientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''} itemTitle={product?.title || c.title} itemPriceCents={c.item_price_cents} raisedCents={totals.raisedCents} ownFundsCents={c.own_funds_cents} targetCents={c.target_cents} />
          <OwnerActions slug={slug} status={c.status} />
        </aside>
      </div>
    </div>
  );
}
