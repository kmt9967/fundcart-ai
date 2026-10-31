import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-3xl font-extrabold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-mute">The campaign or receipt may have been removed.</p>
      <Link href="/" className="btn btn-primary mt-6">Back home</Link>
    </div>
  );
}
