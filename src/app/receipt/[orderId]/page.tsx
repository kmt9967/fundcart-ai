import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { currentUserId } from '@/lib/identity';
import { formatUSD } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function Receipt({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^[A-Z0-9]{10,30}$/.test(orderId)) notFound();
  const o = await db().from('payment_orders').select('id, kind, campaign_id, user_id, paypal_order_id, amount_cents, currency, status, capture_id, capture_status, created_at, updated_at').eq('paypal_order_id', orderId).maybeSingle();
  if (!o.data) notFound();
  const uid = await currentUserId();
  const camp = o.data.campaign_id ? await db().from('campaigns').select('slug, title, owner_id').eq('id', o.data.campaign_id).maybeSingle() : { data: null };
  // Receipts are visible to the payer and to the campaign owner only.
  const allowed = uid && (uid === o.data.user_id || uid === camp.data?.owner_id);
  if (!allowed) {
    return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="text-2xl font-extrabold">Receipt</h1><p className="mt-2 text-mute">Receipts are only visible to the person who paid and the campaign creator.</p></div>;
  }
  const events = await db().from('payment_events').select('id, source, event_type, status, created_at').eq('paypal_order_id', orderId).order('id');
  const verified = o.data.capture_status === 'COMPLETED';
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="card p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="eyebrow">Receipt · PayPal Sandbox</p><span className={`chip ${verified ? 'bg-ok-soft text-ok' : 'bg-sun-soft text-warn'}`}>{verified ? 'Verified by PayPal' : o.data.status}</span></div>
        <h1 className="mt-3 text-3xl font-extrabold">{formatUSD(Number(o.data.amount_cents))}</h1>
        <p className="text-sm text-mute">{o.data.kind === 'contribution' ? 'Contribution' : 'Purchase'}{camp.data ? <> · <Link className="inline-block py-1 text-brand hover:underline" href={`/c/${camp.data.slug}`}>{camp.data.title}</Link></> : ''}</p>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-mute">PayPal order ID</dt><dd className="break-all font-mono">{o.data.paypal_order_id}</dd></div>
          <div><dt className="text-xs text-mute">Capture ID</dt><dd className="break-all font-mono">{o.data.capture_id || '—'}</dd></div>
          <div><dt className="text-xs text-mute">Capture status</dt><dd>{o.data.capture_status || '—'}</dd></div>
          <div><dt className="text-xs text-mute">Currency</dt><dd>{o.data.currency}</dd></div>
          <div><dt className="text-xs text-mute">Created</dt><dd>{new Date(o.data.created_at).toLocaleString()}</dd></div>
          <div><dt className="text-xs text-mute">Last update</dt><dd>{new Date(o.data.updated_at).toLocaleString()}</dd></div>
        </dl>
        <h2 className="mt-8 text-sm font-bold">What happened</h2>
        <ol className="mt-3 space-y-2 text-sm">{(events.data || []).map(e => (
          <li key={e.id} className="grid gap-0.5 sm:grid-cols-[auto_1fr] sm:gap-3"><span className="font-mono text-xs text-mute">{new Date(e.created_at).toLocaleTimeString()}</span><span className="min-w-0 [overflow-wrap:anywhere]"><b>{e.event_type}</b> · {e.source}{e.status ? ` · ${e.status}` : ''}</span></li>
        ))}</ol>
        <p className="mt-8 rounded-xl bg-paper p-3 text-xs text-mute">This is a PayPal Sandbox test transaction. No real money moved and no real product was purchased.</p>
      </div>
    </div>
  );
}
