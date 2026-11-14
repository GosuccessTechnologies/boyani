'use client';

/**
 * NURSING ADMISSIONS & BED BOARD (Instruction 23).
 * GET /api/admissions?tab=ward-occupancy → ward cards with color-coded bed grids.
 * Admit modal: patient search, cascading Ward → Bed selects (ward from /api/wards,
 * beds filtered via /api/beds?wardId=&status=AVAILABLE), admission type, doctor and
 * a rich-text admitting diagnosis (Tiptap RichTextEditor). Admit stays disabled
 * until both ward and bed are chosen.
 * Discharge modal: discharge type + rich-text notes + "Prepare Discharge Letter"
 * which opens an editable, type-templated letter (placeholders auto-filled) with
 * "Print Letter Only" and "Print Letter + Full Report" (printUniversalDocument).
 */

import * as React from 'react';
import {
  BedDouble, Search, LogOut, User, Stethoscope, ClipboardList, RefreshCw, ArrowLeftRight, DoorClosed, Hospital,
  FileText, Printer, Building2,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { printUniversalDocument, docSection, docTable, docRecordsTable } from '@/lib/document-print';
import {
  kes, fmtDate, fmtDateTime, age, StatusBadge, PageHeading, Field, FormSection, McInput, McSelect, SkeletonCards, pname,
} from '@/app/clinical/_lib';

interface BedCell {
  id: string;
  bedNumber: string;
  status: string;
  currentPatient: string | null;
  currentPatientNo: string | null;
  currentAdmissionNo: string | null;
}

interface WardBoard {
  id: string;
  name: string;
  wardType: string;
  dailyRate: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  beds: BedCell[];
}

interface WardOption { id: string; name: string; wardType: string; dailyRate: number }
interface BedOption { id: string; bedNumber: string; ward?: { name?: string; dailyRate?: number } | null }

interface AdmissionRow {
  id: string;
  admissionNo: string;
  admissionType: string;
  status: string;
  admissionDate: string;
  dischargeDate: string | null;
  dischargeType: string;
  admittingDiagnosis: string;
  patient?: { id?: string; patientNo: string; firstName: string; lastName: string; phone?: string; paymentMode?: string; gender?: string; dateOfBirth?: string | null } | null;
  bed?: { bedNumber: string; ward?: { name: string; wardType: string; dailyRate: number } | null } | null;
}

interface PatientLite {
  id: string;
  patientNo: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface DoctorOption { id: string; name: string }

// Timeline data for the discharge full report
interface TlLabItem { id: string; testName: string; result: string; resultValue: string; unit: string; flag: string; status: string }
interface TlLabOrder { id: string; orderNo: string; status: string; createdAt: string; items: TlLabItem[] }
interface TlRxItem { id: string; drugName: string; dosage: string; frequency: string; duration: string; quantity: number }
interface TlPrescription { id: string; prescriptionNo: string; status: string; createdAt: string; items: TlRxItem[] }
interface TlVitals {
  id: string; recordedAt: string; temperature: number; bloodPressureSystolic: number; bloodPressureDiastolic: number;
  pulse: number; weight: number; bmi: number; oxygenSaturation: number; bloodGlucose: number; recordedByName: string;
}
interface TimelineData {
  patient: { patientNo: string; firstName: string; lastName: string; gender: string; dateOfBirth: string | null; nationalId: string; phone: string; bloodType: string; allergies: string; paymentMode: string };
  labOrders: TlLabOrder[];
  prescriptions: TlPrescription[];
  vitals: TlVitals[];
}

const ADMISSION_TYPES = ['EMERGENCY', 'ELECTIVE', 'MATERNITY', 'OBSERVATION'];
const DISCHARGE_TYPES = ['NORMAL', 'REFERRED', 'ABSCONDED', 'DECEASED'];

const BED_TONES: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100',
  OCCUPIED: 'bg-red-50 border-red-300 text-red-700',
  RESERVED: 'bg-amber-50 border-amber-300 text-amber-700',
  MAINTENANCE: 'bg-slate-100 border-slate-300 text-slate-500',
};

const stripHtml = (html: string) =>
  (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const emptyAdmit = { patientId: '', wardId: '', bedId: '', admissionType: 'EMERGENCY', doctorId: '', admittingDiagnosis: '' };
const emptyDischarge = { dischargeType: 'NORMAL', dischargeNotes: '' };

/** Discharge letter templates (Instruction 23) — placeholders auto-filled. */
function dischargeLetterTemplate(type: string, v: {
  patientName: string; admissionDate: string; dischargeDate: string; wardName: string; diagnosis: string;
}): string {
  const fill = (s: string) => s
    .replaceAll('{patientName}', v.patientName)
    .replaceAll('{admissionDate}', v.admissionDate)
    .replaceAll('{dischargeDate}', v.dischargeDate)
    .replaceAll('{wardName}', v.wardName)
    .replaceAll('{diagnosis}', v.diagnosis);

  switch (type) {
    case 'REFERRED':
      return fill(`<p>RE: REFERRAL FOR SPECIALIZED CARE — {patientName}</p>
<p>This is to certify that <strong>{patientName}</strong> was admitted to <strong>{wardName}</strong> on <strong>{admissionDate}</strong> and has been assessed by our clinical team.</p>
<p>For further specialized care that is not available at this facility, the patient is hereby referred to another healthcare facility. The referring diagnosis is documented as: <em>{diagnosis}</em>.</p>
<p>All relevant clinical notes, investigation results and treatment given during this admission accompany this letter to support continuity of care. The referral was arranged on <strong>{dischargeDate}</strong>.</p>
<p>We encourage the receiving facility to continue management as outlined in the accompanying summary.</p>`);
    case 'ABSCONDED':
      return fill(`<p>RE: DISCHARGE AGAINST MEDICAL ADVICE — {patientName}</p>
<p>This is to document that <strong>{patientName}</strong>, admitted to <strong>{wardName}</strong> on <strong>{admissionDate}</strong> with a diagnosis of <em>{diagnosis}</em>, left the facility on <strong>{dischargeDate}</strong> against medical advice (absconded).</p>
<p>The patient was counselled, and the risks of leaving before completing treatment — including worsening of the condition and possible complications — were fully explained and understood.</p>
<p>The patient was informed that the hospital door remains open should they wish to return and complete their treatment. This record is made for clinical and medico-legal purposes.</p>`);
    case 'DECEASED':
      return fill(`<p>RE: CONFIRMATION OF PASSING — {patientName}</p>
<p>It is with deep sorrow that we confirm the passing of <strong>{patientName}</strong>, who was under our care in <strong>{wardName}</strong> following admission on <strong>{admissionDate}</strong>.</p>
<p>The patient passed on <strong>{dischargeDate}</strong>. The cause of death, as documented from our clinical records, is stated as: <em>{diagnosis}</em>.</p>
<p>Our team provided all necessary care and support during the admission. We extend our heartfelt condolences to the family and loved ones, and we remain available for any further information, documentation or bereavement support required.</p>
<p>May the family find strength and comfort during this difficult time.</p>`);
    case 'NORMAL':
    default:
      return fill(`<p>RE: DISCHARGE CONFIRMATION — {patientName}</p>
<p>Dear <strong>{patientName}</strong>,</p>
<p>We are pleased to confirm that you have sufficiently recovered and are fit for discharge from <strong>{wardName}</strong>, where you were admitted on <strong>{admissionDate}</strong>. Your discharge date is <strong>{dischargeDate}</strong>.</p>
<p>During your admission you were managed for: <em>{diagnosis}</em>.</p>
<p><strong>Follow-up advice:</strong> please complete any prescribed medication as directed, keep your scheduled follow-up clinic appointment, maintain adequate rest and hydration, and return to the facility immediately should any concerning symptoms develop.</p>
<p>Thank you for allowing us to care for you. We wish you continued good health.</p>`);
  }
}

export default function NursingAdmissionsPage() {
  const [wards, setWards] = React.useState<WardBoard[]>([]);
  const [boardLoading, setBoardLoading] = React.useState(true);

  const [rows, setRows] = React.useState<AdmissionRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Admit modal
  const [admitOpen, setAdmitOpen] = React.useState(false);
  const [admitForm, setAdmitForm] = React.useState({ ...emptyAdmit });
  const [admitting, setAdmitting] = React.useState(false);
  const [patients, setPatients] = React.useState<PatientLite[]>([]);
  const [patientSearch, setPatientSearch] = React.useState('');
  const [doctors, setDoctors] = React.useState<DoctorOption[]>([]);
  const [wardOptions, setWardOptions] = React.useState<WardOption[]>([]);
  const [bedOptions, setBedOptions] = React.useState<BedOption[]>([]);
  const [bedsLoading, setBedsLoading] = React.useState(false);

  // Discharge modal
  const [dischargeOpen, setDischargeOpen] = React.useState(false);
  const [discharging, setDischarging] = React.useState<AdmissionRow | null>(null);
  const [dischargeForm, setDischargeForm] = React.useState({ ...emptyDischarge });
  const [dischargeBusy, setDischargeBusy] = React.useState(false);

  // Discharge letter modal
  const [letterOpen, setLetterOpen] = React.useState(false);
  const [letterHtml, setLetterHtml] = React.useState('');
  const [letterTimeline, setLetterTimeline] = React.useState<TimelineData | null>(null);
  const [letterBusy, setLetterBusy] = React.useState(false);

  const loadBoard = React.useCallback(async () => {
    setBoardLoading(true);
    try {
      const res = await apiGet<{ wards: WardBoard[] }>('/api/admissions?tab=ward-occupancy');
      setWards(res.wards || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load bed board');
    } finally {
      setBoardLoading(false);
    }
  }, []);

  const loadAdmissions = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ admissions: AdmissionRow[] }>('/api/admissions?perPage=100');
      setRows(res.admissions || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load admissions');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadBoard(); loadAdmissions(); }, [loadBoard, loadAdmissions]);

  const searchPatients = React.useCallback(async (q: string) => {
    try {
      const res = await apiGet<{ patients: PatientLite[] }>(
        `/api/patients?perPage=100${q ? `&search=${encodeURIComponent(q)}` : ''}`,
      );
      setPatients(res.patients || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to search patients');
    }
  }, []);

  // Doctors: user accounts when permitted (ADMIN), else public-style directory (NURSE-readable)
  const loadDoctors = React.useCallback(async () => {
    try {
      const res = await apiGet<{ users: Array<{ id: string; firstName: string; lastName: string; username: string }> }>('/api/users?role=DOCTOR&perPage=100');
      setDoctors((res.users || []).map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() || u.username })));
    } catch {
      try {
        const res = await apiGet<{ doctors: Array<{ id: string; employeeId: string; name: string }> }>('/api/doctors?perPage=100');
        setDoctors((res.doctors || []).map(d => ({ id: d.employeeId || d.id, name: d.name })));
      } catch {
        setDoctors([]);
      }
    }
  }, []);

  // Beds available inside the chosen ward (cascading select)
  const loadBedsForWard = React.useCallback(async (wardId: string) => {
    if (!wardId) { setBedOptions([]); return; }
    setBedsLoading(true);
    try {
      const res = await apiGet<{ beds: BedOption[] }>(`/api/beds?wardId=${wardId}&status=AVAILABLE&perPage=200`);
      setBedOptions(res.beds || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load beds for ward');
      setBedOptions([]);
    } finally {
      setBedsLoading(false);
    }
  }, []);

  const openAdmit = (bedId?: string, wardId?: string) => {
    setAdmitForm({ ...emptyAdmit, bedId: bedId || '', wardId: wardId || '' });
    setPatientSearch('');
    setBedOptions([]);
    searchPatients('');
    loadDoctors();
    (async () => {
      try {
        const res = await apiGet<{ wards: WardOption[] }>('/api/wards?perPage=100');
        setWardOptions(res.wards || []);
        if (wardId) loadBedsForWard(wardId);
      } catch {
        toast.error('Failed to load wards');
      }
    })();
    setAdmitOpen(true);
  };

  const submitAdmit = async () => {
    if (!admitForm.patientId) { toast.error('Select a patient'); return; }
    if (!admitForm.wardId) { toast.error('Select a ward first'); return; }
    if (!admitForm.bedId) { toast.error('Select an available bed in the ward'); return; }
    setAdmitting(true);
    try {
      const res = await apiPost<{ message: string }>('/api/admissions', {
        patientId: admitForm.patientId,
        bedId: admitForm.bedId,
        admissionType: admitForm.admissionType,
        doctorId: admitForm.doctorId,
        admittingDiagnosis: admitForm.admittingDiagnosis,
      });
      toast.success(res.message || 'Patient admitted');
      setAdmitOpen(false);
      loadBoard();
      loadAdmissions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to admit patient');
    } finally {
      setAdmitting(false);
    }
  };

  const openDischarge = (a: AdmissionRow) => {
    setDischarging(a);
    setDischargeForm({ ...emptyDischarge });
    setLetterHtml('');
    setLetterTimeline(null);
    setDischargeOpen(true);
  };

  const submitDischarge = async () => {
    if (!discharging) return;
    setDischargeBusy(true);
    try {
      const res = await apiPut<{ message: string }>('/api/admissions', {
        id: discharging.id,
        dischargeType: dischargeForm.dischargeType,
        dischargeNotes: dischargeForm.dischargeNotes,
      });
      toast.success(res.message || 'Patient discharged — bed freed');
      setDischargeOpen(false);
      setLetterOpen(false);
      setDischarging(null);
      loadBoard();
      loadAdmissions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to discharge patient');
    } finally {
      setDischargeBusy(false);
    }
  };

  // ── Discharge letter ──
  const prepareLetter = async () => {
    if (!discharging) return;
    setLetterBusy(true);
    const today = fmtDate(new Date());
    const values = {
      patientName: pname(discharging.patient),
      admissionDate: fmtDate(discharging.admissionDate),
      dischargeDate: today,
      wardName: discharging.bed?.ward?.name || 'the ward',
      diagnosis: stripHtml(discharging.admittingDiagnosis) || 'as documented in the clinical notes',
    };
    setLetterHtml(dischargeLetterTemplate(dischargeForm.dischargeType, values));
    setLetterOpen(true);
    // Full-report data (patient timeline) loads in parallel
    const patientId = discharging.patient?.id;
    if (patientId) {
      apiGet<TimelineData>(`/api/patients?patientTimeline=${patientId}`)
        .then(setLetterTimeline)
        .catch(() => setLetterTimeline(null));
    }
    setLetterBusy(false);
  };

  const daysAdmitted = discharging
    ? Math.max(1, Math.ceil((Date.now() - new Date(discharging.admissionDate).getTime()) / 86400000))
    : 0;

  const inStay = (x: string) => {
    if (!discharging) return true;
    const t = new Date(x).getTime();
    return t >= new Date(discharging.admissionDate).getTime() && t <= Date.now();
  };

  const printLetterOnly = async () => {
    try {
      await printUniversalDocument({
        title: 'DISCHARGE LETTER',
        docId: discharging?.admissionNo,
        bodyHtml: letterHtml,
        footerNote: 'Discharge letter — issued by the nursing office',
      });
    } catch {
      toast.error('Failed to open print document');
    }
  };

  const printLetterAndReport = async () => {
    if (!discharging) return;
    const p = letterTimeline?.patient;
    const stayLabs = (letterTimeline?.labOrders || []).filter(o => inStay(o.createdAt));
    const labs = stayLabs.length ? stayLabs : (letterTimeline?.labOrders || []);
    const stayRx = (letterTimeline?.prescriptions || []).filter(r => inStay(r.createdAt));
    const rx = stayRx.length ? stayRx : (letterTimeline?.prescriptions || []);
    const stayVitals = (letterTimeline?.vitals || []).filter(v => inStay(v.recordedAt));
    const vitals = stayVitals.length ? stayVitals : (letterTimeline?.vitals || []);

    const bodyHtml =
      // The letter itself
      `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:8px">${letterHtml}</div>` +
      docSection('PATIENT DETAILS') +
      docTable([
        ['Patient Name', pname(discharging.patient)],
        ['Patient No.', discharging.patient?.patientNo || '—'],
        ['Gender / Age', `${discharging.patient?.gender ? discharging.patient.gender.toLowerCase() : '—'} · ${age(discharging.patient?.dateOfBirth)} yrs`],
        ['Phone', discharging.patient?.phone || '—'],
        ['Payment Mode', discharging.patient?.paymentMode || '—'],
      ]) +
      docSection('ADMISSION DETAILS') +
      docTable([
        ['Admission No.', discharging.admissionNo],
        ['Ward / Bed', discharging.bed ? `${discharging.bed.ward?.name || 'Ward'} · Bed ${discharging.bed.bedNumber}` : '—'],
        ['Admission Type', discharging.admissionType],
        ['Admitted On', fmtDateTime(discharging.admissionDate)],
        ['Discharge Type', dischargeForm.dischargeType],
        ['Days Admitted', `${daysAdmitted} day(s)`],
      ]) +
      docSection('DIAGNOSIS REPORT') +
      `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:12px">${discharging.admittingDiagnosis ? stripHtml(discharging.admittingDiagnosis) : 'No admitting diagnosis documented.'}</div>` +
      (stripHtml(dischargeForm.dischargeNotes) ? `<p style="font-size:12px"><b>Discharge notes:</b> ${stripHtml(dischargeForm.dischargeNotes)}</p>` : '') +
      docSection('LAB RESULTS') +
      (labs.length
        ? labs.map(o => docRecordsTable(
            [`Test — ${o.orderNo} (${fmtDate(o.createdAt)})`, 'Result', 'Value', 'Unit', 'Flag'],
            o.items.map(it => [it.testName, it.result || '—', it.resultValue || '—', it.unit || '—', it.flag || '—']),
          )).join('')
        : '<p>No laboratory results recorded during this admission.</p>') +
      docSection('PRESCRIPTIONS TAKEN') +
      (rx.length
        ? rx.map(r => docRecordsTable(
            [`Drug — ${r.prescriptionNo} (${fmtDate(r.createdAt)})`, 'Dosage', 'Frequency', 'Duration', 'Qty'],
            r.items.map(it => [it.drugName, it.dosage || '—', it.frequency || '—', it.duration || '—', String(it.quantity)]),
          )).join('')
        : '<p>No prescriptions recorded during this admission.</p>') +
      docSection('VITAL RECORDS') +
      (vitals.length
        ? docRecordsTable(
            ['Recorded (date & time)', 'By', 'Temp °C', 'BP', 'Pulse', 'Weight', 'BMI', 'SpO₂', 'Glucose'],
            vitals.map(v => [
              fmtDateTime(v.recordedAt),
              v.recordedByName || '—',
              String(v.temperature || '—'),
              `${v.bloodPressureSystolic || '—'}/${v.bloodPressureDiastolic || '—'}`,
              String(v.pulse || '—'),
              String(v.weight || '—'),
              String(v.bmi || '—'),
              v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—',
              String(v.bloodGlucose || '—'),
            ]),
          )
        : '<p>No vital records captured during this admission.</p>');

    try {
      await printUniversalDocument({
        title: 'DISCHARGE SUMMARY & REPORT',
        docId: discharging.admissionNo,
        bodyHtml,
        footerNote: `Discharge summary & report — ${daysAdmitted} day(s) admission`,
      });
    } catch {
      toast.error('Failed to open print document');
    }
  };

  const availableBeds = wards.flatMap(w =>
    w.beds.filter(b => b.status === 'AVAILABLE').map(b => ({ value: b.id, label: `${w.name} · Bed ${b.bedNumber} · ${kes(w.dailyRate)}/day` })),
  );
  const patientOptions = patients.map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName} · ${p.patientNo}` }));

  const columns: Column<AdmissionRow>[] = [
    {
      key: 'admissionNo', header: 'Admission No.', defaultVisible: true,
      render: r => <span className="font-semibold text-[var(--mc-text-primary)]">{r.admissionNo}</span>,
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
      key: 'bed', header: 'Ward / Bed', defaultVisible: true,
      csvValue: r => r.bed ? `${r.bed.ward?.name || ''} ${r.bed.bedNumber}` : '—',
      render: r => r.bed ? (
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--mc-text-primary)]">{r.bed.ward?.name || 'Ward'}</p>
          <p className="text-[11px] text-muted-foreground">Bed {r.bed.bedNumber}</p>
        </div>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: 'status', header: 'Status', defaultVisible: true,
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'admissionType', header: 'Type',
      render: r => <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">{r.admissionType}</span>,
    },
    {
      key: 'admissionDate', header: 'Admitted', sortable: true,
      csvValue: r => fmtDateTime(r.admissionDate),
      render: r => <span className="text-xs whitespace-nowrap">{fmtDateTime(r.admissionDate)}</span>,
    },
    {
      key: 'dischargeDate', header: 'Discharged',
      csvValue: r => fmtDate(r.dischargeDate),
      render: r => <span className="text-xs whitespace-nowrap">{fmtDate(r.dischargeDate)}</span>,
    },
    {
      key: 'admittingDiagnosis', header: 'Diagnosis',
      csvValue: r => stripHtml(r.admittingDiagnosis),
      render: r => <span className="text-xs text-muted-foreground line-clamp-2">{stripHtml(r.admittingDiagnosis).slice(0, 90) || '—'}</span>,
    },
  ];

  const actions: ActionBtn[] = [
    { icon: <LogOut className="h-4 w-4" />, title: 'Discharge patient', variant: 'edit', onClick: openDischarge },
  ];

  const totalBeds = wards.reduce((s, w) => s + w.totalBeds, 0);
  const occupied = wards.reduce((s, w) => s + w.occupiedBeds, 0);
  const available = wards.reduce((s, w) => s + w.availableBeds, 0);
  const activeAdmissions = rows.filter(r => r.status === 'ACTIVE').length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<BedDouble className="h-5 w-5" />}
        title="Admissions & Bed Board"
        subtitle="Live ward occupancy — admit patients to beds and discharge to free them"
        actions={
          <>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => { loadBoard(); loadAdmissions(); }}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" className="gap-1" onClick={() => openAdmit()}>
              <ArrowLeftRight className="h-4 w-4" /> Admit Patient
            </Button>
          </>
        }
      />

      {loading || boardLoading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Active Admissions" value={activeAdmissions} icon={<Hospital className="h-5 w-5" />} accent="primary" />
          <StatCard label="Occupied Beds" value={occupied} icon={<BedDouble className="h-5 w-5" />} accent="danger" hint={`${totalBeds ? Math.round((occupied / totalBeds) * 100) : 0}% of ${totalBeds}`} />
          <StatCard label="Available Beds" value={available} icon={<DoorClosed className="h-5 w-5" />} accent="success" />
          <StatCard label="Wards" value={wards.length} icon={<Hospital className="h-5 w-5" />} accent="secondary" />
        </div>
      )}

      {/* Ward cards grid with bed grids */}
      {boardLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 rounded-xl border bg-white animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wards.map(w => (
            <div key={w.id} className="rounded-xl border border-[var(--mc-divider)] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
                  <BedDouble className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-[var(--mc-text-primary)] truncate">{w.name}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {w.wardType?.replaceAll('_', ' ')} · {kes(w.dailyRate)}/day · {w.occupiedBeds}/{w.totalBeds} occupied
                  </p>
                </div>
                <StatusBadge status="AVAILABLE" />
                <span className="text-[11px] text-muted-foreground">{w.availableBeds} free</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {w.beds.map(b => (
                  <button
                    key={b.id}
                    type="button"
                    title={
                      b.status === 'OCCUPIED'
                        ? `Bed ${b.bedNumber} — ${b.currentPatient} (${b.currentPatientNo})`
                        : b.status === 'AVAILABLE'
                          ? `Bed ${b.bedNumber} — available, click to admit`
                          : `Bed ${b.bedNumber} — ${b.status.toLowerCase()}`
                    }
                    disabled={b.status !== 'AVAILABLE'}
                    onClick={() => openAdmit(b.id, w.id)}
                    className={`rounded-lg border p-2 text-left transition-colors ${BED_TONES[b.status] || BED_TONES.MAINTENANCE} ${b.status === 'AVAILABLE' ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <p className="text-[11px] font-bold truncate">{b.bedNumber}</p>
                    <p className="text-[10px] truncate leading-tight">
                      {b.status === 'OCCUPIED' ? (b.currentPatient || 'Occupied') : b.status}
                    </p>
                  </button>
                ))}
                {w.beds.length === 0 && <p className="text-xs text-muted-foreground col-span-4 py-2">No beds registered in this ward.</p>}
              </div>
            </div>
          ))}
          {wards.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2 text-center py-10">No wards configured — an administrator sets up wards & beds.</p>
          )}
        </div>
      )}

      {/* Admissions table */}
      <DataTable
        data={rows} columns={columns} actions={actions}
        rowKey={r => r.id} title="Admissions" moduleLabel="Nursing Admissions"
        loading={loading} emptyMessage="No admissions recorded yet"
      />

      {/* Admit modal — ward → bed cascade + rich-text diagnosis */}
      <PremiumModal
        open={admitOpen} onOpenChange={setAdmitOpen} size="lg"
        title="Admit Patient to Bed"
        icon={<BedDouble className="h-5 w-5" />}
        description="An INPATIENT visit opens automatically if none is active — daily ward rates bill to the visit"
        footerNote="Choose the ward first, then one of its available beds"
        submitLabel="Admit Patient" onSubmit={submitAdmit}
        submitting={admitting} secondaryLabel="Cancel"
        submitDisabled={!admitForm.patientId || !admitForm.wardId || !admitForm.bedId}
      >
        <div className="space-y-5">
          <FormSection n={1} title="Patient">
            <Field icon={<Search className="h-3.5 w-3.5" />} label="Search Patients">
              <div className="flex gap-2">
                <McInput
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Name, patient No., phone…"
                  onKeyDown={e => { if (e.key === 'Enter') searchPatients(patientSearch); }}
                />
                <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={() => searchPatients(patientSearch)}>
                  <Search className="h-4 w-4" /> Search
                </Button>
              </div>
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Patient *">
              <McSelect value={admitForm.patientId} onValueChange={v => setAdmitForm(f => ({ ...f, patientId: v }))} options={patientOptions} placeholder="Select patient…" />
            </Field>
          </FormSection>

          <FormSection n={2} title="Ward & Bed">
            <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Ward *" hint={wardOptions.length ? `${wardOptions.length} ward(s)` : 'Loading wards…'}>
              <McSelect
                value={admitForm.wardId}
                onValueChange={v => {
                  setAdmitForm(f => ({ ...f, wardId: v, bedId: '' }));
                  loadBedsForWard(v);
                }}
                options={wardOptions.map(w => ({ value: w.id, label: `${w.name} · ${w.wardType.replaceAll('_', ' ').toLowerCase()}` }))}
                placeholder="Select ward first…"
              />
            </Field>
            <Field icon={<BedDouble className="h-3.5 w-3.5" />} label="Bed *"
              hint={!admitForm.wardId ? 'Choose a ward to list its free beds' : bedsLoading ? 'Loading beds…' : `${bedOptions.length} bed(s) free in this ward`}>
              <McSelect
                value={admitForm.bedId}
                onValueChange={v => setAdmitForm(f => ({ ...f, bedId: v }))}
                options={bedOptions.map(b => ({
                  value: b.id,
                  label: `Bed ${b.bedNumber}${b.ward?.dailyRate ? ` · ${kes(b.ward.dailyRate)}/day` : ''}`,
                }))}
                placeholder={admitForm.wardId ? 'Select an available bed…' : 'Select ward first…'}
              />
            </Field>
            <Field icon={<ClipboardList className="h-3.5 w-3.5" />} label="Admission Type">
              <McSelect
                value={admitForm.admissionType}
                onValueChange={v => setAdmitForm(f => ({ ...f, admissionType: v }))}
                options={ADMISSION_TYPES.map(t => ({ value: t, label: t }))}
              />
            </Field>
            <Field icon={<Stethoscope className="h-3.5 w-3.5" />} label="Attending Doctor">
              <McSelect
                value={admitForm.doctorId}
                onValueChange={v => setAdmitForm(f => ({ ...f, doctorId: v }))}
                options={doctors.map(d => ({ value: d.id, label: d.name }))}
                placeholder="Select doctor…"
              />
            </Field>
            <Field icon={<Stethoscope className="h-3.5 w-3.5" />} label="Admitting Diagnosis" className="sm:col-span-2">
              <RichTextEditor
                value={admitForm.admittingDiagnosis}
                onChange={v => setAdmitForm(f => ({ ...f, admittingDiagnosis: v }))}
                placeholder="e.g. Severe malaria requiring inpatient management — document history, findings and plan…"
                minHeight={140}
              />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>

      {/* Discharge modal */}
      <PremiumModal
        open={dischargeOpen} onOpenChange={setDischargeOpen} size="md"
        title={`Discharge — ${discharging?.admissionNo || ''}`}
        icon={<LogOut className="h-5 w-5" />}
        description={discharging ? `${pname(discharging.patient)} · ${discharging.bed ? `${discharging.bed.ward?.name || 'Ward'} bed ${discharging.bed.bedNumber}` : 'no bed'} · ${daysAdmitted} day(s)` : ''}
        footerNote="The bed is freed immediately; a doctor's discharge moves the visit to payment"
        submitLabel="Discharge Patient" onSubmit={submitDischarge}
        submitting={dischargeBusy} secondaryLabel="Cancel"
        extraFooter={
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={prepareLetter} disabled={letterBusy}>
            <FileText className="h-4 w-4" /> Prepare Discharge Letter
          </Button>
        }
      >
        <div className="space-y-4">
          <FormSection n={1} title="Discharge Details">
            <Field icon={<ClipboardList className="h-3.5 w-3.5" />} label="Discharge Type">
              <McSelect
                value={dischargeForm.dischargeType}
                onValueChange={v => setDischargeForm(f => ({ ...f, dischargeType: v }))}
                options={DISCHARGE_TYPES.map(t => ({ value: t, label: t }))}
              />
            </Field>
            <Field icon={<ClipboardList className="h-3.5 w-3.5" />} label="Discharge Notes" className="sm:col-span-2">
              <RichTextEditor
                value={dischargeForm.dischargeNotes}
                onChange={v => setDischargeForm(f => ({ ...f, dischargeNotes: v }))}
                placeholder="Condition at discharge, medication to take home, follow-up instructions…"
                minHeight={150}
              />
            </Field>
          </FormSection>
          <p className="text-[11px] text-muted-foreground">
            The discharge letter template follows the selected type — prepare it, edit as needed, then print.
          </p>
        </div>
      </PremiumModal>

      {/* Discharge letter modal — editable template + print options */}
      <PremiumModal
        open={letterOpen} onOpenChange={setLetterOpen} size="lg"
        title={`Discharge Letter — ${dischargeForm.dischargeType}`}
        icon={<FileText className="h-5 w-5" />}
        description={discharging ? `${pname(discharging.patient)} · ${discharging.admissionNo}` : ''}
        footerNote="Letterhead & document background are applied automatically when printing"
        submitLabel="Print Letter Only" onSubmit={printLetterOnly}
        secondaryLabel="Print Letter + Full Report" onSecondary={printLetterAndReport}
        extraFooter={
          <Button type="button" size="sm" variant="ghost" onClick={() => setLetterOpen(false)}>Close</Button>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-2.5 text-[11px] text-muted-foreground">
            <Printer className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
            Placeholders were auto-filled ({'{patientName}'}, {'{admissionDate}'}, {'{dischargeDate}'}, {'{wardName}'}, {'{diagnosis}'}) — edit freely below.
            {!letterTimeline && discharging?.patient?.id && <span className="text-amber-700">Loading report data…</span>}
          </div>
          <RichTextEditor
            value={letterHtml}
            onChange={setLetterHtml}
            placeholder="Discharge letter body…"
            minHeight={320}
          />
        </div>
      </PremiumModal>
    </div>
  );
}
