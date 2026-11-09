'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PayPalCheckout, type CaptureResult } from '@/components/PayPalCheckout';
import { useFormat, useT } from '@/i18n/client';
import { Rich } from '@/components/Rich';

export function PurchasePanel(p: { slug: string; status: string; clientId: string; itemTitle: string; itemPriceCents: number; raisedCents: number; ownFundsCents: number; targetCents: number }) {
  const router = useRouter(); const t = useT(); const { usd: formatUSD } = useFormat();
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState<CaptureResult | null>(null);

  if (p.status === 'active') {
    return (
      <div className="card p-4 text-sm sm:p-5">
        <h2 className="font-bold">{t('pu.title')}</h2>
        <p className="mt-2 text-mute">{t('pu.unlocks', { goal: formatUSD(p.targetCents), raised: formatUSD(p.raisedCents) })}</p>
      </div>
    );
  }
  if (p.status === 'purchased' || done) {
    return (
      <div className="card border-ok/30 p-4 text-sm sm:p-5" role="status">
        <h2 className="font-bold text-ok">{t('pu.done')}</h2>
        <p className="mt-2 text-ink-2">{t('pu.doneBody')}{done ? <span className="block font-mono text-xs" dir="ltr">{done.captureId}</span> : null}</p>
        {done && <a className="btn btn-ghost mt-3 w-full" href={`/receipt/${done.orderId}`}>{t('pu.receipt')}</a>}
      </div>
    );
  }
  if (p.status === 'cancelled') return <div className="card p-5 text-sm text-mute">{t('pu.cancelled')}</div>;

  return (
    <div className="card border-brand/30 p-4 text-sm sm:p-5">
      <span className="chip bg-ok-soft text-ok">{t('pu.goalReached')}</span>
      <h2 className="mt-2 text-lg font-bold">{t('pu.approveTitle')}</h2>
      <p className="mt-1 text-ink-2">{t('pu.approveLead')}</p>
      <dl className="mt-4 space-y-2 rounded-xl bg-paper p-3">
        <div className="flex justify-between gap-3"><dt className="text-mute">{t('pu.item')}</dt><dd className="min-w-0 text-end font-semibold [overflow-wrap:anywhere]" dir="auto">{p.itemTitle.slice(0, 60)}</dd></div>
        <div className="flex justify-between"><dt className="text-mute">{t('pu.total')}</dt><dd className="text-lg font-extrabold">{formatUSD(p.itemPriceCents)}</dd></div>
        <div className="flex justify-between gap-3 text-xs"><dt className="text-mute">{t('pu.raisedBy')}</dt><dd className="shrink-0">{formatUSD(p.raisedCents)}</dd></div>
        <div className="flex justify-between text-xs"><dt className="text-mute">{t('pu.own')}</dt><dd>{formatUSD(p.ownFundsCents)}</dd></div>
      </dl>
      <label className="check mt-3 text-sm"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
        <span><Rich text={t('pu.agree', { amount: formatUSD(p.itemPriceCents) })} /></span></label>
      <div className="mt-4">
        <PayPalCheckout clientId={p.clientId} disabled={!agree} label="checkout"
          body={() => (agree ? { kind: 'purchase', slug: p.slug, confirm: true } : null)}
          onResult={r => { setDone(r); router.refresh(); }} />
      </div>
    </div>
  );
}
