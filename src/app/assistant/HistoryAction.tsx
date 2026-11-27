'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useT } from '@/i18n/client';

const copy = {
  en: ['Save result set', 'Remove from history', 'Saved', 'Remove this result set and comparison from your shopping history?'],
  ur: ['نتائج محفوظ کریں', 'تاریخ سے ہٹائیں', 'محفوظ', 'یہ نتائج اور موازنہ خریداری کی تاریخ سے ہٹائیں؟'],
  es: ['Guardar resultados', 'Quitar del historial', 'Guardados', '¿Quitar estos resultados y la comparación del historial?'],
  fr: ['Enregistrer les résultats', 'Retirer de l’historique', 'Enregistrés', 'Retirer ces résultats et cette comparaison de l’historique ?'],
};

export function HistoryAction({ id, compare, initialName = '' }: { id: string; compare?: string[]; initialName?: string }) {
  const [save, remove, saved, confirmText] = copy[useLocale()];
  const t = useT();
  const router = useRouter();
  const locale = useLocale();
  const [threadLabel, threadConfirm, nameLabel, removedLabel] = {
    en: ['Delete conversation', 'Delete all turns and saved results in this conversation?', 'Result set name', 'Removed'],
    ur: ['گفتگو حذف کریں', 'اس گفتگو کے تمام نتائج حذف کریں؟', 'نتائج کا نام', 'حذف ہو گیا'],
    es: ['Eliminar conversación', '¿Eliminar todos los turnos y los resultados guardados?', 'Nombre de los resultados', 'Eliminado'],
    fr: ['Supprimer la conversation', 'Supprimer tous les échanges et résultats enregistrés ?', 'Nom des résultats', 'Supprimé'],
  }[locale];
  const [name, setName] = useState(initialName);
  const [state, setState] = useState<'ready' | 'busy' | 'saved' | 'removed' | 'failed'>('ready');
  async function submit(thread = false) {
    if (!compare && !window.confirm(thread ? threadConfirm : confirmText)) return;
    setState('busy');
    const response = await fetch(`/api/assistant/history/${encodeURIComponent(id)}${thread ? '?scope=thread' : ''}`, compare
      ? { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ compare, name: name.trim() || undefined }) }
      : { method: 'DELETE' }).catch(() => null);
    setState(response?.ok ? compare ? 'saved' : 'removed' : 'failed');
    if (response?.ok) router.refresh();
  }
  return <div>
    {compare && <input aria-label={nameLabel} placeholder={nameLabel} value={name} maxLength={80} onChange={event => setName(event.target.value)} className="input mb-2 max-w-xs" />}
    {!compare && <button type="button" className="btn btn-ghost min-h-9 me-2" disabled={state === 'busy'} onClick={() => void submit(true)}>{threadLabel}</button>}
    <button type="button" className="btn btn-ghost min-h-9" disabled={state === 'busy'} onClick={() => void submit()}>{compare ? save : remove}</button>
    {state === 'saved' && <p role="status" className="mt-1 text-xs text-ok">{saved}</p>}
    {state === 'removed' && <p role="status" className="mt-1 text-xs text-ok">{removedLabel}</p>}
    {state === 'failed' && <p role="status" className="mt-1 text-xs text-bad">{t('assistant.somethingWrong')}</p>}
  </div>;
}
