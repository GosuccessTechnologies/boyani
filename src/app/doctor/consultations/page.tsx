'use client';

/**
 * DOCTOR CONSULTATIONS — GET /api/consultations
 * DataTable + PremiumModal 4-section clinical form (Patient / History & Exam /
 * Diagnosis / Follow-up). The 6 clinical narrative fields (chief complaint,
 * history, physical examination, diagnosis, differential diagnosis, treatment
 * plan) are tiptap RichTextEditors storing HTML (schema fields are String).
 * The API auto-bills the consultation fee to the patient's active visit when a
 * diagnosis is recorded. View action = read-only encounter sheet rendered with
 * dangerouslySetInnerHTML inside .mc-prose; every encounter prints via
 * printUniversalDocument ("PATIENT CONSULTATION RECORD").
 */

import * as React from 'react';
import {
  Stethoscope, User, MessageSquareText, ClipboardList, Search, HeartPulse, FileText, CalendarClock, Eye, Plus, FlaskConical, Printer,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost } from '@/lib/client-api';
import { printUniversalDocument, docSection, docTable } from '@/lib/document-print';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  fmtDate, fmtDateTime, age, StatusBadge, PageHeading, Field, FormSection, McInput, McSelect, SkeletonCards, pname,
} from '@/app/clinical/_lib';

interface Consultation {
  id: string;
  consultationNo: string;
  patientId: string;
  patient?: { patientNo: string; firstName: string; lastName: string; phone: string; gender?: string } | null;
  chiefComplaint: string;
  history: string;
  examination: string;
  diagnosis: string;
  differential: string;
  treatmentPlan: string;
  followUpDate: string | null;
  status: string;
  createdAt: string;
}

/** Full record returned by GET /api/consultations?id= (richer patient select). */
interface ConsultationFull extends Consultation {
  patient?: {
    patientNo: string; firstName: string; lastName: string; phone: string; gender: string;
    dateOfBirth: string | null; bloodType: string; allergies: string; paymentMode: string;
  } | null;
}

interface PatientLite {
  id: string;
  patientNo: string;
  firstName: string;
  lastName: string;
  phone: string;
}

const emptyForm = {
  patientId: '',
  chiefComplaint: '',
  history: '',
  examination: '',
  diagnosis: '',
  differential: '',
  treatmentPlan: '',
  followUpDate: '',
};

/** Collapse tiptap/HTML content to readable plain text (tables, CSV, previews). */
const stripHtml = (html: string) =>
  String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h1|h2|h3|tr)>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/** Field render helper for the view modal — HTML rendered inside .mc-prose. */
