'use client';

/**
 * HR DASHBOARD — KPIs from /api/dashboard?portal=hr + quick links.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, IdCard, UserCheck, BriefcaseBusiness, FileStack, Banknote, CalendarX2,
  ArrowRight, Users, CalendarClock,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/client-api';
import { PageHeading } from '@/app/ops/_lib';

interface HrKpis {
  totalEmployees: number;
  activeEmployees: number;
  openPositions: number;
  applications: number;
  pendingPayrolls: number;
  onLeaveToday: number;
}

const QUICK_LINKS = [
  { href: '/hr/employees', label: 'Employee Registry', icon: <IdCard className="h-4 w-4" />, hint: 'Staff master file' },
  { href: '/hr/jobs', label: 'Job Postings', icon: <BriefcaseBusiness className="h-4 w-4" />, hint: 'Public careers page' },
  { href: '/hr/applications', label: 'Applications', icon: <FileStack className="h-4 w-4" />, hint: 'Recruitment pipeline' },
  { href: '/hr/payroll', label: 'Payroll', icon: <Banknote className="h-4 w-4" />, hint: 'Generate & approve' },
  { href: '/hr/shifts', label: 'Shift Roster', icon: <CalendarClock className="h-4 w-4" />, hint: 'Assign duties' },
  { href: '/hr/attendance', label: 'Attendance Review', icon: <Users className="h-4 w-4" />, hint: 'Correct records' },
];

export default function HrDashboardPage() {
  const router = useRouter();
  const [kpis, setKpis] = React.useState<HrKpis | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiGet<{ kpis: HrKpis }>('/api/dashboard?portal=hr');
        if (alive) setKpis(res.kpis);
      } catch {
        // toast spam avoided on dashboards — skeleton clears to zeros
        if (alive) setKpis({ totalEmployees: 0, activeEmployees: 0, openPositions: 0, applications: 0, pendingPayrolls: 0, onLeaveToday: 0 });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<LayoutDashboard className="h-5 w-5" />}
        title="HR Dashboard"
        subtitle="Human resources overview — staff, recruitment, payroll & attendance"
      />

      {loading || !kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="Total Employees" value={kpis.totalEmployees} icon={<IdCard className="h-5 w-5" />} accent="primary" onClick={() => router.push('/hr/employees')} />
          <StatCard label="Active" value={kpis.activeEmployees} icon={<UserCheck className="h-5 w-5" />} accent="success" onClick={() => router.push('/hr/employees')} />
          <StatCard label="Open Positions" value={kpis.openPositions} icon={<BriefcaseBusiness className="h-5 w-5" />} accent="tertiary" hint="public careers" onClick={() => router.push('/hr/jobs')} />
          <StatCard label="Applications" value={kpis.applications} icon={<FileStack className="h-5 w-5" />} accent="secondary" hint="in pipeline" onClick={() => router.push('/hr/applications')} />
          <StatCard label="Pending Payrolls" value={kpis.pendingPayrolls} icon={<Banknote className="h-5 w-5" />} accent="warning" hint="draft" onClick={() => router.push('/hr/payroll')} />
          <StatCard label="On Leave Today" value={kpis.onLeaveToday} icon={<CalendarX2 className="h-5 w-5" />} accent="danger" onClick={() => router.push('/hr/attendance')} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-3">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_LINKS.map(q => (
              <button
                key={q.href}
                onClick={() => router.push(q.href)}
                className="flex items-center gap-3 rounded-lg border border-[var(--mc-divider)] px-3 py-2.5 text-left hover:bg-[var(--mc-primary-light)] transition-colors"
              >
                <span className="h-8 w-8 rounded-lg mc-gradient-primary text-white flex items-center justify-center shrink-0">{q.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--mc-text-primary)] truncate">{q.label}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">{q.hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-3">Kenyan Statutory Deductions</h2>
          <ul className="space-y-2 text-sm text-[var(--mc-text-secondary)]">
            <li className="flex items-start gap-2"><span className="text-[var(--mc-primary)] font-bold">•</span> PAYE progressive (10% / 25% / 30%) with KSh 2,400 personal relief — configured under Settings</li>
            <li className="flex items-start gap-2"><span className="text-[var(--mc-primary)] font-bold">•</span> NSSF — 6% of basic salary capped at KSh 1,080</li>
            <li className="flex items-start gap-2"><span className="text-[var(--mc-primary)] font-bold">•</span> SHIF — tiered on gross pay (KSh 150 – 1,700)</li>
            <li className="flex items-start gap-2"><span className="text-[var(--mc-primary)] font-bold">•</span> Affordable Housing Levy — 1.5% of gross pay</li>
          </ul>
          <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => router.push('/hr/settings')}>
            <Banknote className="h-4 w-4" /> Manage Salary Configs
          </Button>
        </div>
      </div>
    </div>
  );
}
