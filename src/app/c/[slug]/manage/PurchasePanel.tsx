'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PayPalCheckout, type CaptureResult } from '@/components/PayPalCheckout';
import { formatUSD } from '@/lib/money';

export function PurchasePanel(p: { slug: string; status: string; clientId: string; itemTitle: string; itemPriceCents: number; raisedCents: number; ownFundsCents: number; targetCents: number }) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState<CaptureResult | null>(null);

  if (p.status === 'active') {
    return (
      <div className="card p-4 text-sm sm:p-5">
        <h2 className="font-bold">Purchase approval</h2>
        <p className="mt-2 text-mute">Unlocks automatically when verified contributions reach {formatUSD(p.targetCents)}. You&apos;re at {formatUSD(p.raisedCents)}.</p>
      </div>
    );
  }
  if (p.status === 'purchased' || done) {
    return (
      <div className="card border-ok/30 p-4 text-sm sm:p-5" role="status">
        <h2 className="font-bold text-ok">Purchase completed ✓</h2>
        <p className="mt-2 text-ink-2">PayPal confirmed your separate sandbox checkout{done ? ` (capture ${done.captureId})` : ''}. No real product was bought — this is a demo.</p>
        {done && <a className="btn btn-ghost mt-3 w-full" href={`/receipt/${done.orderId}`}>View receipt</a>}
      </div>
    );
  }
  if (p.status === 'cancelled') return <div className="card p-5 text-sm text-mute">This campaign was cancelled.</div>;

  return (
    <div className="card border-brand/30 p-4 text-sm sm:p-5">
      <span className="chip bg-ok-soft text-ok">Goal reached</span>
      <h2 className="mt-2 text-lg font-bold">Approve your purchase</h2>
      <p className="mt-1 text-ink-2">The agent has prepared this checkout. Nothing happens until you approve it here and in PayPal.</p>
      <dl className="mt-4 space-y-2 rounded-xl bg-paper p-3">
        <div className="flex justify-between gap-3"><dt className="text-mute">Item</dt><dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{p.itemTitle.slice(0, 60)}</dd></div>
        <div className="flex justify-between"><dt className="text-mute">Total (sandbox)</dt><dd className="text-lg font-extrabold">{formatUSD(p.itemPriceCents)}</dd></div>
        <div className="flex justify-between gap-3 text-xs"><dt className="text-mute">Raised by supporters (paid to your account)</dt><dd className="shrink-0">{formatUSD(p.raisedCents)}</dd></div>
        <div className="flex justify-between text-xs"><dt className="text-mute">Your own funds</dt><dd>{formatUSD(p.ownFundsCents)}</dd></div>
      </dl>
      <label className="check mt-3 text-sm"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
        <span>I approve a <b>separate</b> PayPal Sandbox payment of {formatUSD(p.itemPriceCents)} to the demo store for this item. I understand no real product will be purchased.</span></label>
      <div className="mt-4">
        <PayPalCheckout clientId={p.clientId} disabled={!agree} label="checkout"
          body={() => (agree ? { kind: 'purchase', slug: p.slug, confirm: true } : null)}
          onResult={r => { setDone(r); router.refresh(); }} />
      </div>
    </div>
  );
}