function RichField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--mc-divider)] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-primary)] mb-1">{label}</p>
      {value && stripHtml(value) ? (
        <div className="mc-prose text-sm max-w-none" dangerouslySetInnerHTML={{ __html: value }} />
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}

const CLINICAL_FIELDS: Array<[string, string]> = [
  ['Chief Complaint', 'chiefComplaint'],
  ['History (Anamnesis)', 'history'],
  ['Physical Examination', 'examination'],
  ['Diagnosis', 'diagnosis'],
  ['Differential Diagnosis', 'differential'],
  ['Treatment Plan', 'treatmentPlan'],
];

export default function DoctorConsultationsPage() {
  const { user } = useAuthStore();
  const [rows, setRows] = React.useState<Consultation[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [patients, setPatients] = React.useState<PatientLite[]>([]);
  const [patientSearch, setPatientSearch] = React.useState('');
  const [patientsLoading, setPatientsLoading] = React.useState(false);

  const [viewing, setViewing] = React.useState<Consultation | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ consultations: Consultation[] }>('/api/consultations?perPage=100');
      setRows(res.consultations || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load consultations');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const loadPatients = React.useCallback(async (search: string) => {
    setPatientsLoading(true);
    try {
      const res = await apiGet<{ patients: PatientLite[] }>(
        `/api/patients?perPage=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      );
      setPatients(res.patients || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load patients');
    } finally {
      setPatientsLoading(false);
    }
  }, []);

  const openCreate = () => {
    setForm({ ...emptyForm });
    setPatientSearch('');
    loadPatients('');
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.patientId) { toast.error('Select a patient'); return; }
    if (!stripHtml(form.chiefComplaint) && !stripHtml(form.diagnosis)) {
      toast.error('Chief complaint or diagnosis is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string; consultation: Consultation }>('/api/consultations', {
        patientId: form.patientId,
        doctorId: user?.id,
        chiefComplaint: form.chiefComplaint,
        history: form.history,
        examination: form.examination,
        diagnosis: form.diagnosis,
        differential: form.differential,
        treatmentPlan: form.treatmentPlan,
        followUpDate: form.followUpDate || null,
      });
      toast.success(res.message || 'Consultation recorded');
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record consultation');
    } finally {
      setSubmitting(false);
    }
  };

  // Print — fetches the full record (?id= includes DOB/gender/blood type) then
  // opens the universal document printer with the PATIENT CONSULTATION RECORD.
  const printConsultation = async (c: Consultation) => {
    let full: ConsultationFull = c as ConsultationFull;
    try {
      const res = await apiGet<{ consultation: ConsultationFull }>(`/api/consultations?id=${c.id}`);
      if (res.consultation) full = res.consultation;
    } catch {
      // fall back to the row data
    }
    const p = full.patient;
    const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const bodyHtml = [
      docSection('Patient Details'),
      docTable([
        ['Patient Name', esc(pname(p))],
        ['Patient No', esc(p?.patientNo || '—')],
        ['Age / Gender', `${age(p?.dateOfBirth)} / ${esc(p?.gender || '—')}`],
        ['Phone', esc(p?.phone || '—')],
      ]),
      docSection('Visit Information'),
      docTable([
        ['Consultation No', esc(full.consultationNo)],
        ['Visit Date', esc(fmtDateTime(full.createdAt))],
        ['Status', esc(full.status ? full.status.replaceAll('_', ' ') : '—')],
        ['Follow-up Date', esc(fmtDate(full.followUpDate))],
      ]),
      docSection('Chief Complaint'),
      full.chiefComplaint ? full.chiefComplaint : '<p>—</p>',
      docSection('History (Anamnesis)'),
      full.history ? full.history : '<p>—</p>',
      docSection('Physical Examination'),
      full.examination ? full.examination : '<p>—</p>',
      docSection('Diagnosis'),
      full.diagnosis ? `<p><b>${esc(stripHtml(full.diagnosis))}</b></p>` : '<p>—</p>',
      docSection('Differential Diagnosis'),
      full.differential ? full.differential : '<p>—</p>',
      docSection('Treatment Plan'),
      full.treatmentPlan ? full.treatmentPlan : '<p>—</p>',
    ].join('');
    printUniversalDocument({
      title: 'PATIENT CONSULTATION RECORD',
      docId: full.consultationNo,
      bodyHtml,
      footerNote: 'Clinical encounter record — issued by the medical office',
    });
  };

  const columns: Column<Consultation>[] = [
    {
      key: 'consultationNo', header: 'Consult No.', defaultVisible: true,
      render: r => <span className="font-semibold text-[var(--mc-text-primary)]">{r.consultationNo}</span>,
    },
    {
      key: 'patient', header: 'Patient', defaultVisible: true,
      csvValue: r => pname(r.patient),
      render: r => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--mc-text-primary)] truncate">{pname(r.patient)}</p>
          {r.patient?.patientNo && <p className="text-[11px] text-muted-foreground">{r.patient.patientNo}</p>}
        </div>
      ),
    },
    {
      key: 'diagnosis', header: 'Diagnosis', defaultVisible: true,
      csvValue: r => stripHtml(r.diagnosis),
      render: r => (
        <span className="text-xs text-[var(--mc-text-secondary)] line-clamp-2">
          {stripHtml(r.diagnosis) || <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      key: 'createdAt', header: 'Date', defaultVisible: true, sortable: true,
      csvValue: r => fmtDate(r.createdAt),
      render: r => <span className="text-xs whitespace-nowrap">{fmtDate(r.createdAt)}</span>,
    },
    {
      key: 'chiefComplaint', header: 'Chief Complaint',
      csvValue: r => stripHtml(r.chiefComplaint),
      render: r => (
        <span className="text-xs text-muted-foreground line-clamp-2">{stripHtml(r.chiefComplaint) || '—'}</span>
      ),
    },
    { key: 'followUpDate', header: 'Follow-up', csvValue: r => fmtDate(r.followUpDate), render: r => <span className="text-xs">{fmtDate(r.followUpDate)}</span> },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status} /> },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View encounter', variant: 'view', onClick: r => setViewing(r) },
    { icon: <Printer className="h-4 w-4" />, title: 'Print consultation record', variant: 'print', onClick: printConsultation },
  ];

  const patientOptions = patients.map(p => ({
    value: p.id,
    label: `${p.firstName} ${p.lastName} · ${p.patientNo}`,
  }));

  const inProgress = rows.filter(r => r.status === 'IN_PROGRESS').length;
  const completed = rows.filter(r => r.status === 'COMPLETED').length;
  const followUps = rows.filter(r => r.followUpDate && new Date(r.followUpDate) >= new Date()).length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Stethoscope className="h-5 w-5" />}
        title="Consultations"
        subtitle="Clinical encounters — a diagnosis automatically bills the consultation fee to the visit"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Consultation</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Consultations" value={rows.length} icon={<Stethoscope className="h-5 w-5" />} accent="primary" />
          <StatCard label="In Progress" value={inProgress} icon={<HeartPulse className="h-5 w-5" />} accent="warning" />
          <StatCard label="Completed" value={completed} icon={<FileText className="h-5 w-5" />} accent="success" />
          <StatCard label="Upcoming Follow-ups" value={followUps} icon={<CalendarClock className="h-5 w-5" />} accent="secondary" />
        </div>
      )}

      <DataTable
        data={rows} columns={columns} actions={actions}
        rowKey={r => r.id} title="Consultations" moduleLabel="Doctor Consultations"
        loading={loading} emptyMessage="No consultations recorded yet"
      />

      {/* New consultation form */}
      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="lg"
        title="New Consultation"
        icon={<Stethoscope className="h-5 w-5" />}
        description="Record the clinical encounter — the consultation fee is billed automatically"
        footerNote="Diagnosis triggers auto-billing of the consultation fee to the active visit (paid at cashier)"
        submitLabel="Record Consultation" onSubmit={submit}
        submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Patient">
            <Field icon={<Search className="h-3.5 w-3.5" />} label="Search Patients" className="sm:col-span-2">
              <div className="flex gap-2">
                <McInput
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Name, patient No., phone, national ID or SHA number…"
                  onKeyDown={e => { if (e.key === 'Enter') loadPatients(patientSearch); }}
                />
                <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={() => loadPatients(patientSearch)}>
                  <Search className="h-4 w-4" /> Search
                </Button>
              </div>
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Patient *" className="sm:col-span-2"
              hint={patientsLoading ? 'Loading patients…' : `${patients.length} patient(s) available`}>
              <McSelect
                value={form.patientId}
                onValueChange={v => setForm(f => ({ ...f, patientId: v }))}
                options={patientOptions}
                placeholder="Select patient…"
              />
            </Field>
          </FormSection>

          <FormSection n={2} title="History & Examination">
            <Field icon={<MessageSquareText className="h-3.5 w-3.5" />} label="Chief Complaint" className="sm:col-span-2"
              hint="rich text — headings, lists and tables supported">
              <RichTextEditor
                value={form.chiefComplaint}
                onChange={v => setForm(f => ({ ...f, chiefComplaint: v }))}
                placeholder="e.g. Cough and difficulty breathing for 5 days…"
                minHeight={160}
              />
            </Field>
            <Field icon={<ClipboardList className="h-3.5 w-3.5" />} label="History (Anamnesis)" className="sm:col-span-2">
              <RichTextEditor
                value={form.history}
                onChange={v => setForm(f => ({ ...f, history: v }))}
                placeholder="Onset, duration, aggravating/relieving factors, past medical history, medication, allergies…"
                minHeight={160}
              />
            </Field>
            <Field icon={<HeartPulse className="h-3.5 w-3.5" />} label="Physical Examination" className="sm:col-span-2">
              <RichTextEditor
                value={form.examination}
                onChange={v => setForm(f => ({ ...f, examination: v }))}
                placeholder="General condition, vitals summary, systemic findings…"
                minHeight={160}
              />
            </Field>
          </FormSection>

          <FormSection n={3} title="Diagnosis & Treatment">
            <Field icon={<Stethoscope className="h-3.5 w-3.5" />} label="Diagnosis" hint="recording a diagnosis bills the consultation fee">
              <RichTextEditor
                value={form.diagnosis}
                onChange={v => setForm(f => ({ ...f, diagnosis: v }))}
                placeholder="e.g. Community-acquired pneumonia…"
                minHeight={160}
              />
            </Field>
            <Field icon={<FlaskConical className="h-3.5 w-3.5" />} label="Differential Diagnosis">
              <RichTextEditor
                value={form.differential}
                onChange={v => setForm(f => ({ ...f, differential: v }))}
                placeholder="e.g. PTB, asthma exacerbation…"
                minHeight={160}
              />
            </Field>
            <Field icon={<FileText className="h-3.5 w-3.5" />} label="Treatment Plan" className="sm:col-span-2">
              <RichTextEditor
                value={form.treatmentPlan}
                onChange={v => setForm(f => ({ ...f, treatmentPlan: v }))}
                placeholder="Medication, investigations ordered, advice, referrals…"
                minHeight={160}
              />
            </Field>
          </FormSection>

          <FormSection n={4} title="Follow-up">
            <Field icon={<CalendarClock className="h-3.5 w-3.5" />} label="Follow-up Date">
              <McInput
                type="date"
                value={form.followUpDate}
                onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))}
              />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>

      {/* Read-only view modal */}
      <PremiumModal
        open={!!viewing} onOpenChange={o => !o && setViewing(null)} size="lg"
        title={`Encounter ${viewing?.consultationNo || ''}`}
        icon={<Eye className="h-5 w-5" />}
        description={viewing ? `${pname(viewing.patient)} — ${fmtDateTime(viewing.createdAt)}` : ''}
        footerNote="Read-only clinical record"
        extraFooter={
          <Button size="sm" variant="outline" className="gap-1" onClick={() => viewing && printConsultation(viewing)}>
            <Printer className="h-4 w-4" /> Print Record
          </Button>
        }
      >
        {viewing && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)]">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-primary)] mb-2">Patient</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="text-muted-foreground text-xs">Name:</span> {pname(viewing.patient)}</p>
                <p><span className="text-muted-foreground text-xs">Patient No:</span> {viewing.patient?.patientNo || '—'}</p>
                <p><span className="text-muted-foreground text-xs">Phone:</span> {viewing.patient?.phone || '—'}</p>
                <p><span className="text-muted-foreground text-xs">Status:</span> <StatusBadge status={viewing.status} /></p>
              </div>
            </div>
            {CLINICAL_FIELDS.map(([label, key]) => (
              <RichField key={key} label={label} value={String((viewing as unknown as Record<string, string>)[key] || '')} />
            ))}
            <div className="rounded-xl border border-[var(--mc-divider)] p-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-primary)]">Follow-up</p>
              <p className="text-sm">{fmtDate(viewing.followUpDate)}</p>
            </div>
          </div>
        )}
      </PremiumModal>
    </div>
  );
}
