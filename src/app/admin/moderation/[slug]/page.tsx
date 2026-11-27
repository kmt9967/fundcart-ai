import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentModerator, moderationQueue } from '@/lib/moderators';
import { getT } from '@/i18n/server';
import { ReviewCard } from '../ReviewCard';

export const metadata = { robots: { index: false, follow: false } };

export default async function CampaignReview({ params }: { params: Promise<{ slug: string }> }) {
  const moderator = await currentModerator();
  if (!moderator) notFound();
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) notFound();
  const [campaign] = await moderationQueue(moderator.profileId, slug);
  if (!campaign) notFound();
  const { t } = await getT();
  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
    <Link href="/admin/moderation" className="tap text-sm font-semibold text-brand">{t('admin.title')}</Link>
    <h1 className="h-page mb-6 mt-2" dir="auto">{campaign.title}</h1>
    <ReviewCard c={campaign} expanded />
  </div>;
}
