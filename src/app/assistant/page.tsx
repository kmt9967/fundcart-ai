import type { Metadata } from 'next';
import { Assistant } from './Assistant';

export const metadata: Metadata = { title: 'Shop with AI — FundCart AI' };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow">AI shopping assistant</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">What do you need?</h1>
      <p className="mt-2 max-w-2xl text-ink-2">Describe it in your own words. Our agents search a live product catalog, compare options and work out your budget. Nothing is ever bought without your approval.</p>
      <Assistant initialQuery={typeof q === 'string' ? q.slice(0, 600) : ''} />
    </div>
  );
}
