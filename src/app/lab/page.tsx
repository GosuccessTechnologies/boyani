'use client';

/**
 * LAB DASHBOARD — Instruction 24 premium pass.
 * KPI cards (pendingOrders, inProgress, completedToday, totalTests,
 * urgentQueue from /api/dashboard?portal=lab) + live order board fetched
 * from /api/lab-orders (awaiting verification, released reports) + the
 * active priority queue.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  FlaskConical, ClipboardList, TestTube2, CheckCircle2, Siren, ArrowRight, Clock, User,
  ShieldCheck, BadgeCheck, RefreshCw,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDateTime, StatusBadge, PageHeading, SkeletonCards, pname } from '@/app/clinical/_lib';

interface LabKpis {
  pendingOrders: number;
  inProgress: number;
  completedToday: number;
  totalTests: number;
  urgentQueue: number;
}

interface QueueOrder {
  id: string;
  orderNo: string;
  priority: string;
  status: string;
  createdAt: string;
  patient?: { patientNo: string; firstName: string; lastName: string } | null;
  items?: Array<{ id: string; testName: string; status: string }>;
}

interface LabDashboard {
  kpis: LabKpis;
  queue: QueueOrder[];
}

interface OrderRow {
  id: string;
  orderNo: string;
  status: string;
  priority: string;
  createdAt: string;
  patient?: { patientNo: string; firstName: string; lastName: string } | null;
  _count?: { items: number };
}

const QUICK_ACTIONS = [
  { label: 'Open Worklist', href: '/lab/orders', icon: <ClipboardList className="h-4 w-4" />, hint: 'Requests · results · verification' },
  { label: 'Test Catalog', href: '/lab/tests', icon: <FlaskConical className="h-4 w-4" />, hint: 'synced from facility services' },
];

export default function LabDashboardPage() {
  const router = useRouter();
  const [data, setData] = React.useState<LabDashboard | null>(null);
  const [orders, setOrders] = React.useState<OrderRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [dash, ord] = await Promise.all([
        apiGet<LabDashboard>('/api/dashboard?portal=lab'),
        apiGet<{ labOrders: OrderRow[] }>('/api/lab-orders?perPage=100').catch(() => ({ labOrders: [] as OrderRow[] })),
      ]);
      setData(dash);
      setOrders(ord.labOrders || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const k = data?.kpis;
  const awaitingVerify = orders.filter(o => o.status === 'COMPLETED').length;
  const released = orders.filter(o => o.status === 'VERIFIED').length;
  const recentReleased = orders.filter(o => o.status === 'VERIFIED').slice(0, 4);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<FlaskConical className="h-5 w-5" />}
        title="Laboratory Dashboard"
        subtitle="Test worklist, urgent queue, verification pipeline & released reports"
        actions={
          <Button size="sm" variant="outline" className="gap-1" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {loading ? <SkeletonCards count={5} /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard label="Pending Orders" value={k?.pendingOrders ?? 0} icon={<ClipboardList className="h-5 w-5" />} accent="warning" hint="awaiting sample/processing" onClick={() => router.push('/lab/orders')} />
          <StatCard label="In Progress" value={k?.inProgress ?? 0} icon={<TestTube2 className="h-5 w-5" />} accent="secondary" onClick={() => router.push('/lab/orders')} />
          <StatCard label="Awaiting Verification" value={awaitingVerify} icon={<ShieldCheck className="h-5 w-5" />} accent="info" hint="results recorded" onClick={() => router.push('/lab/orders')} />
          <StatCard label="Completed Today" value={k?.completedToday ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" hint="incl. released" />
          <StatCard label="Urgent Queue" value={k?.urgentQueue ?? 0} icon={<Siren className="h-5 w-5" />} accent="danger" hint="URGENT + STAT" onClick={() => router.push('/lab/orders')} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick actions */}
        <div className="space-y-3">
          {QUICK_ACTIONS.map(q => (
            <button
              key={q.href}
              onClick={() => router.push(q.href)}
              className="w-full rounded-xl border bg-white p-4 flex items-center gap-3 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">{q.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--mc-text-primary)]">{q.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{q.hint}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}

          {/* Release pipeline mini-panel */}
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <BadgeCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Release Pipeline</h2>
                <p className="text-[11px] text-muted-foreground">verified reports are printable</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="px-2.5 py-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 font-semibold">{awaitingVerify} awaiting verify</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">{released} released</span>
            </div>
            {recentReleased.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {recentReleased.map(o => (
                  <div key={o.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <BadgeCheck className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-[var(--mc-text-secondary)]">{o.orderNo}</span>
                    <span className="truncate">{pname(o.patient)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Urgent / active queue */}
        <div className="rounded-xl border bg-white overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-3 p-4 border-b border-[var(--mc-divider)]">
            <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
              <Siren className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Active Queue</h2>
              <p className="text-[11px] text-muted-foreground">Pending, sampled and in-progress orders — priority first</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/lab/orders')}>Open worklist</Button>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : !data || data.queue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Queue is clear — no pending lab orders.</p>
          ) : (
            <div className="divide-y divide-[var(--mc-divider)]">
              {data.queue.map(o => (
                <div key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-[var(--mc-primary-light)] transition-colors">
                  <div className="min-w-[160px]">
                    <p className="text-sm font-semibold text-[var(--mc-text-primary)] flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
                      {pname(o.patient)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{o.orderNo}</p>
                  </div>
                  <div className="flex-1 min-w-[180px] text-xs text-[var(--mc-text-secondary)]">
                    {(o.items || []).map(i => i.testName).join(', ') || '—'}
                  </div>
                  <StatusBadge status={o.priority} />
                  <StatusBadge status={o.status} />
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {fmtDateTime(o.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
