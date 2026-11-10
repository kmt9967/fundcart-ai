'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PayPalCheckout, type CaptureResult } from '@/components/PayPalCheckout';
import { toCents, MIN_CONTRIBUTION_CENTS } from '@/lib/money';
import { useFormat, useLocale, useT } from '@/i18n/client';
import type { DictKey } from '@/i18n';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;

export function Contribute({ slug, clientId, remainingCents, suggested, receiptsEnabled = false, disclosures = [] }: { slug: string; clientId: string; remainingCents: number; suggested: number[]; receiptsEnabled?: boolean; disclosures?: string[] }) {
  const router = useRouter(); const t = useT(); const f = useFormat(); const locale = useLocale();
  const [amount, setAmount] = useState(suggested[0] ? String(suggested[0] / 100) : '10');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [website, setWebsite] = useState('');
  const [done, setDone] = useState<CaptureResult | null>(null);

  const cents = useMemo(() => { try { return toCents(amount); } catch { return null; } }, [amount]);
  const invalid = cents == null ? t('contrib.errFormat') : cents < MIN_CONTRIBUTION_CENTS && cents !== remainingCents ? t('contrib.errMin') : cents > remainingCents ? t('contrib.errMax', { amount: f.usd(remainingCents) }) : null;
  const emailInvalid = email.trim() !== '' && !EMAIL_RE.test(email.trim());

  if (done) {
    return (
      <div className="card fade-up border-ok/30 p-4 sm:p-5" role="status">
        <p className="text-lg font-extrabold text-ok">{t('contrib.thanks')}</p>
        <p className="mt-1 text-sm text-ink-2">{done.state === 'completed' ? t('contrib.confirmed', { amount: f.usd(done.amountCents) }) : t('contrib.confirmedPending')}</p>
        {done.state === 'completed' && email.trim() && !emailInvalid && <p className="mt-1 text-sm text-mute">{t('contrib.emailQueued')}</p>}
        <dl className="mt-3 space-y-1 rounded-xl bg-paper p-3 text-xs">
          <div className="flex justify-between gap-2"><dt className="text-mute">{t('contrib.order')}</dt><dd className="break-all text-end font-mono" dir="ltr">{done.orderId}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-mute">{t('contrib.capture')}</dt><dd className="break-all text-end font-mono" dir="ltr">{done.captureId}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-mute">{t('contrib.status')}</dt><dd>{done.state === 'completed' ? 'COMPLETED' : done.status}</dd></div>
        </dl>
        <a className="btn btn-ghost mt-4 w-full" href={`/receipt/${done.orderId}`}>{t('contrib.receipt')}</a>
      </div>
    );
  }

  return (
    <div id="support" className="card scroll-mt-20 p-4 sm:p-5">
      <h2 className="font-bold">{t('contrib.title')}</h2>
      <p className="mt-1 text-sm text-mute">{t('contrib.lead')}</p>
      <p className="mt-1 text-xs text-mute" data-testid="payee-disclosure">{t('pay.routing')}</p>
      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label={t('contrib.suggested')}>
        {suggested.map(s => <button key={s} type="button" aria-pressed={cents === s} onClick={() => setAmount(String(s / 100))} className={`min-h-11 rounded-xl border px-2 text-sm font-bold transition ${cents === s ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:border-brand/40'}`}><bdi>{f.usd(s)}</bdi></button>)}
      </div>
      <div className="mt-3"><label className="label" htmlFor="amt">{t('contrib.amount')}</label>
        <div className="relative" dir="ltr"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mute">$</span><input id="amt" className="input pl-7 text-lg font-bold sm:text-lg" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} aria-invalid={!!invalid} aria-describedby={invalid ? 'amt-err' : undefined} /></div>
        {invalid && <p id="amt-err" role="alert" className="mt-1 text-sm text-bad">{invalid}</p>}</div>
      <div className="mt-3"><label className="label" htmlFor="sname">{t('contrib.name')}</label><input id="sname" dir="auto" className="input" value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder={t('contrib.namePh')} autoComplete="given-name" enterKeyHint="next" /></div>
      <div className="mt-3"><label className="label" htmlFor="msg">{t('contrib.msg')}</label><input id="msg" dir="auto" className="input" value={message} onChange={e => setMessage(e.target.value)} maxLength={200} placeholder={t('contrib.msgPh')} enterKeyHint="next" /></div>
      {/* Receipt email is only collected when a provider is configured to actually send it. */}
      {receiptsEnabled && <div className="mt-3"><label className="label" htmlFor="semail">{t('contrib.email')}</label>
        <input id="semail" type="email" dir="ltr" className="input" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} placeholder={t('contrib.emailPh')} autoComplete="email" enterKeyHint="done" aria-invalid={emailInvalid} aria-describedby="semail-hint" />
        <p id="semail-hint" className={`mt-1 text-xs ${emailInvalid ? 'text-bad' : 'text-mute'}`} role={emailInvalid ? 'alert' : undefined}>{emailInvalid ? t('contrib.emailErr') : t('contrib.emailHint')}</p></div>}
      <label className="check mt-2 text-sm"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /> {t('contrib.anon')}</label>
      <input type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0 [clip:rect(0,0,0,0)]" />
      {disclosures.length > 0 && <ul className="mt-3 list-disc space-y-0.5 rounded-xl bg-paper p-3 ps-6 text-xs text-ink-2" data-testid="disclosures">{disclosures.map(d => <li key={d}>{t(d as DictKey)}</li>)}</ul>}
      <div className="mt-4">
        {clientId ? (
          <PayPalCheckout clientId={clientId} disabled={!!invalid || emailInvalid}
            body={() => (cents && !invalid && !emailInvalid ? { kind: 'contribution', slug, amountCents: cents, supporterName: name, message, anonymous, supporterEmail: email.trim(), locale, website } : null)}
            onResult={r => { setDone(r); router.refresh(); }} />
        ) : <p className="text-sm text-bad">{t('contrib.noPaypal')}</p>}
      </div>
    </div>
  );
}
