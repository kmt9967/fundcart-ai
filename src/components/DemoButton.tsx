import { getT } from '@/i18n/server';

/** "Try Demo Account": opens the read-only sample dashboard. No credentials are involved. */
export async function DemoButton({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { t } = await getT();
  return (
    <form action="/api/demo" method="post" className={className}>
      <input type="hidden" name="action" value="start" />
      {compact
        ? <button className="btn btn-ghost min-h-12 px-5 text-base" data-testid="try-demo">{t('demo.try')}</button>
        : <div className="card p-4 sm:p-5"><p className="font-semibold">{t('demo.cardTitle')}</p><p className="mt-1 text-sm text-ink-2">{t('demo.cardBody')}</p><button className="btn btn-sun mt-3" data-testid="try-demo">{t('demo.try')}</button></div>}
    </form>
  );
}
