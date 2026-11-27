'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';

export function SaveProduct({ externalId }: { externalId: string }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  async function save() {
    setState('saving');
    const response = await fetch('/api/wishlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalId }) }).catch(() => null);
    setState(response?.ok ? 'saved' : 'error');
  }
  return <>
    <button className="btn btn-ghost" type="button" onClick={() => void save()} disabled={state === 'saving' || state === 'saved'}>{state === 'saved' ? t('assistant.saved') : t('assistant.save')}</button>
    {state === 'error' && <span role="status" className="self-center text-sm text-bad">{t('assistant.somethingWrong')}</span>}
  </>;
}
