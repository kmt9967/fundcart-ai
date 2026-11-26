import type { Metadata } from 'next';
import Link from 'next/link';
import { currentModerator, moderationQueue } from '@/lib/moderators';
import { getT } from '@/i18n/server';
import { ReviewCard } from './ReviewCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Moderation — FundCart AI', robots: { index: false } };

// Moderator-only queue. The role check runs on the server for the page and again in the API.
export default async function ModerationPage() {
  const { t } = await getT();
  const mod = await currentModerator();
  if (!mod) return <div className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="h-page">{t('admin.title')}</h1><p className="mt-3 text-mute" data-testid="forbidden">{t('admin.forbidden')}</p><Link className="btn btn-primary mt-6" href="/account">{t('auth.signInCta')}</Link></div>;
  const items = await moderationQueue(mod.profileId);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="card border-brand/15 bg-brand-soft/40 p-5 sm:p-7">
        <h1 className="h-page">{t('admin.title')}</h1>
        <p className="mt-2 text-sm text-ink-2">{t('admin.lead')}</p>
      </header>
      {items.length === 0 ? <p className="mt-6 text-mute" data-testid="queue-empty">{t('admin.empty')}</p> : (
        <ul className="mt-6 grid gap-4 xl:grid-cols-2">{items.map(c => {
          return <li key={c.id}><ReviewCard c={c} /></li>;
        })}</ul>
      )}
    </div>
  );
}
