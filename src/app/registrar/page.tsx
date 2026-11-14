'use client';

/**
 * REGISTRAR DASHBOARD — /api/dashboard?portal=registrar
 * KPI cards + quick actions + today's visits mini-table (GET /api/visits).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  UserPlus, CalendarClock, Users, ClipboardList, ReceiptText, ArrowRight,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDateTime, StatusBadge, PageHeading, SkeletonCards, pname } from '@/app/clinical/_lib';

interface RegistrarKpis {
  todayRegistrations: number;
  todayVisits: number;
  totalPatients: number;
  activeVisits: number;
  pendingBills: number;
}

interface VisitRow {
  id: string;
  visitNo: string;
  visitType: string;
  status: string;
  createdAt: string;
  patient?: { patientNo: string; firstName: string; lastName: string; phone?: string } | null;
  _count?: { bills: number; labOrders: number; prescriptions: number };
}

const QUICK_ACTIONS = [
  { label: 'Register New Patient', href: '/registrar/register', icon: <UserPlus className="h-4 w-4" /> },
  { label: 'Manage Visits', href: '/registrar/visits', icon: <CalendarClock className="h-4 w-4" /> },
  { label: 'Patient Registry', href: '/registrar/patients', icon: <Users className="h-4 w-4" /> },
];

export default function RegistrarDashboardPage() {
  const router = useRouter();
  const [kpis, setKpis] = React.useState<RegistrarKpis | null>(null);
  const [todayVisits, setTodayVisits] = React.useState<VisitRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ kpis: RegistrarKpis }>('/api/dashboard?portal=registrar');
        if (!cancelled) setKpis(res.kpis);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load dashboard');
      }
      try {
        const res = await apiGet<{ visits: VisitRow[] }>('/api/visits?perPage=10');
        if (!cancelled) setTodayVisits(res.visits || []);
      } catch {
        // mini-table is non-critical — dashboard KPIs already surface errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const k = kpis;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<UserPlus className="h-5 w-5" />}
        title="Registrar Dashboard"
        subtitle="Front-desk operations — registrations, visits and patient flow"
      />

      {loading ? <SkeletonCards count={5} /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard label="Today's Registrations" value={k?.todayRegistrations ?? 0} icon={<UserPlus className="h-5 w-5" />} accent="primary" hint="new patients today" onClick={() => router.push('/registrar/register')} />
          <StatCard label="Today's Visits" value={k?.todayVisits ?? 0} icon={<CalendarClock className="h-5 w-5" />} accent="secondary" hint="opened visits today" onClick={() => router.push('/registrar/visits')} />
          <StatCard label="Total Patients" value={k?.totalPatients ?? 0} icon={<Users className="h-5 w-5" />} accent="success" hint="active registry" onClick={() => router.push('/registrar/patients')} />
          <StatCard label="Active Visits" value={k?.activeVisits ?? 0} icon={<ClipboardList className="h-5 w-5" />} accent="warning" hint="in the clinical flow" />
          <StatCard label="Unpaid Bills" value={k?.pendingBills ?? 0} icon={<ReceiptText className="h-5 w-5" />} accent="danger" hint="awaiting cashier" />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {QUICK_ACTIONS.map(q => (
          <button
            key={q.href + q.label}
            onClick={() => router.push(q.href)}
            className="rounded-xl border bg-white p-4 flex items-center gap-3 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">{q.icon}</div>
            <span className="text-sm font-semibold text-[var(--mc-text-primary)] flex-1">{q.label}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Today's visits mini-table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-[var(--mc-divider)]">
          <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Latest Visits</h2>
            <p className="text-[11px] text-muted-foreground">Most recently opened patient encounters</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/registrar/visits')}>View all</Button>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : todayVisits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No visits yet today — register a patient to open one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mc-table">
              <thead>
                <tr><th style={{ width: 44 }}>#</th><th>Visit No.</th><th>Patient</th><th>Type</th><th>Charges</th><th>Opened</th><th>Status</th></tr>
              </thead>
              <tbody>
                {todayVisits.map((v, i) => (
                  <tr key={v.id}>
                    <td className="text-muted-foreground">{i + 1}</td>
                    <td className="font-semibold text-[var(--mc-text-primary)] text-sm">{v.visitNo}</td>
                    <td className="text-sm">{pname(v.patient)}</td>
                    <td><span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">{v.visitType}</span></td>
                    <td className="text-xs">
                      {(v._count?.bills ?? 0)} bill(s) · {(v._count?.labOrders ?? 0)} lab · {(v._count?.prescriptions ?? 0)} rx
                    </td>
                    <td className="text-xs whitespace-nowrap">{fmtDateTime(v.createdAt)}</td>
                    <td><StatusBadge status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
