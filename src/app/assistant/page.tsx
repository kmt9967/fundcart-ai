import type { Metadata } from 'next';
import { Assistant } from './Assistant';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('nav.assistant')} — FundCart AI` };
}

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="eyebrow">{t('assistant.eyebrow')}</p>
      <h1 className="h-page mt-2">{t('assistant.title')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-2 sm:text-base">{t('assistant.intro')}</p>
      <Assistant initialQuery={typeof q === 'string' ? q.slice(0, 600) : ''} />
    </div>
  );
}
