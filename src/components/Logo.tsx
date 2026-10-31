import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight text-ink" aria-label="FundCart AI home">
      <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-brand to-sun text-white shadow-[var(--shadow-lift)]">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 4h2l2.2 10.4a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.7L20 8H6.2" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" />
        </svg>
      </span>
      <span>FundCart <span className="text-brand">AI</span></span>
    </Link>
  );
}
