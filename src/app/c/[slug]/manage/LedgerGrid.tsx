'use client';

import { useState, useSyncExternalStore } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from 'ag-grid-community';
import { useFormat, useT } from '@/i18n/client';

ModuleRegistry.registerModules([AllCommunityModule]);

type Row = { created: string; kind: string; amount: number; status: string; supporter: string; orderId: string; captureId: string; captureStatus: string };

const theme = themeQuartz.withParams({ accentColor: '#5b3df5', fontFamily: 'inherit', headerFontWeight: 700, borderRadius: 10, wrapperBorderRadius: 12, fontSize: 13 });

type T = ReturnType<typeof useT>;
const makeCols = (t: T, usd: (c: number) => string, date: (s: string) => string): ColDef<Row>[] => [
  { field: 'created', headerName: t('lg.time'), sort: 'desc', width: 170, valueFormatter: p => date(p.value) },
  { field: 'kind', headerName: t('lg.type'), width: 120 },
  { field: 'supporter', headerName: t('lg.from'), flex: 1, minWidth: 120 },
  { field: 'amount', headerName: t('lg.amount'), width: 110, type: 'numericColumn', valueFormatter: p => usd(p.value) },
  { field: 'status', headerName: t('lg.order'), width: 120 },
  { field: 'captureStatus', headerName: t('lg.capture'), width: 120, cellStyle: p => ({ color: p.value === 'COMPLETED' ? '#0e9563' : '#6b7194', fontWeight: 700 }) },
  { field: 'orderId', headerName: t('lg.paypalOrder'), width: 190 },
  { field: 'captureId', headerName: t('lg.captureId'), width: 190 },
];

const mq = '(max-width: 767px)';
const subscribe = (cb: () => void) => { const m = window.matchMedia(mq); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); };

/** Payment ledger: AG Grid table on tablets/desktop; readable cards by default on phones (table still available). */
export function LedgerGrid({ rows }: { rows: Row[] }) {
  const t = useT(); const f = useFormat();
  const formatUSD = f.usd;
  const cols = makeCols(t, f.usd, f.date);
  const rtl = useSyncExternalStore(subscribe, () => document.documentElement.dir === 'rtl', () => false);
  const isPhone = useSyncExternalStore(subscribe, () => window.matchMedia(mq).matches, () => false);
  const [choice, setChoice] = useState<'cards' | 'grid' | null>(null);
  const view = choice ?? (isPhone ? 'cards' : 'grid');
  const sorted = [...rows].sort((a, b) => b.created.localeCompare(a.created));

  return (
    <div className="mt-3">
      <div className="mb-3 inline-flex rounded-xl border border-line bg-paper p-1 md:hidden" role="group" aria-label={t('lg.view')}>
        {(['cards', 'grid'] as const).map(v => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setChoice(v)}
            className={`min-h-10 rounded-lg px-3 text-xs font-bold ${view === v ? 'bg-white text-brand shadow-sm' : 'text-mute'}`}>{v === 'cards' ? t('lg.cards') : t('lg.table')}</button>
        ))}
      </div>
      {view === 'cards' ? (
        rows.length === 0 ? <p className="rounded-xl bg-paper p-4 text-sm text-mute">{t('lg.none')}</p> : (
          <ul className="space-y-2.5" aria-label={t('lg.payments')}>
            {sorted.map(r => (
              <li key={r.orderId} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold capitalize">{r.kind} <span className="font-normal normal-case text-mute">· {r.supporter}</span></p>
                    <p className="text-xs text-mute">{f.date(r.created)}</p>
                  </div>
                  <p className="shrink-0 text-base font-extrabold">{formatUSD(r.amount)}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="chip bg-paper text-ink-2">{t('lg.order')}: {r.status}</span>
                  <span className={`chip ${r.captureStatus === 'COMPLETED' ? 'bg-ok-soft text-ok' : 'bg-paper text-mute'}`}>{t('lg.capture')}: {r.captureStatus || '—'}</span>
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                  <dt className="text-mute">{t('lg.paypalOrder')}</dt><dd className="break-all font-mono" dir="ltr">{r.orderId}</dd>
                  {r.captureId && <><dt className="text-mute">{t('lg.captureId')}</dt><dd className="break-all font-mono" dir="ltr">{r.captureId}</dd></>}
                </dl>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="h-80 w-full">
          <AgGridReact<Row> theme={theme} rowData={rows} columnDefs={cols} defaultColDef={{ sortable: true, filter: true, resizable: true }} pagination paginationAutoPageSize overlayNoRowsTemplate={t('lg.none')} enableRtl={rtl} />
        </div>
      )}
    </div>
  );
}
