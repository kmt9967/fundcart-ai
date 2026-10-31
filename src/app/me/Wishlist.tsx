'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatUSD } from '@/lib/money';

type Item = { id: string; product_snapshots: { external_id: string; title: string; brand: string | null; price_cents: number | null; image_url: string | null; merchant_domain: string | null; fetched_at: string } };

export function Wishlist() {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => { fetch('/api/wishlist').then(r => r.json()).then(j => setItems(j.items || [])).catch(() => setItems([])); }, []);
  if (items == null) return <div className="mt-4 h-24 rounded-2xl skeleton" />;
  if (!items.length) return <p className="mt-2 text-sm text-mute">Nothing saved yet. Tap “♡ Save” on any product.</p>;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{items.map(i => {
      const p = i.product_snapshots;
      return (
        <div key={i.id} className="card flex gap-3 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.image_url && <img src={p.image_url} alt="" className="size-16 shrink-0 rounded-lg bg-white object-contain p-1" />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="line-clamp-1 font-semibold">{p.title}</p>
            <p className="text-xs text-mute">{formatUSD(p.price_cents == null ? null : Number(p.price_cents))} · saved price</p>
            <div className="mt-2 flex gap-2">
              <Link className="btn btn-sun px-2.5 py-1 text-xs" href={`/campaigns/new?product=${p.external_id}`}>Fund this</Link>
              <Link className="btn btn-ghost px-2.5 py-1 text-xs" href={`/checkout/${p.external_id}`}>Buy (sandbox)</Link>
              <button className="text-xs text-mute hover:text-bad" onClick={async () => { await fetch('/api/wishlist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: i.id }) }); setItems(x => (x || []).filter(y => y.id !== i.id)); }}>Remove</button>
            </div>
          </div>
        </div>
      );
    })}</div>
  );
}
