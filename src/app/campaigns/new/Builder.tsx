'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatUSD, fundingGap, toCents } from '@/lib/money';
import type { Product } from '@/lib/channel3';

export function Builder({ product, initialOwn }: { product: Product; initialOwn: string }) {
  const router = useRouter();
  const [creatorName, setCreatorName] = useState('');
  const [own, setOwn] = useState(initialOwn);
  const [purpose, setPurpose] = useState('');
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [thankYou, setThankYou] = useState('');
  const [deadline, setDeadline] = useState('');
  const [aiUsed, setAiUsed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ownCents = useMemo(() => { try { return own ? toCents(own) : 0; } catch { return null; } }, [own]);
  const gap = product.priceCents != null && ownCents != null ? fundingGap(product.priceCents, ownCents) : null;

  async function draft() {
    setBusy('draft'); setError(null);
    const r = await fetch('/api/campaigns/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalId: product.externalId, ownFunds: own || '0', creatorName, purpose }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setError(j.error || 'Could not draft the campaign.');
    setTitle(j.draft.title); setStory(j.draft.story); setThankYou(j.draft.thankYou); setAiUsed(j.draft.usedModel);
  }

  async function publish() {
    setBusy('publish'); setError(null);
    const r = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalId: product.externalId, ownFunds: own || '0', creatorName, title, story, thankYou, deadline: deadline || null }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(null); return setError(j.error || 'Could not publish.'); }
    router.push(`/c/${j.slug}?created=1`);
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <h2 className="font-bold">1 · About you and the goal</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="name">Your first name</label><input id="name" className="input" value={creatorName} onChange={e => setCreatorName(e.target.value)} maxLength={40} placeholder="Maya" /></div>
            <div><label className="label" htmlFor="own">Money you already have</label>
              <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mute">$</span><input id="own" className="input pl-7" inputMode="decimal" value={own} onChange={e => setOwn(e.target.value.replace(/[^\d.]/g, ''))} placeholder="200" /></div>
              {ownCents == null && <p className="mt-1 text-xs text-bad">Use a format like 200 or 200.50</p>}
            </div>
          </div>
          <div className="mt-4"><label className="label" htmlFor="purpose">Why do you need it?</label>
            <textarea id="purpose" className="input min-h-24" value={purpose} onChange={e => setPurpose(e.target.value)} maxLength={400} placeholder="I'm starting my computer science degree and my old laptop can't run the course software." /></div>
          <button className="btn btn-primary mt-4" onClick={draft} disabled={!creatorName || ownCents == null || busy !== null || !gap}>{busy === 'draft' ? 'Drafting…' : '✨ Draft my campaign with AI'}</button>
          {gap === 0 && <p className="mt-2 text-sm text-ok">You can already afford this item — no campaign needed.</p>}
        </section>

        <section className={`card p-5 sm:p-6 transition ${title ? '' : 'opacity-60'}`}>
          <div className="flex items-center justify-between"><h2 className="font-bold">2 · Review and edit</h2>{aiUsed != null && <span className="chip bg-brand-soft text-brand">{aiUsed ? 'Drafted by AI — please review' : 'Template draft (AI unavailable)'}</span>}</div>
          <div className="mt-4 space-y-4">
            <div><label className="label" htmlFor="title">Campaign title</label><input id="title" className="input" value={title} onChange={e => setTitle(e.target.value)} maxLength={90} /></div>
            <div><label className="label" htmlFor="story">Your story</label><textarea id="story" className="input min-h-40" value={story} onChange={e => setStory(e.target.value)} maxLength={1500} /></div>
            <div><label className="label" htmlFor="ty">Thank-you message for supporters</label><input id="ty" className="input" value={thankYou} onChange={e => setThankYou(e.target.value)} maxLength={300} /></div>
            <div className="w-56"><label className="label" htmlFor="deadline">Target date (optional)</label><input id="deadline" type="date" className="input" value={deadline} onChange={e => setDeadline(e.target.value)} /></div>
          </div>
          <div className="mt-5 rounded-xl bg-paper p-4 text-xs leading-relaxed text-ink-2">
            By publishing you confirm the story is true. FundCart is a sandbox demo: it is not a charity, contributions are not tax-deductible, and funds are not held in escrow. Contributions are PayPal Sandbox payments; the purchase later is a separate payment you approve.
          </div>
          <button className="btn btn-sun mt-4 px-5" onClick={publish} disabled={!title || story.length < 20 || busy !== null}>{busy === 'publish' ? 'Publishing…' : 'Publish campaign'}</button>
          {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {product.imageUrl && <img src={product.imageUrl} alt={product.imageAlt || product.title} className="aspect-[4/3] w-full bg-white object-contain p-5" />}
          <div className="border-t border-line p-5">
            <p className="text-xs font-semibold text-mute">{product.brand}{product.merchantDomain ? ` · ${product.merchantDomain}` : ''}</p>
            <h3 className="mt-1 text-sm font-bold leading-snug">{product.title}</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-mute">Live price</dt><dd className="font-bold">{formatUSD(product.priceCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">You have</dt><dd className="font-bold">{ownCents == null ? '—' : formatUSD(ownCents)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">Funding goal</dt><dd className="text-lg font-extrabold text-sun">{gap == null ? '—' : formatUSD(gap)}</dd></div>
            </dl>
            <p className="mt-3 text-[11px] text-mute">Goal = live price − your funds, calculated in exact cents on the server. Price retrieved {new Date(product.fetchedAt).toLocaleString()}.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
