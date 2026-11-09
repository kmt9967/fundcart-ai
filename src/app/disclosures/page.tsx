import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import type { DictKey } from '@/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('footer.disclosures')} — FundCart AI` };
}

const sections: Array<[DictKey, DictKey]> = [['disc.sandboxT', 'disc.sandboxB'], ['disc.charityT', 'disc.charityB'], ['disc.aiT', 'disc.aiB'], ['disc.paypalT', 'disc.paypalB'], ['disc.privacyT', 'disc.privacyB']];

export default async function Disclosures() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
      <p className="eyebrow">{t('disc.eyebrow')}</p>
      <h1 className="h-page mt-2">{t('disc.title')}</h1>
      <div className="mt-6 space-y-6 text-sm leading-relaxed text-ink-2 sm:mt-8">
        {sections.map(([h, b]) => <section key={h}><h2 className="text-base font-bold text-ink">{t(h)}</h2><p>{t(b)}</p></section>)}
        <section><h2 className="text-base font-bold text-ink">{t('disc.rulesT')}</h2>
          <ul className="list-disc space-y-1 ps-5">{(['disc.rule1', 'disc.rule2', 'disc.rule3', 'disc.rule4'] as const).map(k => <li key={k}>{t(k)}</li>)}</ul></section>
      </div>
    </div>
  );
}
