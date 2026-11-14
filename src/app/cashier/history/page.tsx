'use client';

/**
 * CASHIER COLLECTIONS HISTORY — DataTable of payments (paymentNo, billNo,
 * patient, amount, method, createdAt) + date filters + summary cards
 * (totalCash / totalMpesa / totalSha). Receipt view action loads
 * GET /api/pos?tab=receipt&billId= into the printable receipt modal.
 */

import * as React from 'react';
import { History, RefreshCw, Coins, Loader2, Search, Eye, CalendarRange, Banknote, Smartphone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiGet } from '@/lib/client-api';
import { StatCard } from '@/components/shared/StatCard';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { kes, fmtDateTime, pname, PosNav, MethodBadge, McInput, PageHeading } from '@/app/pos/_lib';
import { BillReceiptModal, type Bill } from '../_bill-receipt';
import { CashierHeroHeader } from '../_hero-header';

interface PaymentRow {
  id: string;
  paymentNo: string;
  billNo?: string;
  amount: number;
  method: string;
  shaClaimRef?: string;
  status: string;
  notes?: string;
  createdAt: string;
  bill?: {
    id: string; billNo: string; receiptNo: string;
    patient?: { patientNo: string; firstName: string; lastName: string; paymentMode?: string; shaNumber?: string } | null;
  } | null;
}

interface SalesResponse {
  payments: PaymentRow[];
  summary: { totalCollections: number; totalCash: number; totalMpesa: number; totalSha: number };
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

const NAV = [
  { label: 'Collections', href: '/cashier', icon: <Coins className="h-3.5 w-3.5" /> },
  { label: 'History', href: '/cashier/history', icon: <History className="h-3.5 w-3.5" /> },
];

export default function CashierHistoryPage() {
  const [data, setData] = React.useState<SalesResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);

  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const [viewBill, setViewBill] = React.useState<Bill | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab: 'cashier-sales', page: String(page) });
      if (search) params.set('search', search);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      setData(await apiGet<SalesResponse>(`/api/pos?${params}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load collections history');
    } finally {
      setLoading(false);
    }
  }, [page, search, dateFrom, dateTo]);

  React.useEffect(() => { load(); }, [load]);

  // receipt view: GET /api/pos?tab=receipt&billId=
  const openReceipt = async (row: PaymentRow) => {
    const billId = row.bill?.id;
    if (!billId) { toast.error('No bill attached to this payment'); return; }
    try {
      const res = await apiGet<{ bill: Bill | null }>(`/api/pos?tab=receipt&billId=${encodeURIComponent(billId)}`);
      if (res.bill) setViewBill(res.bill);
      else toast.error('Receipt not found for this payment');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load receipt');
    }
  };

  const s = data?.summary;

  const columns: Column<PaymentRow>[] = [
    { key: 'paymentNo', header: 'Payment No', defaultVisible: true, render: r => <span className="font-semibold">{r.paymentNo}</span> },
    {
      key: 'patient', header: 'Patient', defaultVisible: true,
      render: r => (
        <div className="min-w-0">
          <p className="font-medium truncate">{pname(r.bill?.patient)}</p>
          <p className="text-[11px] text-muted-foreground">{r.bill?.patient?.patientNo || r.bill?.billNo || '—'}</p>
        </div>
      ),
      csvValue: r => pname(r.bill?.patient),
    },
    {
      key: 'amount', header: 'Amount', defaultVisible: true, align: 'right',
      render: r => <span className="font-bold text-[var(--mc-primary)]">{kes(r.amount)}</span>,
      csvValue: r => r.amount,
    },
    { key: 'method', header: 'Method', defaultVisible: true, render: r => <MethodBadge method={r.method} /> },
    { key: 'billNo', header: 'Bill No', render: r => r.bill?.billNo || '—', csvValue: r => r.bill?.billNo || '' },
    { key: 'shaClaimRef', header: 'SHA Claim Ref', render: r => r.shaClaimRef || '—' },
    { key: 'status', header: 'Status', render: r => <span className="text-[11px] font-semibold text-emerald-700">{r.status}</span> },
    { key: 'createdAt', header: 'Date', render: r => fmtDateTime(r.createdAt), csvValue: r => r.createdAt },
  ];

  const actions: ActionBtn[] = [
    {
      icon: <Eye className="h-3.5 w-3.5" />, title: 'View receipt', variant: 'view',
      onClick: (row: PaymentRow) => openReceipt(row),
    },
  ];

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* ── Full-width flat hero header — mirrors the Pharmacy POS header pattern ── */}
      <CashierHeroHeader
        icon={<History className="h-5 w-5" />}
        title="Collections History"
        description="Cashier payment records with method breakdown and printable receipts"
      />

      <div className="p-3 lg:p-4 space-y-4 flex-1 lg:overflow-y-auto">
        <div className="flex flex-wrap items-center gap-3">
          <PosNav items={NAV} />
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
          </Button>
        </div>

        {/* summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Collections" value={s?.totalCollections ?? 0} icon={<History className="h-5 w-5" />} accent="primary" hint="in current filter" />
          <StatCard label="Total Cash" value={kes(s?.totalCash ?? 0)} icon={<Banknote className="h-5 w-5" />} accent="success" />
          <StatCard label="Total M-PESA" value={kes(s?.totalMpesa ?? 0)} icon={<Smartphone className="h-5 w-5" />} accent="danger" />
          <StatCard label="Total SHA" value={kes(s?.totalSha ?? 0)} icon={<ShieldCheck className="h-5 w-5" />} accent="secondary" />
        </div>

        {/* date filters + search */}
        <div className="rounded-xl border border-[var(--mc-divider)] bg-white p-3 flex flex-wrap items-end gap-2.5 no-print">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <McInput
              className="pl-8"
              placeholder="Search payment / receipt No / patient…"
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

        <DataTable<PaymentRow>
          data={data?.payments || []}
          columns={columns}
          actions={actions}
          rowKey={r => r.id}
          loading={loading}
          moduleLabel="cashier-collections"
          title="Collections History"
          emptyMessage="No collections match the filters"
          page={data?.pagination.page || 1}
          perPage={data?.pagination.perPage || 20}
          total={data?.pagination.total}
          onPageChange={p => setPage(p)}
        />

        <BillReceiptModal bill={viewBill} onOpenChange={o => !o && setViewBill(null)} />
      </div>
    </div>
  );
}
