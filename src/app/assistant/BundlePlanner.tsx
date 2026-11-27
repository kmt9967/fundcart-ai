'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormat, useLocale, useT } from '@/i18n/client';
import { bundleTotal, componentMatch } from '@/lib/shopping/bundle';

type Offer = { externalId: string; title: string; priceCents: number | null; merchantDomain: string | null; socket?: string | null; memoryGeneration?: string | null };
type CustomSlot = { label: string; required: boolean; offerId: string | null };
type Selection = string | null | CustomSlot;
type Slot = { offers?: Offer[]; selected?: Offer; busy?: boolean; error?: boolean };
const copy = {
  en: ['Bundle planner', 'Find options', 'Select an item', 'Known item total', 'Items without prices', 'Over budget', 'Compatibility, shipping and tax are unconfirmed. Each item can be reviewed separately.', 'No catalog items found'],
  ur: ['بنڈل پلانر', 'آپشنز تلاش کریں', 'آئٹم منتخب کریں', 'معلوم قیمتوں کا مجموعہ', 'بغیر قیمت کی اشیا', 'بجٹ سے زیادہ', 'مطابقت، شپنگ اور ٹیکس کی تصدیق نہیں۔ ہر آئٹم الگ دیکھیں۔', 'کیٹلاگ میں کوئی آئٹم نہیں ملا'],
  es: ['Planificador de paquetes', 'Buscar opciones', 'Seleccionar artículo', 'Total conocido', 'Artículos sin precio', 'Supera el presupuesto', 'Compatibilidad, envío e impuestos sin confirmar. Revisa cada artículo por separado.', 'No se encontraron artículos'],
  fr: ['Composer un ensemble', 'Chercher des options', 'Choisir un article', 'Total connu', 'Articles sans prix', 'Budget dépassé', 'Compatibilité, livraison et taxes à confirmer. Chaque article peut être examiné séparément.', 'Aucun article trouvé'],
} as const;

const editor = {
  en: { component: 'Custom component', label: 'Component name', add: 'Add component', remove: 'Remove', device: 'Load from this device', name: 'Bundle name', save: 'Save to account', load: 'Load saved bundles', empty: 'No saved bundles.', removeBundle: 'Delete', restore: 'Search each component to resolve its saved offer at the current price.', socket: 'CPU socket compatibility unknown.', ram: ['RAM and motherboard list the same memory generation.', 'RAM and motherboard list different memory generations.', 'RAM generation compatibility unknown.'] },
  ur: { component: 'حسب ضرورت جزو', label: 'جزو کا نام', add: 'جزو شامل کریں', remove: 'ہٹائیں', device: 'اس آلے سے لوڈ کریں', name: 'بنڈل کا نام', save: 'اکاؤنٹ میں محفوظ کریں', load: 'محفوظ بنڈل لوڈ کریں', empty: 'کوئی بنڈل محفوظ نہیں۔', removeBundle: 'حذف کریں', restore: 'محفوظ آئٹم کی موجودہ قیمت کے لیے ہر جزو تلاش کریں۔', socket: 'سی پی یو ساکٹ کی مطابقت نامعلوم ہے۔', ram: ['ریم اور مدربورڈ کی میموری نسل ایک ہی ہے۔', 'ریم اور مدربورڈ کی میموری نسل مختلف ہے۔', 'ریم کی نسل کی مطابقت نامعلوم ہے۔'] },
  es: { component: 'Componente personalizado', label: 'Nombre del componente', add: 'Añadir componente', remove: 'Quitar', device: 'Cargar desde este dispositivo', name: 'Nombre del paquete', save: 'Guardar en la cuenta', load: 'Cargar paquetes guardados', empty: 'No hay paquetes guardados.', removeBundle: 'Eliminar', restore: 'Busca cada componente para consultar el precio actual de su oferta guardada.', socket: 'Compatibilidad del zócalo de CPU desconocida.', ram: ['La RAM y la placa indican la misma generación de memoria.', 'La RAM y la placa indican generaciones de memoria distintas.', 'Compatibilidad de la generación de RAM desconocida.'] },
  fr: { component: 'Composant personnalisé', label: 'Nom du composant', add: 'Ajouter un composant', remove: 'Retirer', device: 'Charger depuis cet appareil', name: 'Nom de l’ensemble', save: 'Enregistrer dans le compte', load: 'Charger les ensembles enregistrés', empty: 'Aucun ensemble enregistré.', removeBundle: 'Supprimer', restore: 'Recherchez chaque composant pour consulter le prix actuel de son offre enregistrée.', socket: 'Compatibilité du socket du processeur inconnue.', ram: ['La RAM et la carte mère indiquent la même génération de mémoire.', 'La RAM et la carte mère indiquent des générations différentes.', 'Compatibilité de la génération de RAM inconnue.'] },
} as const;

