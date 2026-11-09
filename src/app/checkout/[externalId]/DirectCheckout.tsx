'use client';

import { useState } from 'react';
import { PayPalCheckout, type CaptureResult } from '@/components/PayPalCheckout';
import { useFormat, useT } from '@/i18n/client';
import { Rich } from '@/components/Rich';

export function DirectCheckout({ externalId, priceCents, clientId }: { externalId: string; priceCents: number; clientId: string }) {
  const t = useT(); const { usd: formatUSD } = useFormat();
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState<CaptureResult | null>(null);
  if (done) {
    return (
      <div className="card fade-up border-ok/30 p-4 text-sm sm:p-5" role="status">
        <p className="text-lg font-extrabold text-ok">{t('dc.verified')}</p>
        <p className="mt-1 text-ink-2">{t('dc.verifiedBody')}</p>
        <a className="btn btn-ghost mt-4 w-full" href={`/receipt/${done.orderId}`}>{t('contrib.receipt')}</a>
      </div>
    );
  }
  return (
    <div className="card p-4 text-sm sm:p-5">
      <dl className="space-y-2">
        <div className="flex justify-between"><dt className="text-mute">{t('dc.itemTotal')}</dt><dd>{formatUSD(priceCents)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-mute">{t('dc.shipping')}</dt><dd className="text-end">{t('dc.shippingNA')}</dd></div>
        <div className="flex justify-between border-t border-line pt-2 text-base"><dt className="font-bold">{t('dc.total')}</dt><dd className="font-extrabold">{formatUSD(priceCents)}</dd></div>
      </dl>
      <label className="check mt-3"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
        <span><Rich text={t('dc.agree', { amount: formatUSD(priceCents) })} /></span></label>
      <div className="mt-4"><PayPalCheckout clientId={clientId} disabled={!agree} label="checkout" body={() => (agree ? { kind: 'direct', externalId, confirm: true } : null)} onResult={setDone} /></div>
    </div>
  );
}
