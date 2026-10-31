import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getCampaignBySlug, publicContributions, campaignUpdates } from '@/lib/campaigns';
import { currentUserId } from '@/lib/identity';
import { formatUSD } from '@/lib/money';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusChip } from '@/components/StatusChip';
import { Contribute } from './Contribute';
import { ShareBox } from './ShareBox';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getCampaignBySlug(slug);
  return { title: d ? `${d.campaign.title} — FundCart AI` : 'Campaign — FundCart AI', robots: d?.campaign.visibility === 'unlisted' ? { index: false } : undefined };
}

async function siteOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.round(s / 60)}m ago`; if (s < 86400) return `${Math.round(s / 3600)}h ago`; return `${Math.round(s / 86400)}d ago`;
}

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ created?: string }> }) {
  const { slug } = await params; const { created } = await searchParams;
  const data = await getCampaignBySlug(slug);
  if (!data) notFound();
  const { campaign: c, product, totals } = data;
  const [supporters, updates, uid] = await Promise.all([publicContributions(c.id), campaignUpdates(c.id), currentUserId()]);
  const isOwner = uid === c.owner_id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {created && isOwner && <ShareBox url={`${await siteOrigin()}/c/${c.slug}`} />}
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><StatusChip status={c.status} />{c.is_demo_seed && <span className="chip bg-ink text-white">Demo data</span>}{c.category && <span className="chip bg-white text-ink-2">{c.category}</span>}</div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{c.title}</h1>
          <p className="mt-2 text-sm text-mute">Created by <b className="text-ink">{c.creator_name}</b> · {new Date(c.created_at).toLocaleDateString()}{c.deadline ? ` · target date ${new Date(c.deadline).toLocaleDateString()}` : ''}</p>

          <div className="card mt-6 overflow-hidden">
            {c.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={c.image_url} alt={product?.title || c.title} className="aspect-[16/9] w-full bg-white object-contain p-8" />
              : <div className="aspect-[16/9] bg-gradient-to-br from-brand-soft to-sun-soft" />}
          </div>

          <section className="mt-8"><h2 className="text-lg font-bold">The story</h2><p className="mt-3 whitespace-pre-line leading-relaxed text-ink-2">{c.story}</p></section>

          {product && (
            <section className="card mt-8 p-5">
              <h2 className="text-sm font-bold">What the money is for</h2>
              <div className="mt-3 flex gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {product.image_url && <img src={product.image_url} alt="" className="size-20 shrink-0 rounded-xl border border-line bg-white object-contain p-2" />}
                <div className="min-w-0 text-sm">
                  <p className="font-semibold leading-snug">{product.title}</p>
                  <p className="mt-1 text-mute">{product.brand}{product.merchant_domain ? ` · sold by ${product.merchant_domain}` : ''}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-3">
                    <div><dt className="text-xs text-mute">Item price</dt><dd className="font-bold">{formatUSD(c.item_price_cents)}</dd></div>
                    <div><dt className="text-xs text-mute">Creator has</dt><dd className="font-bold">{formatUSD(c.own_funds_cents)}</dd></div>
                    <div><dt className="text-xs text-mute">Raising</dt><dd className="font-bold text-sun">{formatUSD(c.target_cents)}</dd></div>
                  </dl>
                  <p className="mt-2 text-[11px] text-mute">Price snapshot from Channel3 at {new Date(product.fetched_at).toLocaleString()}.</p>
                </div>
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-bold">Updates</h2>
            {updates.length === 0 ? <p className="mt-2 text-sm text-mute">No updates yet.</p> : (
              <ol className="mt-3 space-y-3">{updates.map(u => (
                <li key={u.id} className="card p-4 text-sm"><div className="flex items-center justify-between text-xs text-mute"><span className="font-semibold uppercase tracking-wide">{u.kind.replace('_', ' ')}{u.ai_generated ? ' · AI-assisted' : ''}</span><span>{ago(u.created_at)}</span></div><p className="mt-1.5 leading-relaxed text-ink-2">{u.body}</p></li>
              ))}</ol>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <p className="text-3xl font-extrabold">{formatUSD(totals.raisedCents)}</p>
            <p className="text-sm text-mute">raised of {formatUSD(c.target_cents)} goal · verified by PayPal</p>
            <div className="mt-4"><ProgressBar percent={totals.percent} size="lg" /></div>
            <div className="mt-3 grid grid-cols-3 text-center text-sm">
              <div><p className="font-extrabold">{totals.percent}%</p><p className="text-xs text-mute">funded</p></div>
              <div><p className="font-extrabold">{totals.supporterCount}</p><p className="text-xs text-mute">supporters</p></div>
              <div><p className="font-extrabold">{formatUSD(totals.remainingCents)}</p><p className="text-xs text-mute">to go</p></div>
            </div>
            {isOwner && <Link href={`/c/${c.slug}/manage`} className="btn btn-ghost mt-4 w-full">Open creator dashboard</Link>}
          </div>

          {c.status === 'active' ? (
            <Contribute slug={c.slug} clientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''} remainingCents={totals.remainingCents} suggested={c.suggested_amounts_cents.filter(a => a <= totals.remainingCents || c.allow_overfunding)} />
          ) : (
            <div className="card p-5 text-sm">
              {c.status === 'goal_reached' && <p><b className="text-ok">Goal reached!</b> Contributions are closed. The creator can now approve a separate sandbox purchase.</p>}
              {c.status === 'purchased' && <p><b>Completed.</b> The creator approved and paid a separate PayPal Sandbox checkout for the item. No real product was bought.</p>}
              {c.status === 'cancelled' && <p><b className="text-bad">Cancelled.</b> This campaign no longer accepts contributions.</p>}
            </div>
          )}

          <div className="card p-5">
            <h2 className="text-sm font-bold">Supporters</h2>
            {supporters.length === 0 ? <p className="mt-2 text-sm text-mute">Be the first to support.</p> : (
              <ul className="mt-3 space-y-3">{supporters.slice(0, 12).map((s, i) => (
                <li key={i} className="flex gap-3 text-sm"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">{s.name.slice(0, 1)}</span>
                  <div className="min-w-0"><p><b>{s.name}</b> <span className="text-mute">· {formatUSD(s.amountCents)} · {ago(s.at)}</span></p>{s.message && <p className="text-ink-2">{s.message}</p>}</div></li>
              ))}</ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
