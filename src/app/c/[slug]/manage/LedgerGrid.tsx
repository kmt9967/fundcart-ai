'use client';

import { useState, useSyncExternalStore } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from 'ag-grid-community';
import { formatUSD } from '@/lib/money';

ModuleRegistry.registerModules([AllCommunityModule]);

type Row = { created: string; kind: string; amount: number; status: string; supporter: string; orderId: string; captureId: string; captureStatus: string };

const theme = themeQuartz.withParams({ accentColor: '#5b3df5', fontFamily: 'inherit', headerFontWeight: 700, borderRadius: 10, wrapperBorderRadius: 12, fontSize: 13 });

const cols: ColDef<Row>[] = [
  { field: 'created', headerName: 'Time', sort: 'desc', width: 170, valueFormatter: p => new Date(p.value).toLocaleString() },
  { field: 'kind', headerName: 'Type', width: 120 },
  { field: 'supporter', headerName: 'From', flex: 1, minWidth: 120 },
  { field: 'amount', headerName: 'Amount', width: 110, type: 'numericColumn', valueFormatter: p => formatUSD(p.value) },
  { field: 'status', headerName: 'Order', width: 120 },
  { field: 'captureStatus', headerName: 'Capture', width: 120, cellStyle: p => ({ color: p.value === 'COMPLETED' ? '#0e9563' : '#6b7194', fontWeight: 700 }) },
  { field: 'orderId', headerName: 'PayPal order', width: 190 },
  { field: 'captureId', headerName: 'Capture ID', width: 190 },
];

const mq = '(max-width: 767px)';
const subscribe = (cb: () => void) => { const m = window.matchMedia(mq); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); };

/** Payment ledger: AG Grid table on tablets/desktop; readable cards by default on phones (table still available). */
export function LedgerGrid({ rows }: { rows: Row[] }) {
  const isPhone = useSyncExternalStore(subscribe, () => window.matchMedia(mq).matches, () => false);
  const [choice, setChoice] = useState<'cards' | 'grid' | null>(null);
  const view = choice ?? (isPhone ? 'cards' : 'grid');
  const sorted = [...rows].sort((a, b) => b.created.localeCompare(a.created));

  return (
    <div className="mt-3">
      <div className="mb-3 inline-flex rounded-xl border border-line bg-paper p-1 md:hidden" role="group" aria-label="Ledger view">
        {(['cards', 'grid'] as const).map(v => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setChoice(v)}
            className={`min-h-10 rounded-lg px-3 text-xs font-bold ${view === v ? 'bg-white text-brand shadow-sm' : 'text-mute'}`}>{v === 'cards' ? 'Cards' : 'Table (AG Grid)'}</button>
        ))}
      </div>
      {view === 'cards' ? (
        rows.length === 0 ? <p className="rounded-xl bg-paper p-4 text-sm text-mute">No payments yet.</p> : (
          <ul className="space-y-2.5" aria-label="Payments">
            {sorted.map(r => (
              <li key={r.orderId} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold capitalize">{r.kind} <span className="font-normal normal-case text-mute">· {r.supporter}</span></p>
                    <p className="text-xs text-mute">{new Date(r.created).toLocaleString()}</p>
                  </div>
                  <p className="shrink-0 text-base font-extrabold">{formatUSD(r.amount)}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="chip bg-paper text-ink-2">Order: {r.status}</span>
                  <span className={`chip ${r.captureStatus === 'COMPLETED' ? 'bg-ok-soft text-ok' : 'bg-paper text-mute'}`}>Capture: {r.captureStatus || '—'}</span>
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                  <dt className="text-mute">PayPal order</dt><dd className="break-all font-mono">{r.orderId}</dd>
                  {r.captureId && <><dt className="text-mute">Capture ID</dt><dd className="break-all font-mono">{r.captureId}</dd></>}
                </dl>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="h-80 w-full">
          <AgGridReact<Row> theme={theme} rowData={rows} columnDefs={cols} defaultColDef={{ sortable: true, filter: true, resizable: true }} pagination paginationAutoPageSize overlayNoRowsTemplate="No payments yet" />
        </div>
      )}
    </div>
  );
}
