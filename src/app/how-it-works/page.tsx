import Link from 'next/link';

export const metadata = { title: 'How it works — FundCart AI' };

const agents = [
  ['Intent Agent', 'Reads your request and extracts category, purpose, budget, what you already have, must-haves and preferred brands. Asks one follow-up only if the request is too vague.'],
  ['Research Agent', 'Calls the Channel3 product search API with your budget as a price filter. Widens the search if too few products fit. Results are cached to save credits.'],
  ['Comparison Agent', 'Ranks products with a transparent score (price fit, matching features, ratings), then writes grounded explanations using only the retrieved fields. Product text is treated as untrusted data.'],
  ['Budget Agent', 'Computes funding gaps with exact integer-cent arithmetic. The model never sets a price, goal or total.'],
  ['Campaign Assistant', 'Drafts an honest campaign story, thank-you note and progress updates from verified numbers. You edit before anything is published.'],
  ['Payment Agent', 'Prepares checkout summaries. It cannot pay: every payment needs your explicit confirmation and approval inside PayPal.'],
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="eyebrow">How it works</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">AI does the legwork. You stay in control of the money.</h1>

      <section className="mt-10"><h2 className="text-xl font-bold">The agent team</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{agents.map(([n, b]) => <div key={n} className="card p-5"><h3 className="font-bold text-brand">{n}</h3><p className="mt-2 text-sm leading-relaxed text-ink-2">{b}</p></div>)}</div></section>

      <section className="mt-12"><h2 className="text-xl font-bold">How payments work (PayPal Sandbox)</h2>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed text-ink-2">
          <li><b className="text-ink">1. Server-priced orders.</b> FundCart&apos;s server creates every PayPal order (Orders v2 API) with an amount it calculated itself — the browser can&apos;t change it.</li>
          <li><b className="text-ink">2. You approve in PayPal.</b> The PayPal button opens PayPal&apos;s own approval window.</li>
          <li><b className="text-ink">3. Server captures and verifies.</b> After approval, the server captures the order and checks PayPal&apos;s response: the capture must be COMPLETED and match the expected amount and currency.</li>
          <li><b className="text-ink">4. Recorded once.</b> Contributions are written once per PayPal capture (unique constraints), so double clicks, refreshes or duplicate webhooks never double-count. Verified webhooks reconcile anything the browser missed.</li>
          <li><b className="text-ink">5. Separate purchase.</b> When verified contributions reach the goal, the creator can approve a <i>separate</i> sandbox checkout for the item.</li>
        </ol></section>

      <section className="card mt-12 p-6"><h2 className="text-lg font-bold">Sandbox demo money flow</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">Contributions are paid to a sandbox account that represents the campaign creator&apos;s PayPal account. The later purchase is a separate payment to a sandbox account representing the store. FundCart never holds, pools or redistributes money, and it is not an escrow service or a charity. A production version would onboard each creator&apos;s own PayPal account (PayPal multiparty / partner onboarding).</p></section>

      <div className="mt-10 flex gap-3"><Link href="/assistant" className="btn btn-primary">Try the assistant</Link><Link href="/disclosures" className="btn btn-ghost">Disclosures</Link></div>
    </div>
  );
}
