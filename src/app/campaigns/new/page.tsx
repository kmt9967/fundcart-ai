import Link from 'next/link';
import { getT } from '@/i18n/server';
import { findRecentProduct } from '@/lib/channel3';
import { Builder } from './Builder';

export const dynamic = 'force-dynamic';

export default async function NewCampaign({ searchParams }: { searchParams: Promise<{ product?: string; own?: string }> }) {
  const { product: pid, own } = await searchParams;
  const { t } = await getT();
  const product = pid && /^[A-Za-z0-9_-]{3,40}$/.test(pid) ? await findRecentProduct(pid).catch(() => null) : null;
  if (!product) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold">{t('nb.pickTitle')}</h1>
        <p className="mt-2 text-mute">{t('nb.pickBody')}</p>
        <Link href="/assistant" className="btn btn-primary mt-6">{t('nb.pickCta')}</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="eyebrow">{t('nb.eyebrow')}</p>
      <h1 className="h-page mt-2">{t('nb.title')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-2 sm:text-base">{t('nb.lead')}</p>
      <Builder product={product} initialOwn={own && /^\d+(\.\d{1,2})?$/.test(own) ? own : ''} />
    </div>
  );
}