export function BundlePlanner({ kit, budgetCents, accountSaving = false }: { kit: { id: string; title: string; items: string[] }; budgetCents: number | null; accountSaving?: boolean }) {
  const t = useT();
  const f = useFormat();
  const [title, search, select, total, missing, over, disclosure, empty] = copy[useLocale()];
  const locale = useLocale();
  const words = editor[locale];
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
  const [accountBundles, setAccountBundles] = useState<{ id: string; name: string; selections: Selection[] }[] | null>(null);
  const [restoreIds, setRestoreIds] = useState<(string | null)[] | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState(false);
  const [slots, setSlots] = useState<Record<number, Slot>>({});
  const [customSlots, setCustomSlots] = useState<CustomSlot[]>([]);
  const [customName, setCustomName] = useState('');
  const [required, setRequired] = useState(true);
  const components = [...kit.items.map(label => ({ label, required: !optionalItems.has(label) })), ...customSlots];
  const searching = Object.values(slots).some(slot => slot.busy);
  const summary = bundleTotal(components.map((_, index) => slots[index]?.selected).filter(offer => offer != null).map(offer => offer.priceCents), budgetCents);
  const missingRequired = components.filter((component, index) => component.required && !slots[index]?.selected).length;
  function selections(): Selection[] {
    return components.map((_, index) => {
      const offerId = slots[index]?.selected?.externalId ?? restoreIds?.[index] ?? null;
      const custom = customSlots[index - kit.items.length];
      return custom ? { ...custom, offerId } : offerId;
    });
  }
  function reopen(items: Selection[]) {
    setCustomSlots(items.slice(kit.items.length).filter((item): item is CustomSlot => !!item && typeof item === 'object'));
    setRestoreIds(items.map(item => item && typeof item === 'object' ? item.offerId : item));
    setSlots({});
  }
  function customize(index: number, patch: Partial<CustomSlot>) {
    setCustomSlots(previous => previous.map((slot, i) => i + kit.items.length === index ? { ...slot, ...patch } : slot));
  }
  function removeCustom(index: number) {
    setCustomSlots(previous => previous.filter((_, i) => i + kit.items.length !== index));
    setRestoreIds(previous => previous?.filter((_, i) => i !== index) ?? null);
    setSlots(previous => Object.fromEntries(Object.entries(previous).filter(([i]) => Number(i) !== index)
      .map(([i, value]) => [Number(i) > index ? Number(i) - 1 : Number(i), value])));
  }
  const cpu = slots[0]?.selected?.socket;
  const board = slots[1]?.selected?.socket;
  const socket = componentMatch(cpu, board);
  const memory = componentMatch(slots[1]?.selected?.memoryGeneration, slots[3]?.selected?.memoryGeneration);
  const socketStatus = socket === 'unknown' ? words.socket : socket === 'compatible' ? controls[4] : controls[5];
  const memoryStatus = words.ram[memory === 'compatible' ? 0 : memory === 'incompatible' ? 1 : 2];
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(selections()));
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
          ...(method === 'PUT' ? { body: JSON.stringify({ kitId: kit.id, name, selections: selections() }) } : {}),
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
        body: JSON.stringify({ kit: kit.id, component: index, custom: customSlots[index - kit.items.length]?.label }),
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
      {components.map(({ label: item, required: mandatory }, index) => {
        const slot = slots[index];
        return <li key={index} className="grid gap-2 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong dir="auto" className="text-sm capitalize">{item} <span className="chip bg-brand-soft text-brand">{mandatory ? controls[0] : controls[1]}</span></strong>
            <button type="button" className="btn btn-ghost min-h-9 px-3 py-1" onClick={() => void load(index)} disabled={slot?.busy || !item.trim()}>{slot?.busy ? '…' : search}</button>
          </div>
          {index >= kit.items.length && <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-xs">{words.label}
              <input className="input mt-1" value={item} maxLength={64} disabled={searching} onChange={event => customize(index, { label: event.target.value })} />
            </label>
            <label className="check min-h-11 text-sm"><input type="checkbox" checked={mandatory} onChange={event => customize(index, { required: event.target.checked })} />{controls[0]}</label>
            <button className="btn btn-ghost" type="button" disabled={searching} onClick={() => removeCustom(index)}>{words.remove} {item}</button>
          </div>}
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
    {components.length < 12 && <div className="mb-3 grid gap-2 border-t border-line pt-3">
      <label className="text-sm">{words.component}<input className="input mt-1" maxLength={64} value={customName} onChange={event => setCustomName(event.target.value)} /></label>
      <label className="check text-sm"><input type="checkbox" checked={required} onChange={event => setRequired(event.target.checked)} />{controls[0]}</label>
      <button type="button" className="btn btn-ghost justify-self-start" disabled={!customName.trim()} onClick={() => {
        setCustomSlots(previous => [...previous, { label: customName.trim(), required, offerId: null }]);
        setCustomName('');
      }}>{words.add}</button>
    </div>}
    <div aria-live="polite"  className="border-t border-line pt-3 text-sm">
      <p className="font-bold">{total} <bdi>{f.usd(summary.totalCents)}</bdi></p>
      <p className="text-mute">{missing} <bdi>{summary.unquoted}</bdi></p>
      <p className="text-mute">{controls[6]} <bdi>{missingRequired}</bdi></p>
      {kit.id === 'pc_build' && <div className="font-semibold"><p>{socketStatus}</p><p>{memoryStatus}</p></div>}
      {summary.overBudget && <p className="font-semibold text-bad">{over}</p>}
    </div>
    <p className="mt-2 text-xs text-mute">{disclosure}</p><button type="button" className="btn btn-ghost mt-3" onClick={save}>{controls[2]}</button>
    <button type="button" className="btn btn-ghost mt-3 ms-2" disabled={searching} onClick={() => {
      try {
        const items = JSON.parse(localStorage.getItem(key) ?? 'null') as Selection[] | null;
        if (Array.isArray(items) && items.length >= kit.items.length && items.length <= 12) reopen(items);
      } catch { /* Invalid device data is ignored. */ }
    }}>{words.device}</button>{saved && <p role="status" className="mt-1 text-xs text-ok">{controls[3]}</p>}
    {accountSaving && <div className="mt-4 space-y-2 border-t border-line pt-4">
      <label className="block text-sm">{words.name}<input className="input mt-1" value={name} maxLength={80} onChange={event => setName(event.target.value)} /></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={accountBusy || searching || !name.trim() || customSlots.some(slot => !slot.label.trim())} onClick={() => void sync('PUT')}>{words.save}</button>
        <button type="button" className="btn btn-ghost" disabled={accountBusy} onClick={() => void sync('GET')}>{words.load}</button>
      </div>
      {accountError && <p role="alert" className="text-sm text-bad">{t('assistant.somethingWrong')}</p>}
      {accountBundles?.length === 0 && <p className="text-sm text-mute">{words.empty}</p>}
      {accountBundles?.map(bundle => <div className="flex flex-wrap items-center gap-2" key={bundle.id}>
        <button type="button" className="btn btn-ghost" disabled={accountBusy || searching} onClick={() => {
          reopen(bundle.selections); setName(bundle.name);
        }}>{bundle.name}</button>
        <button type="button" className="btn btn-ghost" disabled={accountBusy} onClick={() => {
          if (window.confirm(`${words.removeBundle} ${bundle.name}?`)) void sync('DELETE', bundle.id);
        }}>{words.removeBundle}</button>
      </div>)}
      {restoreIds && <p className="text-xs text-mute">{words.restore}</p>}
    </div>}
  </section>;
}
