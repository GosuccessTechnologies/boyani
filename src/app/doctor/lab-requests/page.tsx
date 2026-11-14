'use client';

/**
 * DOCTOR LAB REQUESTS (Instruction 21) — the doctor-side laboratory workflow.
 * GET /api/lab-orders?doctorId=… lists orders for the doctor's patients from ALL
 * sources (doctor, nurse, registrar). "New Lab Request" opens a PremiumModal:
 * debounced patient search (/api/patients?search=) then the FULL facility lab
 * test catalog (/api/services?category=LABORATORY&public=1) — searchable,
 * price-filterable, click-to-recommend cards; selected tests collect as chips
 * with quantity and POST to /api/lab-orders {patientId, priority, items:[{serviceId,
 * testName, price}]} (auto-billed to the visit). Results view shows per-item
 * value/unit/flag plus the doctor's medication notes (PUT action:'doctor-notes').
 * Prints: LABORATORY REQUEST + LABORATORY RESULT REPORT via printUniversalDocument.
 */

import * as React from 'react';
import {
  FlaskConical, Plus, Eye, Printer, FileCheck2, Search, User, TestTube2, Gauge, Clock3,
  CheckCircle2, X, ShieldCheck, Stethoscope, Save, Activity,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPut } from '@/lib/client-api';
import { printUniversalDocument, docSection, docTable, docRecordsTable } from '@/lib/document-print';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  kes, fmtDate, fmtDateTime, age, StatusBadge, PageHeading, Field, McInput, McSelect, SkeletonCards, pname,
} from '@/app/clinical/_lib';

// ── API shapes ──
interface LabOrderRow {
  id: string;
  orderNo: string;
  priority: string;
  status: string;
  createdAt: string;
  requestedByName?: string;
  requestSource?: string;
  patient?: { patientNo: string; firstName: string; lastName: string; phone?: string; gender?: string } | null;
  _count?: { items: number };
}

interface LabOrderItem {
  id: string;
  testName: string;
  result: string;
  resultValue: string;
  unit: string;
  flag: string;
  status: string;
  remarks: string;
  narrative?: string;
  labTest?: { code?: string; referenceRange?: string; specimenType?: string; category?: string; service?: { price: number } | null } | null;
}

interface LabOrderFull extends LabOrderRow {
  notes?: string;
  doctorNotes?: string;
  visitId?: string | null;
  patient?: {
    patientNo: string; firstName: string; lastName: string; phone: string; gender: string;
    dateOfBirth: string | null; bloodType?: string; paymentMode?: string;
  } | null;
  items?: LabOrderItem[];
}

interface PatientLite {
  id: string;
  patientNo: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string | null;
  phone: string;
}

interface CatalogService {
  id: string;
  code: string;
  name: string;
  price: number;
  shaCovered: boolean;
}

interface SelectedTest {
  serviceId: string;
  testName: string;
  price: number;
  qty: number;
}

const PRIORITIES = ['ROUTINE', 'URGENT', 'STAT'];

const PRICE_BANDS = [
  { key: 'ALL', label: 'All tests', match: (_p: number) => true },
  { key: 'LOW', label: 'Under KSh 1,000', match: (p: number) => p < 1000 },
  { key: 'MID', label: 'KSh 1,000 – 2,500', match: (p: number) => p >= 1000 && p <= 2500 },
  { key: 'HIGH', label: 'Above KSh 2,500', match: (p: number) => p > 2500 },
] as const;

type FilterTab = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ALL';
const FILTERS: Array<{ key: FilterTab; label: string; match: (s: string) => boolean }> = [
  { key: 'PENDING', label: 'Pending', match: s => s === 'PENDING' || s === 'SAMPLE_COLLECTED' },
  { key: 'IN_PROGRESS', label: 'In Progress', match: s => s === 'IN_PROGRESS' },
  { key: 'COMPLETED', label: 'Results Ready', match: s => s === 'COMPLETED' || s === 'VERIFIED' },
  { key: 'ALL', label: 'All', match: () => true },
];

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

