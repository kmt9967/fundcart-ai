'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { campaignGap, toCents } from '@/lib/money';
import Link from 'next/link';
import { useFormat, useT } from '@/i18n/client';
import type { Product } from '@/lib/channel3';
import type { DictKey } from '@/i18n';

type Props = { product: Product; initialOwn: string; sessionId?: string | null; fundraisingAvailable?: boolean; needCategories?: string[]; disclosures?: string[]; bufferPct?: number };

export function Builder({ product, initialOwn, sessionId = null, fundraisingAvailable = true, needCategories = [], disclosures = [], bufferPct = 5 }: Props) {
  const router = useRouter(); const t = useT(); const f = useFormat(); const formatUSD = f.usd;
  const [needCategory, setNeedCategory] = useState('');
  const [premium, setPremium] = useState<{ message: string; cheapest: { externalId: string; title: string; priceCents: number } } | null>(null);
  const [website, setWebsite] = useState('');
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
  // Same formula as the server (the server recomputes it; this is only a preview).
  const calc = product.priceCents != null && ownCents != null ? campaignGap({ priceCents: product.priceCents, bufferPct, ownFundsCents: ownCents }) : null;
  const gap = calc ? calc.totalCents : null;

  async function draft() {
    setBusy('draft'); setError(null);
    const r = await fetch('/api/campaigns/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalId: product.externalId, ownFunds: own || '0', creatorName, purpose }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setError(j.error || t('b.errDraft'));
    setTitle(j.draft.title); setStory(j.draft.story); setThankYou(j.draft.thankYou); setAiUsed(j.draft.usedModel);
    requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function publish(ownerPaysDifference = false) {
    setBusy('publish'); setError(null);
    const r = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalId: product.externalId, ownFunds: own || '0', creatorName, title, story, thankYou, deadline: deadline || null, needCategory: needCategory || null, sessionId, ownerPaysDifference, website }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 409 && j.code === 'premium_over_adequate' && j.cheapest) { setBusy(null); return setPremium({ message: j.error, cheapest: j.cheapest }); }
    if (!r.ok) { setBusy(null); return setError(j.error || t('b.errPublish')); }
    router.push(`/c/${j.slug}?created=1`);
  }

  if (!fundraisingAvailable) return <div className="card mt-6 p-5 text-sm" role="alert">{t('policy.noFundraising')}</div>;

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
          <div className="mt-4"><label className="label" htmlFor="need">{t('need.label')}</label>
            <select id="need" className="input" value={needCategory} onChange={e => setNeedCategory(e.target.value)} required>
              <option value="">—</option>
              {needCategories.map(n => <option key={n} value={n}>{t(`need.${n}` as DictKey)}</option>)}
            </select></div>
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
            {disclosures.length > 0 && <><p className="mt-2 font-semibold">{t('policy.title')}</p><ul className="mt-1 list-disc space-y-0.5 ps-4">{disclosures.map(d => <li key={d}>{t(d as DictKey)}</li>)}</ul></>}
          </div>
          {/* Honeypot: invisible to people and screen readers; bots tend to fill it. */}
          <input type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-px w-px opacity-0" />
          {premium && (
            <div className="mt-4 rounded-xl border border-warn/40 bg-sun-soft p-4 text-sm" role="alert">
              <p className="font-bold">{t('builder.premiumTitle')}</p>
              <p className="mt-1" dir="auto">{premium.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link className="btn btn-primary min-h-11 px-4 text-sm" href={`/campaigns/new?product=${encodeURIComponent(premium.cheapest.externalId)}${own ? `&own=${own}` : ''}${sessionId ? `&s=${sessionId}` : ''}`}>{premium.cheapest.title.slice(0, 40)}… · {formatUSD(premium.cheapest.priceCents)}</Link>
                <button className="btn btn-ghost min-h-11 px-4 text-sm" onClick={() => publish(true)} disabled={busy !== null}>{t('builder.payDifference')}</button>
              </div>
            </div>
          )}
          <button className="btn btn-sun mt-4 w-full px-5 sm:w-auto" onClick={() => publish(false)} disabled={!title || story.length < 20 || !needCategory || busy !== null}>{busy === 'publish' ? t('b.publishing') : t('b.publish')}</button>
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
              {calc && calc.formula.buffer > 0 && <div className="flex justify-between"><dt className="text-mute">{t('trust.gapBuffer', { pct: bufferPct })}</dt><dd className="font-bold">+{formatUSD(calc.formula.buffer)}</dd></div>}
              <div className="flex justify-between"><dt className="text-mute">{t('b.youHave')}</dt><dd className="font-bold">{ownCents == null ? '—' : `−${formatUSD(ownCents)}`}</dd></div>
              <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">{t('b.goal')}</dt><dd className="text-lg font-extrabold text-sun">{gap == null ? '—' : formatUSD(gap)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-mute lg:mt-3">{t('b.goalNote', { time: f.date(product.fetchedAt) })} <Link className="tap inline-flex items-center underline hover:text-brand" href="/account">{t('b.accountTip')}</Link></p>
          </div>
        </div>
      </aside>
    </div>
  );
}
