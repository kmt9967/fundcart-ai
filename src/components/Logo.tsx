import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap text-lg font-extrabold tracking-tight text-ink" aria-label="FundCart AI home">
      FundCart <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-extrabold text-white">AI</span>
    </Link>
  );
}
