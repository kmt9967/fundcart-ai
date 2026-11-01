import Link from 'next/link';
import { listPublicCampaigns } from '@/lib/campaign-list';
import { CampaignCard } from '@/components/CampaignCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Campaigns — FundCart AI' };

export default async function Campaigns() {
  const list = await listPublicCampaigns(48).catch(() => []);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Fund together</p><h1 className="h-page mt-2">Campaigns</h1><p className="mt-2 text-sm text-ink-2 sm:text-base">Progress bars only count contributions PayPal has confirmed.</p></div>
        <Link href="/assistant" className="btn btn-primary w-full sm:w-auto">Start a campaign</Link>
      </div>
      {list.length ? <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">{list.map(c => <CampaignCard key={c.slug} c={c} />)}</div>
        : <div className="card mt-8 p-10 text-center text-mute">No campaigns yet.</div>}
    </div>
  );
}
