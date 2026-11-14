'use client';

/**
 * PROFIT & LOSS ANALYTICS — Instruction 18b interface redesign.
 *
 * Stat hero row (Revenue / Cost of Sales / Gross Profit / Margin % with
 * estimated-basis notes) + month-range picker + revenue-vs-cost AreaChart
 * (BILLED pharmacy revenue labelled 'pending collection') + payment mix donut
 * + department breakdown table with share bars + top services/products table
 * + per-source summaries with costBasis flags + paginated line items DataTable.
 */

import * as React from 'react';
import {
  TrendingUp, Banknote, Wallet, Percent, Building2, Layers,
  Filter, X, Users, CalendarRange, PieChart as PieIcon, Info, Activity,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatCard } from '@/components/shared/StatCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, fmtDate, PageHeading, SkeletonCards, McInput } from '../_lib';

interface PLItem {
  itemName: string; category: string; department: string; quantity: number;
  unitPrice: number; totalRevenue: number; totalCost: number; profit: number;
  margin: number; itemType: string; date: string; cashierId: string | null;
  paymentMethod: string; source: 'CLINICAL' | 'PHARMACY'; refNo: string; patientName: string;
  costBasis: 'SNAPSHOT' | 'DRUG_CURRENT' | 'ESTIMATED' | 'RATIO' | 'NONE';
  pendingCollection: boolean;
}
interface TopItem { name: string; qty: number; revenue: number; profit: number }
interface SourceSummary {
  source: 'CLINICAL' | 'PHARMACY'; revenue: number; cost: number; profit: number;
  margin: number; items: number; pendingCollectionRevenue: number;
  costBasis: Record<string, number>;
}
interface PLResp {
  items: PLItem[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
  summary: {
    totalRevenue: number; totalCost: number; grossProfit: number; grossMargin: number;
    totalItems: number; bestSelling: TopItem | null; highestProfit: TopItem | null;
    serviceCostRatio: number; estimatedRevenue: number; estimatedCost: number;
    ratioRevenue: number; pendingCollectionRevenue: number;
  };
  sourceSummaries: SourceSummary[];
  departmentBreakdown: Array<{ name: string; revenue: number }>;
  categoryBreakdown: Array<{ name: string; revenue: number }>;
  monthlyTrend: Array<{ month: string; revenue: number; cost: number; profit: number; pending: number }>;
  topItems: TopItem[];
  paymentBreakdown: Array<{ method: string; amount: number }>;
}

interface Department { id: string; name: string }
interface UserRow { id: string; username: string; firstName: string; lastName: string }

const PIE_COLORS = ['var(--mc-primary)', 'var(--mc-secondary)', 'var(--mc-tertiary)', 'var(--mc-primary-dark)', '#7c3aed', '#db2777'];

const ITEM_TYPES = ['SERVICE', 'DRUG', 'LAB', 'ADMISSION_BED', 'CONSULTATION'];

const BASIS_LABELS: Record<string, string> = {
  SNAPSHOT: 'purchase cost snapshot',
  DRUG_CURRENT: 'current catalog cost',
  ESTIMATED: 'estimated (55% of price)',
  RATIO: 'service cost ratio',
  NONE: 'no cost recorded',
};

export default function ProfitLossPage() {
  const [data, setData] = React.useState<PLResp | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [cashiers, setCashiers] = React.useState<UserRow[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [monthFrom, setMonthFrom] = React.useState('');
  const [monthTo, setMonthTo] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [itemType, setItemType] = React.useState('');
  const [source, setSource] = React.useState('');
  const [cashier, setCashier] = React.useState('');
  const [page, setPage] = React.useState(1);

  // 12-month window (labels match the API's monthlyTrend: 'Sep 25' style)
  const trendWindow = React.useMemo(() => {
    const arr: Array<{ label: string; first: string; last: string }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      arr.push({ label, first: `${d.getFullYear()}-${mm}-01`, last: `${d.getFullYear()}-${mm}-${lastDay}` });
    }
    return arr;
  }, []);

  const buildQuery = React.useCallback((p: number) => {
    const params = new URLSearchParams({ page: String(p), perPage: '50' });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (department) params.set('department', department);
    if (category.trim()) params.set('category', category.trim());
    if (itemType) params.set('itemType', itemType);
    if (source) params.set('source', source);
    if (cashier) params.set('cashier', cashier);
    return params.toString();
  }, [dateFrom, dateTo, department, category, itemType, source, cashier]);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<PLResp>(`/api/profit-loss?${buildQuery(p)}`);
      setData(res);
      setPage(res.pagination?.page || p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to compute profit & loss');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  React.useEffect(() => {
    load(1);
    apiGet<{ departments: Department[] }>('/api/departments')
      .then(r => setDepartments(r.departments || []))
      .catch(() => {});
    apiGet<{ users: UserRow[] }>('/api/users?role=CASHIER&perPage=100')
      .then(r => setCashiers(r.users || []))
      .catch(() => {});
  }, [load]);

