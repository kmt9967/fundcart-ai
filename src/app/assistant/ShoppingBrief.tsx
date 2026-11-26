'use client';

import type { FormEvent } from 'react';
import { useLocale, useT } from '@/i18n/client';
import type { BriefPatch } from '@/lib/shopping/brief';
import type { SessionState } from '@/lib/shopping/types';
import { toCents } from '@/lib/money';

const labels = {
  en: ['Shopping Brief', 'Category', 'Intended use', 'Maximum budget', 'Currency', 'Minimum RAM (GB)', 'Excluded brands', 'Apply and update results', 'Optional preferences'],
  ur: ['خریداری کی ضروریات', 'زمرہ', 'مقصد', 'زیادہ سے زیادہ بجٹ', 'کرنسی', 'کم از کم ریم (GB)', 'خارج کردہ برانڈز', 'نتائج اپ ڈیٹ کریں', 'اختیاری ترجیحات'],
  es: ['Ficha de compra', 'Categoría', 'Uso previsto', 'Presupuesto máximo', 'Moneda', 'RAM mínima (GB)', 'Marcas excluidas', 'Aplicar y actualizar', 'Preferencias opcionales'],
  fr: ['Critères d’achat', 'Catégorie', 'Usage prévu', 'Budget maximal', 'Devise', 'RAM minimale (Go)', 'Marques exclues', 'Appliquer et actualiser', 'Préférences facultatives'],
} as const;
const currencies = ['USD', 'PKR', 'EUR', 'GBP', 'CAD', 'AUD'] as const;
type BriefState = Pick<SessionState, 'category' | 'goal' | 'budget' | 'stated' | 'brandsExclude' | 'softPreferences'>;

export function ShoppingBrief({ state, busy, onApply }: { state: BriefState; busy: boolean; onApply: (patch: BriefPatch) => void }) {
  const [title, category, goal, budget, currency, ram, brands, apply, preferences] = labels[useLocale()];
  const t = useT();
  const initialBudget = state.budget?.maxCents != null ? (state.budget.maxCents / 100).toFixed(2) : '';
  const initialCurrency = currencies.find(code => code === state.budget?.currency) ?? (state.budget ? '' : 'USD');
  const initialRam = String(state.stated?.find(c => c.field === 'ram_gb' && c.op === '>=')?.value ?? '');
  const initialBrands = state.brandsExclude.join(', ');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const amount = String(fields.get('budget') ?? '');
    const selected = currencies.find(code => code === fields.get('currency'));
    const minimum = String(fields.get('ram') ?? '');
    const excluded = String(fields.get('brands') ?? '');
    const patch: BriefPatch = {};
    if (amount !== initialBudget || (selected && selected !== initialCurrency && amount)) {
      if (amount && !selected) {
        const control = event.currentTarget.elements.namedItem('currency');
        if (control instanceof HTMLSelectElement) control.focus();
        return;
      }
      patch.budget = amount && selected ? { amountMinor: toCents(amount), currency: selected } : null;
    }
    if (minimum !== initialRam) patch.ramGb = minimum ? Number(minimum) : null;
    if (excluded !== initialBrands) patch.excludedBrands = excluded.split(',').map(brand => brand.trim()).filter(Boolean);
    if (Object.keys(patch).length) onApply(patch);
  }
  return (
    <section className="card p-5" aria-labelledby="shopping-brief-title">
      <h2 className="font-bold" id="shopping-brief-title">{title}</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div><dt className="text-mute">{category}</dt><dd dir="auto">{state.category === 'unknown' ? t('assistant.notListed') : state.category}</dd></div>
        <div><dt className="text-mute">{goal}</dt><dd className="wrap-anywhere" dir="auto">{state.goal || t('assistant.notListed')}</dd></div>
        {!!state.softPreferences?.length && <div><dt className="text-mute">{preferences}</dt><dd dir="auto">{state.softPreferences.join(', ')}</dd></div>}
      </dl>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
          <label className="text-xs font-semibold">{budget}<input className="input mt-1" type="text" inputMode="decimal" name="budget" pattern="[0-9]{1,7}([.][0-9]{1,2})?" defaultValue={initialBudget} dir="ltr" /></label>
          <label className="text-xs font-semibold">{currency}<select className="input mt-1 px-2" name="currency" defaultValue={initialCurrency}><option value="">—</option>{currencies.map(code => <option key={code}>{code}</option>)}</select></label>
        </div>
        <label className="block text-xs font-semibold">{ram}<input className="input mt-1" name="ram" type="number" min={1} max={512} defaultValue={initialRam} /></label>
        <label className="block text-xs font-semibold">{brands}<input className="input mt-1" name="brands" maxLength={240} defaultValue={initialBrands} dir="auto" /></label>
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy ? '…' : apply}</button>
      </form>
    </section>
  );
}
