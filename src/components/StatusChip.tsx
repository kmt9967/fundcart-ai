import { getT } from '@/i18n/server';
import type { DictKey } from '@/i18n';

const cls: Record<string, string> = {
  active: 'bg-white text-brand',
  goal_reached: 'bg-ok text-white',
  purchased: 'bg-ink text-white',
  cancelled: 'bg-bad text-white',
};

export async function StatusChip({ status }: { status: string }) {
  const { t } = await getT();
  const label = cls[status] ? t(`status.${status}` as DictKey) : status;
  return <span className={`chip shadow-sm ${cls[status] || 'bg-white text-ink'}`}>{label}</span>;
}
