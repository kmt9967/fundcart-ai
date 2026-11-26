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

export function HistoryAction({ id, compare }: { id: string; compare?: string[] }) {
  const [save, remove, saved, confirmText] = copy[useLocale()];
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<'ready' | 'busy' | 'saved' | 'failed'>('ready');
  async function submit() {
    if (!compare && !window.confirm(confirmText)) return;
    setState('busy');
    const response = await fetch(`/api/assistant/history/${encodeURIComponent(id)}`, compare
      ? { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ compare }) }
      : { method: 'DELETE' }).catch(() => null);
    setState(response?.ok ? compare ? 'saved' : 'ready' : 'failed');
    if (response?.ok) router.refresh();
  }
  return <div>
    <button type="button" className="btn btn-ghost min-h-9" disabled={state === 'busy'} onClick={() => void submit()}>{compare ? save : remove}</button>
    {state === 'saved' && <p role="status" className="mt-1 text-xs text-ok">{saved}</p>}
    {state === 'failed' && <p role="status" className="mt-1 text-xs text-bad">{t('assistant.somethingWrong')}</p>}
  </div>;
}
