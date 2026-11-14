'use client';

/**
 * REGISTRAR VISITS — GET /api/visits
 * DataTable (visitNo, patient, visitType, status, createdAt, counts) with
 * actions: view (full encounter sheet: bills, lab orders, prescriptions),
 * advance to next workflow status (PUT), and cancel.
 */

import * as React from 'react';
import {
  CalendarClock, Eye, ChevronRight, XCircle, Stethoscope, FlaskConical, FilePlus2, ReceiptText, BedDouble, IdCard,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import {
  kes, fmtDate, fmtDateTime, StatusBadge, PageHeading, ConfirmModal, SkeletonCards, pname,
} from '@/app/clinical/_lib';

interface VisitRow {
  id: string;
  visitNo: string;
  visitType: string;
  status: string;
  createdAt: string;
  notes?: string;
  patient?: { patientNo: string; firstName: string; lastName: string; phone?: string; paymentMode?: string } | null;
  _count?: { bills: number; labOrders: number; prescriptions: number };
}

interface EncounterBill {
  id: string; billNo: string; totalAmount: number; status: string;
  items?: Array<{ id: string; itemName: string; quantity: number; unitPrice: number; totalPrice: number; department?: string }>;
}
interface EncounterVisit extends VisitRow {
  bills?: EncounterBill[];
  labOrders?: Array<{ id: string; orderNo: string; status: string; priority: string; createdAt: string; items?: Array<{ id: string; testName: string; result?: string; status: string }> }>;
  prescriptions?: Array<{ id: string; prescriptionNo: string; status: string; createdAt: string; items?: Array<{ id: string; drugName: string; quantity: number }> }>;
  admissions?: Array<{ id: string; admissionNo: string; status: string; admissionDate: string; bed?: { bedNumber: string; ward?: { name: string } } | null }>;
}

// Workflow order for "advance status"
const FLOW = ['ACTIVE', 'WAITING_LAB', 'WAITING_DOCTOR', 'WAITING_PHARMACY', 'READY_FOR_PAYMENT', 'COMPLETED'];
const nextStatus = (s: string) => {
  const i = FLOW.indexOf(s);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
};

export default function RegistrarVisitsPage() {
  const [rows, setRows] = React.useState<VisitRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [viewing, setViewing] = React.useState<EncounterVisit | null>(null);
  const [viewLoading, setViewLoading] = React.useState(false);

  const [cancelling, setCancelling] = React.useState<VisitRow | null>(null);
  const [cancelBusy, setCancelBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ visits: VisitRow[] }>('/api/visits?perPage=100');
      setRows(res.visits || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load visits');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const viewVisit = async (v: VisitRow) => {
    setViewing({ ...v });
    setViewLoading(true);
    try {
      const res = await apiGet<{ visit: EncounterVisit }>(`/api/visits?id=${v.id}`);
      setViewing(res.visit);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load encounter');
      setViewing(null);
    } finally {
      setViewLoading(false);
    }
  };

  const advance = async (v: VisitRow) => {
    const next = nextStatus(v.status);
    if (!next) { toast.info('Visit is already COMPLETED — no further status'); return; }
    try {
      const res = await apiPut<{ message: string }>('/api/visits', { id: v.id, status: next });
      toast.success(res.message || `Visit moved to ${next.replaceAll('_', ' ')}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to advance visit');
    }
  };

  const cancel = async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      const res = await apiPut<{ message: string }>('/api/visits', { id: cancelling.id, status: 'CANCELLED' });
      toast.success(res.message || 'Visit cancelled');
      setCancelling(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to cancel visit');
    } finally {
      setCancelBusy(false);
    }
  };

  const columns: Column<VisitRow>[] = [
    {
      key: 'visitNo', header: 'Visit No.', defaultVisible: true,
      render: r => <span className="font-semibold text-[var(--mc-text-primary)]">{r.visitNo}</span>,
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
      key: 'visitType', header: 'Type', defaultVisible: true,
      render: r => <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">{r.visitType.replaceAll('_', ' ')}</span>,
    },
    {
      key: 'status', header: 'Status', defaultVisible: true,
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'createdAt', header: 'Opened', sortable: true,
      csvValue: r => fmtDateTime(r.createdAt),
      render: r => <span className="text-xs whitespace-nowrap">{fmtDateTime(r.createdAt)}</span>,
    },
    {
      key: 'counts', header: 'Activity', align: 'right',
      csvValue: r => `${r._count?.bills ?? 0} bills / ${r._count?.labOrders ?? 0} lab / ${r._count?.prescriptions ?? 0} rx`,
      render: r => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {r._count?.bills ?? 0}B · {r._count?.labOrders ?? 0}L · {r._count?.prescriptions ?? 0}Rx
        </span>
      ),
    },
    { key: 'notes', header: 'Notes', render: r => <span className="text-xs text-muted-foreground">{r.notes || '—'}</span> },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View full encounter', variant: 'view', onClick: viewVisit },
    { icon: <ChevronRight className="h-4 w-4" />, title: 'Advance status', variant: 'download', onClick: advance },
    { icon: <XCircle className="h-4 w-4" />, title: 'Cancel visit', variant: 'delete', onClick: r => setCancelling(r) },
  ];

  const active = rows.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED').length;
  const completed = rows.filter(r => r.status === 'COMPLETED').length;
  const readyForPayment = rows.filter(r => r.status === 'READY_FOR_PAYMENT').length;

  const billTotal = (viewing?.bills || []).reduce((s, b) => s + b.totalAmount, 0);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<CalendarClock className="h-5 w-5" />}
        title="Visits Management"
        subtitle="Track each patient encounter through the clinical workflow to payment"
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Visits" value={rows.length} icon={<CalendarClock className="h-5 w-5" />} accent="primary" />
          <StatCard label="Active" value={active} icon={<Stethoscope className="h-5 w-5" />} accent="secondary" />
          <StatCard label="Ready for Payment" value={readyForPayment} icon={<ReceiptText className="h-5 w-5" />} accent="warning" />
          <StatCard label="Completed" value={completed} icon={<IdCard className="h-5 w-5" />} accent="success" />
        </div>
      )}

      <DataTable
        data={rows} columns={columns} actions={actions}
        rowKey={r => r.id} title="Visits" moduleLabel="Registrar Visits"
        loading={loading} emptyMessage="No visits opened yet"
      />

      {/* Full encounter view modal */}
      <PremiumModal
        open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }}
        size="xl"
        title={`Encounter ${viewing?.visitNo || ''}`}
        icon={<Eye className="h-5 w-5" />}
        description={viewing ? `${pname(viewing.patient)} · ${viewing.visitType.replaceAll('_', ' ')} · ${fmtDateTime(viewing.createdAt)}` : ''}
        footerNote={`Total billed: ${kes(billTotal)} — patient settles at the cashier`}
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={viewing.status} />
              {viewing.patient?.paymentMode && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">
                  {viewing.patient.paymentMode}
                </span>
              )}
              {viewing.patient?.phone && <span className="text-xs text-muted-foreground">{viewing.patient.phone}</span>}
            </div>

            {/* Bills */}
            <Section icon={<ReceiptText className="h-4 w-4" />} title={`Bills (${viewing.bills?.length ?? 0})`}>
              {viewLoading ? <p className="text-xs text-muted-foreground">Loading…</p> :
                !viewing.bills?.length ? <p className="text-xs text-muted-foreground">No bills yet.</p> : (
                  <div className="space-y-2">
                    {viewing.bills.map(b => (
                      <div key={b.id} className="rounded-lg border border-[var(--mc-divider)] p-2.5">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-[var(--mc-text-primary)]">{b.billNo}</span>
                          <StatusBadge status={b.status} />
                          <span className="text-xs font-semibold ml-auto">{kes(b.totalAmount)}</span>
                        </div>
                        {(b.items || []).map(it => (
                          <p key={it.id} className="text-[11px] text-muted-foreground">
                            • {it.itemName} ×{it.quantity} — {kes(it.totalPrice)}{it.department ? ` (${it.department})` : ''}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
            </Section>

            {/* Lab orders */}
            <Section icon={<FlaskConical className="h-4 w-4" />} title={`Lab Orders (${viewing.labOrders?.length ?? 0})`}>
              {viewLoading ? <p className="text-xs text-muted-foreground">Loading…</p> :
                !viewing.labOrders?.length ? <p className="text-xs text-muted-foreground">No lab orders.</p> : (
                  <div className="space-y-1.5">
                    {viewing.labOrders.map(o => (
                      <div key={o.id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[var(--mc-text-primary)]">{o.orderNo}</span>
                        <StatusBadge status={o.status} />
                        <StatusBadge status={o.priority} />
                        <span className="text-muted-foreground">{(o.items || []).map(i => i.testName).join(', ')}</span>
                        <span className="ml-auto text-muted-foreground">{fmtDate(o.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
            </Section>

            {/* Prescriptions */}
            <Section icon={<FilePlus2 className="h-4 w-4" />} title={`Prescriptions (${viewing.prescriptions?.length ?? 0})`}>
              {viewLoading ? <p className="text-xs text-muted-foreground">Loading…</p> :
                !viewing.prescriptions?.length ? <p className="text-xs text-muted-foreground">No prescriptions.</p> : (
                  <div className="space-y-1.5">
                    {viewing.prescriptions.map(p => (
                      <div key={p.id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[var(--mc-text-primary)]">{p.prescriptionNo}</span>
                        <StatusBadge status={p.status} />
                        <span className="text-muted-foreground">
                          {(p.items || []).map(i => `${i.drugName} ×${i.quantity}`).join(', ')}
                        </span>
                        <span className="ml-auto text-muted-foreground">{fmtDate(p.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
            </Section>

            {/* Admissions */}
            <Section icon={<BedDouble className="h-4 w-4" />} title={`Admissions (${viewing.admissions?.length ?? 0})`}>
              {viewLoading ? <p className="text-xs text-muted-foreground">Loading…</p> :
                !viewing.admissions?.length ? <p className="text-xs text-muted-foreground">No admissions.</p> : (
                  <div className="space-y-1.5">
                    {viewing.admissions.map(a => (
                      <div key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[var(--mc-text-primary)]">{a.admissionNo}</span>
                        <StatusBadge status={a.status} />
                        <span className="text-muted-foreground">
                          {a.bed ? `${a.bed.ward?.name || 'Ward'} · Bed ${a.bed.bedNumber}` : 'No bed'} · {fmtDate(a.admissionDate)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </Section>

            {viewing.notes && (
              <div className="rounded-xl border border-[var(--mc-divider)] p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-primary)] mb-1">Visit Notes</p>
                <p className="text-sm">{viewing.notes}</p>
              </div>
            )}
          </div>
        )}
      </PremiumModal>

      <ConfirmModal
        open={!!cancelling} onOpenChange={o => { if (!o) setCancelling(null); }}
        title="Cancel Visit"
        message={cancelling ? `Cancel visit ${cancelling.visitNo} for ${pname(cancelling.patient)}? Charges already raised remain on the patient account.` : ''}
        onConfirm={cancel} submitting={cancelBusy} confirmLabel="Cancel Visit"
      />
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--mc-divider)] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[var(--mc-primary)]">{icon}</span>
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-text-secondary)]">{title}</p>
      </div>
      {children}
    </div>
  );
}
