'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { useLocale } from '@/i18n/client';

type Recognition = {
  processLocally?: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

const copy = {
  en: ['Dictate locally', 'Cancel dictation', 'On-device dictation is unavailable. Type your request instead.', 'Listening on this device…'],
  ur: ['آلے پر بول کر لکھیں', 'ڈکٹیشن منسوخ کریں', 'آلے پر ڈکٹیشن دستیاب نہیں۔ اپنی درخواست لکھیں۔', 'اس آلے پر سن رہا ہے…'],
  es: ['Dictar en el dispositivo', 'Cancelar dictado', 'El dictado local no está disponible. Escribe tu solicitud.', 'Escuchando en este dispositivo…'],
  fr: ['Dicter sur cet appareil', 'Annuler la dictée', 'La dictée locale est indisponible. Saisissez votre demande.', 'Écoute sur cet appareil…'],
} as const;

export function VoiceInput({ onText, disabled }: { onText: (text: string) => void; disabled: boolean }) {
  const locale = useLocale();
  const [start, cancel, unavailable, listening] = copy[locale];
  const active = useRef<Recognition | null>(null);
  const [status, setStatus] = useState<'idle' | 'listening' | 'unavailable'>('idle');
  useEffect(() => () => {
    const recognition = active.current;
    active.current = null;
    recognition?.abort();
  }, []);

  function toggle() {
    if (active.current) {
      const recognition = active.current;
      active.current = null;
      recognition.abort();
      setStatus('idle');
      return;
    }
    const BrowserRecognition = (window as Window & { SpeechRecognition?: new () => Recognition }).SpeechRecognition;
    try {
      const recognition = BrowserRecognition ? new BrowserRecognition() : null;
      if (!recognition || !('processLocally' in recognition)) {
        setStatus('unavailable');
        return;
      }
      recognition.processLocally = true;
      recognition.lang = { en: 'en-US', ur: 'ur-PK', es: 'es-ES', fr: 'fr-FR' }[locale];
      recognition.onresult = event => {
        const text = event.results[0]?.[0]?.transcript.trim();
        if (active.current === recognition && text) onText(text);
      };
      recognition.onerror = () => {
        if (active.current !== recognition) return;
        active.current = null;
        setStatus('unavailable');
      };
      recognition.onend = () => {
        if (active.current !== recognition) return;
        active.current = null;
        setStatus('idle');
      };
      active.current = recognition;
      recognition.start();
      setStatus('listening');
    } catch {
      active.current = null;
      setStatus('unavailable');
    }
  }

  return <div className="mt-2 flex flex-wrap items-center gap-2">
    <button type="button" className="btn btn-ghost min-h-11 gap-2" aria-pressed={status === 'listening'} onClick={toggle}
      disabled={disabled && status !== 'listening'}><Mic className="size-4" aria-hidden />{status === 'listening' ? cancel : start}</button>
    <span role="status" className="text-xs text-mute">{status === 'listening' ? listening : status === 'unavailable' ? unavailable : ''}</span>
  </div>;
}
