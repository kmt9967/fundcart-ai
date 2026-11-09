'use client';

import { useState, useSyncExternalStore } from 'react';
import { useT } from '@/i18n/client';

const noop = () => () => {};

export function ShareBox({ url, title }: { url: string; title?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  // Native share sheet (phones). Server render assumes no support, so hydration stays consistent.
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === 'function', () => false);
  return (
    <div className="card fade-up mb-6 border-ok/30 bg-ok-soft p-4" role="status">
      <p className="text-sm font-semibold text-ok">{t('share.live')}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2.5 text-xs" dir="ltr">{url}</code>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button className="btn btn-ghost" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }}>{copied ? t('share.copied') : t('share.copy')}</button>
          {canShare && <button className="btn btn-primary" onClick={() => navigator.share({ title: title || 'FundCart AI', url }).catch(() => {})}>{t('share.share')}</button>}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{copied ? t('share.copiedSr') : ''}</p>
    </div>
  );
}
