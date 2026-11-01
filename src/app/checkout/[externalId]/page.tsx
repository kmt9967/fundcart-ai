import Link from 'next/link';
import { findRecentProduct } from '@/lib/channel3';
import { DirectCheckout } from './DirectCheckout';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: Promise<{ externalId: string }> }) {
  const { externalId } = await params;
  const product = /^[A-Za-z0-9_-]{3,40}$/.test(externalId) ? await findRecentProduct(externalId).catch(() => null) : null;
  if (!product || product.priceCents == null) {
    return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="text-2xl font-extrabold">Product unavailable</h1><p className="mt-2 text-mute">We couldn&apos;t confirm a live price for this item.</p><Link href="/assistant" className="btn btn-primary mt-6">Back to the assistant</Link></div>;
  }
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="eyebrow">Payment Agent · checkout prepared</p>
      <h1 className="h-page mt-2">Review and approve</h1>
      <p className="mt-2 text-sm text-ink-2 sm:text-base">The agent prepared this order from live catalog data. It will not be paid unless you approve it below and in PayPal.</p>
      <div className="mt-6 grid gap-5 sm:mt-8 md:grid-cols-[1fr_340px] md:gap-6">
        <div className="card flex gap-4 p-4 sm:gap-5 sm:p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {product.imageUrl && <img src={product.imageUrl} alt={product.imageAlt || product.title} className="size-20 shrink-0 rounded-xl border border-line bg-white object-contain p-2 sm:size-32 sm:p-3" />}
          <div className="min-w-0 text-sm">
            <p className="text-xs font-semibold text-mute">{product.brand}{product.merchantDomain ? ` · ${product.merchantDomain}` : ''}</p>
            <h2 className="mt-1 font-bold leading-snug">{product.title}</h2>
            <ul className="mt-3 space-y-1 text-xs text-mute">{product.keyFeatures.slice(0, 4).map(f => <li key={f}>• {f}</li>)}</ul>
            <p className="mt-3 text-xs text-mute">Price retrieved from Channel3 at {new Date(product.fetchedAt).toLocaleString()}.</p>
          </div>
        </div>
        <DirectCheckout externalId={product.externalId} priceCents={product.priceCents} clientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''} />
      </div>
    </div>
  );
}
