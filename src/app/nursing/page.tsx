'use client';

/**
 * NURSING DASHBOARD — /api/dashboard?portal=nursing (Instruction 23 UI overhaul).
 * Premium StatCard v2 row (activeAdmissions, availableBeds, occupiedBeds,
 * todayVitals, activeVisits) + ward occupancy board with progress-style beds:
 * each ward card renders a segmented occupancy bar (one segment per bed, coloured
 * by bed status) plus a bed chip grid with the occupant's name.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, BedDouble, CheckCircle2, HeartPulse, ClipboardList, ArrowRight, RefreshCw, Users,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, StatusBadge, PageHeading, SkeletonCards } from '@/app/clinical/_lib';

interface NursingKpis {
  activeAdmissions: number;
  availableBeds: number;
  occupiedBeds: number;
  todayVitals: number;
  activeVisits: number;
}

interface WardBoardRow {
  name: string;
  wardType: string;
  dailyRate: number;
  total: number;
  occupied: number;
  available: number;
}

interface NursingDashboard {
  kpis: NursingKpis;
  wards: WardBoardRow[];
}

/** Bed-status → segment / chip tones (progress-style beds). */
const SEG_TONE: Record<string, string> = {
  OCCUPIED: 'bg-rose-500',
  AVAILABLE: 'bg-emerald-500',
  RESERVED: 'bg-amber-400',
  MAINTENANCE: 'bg-slate-300',
};
const CHIP_TONE: Record<string, string> = {
  OCCUPIED: 'border-rose-200 bg-rose-50 text-rose-700',
  AVAILABLE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  RESERVED: 'border-amber-200 bg-amber-50 text-amber-700',
  MAINTENANCE: 'border-slate-200 bg-slate-100 text-slate-500',
};

interface BedBoardCell { id: string; bedNumber: string; status: string; currentPatient: string | null }
interface WardFull extends WardBoardRow { id: string; beds: BedBoardCell[] }

const QUICK_ACTIONS = [
  { label: 'Record Vitals', href: '/nursing/vitals', icon: <Activity className="h-4 w-4" /> },
  { label: 'Admissions & Bed Board', href: '/nursing/admissions', icon: <BedDouble className="h-4 w-4" /> },
  { label: 'My Assignments', href: '/nursing/assignments', icon: <ClipboardList className="h-4 w-4" /> },
];

