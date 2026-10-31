const map: Record<string, { label: string; cls: string }> = {
  active: { label: 'Accepting support', cls: 'bg-white text-brand' },
  goal_reached: { label: 'Goal reached', cls: 'bg-ok text-white' },
  purchased: { label: 'Purchased (sandbox)', cls: 'bg-ink text-white' },
  cancelled: { label: 'Cancelled', cls: 'bg-bad text-white' },
};

export function StatusChip({ status }: { status: string }) {
  const s = map[status] || { label: status, cls: 'bg-white text-ink' };
  return <span className={`chip shadow-sm ${s.cls}`}>{s.label}</span>;
}
