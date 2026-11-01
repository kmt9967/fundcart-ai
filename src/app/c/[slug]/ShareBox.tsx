'use client';

import { useState, useSyncExternalStore } from 'react';

const noop = () => () => {};

export function ShareBox({ url, title }: { url: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  // Native share sheet (phones). Server render assumes no support, so hydration stays consistent.
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === 'function', () => false);
  return (
    <div className="card fade-up mb-6 border-ok/30 bg-ok-soft p-4" role="status">
      <p className="text-sm font-semibold text-ok">🎉 Your campaign is live. Share this link with supporters:</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2.5 text-xs">{url}</code>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button className="btn btn-ghost" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }}>{copied ? 'Copied ✓' : 'Copy link'}</button>
          {canShare && <button className="btn btn-primary" onClick={() => navigator.share({ title: title || 'FundCart AI campaign', url }).catch(() => {})}>Share…</button>}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{copied ? 'Link copied to clipboard' : ''}</p>
    </div>
  );
}
