import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { inDemo, DEMO, demoTotals } from '@/lib/demo';
import { DemoButton } from '@/components/DemoButton';
import { ProgressBar } from '@/components/ProgressBar';
import type { DictKey } from '@/i18n';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Demo creator dashboard — FundCart AI', robots: { index: false } };

// Read-only sample dashboard. Everything on this page comes from the fixed DEMO data; nothing is read
// from or written to the database, and every management control is disabled.
export default async function DemoPage({ searchParams }: { searchParams: Promise<{ limited?: string }> }) {
  const { t, usd, dateTime } = await getT();
  const active = await inDemo();
  const { limited } = await searchParams;
  if (!active) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">{t('demo.title')}</h1>
        <p className="mt-2 text-mute">{t('demo.cardBody')}</p>
        {limited && <p className="mt-3 text-sm text-bad" role="alert">{t('demo.limited')}</p>}
        <DemoButton className="mt-6 text-start" />
      </div>
    );
  }
  const c = DEMO.campaign; const tot = demoTotals();
  const statusLabel: Record<string, DictKey> = { COMPLETED: 'demo.st.completed', PENDING: 'demo.st.pending', REFUNDED: 'demo.st.refunded', DECLINED: 'demo.st.declined' };
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10" data-testid="demo-dashboard">
      <div className="rounded-xl border-2 border-dashed border-warn bg-sun-soft p-4 text-sm" role="note" data-testid="demo-banner">
        <p className="font-bold">{t('demo.bannerTitle')}</p>
        <p className="mt-1 text-ink-2">{t('demo.bannerBody')}</p>
        <form action="/api/demo" method="post" className="mt-3"><input type="hidden" name="action" value="exit" /><button className="btn btn-ghost min-h-11 px-4 text-sm" data-testid="exit-demo">{t('demo.exit')}</button></form>
      </div>

      <p className="eyebrow mt-6">{t('demo.eyebrow')}</p>
      <h1 className="h-page mt-2" dir="auto">{c.title}</h1>
      <p className="mt-1 text-sm text-mute">{c.creator} · {t(`need.${c.needCategory}` as DictKey)} · <span className="chip bg-white text-mute">{t('trust.unverified')}</span></p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <section className="card p-4 sm:p-6">
            <h2 className="font-bold">{t('demo.progress')}</h2>
            <p className="mt-3 text-2xl font-extrabold"><bdi>{usd(tot.raised)}</bdi> <span className="text-base font-semibold text-mute">/ <bdi>{usd(tot.target)}</bdi></span></p>
            <div className="mt-2"><ProgressBar percent={tot.percent} /></div>
            <p className="mt-2 text-sm text-mute">{t('demo.progressNote', { n: tot.supporters, remaining: usd(tot.remaining) })}</p>
          </section>

          <section className="card p-4 sm:p-6">
            <h2 className="font-bold">{t('demo.ledger')}</h2>
            <p className="mt-1 text-xs text-mute">{t('demo.ledgerNote')}</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm" data-testid="demo-ledger">
                <thead><tr className="text-start text-xs text-mute"><th className="py-2 text-start">{t('demo.col.date')}</th><th className="text-start">{t('demo.col.supporter')}</th><th className="text-start">{t('demo.col.order')}</th><th className="text-start">{t('demo.col.status')}</th><th className="text-end">{t('demo.col.amount')}</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {DEMO.orders.map(o => (
                    <tr key={o.orderId}>
                      <td className="py-2">{dateTime(o.at)}</td><td>{o.supporter}</td>
                      <td className="font-mono text-xs" dir="ltr">{o.orderId}</td>
                      <td><span className={`chip ${o.captureStatus === 'COMPLETED' ? 'bg-ok-soft text-ok' : 'bg-paper text-mute'}`}>{t(statusLabel[o.captureStatus])}</span></td>
                      <td className="text-end font-bold"><bdi>{usd(o.amountCents)}</bdi></td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-4 sm:p-6">
            <h2 className="font-bold">{t('demo.manage')}</h2>
            <p className="mt-1 text-xs text-mute">{t('demo.manageNote')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-ghost min-h-11 px-4 text-sm" disabled aria-disabled="true" title={t('demo.disabled')}>{t('demo.postUpdate')}</button>
              <button className="btn btn-ghost min-h-11 px-4 text-sm" disabled aria-disabled="true" title={t('demo.disabled')}>{t('demo.approvePurchase')}</button>
              <button className="btn btn-ghost min-h-11 px-4 text-sm" disabled aria-disabled="true" title={t('demo.disabled')}>{t('demo.cancel')}</button>
            </div>
            <ul className="mt-4 space-y-2 text-sm">{DEMO.updates.map(u => <li key={u.at} className="rounded-lg bg-paper p-3"><span className="text-xs text-mute">{dateTime(u.at)}</span><p className="mt-1" dir="auto">{u.body}</p></li>)}</ul>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-4 sm:p-5">
            <p className="text-xs font-semibold text-mute">{t('demo.item')}</p>
            <h3 className="mt-1 text-sm font-bold">{c.item}</h3>
            <dl className="mt-3 space-y-1.5 text-sm" data-testid="demo-goal">
              <div className="flex justify-between"><dt className="text-mute">{t('b.livePrice')}</dt><dd className="font-bold">{usd(c.priceCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">{t('b.youHave')}</dt><dd className="font-bold">−{usd(c.ownFundsCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">{t('gap.base')}</dt><dd className="font-bold">{usd(tot.baseGap)}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">{t('trust.gapBuffer', { pct: c.bufferPct })}</dt><dd className="font-bold">+{usd(tot.buffer)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">{t('b.goal')}</dt><dd className="text-lg font-extrabold text-sun">{usd(tot.target)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-mute">{t('gap.bufferWhy', { pct: c.bufferPct })}</p>
            <p className="mt-3 text-xs text-mute">{t('pay.routing')}</p>
          </div>
          <Link href="/assistant" className="btn btn-primary mt-4 w-full">{t('demo.tryReal')}</Link>
        </aside>
      </div>
    </div>
  );
}
