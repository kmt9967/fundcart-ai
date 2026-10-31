import Link from 'next/link';
import { findRecentProduct } from '@/lib/channel3';
import { Builder } from './Builder';

export const dynamic = 'force-dynamic';

export default async function NewCampaign({ searchParams }: { searchParams: Promise<{ product?: string; own?: string }> }) {
  const { product: pid, own } = await searchParams;
  const product = pid && /^[A-Za-z0-9_-]{3,40}$/.test(pid) ? await findRecentProduct(pid).catch(() => null) : null;
  if (!product) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold">Pick a product first</h1>
        <p className="mt-2 text-mute">Campaigns are created from a real product so the goal is based on a live price.</p>
        <Link href="/assistant" className="btn btn-primary mt-6">Find a product with AI</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Campaign builder</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Fund the gap together</h1>
      <p className="mt-2 max-w-2xl text-ink-2">Your goal is the difference between the item&apos;s live price and what you already have. The AI helps you tell your story honestly — you review everything before publishing.</p>
      <Builder product={product} initialOwn={own && /^\d+(\.\d{1,2})?$/.test(own) ? own : ''} />
    </div>
  );
}
