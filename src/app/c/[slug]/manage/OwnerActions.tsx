'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';

export function OwnerActions({ slug, status }: { slug: string; status: string }) {
  const router = useRouter(); const t = useT();
  const [draft, setDraft] = useState('');
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(body: Record<string, unknown>) {
    const r = await fetch(`/api/campaigns/${slug}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, j: await r.json().catch(() => ({})) };
  }

  return (
    <div className="card p-4 text-sm sm:p-5">
      <h2 className="font-bold">{t('ow.title')}</h2>
      <p className="mt-1 text-xs text-mute">{t('ow.hint')}</p>
      <textarea className="input mt-3 min-h-28" value={draft} onChange={e => { setDraft(e.target.value); }} maxLength={800} placeholder={t('ow.placeholder')} dir="auto" />
      <div className="mt-2 flex gap-2">
        <button className="btn btn-ghost flex-1" disabled={!!busy} onClick={async () => { setBusy('draft'); const { j } = await act({ action: 'draft_update' }); setDraft(j.draft || ''); setAi(!!j.aiGenerated); setBusy(null); }}>{busy === 'draft' ? t('ow.drafting') : t('ow.draft')}</button>
        <button className="btn btn-primary flex-1" disabled={!!busy || draft.trim().length < 5} onClick={async () => { setBusy('post'); const { ok } = await act({ action: 'post_update', body: draft, aiGenerated: ai }); setBusy(null); if (ok) { setDraft(''); setMsg(t('ow.posted')); router.refresh(); } }}>{t('ow.post')}</button>
      </div>
      {msg && <p className="mt-2 text-xs text-ok" role="status">{msg}</p>}
      {status !== 'purchased' && status !== 'cancelled' && (
        <div className="mt-6 border-t border-line pt-4">
          {!confirmCancel ? <button className="tap text-sm font-semibold text-bad hover:underline" onClick={() => setConfirmCancel(true)}>{t('ow.cancelLink')}</button> : (
            <div className="space-y-2"><p className="text-xs text-ink-2">{t('ow.cancelWarn')}</p>
              <div className="flex gap-2"><button className="btn btn-ghost flex-1" onClick={() => setConfirmCancel(false)}>{t('ow.keep')}</button><button className="btn flex-1 bg-bad text-white" onClick={async () => { await act({ action: 'cancel' }); router.refresh(); }}>{t('ow.yesCancel')}</button></div></div>
          )}
        </div>
      )}
    </div>
  );
}
