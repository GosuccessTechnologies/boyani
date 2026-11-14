'use client';

/**
 * NURSING ASSIGNMENTS — duty & shift roster with patient-care expansion
 * (Instruction 23). GET /api/shifts (scoped to the signed-in nurse via
 * Employee.userId). Clicking a shift/period expands to show the patients
 * cared for during that period — admissions active during the shift date
 * (GET /api/admissions) plus vitals recorded by this nurse in the period
 * (GET /api/vitals?mine=1&from=&to=) — with their vital recordings listed.
 * Assigning/shifting stays with ADMIN/HR at Facility Management — view-only.
 */

import * as React from 'react';
import {
  CalendarClock, Clock, Building2, Stethoscope, RefreshCw, Sun, Moon, Sunset, PhoneCall,
  ChevronDown, ChevronRight, Loader2, BedDouble, Activity, User,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDate, fmtDateTime, StatusBadge, PageHeading, SkeletonCards, pname } from '@/app/clinical/_lib';

interface ShiftRow {
  id: string;
  assignmentType: string;
  wardOrClinic: string;
  shiftDate: string;
  shiftStart: string;
  shiftEnd: string;
  shiftType: string;
  status: string;
  notes: string;
  employee?: { employeeNo: string; firstName: string; lastName: string; department?: string; profession?: string } | null;
  department?: { name: string } | null;
}

interface MineVital {
  id: string;
  recordedAt: string;
  temperature: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  pulse: number;
  respiratoryRate: number;
  weight: number;
  bmi: number;
  oxygenSaturation: number;
  bloodGlucose: number;
  painScore: number;
  notes: string;
  recordedByName: string;
  patient: { id: string; patientNo: string; firstName: string; lastName: string };
}

interface ActiveAdmission {
  id: string;
  admissionNo: string;
  admissionType: string;
  status: string;
  admissionDate: string;
  dischargeDate: string | null;
  patient?: { id: string; patientNo: string; firstName: string; lastName: string } | null;
  bed?: { bedNumber: string; ward?: { name: string } | null } | null;
}

interface ShiftDetail {
  admissions: ActiveAdmission[];
  vitals: MineVital[];
}

interface CarePatient {
  key: string;
  name: string;
  patientNo: string;
  admission?: ActiveAdmission;
  vitals: MineVital[];
}

const SHIFT_ICON: Record<string, React.ReactNode> = {
  DAY: <Sun className="h-3.5 w-3.5" />,
  NIGHT: <Moon className="h-3.5 w-3.5" />,
  EVENING: <Sunset className="h-3.5 w-3.5" />,
  ON_CALL: <PhoneCall className="h-3.5 w-3.5" />,
};

