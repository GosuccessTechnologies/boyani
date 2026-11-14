'use client';

/**
 * DOCTOR PRESCRIPTIONS — GET /api/prescriptions
 * DataTable + PremiumModal with patient select and a dynamic medication items
 * builder. Drugs are picked through the "Add Drugs" picker modal (search +
 * category chips + multi-select cards from /api/pharmacy-pos?section=drugs with
 * the /api/pharmacy catalog fallback) and appended with qty 1 — dosage /
 * frequency / duration / quantity stay editable and instructions are written
 * per drug in a tiptap RichTextEditor (HTML stored in the String field).
 * unitPrice auto-fills from the selected drug. POST /api/prescriptions
 * {patientId, visitId?, doctorId, notes, items}. Every prescription prints via
 * printUniversalDocument ("PRESCRIPTION" with drugs table + doctor signature).
 */

import * as React from 'react';
import {
  FilePlus2, Pill, User, Search, Plus, Trash2, Eye, Boxes, Clock3, CalendarDays, MessageSquareText, Banknote, Hash, ClipboardList, Printer, CheckCircle2, PackageSearch,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost } from '@/lib/client-api';
import { printUniversalDocument, docSection, docTable, docRecordsTable } from '@/lib/document-print';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  kes, fmtDate, fmtDateTime, age, StatusBadge, PageHeading, Field, FormSection, McInput, McSelect, SkeletonCards, pname,
} from '@/app/clinical/_lib';

interface PrescriptionItemRow {
  id?: string;
  drugId: string;
  drugName: string;
  drugLabel: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
  unitPrice: number;
}

interface Prescription {
  id: string;
  prescriptionNo: string;
  patientId: string;
  patient?: { patientNo: string; firstName: string; lastName: string; phone: string } | null;
  status: string;
  notes: string;
  createdAt: string;
  _count?: { items: number };
  items?: Array<{
    id: string;
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    instructions: string;
    unitPrice: number;
    totalPrice: number;
    status?: string;
    dispensedQty?: number;
  }>;
}

