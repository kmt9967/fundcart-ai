import { Fragment } from 'react';

/** Render a translation string that may contain <b>…</b> (the only markup allowed; everything else is text). */
export function Rich({ text, boldClass = 'font-bold' }: { text: string; boldClass?: string }) {
  const parts = text.split(/(<b>.*?<\/b>)/g);
  return <>{parts.map((p, i) => p.startsWith('<b>') ? <strong key={i} className={boldClass}>{p.slice(3, -4)}</strong> : <Fragment key={i}>{p}</Fragment>)}</>;
}