const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function DoctorLabRequestsPage() {
  const { user } = useAuthStore();
  const [rows, setRows] = React.useState<LabOrderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<FilterTab>('ALL');

  // View / results modal
  const [viewing, setViewing] = React.useState<LabOrderFull | null>(null);
  const [viewLoading, setViewLoading] = React.useState(false);
  const [notesDraft, setNotesDraft] = React.useState('');
  const [savingNotes, setSavingNotes] = React.useState(false);

  // New lab request modal
  const [modalOpen, setModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [patientSearch, setPatientSearch] = React.useState('');
  const [patients, setPatients] = React.useState<PatientLite[]>([]);
  const [patientsLoading, setPatientsLoading] = React.useState(false);
  const [patientId, setPatientId] = React.useState('');
  const [priority, setPriority] = React.useState('ROUTINE');
  const [catalog, setCatalog] = React.useState<CatalogService[]>([]);
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [testSearch, setTestSearch] = React.useState('');
  const [priceBand, setPriceBand] = React.useState<(typeof PRICE_BANDS)[number]['key']>('ALL');
  const [selected, setSelected] = React.useState<SelectedTest[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const scope = user?.role === 'DOCTOR' && user?.id ? `&doctorId=${user.id}` : '';
      const res = await apiGet<{ labOrders: LabOrderRow[] }>(`/api/lab-orders?perPage=200${scope}`);
      setRows(res.labOrders || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load lab orders');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  React.useEffect(() => { load(); }, [load]);

  // Debounced patient search for the request modal
  React.useEffect(() => {
    if (!modalOpen) return;
    const t = setTimeout(async () => {
      setPatientsLoading(true);
      try {
        const res = await apiGet<{ patients: PatientLite[] }>(
          `/api/patients?perPage=20${patientSearch ? `&search=${encodeURIComponent(patientSearch)}` : ''}`,
        );
        setPatients(res.patients || []);
      } catch {
        setPatients([]);
      } finally {
        setPatientsLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [patientSearch, modalOpen]);

  // Facility lab test catalog — all possible tests the doctor can recommend
  const loadCatalog = React.useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await apiGet<{ services: CatalogService[] }>('/api/services?category=LABORATORY&public=1');
      setCatalog(res.services || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load lab test catalog');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const openCreate = () => {
    setPatientSearch('');
    setPatientId('');
    setPriority('ROUTINE');
    setTestSearch('');
    setPriceBand('ALL');
    setSelected([]);
    setPatients([]);
    loadCatalog();
    setModalOpen(true);
  };

  const toggleTest = (s: CatalogService) => {
    setSelected(prev => {
      const idx = prev.findIndex(t => t.serviceId === s.id);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { serviceId: s.id, testName: s.name, price: s.price, qty: 1 }];
    });
  };

  const setQty = (serviceId: string, qty: number) => {
    setSelected(prev => prev.map(t => (t.serviceId === serviceId ? { ...t, qty: Math.max(1, qty) } : t)));
  };

  const selectedPatient = patients.find(p => p.id === patientId);

  const submitRequest = async () => {
    if (!patientId) { toast.error('Search and select the patient for this request'); return; }
    if (selected.length === 0) { toast.error('Select at least one test from the catalog'); return; }
    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string }>('/api/lab-orders', {
        patientId,
        priority,
        requestSource: 'DOCTOR',
        items: selected.flatMap(t => Array.from({ length: t.qty }, () => ({
          serviceId: t.serviceId,
          testName: t.testName,
          price: t.price,
        }))),
      });
      toast.success(res.message || 'Lab request sent to the laboratory');
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send lab request');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchFull = async (id: string): Promise<LabOrderFull | null> => {
    try {
      const res = await apiGet<{ labOrder: LabOrderFull }>(`/api/lab-orders?id=${id}`);
      return res.labOrder;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load lab order');
      return null;
    }
  };

  const viewOrder = async (o: LabOrderRow) => {
    setViewLoading(true);
    setViewing(null);
    setNotesDraft('');
    const full = await fetchFull(o.id);
    setViewing(full);
    setNotesDraft(full?.doctorNotes || '');
    setViewLoading(false);
  };

  // Doctor medication/interpretation notes under the results
  const saveNotes = async () => {
    if (!viewing) return;
    setSavingNotes(true);
    try {
      const res = await apiPut<{ message: string }>('/api/lab-orders', {
        action: 'doctor-notes',
        id: viewing.id,
        notes: notesDraft,
      });
      toast.success(res.message || 'Doctor notes saved');
      setViewing(v => (v ? { ...v, doctorNotes: notesDraft } : v));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const hasResults = (o: LabOrderFull) => (o.items || []).some(i => i.status === 'COMPLETED' || i.result || i.resultValue);

  // ── Prints ──
  const patientDetailsTable = (o: LabOrderFull) => docTable([
    ['Patient Name', esc(pname(o.patient))],
    ['Patient No', esc(o.patient?.patientNo || '—')],
    ['Age / Gender', `${age(o.patient?.dateOfBirth)} / ${esc(o.patient?.gender || '—')}`],
    ['Phone', esc(o.patient?.phone || '—')],
  ]);

  const printRequest = async (o: LabOrderRow) => {
    const full = (await fetchFull(o.id)) || (o as LabOrderFull);
    const items = full.items || [];
    const bodyHtml = [
      docSection('Patient Details'),
      patientDetailsTable(full),
      docSection('Request Information'),
      docTable([
        ['Order No', esc(full.orderNo)],
        ['Requested By', esc(full.requestedByName || '—')],
        ['Request Date', esc(fmtDateTime(full.createdAt))],
        ['Priority', esc(full.priority || 'ROUTINE')],
      ]),
      docSection('Tests Requested'),
      docRecordsTable(['#', 'Test', 'Code', 'Price'], items.map((it, i) => [
        String(i + 1),
        esc(it.testName),
        esc(it.labTest?.code || '—'),
        it.labTest?.service ? kes(it.labTest.service.price) : '—',
      ])),
      docSection('Clinical Notes'),
      `<p>${full.notes ? esc(full.notes) : '—'}</p>`,
    ].join('');
    printUniversalDocument({
      title: 'LABORATORY REQUEST',
      docId: full.orderNo,
      bodyHtml,
      footerNote: 'Laboratory test request form — specimen collection at the laboratory',
    });
  };

  const printResult = async (o: LabOrderRow) => {
    const full = (await fetchFull(o.id)) || (o as LabOrderFull);
    const items = full.items || [];
    const bodyHtml = [
      docSection('Patient Details'),
      patientDetailsTable(full),
      docSection('Order Information'),
      docTable([
        ['Order No', esc(full.orderNo)],
        ['Report Date', esc(fmtDateTime(new Date().toISOString()))],
        ['Order Date', esc(fmtDateTime(full.createdAt))],
        ['Status', esc(full.status.replaceAll('_', ' '))],
      ]),
      docSection('Results'),
      docRecordsTable(['Test', 'Result', 'Value', 'Unit', 'Flag'], items.map(it => [
        esc(it.testName),
        esc(stripHtml(it.result) || '—'),
        esc(it.resultValue || '—'),
        esc(it.unit || '—'),
        esc(it.flag || '—'),
      ])),
      ...items.filter(it => it.narrative && stripHtml(it.narrative)).map(it =>
        `${docSection(`Narrative — ${esc(it.testName)}`)}${it.narrative}`),
      docSection('Doctor Notes / Medication'),
      full.doctorNotes && stripHtml(full.doctorNotes) ? full.doctorNotes : '<p>—</p>',
    ].join('');
    printUniversalDocument({
      title: 'LABORATORY RESULT REPORT',
      docId: full.orderNo,
      bodyHtml,
      footerNote: 'Laboratory result report — verified results are final',
    });
  };

  // ── Table ──
  const columns: Column<LabOrderRow>[] = [
    {
      key: 'orderNo', header: 'Order No.', defaultVisible: true,
      render: r => <span className="font-semibold text-[var(--mc-text-primary)]">{r.orderNo}</span>,
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
      key: 'items', header: 'Tests', defaultVisible: true, align: 'right',
      csvValue: r => r._count?.items ?? 0,
      render: r => <span className="font-semibold">{r._count?.items ?? 0}</span>,
    },
    {
      key: 'requestedByName', header: 'Requested By', defaultVisible: true,
      csvValue: r => r.requestedByName || '—',
      render: r => (
        <div className="min-w-0">
          <p className="text-xs text-[var(--mc-text-secondary)] truncate">{r.requestedByName || '—'}</p>
          {r.requestSource && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">{r.requestSource}</span>
          )}
        </div>
      ),
    },
    { key: 'priority', header: 'Priority', defaultVisible: true, render: r => <StatusBadge status={r.priority} /> },
    { key: 'status', header: 'Status', defaultVisible: true, render: r => <StatusBadge status={r.status} /> },
    {
      key: 'createdAt', header: 'Date', defaultVisible: true, sortable: true,
      csvValue: r => fmtDate(r.createdAt),
      render: r => <span className="text-xs whitespace-nowrap">{fmtDate(r.createdAt)}</span>,
    },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View order & results', variant: 'view', onClick: viewOrder },
    { icon: <Printer className="h-4 w-4" />, title: 'Print lab request', variant: 'print', onClick: printRequest },
    { icon: <FileCheck2 className="h-4 w-4" />, title: 'Print lab result report', variant: 'download', onClick: printResult },
  ];

  const filtered = rows.filter(r => FILTERS.find(f => f.key === filter)!.match(r.status));
  const pendingCount = rows.filter(r => FILTERS[0].match(r.status)).length;
  const readyCount = rows.filter(r => FILTERS[2].match(r.status)).length;
  const inProgressCount = rows.filter(r => FILTERS[1].match(r.status)).length;

  const filteredCatalog = catalog.filter(s =>
    PRICE_BANDS.find(b => b.key === priceBand)!.match(s.price) &&
    (!testSearch || s.name.toLowerCase().includes(testSearch.toLowerCase()) || s.code.toLowerCase().includes(testSearch.toLowerCase()))
  );

  const catalogGrouped = React.useMemo(() => {
    const groups = new Map<string, CatalogService[]>();
    for (const s of filteredCatalog) {
      const letter = s.name.charAt(0).toUpperCase();
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter)!.push(s);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredCatalog]);

  const totalEstimate = selected.reduce((sum, t) => sum + t.price * t.qty, 0);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<FlaskConical className="h-5 w-5" />}
        title="Lab Requests"
        subtitle="Recommend laboratory tests for your patients and review results from every ordering source"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Lab Request</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Orders" value={rows.length} icon={<FlaskConical className="h-5 w-5" />} accent="primary" hint="for your patients" />
          <StatCard label="Pending" value={pendingCount} icon={<Clock3 className="h-5 w-5" />} accent="warning" hint="awaiting collection / tests" />
          <StatCard label="In Progress" value={inProgressCount} icon={<TestTube2 className="h-5 w-5" />} accent="secondary" hint="at the laboratory" />
          <StatCard label="Results Ready" value={readyCount} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" hint="completed / verified" />
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
              {rows.filter(x => f.match(x.status)).length}
            </span>
          </button>
        ))}
      </div>

      <DataTable
        data={filtered} columns={columns} actions={actions}
        rowKey={r => r.id} title="Lab Orders" moduleLabel="Doctor Lab Requests"
        loading={loading} emptyMessage="No lab orders for your patients yet"
      />

      {/* ── New lab request modal ── */}
      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="xl"
        title="New Lab Request"
        icon={<FlaskConical className="h-5 w-5" />}
        description="Search the patient, pick tests from the facility catalog and send to the laboratory"
        footerNote="Tests are billed to the patient's active visit (settled at the cashier)"
        submitLabel="Send Lab Request" onSubmit={submitRequest}
        submitting={submitting} secondaryLabel="Cancel"
        submitDisabled={!patientId || selected.length === 0}
      >
        <div className="space-y-5">
          {/* 1 — Patient */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-[var(--mc-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <h3 className="text-sm font-bold text-[var(--mc-text-primary)]">Patient</h3>
              <div className="flex-1 h-px bg-[var(--mc-divider)]" />
              {selectedPatient && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold">
                  <CheckCircle2 className="inline h-3 w-3 mr-1" />
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </span>
              )}
            </div>
            <Field icon={<Search className="h-3.5 w-3.5" />} label="Search Patients *" hint="name, patient No., phone, national ID or SHA number">
              <McInput
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                placeholder="Type to search patients…"
              />
            </Field>
            <div className="max-h-44 overflow-y-auto rounded-xl border border-[var(--mc-divider)] divide-y divide-[var(--mc-divider)]">
              {patientsLoading ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-9 rounded-lg" /><Skeleton className="h-9 rounded-lg" />
                </div>
              ) : patients.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {patientSearch ? 'No patients match your search' : 'Start typing to search the patient registry'}
                </p>
              ) : patients.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPatientId(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    patientId === p.id ? 'bg-[var(--mc-primary-light)]' : 'hover:bg-[var(--mc-bg-card)]'
                  }`}
                >
                  <div className="h-8 w-8 rounded-full mc-gradient-primary flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                    {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--mc-text-primary)] truncate">{p.firstName} {p.lastName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.patientNo} · {p.gender.toLowerCase()} · {age(p.dateOfBirth)} yrs · {p.phone || 'no phone'}
                    </p>
                  </div>
                  {patientId === p.id && <CheckCircle2 className="h-4 w-4 text-[var(--mc-primary)] shrink-0" />}
                </button>
              ))}
            </div>
          </section>

          {/* 2 — Test catalog */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-[var(--mc-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <h3 className="text-sm font-bold text-[var(--mc-text-primary)]">Test Catalog</h3>
              <div className="flex-1 h-px bg-[var(--mc-divider)]" />
              <span className="text-[11px] text-muted-foreground">{catalog.length} facility tests</span>
            </div>
            <Field icon={<Search className="h-3.5 w-3.5" />} label="Search Tests">
              <McInput
                value={testSearch}
                onChange={e => setTestSearch(e.target.value)}
                placeholder="e.g. malaria, CBC, urinalysis…"
              />
            </Field>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRICE_BANDS.map(b => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setPriceBand(b.key)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-colors ${
                    priceBand === b.key
                      ? 'bg-[var(--mc-primary)] text-white border-[var(--mc-primary)]'
                      : 'bg-white text-[var(--mc-text-secondary)] border-[var(--mc-divider)] hover:border-[var(--mc-primary)]'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="rounded-xl border border-[var(--mc-primary)]/40 bg-[var(--mc-primary-light)] p-2.5 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--mc-primary-dark)]">
                  Selected tests ({selected.length}) — estimated {kes(totalEstimate)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.map(t => (
                    <span key={t.serviceId} className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1 rounded-full bg-white border border-[var(--mc-divider)] text-xs font-medium">
                      {t.testName}
                      <span className="text-[10px] text-muted-foreground">{kes(t.price)}</span>
                      <span className="flex items-center gap-0.5">
                        <button type="button" onClick={() => setQty(t.serviceId, t.qty - 1)} className="h-5 w-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold leading-none">−</button>
                        <span className="w-4 text-center font-bold">{t.qty}</span>
                        <button type="button" onClick={() => setQty(t.serviceId, t.qty + 1)} className="h-5 w-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold leading-none">+</button>
                      </span>
                      <button type="button" onClick={() => toggleTest({ id: t.serviceId, code: '', name: t.testName, price: t.price, shaCovered: false })} className="h-5 w-5 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Catalog grid */}
            <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--mc-divider)] p-2 space-y-3">
              {catalogLoading ? (
                <div className="p-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
                </div>
              ) : catalogGrouped.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No tests match your search / filter</p>
              ) : catalogGrouped.map(([letter, tests]) => (
                <div key={letter} className="space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground sticky top-0 bg-white/95 backdrop-blur px-1 py-0.5">{letter}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {tests.map(s => {
                      const isSelected = selected.some(t => t.serviceId === s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleTest(s)}
                          className={`text-left rounded-lg border-2 p-2.5 transition-all ${
                            isSelected
                              ? 'border-[var(--mc-primary)] bg-[var(--mc-primary-light)]'
                              : 'border-[var(--mc-divider)] bg-white hover:border-[var(--mc-primary)]/60 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="text-xs font-semibold text-[var(--mc-text-primary)] leading-snug">{s.name}</p>
                            <span className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center ${
                              isSelected ? 'bg-[var(--mc-primary)] border-[var(--mc-primary)]' : 'border-[var(--mc-divider)]'
                            }`}>
                              {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[10px] font-mono text-muted-foreground">{s.code}</span>
                            <span className="text-[11px] font-bold text-[var(--mc-primary)]">{kes(s.price)}</span>
                            {s.shaCovered && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold inline-flex items-center gap-0.5">
                                <ShieldCheck className="h-2.5 w-2.5" /> SHA
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3 — Priority */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-[var(--mc-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
              <h3 className="text-sm font-bold text-[var(--mc-text-primary)]">Priority</h3>
              <div className="flex-1 h-px bg-[var(--mc-divider)]" />
            </div>
            <Field icon={<Gauge className="h-3.5 w-3.5" />} label="Request Priority">
              <McSelect
                value={priority}
                onValueChange={setPriority}
                options={PRIORITIES.map(p => ({ value: p, label: p }))}
              />
            </Field>
          </section>
        </div>
      </PremiumModal>

      {/* ── Results / view modal ── */}
      <PremiumModal
        open={!!viewing || viewLoading} onOpenChange={o => { if (!o) { setViewing(null); } }}
        size="lg"
        title={viewing ? `Lab Order ${viewing.orderNo}` : 'Lab Order'}
        icon={<FlaskConical className="h-5 w-5" />}
        description={viewing ? `${pname(viewing.patient)} — ${fmtDateTime(viewing.createdAt)}` : 'Loading order…'}
        footerNote={viewing?.status === 'COMPLETED' || viewing?.status === 'VERIFIED' ? 'Results are final — write medication notes below' : 'Results appear here once the laboratory records them'}
        extraFooter={
          viewing ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => printRequest(viewing)}>
                <Printer className="h-4 w-4" /> Request
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => printResult(viewing)} disabled={!hasResults(viewing)}>
                <FileCheck2 className="h-4 w-4" /> Result
              </Button>
            </div>
          ) : undefined
        }
      >
        {viewLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : viewing ? (
          <div className="space-y-4">
            {/* Header */}
            <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground"><User className="h-3 w-3" />{pname(viewing.patient)}</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Activity className="h-3 w-3" />{viewing.patient?.patientNo || '—'}</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Gauge className="h-3 w-3" />{viewing.priority}</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Clock3 className="h-3 w-3" />{fmtDate(viewing.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={viewing.status} />
                {viewing.requestedByName && (
                  <span className="text-[11px] text-muted-foreground">requested by {viewing.requestedByName}</span>
                )}
              </div>
            </div>

            {/* Items / results */}
            <div className="overflow-x-auto rounded-xl border">
              <table className="mc-table">
                <thead>
                  <tr><th>Test</th><th>Result</th><th>Value</th><th>Unit</th><th>Flag</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {(viewing.items || []).map(it => (
                    <tr key={it.id}>
                      <td className="text-xs font-medium">
                        {it.testName}
                        {it.labTest?.code && <span className="block text-[10px] font-mono text-muted-foreground">{it.labTest.code}</span>}
                      </td>
                      <td className="text-xs">
                        {it.result && stripHtml(it.result) ? (
                          <span className="mc-prose text-xs max-w-none" dangerouslySetInnerHTML={{ __html: it.result }} />
                        ) : '—'}
                      </td>
                      <td className="text-xs font-semibold">{it.resultValue || '—'}</td>
                      <td className="text-xs">{it.unit || '—'}</td>
                      <td>{it.flag ? <StatusBadge status={it.flag} /> : <span className="text-xs">—</span>}</td>
                      <td><StatusBadge status={it.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Narratives (Instruction 24 rich results) */}
            {(viewing.items || []).filter(it => it.narrative && stripHtml(it.narrative)).length > 0 && (
              <div className="space-y-2">
                {(viewing.items || []).filter(it => it.narrative && stripHtml(it.narrative)).map(it => (
                  <div key={`nar-${it.id}`} className="rounded-xl border border-[var(--mc-divider)] p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-primary)] mb-1">Narrative — {it.testName}</p>
                    <div className="mc-prose text-sm max-w-none" dangerouslySetInnerHTML={{ __html: it.narrative! }} />
                  </div>
                ))}
              </div>
            )}

            {/* Doctor medication notes */}
            <div className="rounded-xl border-2 border-dashed border-[var(--mc-divider)] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-primary)] flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5" /> Doctor Notes — medication & interpretation
                </p>
                <Button size="sm" className="h-7 gap-1 text-xs" onClick={saveNotes} disabled={savingNotes}>
                  <Save className="h-3.5 w-3.5" /> {savingNotes ? 'Saving…' : 'Save Notes'}
                </Button>
              </div>
              <RichTextEditor
                value={notesDraft}
                onChange={setNotesDraft}
                placeholder="Medication to start, interpretation of the results, follow-up plan…"
                minHeight={120}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Lab order not found</p>
        )}
      </PremiumModal>
    </div>
  );
}
