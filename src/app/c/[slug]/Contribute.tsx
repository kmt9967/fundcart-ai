'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PayPalCheckout, type CaptureResult } from '@/components/PayPalCheckout';
import { formatUSD, toCents, MIN_CONTRIBUTION_CENTS } from '@/lib/money';

export function Contribute({ slug, clientId, remainingCents, suggested }: { slug: string; clientId: string; remainingCents: number; suggested: number[] }) {
  const router = useRouter();
  const [amount, setAmount] = useState(suggested[0] ? String(suggested[0] / 100) : '10');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [done, setDone] = useState<CaptureResult | null>(null);

  const cents = useMemo(() => { try { return toCents(amount); } catch { return null; } }, [amount]);
  const invalid = cents == null ? 'Enter an amount like 25 or 25.50' : cents < MIN_CONTRIBUTION_CENTS ? 'Minimum is $1.00' : cents > remainingCents ? `Only ${formatUSD(remainingCents)} is still needed` : null;

  if (done) {
    return (
      <div className="card fade-up border-ok/30 p-4 sm:p-5" role="status">
        <p className="text-lg font-extrabold text-ok">Thank you — contribution verified ✓</p>
        <p className="mt-1 text-sm text-ink-2">PayPal confirmed your sandbox payment{done.state === 'completed' ? ` of ${formatUSD(done.amountCents)}` : ''}. It now counts toward the goal.</p>
        <dl className="mt-3 space-y-1 rounded-xl bg-paper p-3 text-xs">
          <div className="flex justify-between gap-2"><dt className="text-mute">PayPal order</dt><dd className="break-all text-right font-mono">{done.orderId}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-mute">Capture</dt><dd className="break-all text-right font-mono">{done.captureId}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-mute">Status</dt><dd>{done.state === 'completed' ? 'COMPLETED' : done.status}</dd></div>
        </dl>
        <a className="btn btn-ghost mt-4 w-full" href={`/receipt/${done.orderId}`}>View receipt</a>
      </div>
    );
  }

  return (
    <div id="support" className="card scroll-mt-20 p-4 sm:p-5">
      <h2 className="font-bold">Support this campaign</h2>
      <p className="mt-1 text-sm text-mute">Sandbox payment through PayPal (test money). It only counts once PayPal confirms it.</p>
      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Suggested amounts">
        {suggested.map(s => <button key={s} type="button" aria-pressed={cents === s} onClick={() => setAmount(String(s / 100))} className={`min-h-11 rounded-xl border px-2 text-sm font-bold transition ${cents === s ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:border-brand/40'}`}>{formatUSD(s)}</button>)}
      </div>
      <div className="mt-3"><label className="label" htmlFor="amt">Amount (USD)</label>
        <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mute">$</span><input id="amt" className="input pl-7 text-lg font-bold sm:text-lg" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} aria-invalid={!!invalid} aria-describedby={invalid ? 'amt-err' : undefined} /></div>
        {invalid && <p id="amt-err" role="alert" className="mt-1 text-sm text-bad">{invalid}</p>}</div>
      <div className="mt-3"><label className="label" htmlFor="sname">Your name</label><input id="sname" className="input" value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="Shown publicly unless anonymous" autoComplete="given-name" enterKeyHint="next" /></div>
      <div className="mt-3"><label className="label" htmlFor="msg">Message (optional)</label><input id="msg" className="input" value={message} onChange={e => setMessage(e.target.value)} maxLength={200} placeholder="Good luck with your studies!" enterKeyHint="done" /></div>
      <label className="check mt-2 text-sm"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /> Contribute anonymously</label>
      <div className="mt-4">
        {clientId ? (
          <PayPalCheckout clientId={clientId} disabled={!!invalid}
            body={() => (cents && !invalid ? { kind: 'contribution', slug, amountCents: cents, supporterName: name, message, anonymous } : null)}
            onResult={r => { setDone(r); router.refresh(); }} />
        ) : <p className="text-sm text-bad">PayPal is not configured.</p>}
      </div>
    </div>
  );
}
