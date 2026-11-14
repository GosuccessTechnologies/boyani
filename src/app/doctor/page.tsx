'use client';

/**
 * DOCTOR DASHBOARD — /api/dashboard?portal=doctor
 * KPI cards (todayAppointments, pendingAppointments, activeConsultations,
 * myPatients, pendingLabForMe) + upcoming appointments list + quick actions.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Stethoscope, CalendarCheck, Clock, FlaskConical, Users, ArrowRight, CalendarClock, FilePlus2,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/client-api';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { fmtDate, StatusBadge, PageHeading, SkeletonCards } from '@/app/clinical/_lib';

interface DashAppointment {
  id: string;
  appointmentNo: string;
  patientName: string;
  patientPhone: string;
  appointmentDate: string;
  timeSlot: string;
  reason: string;
  status: string;
  source: string;
}

interface DoctorDashboard {
  kpis: {
    todayAppointments: number;
    pendingAppointments: number;
    activeConsultations: number;
    myPatients: number;
    pendingLabForMe: number;
  };
  upcoming: DashAppointment[];
}

const QUICK_ACTIONS = [
  { label: 'New Consultation', href: '/doctor/consultations', icon: <Stethoscope className="h-4 w-4" /> },
  { label: 'Write Prescription', href: '/doctor/prescriptions', icon: <FilePlus2 className="h-4 w-4" /> },
  { label: 'My Schedule', href: '/doctor/appointments', icon: <CalendarClock className="h-4 w-4" /> },
  { label: 'Find Patient', href: '/doctor/patients', icon: <Users className="h-4 w-4" /> },
];

export default function DoctorDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [data, setData] = React.useState<DoctorDashboard | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<DoctorDashboard>('/api/dashboard?portal=doctor');
        if (!cancelled) setData(res);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load dashboard');
        if (!cancelled) setData({ kpis: { todayAppointments: 0, pendingAppointments: 0, activeConsultations: 0, myPatients: 0, pendingLabForMe: 0 }, upcoming: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const k = data?.kpis;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Stethoscope className="h-5 w-5" />}
        title={`Welcome, Dr. ${user?.lastName || user?.username || ''}`}
        subtitle="Your clinical day at a glance — appointments, consultations and pending labs"
      />

      {loading ? <SkeletonCards count={5} /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard label="Today's Appointments" value={k?.todayAppointments ?? 0} icon={<CalendarCheck className="h-5 w-5" />} accent="primary" hint="pending, confirmed & checked-in" onClick={() => router.push('/doctor/appointments')} />
          <StatCard label="Pending Requests" value={k?.pendingAppointments ?? 0} icon={<Clock className="h-5 w-5" />} accent="warning" hint="awaiting confirmation" onClick={() => router.push('/doctor/appointments')} />
          <StatCard label="Active Consultations" value={k?.activeConsultations ?? 0} icon={<Stethoscope className="h-5 w-5" />} accent="secondary" hint="in progress" onClick={() => router.push('/doctor/consultations')} />
          <StatCard label="My Patients" value={k?.myPatients ?? 0} icon={<Users className="h-5 w-5" />} accent="success" hint="consulted overall" onClick={() => router.push('/doctor/patients')} />
          <StatCard label="Pending Labs For Me" value={k?.pendingLabForMe ?? 0} icon={<FlaskConical className="h-5 w-5" />} accent="danger" hint="orders I requested" />
        </div>
      )}

      {/* Quick actions */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
      )}

      {/* Upcoming appointments */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-[var(--mc-divider)]">
          <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Upcoming Appointments</h2>
            <p className="text-[11px] text-muted-foreground">Next scheduled visits from today onwards</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/doctor/appointments')}>View all</Button>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : !data || data.upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No upcoming appointments — your schedule is clear.</p>
        ) : (
          <div className="divide-y divide-[var(--mc-divider)]">
            {data.upcoming.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-[var(--mc-primary-light)] transition-colors">
                <div className="min-w-[170px]">
                  <p className="text-sm font-semibold text-[var(--mc-text-primary)]">{a.patientName || '—'}</p>
                  <p className="text-[11px] text-muted-foreground">{a.appointmentNo} · {a.patientPhone || 'no phone'}</p>
                </div>
                <div className="min-w-[120px] text-xs text-[var(--mc-text-secondary)]">
                  <CalendarCheck className="inline h-3.5 w-3.5 mr-1 text-[var(--mc-primary)]" />
                  {fmtDate(a.appointmentDate)} {a.timeSlot && `· ${a.timeSlot}`}
                </div>
                <div className="flex-1 min-w-[140px] text-xs text-muted-foreground truncate">{a.reason || 'No reason given'}</div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
