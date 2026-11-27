'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';

type Decision = 'approve' | 'reject' | 'hide' | 'pause' | 'clarify';

export function ModerationActions({ campaignId, approved }: { campaignId: string; approved?: boolean }) {
  const t = useT(); const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function decide(decision: Decision) {
    if ((decision === 'reject' || decision === 'clarify') && note.trim().length < 5) { setMsg(t('mod.noteRequired')); return; }
    setBusy(true);
    const r = await fetch('/api/admin/moderation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId, decision, note }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false); setMsg(r.ok ? t('admin.done') : j.error || 'Error');
    if (r.ok) { setNote(''); router.refresh(); }
  }
  return (
    <div className="mt-3 space-y-2">
      <label className="block text-xs text-mute">{t('mod.note')}
        <input className="input mt-1 w-full" maxLength={300} value={note} onChange={e => setNote(e.target.value)} data-testid="mod-note" dir="auto" />
      </label>
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-white px-4 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
        <button className="btn btn-primary min-h-11 px-4 text-sm" disabled={busy} onClick={() => decide('approve')} data-testid="mod-approve">{t('admin.approve')}</button>
        <button className="btn btn-ghost min-h-11 px-4 text-sm" disabled={busy} onClick={() => decide('clarify')} data-testid="mod-clarify">{t('mod.clarify')}</button>
        {approved && <button className="btn btn-ghost min-h-11 px-4 text-sm" disabled={busy} onClick={() => decide('pause')} data-testid="mod-pause">{t('mod.pause')}</button>}
        <button className="btn btn-ghost min-h-11 px-4 text-sm" disabled={busy} onClick={() => decide('hide')} data-testid="mod-hide">{t('admin.hide')}</button>
        <button className="btn btn-ghost min-h-11 px-4 text-sm text-bad" disabled={busy} onClick={() => decide('reject')} data-testid="mod-reject">{t('admin.reject')}</button>
        {msg && <span className="text-xs text-mute" role="status">{msg}</span>}
      </div>
    </div>
  );
}
