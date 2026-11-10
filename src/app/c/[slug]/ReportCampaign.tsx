'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';
import type { DictKey } from '@/i18n';

const REASONS = ['scam', 'misleading', 'personal_info', 'offensive', 'duplicate', 'other'] as const;

export function ReportCampaign({ slug }: { slug: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<typeof REASONS[number]>('scam');
  const [details, setDetails] = useState('');
  const [website, setWebsite] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const r = await fetch(`/api/campaigns/${slug}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, details, website }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false); setMsg(j.message || j.error || null);
  }

  if (msg) return <p className="text-xs text-mute" role="status">{msg}</p>;
  if (!open) return <button type="button" className="tap text-xs text-mute underline hover:text-bad" onClick={() => setOpen(true)}>{t('trust.report')}</button>;
  return (
    <div className="rounded-xl border border-line bg-white p-3 text-sm">
      <label className="label" htmlFor="rep-reason">{t('trust.reportReason')}</label>
      <select id="rep-reason" className="input" value={reason} onChange={e => setReason(e.target.value as typeof REASONS[number])}>
        {REASONS.map(r => <option key={r} value={r}>{t(`trust.reason.${r}` as DictKey)}</option>)}
      </select>
      <label className="label mt-2" htmlFor="rep-details">{t('trust.reportDetails')}</label>
      <textarea id="rep-details" className="input min-h-16" maxLength={300} value={details} onChange={e => setDetails(e.target.value)} dir="auto" />
      <input type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-px w-px opacity-0" />
      <button type="button" className="btn btn-ghost mt-2 min-h-11 px-4 text-sm" onClick={send} disabled={busy}>{t('trust.reportSend')}</button>
    </div>
  );
}
