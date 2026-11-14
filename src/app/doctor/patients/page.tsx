'use client';

/**
 * DOCTOR PATIENTS — search & clinical history.
 * Search → GET /api/patients?search= → DataTable (patientNo, name, gender,
 * age, phone, county, paymentMode). View action → GET /api/patients?id= →
 * full history modal with tabs (Visits, Prescriptions, Lab results, Vitals,
 * Admissions). "Print History" in the modal footer prints the whole record via
 * printUniversalDocument ("PATIENT TREATMENT HISTORY").
 */

import * as React from 'react';
import {
  Users, Search, Eye, IdCard, User, MapPin, Phone, HeartPulse, Stethoscope, FilePlus2, FlaskConical, BedDouble, Activity, Printer,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/client-api';
import { printUniversalDocument, docSection, docTable, docRecordsTable } from '@/lib/document-print';
import { toast } from 'sonner';
import {
  kes, fmtDate, fmtDateTime, age, StatusBadge, PageHeading, McInput, SkeletonCards, pname,
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
}

interface VisitRow {
  id: string;
  visitNo: string;
  visitType: string;
  status: string;
  createdAt: string;
  bills?: Array<{ billNo: string; totalAmount: number; status: string; items?: Array<{ itemName: string; quantity: number; totalPrice: number }> }>;
}
interface PrescriptionRow {
  id: string;
  prescriptionNo: string;
  status: string;
  createdAt: string;
  items?: Array<{ id: string; drugName: string; dosage: string; frequency: string; duration: string; quantity: number; instructions: string }>;
}
interface LabOrderRow {
  id: string;
  orderNo: string;
  status: string;
  priority: string;
  createdAt: string;
  items?: Array<{ id: string; testName: string; result: string; resultValue: string; unit: string; flag: string; status: string }>;
}
interface VitalsRow {
  id: string;
  recordedAt: string;
  temperature: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  pulse: number;
  weight: number;
  height: number;
  bmi: number;
  oxygenSaturation: number;
  bloodGlucose: number;
  painScore: number;
  notes: string;
}
interface AdmissionRow {
  id: string;
  admissionNo: string;
  admissionType: string;
  status: string;
  admissionDate: string;
  dischargeDate: string | null;
  admittingDiagnosis: string;
  bed?: { bedNumber: string; ward?: { name: string } } | null;
}

interface PatientFull extends PatientRow {
  nationalId: string;
  email: string;
  bloodType: string;
  allergies: string;
  subCounty: string;
  paymentMode: string;
  shaNumber: string;
  visits: VisitRow[];
  prescriptions: PrescriptionRow[];
  labOrders: LabOrderRow[];
  vitals: VitalsRow[];
  admissions: AdmissionRow[];
}

type TabKey = 'visits' | 'prescriptions' | 'labs' | 'vitals' | 'admissions';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'visits', label: 'Visits', icon: <Stethoscope className="h-3.5 w-3.5" /> },
  { key: 'prescriptions', label: 'Prescriptions', icon: <FilePlus2 className="h-3.5 w-3.5" /> },
  { key: 'labs', label: 'Lab Results', icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { key: 'vitals', label: 'Vitals', icon: <Activity className="h-3.5 w-3.5" /> },
  { key: 'admissions', label: 'Admissions', icon: <BedDouble className="h-3.5 w-3.5" /> },
];

