'use client';

/**
 * DOCTOR APPOINTMENTS — GET /api/appointments?doctorId={user.id}
 * DataTable + actions: confirm (CONFIRMED), check-in (CHECKED_IN),
 * complete (COMPLETED → quick-consultation modal pre-filled with the patient),
 * cancel (CANCELLED). Website bookings (source WEBSITE) and every other source
 * are listed with status badges; UNATTENDED visits (PENDING / CONFIRMED /
 * CHECKED_IN) carry a pulsing amber dot so they stand out from the green
 * COMPLETED (attended) rows.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarCheck, CheckCircle2, LogIn, CheckCheck, XCircle, Eye, Phone, Clock, MessageSquareText, Stethoscope, User, CalendarClock, Hourglass,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { apiGet, apiPut, apiPost } from '@/lib/client-api';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { fmtDate, StatusBadge, PageHeading, Field, FormSection, McInput, McTextarea, McSelect, SkeletonCards } from '@/app/clinical/_lib';

interface Appointment {
  id: string;
  appointmentNo: string;
  patientId: string | null;
  patientName: string;
  patientPhone: string;
  appointmentDate: string;
  timeSlot: string;
  reason: string;
  status: string;
  source: string;
  patient?: { patientNo: string; firstName: string; lastName: string; phone: string } | null;
}

interface PatientLite {
  id: string;
  patientNo: string;
  firstName: string;
  lastName: string;
  phone: string;
}

const emptyConsult = { patientId: '', chiefComplaint: '', diagnosis: '', treatmentPlan: '' };

const UNATTENDED = ['PENDING', 'CONFIRMED', 'CHECKED_IN'];

/** Appointment status pill — amber pulsing dot while unattended, green check when attended. */
function ApptStatusBadge({ status }: { status: string }) {
  if (UNATTENDED.includes(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-100 text-amber-700 text-[11px] font-semibold whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        {status.replaceAll('_', ' ')}
      </span>
    );
  }
  if (status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700 text-[11px] font-semibold whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3" />
        COMPLETED
      </span>
    );
  }
  return <StatusBadge status={status} />;
}

type FilterTab = 'UNATTENDED' | 'TODAY' | 'ATTENDED' | 'ALL';
const FILTERS: Array<{ key: FilterTab; label: string; match: (a: Appointment) => boolean }> = [
  { key: 'UNATTENDED', label: 'Unattended', match: a => UNATTENDED.includes(a.status) },
  { key: 'TODAY', label: 'Today', match: a => new Date(a.appointmentDate).toDateString() === new Date().toDateString() },
  { key: 'ATTENDED', label: 'Attended', match: a => a.status === 'COMPLETED' },
  { key: 'ALL', label: 'All', match: () => true },
];

