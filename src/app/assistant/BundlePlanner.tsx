'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormat, useLocale, useT } from '@/i18n/client';
import { bundleTotal } from '@/lib/shopping/bundle';

type Offer = { externalId: string; title: string; priceCents: number | null; merchantDomain: string | null; socket?: string | null };
type Slot = { offers?: Offer[]; selected?: Offer; busy?: boolean; error?: boolean };
const copy = {
  en: ['Bundle planner', 'Find options', 'Select an item', 'Known item total', 'Items without prices', 'Over budget', 'Compatibility, shipping and tax are unconfirmed. Each item can be reviewed separately.', 'No catalog items found'],
  ur: ['بنڈل پلانر', 'آپشنز تلاش کریں', 'آئٹم منتخب کریں', 'معلوم قیمتوں کا مجموعہ', 'بغیر قیمت کی اشیا', 'بجٹ سے زیادہ', 'مطابقت، شپنگ اور ٹیکس کی تصدیق نہیں۔ ہر آئٹم الگ دیکھیں۔', 'کیٹلاگ میں کوئی آئٹم نہیں ملا'],
  es: ['Planificador de paquetes', 'Buscar opciones', 'Seleccionar artículo', 'Total conocido', 'Artículos sin precio', 'Supera el presupuesto', 'Compatibilidad, envío e impuestos sin confirmar. Revisa cada artículo por separado.', 'No se encontraron artículos'],
  fr: ['Composer un ensemble', 'Chercher des options', 'Choisir un article', 'Total connu', 'Articles sans prix', 'Budget dépassé', 'Compatibilité, livraison et taxes à confirmer. Chaque article peut être examiné séparément.', 'Aucun article trouvé'],
} as const;

