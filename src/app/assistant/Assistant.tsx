'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatUSD } from '@/lib/money';

type AgentEvent = { agent: string; step: string; detail?: Record<string, unknown>; at: string };
type Product = {
  externalId: string; title: string; brand: string | null; category: string | null; priceCents: number | null; compareAtCents: number | null;
  availability: string | null; merchantDomain: string | null; offerUrl: string | null; imageUrl: string | null; imageAlt: string | null;
  keyFeatures: string[]; rating: number | null; ratingCount: number | null; withinBudget: boolean | null; score: number; matched: string[];
};
type Rec = { externalId: string; label: string; reason: string; tradeoff: string };
type Result = {
  intent: { category: string; searchQuery: string; purpose: string; budgetMaxCents: number | null; ownFundsCents: number | null; mustHaves: string[]; followUpQuestion: string | null };
  aiUsed: boolean; products: Product[]; recommendations: Rec[]; summary: string;
  budget: { budgetCents: number | null; ownFundsCents: number | null; note: string; options: Array<{ externalId: string; priceCents: number; gapCents: number }> };
  dataSource: { provider: string; fetchedAt: string; cached: boolean };
};

const examples = [
  'I need a laptop for university under $700. I only have $200.',
  'A good laptop for editing videos, under $850',
  'Noise cancelling headphones for my commute under $200',
  'A beginner DSLR camera for my photography class under $600',
];

