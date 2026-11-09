'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useFormat, useLocale, useT } from '@/i18n/client';
import type { DictKey } from '@/i18n';

type AgentEvent = { agent: string; step: string; detail?: Record<string, unknown>; at: string };
type Check = { field: string; label: string; required: string; actual: string; status: 'met' | 'unmet' | 'unknown'; level: 'minimum' | 'recommended' | 'premium'; origin: string; why: string; inferred?: boolean; conflict?: boolean };
type Evaluation = { status: 'suitable' | 'needs_verification' | 'unsuitable'; tier: 'minimum' | 'recommended' | 'premium' | null; kindOk: boolean | null; kindNote: string | null; checks: Check[]; failReasons: string[]; unknownReasons: string[]; brandExcluded: boolean; withinBudget: boolean | null; overkill: { extraCents: number; note: string } | null };
type Product = {
  externalId: string; title: string; brand: string | null; priceCents: number | null; compareAtCents: number | null; merchantDomain: string | null; offerUrl: string | null;
  imageUrl: string | null; imageAlt: string | null; keyFeatures: string[]; rating: number | null; ratingCount: number | null; fetchedAt: string;
  specs: { kind: string | null; condition: { value: string } | null }; evaluation: Evaluation; rank: number;
};
type Pick = { externalId: string; label: string; reason: string; tradeoff: string };
type Req = { field: string; level: 'minimum' | 'recommended' | 'premium'; origin: 'stated' | 'official' | 'derived' | 'ai'; why: string; source?: { title: string; url: string }; required: string };
type Result = {
  kind: 'results' | 'clarify' | 'blocked' | 'support'; message: string | null; links: Array<{ href: string; label: string }>; sessionId?: string | null;
  state: { turn: number; brandsExclude: string[]; budget: { maxCents: number | null; usable: boolean; raw: string | null } | null; priceCapCents: number | null } | null;
  profile: { id: string; label: string; sources: Array<{ title: string; url: string }>; variantNote: string | null } | null;
  requirements: Req[]; products: Product[]; bestFit: string[]; cheapestAdequate: string[]; needsVerification: string[]; unsuitable: string[];
  mode: 'best_fit' | 'cheapest_adequate'; picks: Pick[]; summary: string; followUp: string | null;
  budget: { budgetCents: number | null; usable: boolean; raw: string | null; ownFundsCents: number | null; priceCapCents: number | null; cheapestAdequate: { externalId: string; priceCents: number; gapCents: number | null } | null; noneWithinBudget: boolean; rejections: Array<{ label: string; count: number }>; note: string };
  compareIds: string[]; aiUsed: boolean; dataSource: { provider: string; fetchedAt: string; cached: boolean; queries: number }; safety: { flags: string[]; piiRedacted: boolean };
};

