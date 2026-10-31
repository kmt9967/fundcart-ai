'use client';

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

export function LedgerGrid({ rows }: { rows: Row[] }) {
  return (
    <div className="mt-4 h-80 w-full">
      <AgGridReact<Row> theme={theme} rowData={rows} columnDefs={cols} defaultColDef={{ sortable: true, filter: true, resizable: true }} pagination paginationAutoPageSize overlayNoRowsTemplate="No payments yet" />
    </div>
  );
}
