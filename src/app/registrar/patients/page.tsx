'use client';

/**
 * REGISTRAR PATIENT REGISTRY — search + patient TIMELINE + edit. Instruction 21b.
 * Search → GET /api/patients?search= → DataTable. View → full encounter timeline
 * (GET /api/patients?patientTimeline=<id>): a vertical timeline of encounters
 * ordered by date — visit nodes expand to show treatments (consultations), lab
 * orders + results status, prescriptions, vitals (with recorder) and admissions.
 * Print actions: Admission Details / Lab Orders / Prescriptions / Lab Results /
 * Combined "COMPREHENSIVE PATIENT REPORT" via printUniversalDocument.
 * Edit → PUT /api/patients (registrar has write access, doctor does not).
 */

import * as React from 'react';
import {
  Users, Search, Eye, Pencil, IdCard, User, Phone, HeartPulse, Stethoscope, FilePlus2, FlaskConical, BedDouble, Activity,
  ChevronDown, ChevronRight, Printer, CalendarDays, Pill, ClipboardList, MapPin,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { printUniversalDocument, docSection, docTable, docRecordsTable } from '@/lib/document-print';
import {
  kes, fmtDate, fmtDateTime, age, isoDate, StatusBadge, PageHeading, Field, FormSection, McInput, McTextarea, McSelect, pname,
} from '@/app/clinical/_lib';

interface PatientRow {
  id: string;
  patientNo: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string | null;
  phone: string;
  county: string;
  paymentMode: string;
  _count?: { visits: number; prescriptions: number; labOrders: number };
  visits?: Array<{ visitNo: string; createdAt: string }>;
}

// ── Timeline shapes (GET /api/patients?patientTimeline=) ──
interface TimelinePatient {
  id: string; patientNo: string; firstName: string; lastName: string; gender: string; dateOfBirth: string | null;
  nationalId: string; phone: string; email: string; bloodType: string; allergies: string; maritalStatus: string;
  county: string; subCounty: string; location: string; village: string; address: string;
  kinName: string; kinRelationship: string; kinPhone: string;
  paymentMode: string; shaNumber: string; insuranceProvider: string; insuranceNo: string; createdAt: string;
}
interface TimelineVisit { id: string; visitNo: string; visitType: string; status: string; createdAt: string; notes: string; doctorId: string | null }
interface TimelineConsultation { id: string; visitId: string | null; consultationNo: string; chiefComplaint: string; diagnosis: string; treatmentPlan: string; status: string; createdAt: string }
interface TimelineLabItem { id: string; testName: string; result: string; resultValue: string; unit: string; flag: string; status: string }
interface TimelineLabOrder { id: string; visitId: string | null; orderNo: string; status: string; priority: string; requestSource: string; createdAt: string; items: TimelineLabItem[] }
interface TimelineRxItem { id: string; drugName: string; dosage: string; frequency: string; duration: string; quantity: number; instructions: string }
interface TimelinePrescription { id: string; visitId: string | null; prescriptionNo: string; status: string; createdAt: string; notes: string; items: TimelineRxItem[] }
interface TimelineVitals {
  id: string; visitId: string | null; recordedAt: string; temperature: number; bloodPressureSystolic: number;
  bloodPressureDiastolic: number; pulse: number; respiratoryRate: number; weight: number; height: number; bmi: number;
  oxygenSaturation: number; bloodGlucose: number; painScore: number; notes: string; recordedByName: string;
}
interface TimelineAdmission {
  id: string; visitId: string | null; admissionNo: string; admissionType: string; status: string;
  admissionDate: string; dischargeDate: string | null; dischargeType: string; admittingDiagnosis: string;
  bed?: { bedNumber: string; ward?: { name: string } | null } | null;
}
interface TimelineData {
  patient: TimelinePatient;
  visits: TimelineVisit[];
  consultations: TimelineConsultation[];
  labOrders: TimelineLabOrder[];
  prescriptions: TimelinePrescription[];
  vitals: TimelineVitals[];
  admissions: TimelineAdmission[];
}

type NodeKind = 'visit' | 'lab' | 'rx' | 'admission' | 'vitals';

interface TimelineNode {
  key: string;
  kind: NodeKind;
  date: string;
  label: string;
  sub: string;
  visit?: TimelineVisit;
  consultations?: TimelineConsultation[];
  labOrders?: TimelineLabOrder[];
  prescriptions?: TimelinePrescription[];
  vitals?: TimelineVitals[];
  admissions?: TimelineAdmission[];
}

const NODE_DOT: Record<NodeKind, string> = {
  visit: 'bg-[var(--mc-primary)]',
  lab: 'bg-violet-500',
  rx: 'bg-amber-500',
  admission: 'bg-rose-500',
  vitals: 'bg-teal-500',
};
const NODE_ICON: Record<NodeKind, React.ReactNode> = {
  visit: <Stethoscope className="h-3.5 w-3.5" />,
  lab: <FlaskConical className="h-3.5 w-3.5" />,
  rx: <Pill className="h-3.5 w-3.5" />,
  admission: <BedDouble className="h-3.5 w-3.5" />,
  vitals: <Activity className="h-3.5 w-3.5" />,
};
const NODE_LABEL: Record<NodeKind, string> = {
  visit: 'Visit', lab: 'Lab Order', rx: 'Prescription', admission: 'Admission', vitals: 'Vitals',
};

const GENDERS = ['MALE', 'FEMALE', 'UNKNOWN'];
const MARITAL = ['', 'SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED'];
const BLOOD_TYPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const PAYMENT_MODES = ['CASH', 'SHA', 'INSURANCE'];

const emptyEdit = {
  firstName: '', lastName: '', gender: 'MALE', dateOfBirth: '', nationalId: '', maritalStatus: '',
  bloodType: '', allergies: '', phone: '', email: '', county: '', subCounty: '', kinName: '', kinRelationship: '', kinPhone: '',
  paymentMode: 'CASH', shaNumber: '', insuranceProvider: '', insuranceNo: '',
};

const dayKey = (d: string) => new Date(d).toISOString().slice(0, 10);

export default function RegistrarPatientsPage() {
  const [rows, setRows] = React.useState<PatientRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  // Timeline modal
  const [viewing, setViewing] = React.useState<PatientRow | null>(null);
  const [timeline, setTimeline] = React.useState<TimelineData | null>(null);
  const [viewLoading, setViewLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  // Edit modal
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PatientRow | null>(null);
  const [editForm, setEditForm] = React.useState({ ...emptyEdit });
  const [saving, setSaving] = React.useState(false);

  const perPage = 20;

  const load = React.useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const res = await apiGet<{ patients: PatientRow[]; total: number }>(
        `/api/patients?perPage=${perPage}&page=${p}${q ? `&search=${encodeURIComponent(q)}` : ''}`,
      );
      setRows(res.patients || []);
      setTotal(res.total || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to search patients');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(search, page); }, [load, search, page]);

  const viewPatient = async (p: PatientRow) => {
    setViewing(p);
    setViewLoading(true);
    setTimeline(null);
    setExpanded(new Set());
    try {
      const res = await apiGet<TimelineData>(`/api/patients?patientTimeline=${p.id}`);
      setTimeline(res);
      // expand the most recent visit node by default
      const firstVisit = res.visits?.[0];
      if (firstVisit) setExpanded(new Set([`visit-${firstVisit.id}`]));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load patient timeline');
    } finally {
      setViewLoading(false);
    }
  };

  const openEdit = (p: PatientRow) => {
    setEditing(p);
    setEditForm({ ...emptyEdit }); // reset before async fill
    setEditOpen(true);
    (async () => {
      try {
        const res = await apiGet<{ patient: TimelinePatient & Record<string, unknown> }>(`/api/patients?id=${p.id}`);
        const full = res.patient;
        setEditForm({
          firstName: full.firstName || '',
          lastName: full.lastName || '',
          gender: full.gender || 'MALE',
          dateOfBirth: isoDate(full.dateOfBirth),
          nationalId: full.nationalId || '',
          maritalStatus: full.maritalStatus || '',
          bloodType: full.bloodType || '',
          allergies: full.allergies || '',
          phone: full.phone || '',
          email: full.email || '',
          county: full.county || '',
          subCounty: full.subCounty || '',
          kinName: full.kinName || '',
          kinRelationship: full.kinRelationship || '',
          kinPhone: full.kinPhone || '',
          paymentMode: full.paymentMode || 'CASH',
          shaNumber: full.shaNumber || '',
          insuranceProvider: full.insuranceProvider || '',
          insuranceNo: full.insuranceNo || '',
        });
      } catch {
        toast.error('Failed to load patient for editing');
      }
    })();
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) { toast.error('First and last name are required'); return; }
    setSaving(true);
    try {
      const res = await apiPut<{ message: string }>('/api/patients', {
        id: editing.id,
        ...editForm,
        dateOfBirth: editForm.dateOfBirth || null,
      });
      toast.success(res.message || 'Patient updated');
      setEditOpen(false);
      setEditing(null);
      load(search, page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update patient');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<PatientRow>[] = [
    {
      key: 'patientNo', header: 'Patient No.', defaultVisible: true,
      render: r => <span className="font-semibold text-[var(--mc-text-primary)]">{r.patientNo}</span>,
    },
    {
      key: 'name', header: 'Name', defaultVisible: true,
      csvValue: r => `${r.firstName} ${r.lastName}`,
      render: r => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--mc-text-primary)] truncate">{r.firstName} {r.lastName}</p>
          <p className="text-[11px] text-muted-foreground">{r.gender ? r.gender.toLowerCase() : '—'}</p>
        </div>
      ),
    },
    {
      key: 'dateOfBirth', header: 'Age', defaultVisible: true, sortable: true,
      csvValue: r => age(r.dateOfBirth),
      render: r => <span className="text-sm font-semibold">{age(r.dateOfBirth)} yrs</span>,
    },
    {
      key: 'phone', header: 'Phone', defaultVisible: true,
      render: r => <span className="text-xs">{r.phone || '—'}</span>,
    },
    { key: 'county', header: 'County', render: r => <span className="text-xs">{r.county || '—'}</span> },
    {
      key: 'paymentMode', header: 'Payment',
      render: r => (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">
          {r.paymentMode}
        </span>
      ),
    },
    { key: 'visits', header: 'Visits', align: 'right', csvValue: r => r._count?.visits ?? 0, render: r => <span className="text-xs font-semibold">{r._count?.visits ?? 0}</span> },
    { key: 'labOrders', header: 'Labs', align: 'right', csvValue: r => r._count?.labOrders ?? 0, render: r => <span className="text-xs font-semibold">{r._count?.labOrders ?? 0}</span> },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View patient timeline', variant: 'view', onClick: viewPatient },
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit patient', variant: 'edit', onClick: openEdit },
  ];

  const initials = (p: PatientRow | null) => p ? `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase() : '—';

  // ── Build timeline nodes (visits + standalone encounters), newest first ──
  const nodes: TimelineNode[] = React.useMemo(() => {
    if (!timeline) return [];
    const t = timeline;
    const visitIds = new Set(t.visits.map(v => v.id));
    const out: TimelineNode[] = [];

    for (const v of t.visits) {
      out.push({
        key: `visit-${v.id}`,
        kind: 'visit',
        date: v.createdAt,
        label: `${v.visitNo} · ${v.visitType.replaceAll('_', ' ')}`,
        sub: v.status,
        visit: v,
        consultations: t.consultations.filter(c => c.visitId === v.id),
        labOrders: t.labOrders.filter(o => o.visitId === v.id),
        prescriptions: t.prescriptions.filter(p => p.visitId === v.id),
        vitals: t.vitals.filter(x => x.visitId === v.id),
        admissions: t.admissions.filter(a => a.visitId === v.id),
      });
    }
    // Standalone encounters (no visit link) — grouped by kind
    for (const o of t.labOrders.filter(x => !x.visitId || !visitIds.has(x.visitId))) {
      out.push({ key: `lab-${o.id}`, kind: 'lab', date: o.createdAt, label: `${o.orderNo} · ${o.items.length} test(s)`, sub: o.status, labOrders: [o] });
    }
    for (const p of t.prescriptions.filter(x => !x.visitId || !visitIds.has(x.visitId))) {
      out.push({ key: `rx-${p.id}`, kind: 'rx', date: p.createdAt, label: `${p.prescriptionNo} · ${p.items.length} item(s)`, sub: p.status, prescriptions: [p] });
    }
    for (const a of t.admissions.filter(x => !x.visitId || !visitIds.has(x.visitId))) {
      out.push({
        key: `adm-${a.id}`, kind: 'admission', date: a.admissionDate,
        label: `${a.admissionNo} · ${a.bed ? `${a.bed.ward?.name || 'Ward'} bed ${a.bed.bedNumber}` : 'no bed'}`,
        sub: a.status, admissions: [a],
      });
    }
    // Visit-less vitals grouped per day
    const looseVitals = t.vitals.filter(x => !x.visitId || !visitIds.has(x.visitId));
    const byDay = new Map<string, TimelineVitals[]>();
    for (const x of looseVitals) {
      const k = dayKey(x.recordedAt);
      byDay.set(k, [...(byDay.get(k) || []), x]);
    }
    for (const [k, list] of byDay) {
      out.push({
        key: `vitals-${k}`, kind: 'vitals', date: list[0].recordedAt,
        label: `Vitals recorded (${list.length})`, sub: list[0].recordedByName || '', vitals: list,
      });
    }

    return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [timeline]);

  const toggleNode = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const allExpanded = timeline ? nodes.length > 0 && nodes.every(n => expanded.has(n.key)) : false;

  // ── Print helpers ──
  const p = timeline?.patient;

  const patientDetailsRows = (): Array<[string, string]> => [
    ['Patient Name', pname(p)],
    ['Patient No.', p?.patientNo || '—'],
    ['Gender', p?.gender ? p.gender.toLowerCase() : '—'],
    ['Age', p ? `${age(p.dateOfBirth)} yrs` : '—'],
    ['Date of Birth', fmtDate(p?.dateOfBirth)],
    ['National ID', p?.nationalId || '—'],
    ['Phone', p?.phone || '—'],
    ['Blood Type', p?.bloodType || '—'],
    ['Allergies', p?.allergies || 'None recorded'],
    ['Residence', [p?.subCounty, p?.county].filter(Boolean).join(', ') || '—'],
    ['Next of Kin', p?.kinName ? `${p.kinName} (${p.kinRelationship || 'kin'} · ${p.kinPhone || 'no phone'})` : '—'],
    ['Payment Mode', p?.paymentMode || '—'],
  ];

  const printBusyRef = React.useRef(false);
  const guardPrint = (fn: () => void | Promise<void>) => async () => {
    if (printBusyRef.current) return;
    printBusyRef.current = true;
    try { await fn(); } catch { toast.error('Failed to open print document'); } finally { printBusyRef.current = false; }
  };

  const printAdmissions = guardPrint(() => printUniversalDocument({
    title: 'ADMISSION DETAILS',
    docId: p?.patientNo,
    bodyHtml: docSection('PATIENT') + docTable(patientDetailsRows()) +
      docSection('ADMISSION HISTORY') +
      docRecordsTable(
        ['Admission No', 'Ward / Bed', 'Type', 'Admitted', 'Discharged', 'Diagnosis', 'Status'],
        (timeline?.admissions || []).map(a => [
          a.admissionNo,
          a.bed ? `${a.bed.ward?.name || 'Ward'} · Bed ${a.bed.bedNumber}` : 'No bed',
          a.admissionType,
          fmtDateTime(a.admissionDate),
          a.dischargeDate ? `${fmtDateTime(a.dischargeDate)}${a.dischargeType ? ` (${a.dischargeType})` : ''}` : 'Still admitted',
          a.admittingDiagnosis || '—',
          a.status,
        ]),
      ),
    footerNote: 'Admission details issued from the patient registry',
  }));

  const printLabOrders = guardPrint(() => printUniversalDocument({
    title: 'LAB ORDERS',
    docId: p?.patientNo,
    bodyHtml: docSection('PATIENT') + docTable(patientDetailsRows()) +
      (timeline?.labOrders || []).map(o =>
        docSection(`${o.orderNo} · ${fmtDateTime(o.createdAt)} · ${o.status}${o.requestSource === 'RECEPTIONIST' ? ' · ordered at reception' : ''}`) +
        docRecordsTable(
          ['Test', 'Status', 'Result', 'Value', 'Unit', 'Flag'],
          o.items.map(it => [it.testName, it.status, it.result || '—', it.resultValue || '—', it.unit || '—', it.flag || '—']),
        )
      ).join(''),
    footerNote: 'Laboratory orders issued from the patient registry',
  }));

  const printPrescriptions = guardPrint(() => printUniversalDocument({
    title: 'PRESCRIPTIONS',
    docId: p?.patientNo,
    bodyHtml: docSection('PATIENT') + docTable(patientDetailsRows()) +
      (timeline?.prescriptions || []).map(rx =>
        docSection(`${rx.prescriptionNo} · ${fmtDate(rx.createdAt)} · ${rx.status}`) +
        docRecordsTable(
          ['Drug', 'Dosage', 'Frequency', 'Duration', 'Qty', 'Instructions'],
          rx.items.map(it => [it.drugName, it.dosage || '—', it.frequency || '—', it.duration || '—', String(it.quantity), it.instructions || '—']),
        )
      ).join(''),
    footerNote: 'Prescription history issued from the patient registry',
  }));

  const printLabResults = guardPrint(() => printUniversalDocument({
    title: 'LAB RESULTS',
    docId: p?.patientNo,
    bodyHtml: docSection('PATIENT') + docTable(patientDetailsRows()) +
      (timeline?.labOrders || []).filter(o => o.items.some(it => it.result || it.resultValue)).map(o =>
        docSection(`${o.orderNo} · ${fmtDateTime(o.createdAt)} · ${o.status}`) +
        docRecordsTable(
          ['Test', 'Result', 'Value', 'Unit', 'Flag'],
          o.items.map(it => [it.testName, it.result || '—', it.resultValue || '—', it.unit || '—', it.flag || '—']),
        )
      ).join('') || '<p>No lab results recorded yet.</p>',
    footerNote: 'Laboratory results issued from the patient registry',
  }));

  const printCombined = guardPrint(() => printUniversalDocument({
    title: 'COMPREHENSIVE PATIENT REPORT',
    docId: p?.patientNo,
    bodyHtml:
      docSection('PATIENT DETAILS') + docTable(patientDetailsRows()) +
      docSection('VISITS') +
      docRecordsTable(
        ['Visit No', 'Type', 'Date', 'Status'],
        (timeline?.visits || []).map(v => [v.visitNo, v.visitType.replaceAll('_', ' '), fmtDateTime(v.createdAt), v.status]),
      ) +
      docSection('LAB RESULTS') +
      ((timeline?.labOrders || []).filter(o => o.items.some(it => it.result || it.resultValue)).map(o =>
        docRecordsTable(
          [`Test — ${o.orderNo} (${fmtDate(o.createdAt)})`, 'Result', 'Value', 'Unit', 'Flag'],
          o.items.map(it => [it.testName, it.result || '—', it.resultValue || '—', it.unit || '—', it.flag || '—']),
        )
      ).join('') || '<p>No lab results recorded.</p>') +
      docSection('PRESCRIPTIONS') +
      ((timeline?.prescriptions || []).map(rx =>
        docRecordsTable(
          [`Drug — ${rx.prescriptionNo} (${fmtDate(rx.createdAt)})`, 'Dosage', 'Frequency', 'Duration', 'Qty'],
          rx.items.map(it => [it.drugName, it.dosage || '—', it.frequency || '—', it.duration || '—', String(it.quantity)]),
        )
      ).join('') || '<p>No prescriptions recorded.</p>'),
    footerNote: 'Comprehensive patient report — all encounters',
  }));

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Users className="h-5 w-5" />}
        title="Patient Registry"
        subtitle="Search, review the encounter timeline and update registered patients"
      />

      <div className="flex flex-wrap items-center gap-2 no-print">
        <div className="relative flex-1 min-w-[240px]">
          <McInput
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, patient No., phone, national ID or SHA number…"
            className="pl-8"
          />
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setSearch(''); setPage(1); }}>Reset</Button>
      </div>

      <DataTable
        data={rows} columns={columns} actions={actions}
        rowKey={r => r.id} title="Patients" moduleLabel="Patient Registry"
        loading={loading} emptyMessage={search ? 'No patients match your search' : 'No patients registered yet'}
        page={page} perPage={perPage} total={total}
        onPageChange={p => setPage(p)}
      />

      {/* ── Patient timeline modal ── */}
      <PremiumModal
        open={!!viewing || viewLoading} onOpenChange={o => { if (!o) { setViewing(null); setTimeline(null); } }}
        size="xl"
        title={viewing ? `${viewing.firstName} ${viewing.lastName}` : 'Patient Timeline'}
        icon={<IdCard className="h-5 w-5" />}
        description={viewing ? `${viewing.patientNo} · ${viewing.gender.toLowerCase()} · ${age(viewing.dateOfBirth)} yrs · ${viewing.paymentMode}` : 'Loading patient record…'}
        footerNote="Encounter timeline — registration data can be corrected via the edit action"
      >
        {viewLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : timeline && p ? (
          <div className="space-y-4">
            {/* Patient summary */}
            <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)]">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full mc-gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {initials(viewing)}
                </div>
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{p.phone || '—'}</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><IdCard className="h-3 w-3" />{p.nationalId || '—'}</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><HeartPulse className="h-3 w-3" />{p.bloodType || '—'}</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><User className="h-3 w-3" />{p.kinName || '—'}</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{[p.subCounty, p.county].filter(Boolean).join(', ') || '—'}</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-3 w-3" />Registered {fmtDate(p.createdAt)}</span>
                </div>
              </div>
              {p.allergies && (
                <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1 inline-flex items-center gap-1">
                  ⚠ Allergies: {p.allergies}
                </p>
              )}
            </div>

            {/* Print actions + legend */}
            <div className="flex flex-wrap items-center gap-2 no-print rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-2">
              <Printer className="h-4 w-4 text-[var(--mc-primary)] ml-1" />
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={printAdmissions}>
                <BedDouble className="h-3.5 w-3.5" /> Admission Details
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={printLabOrders}>
                <FlaskConical className="h-3.5 w-3.5" /> Lab Orders
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={printPrescriptions}>
                <FilePlus2 className="h-3.5 w-3.5" /> Prescriptions
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={printLabResults}>
                <ClipboardList className="h-3.5 w-3.5" /> Lab Results
              </Button>
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={printCombined}>
                <Printer className="h-3.5 w-3.5" /> Combined Report
              </Button>
              <div className="flex-1" />
              <Button size="sm" variant="ghost" className="h-8 text-xs"
                onClick={() => setExpanded(allExpanded ? new Set() : new Set(nodes.map(n => n.key)))}>
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </Button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground no-print">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--mc-primary)]" /> visit</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> lab</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> prescription</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> admission</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-teal-500" /> vitals</span>
            </div>

            {/* Timeline */}
            {nodes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No encounters recorded for this patient yet.</p>
            ) : (
              <div className="relative pl-7">
                {/* left rail */}
                <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[var(--mc-divider)]" aria-hidden />
                <div className="space-y-2">
                  {nodes.map(node => {
                    const open = expanded.has(node.key);
                    return (
                      <div key={node.key} className="relative">
                        {/* dot */}
                        <span className={`absolute -left-[22px] top-3.5 h-[11px] w-[11px] rounded-full border-2 border-white shadow ${NODE_DOT[node.kind]}`} aria-hidden />
                        <div className={`rounded-xl border transition-colors ${open ? 'border-[var(--mc-primary)]' : 'border-[var(--mc-divider)]'} bg-white overflow-hidden`}>
                          <button
                            type="button"
                            onClick={() => toggleNode(node.key)}
                            className="w-full flex items-center gap-2 p-3 text-left cursor-pointer hover:bg-[var(--mc-bg-card)] transition-colors"
                          >
                            {open
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                            <span className="h-7 w-7 rounded-lg bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] flex items-center justify-center shrink-0">
                              {NODE_ICON[node.kind]}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-[var(--mc-text-primary)] truncate">{node.label}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {NODE_LABEL[node.kind]} · {fmtDateTime(node.date)}{node.sub ? ` · ${node.sub.replaceAll('_', ' ').toLowerCase()}` : ''}
                              </p>
                            </div>
                            {node.visit && <StatusBadge status={node.visit.status} />}
                          </button>

                          {open && (
                            <div className="border-t border-[var(--mc-divider)] p-3 space-y-3 bg-[var(--mc-bg-card)]/60">
                              {/* visit details */}
                              {node.visit && (
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">{node.visit.visitType.replaceAll('_', ' ')}</span>
                                  <span className="text-muted-foreground">opened {fmtDateTime(node.visit.createdAt)}</span>
                                  {node.visit.notes && <span className="text-[var(--mc-text-secondary)] italic">— {node.visit.notes}</span>}
                                </div>
                              )}

                              {/* treatments (consultations) */}
                              {(node.consultations?.length || 0) > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--mc-text-secondary)]">Treatments</p>
                                  {node.consultations!.map(c => (
                                    <div key={c.id} className="rounded-lg border border-[var(--mc-divider)] bg-white p-2.5 text-xs space-y-0.5">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-[var(--mc-text-primary)]">{c.consultationNo}</span>
                                        <StatusBadge status={c.status} />
                                        <span className="text-muted-foreground">{fmtDateTime(c.createdAt)}</span>
                                      </div>
                                      {c.chiefComplaint && <p><span className="font-semibold">Complaint:</span> {c.chiefComplaint}</p>}
                                      {c.diagnosis && <p><span className="font-semibold">Diagnosis:</span> {c.diagnosis}</p>}
                                      {c.treatmentPlan && <p><span className="font-semibold">Plan:</span> {c.treatmentPlan}</p>}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* lab orders */}
                              {(node.labOrders?.length || 0) > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">Laboratory</p>
                                  {node.labOrders!.map(o => (
                                    <div key={o.id} className="rounded-lg border border-violet-200 bg-white p-2.5">
                                      <div className="flex flex-wrap items-center gap-2 mb-1.5 text-xs">
                                        <span className="font-bold text-[var(--mc-text-primary)]">{o.orderNo}</span>
                                        <StatusBadge status={o.status} />
                                        <StatusBadge status={o.priority} />
                                        {o.requestSource === 'RECEPTIONIST' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">ordered at reception</span>}
                                        <span className="text-muted-foreground">{fmtDate(o.createdAt)}</span>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="mc-table">
                                          <thead><tr><th>Test</th><th>Status</th><th>Result</th><th>Value</th><th>Flag</th></tr></thead>
                                          <tbody>
                                            {o.items.map(it => (
                                              <tr key={it.id}>
                                                <td className="text-xs font-medium">{it.testName}</td>
                                                <td><StatusBadge status={it.status} /></td>
                                                <td className="text-xs">{it.result || '—'}</td>
                                                <td className="text-xs">{it.resultValue || '—'}{it.unit ? ` ${it.unit}` : ''}</td>
                                                <td>{it.flag ? <StatusBadge status={it.flag} /> : <span className="text-xs">—</span>}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* prescriptions */}
                              {(node.prescriptions?.length || 0) > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Prescriptions</p>
                                  {node.prescriptions!.map(rx => (
                                    <div key={rx.id} className="rounded-lg border border-amber-200 bg-white p-2.5">
                                      <div className="flex flex-wrap items-center gap-2 mb-1.5 text-xs">
                                        <span className="font-bold text-[var(--mc-text-primary)]">{rx.prescriptionNo}</span>
                                        <StatusBadge status={rx.status} />
                                        <span className="text-muted-foreground">{fmtDate(rx.createdAt)}</span>
                                      </div>
                                      <div className="text-xs space-y-0.5">
                                        {rx.items.map(it => (
                                          <p key={it.id} className="text-[var(--mc-text-secondary)]">
                                            • <span className="font-medium">{it.drugName}</span>
                                            {it.dosage && ` ${it.dosage}`}
                                            {it.frequency && `, ${it.frequency}`}
                                            {it.duration && ` × ${it.duration}`}
                                            {` (qty ${it.quantity})`}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* vitals */}
                              {(node.vitals?.length || 0) > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">Vitals Recorded</p>
                                  <div className="overflow-x-auto rounded-lg border border-teal-200">
                                    <table className="mc-table">
                                      <thead>
                                        <tr><th>Recorded</th><th>By</th><th>Temp °C</th><th>BP</th><th>Pulse</th><th>Weight</th><th>BMI</th><th>SpO₂</th><th>Glucose</th></tr>
                                      </thead>
                                      <tbody>
                                        {node.vitals!.map(v => (
                                          <tr key={v.id}>
                                            <td className="text-xs whitespace-nowrap">{fmtDateTime(v.recordedAt)}</td>
                                            <td className="text-xs">{v.recordedByName ? `by ${v.recordedByName}` : '—'}</td>
                                            <td className="text-xs">{v.temperature || '—'}</td>
                                            <td className="text-xs font-medium">{v.bloodPressureSystolic || '—'}/{v.bloodPressureDiastolic || '—'}</td>
                                            <td className="text-xs">{v.pulse || '—'}</td>
                                            <td className="text-xs">{v.weight || '—'}</td>
                                            <td className="text-xs font-semibold">{v.bmi || '—'}</td>
                                            <td className="text-xs">{v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—'}</td>
                                            <td className="text-xs">{v.bloodGlucose || '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* admissions */}
                              {(node.admissions?.length || 0) > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700">Admissions</p>
                                  {node.admissions!.map(a => (
                                    <div key={a.id} className="rounded-lg border border-rose-200 bg-white p-2.5 flex flex-wrap items-center gap-2 text-xs">
                                      <span className="font-bold text-[var(--mc-text-primary)]">{a.admissionNo}</span>
                                      <StatusBadge status={a.status} />
                                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">{a.admissionType}</span>
                                      <span className="text-muted-foreground">
                                        {a.bed ? `${a.bed.ward?.name || 'Ward'} · Bed ${a.bed.bedNumber}` : 'No bed'} · Admitted {fmtDate(a.admissionDate)}
                                        {a.dischargeDate && ` · Discharged ${fmtDate(a.dischargeDate)}`}
                                      </span>
                                      {a.admittingDiagnosis && <span className="text-[var(--mc-text-secondary)]">— {a.admittingDiagnosis.replace(/<[^>]*>/g, '').slice(0, 120)}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Patient not found.</p>
        )}
      </PremiumModal>

      {/* Edit modal */}
      <PremiumModal
        open={editOpen} onOpenChange={setEditOpen} size="lg"
        title={`Edit Patient — ${editing?.patientNo || ''}`}
        icon={<Pencil className="h-5 w-5" />}
        description={editing ? `${editing.firstName} ${editing.lastName}` : ''}
        footerNote="Patient numbers never change; corrections are audit-logged"
        submitLabel="Save Changes" onSubmit={saveEdit}
        submitting={saving} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Personal">
            <Field icon={<User className="h-3.5 w-3.5" />} label="First Name *">
              <McInput value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Last Name *">
              <McInput value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Gender">
              <McSelect value={editForm.gender} onValueChange={v => setEditForm(f => ({ ...f, gender: v }))} options={GENDERS.map(g => ({ value: g, label: g }))} />
            </Field>
            <Field icon={<HeartPulse className="h-3.5 w-3.5" />} label="Date of Birth">
              <McInput type="date" value={editForm.dateOfBirth} onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
            </Field>
            <Field icon={<IdCard className="h-3.5 w-3.5" />} label="National ID">
              <McInput value={editForm.nationalId} onChange={e => setEditForm(f => ({ ...f, nationalId: e.target.value }))} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Marital Status">
              <McSelect value={editForm.maritalStatus} onValueChange={v => setEditForm(f => ({ ...f, maritalStatus: v }))} options={MARITAL.map(m => ({ value: m, label: m || '—' }))} />
            </Field>
            <Field icon={<HeartPulse className="h-3.5 w-3.5" />} label="Blood Type">
              <McSelect value={editForm.bloodType} onValueChange={v => setEditForm(f => ({ ...f, bloodType: v }))} options={BLOOD_TYPES.map(b => ({ value: b, label: b || '—' }))} />
            </Field>
            <Field icon={<FlaskConical className="h-3.5 w-3.5" />} label="Allergies">
              <McTextarea value={editForm.allergies} onChange={e => setEditForm(f => ({ ...f, allergies: e.target.value }))} />
            </Field>
          </FormSection>
          <FormSection n={2} title="Contact">
            <Field icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
              <McInput value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Email">
              <McInput value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="County">
              <McInput value={editForm.county} onChange={e => setEditForm(f => ({ ...f, county: e.target.value }))} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Sub-County">
              <McInput value={editForm.subCounty} onChange={e => setEditForm(f => ({ ...f, subCounty: e.target.value }))} />
            </Field>
          </FormSection>
          <FormSection n={3} title="Next of Kin & Payment">
            <Field icon={<User className="h-3.5 w-3.5" />} label="Kin Name">
              <McInput value={editForm.kinName} onChange={e => setEditForm(f => ({ ...f, kinName: e.target.value }))} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Kin Relationship">
              <McInput value={editForm.kinRelationship} onChange={e => setEditForm(f => ({ ...f, kinRelationship: e.target.value }))} />
            </Field>
            <Field icon={<Phone className="h-3.5 w-3.5" />} label="Kin Phone">
              <McInput value={editForm.kinPhone} onChange={e => setEditForm(f => ({ ...f, kinPhone: e.target.value }))} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Payment Mode">
              <McSelect value={editForm.paymentMode} onValueChange={v => setEditForm(f => ({ ...f, paymentMode: v }))} options={PAYMENT_MODES.map(p => ({ value: p, label: p }))} />
            </Field>
            {editForm.paymentMode === 'SHA' && (
              <Field icon={<User className="h-3.5 w-3.5" />} label="SHA Number">
                <McInput value={editForm.shaNumber} onChange={e => setEditForm(f => ({ ...f, shaNumber: e.target.value }))} />
              </Field>
            )}
            {editForm.paymentMode === 'INSURANCE' && (
              <>
                <Field icon={<User className="h-3.5 w-3.5" />} label="Insurance Provider">
                  <McInput value={editForm.insuranceProvider} onChange={e => setEditForm(f => ({ ...f, insuranceProvider: e.target.value }))} />
                </Field>
                <Field icon={<User className="h-3.5 w-3.5" />} label="Policy Number">
                  <McInput value={editForm.insuranceNo} onChange={e => setEditForm(f => ({ ...f, insuranceNo: e.target.value }))} />
                </Field>
              </>
            )}
          </FormSection>
        </div>
      </PremiumModal>
    </div>
  );
}
