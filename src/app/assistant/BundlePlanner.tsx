'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormat, useLocale, useT } from '@/i18n/client';
import { bundleTotal } from '@/lib/shopping/bundle';

type Offer = { externalId: string; title: string; priceCents: number | null; merchantDomain: string | null };
type Slot = { offers?: Offer[]; selected?: Offer; busy?: boolean; error?: boolean };
const copy = {
  en: ['Bundle planner', 'Find options', 'Select an item', 'Known item total', 'Items without prices', 'Over budget', 'Compatibility, shipping and tax are unconfirmed. Each item can be reviewed separately.', 'No catalog items found'],
  ur: ['بنڈل پلانر', 'آپشنز تلاش کریں', 'آئٹم منتخب کریں', 'معلوم قیمتوں کا مجموعہ', 'بغیر قیمت کی اشیا', 'بجٹ سے زیادہ', 'مطابقت، شپنگ اور ٹیکس کی تصدیق نہیں۔ ہر آئٹم الگ دیکھیں۔', 'کیٹلاگ میں کوئی آئٹم نہیں ملا'],
  es: ['Planificador de paquetes', 'Buscar opciones', 'Seleccionar artículo', 'Total conocido', 'Artículos sin precio', 'Supera el presupuesto', 'Compatibilidad, envío e impuestos sin confirmar. Revisa cada artículo por separado.', 'No se encontraron artículos'],
  fr: ['Composer un ensemble', 'Chercher des options', 'Choisir un article', 'Total connu', 'Articles sans prix', 'Budget dépassé', 'Compatibilité, livraison et taxes à confirmer. Chaque article peut être examiné séparément.', 'Aucun article trouvé'],
} as const;

export function BundlePlanner({ kit, budgetCents }: { kit: { id: string; title: string; items: string[] }; budgetCents: number | null }) {
  const t = useT();
  const f = useFormat();
  const [title, search, select, total, missing, over, disclosure, empty] = copy[useLocale()];
  const [slots, setSlots] = useState<Record<number, Slot>>({});
  const summary = bundleTotal(kit.items.map((_, index) => slots[index]?.selected?.priceCents), budgetCents);
  function update(index: number, patch: Slot) {
    setSlots(previous => ({ ...previous, [index]: { ...previous[index], ...patch } }));
  }
  async function load(index: number) {
    update(index, { busy: true, error: false });
    try {
      const response = await fetch('/api/assistant/bundle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit: kit.id, component: index }),
      });
      if (!response.ok) throw new Error('catalog unavailable');
      const { products } = await response.json() as { products: Offer[] };
      update(index, { offers: products, busy: false });
    } catch {
      update(index, { busy: false, error: true });
    }
  }
  return <section className="card p-5">
    <h2 className="font-bold">{title} <span className="font-normal text-mute">· {kit.title}</span></h2>
    <ul className="mt-3 divide-y divide-line">
      {kit.items.map((item, index) => {
        const slot = slots[index];
        return <li key={item} className="grid gap-2 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong dir="auto" className="text-sm capitalize">{item}</strong>
            <button type="button" className="btn btn-ghost min-h-9 px-3 py-1" onClick={() => void load(index)} disabled={slot?.busy}>{slot?.busy ? '…' : search}</button>
          </div>
          {!!slot?.offers?.length && <label className="text-xs text-mute">
            {select}
            <select className="input mt-1" value={slot.selected?.externalId ?? ''} onChange={event => update(index, { selected: slot.offers?.find(offer => offer.externalId === event.target.value) })}>
              <option value="">—</option>
              {slot.offers.map(offer => <option key={offer.externalId} value={offer.externalId}>{offer.title} · {f.usd(offer.priceCents)}{offer.merchantDomain ? ` · ${offer.merchantDomain}` : ''}</option>)}
            </select>
          </label>}
          {slot?.selected && <Link className="text-sm font-semibold text-brand underline" href={`/products/${encodeURIComponent(slot.selected.externalId)}`}>{slot.selected.title}</Link>}
          {slot?.offers?.length === 0 && <p className="text-xs text-mute">{empty}</p>}
          {slot?.error && <p role="status" className="text-xs text-bad">{t('assistant.searchFailed')}</p>}
        </li>;
      })}
    </ul>
    <div aria-live="polite" className="border-t border-line pt-3 text-sm">
      <p className="font-bold">{total} <bdi>{f.usd(summary.totalCents)}</bdi></p>
      <p className="text-mute">{missing} <bdi>{summary.unquoted}</bdi></p>
      {summary.overBudget && <p className="font-semibold text-bad">{over}</p>}
    </div>
    <p className="mt-2 text-xs text-mute">{disclosure}</p>
  </section>;
}
