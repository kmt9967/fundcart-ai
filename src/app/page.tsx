import Link from 'next/link';
import { listPublicCampaigns } from '@/lib/campaign-list';
import { CampaignCard } from '@/components/CampaignCard';

export const dynamic = 'force-dynamic';

const steps = [
  { n: '01', title: 'Describe what you need', body: 'Tell the assistant in plain words — "a laptop for university under $700".', tone: 'brand' },
  { n: '02', title: 'AI researches real products', body: 'Agents search a live catalog, rank options transparently and explain the trade-offs.', tone: 'brand' },
  { n: '03', title: 'Fund the gap together', body: 'Short on budget? Turn the item into a campaign. Supporters contribute through PayPal.', tone: 'sun' },
  { n: '04', title: 'You approve the purchase', body: 'When verified funding reaches the goal, you review and approve a separate checkout.', tone: 'ok' },
];

export default async function Home() {
  const campaigns = await listPublicCampaigns(3).catch(() => []);
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_80%_-10%,#e7e1ff,transparent),radial-gradient(40rem_24rem_at_0%_20%,#fff0e4,transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:pt-20">
          <div className="fade-up">
            <span className="chip bg-white text-brand shadow-[var(--shadow-card)]">
              <span className="size-1.5 rounded-full bg-ok" /> Agentic commerce · human-approved payments
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-[3.4rem]">
              Find what you need.<br /><span className="bg-gradient-to-r from-brand to-sun bg-clip-text text-transparent">Fund what you dream.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
              FundCart AI researches real products for you, works out exactly how far your budget goes, and — if you&apos;re short — turns the gap into a campaign your community can support through PayPal.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/assistant" className="btn btn-primary px-5 py-3 text-base">Find my best option →</Link>
              <Link href="/campaigns" className="btn btn-ghost px-5 py-3 text-base">Support a campaign</Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 text-sm">
              <div><dt className="text-mute">Product data</dt><dd className="font-bold">Live catalog</dd></div>
              <div><dt className="text-mute">Payments</dt><dd className="font-bold">PayPal Sandbox</dd></div>
              <div><dt className="text-mute">Spending</dt><dd className="font-bold">Only with your OK</dd></div>
            </dl>
          </div>
          <HeroMock />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="eyebrow">One journey</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight">From &ldquo;I need something&rdquo; to &ldquo;I approve the purchase&rdquo;</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(s => (
            <div key={s.n} className="card p-5">
              <span className={`text-sm font-extrabold ${s.tone === 'sun' ? 'text-sun' : s.tone === 'ok' ? 'text-ok' : 'text-brand'}`}>{s.n}</span>
              <h3 className="mt-2 font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-mute">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div><p className="eyebrow">Live campaigns</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight">People funding real goals</h2></div>
          <Link href="/campaigns" className="text-sm font-semibold text-brand hover:underline">See all →</Link>
        </div>
        {campaigns.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{campaigns.map(c => <CampaignCard key={c.slug} c={c} />)}</div>
        ) : (
          <div className="card mt-6 p-8 text-center text-mute">No public campaigns yet. <Link className="font-semibold text-brand" href="/assistant">Start the first one →</Link></div>
        )}
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <div className="card grid gap-8 overflow-hidden p-8 sm:grid-cols-3 sm:p-10">
          <div className="sm:col-span-1"><p className="eyebrow">Trust by design</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight">AI prepares. You decide.</h2></div>
          <ul className="grid gap-4 text-sm text-ink-2 sm:col-span-2 sm:grid-cols-2">
            <li><b className="text-ink">Real prices only.</b> Prices come from the product catalog, never from the AI model.</li>
            <li><b className="text-ink">Verified progress.</b> Campaigns count a contribution only after PayPal confirms the capture.</li>
            <li><b className="text-ink">No autonomous spending.</b> Agents research and prepare checkout; every payment needs your approval in PayPal.</li>
            <li><b className="text-ink">Honest framing.</b> Not a charity or escrow. Contributions and purchases are separate PayPal payments.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function HeroMock() {
  return (
    <div className="fade-up relative" style={{ animationDelay: '.1s' }} aria-hidden>
      <div className="card rotate-[-1.5deg] p-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-mute"><span className="size-2 rounded-full bg-ok" /> Shopping Research Agent</div>
        <p className="mt-3 rounded-xl bg-paper p-3 text-sm">&ldquo;I need a laptop for university under $700.&rdquo;</p>
        <div className="mt-3 space-y-2 text-xs text-ink-2">
          {['Understood: laptop · budget $700 · student use', 'Searched live catalog · 16 products', 'Compared top 5 on price, fit and features'].map((t, i) => (
            <div key={i} className="flex items-center gap-2"><span className="grid size-4 place-items-center rounded-full bg-ok-soft text-[10px] text-ok">✓</span>{t}</div>
          ))}
        </div>
      </div>
      <div className="card absolute -bottom-24 right-0 w-[78%] rotate-[2deg] p-5 sm:right-[-1rem]">
        <div className="flex items-center justify-between text-xs font-semibold"><span className="text-sun">Campaign · Fund the gap</span><span className="text-mute">Verified</span></div>
        <div className="mt-2 text-sm font-bold">Help Maya get her study laptop</div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sun-soft"><div className="h-full w-[64%] rounded-full bg-gradient-to-r from-sun to-brand" /></div>
        <div className="mt-2 flex justify-between text-xs text-mute"><span><b className="text-ink">$320</b> of $500</span><span>7 supporters</span></div>
      </div>
      <div className="h-24" />
    </div>
  );
}
