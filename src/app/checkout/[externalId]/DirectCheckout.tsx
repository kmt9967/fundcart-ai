'use client';

import { useState } from 'react';
import { PayPalCheckout, type CaptureResult } from '@/components/PayPalCheckout';
import { formatUSD } from '@/lib/money';

export function DirectCheckout({ externalId, priceCents, clientId }: { externalId: string; priceCents: number; clientId: string }) {
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState<CaptureResult | null>(null);
  if (done) {
    return (
      <div className="card fade-up border-ok/30 p-5 text-sm">
        <p className="text-lg font-extrabold text-ok">Sandbox payment verified ✓</p>
        <p className="mt-1 text-ink-2">PayPal confirmed the capture. No real product will ship — this is a demo checkout.</p>
        <a className="btn btn-ghost mt-4 w-full" href={`/receipt/${done.orderId}`}>View receipt</a>
      </div>
    );
  }
  return (
    <div className="card p-5 text-sm">
      <dl className="space-y-2">
        <div className="flex justify-between"><dt className="text-mute">Item total</dt><dd>{formatUSD(priceCents)}</dd></div>
        <div className="flex justify-between"><dt className="text-mute">Shipping</dt><dd>Not applicable (demo)</dd></div>
        <div className="flex justify-between border-t border-line pt-2 text-base"><dt className="font-bold">Total (sandbox)</dt><dd className="font-extrabold">{formatUSD(priceCents)}</dd></div>
      </dl>
      <label className="mt-4 flex gap-2"><input type="checkbox" className="mt-0.5 size-4 accent-brand" checked={agree} onChange={e => setAgree(e.target.checked)} />
        <span>I approve this PayPal Sandbox payment of <b>{formatUSD(priceCents)}</b>. I understand it is a test and no real product is purchased.</span></label>
      <div className="mt-4"><PayPalCheckout clientId={clientId} disabled={!agree} label="checkout" body={() => (agree ? { kind: 'direct', externalId, confirm: true } : null)} onResult={setDone} /></div>
    </div>
  );
}
