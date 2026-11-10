'use client';

import { useState, useSyncExternalStore } from 'react';

const noop = () => () => {};
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';

type Mode = 'login' | 'signup' | 'recover';

export function AccountForms({ email: signedInEmail, next = null }: { email: string | null; next?: string | null }) {
  const t = useT(); const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function call(body: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    return { ok: r.ok, j };
  }

  if (signedInEmail) {
    return (
      <div className="card mt-6 p-5">
        <p className="font-semibold">{t('auth.signedInAs', { email: signedInEmail })}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {next && <Link href={next} className="btn btn-sun" data-testid="continue-draft">{t('elig.continueDraft')}</Link>}
          <Link href="/me" className="btn btn-primary">{t('auth.goMe')}</Link>
          <button className="btn btn-ghost" disabled={busy} onClick={async () => { await call({ action: 'logout' }); router.refresh(); }}>{t('auth.logout')}</button>
        </div>
      </div>
    );
  }

  const tabs: Array<[Mode, string]> = [['login', t('auth.tabLogin')], ['signup', t('auth.tabSignup')], ['recover', t('auth.tabForgot')]];
  return (
    <div className="card mt-6 p-4 sm:p-6">
      <div className="inline-flex flex-wrap rounded-xl border border-line bg-paper p-1" role="tablist">
        {tabs.map(([m, label]) => <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setMsg(null); }}
          className={`min-h-10 rounded-lg px-3 text-sm font-bold ${mode === m ? 'bg-white text-brand shadow-sm' : 'text-mute'}`}>{label}</button>)}
      </div>
      <form className="mt-5 space-y-4" onSubmit={async e => {
        e.preventDefault();
        if (mode === 'recover') { const { ok, j } = await call({ action: 'recover', email }); setMsg({ kind: ok ? 'ok' : 'err', text: ok ? j.message : j.error }); return; }
        const { ok, j } = await call({ action: mode, email, password });
        if (!ok) return setMsg({ kind: 'err', text: j.error || t('auth.errGeneric') });
        if (j.pendingConfirmation) return setMsg({ kind: 'ok', text: j.message });
        setMsg({ kind: 'ok', text: `${t('auth.done')}${j.claimed ? ' ' + t('auth.claimed', { n: j.claimed }) : ''}` });
        if (next) { router.push(next); router.refresh(); } else router.refresh();
      }}>
        <div><label className="label" htmlFor="email">{t('auth.email')}</label><input id="email" type="email" dir="ltr" className="input" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required maxLength={254} /></div>
        {mode !== 'recover' && (
          <div><label className="label" htmlFor="password">{t('auth.password')}</label>
            <input id="password" type="password" dir="ltr" className="input" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : 1} maxLength={72} aria-describedby="pw-hint" />
            {mode === 'signup' && <p id="pw-hint" className="mt-1 text-xs text-mute">{t('auth.passwordHint')}</p>}</div>
        )}
        <button className="btn btn-primary w-full sm:w-auto" disabled={busy}>{busy ? t('auth.working') : mode === 'login' ? t('auth.login') : mode === 'signup' ? t('auth.signup') : t('auth.sendReset')}</button>
        {msg && <p role={msg.kind === 'err' ? 'alert' : 'status'} className={`text-sm ${msg.kind === 'err' ? 'text-bad' : 'text-ok'}`}>{msg.text}</p>}
      </form>
      <p className="mt-5 rounded-xl bg-paper p-3 text-xs leading-relaxed text-mute">{t('auth.demoNote')}</p>
    </div>
  );
}

export function ResetForm() {
  const t = useT(); const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  // Supabase puts the short-lived recovery token in the URL fragment (never sent to servers in logs).
  const token = useSyncExternalStore(noop, () => new URLSearchParams(window.location.hash.slice(1)).get('access_token'), () => null);
  if (!token) return <p className="card mt-6 p-5 text-sm text-mute">{t('auth.resetNoToken')}</p>;
  return (
    <form className="card mt-6 space-y-4 p-5" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setMsg(null);
      const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset', accessToken: token, password }) });
      const j = await r.json().catch(() => ({})); setBusy(false);
      if (!r.ok) return setMsg({ kind: 'err', text: j.error || t('auth.errGeneric') });
      history.replaceState(null, '', '/account/reset'); setMsg({ kind: 'ok', text: t('auth.done') }); router.push('/me');
    }}>
      <div><label className="label" htmlFor="np">{t('auth.newPassword')}</label><input id="np" type="password" dir="ltr" className="input" value={password} onChange={e => setPassword(e.target.value)} minLength={8} maxLength={72} required autoComplete="new-password" /></div>
      <button className="btn btn-primary" disabled={busy}>{busy ? t('auth.working') : t('auth.resetBtn')}</button>
      {msg && <p role={msg.kind === 'err' ? 'alert' : 'status'} className={`text-sm ${msg.kind === 'err' ? 'text-bad' : 'text-ok'}`}>{msg.text}</p>}
    </form>
  );
}