  // Month-range picker → dateFrom / dateTo month boundaries
  const applyMonthRange = (from: string, to: string) => {
    setMonthFrom(from); setMonthTo(to);
    if (!from && !to) { setDateFrom(''); setDateTo(''); return; }
    let a = from || to; // single bound → that one month
    let b = to || from;
    let ia = trendWindow.findIndex(w => w.label === a);
    let ib = trendWindow.findIndex(w => w.label === b);
    if (ia > ib) [ia, ib] = [ib, ia];
    setDateFrom(trendWindow[ia].first);
    setDateTo(trendWindow[ib].last);
  };

  const resetFilters = () => {
    setDateFrom(''); setDateTo(''); setMonthFrom(''); setMonthTo('');
    setDepartment(''); setCategory(''); setItemType(''); setSource(''); setCashier('');
  };

  const s = data?.summary;

  // Trend chart sliced to the selected month range
  const trendData = React.useMemo(() => {
    if (!data) return [];
    const ia = monthFrom ? trendWindow.findIndex(w => w.label === monthFrom) : 0;
    const ib = monthTo ? trendWindow.findIndex(w => w.label === monthTo) : trendWindow.length - 1;
    const lo = Math.max(0, ia === -1 ? 0 : ia);
    const hi = Math.min(trendWindow.length - 1, ib === -1 ? trendWindow.length - 1 : ib);
    return data.monthlyTrend.slice(Math.min(lo, hi), Math.max(lo, hi) + 1);
  }, [data, monthFrom, monthTo, trendWindow]);

  const hasPending = trendData.some(t => (t.pending || 0) > 0);
  const paymentTotal = (data?.paymentBreakdown || []).reduce((sum, p) => sum + p.amount, 0);
  const maxDeptRevenue = Math.max(...(data?.departmentBreakdown || []).map(d => d.revenue), 1);
  const estimatedShare = s && s.totalRevenue > 0 ? (s.estimatedRevenue / s.totalRevenue) * 100 : 0;

