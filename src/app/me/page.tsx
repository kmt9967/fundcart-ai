import Link from 'next/link';
import { currentUserId } from '@/lib/identity';
import { listPublicCampaigns } from '@/lib/campaign-list';
import { CampaignCard } from '@/components/CampaignCard';
import { db } from '@/lib/db';
import { getT } from '@/i18n/server';
import { currentAccount } from '@/lib/auth';
import type { DictKey } from '@/i18n';
import { Wishlist } from './Wishlist';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My FundCart — FundCart AI' };

export default async function Me() {
  const uid = await currentUserId();
  const { t, usd: formatUSD } = await getT();
  const account = await currentAccount();
  const mine = uid ? await listPublicCampaigns(24, uid) : [];
  const payments = uid ? (await db().from('payment_orders').select('paypal_order_id, kind, amount_cents, capture_status, status, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(20)).data || [] : [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="eyebrow">{t('me.eyebrow')}</p>
      <h1 className="h-page mt-2">{t('me.title')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">{account?.email ? t('me.accountLead', { email: account.email }) : t('me.guestLead')}</p>
      <Link href="/account" className="btn btn-ghost mt-3 min-h-11 px-4 text-sm">{account ? t('auth.logout') + ' / ' + t('auth.title') : t('auth.signInCta')}</Link>

      <section className="mt-8 sm:mt-10"><h2 className="text-lg font-bold">{t('me.campaigns')}</h2>
        {mine.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">{mine.map(c => <CampaignCard key={c.slug} c={c} />)}</div>
          : <p className="mt-2 text-sm text-mute">{t('me.none')} <Link className="tap font-semibold text-brand" href="/assistant">{t('me.findCta')}</Link></p>}</section>

      <section className="mt-8 sm:mt-10"><h2 className="text-lg font-bold">{t('me.wishlist')}</h2><Wishlist /></section>

      <section className="mt-8 sm:mt-10"><h2 className="text-lg font-bold">{t('me.payments')}</h2>
        {payments.length ? (
          <div className="card mt-4 divide-y divide-line">{payments.map(p => (
            <Link key={p.paypal_order_id} href={`/receipt/${p.paypal_order_id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 p-4 text-sm hover:bg-paper">
              <span className="min-w-0"><b>{t(`me.kind.${p.kind}` as DictKey)}</b> <span className="break-all font-mono text-xs text-mute" dir="ltr">{p.paypal_order_id}</span></span>
              <span className="flex items-center gap-3"><span className={`chip ${p.capture_status === 'COMPLETED' ? 'bg-ok-soft text-ok' : 'bg-paper text-mute'}`}>{p.capture_status || p.status}</span><b><bdi>{formatUSD(Number(p.amount_cents))}</bdi></b></span>
            </Link>))}</div>
        ) : <p className="mt-2 text-sm text-mute">{t('me.noPayments')}</p>}</section>
    </div>
  );
}
