'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFormat, useT } from '@/i18n/client';

type Item = { id: string; product_snapshots: { external_id: string; title: string; brand: string | null; price_cents: number | null; image_url: string | null; merchant_domain: string | null; fetched_at: string } };

export function Wishlist() {
  const t = useT(); const { usd: formatUSD } = useFormat();
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => { fetch('/api/wishlist').then(r => r.json()).then(j => setItems(j.items || [])).catch(() => setItems([])); }, []);
  if (items == null) return <div className="mt-4 h-24 rounded-2xl skeleton" />;
  if (!items.length) return <p className="mt-2 text-sm text-mute">{t('wl.empty')}</p>;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{items.map(i => {
      const p = i.product_snapshots;
      return (
        <div key={i.id} className="card flex gap-3 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.image_url && <img src={p.image_url} alt="" className="size-16 shrink-0 rounded-lg bg-white object-contain p-1" />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="line-clamp-2 font-semibold" dir="auto">{p.title}</p>
            <p className="text-xs text-mute"><bdi>{formatUSD(p.price_cents == null ? null : Number(p.price_cents))}</bdi> · {t('wl.savedPrice')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link className="btn btn-sun min-h-10 px-3 text-xs" href={`/campaigns/new?product=${p.external_id}`}>{t('assistant.fund')}</Link>
              <Link className="btn btn-ghost min-h-10 px-3 text-xs" href={`/checkout/${p.external_id}`}>{t('assistant.buy')}</Link>
              <button className="min-h-10 px-2 text-xs text-mute hover:text-bad" aria-label={t('wl.removeAria', { title: p.title })} onClick={async () => { await fetch('/api/wishlist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: i.id }) }); setItems(x => (x || []).filter(y => y.id !== i.id)); }}>{t('wl.remove')}</button>
            </div>
          </div>
        </div>
      );
    })}</div>
  );
}