  const itemColumns: Column<PLItem>[] = [
    { key: 'itemName', header: 'Item', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {r.itemName}
        {r.pendingCollection && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 align-middle">PENDING COLLECTION</span>}
      </span>
    ) },
    { key: 'totalRevenue', header: 'Revenue', defaultVisible: true, align: 'right', render: r => <span className="font-semibold">{kes(r.totalRevenue)}</span>, csvValue: r => r.totalRevenue },
    { key: 'profit', header: 'Profit', defaultVisible: true, align: 'right', render: r => <span className={r.profit >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-red-600'}>{kes(r.profit)}</span>, csvValue: r => r.profit },
    { key: 'source', header: 'Source', defaultVisible: true, render: r => <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]">{r.source}</span> },
    { key: 'date', header: 'Date', render: r => fmtDate(r.date), csvValue: r => (r.date ? r.date.slice(0, 10) : '') },
    { key: 'department', header: 'Department' },
    { key: 'category', header: 'Category' },
    { key: 'itemType', header: 'Item Type' },
    { key: 'quantity', header: 'Qty', align: 'right', csvValue: r => r.quantity },
    { key: 'unitPrice', header: 'Unit Price', align: 'right', render: r => kes(r.unitPrice), csvValue: r => r.unitPrice },
    { key: 'totalCost', header: 'Cost', align: 'right', render: r => kes(r.totalCost), csvValue: r => r.totalCost },
    { key: 'costBasis', header: 'Cost Basis', render: r => <span className="text-xs text-[var(--mc-text-secondary)]" title={BASIS_LABELS[r.costBasis]}>{BASIS_LABELS[r.costBasis]}</span>, csvValue: r => r.costBasis },
    { key: 'margin', header: 'Margin %', align: 'right', render: r => `${r.margin.toFixed(1)}%`, csvValue: r => r.margin },
    { key: 'paymentMethod', header: 'Payment' },
    { key: 'refNo', header: 'Ref No.' },
    { key: 'patientName', header: 'Patient / Customer' },
  ];

  const topColumns: Column<TopItem>[] = [
    { key: 'name', header: 'Service / Product', defaultVisible: true, render: r => <span className="font-semibold text-[var(--mc-text-primary)]">{r.name}</span> },
    { key: 'qty', header: 'Units Sold', defaultVisible: true, align: 'right', csvValue: r => r.qty },
    { key: 'revenue', header: 'Revenue', defaultVisible: true, align: 'right', render: r => kes(r.revenue), csvValue: r => r.revenue },
    { key: 'profit', header: 'Profit', defaultVisible: true, align: 'right', render: r => <span className="font-semibold text-emerald-600">{kes(r.profit)}</span>, csvValue: r => r.profit },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<TrendingUp className="h-5 w-5" />}
        title="Profit & Loss Analytics"
        subtitle="Departmental revenue, cost & margin across clinical billing and pharmacy sales"
      />

      {/* Filter bar with month-range picker */}
      <div className="rounded-xl border bg-white p-3 no-print">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[var(--mc-text-secondary)]">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
          <Select value={monthFrom || 'all'} onValueChange={v => applyMonthRange(v === 'all' ? '' : v, monthTo)}>
            <SelectTrigger className="mc-input h-9 w-full" title="Month range — from"><SelectValue placeholder="All time (from)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time (from)</SelectItem>
              {trendWindow.map(w => <SelectItem key={`f-${w.label}`} value={w.label}>{w.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={monthTo || 'all'} onValueChange={v => applyMonthRange(monthFrom, v === 'all' ? '' : v)}>
            <SelectTrigger className="mc-input h-9 w-full" title="Month range — to"><SelectValue placeholder="All time (to)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time (to)</SelectItem>
              {trendWindow.map(w => <SelectItem key={`t-${w.label}`} value={w.label}>{w.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={department || 'all'} onValueChange={v => setDepartment(v === 'all' ? '' : v)}>
            <SelectTrigger className="mc-input h-9 w-full"><SelectValue placeholder="All departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              <SelectItem value="Clinical">Clinical</SelectItem>
              <SelectItem value="Pharmacy">Pharmacy</SelectItem>
              {departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <McInput placeholder="Category (e.g. LABORATORY)" value={category} onChange={e => setCategory(e.target.value)} />
          <Select value={itemType || 'all'} onValueChange={v => setItemType(v === 'all' ? '' : v)}>
            <SelectTrigger className="mc-input h-9 w-full"><SelectValue placeholder="All item types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All item types</SelectItem>
              {ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t.replaceAll('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={source || 'all'} onValueChange={v => setSource(v === 'all' ? '' : v)}>
            <SelectTrigger className="mc-input h-9 w-full"><SelectValue placeholder="All sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="CLINICAL">CLINICAL</SelectItem>
              <SelectItem value="PHARMACY">PHARMACY</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cashier || 'all'} onValueChange={v => setCashier(v === 'all' ? '' : v)}>
            <SelectTrigger className="mc-input h-9 w-full"><SelectValue placeholder="All cashiers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cashiers</SelectItem>
              {cashiers.map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.username})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Button size="sm" className="gap-1" onClick={() => load(1)}><Filter className="h-3.5 w-3.5" /> Apply Filters</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={resetFilters}><X className="h-3.5 w-3.5" /> Reset</Button>
          {(monthFrom || monthTo || department || category || itemType || source || cashier) && (
            <span className="text-[11px] text-muted-foreground">
              Filters active{monthFrom || monthTo ? ` · ${monthFrom || trendWindow[0].label} → ${monthTo || trendWindow[trendWindow.length - 1].label}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Stat hero row */}
      {loading && !data ? <SkeletonCards count={4} /> : s ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Revenue" value={kes(s.totalRevenue)} icon={<Banknote className="h-5 w-5" />} accent="primary"
              hint={`${s.totalItems.toLocaleString('en-KE')} units sold${s.pendingCollectionRevenue > 0 ? ` · incl. ${kes(s.pendingCollectionRevenue)} pending collection` : ''}`}
            />
            <StatCard
              label="Cost of Sales" value={kes(s.totalCost)} icon={<Wallet className="h-5 w-5" />} accent="secondary"
              hint={s.estimatedRevenue > 0
                ? `${estimatedShare.toFixed(0)}% of revenue on estimated basis`
                : `services @ ${Math.round(s.serviceCostRatio * 100)}% cost ratio`}
            />
            <StatCard
              label="Gross Profit" value={kes(s.grossProfit)} icon={<TrendingUp className="h-5 w-5" />} accent="success"
              hint={s.highestProfit ? `top: ${s.highestProfit.name}` : undefined}
            />
            <StatCard
              label="Margin %" value={`${s.grossMargin.toFixed(1)}%`} icon={<Percent className="h-5 w-5" />} accent="tertiary"
              hint={s.bestSelling ? `best seller: ${s.bestSelling.name}` : undefined}
            />
          </div>
          {/* Estimated-basis note */}
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground px-1">
            <Info className="h-3.5 w-3.5 shrink-0 mt-px text-[var(--mc-primary)]" />
            {s.estimatedRevenue > 0 ? (
              <>Cost basis: services &amp; labs at {Math.round(s.serviceCostRatio * 100)}% of revenue (pl_service_cost_ratio), drug costs from purchase snapshots — <b>{kes(s.estimatedRevenue)}</b> of revenue uses the estimated 55%-of-price fallback.</>
            ) : (
              <>Cost basis: services &amp; labs at {Math.round(s.serviceCostRatio * 100)}% of revenue (pl_service_cost_ratio); drug costs from purchase snapshots / current catalog costs. BILLED pharmacy revenue is labelled &quot;pending collection&quot;.</>
            )}
          </p>
        </div>
      ) : null}

      {/* Charts */}
      {data && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Revenue vs cost trend */}
          <div className="rounded-xl border mc-chart-panel p-4">
            <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-1 flex items-center gap-1.5"><CalendarRange className="h-4 w-4" /> Revenue vs Cost Trend</h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              {monthFrom || monthTo ? `${monthFrom || trendWindow[0].label} → ${monthTo || trendWindow[trendWindow.length - 1].label}` : 'last 12 months'} (KSh){hasPending ? ' — dashed line = pending collection' : ''}
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={{ top: 5, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="plRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--mc-primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--mc-primary)" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="plCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--mc-secondary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--mc-secondary)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mc-divider)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--mc-text-secondary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--mc-text-secondary)' }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => kes(v)} contentStyle={{ borderRadius: 12, borderColor: 'var(--mc-divider)', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--mc-primary)" strokeWidth={2.5} fill="url(#plRev)" />
                <Area type="monotone" dataKey="cost" name="Cost of Sales" stroke="var(--mc-secondary)" strokeWidth={2.5} fill="url(#plCost)" />
                {hasPending && (
                  <Area type="monotone" dataKey="pending" name="Pending collection (BILLED)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" fill="transparent" connectNulls />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Payment mix donut */}
          <div className="rounded-xl border mc-chart-panel-alt p-4">
            <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-1 flex items-center gap-1.5"><PieIcon className="h-4 w-4" /> Payment Mix</h2>
            <p className="text-[11px] text-muted-foreground mb-3">revenue by payment method (KSh)</p>
            {data.paymentBreakdown.length ? (
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={data.paymentBreakdown} dataKey="amount" nameKey="method" cx="50%" cy="50%" innerRadius={58} outerRadius={95} paddingAngle={3}>
                      {data.paymentBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => kes(v)} contentStyle={{ borderRadius: 12, borderColor: 'var(--mc-divider)', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full sm:w-44 space-y-1.5 shrink-0">
                  {data.paymentBreakdown.map((p, i) => (
                    <div key={p.method} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="font-semibold text-[var(--mc-text-primary)] flex-1 truncate">{p.method}</span>
                      <span className="text-muted-foreground">{paymentTotal > 0 ? `${Math.round((p.amount / paymentTotal) * 100)}%` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-16 text-center">No payment data for this filter.</p>
            )}
          </div>
        </div>
      )}

      {/* Department breakdown table with bars + per-source summaries */}
      {data && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-white p-4 lg:col-span-2">
            <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-3 flex items-center gap-1.5"><Building2 className="h-4 w-4" /> Department Breakdown</h2>
            {data.departmentBreakdown.length ? (
              <div className="space-y-2.5">
                {data.departmentBreakdown.map(d => {
                  const share = data.summary.totalRevenue > 0 ? (d.revenue / data.summary.totalRevenue) * 100 : 0;
                  return (
                    <div key={d.name} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[var(--mc-text-primary)] truncate">{d.name}</span>
                        <span className="shrink-0">
                          <b>{kes(d.revenue)}</b>
                          <span className="text-muted-foreground ml-1.5">{share.toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] overflow-hidden">
                        <div
                          className="h-full rounded-full mc-gradient-primary"
                          style={{ width: `${Math.max(2, (d.revenue / maxDeptRevenue) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No department data for this filter.</p>
            )}
          </div>

          {/* Per-source summaries with costBasis flags */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-3 flex items-center gap-1.5"><Layers className="h-4 w-4" /> Source Summaries</h2>
            <div className="space-y-3">
              {data.sourceSummaries.map(src => (
                <div key={src.source} className="rounded-xl border border-[var(--mc-divider)] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]">{src.source}</span>
                    <span className="text-[11px] text-muted-foreground">{src.items} line(s)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Revenue</span><span className="text-right font-semibold">{kes(src.revenue)}</span>
                    <span className="text-muted-foreground">Cost</span><span className="text-right font-semibold">{kes(src.cost)}</span>
                    <span className="text-muted-foreground">Profit</span><span className="text-right font-semibold text-emerald-600">{kes(src.profit)}</span>
                    <span className="text-muted-foreground">Margin</span><span className="text-right font-semibold">{src.margin.toFixed(1)}%</span>
                    {src.pendingCollectionRevenue > 0 && (
                      <>
                        <span className="text-muted-foreground">Pending</span>
                        <span className="text-right font-semibold text-amber-600">{kes(src.pendingCollectionRevenue)}</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {Object.entries(src.costBasis).map(([basis, count]) => (
                      <span key={basis} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] text-[var(--mc-text-secondary)]" title={BASIS_LABELS[basis] || basis}>
                        {count}× {basis.replaceAll('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top services & products */}
      {data && data.topItems.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-3 flex items-center gap-1.5"><Users className="h-4 w-4" /> Top 10 Services &amp; Products by Profit</h2>
          <DataTable
            data={data.topItems} columns={topColumns}
            rowKey={r => r.name} title="Top Services & Products" moduleLabel="Top Services & Products"
          />
        </div>
      )}

      {/* Items table */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-3 flex items-center gap-1.5">
          <Activity className="h-4 w-4" /> Line Items — {data?.pagination.total ?? 0} record(s)
        </h2>
        <DataTable
          data={data?.items || []} columns={itemColumns}
          rowKey={r => `${r.source}-${r.refNo}-${r.itemName}-${r.date}`}
          title="P&L Line Items" moduleLabel="Profit & Loss Items"
          loading={loading}
          page={data?.pagination.page || 1}
          perPage={data?.pagination.perPage || 50}
          total={data?.pagination.total}
          onPageChange={p => load(p)}
        />
      </div>
    </div>
  );
}