export default function DoctorAppointmentsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [rows, setRows] = React.useState<Appointment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<FilterTab>('UNATTENDED');

  // Quick-consultation modal (opened from "complete")
  const [consultOpen, setConsultOpen] = React.useState(false);
  const [consultAppt, setConsultAppt] = React.useState<Appointment | null>(null);
  const [patients, setPatients] = React.useState<PatientLite[]>([]);
  const [consult, setConsult] = React.useState({ ...emptyConsult });
  const [submitting, setSubmitting] = React.useState(false);

  // View modal
  const [viewing, setViewing] = React.useState<Appointment | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ appointments: Appointment[] }>(
        `/api/appointments?doctorId=${user?.id || ''}&perPage=100`,
      );
      setRows(res.appointments || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  React.useEffect(() => { load(); }, [load]);

  const loadPatients = React.useCallback(async () => {
    try {
      const res = await apiGet<{ patients: PatientLite[] }>('/api/patients?perPage=100');
      setPatients(res.patients || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load patient list');
    }
  }, []);

  const moveStatus = async (a: Appointment, status: string) => {
    try {
      const res = await apiPut<{ message: string }>('/api/appointments', { id: a.id, status });
      toast.success(res.message || `Appointment ${status.replaceAll('_', ' ')}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update appointment');
    }
  };

  // Complete → quick consultation modal
  const openComplete = (a: Appointment) => {
    setConsultAppt(a);
    setConsult({
      patientId: a.patientId || '',
      chiefComplaint: a.reason || '',
      diagnosis: '',
      treatmentPlan: '',
    });
    loadPatients();
    setConsultOpen(true);
  };

  const submitConsult = async () => {
    if (!consultAppt) return;
    if (!consult.patientId) { toast.error('Select the patient this consultation belongs to'); return; }
    if (!consult.diagnosis.trim()) { toast.error('A diagnosis is required to complete the visit'); return; }
    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string; consultation?: unknown }>('/api/consultations', {
        patientId: consult.patientId,
        doctorId: user?.id,
        chiefComplaint: consult.chiefComplaint,
        diagnosis: consult.diagnosis,
        treatmentPlan: consult.treatmentPlan,
      });
      await apiPut<{ message: string }>('/api/appointments', { id: consultAppt.id, status: 'COMPLETED' });
      toast.success(res.message || 'Consultation recorded & appointment completed');
      setConsultOpen(false);
      setConsultAppt(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record consultation');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<Appointment>[] = [
    {
      key: 'appointmentNo', header: 'Appt No.', defaultVisible: true,
      render: r => <span className="font-semibold text-[var(--mc-text-primary)]">{r.appointmentNo}</span>,
    },
    {
      key: 'patientName', header: 'Patient', defaultVisible: true,
      csvValue: r => r.patient?.firstName ? `${r.patient.firstName} ${r.patient.lastName}` : r.patientName,
      render: r => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--mc-text-primary)] truncate">
            {r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : r.patientName || '—'}
          </p>
          {r.patient && <p className="text-[11px] text-muted-foreground">{r.patient.patientNo}</p>}
        </div>
      ),
    },
    {
      key: 'patientPhone', header: 'Phone', defaultVisible: true,
      csvValue: r => r.patient?.phone || r.patientPhone,
      render: r => <span className="text-xs">{r.patient?.phone || r.patientPhone || '—'}</span>,
    },
    {
      key: 'appointmentDate', header: 'Date & Slot', defaultVisible: true, sortable: true,
      csvValue: r => `${fmtDate(r.appointmentDate)} ${r.timeSlot}`,
      render: r => (
        <span className="text-xs whitespace-nowrap">
          <Clock className="inline h-3.5 w-3.5 mr-1 text-[var(--mc-primary)]" />
          {fmtDate(r.appointmentDate)}{r.timeSlot && ` · ${r.timeSlot}`}
        </span>
      ),
    },
    { key: 'reason', header: 'Reason', render: r => <span className="text-xs text-muted-foreground">{r.reason || '—'}</span> },
    { key: 'status', header: 'Status', defaultVisible: true, render: r => <ApptStatusBadge status={r.status} /> },
    {
      key: 'source', header: 'Source',
      render: r => (
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
          r.source === 'WEBSITE'
            ? 'bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]'
            : 'bg-slate-100 text-slate-600'
        }`}>
          {r.source === 'WEBSITE' ? '🌐 Website' : r.source}
        </span>
      ),
    },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View appointment', variant: 'view', onClick: r => setViewing(r) },
    { icon: <CheckCircle2 className="h-4 w-4" />, title: 'Confirm appointment', variant: 'download', onClick: r => moveStatus(r, 'CONFIRMED') },
    { icon: <LogIn className="h-4 w-4" />, title: 'Check patient in', variant: 'edit', onClick: r => moveStatus(r, 'CHECKED_IN') },
    { icon: <CheckCheck className="h-4 w-4" />, title: 'Complete & record consultation', variant: 'print', onClick: openComplete },
    { icon: <XCircle className="h-4 w-4" />, title: 'Cancel appointment', variant: 'delete', onClick: r => moveStatus(r, 'CANCELLED') },
  ];

  const patientOptions = patients.map(p => ({
    value: p.id,
    label: `${p.firstName} ${p.lastName} · ${p.patientNo}`,
  }));

  const unattended = rows.filter(a => UNATTENDED.includes(a.status));
  const todayCount = rows.filter(a => new Date(a.appointmentDate).toDateString() === new Date().toDateString());
  const completed = rows.filter(a => a.status === 'COMPLETED');
  const cancelled = rows.filter(a => a.status === 'CANCELLED');
  const filtered = rows.filter(FILTERS.find(f => f.key === filter)!.match);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<CalendarCheck className="h-5 w-5" />}
        title="My Appointments"
        subtitle="Schedule booked through the website, phone or walk-in — confirm, check in and complete visits"
        actions={<Button size="sm" variant="outline" onClick={() => router.push('/doctor')}>Dashboard</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Unattended" value={unattended.length} icon={<Hourglass className="h-5 w-5" />} accent="warning" hint="pending · confirmed · checked-in" />
          <StatCard label="Today" value={todayCount.length} icon={<CalendarClock className="h-5 w-5" />} accent="primary" hint="visits scheduled today" />
          <StatCard label="Attended" value={completed.length} icon={<CheckCheck className="h-5 w-5" />} accent="success" hint="completed visits" />
          <StatCard label="Cancelled" value={cancelled.length} icon={<XCircle className="h-5 w-5" />} accent="danger" hint="cancelled bookings" />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap no-print">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${
              filter === f.key
                ? 'bg-[var(--mc-primary)] text-white border-[var(--mc-primary)]'
                : 'bg-white text-[var(--mc-text-secondary)] border-[var(--mc-divider)] hover:border-[var(--mc-primary)]'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 text-[10px] ${filter === f.key ? 'text-white/80' : 'text-muted-foreground'}`}>
              {rows.filter(f.match).length}
            </span>
          </button>
        ))}
      </div>

      <DataTable
        data={filtered} columns={columns} actions={actions}
        rowKey={r => r.id} title="Appointments" moduleLabel="Doctor Appointments"
        loading={loading} emptyMessage="No appointments in this view"
      />

      {/* View modal */}
      <PremiumModal
        open={!!viewing} onOpenChange={o => !o && setViewing(null)}
        size="sm" title={`Appointment ${viewing?.appointmentNo || ''}`}
        icon={<Eye className="h-5 w-5" />}
        description="Appointment details"
        footerNote="Appointments feed the doctor dashboard"
      >
        {viewing && (
          <div className="space-y-2 text-sm">
            {[
              ['Patient', viewing.patient ? `${viewing.patient.firstName} ${viewing.patient.lastName} (${viewing.patient.patientNo})` : viewing.patientName || '—'],
              ['Phone', viewing.patient?.phone || viewing.patientPhone || '—'],
              ['Date', fmtDate(viewing.appointmentDate)],
              ['Time Slot', viewing.timeSlot || '—'],
              ['Reason', viewing.reason || '—'],
              ['Source', viewing.source],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 border-b border-dashed border-[var(--mc-divider)] pb-1.5">
                <span className="text-xs font-semibold text-muted-foreground shrink-0">{label}</span>
                <span className="text-right text-[var(--mc-text-primary)]">{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-muted-foreground">Status</span>
              <StatusBadge status={viewing.status} />
            </div>
          </div>
        )}
      </PremiumModal>

      {/* Complete → quick consultation modal */}
      <PremiumModal
        open={consultOpen} onOpenChange={setConsultOpen}
        title="Complete Visit — Record Consultation"
        icon={<Stethoscope className="h-5 w-5" />}
        description={consultAppt ? `${consultAppt.appointmentNo} — ${consultAppt.patient ? `${consultAppt.patient.firstName} ${consultAppt.patient.lastName}` : consultAppt.patientName}` : ''}
        footerNote="A diagnosis auto-bills the consultation fee to the patient's active visit (paid at cashier)"
        submitLabel="Complete & Record" onSubmit={submitConsult}
        submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Patient">
            <Field icon={<User className="h-3.5 w-3.5" />} label="Patient" hint="linked appointment patient is pre-selected">
              <McSelect
                value={consult.patientId}
                onValueChange={v => setConsult(c => ({ ...c, patientId: v }))}
                options={patientOptions}
                placeholder="Select patient…"
              />
            </Field>
            <Field icon={<MessageSquareText className="h-3.5 w-3.5" />} label="Chief Complaint" hint="pre-filled from appointment reason">
              <McInput
                value={consult.chiefComplaint}
                onChange={e => setConsult(c => ({ ...c, chiefComplaint: e.target.value }))}
                placeholder="e.g. Fever and headache for 3 days"
              />
            </Field>
          </FormSection>
          <FormSection n={2} title="Diagnosis & Plan">
            <Field icon={<Stethoscope className="h-3.5 w-3.5" />} label="Diagnosis *" hint="required — triggers consultation fee billing">
              <McInput
                value={consult.diagnosis}
                onChange={e => setConsult(c => ({ ...c, diagnosis: e.target.value }))}
                placeholder="e.g. Malaria (Falciparum)"
              />
            </Field>
            <Field icon={<Phone className="h-3.5 w-3.5" />} label="Treatment Plan">
              <McTextarea
                value={consult.treatmentPlan}
                onChange={e => setConsult(c => ({ ...c, treatmentPlan: e.target.value }))}
                placeholder="e.g. Artemether-Lumefantrine 80/480, rest, review in 3 days"
              />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>
    </div>
  );
}