export function Assistant({ initialQuery }: { initialQuery: string }) {
  const [prompt, setPrompt] = useState(initialQuery);
  const [own, setOwn] = useState('');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [saved, setSaved] = useState<Record<string, 'saving' | 'saved'>>({});
  const ran = useRef(false);

  async function run(text = prompt) {
    if (text.trim().length < 3 || loading) return;
    setLoading(true); setError(null); setResult(null); setEvents([]); setCompare([]);
    try {
      const res = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text, ownFunds: own || null }) });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Search failed.'); }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === 'event') setEvents(e => [...e, msg.event]);
          else if (msg.type === 'result') setResult(msg.result);
          else if (msg.type === 'error') setError(msg.error);
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (initialQuery && !ran.current) { ran.current = true; void run(initialQuery); } }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(id: string) {
    setSaved(s => ({ ...s, [id]: 'saving' }));
    const r = await fetch('/api/wishlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalId: id }) });
    setSaved(s => ({ ...s, [id]: r.ok ? 'saved' : undefined as unknown as 'saved' }));
  }

  const recMap = new Map(result?.recommendations.map(r => [r.externalId, r]) || []);
  const ownCents = result?.budget.ownFundsCents ?? null;
  const compared = result?.products.filter(p => compare.includes(p.externalId)) || [];

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        <form className="card p-4 sm:p-5" onSubmit={e => { e.preventDefault(); void run(); }}>
          <label htmlFor="prompt" className="label">Your request</label>
          <textarea id="prompt" className="input min-h-24 resize-y text-base" placeholder="e.g. I need a laptop for university under $700" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={600} />
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="w-44">
              <label htmlFor="own" className="label">I already have (optional)</label>
              <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mute">$</span>
                <input id="own" className="input pl-7" inputMode="decimal" placeholder="200" value={own} onChange={e => setOwn(e.target.value.replace(/[^\d.]/g, ''))} /></div>
            </div>
            <button className="btn btn-primary ml-auto px-5" disabled={loading || prompt.trim().length < 3}>{loading ? 'Agents working…' : 'Find options'}</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map(x => <button type="button" key={x} onClick={() => { setPrompt(x); void run(x); }} className="chip border border-line bg-paper text-ink-2 hover:border-brand/40 hover:text-brand" disabled={loading}>{x}</button>)}
          </div>
        </form>

        {error && <div role="alert" className="card border-bad/30 bg-[#fff5f6] p-4 text-sm text-bad">{error}</div>}

        {loading && !result && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-72 skeleton" />)}</div>
        )}

        {result && (
          <section className="fade-up space-y-5" aria-live="polite">
            <div className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-brand-soft text-brand">{result.aiUsed ? 'AI analysis' : 'Rule-based analysis'}</span>
                <span className="chip bg-paper text-ink-2">Live data: {result.dataSource.provider}{result.dataSource.cached ? ' (cached)' : ''}</span>
                {result.intent.budgetMaxCents && <span className="chip bg-paper text-ink-2">Budget {formatUSD(result.intent.budgetMaxCents)}</span>}
                {ownCents != null && <span className="chip bg-sun-soft text-sun">You have {formatUSD(ownCents)}</span>}
              </div>
              <p className="mt-3 leading-relaxed text-ink-2">{result.summary}</p>
              {result.intent.followUpQuestion && <p className="mt-2 text-sm text-mute">To sharpen results: {result.intent.followUpQuestion}</p>}
              <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-sm font-medium">{result.budget.note}</p>
            </div>

            {result.products.length === 0 && <div className="card p-8 text-center text-mute">No matching products with live prices. Try describing it differently.</div>}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.products.map((p, i) => {
                const rec = recMap.get(p.externalId);
                const gap = ownCents != null && p.priceCents != null ? Math.max(0, p.priceCents - ownCents) : null;
                return (
                  <article key={p.externalId} className={`card fade-up flex flex-col overflow-hidden ${rec ? 'ring-2 ring-brand/30' : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="relative aspect-[4/3] bg-white">
                      {p.imageUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.imageUrl} alt={p.imageAlt || p.title} className="size-full object-contain p-5" loading="lazy" />
                        : <div className="grid size-full place-items-center text-sm text-mute">No image</div>}
                      {rec && <span className="chip absolute left-3 top-3 bg-brand text-white shadow">{rec.label}</span>}
                      {p.withinBudget === false && <span className="chip absolute right-3 top-3 bg-sun-soft text-sun">Over budget</span>}
                    </div>
                    <div className="flex flex-1 flex-col border-t border-line p-4">
                      <p className="text-xs font-semibold text-mute">{p.brand || 'Unknown brand'}{p.merchantDomain ? ` · ${p.merchantDomain}` : ''}</p>
                      <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug">{p.title}</h3>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-xl font-extrabold">{formatUSD(p.priceCents)}</span>
                        {p.compareAtCents && p.priceCents && p.compareAtCents > p.priceCents && <span className="text-xs text-mute line-through">{formatUSD(p.compareAtCents)}</span>}
                      </div>
                      {p.rating && <p className="text-xs text-mute">★ {p.rating.toFixed(1)}{p.ratingCount ? ` (${p.ratingCount} ratings)` : ''}</p>}
                      {rec && <p className="mt-2 text-xs leading-relaxed text-ink-2"><b>Why:</b> {rec.reason} <span className="text-mute">Trade-off: {rec.tradeoff}</span></p>}
                      {!rec && p.keyFeatures.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-mute">{p.keyFeatures.slice(0, 3).map(f => <li key={f} className="line-clamp-1">• {f}</li>)}</ul>}
                      {gap != null && <p className={`mt-2 text-xs font-semibold ${gap > 0 ? 'text-sun' : 'text-ok'}`}>{gap > 0 ? `Funding gap: ${formatUSD(gap)}` : 'You can afford this'}</p>}
                      <div className="mt-auto flex flex-wrap gap-2 pt-4">
                        {p.priceCents != null && (gap == null || gap > 0) && <Link className="btn btn-sun flex-1 px-3 py-2 text-xs" href={`/campaigns/new?product=${encodeURIComponent(p.externalId)}${ownCents != null ? `&own=${ownCents / 100}` : ''}`}>Fund this</Link>}
                        {p.priceCents != null && <Link className="btn btn-ghost flex-1 px-3 py-2 text-xs" href={`/checkout/${encodeURIComponent(p.externalId)}`}>Buy (sandbox)</Link>}
                        <label className="btn btn-ghost px-3 py-2 text-xs"><input type="checkbox" className="accent-brand" checked={compare.includes(p.externalId)} onChange={e => setCompare(c => e.target.checked ? [...c, p.externalId].slice(-3) : c.filter(x => x !== p.externalId))} /> Compare</label>
                        <button className="btn btn-ghost px-3 py-2 text-xs" onClick={() => save(p.externalId)} disabled={!!saved[p.externalId]} aria-label="Save to wishlist">{saved[p.externalId] === 'saved' ? '♥ Saved' : '♡ Save'}</button>
                      </div>
                      {p.offerUrl && <a className="mt-2 text-[11px] text-mute hover:text-brand" href={p.offerUrl} target="_blank" rel="noopener noreferrer nofollow">View at retailer ↗</a>}
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="text-xs text-mute">Prices and availability retrieved from {result.dataSource.provider} at {new Date(result.dataSource.fetchedAt).toLocaleString()}. Retailer prices can change.</p>
          </section>
        )}

        {compared.length >= 2 && <CompareTable products={compared} ownCents={ownCents} recs={recMap} />}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <h2 className="text-sm font-bold">Agent activity</h2>
          <p className="text-xs text-mute">What the agents did, step by step.</p>
          {events.length === 0 ? <p className="mt-4 text-sm text-mute">Start a search to see the agents plan and use tools.</p> : (
            <ol className="mt-4 space-y-3">
              {events.map((e, i) => (
                <li key={i} className="fade-up flex gap-3 text-sm">
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${e.agent.includes('Research') ? 'bg-sun' : e.agent.includes('Budget') ? 'bg-ok' : 'bg-brand'}`} />
                  <div><p className="text-[11px] font-bold uppercase tracking-wide text-mute">{e.agent}</p><p className="leading-snug">{e.step}</p></div>
                </li>
              ))}
              {loading && <li className="flex gap-3 text-sm text-mute"><span className="mt-1 size-2 animate-pulse rounded-full bg-brand" />Working…</li>}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

function CompareTable({ products, ownCents, recs }: { products: Product[]; ownCents: number | null; recs: Map<string, Rec> }) {
  const rows: Array<[string, (p: Product) => React.ReactNode]> = [
    ['Price', p => <b>{formatUSD(p.priceCents)}</b>],
    ['Within budget', p => p.withinBudget == null ? '—' : p.withinBudget ? 'Yes' : 'No'],
    ['Funding gap', p => ownCents == null || p.priceCents == null ? '—' : formatUSD(Math.max(0, p.priceCents - ownCents))],
    ['Brand', p => p.brand || '—'],
    ['Retailer', p => p.merchantDomain || '—'],
    ['Rating', p => p.rating ? `★ ${p.rating.toFixed(1)}` : 'Not listed'],
    ['AI pick', p => recs.get(p.externalId)?.label || '—'],
    ['Key features', p => <ul className="space-y-1">{p.keyFeatures.slice(0, 4).map(f => <li key={f}>• {f}</li>)}</ul>],
  ];
  return (
    <section className="card fade-up overflow-x-auto p-5" aria-label="Product comparison">
      <h2 className="font-bold">Side-by-side comparison</h2>
      <table className="mt-4 w-full min-w-[560px] text-left text-sm">
        <thead><tr><th className="w-32" />{products.map(p => <th key={p.externalId} className="p-2 align-bottom text-xs font-bold">{p.title.slice(0, 70)}</th>)}</tr></thead>
        <tbody>{rows.map(([label, fn]) => (
          <tr key={label} className="border-t border-line align-top"><th className="p-2 text-xs font-semibold text-mute">{label}</th>{products.map(p => <td key={p.externalId} className="p-2 text-xs text-ink-2">{fn(p)}</td>)}</tr>
        ))}</tbody>
      </table>
    </section>
  );
}
