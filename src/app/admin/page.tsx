'use client';

/**
 * FACILITY DASHBOARD — KPI StatCards + revenue trend line chart +
 * department revenue bar chart + quick links.
 * Data: GET /api/dashboard?portal=facility
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Stethoscope, BedDouble, Banknote, CalendarRange, CalendarClock,
  Pill, ReceiptText, IdCard, Briefcase, Inbox, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend,
} from 'recharts';
import { StatCard } from '@/components/shared/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, PageHeading } from './_lib';

interface DashboardData {
  kpis: {
    totalPatients: number; todayVisits: number; activeAdmissions: number;
    todayRevenue: number; weekRevenue: number; pendingAppointments: number;
    lowStockDrugs: number; unpaidBillsAmount: number; totalStaff: number;
    newApplications: number; unresolvedInquiries: number;
  };
  revenueTrend: Array<{ day: string; revenue: number }>;
  departmentBreakdown: Array<{ name: string; revenue: number }>;
}

const QUICK_LINKS = [
  { label: 'Services & Pricing', href: '/admin/services', icon: <Stethoscope className="h-4 w-4" /> },
  { label: 'Drug Catalog', href: '/admin/drugs', icon: <Pill className="h-4 w-4" /> },
  { label: 'Wards & Beds', href: '/admin/wards', icon: <BedDouble className="h-4 w-4" /> },
  { label: 'Staff Shifts', href: '/admin/shifts', icon: <CalendarClock className="h-4 w-4" /> },
  { label: 'Employees', href: '/admin/employees', icon: <IdCard className="h-4 w-4" /> },
  { label: 'Quotations', href: '/admin/quotations', icon: <ReceiptText className="h-4 w-4" /> },
  { label: 'Profit & Loss', href: '/admin/profit-loss', icon: <Banknote className="h-4 w-4" /> },
  { label: 'Facility Settings', href: '/admin/company', icon: <Briefcase className="h-4 w-4" /> },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiGet<DashboardData>('/api/dashboard?portal=facility');
        if (alive) setData(res);
      } catch (e) {
        if (alive) toast.error(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">
        Dashboard data unavailable.
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="space-y-5">
      <PageHeading
        icon={<Users className="h-5 w-5" />}
        title="Facility Overview"
        subtitle="Live hospital-wide KPIs — patients, revenue, admissions, staff & alerts"
      />

      {/* KPI StatCards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <StatCard label="Total Patients" value={k.totalPatients.toLocaleString('en-KE')} icon={<Users className="h-5 w-5" />} accent="primary" hint="active registrations" />
        <StatCard label="Today's Visits" value={k.todayVisits} icon={<Stethoscope className="h-5 w-5" />} accent="secondary" hint="encounters opened today" />
        <StatCard label="Active Admissions" value={k.activeAdmissions} icon={<BedDouble className="h-5 w-5" />} accent="tertiary" hint="inpatients on ward" />
        <StatCard label="Today's Revenue" value={kes(k.todayRevenue)} icon={<Banknote className="h-5 w-5" />} accent="success" hint="paid bills" />
        <StatCard label="Week Revenue" value={kes(k.weekRevenue)} icon={<CalendarRange className="h-5 w-5" />} accent="success" hint="last 7 days" />
        <StatCard label="Pending Appointments" value={k.pendingAppointments} icon={<CalendarClock className="h-5 w-5" />} accent="warning" hint="awaiting confirmation" />
        <StatCard label="Low-stock Drugs" value={k.lowStockDrugs} icon={<Pill className="h-5 w-5" />} accent="danger" hint="at or below reorder" />
        <StatCard label="Unpaid Bills" value={kes(k.unpaidBillsAmount)} icon={<ReceiptText className="h-5 w-5" />} accent="danger" hint="outstanding balances" />
        <StatCard label="Total Staff" value={k.totalStaff} icon={<IdCard className="h-5 w-5" />} accent="primary" hint="active employees" />
        <StatCard label="New Applications" value={k.newApplications} icon={<Briefcase className="h-5 w-5" />} accent="secondary" hint="awaiting review" />
        <StatCard label="Unresolved Inquiries" value={k.unresolvedInquiries} icon={<Inbox className="h-5 w-5" />} accent="warning" hint="website contact messages" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-1">Revenue Trend — last 7 days</h2>
          <p className="text-[11px] text-muted-foreground mb-3">Paid bills per day (KSh)</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.revenueTrend} margin={{ top: 5, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mc-divider)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--mc-text-secondary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--mc-text-secondary)' }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => [kes(v), 'Revenue']} contentStyle={{ borderRadius: 12, borderColor: 'var(--mc-divider)', fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--mc-primary)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--mc-primary)' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-1">Department Revenue — last 30 days</h2>
          <p className="text-[11px] text-muted-foreground mb-3">Paid bill items by department (KSh)</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.departmentBreakdown} margin={{ top: 5, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mc-divider)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--mc-text-secondary)' }} interval={0} angle={-18} textAnchor="end" height={52} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--mc-text-secondary)' }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => [kes(v), 'Revenue']} contentStyle={{ borderRadius: 12, borderColor: 'var(--mc-divider)', fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="var(--mc-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick links */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-3">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {QUICK_LINKS.map(l => (
            <button
              key={l.href}
              onClick={() => router.push(l.href)}
              className="group flex items-center gap-2 rounded-lg border border-[var(--mc-divider)] px-3 py-2.5 text-left text-xs font-semibold text-[var(--mc-text-secondary)] hover:border-[var(--mc-primary)] hover:bg-[var(--mc-primary-light)] hover:text-[var(--mc-primary-dark)] transition-colors"
            >
              <span className="text-[var(--mc-primary)]">{l.icon}</span>
              <span className="flex-1 truncate">{l.label}</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