export function Assistant({ initialQuery }: { initialQuery: string }) {
  const t = useT(); const locale = useLocale(); const f = useFormat();
  const [prompt, setPrompt] = useState(initialQuery);
  const [refineText, setRefineText] = useState('');
  const [own, setOwn] = useState('');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [mode, setMode] = useState<'best_fit' | 'cheapest_adequate'>('best_fit');
  const [saved, setSaved] = useState<Record<string, 'saving' | 'saved'>>({});
  const ran = useRef(false);
  const activityRef = useRef<HTMLDivElement>(null);

  async function run(text: string, refine = false) {
    if (text.trim().length < 2 || loading) return;
    (document.activeElement as HTMLElement | null)?.blur?.(); // closes the on-screen keyboard on phones
    requestAnimationFrame(() => activityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    const conversationId = refine ? result?.sessionId ?? null : null;
    setLoading(true); setError(null); setEvents([]);
    if (!refine) { setResult(null); setHistory([text]); setCompare([]); } else setHistory(h => [...h, text]);
    try {
      const res = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text, ownFunds: own || null, conversationId, locale, mode: refine ? mode : null }) });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.error || t('assistant.searchFailed')); }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === 'event') setEvents(e => [...e, msg.event]);
          else if (msg.type === 'result') {
            const r = msg.result as Result;
            // A blocked/support reply keeps the previous results on screen and the conversation alive.
            if ((r.kind === 'blocked' || r.kind === 'support') && refine && result) setResult({ ...result, message: r.message, links: r.links, safety: r.safety, sessionId: r.sessionId ?? result.sessionId });
            else { setResult(r); if (r.kind === 'results') { setMode(r.mode); if (r.compareIds.length >= 2) setCompare(r.compareIds.slice(0, 3)); } }
          } else if (msg.type === 'error') setError(msg.error);
        }
      }
      if (refine) setRefineText('');
    } catch (e) { setError(e instanceof Error ? e.message : t('assistant.somethingWrong')); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (initialQuery && !ran.current) { ran.current = true; void run(initialQuery); } }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(id: string) {
    setSaved(s => ({ ...s, [id]: 'saving' }));
    const r = await fetch('/api/wishlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalId: id }) });
    setSaved(s => ({ ...s, [id]: r.ok ? 'saved' : undefined as unknown as 'saved' }));
  }

  const byId = useMemo(() => new Map(result?.products.map(p => [p.externalId, p]) || []), [result]);
  const picks = useMemo(() => new Map(result?.picks.map(p => [p.externalId, p]) || []), [result]);
  const order = result ? (mode === 'cheapest_adequate' ? result.cheapestAdequate : result.bestFit) : [];
  const suitable = order.map(id => byId.get(id)).filter((p): p is Product => !!p);
  const verify = (result?.needsVerification || []).map(id => byId.get(id)).filter((p): p is Product => !!p);
  const rejected = (result?.unsuitable || []).map(id => byId.get(id)).filter((p): p is Product => !!p);
  const ownCents = result?.budget.ownFundsCents ?? null;
  const cheapest = result?.budget.cheapestAdequate ?? null;
  const compared = compare.map(id => byId.get(id)).filter((p): p is Product => !!p);
  const examples: DictKey[] = ['assistant.ex1', 'assistant.ex2', 'assistant.ex3', 'assistant.ex4'];

  const cardProps = { t, f, picks, ownCents, cheapest, compare, setCompare, saved, save };

  return (
    <div className={`mt-6 grid gap-6 sm:mt-8 lg:grid-cols-[1fr_320px] ${compare.length && result ? 'pb-20 lg:pb-0' : ''}`}>
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <form className="card p-4 sm:p-5" onSubmit={e => { e.preventDefault(); void run(prompt); }}>
          <label htmlFor="prompt" className="label">{t('assistant.requestLabel')}</label>
          <textarea id="prompt" dir="auto" className="input min-h-24 resize-y" placeholder={t('assistant.placeholder')} value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={600} enterKeyHint="search"
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(prompt); } }} />
          <div className="mt-3 grid grid-cols-[minmax(0,10rem)_1fr] items-end gap-3 sm:flex sm:flex-wrap">
            <div className="sm:w-44">
              <label htmlFor="own" className="label">{t('assistant.haveLabel')}</label>
              <div className="relative" dir="ltr"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mute">$</span>
                <input id="own" className="input pl-7" inputMode="decimal" enterKeyHint="search" placeholder="200" value={own} onChange={e => setOwn(e.target.value.replace(/[^\d.]/g, ''))} /></div>
            </div>
            <button className="btn btn-primary min-h-11 px-5 sm:ms-auto" disabled={loading || prompt.trim().length < 2}>{loading ? t('assistant.working') : t('assistant.find')}</button>
          </div>
          <p className="mt-4 text-xs font-semibold text-mute">{t('assistant.examples')}</p>
          <div className="no-scrollbar -mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {examples.map(k => <button type="button" key={k} dir="auto" onClick={() => { setPrompt(t(k)); void run(t(k)); }} className="chip min-h-10 shrink-0 snap-start border border-line bg-paper px-3 text-start text-ink-2 hover:border-brand/40 hover:text-brand sm:shrink" disabled={loading}>{t(k)}</button>)}
          </div>
        </form>

        <div ref={activityRef} className="scroll-mt-20 lg:hidden">
          {events.length > 0 && (
            <details className="card group overflow-hidden" open={loading}>
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className={`size-2.5 shrink-0 rounded-full ${loading ? 'animate-pulse bg-brand' : 'bg-ok'}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold uppercase tracking-wide text-mute">{t('assistant.activity')} · {t('assistant.steps', { n: events.length })}</span>
                  <span className="block truncate text-sm font-semibold" dir="ltr">{events[events.length - 1].step}</span>
                </span>
                <Chevron />
              </summary>
              <div className="border-t border-line px-4 pb-4"><ActivityList events={events} loading={loading} working={t('assistant.workingStep')} /></div>
            </details>
          )}
        </div>

        {error && <div role="alert" className="card border-bad/30 bg-[#fff5f6] p-4 text-sm text-bad">{error}</div>}

        {loading && !result && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>{Array.from({ length: 6 }).map((_, i) => <div key={i} className={`card h-36 skeleton sm:h-72 ${i > 2 ? 'hidden sm:block' : ''}`} />)}</div>
        )}

        {result && (result.kind !== 'results' || result.message) && (
          <div role="status" className={`card fade-up p-4 text-sm leading-relaxed sm:p-5 ${result.kind === 'blocked' ? 'border-warn/40 bg-sun-soft' : ''}`}>
            <p dir="auto">{result.message}</p>
            {result.links.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{result.links.map(l => <Link key={l.href} className="btn btn-ghost min-h-11 px-4 text-sm" href={l.href}>{l.label}</Link>)}</div>}
          </div>
        )}

        {result?.kind === 'results' && (
          <section className="fade-up space-y-5" aria-live="polite">
            {history.length > 1 && (
              <ol className="flex flex-wrap gap-1.5 text-xs" aria-label="Conversation">
                {history.map((h, i) => <li key={i} dir="auto" className="chip max-w-full bg-paper text-ink-2"><span className="font-bold text-mute">{t('assistant.turn', { n: i + 1 })}</span> <span className="truncate">{h}</span></li>)}
              </ol>
            )}
            <div className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-brand-soft text-brand">{result.aiUsed ? t('assistant.aiAnalysis') : t('assistant.ruleAnalysis')}</span>
                <span className="chip bg-paper text-ink-2">{t('assistant.liveData', { provider: result.dataSource.provider })}{result.dataSource.cached ? ` ${t('assistant.cached')}` : ''}</span>
                {result.budget.usable && result.budget.budgetCents != null && <span className="chip bg-paper text-ink-2"><bdi>{t('assistant.budgetChip', { amount: f.usd(result.budget.budgetCents) })}</bdi></span>}
                {result.budget.priceCapCents != null && <span className="chip bg-paper text-ink-2"><bdi>{t('assistant.capChip', { amount: f.usd(result.budget.priceCapCents + 1) })}</bdi></span>}
                {ownCents != null && <span className="chip bg-sun-soft text-sun"><bdi>{t('assistant.haveChip', { amount: f.usd(ownCents) })}</bdi></span>}
                {result.state?.brandsExclude.map(b => <span key={b} className="chip bg-paper text-ink-2">{t('assistant.excludedChip', { brand: b.toUpperCase() })}</span>)}
              </div>
              {result.summary && <p className="mt-3 leading-relaxed text-ink-2" dir="auto">{result.summary}</p>}
              {result.budget.note && <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-sm font-medium" dir="auto">{result.budget.note}</p>}
              {result.followUp && <p className="mt-2 text-sm text-mute" dir="auto"><b>{t('assistant.followUp')}</b> {result.followUp}</p>}
              {result.safety.piiRedacted && <p className="mt-2 text-sm text-warn">{t('assistant.piiRemoved')}</p>}
              <form className="mt-4 border-t border-line pt-4" onSubmit={e => { e.preventDefault(); void run(refineText, true); }}>
                <label htmlFor="refine" className="label">{t('assistant.refineLabel')}</label>
                <div className="flex gap-2">
                  <input id="refine" dir="auto" className="input min-w-0 flex-1" value={refineText} onChange={e => setRefineText(e.target.value)} placeholder={t('assistant.refinePlaceholder')} maxLength={300} enterKeyHint="send" />
                  <button className="btn btn-primary min-h-11 shrink-0 px-4" disabled={loading || refineText.trim().length < 2}>{loading ? '…' : t('assistant.refine')}</button>
                </div>
              </form>
            </div>

            {result.requirements.length > 0 && <Requirements result={result} t={t} />}

            {suitable.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('assistant.modeLabel')}>
                <span className="text-xs font-semibold text-mute">{t('assistant.modeLabel')}</span>
                <div className="inline-flex rounded-xl border border-line bg-paper p-1">
                  {(['best_fit', 'cheapest_adequate'] as const).map(m => (
                    <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} title={t(m === 'best_fit' ? 'assistant.modeBestHint' : 'assistant.modeCheapestHint')}
                      className={`min-h-10 rounded-lg px-3 text-sm font-bold ${mode === m ? 'bg-white text-brand shadow-sm' : 'text-mute'}`}>{t(m === 'best_fit' ? 'assistant.modeBest' : 'assistant.modeCheapest')}</button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="h-section text-lg">{t('assistant.suitableTitle', { n: suitable.length })}</h2>
              {suitable.length === 0 ? <div className="card mt-3 p-6 text-center text-sm text-mute">{t('assistant.noSuitable')}</div> : (
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{suitable.map((p, i) => <ProductCard key={p.externalId} p={p} i={i} {...cardProps} />)}</div>
              )}
            </div>

            {verify.length > 0 && (
              <details className="card group p-4 sm:p-5" open={suitable.length === 0}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden"><span><b>{t('assistant.verifyTitle', { n: verify.length })}</b><span className="block text-xs text-mute">{t('assistant.verifyHint')}</span></span><Chevron /></summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{verify.map((p, i) => <ProductCard key={p.externalId} p={p} i={i} {...cardProps} />)}</div>
              </details>
            )}

            {rejected.length > 0 && (
              <details className="card group p-4 sm:p-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden"><span><b>{t('assistant.rejectedTitle', { n: rejected.length })}</b><span className="block text-xs text-mute">{t('assistant.rejectedHint')}</span></span><Chevron /></summary>
                {result.budget.rejections.length > 0 && (
                  <div className="mt-3 rounded-xl bg-paper p-3 text-sm"><p className="text-xs font-bold text-mute">{t('assistant.rejectedWhy')}</p>
                    <ul className="mt-1 space-y-0.5" dir="ltr">{result.budget.rejections.map(r => <li key={r.label}>{r.count}× {r.label}</li>)}</ul></div>
                )}
                <ul className="mt-3 divide-y divide-line">
                  {rejected.map(p => (
                    <li key={p.externalId} className="flex gap-3 py-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="size-14 shrink-0 rounded-lg border border-line bg-white object-contain p-1" loading="lazy" /> : <div className="size-14 shrink-0 rounded-lg bg-paper" />}
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="line-clamp-2 font-semibold" dir="auto">{p.title}</p>
                        <p className="text-xs text-mute"><bdi>{f.usd(p.priceCents)}</bdi>{p.merchantDomain ? ` · ${p.merchantDomain}` : ''}</p>
                        <ul className="mt-1 space-y-0.5 text-xs text-bad" dir="ltr">{p.evaluation.failReasons.slice(0, 3).map(r => <li key={r}>✗ {r}</li>)}</ul>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className="text-xs text-mute">{t('assistant.dataNote', { provider: result.dataSource.provider, time: f.date(result.dataSource.fetchedAt) })}</p>
          </section>
        )}

        {compared.length >= 2 && <CompareTable products={compared} ownCents={ownCents} picks={picks} t={t} f={f} />}
      </div>

      {result && compare.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(14_19_48/0.2)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <p className="min-w-0 flex-1 text-sm">{t('assistant.selected', { n: compare.length })} <span className="text-mute">{compare.length < 2 ? t('assistant.pickOneMore') : ''}</span></p>
            <button type="button" className="btn btn-ghost min-h-11 px-3 text-sm" onClick={() => setCompare([])}>{t('assistant.clear')}</button>
            <button type="button" className="btn btn-primary min-h-11 px-4 text-sm" disabled={compare.length < 2}
              onClick={() => document.getElementById('compare')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('assistant.compare')}</button>
          </div>
        </div>
      )}

      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <div className="card p-5">
          <h2 className="text-sm font-bold">{t('assistant.activity')}</h2>
          <p className="text-xs text-mute">{t('assistant.activityHint')}</p>
          {events.length === 0 ? <p className="mt-4 text-sm text-mute">{t('assistant.activityEmpty')}</p> : <ActivityList events={events} loading={loading} working={t('assistant.workingStep')} />}
        </div>
      </aside>
    </div>
  );
}

type T = ReturnType<typeof useT>;
type F = ReturnType<typeof useFormat>;

function Chevron() {
  return <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-mute transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9l6 6 6-6" /></svg>;
}

function Requirements({ result, t }: { result: Result; t: T }) {
  const groups = (['minimum', 'recommended', 'premium'] as const).map(level => [level, result.requirements.filter(r => r.level === level)] as const).filter(([, rs]) => rs.length);
  const levelKey = { minimum: 'assistant.reqMinimum', recommended: 'assistant.reqRecommended', premium: 'assistant.reqPremium' } as const;
  return (
    <details className="card group p-4 sm:p-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-bold">{result.profile ? t('assistant.needFor', { need: result.profile.label }) : t('assistant.yourReqs')}</span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            {result.requirements.filter(r => r.level === 'minimum').map((r, i) => (
              <span key={i} className="chip border border-line bg-paper px-2 py-0.5 text-xs font-medium text-ink-2">{t(`field.${r.field}` as DictKey)} <bdi className="font-mono">{r.required}</bdi></span>
            ))}
          </span>
        </span><Chevron />
      </summary>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {groups.map(([level, rs]) => (
          <div key={level}>
            <p className={`text-xs font-bold uppercase tracking-wide ${level === 'minimum' ? 'text-ink' : level === 'recommended' ? 'text-ok' : 'text-mute'}`}>{t(levelKey[level])}</p>
            <ul className="mt-1.5 space-y-2">
              {rs.map((r, i) => (
                <li key={i} className="text-sm">
                  <span className="font-semibold">{t(`field.${r.field}` as DictKey)}</span> <bdi className="font-mono text-xs">{r.required}</bdi>
                  <span className={`chip ms-1 px-1.5 py-0 text-xs ${r.origin === 'official' ? 'bg-ok-soft text-ok' : r.origin === 'stated' ? 'bg-brand-soft text-brand' : 'bg-paper text-mute'}`}>{t(`assistant.origin.${r.origin}` as DictKey)}</span>
                  <p className="text-xs leading-snug text-mute" dir="ltr">{r.why}{r.source && <> <a className="underline hover:text-brand" href={r.source.url} target="_blank" rel="noopener noreferrer">{t('assistant.source')} ↗</a></>}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {result.profile?.variantNote && <p className="mt-3 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand" dir="ltr"><b>{t('assistant.variantNote')}:</b> {result.profile.variantNote}</p>}
    </details>
  );
}

function ProductCard({ p, i, t, f, picks, ownCents, cheapest, compare, setCompare, saved, save }: {
  p: Product; i: number; t: T; f: F; picks: Map<string, Pick>; ownCents: number | null; cheapest: Result['budget']['cheapestAdequate'];
  compare: string[]; setCompare: (fn: (c: string[]) => string[]) => void; saved: Record<string, 'saving' | 'saved'>; save: (id: string) => void;
}) {
  const e = p.evaluation; const pick = picks.get(p.externalId);
  const gap = ownCents != null && p.priceCents != null ? Math.max(0, p.priceCents - ownCents) : null;
  const isCheapest = cheapest?.externalId === p.externalId;
  const statusChip = e.status === 'suitable'
    ? <span className={`chip px-2 py-0.5 text-xs ${e.tier === 'recommended' ? 'bg-ok-soft text-ok' : e.tier === 'premium' ? 'bg-paper text-ink-2' : 'bg-brand-soft text-brand'}`}>✓ {t(`assistant.tier.${e.tier || 'minimum'}` as DictKey)}</span>
    : e.status === 'needs_verification' ? <span className="chip bg-sun-soft px-2 py-0.5 text-xs text-warn">? {t('assistant.status.verify')}</span>
      : <span className="chip bg-[#fff0f2] px-2 py-0.5 text-xs text-bad">✗ {t('assistant.status.unsuitable')}</span>;
  const minChecks = e.checks.filter(c => c.level === 'minimum');
  const otherChecks = e.checks.filter(c => c.level !== 'minimum');
  const cond = p.specs.condition?.value;
  return (
    <article className={`card fade-up flex flex-col overflow-hidden ${pick ? 'ring-2 ring-brand/30' : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
      <div className="flex gap-3 p-3 sm:block sm:p-0">
        <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-xl bg-white sm:aspect-[4/3] sm:w-auto sm:rounded-none">
          {p.imageUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={p.imageUrl} alt={p.imageAlt || p.title} className="size-full object-contain p-2 sm:p-5" loading="lazy" decoding="async" />
            : <div className="grid size-full place-items-center text-sm text-mute">{t('assistant.noImage')}</div>}
          {pick && <span className="chip absolute start-3 top-3 hidden bg-brand text-white shadow sm:inline-flex">{pick.label}</span>}
        </div>
        <div className="min-w-0 flex-1 sm:border-t sm:border-line sm:p-4 sm:pb-0">
          <div className="mb-1 flex flex-wrap gap-1">
            {statusChip}
            {isCheapest && <span className="chip bg-ok px-2 py-0.5 text-xs text-white">{t('assistant.cheapestBadge')}</span>}
            {pick && <span className="chip bg-brand px-2 py-0.5 text-xs text-white sm:hidden">{pick.label}</span>}
            {e.withinBudget === false && <span className="chip bg-sun-soft px-2 py-0.5 text-xs text-sun">{t('assistant.overBudget')}</span>}
            {cond && cond !== 'new' && <span className="chip bg-paper px-2 py-0.5 text-xs text-ink-2">{t(cond === 'refurbished' ? 'assistant.condition.refurbished' : 'assistant.condition.used')}</span>}
          </div>
          <p className="truncate text-xs font-semibold text-mute" dir="auto">{p.brand || t('assistant.unknownBrand')}{p.merchantDomain ? ` · ${p.merchantDomain}` : ''}</p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug" dir="auto">{p.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
            <bdi className="text-xl font-extrabold">{f.usd(p.priceCents)}</bdi>
            {p.compareAtCents && p.priceCents && p.compareAtCents > p.priceCents && <bdi className="text-xs text-mute line-through">{f.usd(p.compareAtCents)}</bdi>}
          </div>
          {p.rating && <p className="text-xs text-mute">★ {p.rating.toFixed(1)}{p.ratingCount ? ` (${p.ratingCount})` : ''}</p>}
          {gap != null && e.status === 'suitable' && <p className={`mt-1 text-xs font-bold ${gap > 0 ? 'text-sun' : 'text-ok'}`}>{gap > 0 ? t('assistant.gap', { amount: f.usd(gap) }) : t('assistant.canAfford')}</p>}
          {e.overkill && <p className="mt-1 text-xs font-semibold text-warn">{t('assistant.overkill', { extra: f.usd(e.overkill.extraCents) })}</p>}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-3 pb-3 sm:px-4 sm:pb-4">
        {pick && <p className="text-sm leading-relaxed text-ink-2 sm:mt-2 sm:text-xs" dir="auto"><b>{t('assistant.why')}:</b> {pick.reason} {pick.tradeoff && <span className="text-mute">{t('assistant.tradeoff')}: {pick.tradeoff}</span>}</p>}
        {minChecks.length > 0 && (
          <details className="group/c mt-2 rounded-xl bg-paper px-3 py-2 text-xs">
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 font-semibold [&::-webkit-details-marker]:hidden">
              <span>{t('assistant.checks')}: <span className="text-ok">{minChecks.filter(c => c.status === 'met').length}✓</span>{minChecks.some(c => c.status === 'unknown') && <span className="text-warn"> {minChecks.filter(c => c.status === 'unknown').length}?</span>}{minChecks.some(c => c.status === 'unmet') && <span className="text-bad"> {minChecks.filter(c => c.status === 'unmet').length}✗</span>}</span>
              <svg viewBox="0 0 24 24" className="size-4 text-mute transition group-open/c:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
            </summary>
            <ul className="mt-1 space-y-1">
              {[...minChecks, ...otherChecks].map((c, k) => (
                <li key={k} className={`flex gap-1.5 ${c.level !== 'minimum' ? 'opacity-70' : ''}`}>
                  <span className={c.status === 'met' ? 'text-ok' : c.status === 'unmet' ? 'text-bad' : 'text-warn'} aria-label={t(`assistant.check.${c.status}` as DictKey)}>{c.status === 'met' ? '✓' : c.status === 'unmet' ? '✗' : '?'}</span>
                  <span className="min-w-0"><b>{t(`field.${c.field}` as DictKey)}</b>: <bdi>{c.actual}</bdi> <span className="text-mute">(<bdi>{c.required}</bdi>)</span>{c.inferred && <span className="text-mute"> · {t('assistant.inferred')}</span>}{c.conflict && <span className="text-warn"> · {t('assistant.conflict')}</span>}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        {e.status === 'needs_verification' && <ul className="mt-2 space-y-0.5 text-xs text-warn" dir="ltr">{e.unknownReasons.slice(0, 3).map(r => <li key={r}>? {r}</li>)}</ul>}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-3 sm:pt-4">
          {p.priceCents != null && e.status === 'suitable' && (gap == null || gap > 0) && <Link className="btn btn-sun min-h-11 px-3 text-sm" href={`/campaigns/new?product=${encodeURIComponent(p.externalId)}${ownCents != null ? `&own=${ownCents / 100}` : ''}`}>{t('assistant.fund')}</Link>}
          {p.priceCents != null && <Link className={`btn btn-ghost min-h-11 px-3 text-sm ${gap === 0 || e.status !== 'suitable' ? 'col-span-2' : ''}`} href={`/checkout/${encodeURIComponent(p.externalId)}`}>{t('assistant.buy')}</Link>}
          <label className={`btn btn-ghost min-h-11 px-3 text-sm ${compare.includes(p.externalId) ? 'border-brand/50 bg-brand-soft text-brand' : ''}`}>
            <input type="checkbox" className="size-4 accent-brand" checked={compare.includes(p.externalId)} onChange={ev => setCompare(c => ev.target.checked ? [...c, p.externalId].slice(-3) : c.filter(x => x !== p.externalId))} /> {t('assistant.compare')}</label>
          <button className="btn btn-ghost min-h-11 px-3 text-sm" onClick={() => save(p.externalId)} disabled={!!saved[p.externalId]} aria-label={saved[p.externalId] === 'saved' ? t('assistant.savedAria', { title: p.title }) : t('assistant.saveAria', { title: p.title })}>{saved[p.externalId] === 'saved' ? t('assistant.saved') : t('assistant.save')}</button>
        </div>
        {e.status === 'suitable' && cheapest && !isCheapest && p.priceCents != null && p.priceCents > cheapest.priceCents * 1.15 && (gap == null || gap > 0) && <p className="mt-1.5 text-xs text-mute">{t('assistant.fundCheaperNote', { price: f.usd(cheapest.priceCents) })}</p>}
        {p.offerUrl && <a className="tap mt-1 self-start text-xs text-mute hover:text-brand" href={p.offerUrl} target="_blank" rel="noopener noreferrer nofollow">{t('assistant.retailer')}<span className="sr-only"> {t('assistant.newTab')}</span></a>}
      </div>
    </article>
  );
}

function ActivityList({ events, loading, working }: { events: AgentEvent[]; loading: boolean; working: string }) {
  return (
    <ol className="mt-4 space-y-3" aria-live="polite" dir="ltr">
      {events.map((e, i) => (
        <li key={i} className="fade-up flex gap-3 text-sm">
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${e.agent.includes('Research') ? 'bg-sun' : e.agent.includes('Safety') ? 'bg-bad' : e.agent.includes('Budget') || e.agent.includes('Verification') || e.agent.includes('Requirements') ? 'bg-ok' : 'bg-brand'}`} aria-hidden />
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-mute">{e.agent}</p><p className="leading-snug [overflow-wrap:anywhere]">{e.step}</p></div>
        </li>
      ))}
      {loading && <li className="flex gap-3 text-sm text-mute"><span className="mt-1.5 size-2 animate-pulse rounded-full bg-brand" aria-hidden />{working}</li>}
    </ol>
  );
}

function CompareTable({ products, ownCents, picks, t, f }: { products: Product[]; ownCents: number | null; picks: Map<string, Pick>; t: T; f: F }) {
  const keyFields = [...new Set(products.flatMap(p => p.evaluation.checks.filter(c => c.level === 'minimum').map(c => c.field)))].slice(0, 6);
  const rows: Array<[string, (p: Product) => React.ReactNode]> = [
    [t('assistant.row.price'), p => <bdi className="font-bold">{f.usd(p.priceCents)}</bdi>],
    [t('assistant.row.suitability'), p => p.evaluation.status === 'suitable' ? `✓ ${t(`assistant.tier.${p.evaluation.tier || 'minimum'}` as DictKey)}` : p.evaluation.status === 'needs_verification' ? `? ${t('assistant.status.verify')}` : `✗ ${t('assistant.status.unsuitable')}`],
    ...keyFields.map(field => [t(`field.${field}` as DictKey), (p: Product) => { const c = p.evaluation.checks.find(x => x.field === field && x.level === 'minimum'); return c ? <span className={c.status === 'met' ? 'text-ok' : c.status === 'unmet' ? 'text-bad' : 'text-warn'}><bdi>{c.actual}</bdi></span> : '—'; }] as [string, (p: Product) => React.ReactNode]),
    [t('assistant.row.budget'), p => p.evaluation.withinBudget == null ? '—' : p.evaluation.withinBudget ? t('assistant.yes') : t('assistant.no')],
    [t('assistant.row.gap'), p => ownCents == null || p.priceCents == null ? '—' : <bdi>{f.usd(Math.max(0, p.priceCents - ownCents))}</bdi>],
    [t('assistant.row.retailer'), p => p.merchantDomain || '—'],
    [t('assistant.row.rating'), p => p.rating ? `★ ${p.rating.toFixed(1)}` : t('assistant.notListed')],
    [t('assistant.row.pick'), p => picks.get(p.externalId)?.label || '—'],
  ];
  const cols = products.length === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <section id="compare" className="card fade-up scroll-mt-20 p-4 sm:p-5" aria-label={t('assistant.compareAria')}>
      <h2 className="font-bold">{t('assistant.compareTitle')}</h2>
      <div className="mt-3 sm:hidden">
        <div className={`sticky top-14 z-10 grid ${cols} gap-2 border-b border-line bg-white py-2`}>
          {products.map((p, i) => <p key={p.externalId} className="line-clamp-3 text-xs font-bold leading-snug" dir="auto"><span className="me-1 inline-grid size-5 place-items-center rounded-full bg-brand-soft text-xs text-brand">{i + 1}</span>{p.title}</p>)}
        </div>
        <dl>
          {rows.map(([label, fn]) => (
            <div key={label} className="border-b border-line py-2.5 last:border-0">
              <dt className="text-xs font-semibold text-mute">{label}</dt>
              <dd className={`mt-1 grid ${cols} gap-2 text-xs text-ink-2 [overflow-wrap:anywhere]`}>{products.map(p => <div key={p.externalId}>{fn(p)}</div>)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-4 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] text-start text-sm">
          <thead><tr><th className="w-32" />{products.map(p => <th key={p.externalId} scope="col" className="p-2 text-start align-bottom text-xs font-bold" dir="auto">{p.title.slice(0, 70)}</th>)}</tr></thead>
          <tbody>{rows.map(([label, fn]) => (
            <tr key={label} className="border-t border-line align-top"><th scope="row" className="p-2 text-start text-xs font-semibold text-mute">{label}</th>{products.map(p => <td key={p.externalId} className="p-2 text-xs text-ink-2">{fn(p)}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
