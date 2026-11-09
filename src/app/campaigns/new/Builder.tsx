'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fundingGap, toCents } from '@/lib/money';
import Link from 'next/link';
import { useFormat, useT } from '@/i18n/client';
import type { Product } from '@/lib/channel3';

export function Builder({ product, initialOwn }: { product: Product; initialOwn: string }) {
  const router = useRouter(); const t = useT(); const f = useFormat(); const formatUSD = f.usd;
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
  const reviewRef = useRef<HTMLElement>(null);

  const ownCents = useMemo(() => { try { return own ? toCents(own) : 0; } catch { return null; } }, [own]);
  const gap = product.priceCents != null && ownCents != null ? fundingGap(product.priceCents, ownCents) : null;

  async function draft() {
    setBusy('draft'); setError(null);
    const r = await fetch('/api/campaigns/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalId: product.externalId, ownFunds: own || '0', creatorName, purpose }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setError(j.error || t('b.errDraft'));
    setTitle(j.draft.title); setStory(j.draft.story); setThankYou(j.draft.thankYou); setAiUsed(j.draft.usedModel);
    requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function publish() {
    setBusy('publish'); setError(null);
    const r = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalId: product.externalId, ownFunds: own || '0', creatorName, title, story, thankYou, deadline: deadline || null }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(null); return setError(j.error || t('b.errPublish')); }
    router.push(`/c/${j.slug}?created=1`);
  }

  return (
    <div className="mt-6 grid gap-5 sm:mt-8 sm:gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <section className="card p-4 sm:p-6">
          <h2 className="font-bold">{t('b.step1')}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="name">{t('b.name')}</label><input id="name" className="input" value={creatorName} onChange={e => setCreatorName(e.target.value)} maxLength={40} placeholder="Maya" dir="auto" autoComplete="given-name" enterKeyHint="next" /></div>
            <div><label className="label" htmlFor="own">{t('b.own')}</label>
              <div className="relative" dir="ltr"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mute">$</span><input id="own" className="input pl-7" inputMode="decimal" value={own} onChange={e => setOwn(e.target.value.replace(/[^\d.]/g, ''))} placeholder="200" aria-invalid={ownCents == null} aria-describedby={ownCents == null ? 'own-err' : undefined} enterKeyHint="next" /></div>
              {ownCents == null && <p id="own-err" role="alert" className="mt-1 text-sm text-bad">{t('b.ownErr')}</p>}
            </div>
          </div>
          <div className="mt-4"><label className="label" htmlFor="purpose">{t('b.why')}</label>
            <textarea id="purpose" className="input min-h-24" value={purpose} onChange={e => setPurpose(e.target.value)} maxLength={400} placeholder={t('b.whyPh')} dir="auto" /></div>
          <button className="btn btn-primary mt-4 w-full sm:w-auto" onClick={draft} disabled={!creatorName || ownCents == null || busy !== null || !gap}>{busy === 'draft' ? t('b.drafting') : t('b.draft')}</button>
          {gap === 0 && <p className="mt-2 text-sm text-ok">{t('b.noNeed')}</p>}
        </section>

        <section ref={reviewRef} className={`card scroll-mt-20 p-4 transition sm:p-6 ${title ? '' : 'opacity-60'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{t('b.step2')}</h2>{aiUsed != null && <span className="chip bg-brand-soft text-brand">{aiUsed ? t('b.aiDrafted') : t('b.template')}</span>}</div>
          <div className="mt-4 space-y-4">
            <div><label className="label" htmlFor="title">{t('b.ctitle')}</label><input id="title" dir="auto" className="input" value={title} onChange={e => setTitle(e.target.value)} maxLength={90} /></div>
            <div><label className="label" htmlFor="story">{t('b.story')}</label><textarea id="story" dir="auto" className="input min-h-40" value={story} onChange={e => setStory(e.target.value)} maxLength={1500} /></div>
            <div><label className="label" htmlFor="ty">{t('b.thanks')}</label><input id="ty" dir="auto" className="input" value={thankYou} onChange={e => setThankYou(e.target.value)} maxLength={300} /></div>
            <div className="sm:w-56"><label className="label" htmlFor="deadline">{t('b.deadline')}</label><input id="deadline" type="date" className="input" value={deadline} onChange={e => setDeadline(e.target.value)} /></div>
          </div>
          <div className="mt-5 rounded-xl bg-paper p-4 text-xs leading-relaxed text-ink-2">
            {t('b.legal')}
          </div>
          <button className="btn btn-sun mt-4 w-full px-5 sm:w-auto" onClick={publish} disabled={!title || story.length < 20 || busy !== null}>{busy === 'publish' ? t('b.publishing') : t('b.publish')}</button>
          {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
        </section>
      </div>

      {/* Phones: compact goal summary first, so the funding goal is visible before the form. */}
      <aside className="max-lg:order-first lg:sticky lg:top-24 lg:self-start">
        <div className="card flex gap-3 overflow-hidden p-3 lg:block lg:p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {product.imageUrl && <img src={product.imageUrl} alt={product.imageAlt || product.title} className="size-20 shrink-0 rounded-xl bg-white object-contain p-1.5 lg:aspect-[4/3] lg:size-auto lg:w-full lg:rounded-none lg:p-5" />}
          <div className="min-w-0 flex-1 lg:border-t lg:border-line lg:p-5">
            <p className="text-xs font-semibold text-mute">{product.brand}{product.merchantDomain ? ` · ${product.merchantDomain}` : ''}</p>
            <h3 className="mt-1 text-sm font-bold leading-snug" dir="auto">{product.title}</h3>
            <dl className="mt-2 space-y-1.5 text-sm lg:mt-4 lg:space-y-2">
              <div className="flex justify-between"><dt className="text-mute">{t('b.livePrice')}</dt><dd className="font-bold">{formatUSD(product.priceCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">{t('b.youHave')}</dt><dd className="font-bold">{ownCents == null ? '—' : formatUSD(ownCents)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">{t('b.goal')}</dt><dd className="text-lg font-extrabold text-sun">{gap == null ? '—' : formatUSD(gap)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-mute lg:mt-3">{t('b.goalNote', { time: f.date(product.fetchedAt) })} <Link className="underline hover:text-brand" href="/account">{t('b.accountTip')}</Link></p>
          </div>
        </div>
      </aside>
    </div>
  );
}
