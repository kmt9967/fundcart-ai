'use client';

import { useState } from 'react';

export function ShareBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card fade-up mb-6 flex flex-wrap items-center gap-3 border-ok/30 bg-ok-soft p-4">
      <p className="text-sm font-semibold text-ok">🎉 Your campaign is live. Share this link with supporters:</p>
      <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs">{url}</code>
      <button className="btn btn-ghost" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }}>{copied ? 'Copied ✓' : 'Copy link'}</button>
    </div>
  );
}
