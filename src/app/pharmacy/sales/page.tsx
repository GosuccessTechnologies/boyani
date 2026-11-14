'use client';

/**
 * PHARMACY SALES HISTORY — DataTable (saleNo, receiptNo, patientName,
 * totalAmount, paymentMethod, billToVisit, createdAt) + view receipt (modal +
 * print). Role scoping (API-enforced): PHARMACIST sees own TODAY sales only
 * (scope OWN_TODAY); ADMIN gets ALL_HISTORY with date-range + search filters.
 */

import * as React from 'react';
import { ReceiptText, RefreshCw, Pill, Loader2, Stethoscope, Search, CalendarRange, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiGet } from '@/lib/client-api';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { kes, fmtDateTime, PosNav, StatusBadge, MethodBadge, BoolPill, McInput } from '@/app/pos/_lib';
import { SaleReceiptModal, type Sale } from '../_sale-receipt';
import { PharmacyHeroHeader } from '../_hero-header';

interface SalesResponse {
  sales: Sale[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  scope: 'OWN_TODAY' | 'ALL_HISTORY';
}

const NAV = [
  { label: 'Dispensing', href: '/pharmacy', icon: <Pill className="h-3.5 w-3.5" /> },
  { label: 'Prescriptions', href: '/pharmacy/prescriptions', icon: <ReceiptText className="h-3.5 w-3.5" /> },
  { label: 'Sales History', href: '/pharmacy/sales', icon: <Stethoscope className="h-3.5 w-3.5" /> },
];

export default function PharmacySalesPage() {
  const [data, setData] = React.useState<SalesResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [viewSale, setViewSale] = React.useState<Sale | null>(null);

  // admin filters (ALL_HISTORY only)
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ section: 'sales', page: String(page) });
      if (search) params.set('search', search);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      setData(await apiGet<SalesResponse>(`/api/pharmacy-pos?${params}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load sales history');
    } finally {
      setLoading(false);
    }
  }, [page, search, dateFrom, dateTo]);

  React.useEffect(() => { load(); }, [load]);

  const scope = data?.scope;
  const isAdminHistory = scope === 'ALL_HISTORY';

  const columns: Column<Sale>[] = [
    { key: 'saleNo', header: 'Sale No', defaultVisible: true, render: r => <span className="font-semibold">{r.saleNo}</span> },
    { key: 'patientName', header: 'Patient', defaultVisible: true, render: r => r.patientName || 'Walk-in Customer' },
    {
      key: 'totalAmount', header: 'Total', defaultVisible: true, align: 'right',
      render: r => <span className="font-bold text-[var(--mc-primary)]">{kes(r.totalAmount)}</span>,
      csvValue: r => r.totalAmount,
    },
    { key: 'paymentMethod', header: 'Method', defaultVisible: true, render: r => <MethodBadge method={r.paymentMethod} /> },
    { key: 'receiptNo', header: 'Receipt No', render: r => r.receiptNo || '—' },
    { key: 'billToVisit', header: 'Bill to Visit', render: r => <BoolPill value={r.billToVisit} trueLabel="Billed" falseLabel="Counter" />, csvValue: r => (r.billToVisit ? 'BILLED' : 'COUNTER') },
    { key: 'paymentStatus', header: 'Status', render: r => <StatusBadge status={r.paymentStatus} /> },
    { key: 'createdAt', header: 'Date', render: r => fmtDateTime(r.createdAt), csvValue: r => r.createdAt },
  ];

  const actions: ActionBtn[] = [
    {
      icon: <Eye className="h-3.5 w-3.5" />, title: 'View receipt', variant: 'view',
      onClick: (row: Sale) => setViewSale(row),
    },
    {
      icon: <ReceiptText className="h-3.5 w-3.5" />, title: 'Print receipt', variant: 'print',
      onClick: (row: Sale) => setViewSale(row),
    },
  ];

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* ── Shared pharmacy hero header ── */}
      <PharmacyHeroHeader
        icon={<Stethoscope className="h-5 w-5" />}
        title="Pharmacy Sales History"
        description="View and print completed pharmacy sale receipts — admin can filter by date range or search"
      />

      <div className="p-3 lg:p-4 space-y-4 flex-1 overflow-auto">
      <div className="flex flex-wrap items-center gap-3">
        <PosNav items={NAV} />
        <div className="flex-1" />
        {scope && <StatusBadge status={scope} />}
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => load()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
        </Button>
      </div>

      {/* Admin-only filter bar (rendered conditionally on scope) */}
      {isAdminHistory && (
        <div className="rounded-xl border border-[var(--mc-divider)] bg-white p-3 flex flex-wrap items-end gap-2.5 no-print">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <McInput
              className="pl-8"
              placeholder="Search sale / receipt No / patient…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <CalendarRange className="h-4 w-4 text-[var(--mc-primary)]" />
            <McInput type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
            <span className="text-muted-foreground">to</span>
            <McInput type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
          </div>
          {(dateFrom || dateTo || search) && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => { setDateFrom(''); setDateTo(''); setSearchInput(''); setPage(1); }}>
              Clear filters
            </Button>
          )}
        </div>
      )}

      <DataTable<Sale>
        data={data?.sales || []}
        columns={columns}
        actions={actions}
        rowKey={r => r.id}
        loading={loading}
        moduleLabel="pharmacy-sales"
        title="Pharmacy Sales"
        emptyMessage={isAdminHistory ? 'No sales match the filters' : 'No sales recorded by you today'}
        page={data?.page || 1}
        perPage={data?.perPage || 20}
        total={data?.total}
        onPageChange={p => setPage(p)}
      />

      <SaleReceiptModal sale={viewSale} onOpenChange={o => !o && setViewSale(null)} />
      </div>
    </div>
  );
}