export function BundlePlanner({ kit, budgetCents, accountSaving = false }: { kit: { id: string; title: string; items: string[] }; budgetCents: number | null; accountSaving?: boolean }) {
  const t = useT();
  const f = useFormat();
  const [title, search, select, total, missing, over, disclosure, empty] = copy[useLocale()];
  const locale = useLocale();
  const controls = {
    en: ['Required', 'Optional', 'Save selections on this device', 'Saved on this device', 'CPU sockets match; other compatibility is not confirmed.', 'CPU and motherboard sockets differ.', 'Required items still missing'],
    ur: ['لازمی', 'اختیاری', 'اس آلے پر محفوظ کریں', 'اس آلے پر محفوظ', 'ساکٹ ملتے ہیں؛ باقی مطابقت غیر تصدیق شدہ ہے۔', 'پروسیسر اور مدربورڈ کے ساکٹ مختلف ہیں۔', 'لازمی اشیا باقی ہیں'],
    es: ['Obligatorio', 'Opcional', 'Guardar en este dispositivo', 'Guardado en este dispositivo', 'Los zócalos coinciden. El resto no está confirmado.', 'Los zócalos son distintos.', 'Faltan artículos obligatorios'],
    fr: ['Obligatoire', 'Facultatif', 'Enregistrer sur cet appareil', 'Enregistré sur cet appareil', 'Sockets identiques. Autres critères à confirmer.', 'Les sockets sont différents.', 'Articles obligatoires manquants'],
  }[locale];
  const optionalItems = new Set(['desk lamp', 'hand mixer', 'cooler box', 'gym bag', 'storage boxes', 'bluetooth speaker']);
  const key = `fundcart:bundle:${kit.id}`;
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');
  const [accountBundles, setAccountBundles] = useState<{ id: string; name: string; selections: (string | null)[] }[] | null>(null);
  const [restoreIds, setRestoreIds] = useState<(string | null)[] | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState(false);
  const [slots, setSlots] = useState<Record<number, Slot>>({});
  const summary = bundleTotal(kit.items.flatMap((item, index) =>
    optionalItems.has(item) && !slots[index]?.selected ? [] : [slots[index]?.selected?.priceCents]), budgetCents);
  const missingRequired = kit.items.filter((item, index) => !optionalItems.has(item) && !slots[index]?.selected).length;
  const cpu = slots[0]?.selected?.socket;
  const board = slots[1]?.selected?.socket;
  const socketStatus = kit.id === 'pc_build' && cpu && board ? (cpu === board ? controls[4] : controls[5]) : null;
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(kit.items.map((_, index) => slots[index]?.selected?.externalId ?? null)));
      setSaved(true);
    } catch { setSaved(false); }
  }
  async function sync(method: 'GET' | 'PUT' | 'DELETE', id?: string) {
    setAccountBusy(true);
    setAccountError(false);
    const base = '/api/assistant/bundle/saved';
    const listUrl = `${base}?kit=${encodeURIComponent(kit.id)}`;
    try {
      if (method !== 'GET') {
        const response = await fetch(method === 'DELETE' ? `${base}?id=${encodeURIComponent(id ?? '')}` : base, {
          method, headers: { 'Content-Type': 'application/json' },
          ...(method === 'PUT' ? { body: JSON.stringify({ kitId: kit.id, name, selections: kit.items.map((_, index) => slots[index]?.selected?.externalId ?? restoreIds?.[index] ?? null) }) } : {}),
        });
        if (!response.ok) throw new Error('Bundle could not be saved');
      }
      const result = await fetch(listUrl, { cache: 'no-store' });
      if (!result.ok) throw new Error('Bundles unavailable');
      setAccountBundles(await result.json());
    } catch {
      setAccountError(true);
    } finally {
      setAccountBusy(false);
    }
  }
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
      let restored: Offer | undefined;
      try {
        const ids: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (Array.isArray(ids)) restored = products.find(offer => offer.externalId === ids[index]);
      } catch { /* The current catalog options remain available. */ }
      const accountOffer = products.find(offer => offer.externalId === restoreIds?.[index]);
      update(index, { offers: products, busy: false, selected: slots[index]?.selected ?? (restoreIds ? accountOffer : restored) });
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
            <strong dir="auto" className="text-sm capitalize">{item} <span className="chip bg-brand-soft text-brand">{optionalItems.has(item) ? controls[1] : controls[0]}</span></strong>
            <button type="button" className="btn btn-ghost min-h-9 px-3 py-1" onClick={() => void load(index)} disabled={slot?.busy}>{slot?.busy ? '…' : search}</button>
          </div>
          {!!slot?.offers?.length && <label className="text-xs text-mute">
            {select}
            <select className="input mt-1" value={slot.selected?.externalId ?? ''} onChange={event => {
              update(index, { selected: slot.offers?.find(offer => offer.externalId === event.target.value) });
              setRestoreIds(ids => ids?.map((id, i) => i === index ? null : id) ?? null);
            }}>
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
      <p className="text-mute">{controls[6]} <bdi>{missingRequired}</bdi></p>
      {socketStatus && <p className="font-semibold">{socketStatus}</p>}
      {summary.overBudget && <p className="font-semibold text-bad">{over}</p>}
    </div>
    <p className="mt-2 text-xs text-mute">{disclosure}</p><button type="button" className="btn btn-ghost mt-3" onClick={save}>{controls[2]}</button>{saved && <p role="status" className="mt-1 text-xs text-ok">{controls[3]}</p>}
    {accountSaving && <div className="mt-4 space-y-2 border-t border-line pt-4">
      <label className="block text-sm">Bundle name<input className="input mt-1" value={name} maxLength={80} onChange={event => setName(event.target.value)} /></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={accountBusy || !name.trim()} onClick={() => void sync('PUT')}>Save to account</button>
        <button type="button" className="btn btn-ghost" disabled={accountBusy} onClick={() => void sync('GET')}>Load saved bundles</button>
      </div>
      {accountError && <p role="alert" className="text-sm text-bad">{t('assistant.somethingWrong')}</p>}
      {accountBundles?.length === 0 && <p className="text-sm text-mute">No saved bundles.</p>}
      {accountBundles?.map(bundle => <div className="flex flex-wrap items-center gap-2" key={bundle.id}>
        <button type="button" className="btn btn-ghost" disabled={accountBusy} onClick={() => {
          setRestoreIds(bundle.selections); setName(bundle.name); setSlots({});
        }}>{bundle.name}</button>
        <button type="button" className="btn btn-ghost" disabled={accountBusy} onClick={() => {
          if (window.confirm(`Delete ${bundle.name}?`)) void sync('DELETE', bundle.id);
        }}>Delete</button>
      </div>)}
      {restoreIds && <p className="text-xs text-mute">Search each component to resolve its saved offer at the current price.</p>}
    </div>}
  </section>;
}
