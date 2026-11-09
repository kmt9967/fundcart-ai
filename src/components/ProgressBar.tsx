import { getT } from '@/i18n/server';

export async function ProgressBar({ percent, size = 'md' }: { percent: number; size?: 'md' | 'lg' }) {
  const { t } = await getT();
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className={`overflow-hidden rounded-full bg-sun-soft ${size === 'lg' ? 'h-3.5' : 'h-2.5'}`} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={t('progress.aria')}>
      {/* Logical start so the bar fills right-to-left in Urdu. */}
      <div className="h-full rounded-full bg-gradient-to-r from-sun to-brand transition-[width] duration-700 rtl:bg-gradient-to-l" style={{ width: `${p}%` }} />
    </div>
  );
}