export default function NursingDashboardPage() {
  const router = useRouter();
  const [data, setData] = React.useState<NursingDashboard | null>(null);
  const [wardsFull, setWardsFull] = React.useState<WardFull[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [dash, board] = await Promise.all([
        apiGet<NursingDashboard>('/api/dashboard?portal=nursing'),
        apiGet<{ wards: WardFull[] }>('/api/admissions?tab=ward-occupancy'),
      ]);
      setData(dash);
      setWardsFull(board.wards || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const k = data?.kpis;
  const totalBeds = (k?.availableBeds ?? 0) + (k?.occupiedBeds ?? 0);
  const occupancyPct = totalBeds > 0 ? Math.round(((k?.occupiedBeds ?? 0) / totalBeds) * 100) : 0;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Activity className="h-5 w-5" />}
        title="Nursing Dashboard"
        subtitle="Ward occupancy, vitals activity and inpatient flow"
        actions={
          <Button size="sm" variant="outline" className="gap-1" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {loading ? <SkeletonCards count={5} /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard label="Active Admissions" value={k?.activeAdmissions ?? 0} icon={<BedDouble className="h-5 w-5" />} accent="primary" onClick={() => router.push('/nursing/admissions')} />
          <StatCard label="Available Beds" value={k?.availableBeds ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" onClick={() => router.push('/nursing/admissions')} />
          <StatCard label="Occupied Beds" value={k?.occupiedBeds ?? 0} icon={<BedDouble className="h-5 w-5" />} accent="danger" hint={`${occupancyPct}% occupancy`} />
          <StatCard label="Vitals Today" value={k?.todayVitals ?? 0} icon={<HeartPulse className="h-5 w-5" />} accent="secondary" onClick={() => router.push('/nursing/vitals')} />
          <StatCard label="Active Visits" value={k?.activeVisits ?? 0} icon={<ClipboardList className="h-5 w-5" />} accent="warning" />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {QUICK_ACTIONS.map(q => (
          <button
            key={q.href}
            onClick={() => router.push(q.href)}
            className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-4 flex items-center gap-3 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">{q.icon}</div>
            <span className="text-sm font-semibold text-[var(--mc-text-primary)] flex-1">{q.label}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Ward occupancy board — progress-style beds */}
      <div className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-[var(--mc-divider)]">
          <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
            <BedDouble className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Ward Occupancy Board</h2>
            <p className="text-[11px] text-muted-foreground">Live bed occupancy — each segment is one bed, coloured by status</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status="OCCUPIED" />
            <StatusBadge status="AVAILABLE" />
            <StatusBadge status="RESERVED" />
            <StatusBadge status="MAINTENANCE" />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : wardsFull.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No wards configured yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            {wardsFull.map(w => {
              const pct = w.total ? Math.round((w.occupied / w.total) * 100) : 0;
              return (
                <div key={w.id} className="rounded-xl border border-[var(--mc-divider)] bg-white p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
                      <BedDouble className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-[var(--mc-text-primary)] truncate">{w.name}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {w.wardType?.replaceAll('_', ' ').toLowerCase()} · {kes(w.dailyRate)}/day
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-[var(--mc-text-primary)] leading-none">{w.occupied}<span className="text-xs font-semibold text-muted-foreground">/{w.total}</span></p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{pct}% occupied</p>
                    </div>
                  </div>

                  {/* progress-style bed bar — one segment per bed */}
                  <div className="flex gap-1 h-3.5" title={`${w.occupied} of ${w.total} beds occupied`}>
                    {w.beds.length === 0
                      ? <div className="flex-1 rounded-full bg-[var(--mc-divider)]" />
                      : w.beds.map(b => (
                        <div
                          key={b.id}
                          title={`Bed ${b.bedNumber} — ${b.status.toLowerCase()}${b.currentPatient ? ` (${b.currentPatient})` : ''}`}
                          className={`flex-1 rounded-full transition-transform hover:scale-y-125 ${SEG_TONE[b.status] || SEG_TONE.MAINTENANCE}`}
                        />
                      ))}
                  </div>

                  {/* bed chips with occupants */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {w.beds.map(b => (
                      <div
                        key={b.id}
                        title={`Bed ${b.bedNumber}${b.currentPatient ? ` — ${b.currentPatient}` : ` — ${b.status.toLowerCase()}`}`}
                        className={`rounded-lg border px-1.5 py-1 min-w-0 ${CHIP_TONE[b.status] || CHIP_TONE.MAINTENANCE}`}
                      >
                        <p className="text-[10px] font-bold truncate leading-tight">{b.bedNumber}</p>
                        <p className="text-[9px] truncate leading-tight">
                          {b.status === 'OCCUPIED' ? (b.currentPatient || 'Occupied') : b.status.toLowerCase()}
                        </p>
                      </div>
                    ))}
                    {w.beds.length === 0 && (
                      <p className="text-xs text-muted-foreground col-span-4 py-1.5">No beds registered in this ward.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><StatusBadge status="AVAILABLE" /> free to admit</span>
        <span className="flex items-center gap-1"><StatusBadge status="OCCUPIED" /> has a patient</span>
        <span className="flex items-center gap-1"><StatusBadge status="RESERVED" /> held for incoming</span>
        <span className="flex items-center gap-1"><StatusBadge status="MAINTENANCE" /> out of service</span>
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> occupied chips show the patient name</span>
      </div>
    </div>
  );
}
