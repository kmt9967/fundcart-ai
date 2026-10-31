export function ProgressBar({ percent, size = 'md' }: { percent: number; size?: 'md' | 'lg' }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className={`overflow-hidden rounded-full bg-sun-soft ${size === 'lg' ? 'h-3.5' : 'h-2.5'}`} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label="Verified funding progress">
      <div className="h-full rounded-full bg-gradient-to-r from-sun to-brand transition-[width] duration-700" style={{ width: `${p}%` }} />
    </div>
  );
}
