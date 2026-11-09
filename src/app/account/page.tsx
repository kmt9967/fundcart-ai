import type { Metadata } from 'next';
import { currentAccount } from '@/lib/auth';
import { getT } from '@/i18n/server';
import { AccountForms } from './AccountForms';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('auth.title')} — FundCart AI`, robots: { index: false } };
}

export default async function AccountPage() {
  const { t } = await getT();
  const account = await currentAccount();
  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="eyebrow">{t('nav.me')}</p>
      <h1 className="h-page mt-2">{t('auth.title')}</h1>
      <p className="mt-2 text-sm text-ink-2">{t('auth.lead')}</p>
      <AccountForms email={account?.email ?? null} />
    </div>
  );
}
