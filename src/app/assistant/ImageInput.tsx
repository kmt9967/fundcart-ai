'use client';

import { useId, useState } from 'react';
import { useLocale } from '@/i18n/client';

const copy = {
  en: ['Search with a product photo', 'Choose a JPEG, PNG or WebP product photo under 5 MB. The resized image goes to Gemini for a search suggestion. Crop people and private details first.', 'Suggest search terms', 'Analyzing image…', 'Image analysis unavailable. Try another image or type your request.', 'Suggested terms are a visual guess. Review them before searching.'],
  ur: ['مصنوعات کی تصویر سے تلاش', '۵ ایم بی سے کم JPEG، PNG یا WebP تصویر منتخب کریں۔ تلاش کی تجویز کے لیے چھوٹی تصویر Gemini کو بھیجی جاتی ہے۔ افراد اور نجی تفصیلات ہٹا دیں۔', 'تلاش کے الفاظ تجویز کریں', 'تصویر کا جائزہ ہو رہا ہے…', 'تصویر کا جائزہ دستیاب نہیں۔ دوسری تصویر آزمائیں یا درخواست لکھیں۔', 'تجویز کردہ الفاظ بصری اندازہ ہیں۔ تلاش سے پہلے ان کا جائزہ لیں۔'],
  es: ['Buscar con una foto del producto', 'Elige una foto JPEG, PNG o WebP de menos de 5 MB. Se envía una versión reducida a Gemini para sugerir una búsqueda. Recorta personas y datos privados.', 'Sugerir términos de búsqueda', 'Analizando imagen…', 'Análisis no disponible. Prueba otra imagen o escribe la solicitud.', 'La sugerencia es una estimación visual. Revísala antes de buscar.'],
  fr: ['Rechercher avec une photo du produit', 'Choisissez une photo JPEG, PNG ou WebP de moins de 5 Mo. Une version réduite est envoyée à Gemini pour suggérer une recherche. Recadrez les personnes et les données privées.', 'Suggérer des termes de recherche', 'Analyse de l’image…', 'Analyse indisponible. Essayez une autre image ou saisissez votre demande.', 'La suggestion est une estimation visuelle. Relisez-la avant de rechercher.'],
} as const;

export function ImageInput({ onText, disabled }: { onText: (text: string) => void; disabled: boolean }) {
  const [label, disclosure, action, pending, failed, ready] = copy[useLocale()];
  const inputId = useId();
  const [fileVersion, setFileVersion] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'failed' | 'ready'>('idle');

  async function analyze() {
    if (!file || state === 'busy') return;
    setState('busy');
    try {
      if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error();
      const bitmap = await createImageBitmap(file, { resizeWidth: 768, resizeQuality: 'medium' });
      const canvas = document.createElement('canvas');
      try {
        const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error();
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      } finally { bitmap.close(); }
      const body = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.78));
      if (!body || body.size > 512 * 1024) throw new Error();
      const res = await fetch('/api/assistant/image', { method: 'POST', body, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error();
      const { query } = await res.json();
      if (typeof query !== 'string' || !query.trim()) throw new Error();
      onText(query.slice(0, 120));
      setState('ready');
    } catch {
      setState('failed');
    } finally {
      setFile(null);
      setFileVersion(version => version + 1);
    }
  }

  return <details className="mt-3 rounded-lg border border-line p-3">
    <summary className="cursor-pointer text-sm font-semibold text-brand">{label}</summary>
    <p className="mt-2 text-xs text-mute" id={`${inputId}-hint`}>{disclosure}</p>
    <input className="input mt-2" id={inputId} type="file" accept="image/jpeg,image/png,image/webp" aria-label={label} aria-describedby={`${inputId}-hint`}
      disabled={state === 'busy' || disabled} key={fileVersion} onChange={event => { setFile(event.target.files?.[0] ?? null); setState('idle'); }} />
    <button type="button" className="btn btn-ghost mt-2" onClick={() => void analyze()} disabled={!file || disabled || state === 'busy'}>{action}</button>
    <p role="status" className="mt-1 text-xs text-mute">{state === 'busy' ? pending : state === 'failed' ? failed : state === 'ready' ? ready : ''}</p>
  </details>;
}
