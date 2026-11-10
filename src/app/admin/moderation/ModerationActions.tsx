'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';

export function ModerationActions({ campaignId }: { campaignId: string }) {
  const t = useT(); const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function decide(decision: 'approve' | 'reject' | 'hide') {
    setBusy(true);
    const r = await fetch('/api/admin/moderation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId, decision }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false); setMsg(r.ok ? t('admin.done') : j.error || 'Error');
    if (r.ok) router.refresh();
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button className="btn btn-primary min-h-11 px-4 text-sm" disabled={busy} onClick={() => decide('approve')}>{t('admin.approve')}</button>
      <button className="btn btn-ghost min-h-11 px-4 text-sm" disabled={busy} onClick={() => decide('hide')}>{t('admin.hide')}</button>
      <button className="btn btn-ghost min-h-11 px-4 text-sm text-bad" disabled={busy} onClick={() => decide('reject')}>{t('admin.reject')}</button>
      {msg && <span className="text-xs text-mute" role="status">{msg}</span>}
    </div>
  );
}