export default function NursingAssignmentsPage() {
  const [rows, setRows] = React.useState<ShiftRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<Record<string, ShiftDetail>>({});
  const [detailLoading, setDetailLoading] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ shifts: ShiftRow[] }>('/api/shifts?perPage=100');
      setRows(res.shifts || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const toggleShift = async (s: ShiftRow) => {
    if (expandedId === s.id) { setExpandedId(null); return; }
    setExpandedId(s.id);
    if (details[s.id]) return; // cached

    setDetailLoading(s.id);
    try {
      const dayStart = new Date(s.shiftDate); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(s.shiftDate); dayEnd.setHours(23, 59, 59, 999);
      const [mineRes, admRes] = await Promise.all([
        apiGet<{ vitals: MineVital[] }>(
          `/api/vitals?mine=1&from=${dayStart.toISOString()}&to=${dayEnd.toISOString()}`,
        ),
        apiGet<{ admissions: ActiveAdmission[] }>('/api/admissions?perPage=200'),
      ]);
      // Admissions active at any point during the shift date
      const active = (admRes.admissions || []).filter(a =>
        new Date(a.admissionDate) <= dayEnd && (!a.dischargeDate || new Date(a.dischargeDate) >= dayStart),
      );
      setDetails(d => ({ ...d, [s.id]: { admissions: active, vitals: mineRes.vitals || [] } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load shift details');
    } finally {
      setDetailLoading(null);
    }
  };

  // Build the cared-for patient list for a shift (admissions + my vitals merged)
  const carePatients = (detail: ShiftDetail | undefined): CarePatient[] => {
    if (!detail) return [];
    const byKey = new Map<string, CarePatient>();
    for (const a of detail.admissions) {
      const pid = a.patient?.id;
      if (!pid) continue;
      byKey.set(pid, {
        key: pid,
        name: pname(a.patient || undefined),
        patientNo: a.patient?.patientNo || '—',
        admission: a,
        vitals: [],
      });
    }
    for (const v of detail.vitals) {
      const entry = byKey.get(v.patient.id) || {
        key: v.patient.id,
        name: pname(v.patient),
        patientNo: v.patient.patientNo,
        vitals: [],
      };
      entry.vitals = [v, ...entry.vitals];
      if (!byKey.has(v.patient.id)) byKey.set(v.patient.id, entry);
    }
    return [...byKey.values()].sort((a, b) => (Number(!!b.admission) - Number(!!a.admission)) || a.name.localeCompare(b.name));
  };

  const upcoming = rows.filter(r => new Date(r.shiftDate) >= new Date(new Date().setHours(0, 0, 0, 0)) && r.status !== 'CANCELLED').length;
  const nights = rows.filter(r => r.shiftType === 'NIGHT').length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<CalendarClock className="h-5 w-5" />}
        title="My Assignments"
        subtitle="Duty roster and ward/clinic orders assigned to you — click a shift to see the patients you cared for"
        actions={
          <Button size="sm" variant="outline" className="gap-1" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {loading ? <SkeletonCards count={3} /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Assignments" value={rows.length} icon={<CalendarClock className="h-5 w-5" />} accent="primary" hint="visible to you" />
          <StatCard label="Upcoming Shifts" value={upcoming} icon={<Clock className="h-5 w-5" />} accent="success" />
          <StatCard label="Night Duties" value={nights} icon={<Moon className="h-5 w-5" />} accent="secondary" />
        </div>
      )}

      {/* Expandable shift list */}
      <div className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-[var(--mc-divider)]">
          <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Shift Periods</h2>
            <p className="text-[11px] text-muted-foreground">Admissions active during the shift + vitals you recorded in the period</p>
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            No assignments found — shifts are assigned by Facility Management (ADMIN/HR).
          </p>
        ) : (
          <div className="divide-y divide-[var(--mc-divider)]">
            {rows.map(s => {
              const open = expandedId === s.id;
              const detail = details[s.id];
              const patients = carePatients(detail);
              return (
                <div key={s.id}>
                  <button
                    type="button"
                    onClick={() => toggleShift(s)}
                    className="w-full flex flex-wrap items-center gap-2.5 p-3.5 text-left hover:bg-white transition-colors cursor-pointer"
                  >
                    {open
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="h-8 w-8 rounded-lg bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] flex items-center justify-center shrink-0">
                      {SHIFT_ICON[s.shiftType] || <Clock className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--mc-text-primary)] truncate">
                        {s.wardOrClinic || 'General duty'} · {s.shiftType}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtDate(s.shiftDate)} · <Clock className="inline h-3 w-3" /> {s.shiftStart}–{s.shiftEnd}
                        {s.employee ? ` · ${s.employee.firstName} ${s.employee.lastName}` : ''}
                        {s.department?.name ? ` · ${s.department.name}` : ''}
                      </p>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">
                      {s.assignmentType}
                    </span>
                    <StatusBadge status={s.status} />
                  </button>

                  {open && (
                    <div className="border-t border-[var(--mc-divider)] bg-white p-3.5 space-y-2.5">
                      {s.notes && (
                        <p className="text-xs text-muted-foreground italic">Shift notes: {s.notes}</p>
                      )}
                      {detailLoading === s.id ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin text-[var(--mc-primary)]" /> Loading patients cared for during this period…
                        </div>
                      ) : patients.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          No admissions or vitals recorded during this shift period.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                          {patients.map(p => (
                            <div key={p.key} className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full mc-gradient-primary flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                  {p.name.split(' ').map(x => x.charAt(0)).slice(0, 2).join('').toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-[var(--mc-text-primary)] truncate">{p.name}</p>
                                  <p className="text-[11px] text-muted-foreground">{p.patientNo}</p>
                                </div>
                                {p.admission ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-semibold flex items-center gap-1">
                                    <BedDouble className="h-3 w-3" /> {p.admission.bed?.ward?.name || 'Ward'}
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200 font-semibold flex items-center gap-1">
                                    <Activity className="h-3 w-3" /> vitals
                                  </span>
                                )}
                              </div>

                              {p.admission && (
                                <p className="text-[11px] text-[var(--mc-text-secondary)] flex flex-wrap items-center gap-x-2">
                                  <span>{p.admission.admissionNo} · {p.admission.admissionType.toLowerCase()}</span>
                                  <span>Bed {p.admission.bed?.bedNumber || '—'}</span>
                                  <span>admitted {fmtDateTime(p.admission.admissionDate)}</span>
                                  {p.admission.dischargeDate && <span>discharged {fmtDate(p.admission.dischargeDate)}</span>}
                                </p>
                              )}

                              {p.vitals.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground italic">No vitals recorded by me for this patient in this period.</p>
                              ) : (
                                <div className="rounded-lg border border-teal-200 bg-white overflow-hidden">
                                  <table className="mc-table">
                                    <thead>
                                      <tr><th>Recorded</th><th>Temp °C</th><th>BP</th><th>Pulse</th><th>SpO₂</th><th>BMI</th></tr>
                                    </thead>
                                    <tbody>
                                      {p.vitals.map(v => (
                                        <tr key={v.id}>
                                          <td className="text-xs whitespace-nowrap">{fmtDateTime(v.recordedAt)}</td>
                                          <td className="text-xs">{v.temperature || '—'}</td>
                                          <td className="text-xs font-medium">{v.bloodPressureSystolic || '—'}/{v.bloodPressureDiastolic || '—'}</td>
                                          <td className="text-xs">{v.pulse || '—'}</td>
                                          <td className="text-xs">{v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—'}</td>
                                          <td className="text-xs font-semibold">{v.bmi || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5 no-print">
        <Stethoscope className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
        <Building2 className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
        <User className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
        Nurses see only their own assignments; administrators and HR see the full roster.
      </p>
    </div>
  );
}
