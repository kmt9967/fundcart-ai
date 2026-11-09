import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { ResetForm } from '../AccountForms';

export const metadata: Metadata = { robots: { index: false } };

export default async function ResetPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="h-page">{t('auth.resetTitle')}</h1>
      <ResetForm />
    </div>
  );
}
