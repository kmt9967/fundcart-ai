import Link from 'next/link';
import { headers } from 'next/headers';
import { findRecentProduct } from '@/lib/channel3';
import { currentUserId } from '@/lib/identity';
import { db } from '@/lib/db';
import { campaignGap } from '@/lib/money';
import { countryFromHeaders, policyFor, fundingOffer } from '@/lib/policy';
import { evaluateProduct } from '@/lib/shopping/evaluate';
import { buildRequirements, categoryInfo } from '@/lib/shopping/session';
import { INTENT_VERSION, type SessionState } from '@/lib/shopping/types';
import { listingInjection } from '@/lib/shopping/safety';
import { getT } from '@/i18n/server';
import type { DictKey } from '@/i18n';
import { SaveProduct } from './SaveProduct';

const validId = /^[A-Za-z0-9_-]{3,40}$/;
const sessionId = /^[a-f0-9-]{36}$/i;

export default async function ProductDetails({ params, searchParams }: {
  params: Promise<{ externalId: string }>;
  searchParams: Promise<{ s?: string; compare?: string }>;
}) {
  const [{ externalId }, { s, compare }, { t, usd, dateTime }] = await Promise.all([params, searchParams, getT()]);
  const product = validId.test(externalId) ? await findRecentProduct(externalId).catch(() => null) : null;
  if (!product || listingInjection([product.title, product.description, ...product.keyFeatures].join(' '))) {
    return <div className="mx-auto max-w-xl px-5 py-20 text-center">
      <h1 className="h-page">{t('co.unavailable')}</h1>
      <p className="mt-3 text-mute">{t('co.unavailableBody')}</p>
      <Link href="/assistant" className="btn btn-primary mt-6">{t('co.back')}</Link>
    </div>;
  }

  let state: SessionState | null = null;
  if (s && sessionId.test(s)) {
    const owner = await currentUserId().catch(() => null);
    if (owner) {
      const row = await db().from('ai_sessions').select('intent,prompt,safety').eq('id', s).eq('user_id', owner).maybeSingle();
      const saved = row.data?.intent as SessionState | undefined;
      if (row.data && !row.data.safety?.notices?.includes('sensitive_purchase') && row.data.prompt !== '[sensitive purchase: not stored]'
        && saved?.version === INTENT_VERSION && saved.lastProductIds.includes(externalId)) state = saved;
    }
  }

  const policy = policyFor(countryFromHeaders(await headers()));
  const cat = state ? categoryInfo(state.category) : null;
  const evaluation = state && evaluateProduct(product, {
    requirements: buildRequirements(state).requirements,
    allowedKinds: state.requiresFitVerification ? null : cat?.kinds ?? null,
    categoryNoun: cat?.noun ?? null,
    brandsExclude: state.brandsExclude, brandsInclude: state.brandsInclude, colors: state.colors,
    budgetCents: state.budget?.usable ? state.budget.maxCents : null, priceCapCents: state.priceCapCents,
    usedOk: state.usedOk, wantsPremium: false,
    fitVerificationReason: state.requiresFitVerification ? t('match.fit_unconfirmed') : undefined,
  }).evaluation;
  const own = state?.ownFundsCents ?? null;
  const price = product.priceCents;
  const estimate = price != null && own != null ? campaignGap({ priceCents: price, bufferPct: 5, ownFundsCents: own }) : null;
  const covered = price != null && price > 0 && own != null ? Math.min(100, Math.round(100 * own / price)) : null;
  const canFund = fundingOffer(policy).available && evaluation?.status === 'suitable' && price != null && (estimate == null || estimate.totalCents > 0);
  const resumeLink = state && s ? `/assistant?s=${encodeURIComponent(s)}` : '/assistant';
  const comparison = state && typeof compare === 'string' && compare.length <= 164
    ? [...new Set(compare.split(',').filter(id => validId.test(id)))].slice(0, 4) : [];
  const comparisonLink = comparison.length >= 2 ? `${resumeLink}&compare=${encodeURIComponent(comparison.join(','))}#compare` : resumeLink;

  return <div className="mx-auto max-w-6xl px-4 pb-32 pt-4 sm:px-8 sm:py-10">
    <Link href={resumeLink} className="tap text-sm font-semibold text-brand hover:underline">{t('co.back')}</Link>
    <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)] lg:gap-10">
      <div className="card grid aspect-[4/3] place-items-center overflow-hidden bg-white sm:aspect-square">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {product.imageUrl ? <img src={product.imageUrl} alt={product.imageAlt || product.title} className="h-full w-full object-contain p-5" /> : <p className="text-sm text-mute">{t('assistant.noImage')}</p>}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-mute" dir="auto">{[product.brand, product.merchantDomain].filter(Boolean).join(' · ') || t('assistant.notListed')}</p>
        <h1 dir="auto" className="mt-1 wrap-anywhere text-xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">{product.title}</h1>
        <p className="mt-3 text-3xl font-extrabold text-brand"><bdi>{usd(price)}</bdi></p>
        <p className="mt-2 text-xs text-mute">{t('co.priceRetrieved', { time: dateTime(product.fetchedAt) })}</p>
        {!!product.keyFeatures.length && <ul className="mt-3 flex flex-wrap gap-2">{product.keyFeatures.slice(0, 3).map((feature, index) => <li dir="auto" key={index} className="rounded-lg bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">{feature}</li>)}</ul>}
        <section className="mt-5 rounded-2xl border border-line bg-brand-soft/50 p-4 sm:p-5">
          <h2 className="font-bold">{t('assistant.row.gap')}</h2>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-mute">{t('assistant.row.price')}</dt><dd className="mt-1 font-bold"><bdi>{usd(price)}</bdi></dd></div>
            <div><dt className="text-mute">{t('b.youHave')}</dt><dd className="mt-1 font-bold"><bdi>{own == null ? '—' : usd(own)}</bdi></dd></div>
            <div><dt className="text-mute">{t('b.goal')}</dt><dd className="mt-1 font-bold text-brand"><bdi>{estimate ? usd(estimate.totalCents) : '—'}</bdi></dd></div>
          </dl>
          {covered != null && <progress className="mt-3 block h-2 w-full accent-brand" value={covered} max={100} aria-label={t('b.youHave')} />}
          <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
            <div className="flex justify-between gap-3"><dt>{t('trust.gapShipping')}</dt><dd>{t('trust.gapUnquoted')}</dd></div>
            <div className="flex justify-between gap-3"><dt>{t('trust.gapTax')}</dt><dd>{t('trust.gapUnquoted')}</dd></div>
            {estimate && <>
              <div className="flex justify-between gap-3"><dt>{t('trust.gapBuffer', { pct: 5 })}</dt><dd dir="ltr">{usd(estimate.formula.buffer)}</dd></div>
            </>}
          </dl>
        </section>
        <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2 border-t border-line bg-white px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:static sm:mt-5 sm:flex sm:flex-wrap sm:border-0 sm:bg-transparent sm:p-0">
          {price != null && <Link className="btn btn-primary" href={`/checkout/${externalId}`}>{t('assistant.buy')}</Link>}
          {canFund && <Link className="btn btn-sun" href={`/campaigns/new?product=${externalId}&s=${s}${own != null ? `&own=${own / 100}` : ''}`}>{t('assistant.fund')}</Link>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <SaveProduct externalId={externalId} />
          <Link href={comparisonLink} className="btn btn-ghost">{t('assistant.compareTitle')}</Link>
        </div>
      </div>
    </div>
    <section className="card mt-6 p-5">
      <h2 className="font-bold">{t('assistant.row.suitability')}</h2>
      <p className="mt-2 text-sm">{evaluation?.status === 'suitable' ? t(`assistant.tier.${evaluation.tier ?? 'minimum'}` as DictKey) : evaluation?.status === 'unsuitable' ? t('assistant.status.unsuitable') : t('assistant.status.verify')}</p>
      {!!evaluation?.checks.length && <dl className="mt-4 divide-y divide-line">{evaluation.checks.map((check, index) => <div key={`${check.field}-${index}`} className="grid gap-1 py-2 text-sm sm:grid-cols-2"><dt>{t(`field.${check.field}` as DictKey)}</dt><dd><bdi>{check.actual === 'Not listed' ? t('assistant.notListed') : check.actual}</bdi> <span className="text-mute">/ <bdi>{check.required}</bdi></span></dd></div>)}</dl>}
      <h3 className="mt-4 text-sm font-semibold">{t('assistant.row.features')}</h3>
      {product.keyFeatures.length ? <ul className="mt-2 list-inside list-disc space-y-1 text-sm">{product.keyFeatures.slice(0, 8).map((feature, index) => <li dir="auto" key={index}>{feature}</li>)}</ul> : <p className="mt-2 text-sm text-mute">{t('assistant.notListed')}</p>}
    </section>
  </div>;
}