export default function DoctorPatientsPage() {
  const [rows, setRows] = React.useState<PatientRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  const [viewing, setViewing] = React.useState<PatientFull | null>(null);
  const [viewLoading, setViewLoading] = React.useState(false);
  const [tab, setTab] = React.useState<TabKey>('visits');

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
    setTab('visits');
    setViewLoading(true);
    setViewing(null);
    try {
      const res = await apiGet<{ patient: PatientFull }>(`/api/patients?id=${p.id}`);
      setViewing(res.patient);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load patient history');
    } finally {
      setViewLoading(false);
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
    {
      key: 'visits', header: 'Visits', align: 'right',
      csvValue: r => r._count?.visits ?? 0,
      render: r => <span className="text-xs font-semibold">{r._count?.visits ?? 0}</span>,
    },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View full history', variant: 'view', onClick: viewPatient },
  ];

  const initials = (p: PatientFull | null) => p ? `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase() : '—';

  // Print the full treatment history from the data already loaded in the modal
  const printHistory = (p: PatientFull) => {
    const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const bodyHtml = [
      docSection('Patient Details'),
      docTable([
        ['Patient Name', esc(`${p.firstName} ${p.lastName}`)],
        ['Patient No', esc(p.patientNo)],
        ['Age / Gender', `${age(p.dateOfBirth)} / ${esc(p.gender || '—')}`],
        ['Phone', esc(p.phone || '—')],
        ['Blood Type', esc(p.bloodType || '—')],
        ['National ID', esc(p.nationalId || '—')],
        ['Payment Mode', esc(p.paymentMode || '—')],
        ['SHA Number', esc(p.shaNumber || '—')],
        ['Residence', esc([p.county, p.subCounty].filter(Boolean).join(', ') || '—')],
      ]),
      p.allergies ? `${docSection('Allergies')}<p style="color:#b91c1c"><b>${esc(p.allergies)}</b></p>` : '',

      docSection('Visits'),
      p.visits.length === 0 ? '<p>—</p>' : docRecordsTable(
        ['Date', 'Visit No', 'Type', 'Status'],
        p.visits.map(v => [fmtDateTime(v.createdAt), esc(v.visitNo), esc(v.visitType), esc(v.status.replaceAll('_', ' '))]),
      ),

      docSection('Prescriptions'),
      p.prescriptions.length === 0 ? '<p>—</p>' : docRecordsTable(
        ['Date', 'Rx No', 'Status', 'Medication'],
        p.prescriptions.map(rx => [
          fmtDate(rx.createdAt),
          esc(rx.prescriptionNo),
          esc(rx.status.replaceAll('_', ' ')),
          esc((rx.items || []).map(it => `${it.drugName}${it.dosage ? ` ${it.dosage}` : ''}${it.quantity ? ` ×${it.quantity}` : ''}`).join('; ') || '—'),
        ]),
      ),

      docSection('Lab Results'),
      p.labOrders.length === 0 ? '<p>—</p>' : docRecordsTable(
        ['Date', 'Order No', 'Test', 'Value', 'Unit', 'Flag'],
        p.labOrders.flatMap(o => (o.items || []).map(it => [
          fmtDate(o.createdAt),
          esc(o.orderNo),
          esc(it.testName),
          esc(it.resultValue || it.result || '—'),
          esc(it.unit || '—'),
          esc(it.flag || '—'),
        ])),
      ),

      docSection('Vitals'),
      p.vitals.length === 0 ? '<p>—</p>' : docRecordsTable(
        ['Recorded', 'Temp °C', 'BP', 'Pulse', 'Weight', 'BMI', 'SpO₂'],
        p.vitals.map(v => [
          fmtDateTime(v.recordedAt),
          String(v.temperature || '—'),
          `${v.bloodPressureSystolic || '—'}/${v.bloodPressureDiastolic || '—'}`,
          String(v.pulse || '—'),
          String(v.weight || '—'),
          String(v.bmi || '—'),
          v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—',
        ]),
      ),

      docSection('Admissions'),
      p.admissions.length === 0 ? '<p>—</p>' : docRecordsTable(
        ['Admission No', 'Type', 'Ward / Bed', 'Admitted', 'Discharged', 'Status', 'Diagnosis'],
        p.admissions.map(a => [
          esc(a.admissionNo),
          esc(a.admissionType),
          esc(a.bed ? `${a.bed.ward?.name || 'Ward'} · Bed ${a.bed.bedNumber}` : '—'),
          fmtDate(a.admissionDate),
          fmtDate(a.dischargeDate),
          esc(a.status.replaceAll('_', ' ')),
          esc(a.admittingDiagnosis || '—'),
        ]),
      ),
    ].filter(Boolean).join('');
    printUniversalDocument({
      title: 'PATIENT TREATMENT HISTORY',
      docId: p.patientNo,
      bodyHtml,
      footerNote: 'Complete clinical history — confidential patient record',
    });
  };

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Users className="h-5 w-5" />}
        title="Patient Search & History"
        subtitle="Look up any patient and review their full clinical record"
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

      {/* Full history modal with tabs */}
      <PremiumModal
        open={!!viewing || viewLoading} onOpenChange={o => { if (!o) { setViewing(null); } }}
        size="xl"
        title={viewing ? `${viewing.firstName} ${viewing.lastName}` : 'Patient History'}
        icon={<IdCard className="h-5 w-5" />}
        description={viewing ? `${viewing.patientNo} · ${viewing.gender.toLowerCase()} · ${age(viewing.dateOfBirth)} yrs · ${viewing.paymentMode}` : 'Loading patient record…'}
        footerNote="Read-only clinical history — registration data is managed by the registrar"
        extraFooter={
          viewing ? (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => printHistory(viewing)}>
              <Printer className="h-4 w-4" /> Print History
            </Button>
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
            {/* Summary header */}
            <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)]">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full mc-gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {initials(viewing)}
                </div>
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{viewing.phone || '—'}</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{viewing.county || '—'}</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><HeartPulse className="h-3 w-3" />{viewing.bloodType || '—'}</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><User className="h-3 w-3" />{viewing.nationalId || '—'}</span>
                </div>
              </div>
              {viewing.allergies && (
                <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1 inline-flex items-center gap-1">
                  ⚠ Allergies: {viewing.allergies}
                </p>
              )}
            </div>

            {/* Tab buttons */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--mc-divider)] pb-px">
              {TABS.map(t => {
                const active = tab === t.key;
                const count =
                  t.key === 'visits' ? viewing.visits.length :
                  t.key === 'prescriptions' ? viewing.prescriptions.length :
                  t.key === 'labs' ? viewing.labOrders.length :
                  t.key === 'vitals' ? viewing.vitals.length :
                  viewing.admissions.length;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                      active
                        ? 'border-[var(--mc-primary)] text-[var(--mc-primary)] bg-[var(--mc-primary-light)]'
                        : 'border-transparent text-muted-foreground hover:text-[var(--mc-text-secondary)]'
                    }`}
                  >
                    {t.icon}{t.label}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--mc-divider)] text-[var(--mc-text-secondary)]">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="min-h-[200px]">
              {tab === 'visits' && (
                viewing.visits.length === 0 ? <EmptyTab label="No visits recorded" /> : (
                  <div className="space-y-2">
                    {viewing.visits.map(v => (
                      <div key={v.id} className="rounded-xl border border-[var(--mc-divider)] p-3">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-sm font-bold text-[var(--mc-text-primary)]">{v.visitNo}</span>
                          <StatusBadge status={v.status} />
                          <span className="text-[11px] text-muted-foreground">{fmtDateTime(v.createdAt)}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">{v.visitType}</span>
                        </div>
                        {v.bills && v.bills.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {v.bills.map(b => (
                              <p key={b.billNo}>
                                {b.billNo}: {b.items?.map(i => `${i.itemName} ×${i.quantity}`).join(', ')} — <span className="font-semibold text-[var(--mc-text-secondary)]">{kes(b.totalAmount)}</span> ({b.status})
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'prescriptions' && (
                viewing.prescriptions.length === 0 ? <EmptyTab label="No prescriptions" /> : (
                  <div className="space-y-2">
                    {viewing.prescriptions.map(p => (
                      <div key={p.id} className="rounded-xl border border-[var(--mc-divider)] p-3">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-sm font-bold text-[var(--mc-text-primary)]">{p.prescriptionNo}</span>
                          <StatusBadge status={p.status} />
                          <span className="text-[11px] text-muted-foreground">{fmtDate(p.createdAt)}</span>
                        </div>
                        <div className="text-xs space-y-0.5">
                          {(p.items || []).map(it => (
                            <p key={it.id} className="text-[var(--mc-text-secondary)]">
                              • <span className="font-medium">{it.drugName}</span>
                              {it.dosage && ` ${it.dosage}`}
                              {it.frequency && `, ${it.frequency}`}
                              {it.duration && ` × ${it.duration}`}
                              {` (qty ${it.quantity})`}
                              {it.instructions && ` — ${it.instructions}`}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'labs' && (
                viewing.labOrders.length === 0 ? <EmptyTab label="No lab orders" /> : (
                  <div className="space-y-2">
                    {viewing.labOrders.map(o => (
                      <div key={o.id} className="rounded-xl border border-[var(--mc-divider)] p-3">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-sm font-bold text-[var(--mc-text-primary)]">{o.orderNo}</span>
                          <StatusBadge status={o.status} />
                          <StatusBadge status={o.priority} />
                          <span className="text-[11px] text-muted-foreground">{fmtDate(o.createdAt)}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="mc-table">
                            <thead>
                              <tr><th>Test</th><th>Result</th><th>Value</th><th>Unit</th><th>Flag</th></tr>
                            </thead>
                            <tbody>
                              {(o.items || []).map(it => (
                                <tr key={it.id}>
                                  <td className="text-xs font-medium">{it.testName}</td>
                                  <td className="text-xs">{it.result || '—'}</td>
                                  <td className="text-xs">{it.resultValue || '—'}</td>
                                  <td className="text-xs">{it.unit || '—'}</td>
                                  <td>{it.flag ? <StatusBadge status={it.flag} /> : <span className="text-xs">—</span>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'vitals' && (
                viewing.vitals.length === 0 ? <EmptyTab label="No vitals recorded" /> : (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="mc-table">
                      <thead>
                        <tr>
                          <th>Recorded</th><th>Temp °C</th><th>BP</th><th>Pulse</th><th>Weight</th><th>Height</th><th>BMI</th><th>SpO₂</th><th>Glucose</th><th>Pain</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewing.vitals.map(v => (
                          <tr key={v.id}>
                            <td className="text-xs whitespace-nowrap">{fmtDateTime(v.recordedAt)}</td>
                            <td className="text-xs">{v.temperature || '—'}</td>
                            <td className="text-xs font-medium">{v.bloodPressureSystolic || '—'}/{v.bloodPressureDiastolic || '—'}</td>
                            <td className="text-xs">{v.pulse || '—'}</td>
                            <td className="text-xs">{v.weight || '—'}</td>
                            <td className="text-xs">{v.height || '—'}</td>
                            <td className="text-xs font-semibold">{v.bmi || '—'}</td>
                            <td className="text-xs">{v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—'}</td>
                            <td className="text-xs">{v.bloodGlucose || '—'}</td>
                            <td className="text-xs">{v.painScore || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {tab === 'admissions' && (
                viewing.admissions.length === 0 ? <EmptyTab label="No admissions" /> : (
                  <div className="space-y-2">
                    {viewing.admissions.map(a => (
                      <div key={a.id} className="rounded-xl border border-[var(--mc-divider)] p-3 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[var(--mc-text-primary)]">{a.admissionNo}</span>
                        <StatusBadge status={a.status} />
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">{a.admissionType}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.bed ? `${a.bed.ward?.name || 'Ward'} · Bed ${a.bed.bedNumber}` : 'No bed'} · Admitted {fmtDate(a.admissionDate)}
                          {a.dischargeDate && ` · Discharged ${fmtDate(a.dischargeDate)}`}
                        </span>
                        {a.admittingDiagnosis && <span className="text-xs text-[var(--mc-text-secondary)]">— {a.admittingDiagnosis}</span>}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
          <EmptyTab label="Patient not found" />
        )}
      </PremiumModal>
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground text-center py-10">{label}</p>;
}
