export const metadata = { title: 'Disclosures & privacy — FundCart AI' };

export default function Disclosures() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
      <p className="eyebrow">Demo disclosures, terms &amp; privacy</p>
      <h1 className="h-page mt-2">Plain-language disclosures</h1>
      <div className="mt-6 space-y-6 sm:mt-8 text-sm leading-relaxed text-ink-2">
        <section><h2 className="text-base font-bold text-ink">Sandbox only</h2><p>FundCart AI is a hackathon prototype. Every payment uses the PayPal Sandbox test environment. No real money is charged, received or transferred, and no real product is purchased or shipped.</p></section>
        <section><h2 className="text-base font-bold text-ink">Not a charity, bank or escrow service</h2><p>Campaigns are personal fundraising pages. Contributions are not tax-deductible. FundCart does not hold or pool funds: a contribution is a payment to the campaign&apos;s receiving account, and a purchase is a separate payment the creator approves.</p></section>
        <section><h2 className="text-base font-bold text-ink">AI limitations</h2><p>AI explanations are generated from product data returned by the Channel3 catalog and can still be wrong or incomplete. Prices, availability and specifications come from the catalog, can change at the retailer, and should be checked before buying. The AI never decides prices or payment amounts.</p></section>
        <section><h2 className="text-base font-bold text-ink">Not affiliated with PayPal</h2><p>FundCart AI is an independent project built for the PayPal AI Hackathon. It uses PayPal&apos;s public developer APIs and is not endorsed by PayPal.</p></section>
        <section><h2 className="text-base font-bold text-ink">Privacy</h2><p>There are no accounts: your browser holds a random, signed guest ID. We store the requests you make to the assistant, campaigns you create, and payment records (PayPal order and capture IDs, amounts, statuses and timestamps). Supporters can contribute anonymously; anonymous names are never shown publicly. We never receive your PayPal password or card details — those are entered only on PayPal. Demo data may be deleted after the hackathon.</p></section>
        <section><h2 className="text-base font-bold text-ink">Campaign rules in this demo</h2><ul className="list-disc space-y-1 pl-5"><li>Only PayPal-confirmed (COMPLETED) captures count toward progress.</li><li>Contributions above the remaining amount are rejected (no overfunding).</li><li>Cancelled campaigns stop accepting contributions; recorded sandbox payments can be refunded in PayPal, and refunds/reversals reported by PayPal webhooks are removed from the total.</li><li>The goal is fixed at creation from the live price snapshot.</li></ul></section>
      </div>
    </div>
  );
}
