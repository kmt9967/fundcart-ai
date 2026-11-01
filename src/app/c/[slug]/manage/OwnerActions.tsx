'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OwnerActions({ slug, status }: { slug: string; status: string }) {
  const router = useRouter();
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
      <h2 className="font-bold">Post an update</h2>
      <p className="mt-1 text-xs text-mute">The AI drafts from verified numbers only — edit before posting.</p>
      <textarea className="input mt-3 min-h-28" value={draft} onChange={e => { setDraft(e.target.value); }} maxLength={800} placeholder="Share progress with your supporters…" />
      <div className="mt-2 flex gap-2">
        <button className="btn btn-ghost flex-1" disabled={!!busy} onClick={async () => { setBusy('draft'); const { j } = await act({ action: 'draft_update' }); setDraft(j.draft || ''); setAi(!!j.aiGenerated); setBusy(null); }}>{busy === 'draft' ? 'Drafting…' : '✨ Draft with AI'}</button>
        <button className="btn btn-primary flex-1" disabled={!!busy || draft.trim().length < 5} onClick={async () => { setBusy('post'); const { ok } = await act({ action: 'post_update', body: draft, aiGenerated: ai }); setBusy(null); if (ok) { setDraft(''); setMsg('Update posted.'); router.refresh(); } }}>Post</button>
      </div>
      {msg && <p className="mt-2 text-xs text-ok" role="status">{msg}</p>}
      {status !== 'purchased' && status !== 'cancelled' && (
        <div className="mt-6 border-t border-line pt-4">
          {!confirmCancel ? <button className="tap text-sm font-semibold text-bad hover:underline" onClick={() => setConfirmCancel(true)}>Cancel this campaign…</button> : (
            <div className="space-y-2"><p className="text-xs text-ink-2">Cancelling stops new contributions. Existing sandbox contributions stay recorded and can be refunded in PayPal.</p>
              <div className="flex gap-2"><button className="btn btn-ghost flex-1" onClick={() => setConfirmCancel(false)}>Keep it</button><button className="btn flex-1 bg-bad text-white" onClick={async () => { await act({ action: 'cancel' }); router.refresh(); }}>Yes, cancel</button></div></div>
          )}
        </div>
      )}
    </div>
  );
}
