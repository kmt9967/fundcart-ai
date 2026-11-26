import type { Metadata } from 'next';
import Link from 'next/link';
import { HistoryAction } from './HistoryAction';
import { Assistant } from './Assistant';
import { getT } from '@/i18n/server';
import { currentAccount } from '@/lib/auth';
import { db } from '@/lib/db';
import { INTENT_VERSION, type SessionState } from '@/lib/shopping/types';

const historyLabels = {
  en: ['Recent shopping sessions', 'New search'],
  ur: ['حالیہ خریداری سیشن', 'نئی تلاش'],
  es: ['Sesiones de compra recientes', 'Nueva búsqueda'],
  fr: ['Sessions d’achat récentes', 'Nouvelle recherche'],
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('nav.assistant')} — FundCart AI` };
}

async function recentSessions(account: Awaited<ReturnType<typeof currentAccount>>) {
  try {
    if (!account) return [];
    const load = () => db().from('ai_sessions').select('id,intent,created_at,prompt,safety,result')
      .eq('user_id', account.profileId).eq('result->>kind', 'results');
    const [pinned, recent] = await Promise.all([
      load().eq('result->>saved', 'true').order('created_at', { ascending: false }).limit(12),
      load().order('created_at', { ascending: false }).limit(30),
    ]);
    const seen = new Set<string>();
    const ids = new Set<string>();
    return [...(pinned.data ?? []), ...(recent.data ?? [])].flatMap(row => {
      const state = row.intent as SessionState | undefined;
      if (state?.version !== INTENT_VERSION || row.prompt === '[sensitive purchase: not stored]'
        || row.safety?.notices?.includes('sensitive_purchase') || ids.has(row.id) || (!row.result?.saved && seen.has(state.searchQuery))) return [];
      ids.add(row.id);
      seen.add(state.searchQuery);
      return [{ id: String(row.id), title: state.category === 'unknown' ? null : state.category, at: String(row.created_at), comparison: Array.isArray(row.result?.comparison) ? row.result.comparison : [] }];
    }).slice(0, 18);
  } catch {
    return [];
  }
}

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string; s?: string; compare?: string }> }) {
  const [{ q, s, compare }, { t, locale, date }, account] = await Promise.all([searchParams, getT(), currentAccount().catch(() => null)]);
  const sessions = await recentSessions(account);
  const resumeId = typeof s === 'string' && /^[a-f0-9-]{36}$/i.test(s) ? s : undefined;
  const initialComparison = typeof compare === 'string' && compare.length <= 164
    ? [...new Set(compare.split(',').filter(id => /^[A-Za-z0-9_-]{3,40}$/.test(id)))].slice(0, 4) : sessions.find(session => session.id === resumeId)?.comparison ?? [];
  const query = typeof q === 'string' ? q.slice(0, 600) : '';
  const [recent, fresh] = historyLabels[locale];
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-6">
        <div>
          <h1 className="h-page">{t('assistant.title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-mute sm:text-base">{t('assistant.intro')}</p>
        </div>
        {(resumeId || query) && <Link href="/assistant" className="btn btn-ghost">{fresh}</Link>}
      </div>
      {!!sessions.length && <details className="card mt-4 p-4">
        <summary className="cursor-pointer text-sm font-semibold">{recent}</summary>
        <ul className="mt-2 flex flex-wrap gap-2">
          {sessions.map(session => <li key={session.id}><Link href={`/assistant?s=${session.id}`} className="btn btn-ghost capitalize">{session.title ?? t('nav.assistant')} <span className="text-xs font-normal text-mute">{date(session.at)}</span></Link><HistoryAction id={session.id} /></li>)}
        </ul>
      </details>}
      <Assistant key={resumeId ?? query} initialQuery={query} resumeId={resumeId} canSaveHistory={!!account} initialComparison={initialComparison} />
    </div>
  );
}
