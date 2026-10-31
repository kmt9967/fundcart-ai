import Link from 'next/link';
import { currentUserId } from '@/lib/identity';
import { listPublicCampaigns } from '@/lib/campaign-list';
import { CampaignCard } from '@/components/CampaignCard';
import { db } from '@/lib/db';
import { formatUSD } from '@/lib/money';
import { Wishlist } from './Wishlist';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My FundCart' };

export default async function Me() {
  const uid = await currentUserId();
  const mine = uid ? await listPublicCampaigns(24, uid) : [];
  const payments = uid ? (await db().from('payment_orders').select('paypal_order_id, kind, amount_cents, capture_status, status, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(20)).data || [] : [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Demo profile</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">My FundCart</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">To keep the demo frictionless there is no sign-up: this browser holds a signed guest identity. Campaigns you create here can only be managed from this browser.</p>

      <section className="mt-10"><h2 className="text-lg font-bold">My campaigns</h2>
        {mine.length ? <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{mine.map(c => <CampaignCard key={c.slug} c={c} />)}</div>
          : <p className="mt-2 text-sm text-mute">None yet. <Link className="font-semibold text-brand" href="/assistant">Find something to fund →</Link></p>}</section>

      <section className="mt-10"><h2 className="text-lg font-bold">Wishlist</h2><Wishlist /></section>

      <section className="mt-10"><h2 className="text-lg font-bold">My payments</h2>
        {payments.length ? (
          <div className="card mt-4 divide-y divide-line">{payments.map(p => (
            <Link key={p.paypal_order_id} href={`/receipt/${p.paypal_order_id}`} className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-paper">
              <span><b className="capitalize">{p.kind}</b> <span className="font-mono text-xs text-mute">{p.paypal_order_id}</span></span>
              <span className="flex items-center gap-3"><span className={`chip ${p.capture_status === 'COMPLETED' ? 'bg-ok-soft text-ok' : 'bg-paper text-mute'}`}>{p.capture_status || p.status}</span><b>{formatUSD(Number(p.amount_cents))}</b></span>
            </Link>))}</div>
        ) : <p className="mt-2 text-sm text-mute">No payments yet.</p>}</section>
    </div>
  );
}