interface PatientLite {
  id: string;
  patientNo: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface DrugLite {
  id: string;
  name: string;
  genericName?: string;
  code?: string;
  category?: string;
  stock?: number;
  unitPrice: number;
  dosageForm?: string;
  strength?: string;
}

interface PatientFull {
  patientNo: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: string;
  dateOfBirth: string | null;
  bloodType: string;
  paymentMode: string;
}

const FREQUENCIES = ['Once daily', 'Twice daily', 'Thrice daily', 'At night', 'As needed'];

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

const drugLabel = (d: DrugLite) =>
  `${d.name}${d.strength ? ` ${d.strength}` : ''}${d.dosageForm ? ` (${d.dosageForm})` : ''}`;

export default function DoctorPrescriptionsPage() {
  const { user } = useAuthStore();
  const [rows, setRows] = React.useState<Prescription[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [patientId, setPatientId] = React.useState('');
  const [visitId, setVisitId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [items, setItems] = React.useState<PrescriptionItemRow[]>([]);

  const [patients, setPatients] = React.useState<PatientLite[]>([]);
  const [drugs, setDrugs] = React.useState<DrugLite[]>([]);
  const [patientSearch, setPatientSearch] = React.useState('');

  // Drug picker modal
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [drugSearch, setDrugSearch] = React.useState('');
  const [drugCategory, setDrugCategory] = React.useState('ALL');
  const [pickerSelection, setPickerSelection] = React.useState<string[]>([]);

  const [viewing, setViewing] = React.useState<Prescription | null>(null);
  const [viewLoading, setViewLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ prescriptions: Prescription[] }>('/api/prescriptions?perPage=100');
      setRows(res.prescriptions || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const loadPatients = React.useCallback(async (search: string) => {
    try {
      const res = await apiGet<{ patients: PatientLite[] }>(
        `/api/patients?perPage=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      );
      setPatients(res.patients || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load patients');
    }
  }, []);

  // Drugs: pharmacy POS listing (ADMIN/PHARMACIST) with catalog fallback (DOCTOR-readable)
  const loadDrugs = React.useCallback(async () => {
    try {
      const res = await apiGet<{ drugs: DrugLite[] }>('/api/pharmacy-pos?section=drugs');
      setDrugs(res.drugs || []);
    } catch {
      try {
        const res = await apiGet<{ items: DrugLite[] }>('/api/pharmacy?perPage=200');
        setDrugs((res.items || []).filter(d => (d.stock ?? 1) > 0));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load drug catalog');
      }
    }
  }, []);

  const openCreate = () => {
    setPatientId('');
    setVisitId('');
    setNotes('');
    setItems([]);
    setPatientSearch('');
    loadPatients('');
    loadDrugs();
    setModalOpen(true);
  };

  const setItem = (idx: number, patch: Partial<PrescriptionItemRow>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  // ── Drug picker ──
  const openPicker = () => {
    setDrugSearch('');
    setDrugCategory('ALL');
    setPickerSelection([]);
    setPickerOpen(true);
  };

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const d of drugs) if (d.category) set.add(d.category);
    return ['ALL', ...Array.from(set).sort()];
  }, [drugs]);

  const filteredDrugs = React.useMemo(() => {
    const q = drugSearch.toLowerCase();
    return drugs.filter(d =>
      (drugCategory === 'ALL' || d.category === drugCategory) &&
      (!q ||
        d.name.toLowerCase().includes(q) ||
        (d.genericName || '').toLowerCase().includes(q) ||
        (d.category || '').toLowerCase().includes(q))
    );
  }, [drugs, drugSearch, drugCategory]);

  const addSelectedDrugs = () => {
    const map = new Map(drugs.map(d => [d.id, d]));
    const additions: PrescriptionItemRow[] = [];
    for (const id of pickerSelection) {
      const d = map.get(id);
      if (!d) continue;
      if (items.some(it => it.drugId === d.id)) continue; // already on the prescription
      additions.push({
        drugId: d.id,
        drugName: d.name,
        drugLabel: drugLabel(d),
        dosage: d.strength || '',
        frequency: 'Twice daily',
        duration: '',
        quantity: '1',
        instructions: '',
        unitPrice: d.unitPrice,
      });
    }
    if (additions.length === 0) {
      toast.error('Selected drug(s) are already on this prescription');
    } else {
      setItems(prev => [...prev, ...additions]);
      toast.success(`${additions.length} drug(s) added — review dosage & instructions`);
    }
    setPickerOpen(false);
  };

  const submit = async () => {
    if (!patientId) { toast.error('Select a patient'); return; }
    const valid = items.filter(it => it.drugId && Number(it.quantity) > 0);
    if (valid.length === 0) { toast.error('Add at least one medication with a drug and quantity'); return; }
    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string }>('/api/prescriptions', {
        patientId,
        visitId: visitId.trim() || undefined,
        doctorId: user?.id,
        notes,
        items: valid.map(it => ({
          drugId: it.drugId,
          dosage: it.dosage,
          frequency: it.frequency,
          duration: it.duration,
          quantity: parseInt(it.quantity, 10) || 1,
          instructions: it.instructions,
        })),
      });
      toast.success(res.message || 'Prescription created — pharmacy will dispense');
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create prescription');
    } finally {
      setSubmitting(false);
    }
  };

  const viewPrescription = async (p: Prescription) => {
    setViewing({ ...p, items: [] });
    setViewLoading(true);
    try {
      const res = await apiGet<{ prescription: Prescription }>(`/api/prescriptions?id=${p.id}`);
      setViewing(res.prescription);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load prescription');
      setViewing(null);
    } finally {
      setViewLoading(false);
    }
  };

  // ── Print prescription ──
  const printPrescription = async (p: Prescription) => {
    let full: Prescription = p;
    try {
      const res = await apiGet<{ prescription: Prescription }>(`/api/prescriptions?id=${p.id}`);
      if (res.prescription) full = res.prescription;
    } catch {
      // fall back to the row data
    }
    // Enrich patient details (age / gender) from the registry
    let patientExtra: PatientFull | null = null;
    try {
      const res = await apiGet<{ patient: PatientFull }>(`/api/patients?id=${full.patientId}`);
      patientExtra = res.patient || null;
    } catch {
      // patient select from the prescription is enough
    }
    const rxItems = full.items || [];
    const doctorName = `Dr. ${user?.lastName || user?.username || ''}`.trim();
    const bodyHtml = [
      docSection('Patient Details'),
      docTable([
        ['Patient Name', esc(pname(patientExtra || full.patient))],
        ['Patient No', esc(full.patient?.patientNo || patientExtra?.patientNo || '—')],
        ['Age / Gender', patientExtra ? `${age(patientExtra.dateOfBirth)} / ${esc(patientExtra.gender || '—')}` : '— / —'],
        ['Phone', esc(full.patient?.phone || patientExtra?.phone || '—')],
        ['Payment Mode', esc(patientExtra?.paymentMode || '—')],
      ]),
      docSection('Prescription Information'),
      docTable([
        ['Prescription No', esc(full.prescriptionNo)],
        ['Date', esc(fmtDateTime(full.createdAt))],
        ['Prescribing Doctor', esc(doctorName)],
        ['Status', esc(full.status.replaceAll('_', ' '))],
      ]),
      docSection('Medication'),
      docRecordsTable(
        ['Drug', 'Dosage', 'Frequency', 'Duration', 'Qty', 'Instructions'],
        rxItems.map(it => [
          esc(it.drugName),
          esc(it.dosage || '—'),
          esc(it.frequency || '—'),
          esc(it.duration || '—'),
          String(it.quantity),
          esc(stripHtml(it.instructions) || '—'),
        ]),
      ),
      full.notes ? `${docSection('Notes')}<p>${esc(full.notes)}</p>` : '',
      `<div style="margin-top:42px;display:flex;justify-content:flex-end">
        <div style="text-align:center;min-width:240px">
          <div style="border-top:1.5px dotted #64748b;padding-top:8px;font-size:11px;color:#475569">
            <b>${esc(doctorName)}</b><br/>Prescribing Doctor — Signature
          </div>
        </div>
      </div>`,
    ].filter(Boolean).join('');
    printUniversalDocument({
      title: 'PRESCRIPTION',
      docId: full.prescriptionNo,
      bodyHtml,
      footerNote: 'Prescription — dispensed by the pharmacy, billed to the patient visit',
    });
  };

  const columns: Column<Prescription>[] = [
    {
      key: 'prescriptionNo', header: 'Rx No.', defaultVisible: true,
      render: r => <span className="font-semibold text-[var(--mc-text-primary)]">{r.prescriptionNo}</span>,
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
      key: 'items', header: 'Medications', defaultVisible: true, align: 'right',
      csvValue: r => r._count?.items ?? r.items?.length ?? 0,
      render: r => <span className="font-semibold">{r._count?.items ?? r.items?.length ?? 0}</span>,
    },
    {
      key: 'createdAt', header: 'Date', defaultVisible: true, sortable: true,
      csvValue: r => fmtDate(r.createdAt),
      render: r => <span className="text-xs whitespace-nowrap">{fmtDate(r.createdAt)}</span>,
    },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status} /> },
    { key: 'notes', header: 'Notes', csvValue: r => stripHtml(r.notes), render: r => <span className="text-xs text-muted-foreground">{stripHtml(r.notes) || '—'}</span> },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View prescription', variant: 'view', onClick: viewPrescription },
    { icon: <Printer className="h-4 w-4" />, title: 'Print prescription', variant: 'print', onClick: printPrescription },
  ];

  const patientOptions = patients.map(p => ({
    value: p.id,
    label: `${p.firstName} ${p.lastName} · ${p.patientNo}`,
  }));

  const totalEstimate = items.reduce((s, it) => s + it.unitPrice * (parseInt(it.quantity, 10) || 0), 0);

  const prescribed = rows.filter(r => r.status === 'PRESCRIBED').length;
  const partiallyDispensed = rows.filter(r => r.status === 'PARTIALLY_DISPENSED').length;
  const dispensed = rows.filter(r => r.status === 'DISPENSED').length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<FilePlus2 className="h-5 w-5" />}
        title="Prescriptions"
        subtitle="Write prescriptions — the pharmacy dispenses and the charges bill to the patient's visit"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Prescription</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Prescriptions" value={rows.length} icon={<FilePlus2 className="h-5 w-5" />} accent="primary" />
          <StatCard label="Awaiting Dispensing" value={prescribed} icon={<Clock3 className="h-5 w-5" />} accent="warning" />
          <StatCard label="Partially Dispensed" value={partiallyDispensed} icon={<Boxes className="h-5 w-5" />} accent="secondary" />
          <StatCard label="Fully Dispensed" value={dispensed} icon={<Pill className="h-5 w-5" />} accent="success" />
        </div>
      )}

      <DataTable
        data={rows} columns={columns} actions={actions}
        rowKey={r => r.id} title="Prescriptions" moduleLabel="Doctor Prescriptions"
        loading={loading} emptyMessage="No prescriptions written yet"
      />

      {/* New prescription modal with items builder */}
      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="xl"
        title="New Prescription"
        icon={<Pill className="h-5 w-5" />}
        description="Prescribe medication — prices snapshot at prescribing time"
        footerNote="Registered patients: charges are billed to the visit and paid at the cashier"
        submitLabel="Prescribe" onSubmit={submit}
        submitting={submitting} secondaryLabel="Cancel"
        submitDisabled={!patientId || items.length === 0}
      >
        <div className="space-y-5">
          <FormSection n={1} title="Patient & Visit">
            <Field icon={<Search className="h-3.5 w-3.5" />} label="Search Patients">
              <div className="flex gap-2">
                <McInput
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Name, patient No., phone…"
                  onKeyDown={e => { if (e.key === 'Enter') loadPatients(patientSearch); }}
                />
                <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={() => loadPatients(patientSearch)}>
                  <Search className="h-4 w-4" /> Search
                </Button>
              </div>
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Patient *">
              <McSelect value={patientId} onValueChange={setPatientId} options={patientOptions} placeholder="Select patient…" />
            </Field>
            <Field icon={<Hash className="h-3.5 w-3.5" />} label="Visit ID (optional)" hint="leave blank to bill the latest active visit">
              <McInput value={visitId} onChange={e => setVisitId(e.target.value)} placeholder="visit id…" />
            </Field>
            <Field icon={<ClipboardList className="h-3.5 w-3.5" />} label="Notes">
              <McInput value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Complete full course" />
            </Field>
          </FormSection>

          <FormSection n={2} title={`Medications (${items.length})`}>
            <div className="sm:col-span-2 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" size="sm" className="gap-1" onClick={openPicker}>
                  <PackageSearch className="h-4 w-4" /> Add Drugs
                </Button>
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Banknote className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
                  Estimated total: <span className="text-[var(--mc-primary)]">{kes(totalEstimate)}</span>
                </span>
              </div>

              {items.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-[var(--mc-divider)] p-6 text-center">
                  <Pill className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-[var(--mc-text-secondary)]">No medication yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use <b>Add Drugs</b> to search the pharmacy catalog and pick one or more drugs
                  </p>
                </div>
              )}

              {items.map((it, idx) => (
                <div key={it.drugId || idx} className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-[var(--mc-primary)]">Item #{idx + 1}</span>
                      <p className="text-sm font-semibold text-[var(--mc-text-primary)] truncate">{it.drugLabel}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {it.unitPrice > 0 && (
                        <span className="text-[11px] font-semibold text-[var(--mc-text-secondary)]">
                          {kes(it.unitPrice)} × {it.quantity || 0} = <span className="text-[var(--mc-primary)]">{kes(it.unitPrice * (parseInt(it.quantity, 10) || 0))}</span>
                        </span>
                      )}
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-red-600"
                        onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field icon={<Pill className="h-3.5 w-3.5" />} label="Dosage">
                      <McInput value={it.dosage} onChange={e => setItem(idx, { dosage: e.target.value })} placeholder="e.g. 500mg" />
                    </Field>
                    <Field icon={<Clock3 className="h-3.5 w-3.5" />} label="Frequency">
                      <McSelect
                        value={it.frequency}
                        onValueChange={v => setItem(idx, { frequency: v })}
                        options={FREQUENCIES.map(f => ({ value: f, label: f }))}
                      />
                    </Field>
                    <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Duration">
                      <McInput value={it.duration} onChange={e => setItem(idx, { duration: e.target.value })} placeholder="e.g. 5 days" />
                    </Field>
                    <Field icon={<Boxes className="h-3.5 w-3.5" />} label="Quantity">
                      <McInput type="number" min="1" value={it.quantity} onChange={e => setItem(idx, { quantity: e.target.value })} />
                    </Field>
                    <Field icon={<MessageSquareText className="h-3.5 w-3.5" />} label="Instructions" className="sm:col-span-2">
                      <RichTextEditor
                        value={it.instructions}
                        onChange={v => setItem(idx, { instructions: v })}
                        placeholder="e.g. Take after meals with plenty of water…"
                        minHeight={120}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </FormSection>
        </div>
      </PremiumModal>

      {/* ── Drug picker modal ── */}
      <PremiumModal
        open={pickerOpen} onOpenChange={setPickerOpen} size="xl"
        title="Add Drugs"
        icon={<PackageSearch className="h-5 w-5" />}
        description="Search the pharmacy catalog, filter by category and select the drugs to prescribe"
        footerNote={`${drugs.length} drugs in stock — selected drugs are appended with quantity 1`}
        submitLabel={`Add Selected (${pickerSelection.length})`} onSubmit={addSelectedDrugs}
        submitDisabled={pickerSelection.length === 0} secondaryLabel="Cancel"
      >
        <div className="space-y-3">
          <Field icon={<Search className="h-3.5 w-3.5" />} label="Search Drugs">
            <McInput
              value={drugSearch}
              onChange={e => setDrugSearch(e.target.value)}
              placeholder="Filter by brand name, generic name or category…"
            />
          </Field>
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setDrugCategory(c)}
                className={`h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-colors ${
                  drugCategory === c
                    ? 'bg-[var(--mc-primary)] text-white border-[var(--mc-primary)]'
                    : 'bg-white text-[var(--mc-text-secondary)] border-[var(--mc-divider)] hover:border-[var(--mc-primary)]'
                }`}
              >
                {c === 'ALL' ? 'All categories' : c}
              </button>
            ))}
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-[var(--mc-divider)] p-2">
            {drugs.length === 0 ? (
              <div className="p-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
              </div>
            ) : filteredDrugs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10">No drugs match your search</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredDrugs.map(d => {
                  const isPicked = pickerSelection.includes(d.id);
                  const onPrescription = items.some(it => it.drugId === d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      disabled={onPrescription}
                      onClick={() => setPickerSelection(prev =>
                        isPicked ? prev.filter(id => id !== d.id) : [...prev, d.id]
                      )}
                      className={`text-left rounded-lg border-2 p-2.5 transition-all ${
                        onPrescription
                          ? 'border-[var(--mc-divider)] bg-slate-50 opacity-50 cursor-not-allowed'
                          : isPicked
                            ? 'border-[var(--mc-primary)] bg-[var(--mc-primary-light)]'
                            : 'border-[var(--mc-divider)] bg-white hover:border-[var(--mc-primary)]/60 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[var(--mc-text-primary)] leading-snug truncate">{d.name}</p>
                          {d.genericName && <p className="text-[10px] text-muted-foreground truncate">{d.genericName}</p>}
                        </div>
                        <span className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center ${
                          isPicked ? 'bg-[var(--mc-primary)] border-[var(--mc-primary)]' : 'border-[var(--mc-divider)]'
                        }`}>
                          {isPicked && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {d.strength && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">{d.strength}</span>}
                        {d.dosageForm && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">{d.dosageForm}</span>}
                        <span className="text-[11px] font-bold text-[var(--mc-primary)]">{kes(d.unitPrice)}</span>
                        <span className={`text-[10px] font-semibold ${(d.stock ?? 0) > 10 ? 'text-emerald-600' : (d.stock ?? 0) > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                          {d.stock ?? 0} in stock
                        </span>
                      </div>
                      {onPrescription && <p className="text-[9px] text-muted-foreground mt-1">already on this prescription</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PremiumModal>

      {/* View modal */}
      <PremiumModal
        open={!!viewing} onOpenChange={o => !o && setViewing(null)} size="lg"
        title={`Prescription ${viewing?.prescriptionNo || ''}`}
        icon={<Eye className="h-5 w-5" />}
        description={viewing ? `${pname(viewing.patient)} — ${fmtDateTime(viewing.createdAt)}` : ''}
        footerNote="Dispensing is done by the pharmacy portal"
        extraFooter={
          viewing ? (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => printPrescription(viewing)}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          ) : undefined
        }
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusBadge status={viewing.status} />
              <span className="text-muted-foreground">{viewing.items?.length ?? 0} medication(s)</span>
            </div>
            {viewLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading items…</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="mc-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>#</th>
                      <th>Drug</th>
                      <th>Dosage</th>
                      <th>Frequency</th>
                      <th>Duration</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                      <th>Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewing.items || []).map((it, i) => (
                      <tr key={it.id}>
                        <td className="text-muted-foreground">{i + 1}</td>
                        <td className="font-medium text-[var(--mc-text-primary)]">{it.drugName}</td>
                        <td className="text-xs">{it.dosage || '—'}</td>
                        <td className="text-xs">{it.frequency || '—'}</td>
                        <td className="text-xs">{it.duration || '—'}</td>
                        <td style={{ textAlign: 'right' }} className="font-semibold">{it.quantity}</td>
                        <td style={{ textAlign: 'right' }} className="text-xs">{kes(it.totalPrice)}</td>
                        <td className="text-xs text-muted-foreground">
                          {it.instructions && stripHtml(it.instructions)
                            ? <span className="mc-prose text-xs max-w-none" dangerouslySetInnerHTML={{ __html: it.instructions }} />
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {viewing.notes && (
              <div className="rounded-xl border border-[var(--mc-divider)] p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-primary)] mb-1">Notes</p>
                <p className="text-sm">{viewing.notes}</p>
              </div>
            )}
          </div>
        )}
      </PremiumModal>
    </div>
  );
}
