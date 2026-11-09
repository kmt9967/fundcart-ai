import Link from 'next/link';
import { getT } from '@/i18n/server';

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:py-24">
      <p className="eyebrow">404</p>
      <h1 className="h-page mt-2">{t('nf.title')}</h1>
      <p className="mt-2 text-mute">{t('nf.body')}</p>
      <Link href="/" className="btn btn-primary mt-6">{t('nf.home')}</Link>
    </div>
  );
}
