import type { Metadata } from 'next';
import { currentAccount } from '@/lib/auth';
import { getT } from '@/i18n/server';
import { AccountForms } from './AccountForms';
import { safeNext } from '@/lib/safe-next';
import { DemoButton } from '@/components/DemoButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('auth.title')} — FundCart AI`, robots: { index: false } };
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { t } = await getT();
  const next = safeNext((await searchParams).next);
  const account = await currentAccount();
  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="eyebrow">{t('nav.me')}</p>
      <h1 className="h-page mt-2">{t('auth.title')}</h1>
      <p className="mt-2 text-sm text-ink-2">{t('auth.lead')}</p>
      {account && <p className="mt-3"><span className={`chip ${account.emailVerified ? 'bg-ok-soft text-ok' : 'bg-sun-soft text-warn'}`} data-testid="email-status">{t(account.emailVerified ? 'auth.emailVerified' : 'auth.emailUnverified')}</span></p>}
      {next && !account && <p className="mt-3 rounded-xl border border-brand/30 bg-brand-soft p-3 text-sm" role="status" data-testid="draft-kept">{t('elig.draftKept')}</p>}
      <AccountForms email={account?.email ?? null} next={next} />
      {!account && <DemoButton className="mt-6" />}
    </div>
  );
}
