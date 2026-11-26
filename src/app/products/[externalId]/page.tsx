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
  const canFund = fundingOffer(policy).available && evaluation?.status === 'suitable' && price != null && (estimate == null || estimate.totalCents > 0);
  const resumeLink = state && s ? `/assistant?s=${encodeURIComponent(s)}` : '/assistant';
  const comparison = state && typeof compare === 'string' && compare.length <= 164
    ? [...new Set(compare.split(',').filter(id => validId.test(id)))].slice(0, 4) : [];
  const comparisonLink = comparison.length >= 2 ? `${resumeLink}&compare=${encodeURIComponent(comparison.join(','))}#compare` : resumeLink;

  return <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
    <Link href={resumeLink} className="tap text-sm font-semibold text-brand hover:underline">{t('co.back')}</Link>
    <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)] lg:gap-10">
      <div className="card grid aspect-[4/3] place-items-center overflow-hidden bg-brand-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {product.imageUrl ? <img src={product.imageUrl} alt={product.imageAlt || product.title} className="h-full w-full object-contain p-5" /> : <p className="text-sm text-mute">{t('assistant.noImage')}</p>}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-mute" dir="auto">{[product.brand, product.merchantDomain].filter(Boolean).join(' · ') || t('assistant.notListed')}</p>
        <h1 dir="auto" className="h-page mt-2 wrap-anywhere">{product.title}</h1>
        <p className="mt-3 text-3xl font-extrabold text-brand"><bdi>{usd(price)}</bdi></p>
        <p className="mt-2 text-xs text-mute">{t('co.priceRetrieved', { time: dateTime(product.fetchedAt) })}</p>
        <section className="card mt-5 p-5">
          <h2 className="font-bold">{t('assistant.row.gap')}</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt>{t('b.youHave')}</dt><dd dir="ltr">{own == null ? '—' : usd(own)}</dd></div>
            <div className="flex justify-between gap-3"><dt>{t('trust.gapShipping')}</dt><dd>{t('trust.gapUnquoted')}</dd></div>
            <div className="flex justify-between gap-3"><dt>{t('trust.gapTax')}</dt><dd>{t('trust.gapUnquoted')}</dd></div>
            {estimate && <>
              <div className="flex justify-between gap-3"><dt>{t('trust.gapBuffer', { pct: 5 })}</dt><dd dir="ltr">{usd(estimate.formula.buffer)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-line pt-2 font-bold"><dt>{t('b.goal')}</dt><dd dir="ltr">{usd(estimate.totalCents)}</dd></div>
            </>}
          </dl>
        </section>
        <div className="mt-5 flex flex-wrap gap-2">
          {price != null && <Link className="btn btn-primary" href={`/checkout/${externalId}`}>{t('assistant.buy')}</Link>}
          {canFund && <Link className="btn btn-sun" href={`/campaigns/new?product=${externalId}&s=${s}${own != null ? `&own=${own / 100}` : ''}`}>{t('assistant.fund')}</Link>}
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
