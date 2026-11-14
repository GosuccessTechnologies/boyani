'use client';

/**
 * LAB ORDERS — Instruction 24: THREE-menu workflow split.
 *  ① Order Request      — PENDING / SAMPLE_COLLECTED / IN_PROGRESS orders from
 *                         nurses, doctors & registrars. View details, Collect
 *                         Sample (specimen + ref PER TEST via PUT action
 *                         'collect-samples') and Start Processing.
 *  ② Lab Result         — SAMPLE_COLLECTED / IN_PROGRESS orders. Record Results
 *                         modal: per-test tiptap narrative (RichTextEditor),
 *                         value, unit, flag & remarks → PUT itemResults.
 *  ③ Result Verification— COMPLETED orders awaiting release. Verify & Release
 *                         (VERIFIED); verified orders print LABORATORY REQUEST
 *                         and LABORATORY RESULT REPORT via printUniversalDocument.
 */

import * as React from 'react';
import {
  ClipboardList, Eye, Syringe, PlayCircle, FilePenLine, BadgeCheck, TestTube2, User,
  Clock, RefreshCw, FlaskConical, Gauge, MessageSquareText, Printer, FileText,
  ChevronDown, ChevronRight, ShieldCheck, Boxes,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { printUniversalDocument, docSection, docTable, docRecordsTable } from '@/lib/document-print';
import {
  fmtDate, fmtDateTime, age, StatusBadge, PageHeading, Field, McInput, McSelect,
  SkeletonCards, pname,
} from '@/app/clinical/_lib';

interface LabOrderRow {
  id: string;
  orderNo: string;
  priority: string;
  status: string;
  createdAt: string;
  requestedByName?: string;
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
  narrative: string;
  sampleType: string;
  sampleRef: string;
  labTest?: { referenceRange?: string; specimenType?: string; category?: string; code?: string } | null;
}

interface LabOrderFull extends LabOrderRow {
  notes?: string;
  items?: LabOrderItem[];
  patient?: {
    patientNo: string; firstName: string; lastName: string; phone?: string; gender?: string;
    dateOfBirth?: string | null; bloodType?: string;
  } | null;
}

const SPECIMENS = ['Blood', 'Serum', 'Plasma', 'Urine', 'Stool', 'Sputum', 'Swab', 'CSF', 'Synovial Fluid', 'Tissue', 'Saliva', 'Aspirate'];
const FLAGS = ['NORMAL', 'HIGH', 'LOW', 'CRITICAL'];

type MenuTab = 'REQUEST' | 'RESULT' | 'VERIFY';

const TABS: Array<{ key: MenuTab; label: string; icon: React.ReactNode; match: (s: string) => boolean }> = [
  { key: 'REQUEST', label: 'Order Request', icon: <Syringe className="h-4 w-4" />, match: s => ['PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS'].includes(s) },
  { key: 'RESULT', label: 'Lab Result', icon: <FilePenLine className="h-4 w-4" />, match: s => ['SAMPLE_COLLECTED', 'IN_PROGRESS'].includes(s) },
  { key: 'VERIFY', label: 'Result Verification', icon: <BadgeCheck className="h-4 w-4" />, match: s => ['COMPLETED', 'VERIFIED'].includes(s) },
];

const flagColor = (flag: string) =>
  flag === 'CRITICAL' ? '#dc2626'
    : flag === 'HIGH' ? '#ea580c'
    : flag === 'LOW' ? '#2563eb'
    : '#059669';

/** Priority pill — STAT pulses red, URGENT amber, ROUTINE sky. */
function PriorityPill({ priority }: { priority: string }) {
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full border font-bold whitespace-nowrap ${
        priority === 'STAT' ? 'bg-red-100 text-red-700 border-red-300 animate-pulse'
          : priority === 'URGENT' ? 'bg-amber-100 text-amber-700 border-amber-200'
          : 'bg-sky-100 text-sky-700 border-sky-200'
      }`}
    >
      {priority}
    </span>
  );
}

interface SampleFormRow {
  itemId: string;
  testName: string;
  sampleType: string;
  sampleRef: string;
  defaultSpecimen: string;
}

interface ResultFormRow {
  itemId: string;
  testName: string;
  narrative: string;
  resultValue: string;
  unit: string;
  flag: string;
  remarks: string;
  referenceRange: string;
  itemStatus: string;
  narrativeOpen: boolean;
}

export default function LabOrdersPage() {
  const [rows, setRows] = React.useState<LabOrderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<MenuTab>('REQUEST');

  // View modal
  const [viewing, setViewing] = React.useState<LabOrderFull | null>(null);
  const [viewLoading, setViewLoading] = React.useState(false);

  // Collect-sample modal
  const [collectOpen, setCollectOpen] = React.useState(false);
  const [collectOrder, setCollectOrder] = React.useState<LabOrderFull | null>(null);
  const [sampleRows, setSampleRows] = React.useState<SampleFormRow[]>([]);
  const [collectBusy, setCollectBusy] = React.useState(false);

  // Record-results modal
  const [resultsOpen, setResultsOpen] = React.useState(false);
  const [resultsOrder, setResultsOrder] = React.useState<LabOrderFull | null>(null);
  const [resultRows, setResultRows] = React.useState<ResultFormRow[]>([]);
  const [resultsBusy, setResultsBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ labOrders: LabOrderRow[] }>('/api/lab-orders?perPage=200');
      setRows(res.labOrders || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load lab orders');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const fetchFull = async (id: string): Promise<LabOrderFull | null> => {
    try {
      const res = await apiGet<{ labOrder: LabOrderFull }>(`/api/lab-orders?id=${id}`);
      return res.labOrder;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load lab order');
      return null;
    }
  };

  const moveStatus = async (o: LabOrderRow, status: string) => {
    try {
      const res = await apiPut<{ message: string }>('/api/lab-orders', { id: o.id, status });
      toast.success(res.message || `Order ${o.orderNo} → ${status.replaceAll('_', ' ')}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update order');
    }
  };

  const viewOrder = async (o: LabOrderRow) => {
    setViewing({ ...o });
    setViewLoading(true);
    const full = await fetchFull(o.id);
    setViewing(full);
    setViewLoading(false);
  };

  // ── Collect samples (per-test specimen + ref) ──
  const openCollect = async (o: LabOrderRow) => {
    setCollectOrder({ ...o });
    setCollectOpen(true);
    const full = await fetchFull(o.id);
    if (full) {
      setCollectOrder(full);
      setSampleRows((full.items || []).map(it => ({
        itemId: it.id,
        testName: it.testName,
        sampleType: it.sampleType || it.labTest?.specimenType || 'Blood',
        sampleRef: it.sampleRef || '',
        defaultSpecimen: it.labTest?.specimenType || 'Blood',
      })));
    }
  };

  const setSampleRow = (itemId: string, patch: Partial<SampleFormRow>) => {
    setSampleRows(prev => prev.map(r => (r.itemId === itemId ? { ...r, ...patch } : r)));
  };

  const submitCollect = async () => {
    if (!collectOrder || sampleRows.length === 0) return;
    setCollectBusy(true);
    try {
      const res = await apiPut<{ message: string }>('/api/lab-orders', {
        id: collectOrder.id,
        action: 'collect-samples',
        itemSamples: sampleRows.map(r => ({
          itemId: r.itemId,
          sampleType: r.sampleType,
          sampleRef: r.sampleRef,
        })),
      });
      toast.success(res.message || 'Samples recorded');
      setCollectOpen(false);
      setCollectOrder(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record samples');
    } finally {
      setCollectBusy(false);
    }
  };

  // ── Record results (narrative + values per test) ──
  const openResults = async (o: LabOrderRow) => {
    setResultsOrder({ ...o });
    setResultsOpen(true);
    const full = await fetchFull(o.id);
    if (full) {
      setResultsOrder(full);
      setResultRows((full.items || []).map(it => ({
        itemId: it.id,
        testName: it.testName,
        narrative: it.narrative || '',
        resultValue: it.resultValue || '',
        unit: it.unit || '',
        flag: it.flag || 'NORMAL',
        remarks: it.remarks || '',
        referenceRange: it.labTest?.referenceRange || '',
        itemStatus: it.status,
        narrativeOpen: !!(it.narrative && it.narrative !== '<p></p>'),
      })));
    }
  };

  const setResultRow = (itemId: string, patch: Partial<ResultFormRow>) => {
    setResultRows(prev => prev.map(r => (r.itemId === itemId ? { ...r, ...patch } : r)));
  };

  const submitResults = async () => {
    if (!resultsOrder) return;
    const filled = resultRows.filter(r => r.narrative.trim() || r.resultValue.trim());
    if (filled.length === 0) { toast.error('Enter at least one result (value or narrative)'); return; }
    setResultsBusy(true);
    try {
      const res = await apiPut<{ message: string }>('/api/lab-orders', {
        id: resultsOrder.id,
        itemResults: resultRows.map(r => ({
          itemId: r.itemId,
          result: r.narrative ? r.narrative.replace(/<[^>]*>/g, ' ').trim().slice(0, 500) : '',
          resultValue: r.resultValue,
          unit: r.unit,
          flag: r.flag,
          remarks: r.remarks,
          narrative: r.narrative,
        })),
      });
      toast.success(res.message || 'Results saved');
      setResultsOpen(false);
      setResultsOrder(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save results');
    } finally {
      setResultsBusy(false);
    }
  };

  // ── Verify & release ──
  const verifyOrder = async (o: LabOrderRow) => {
    const full = await fetchFull(o.id);
    const pending = (full?.items || []).filter(i => i.status !== 'COMPLETED').length;
    if (pending > 0) {
      toast.error(`${pending} test(s) still await results — record them in the Lab Result menu first`);
      return;
    }
    moveStatus(o, 'VERIFIED');
  };

  // ── Printing (verified orders) ──
  const patientRows = (o: LabOrderFull): Array<[string, string]> => {
    const p = o.patient;
    return [
      ['Patient Name', pname(p)],
      ['Patient No.', p?.patientNo || '—'],
      ['Gender / Age', `${p?.gender || '—'} · ${age(p?.dateOfBirth)} yrs`],
      ['Phone', p?.phone || '—'],
      ['Ordered By', o.requestedByName || '—'],
      ['Ordered On', fmtDateTime(o.createdAt)],
      ['Priority', o.priority || 'ROUTINE'],
    ];
  };

  const printRequest = async (o: LabOrderRow) => {
    const full = await fetchFull(o.id);
    if (!full) return;
    await printUniversalDocument({
      title: 'LABORATORY REQUEST',
      docId: full.orderNo,
      bodyHtml: [
        docSection('Patient Details'),
        docTable(patientRows(full)),
        docSection('Tests Requested'),
        docRecordsTable(
          ['#', 'Test', 'Specimen', 'Sample Ref'],
          (full.items || []).map((it, i) => [
            String(i + 1),
            it.testName,
            it.sampleType || it.labTest?.specimenType || 'Blood',
            it.sampleRef || '—',
          ]),
        ),
        full.notes ? `${docSection('Clinical Notes')}<p>${full.notes.replace(/</g, '&lt;')}</p>` : '',
      ].join(''),
      footerNote: 'Laboratory test request — specimens collected per test as listed above.',
    });
  };

  const printResult = async (o: LabOrderRow) => {
    const full = await fetchFull(o.id);
    if (!full) return;
    await printUniversalDocument({
      title: 'LABORATORY RESULT REPORT',
      docId: full.orderNo,
      bodyHtml: [
        docSection('Patient Details'),
        docTable(patientRows(full)),
        docSection('Test Results'),
        docRecordsTable(
          ['#', 'Test', 'Value', 'Unit', 'Flag'],
          (full.items || []).map((it, i) => [
            String(i + 1),
            it.testName,
            it.resultValue ? String(it.resultValue) : '—',
            it.unit ? String(it.unit) : '—',
            it.flag ? `<b style="color:${flagColor(it.flag)}">${it.flag}</b>` : '—',
          ]),
        ),
        docSection('Result Narratives'),
        ...(full.items || []).map(it => (
          `<p style="font-weight:700;margin-top:12px">${it.testName}${it.flag ? ` <span style="color:${flagColor(it.flag)}">(${it.flag})</span>` : ''}</p>`
          + (it.narrative && it.narrative !== '<p></p>'
            ? `<div>${it.narrative}</div>`
            : '<p style="color:#64748b">No narrative recorded.</p>')
          + (it.remarks ? `<p style="font-size:10.5px;color:#475569"><i>Remarks: ${it.remarks.replace(/</g, '&lt;')}</i></p>` : '')
        )),
      ].join(''),
      footerNote: 'Laboratory result report — verified & released by the laboratory.',
    });
  };

  const activeTab = TABS.find(t => t.key === tab) || TABS[0];
  const filtered = rows.filter(r => activeTab.match(r.status));

  const baseColumns: Column<LabOrderRow>[] = [
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
      key: 'priority', header: 'Priority', defaultVisible: true,
      csvValue: r => r.priority,
      render: r => <PriorityPill priority={r.priority} />,
    },
    {
      key: 'status', header: 'Status', defaultVisible: true,
      csvValue: r => r.status,
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'requestedByName', header: 'Requester', csvValue: r => r.requestedByName || '',
      render: r => (
        <span className="text-xs text-[var(--mc-text-secondary)] inline-flex items-center gap-1 whitespace-nowrap">
          <User className="h-3 w-3 text-[var(--mc-primary)]" />{r.requestedByName || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt', header: 'Ordered', sortable: true,
      csvValue: r => fmtDateTime(r.createdAt),
      render: r => <span className="text-xs whitespace-nowrap">{fmtDateTime(r.createdAt)}</span>,
    },
    {
      key: 'items', header: 'Tests', align: 'right',
      csvValue: r => r._count?.items ?? 0,
      render: r => <span className="font-semibold">{r._count?.items ?? 0}</span>,
    },
  ];

  const actionsFor = (t: MenuTab): ActionBtn[] => {
    if (t === 'REQUEST') {
      return [
        { icon: <Eye className="h-4 w-4" />, title: 'View order details', variant: 'view', onClick: viewOrder },
        { icon: <Syringe className="h-4 w-4" />, title: 'Collect sample', variant: 'edit', onClick: r => { if (['PENDING', 'SAMPLE_COLLECTED'].includes(r.status)) openCollect(r); else toast.info('Order is already in progress'); } },
        { icon: <PlayCircle className="h-4 w-4" />, title: 'Start processing', variant: 'download', onClick: r => { if (['PENDING', 'SAMPLE_COLLECTED'].includes(r.status)) moveStatus(r, 'IN_PROGRESS'); else toast.info('Order is already in progress'); } },
      ];
    }
    if (t === 'RESULT') {
      return [
        { icon: <Eye className="h-4 w-4" />, title: 'View order details', variant: 'view', onClick: viewOrder },
        { icon: <FilePenLine className="h-4 w-4" />, title: 'Record results', variant: 'print', onClick: openResults },
      ];
    }
    return [
      { icon: <Eye className="h-4 w-4" />, title: 'View results', variant: 'view', onClick: viewOrder },
      { icon: <BadgeCheck className="h-4 w-4" />, title: 'Verify & release', variant: 'edit', onClick: r => { if (r.status === 'COMPLETED') verifyOrder(r); else toast.info('Already verified & released'); } },
      { icon: <Printer className="h-4 w-4" />, title: 'Print lab request', variant: 'print', onClick: r => { if (r.status === 'VERIFIED') printRequest(r); else toast.info('Verify & release first to print'); } },
      { icon: <FileText className="h-4 w-4" />, title: 'Print lab result report', variant: 'download', onClick: r => { if (r.status === 'VERIFIED') printResult(r); else toast.info('Verify & release first to print'); } },
    ];
  };

  const pendingCount = rows.filter(r => ['PENDING', 'SAMPLE_COLLECTED'].includes(r.status)).length;
  const inProgressCount = rows.filter(r => r.status === 'IN_PROGRESS').length;
  const urgentCount = rows.filter(r => (r.priority === 'URGENT' || r.priority === 'STAT') && ['PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS'].includes(r.status)).length;
  const awaitingVerify = rows.filter(r => r.status === 'COMPLETED').length;
  const releasedCount = rows.filter(r => r.status === 'VERIFIED').length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<ClipboardList className="h-5 w-5" />}
        title="Lab Orders — Workflow"
        subtitle="Order requests → sample collection → result entry → verification & release"
        actions={
          <Button size="sm" variant="outline" className="gap-1" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {loading ? <SkeletonCards count={5} /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard label="Order Requests" value={pendingCount} icon={<Syringe className="h-5 w-5" />} accent="warning" hint="awaiting/collected" onClick={() => setTab('REQUEST')} />
          <StatCard label="In Progress" value={inProgressCount} icon={<TestTube2 className="h-5 w-5" />} accent="secondary" onClick={() => setTab('REQUEST')} />
          <StatCard label="Urgent Queue" value={urgentCount} icon={<FlaskConical className="h-5 w-5" />} accent="danger" hint="URGENT + STAT live" onClick={() => setTab('REQUEST')} />
          <StatCard label="Awaiting Verification" value={awaitingVerify} icon={<ShieldCheck className="h-5 w-5" />} accent="info" hint="results recorded" onClick={() => setTab('VERIFY')} />
          <StatCard label="Released Reports" value={releasedCount} icon={<BadgeCheck className="h-5 w-5" />} accent="success" hint="verified & printable" onClick={() => setTab('VERIFY')} />
        </div>
      )}

      {/* THREE-menu tab split */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-print pb-1">
        {TABS.map(t => {
          const count = rows.filter(r => t.match(r.status)).length;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                active
                  ? 'bg-[var(--mc-primary)] text-white shadow-md border-transparent'
                  : 'text-[var(--mc-text-secondary)] hover:bg-[var(--mc-primary-light)] border-[var(--mc-divider)] bg-white'
              }`}
            >
              {t.icon}
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25' : 'bg-[var(--mc-divider)]'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Tab hint strip */}
      <div className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] px-4 py-2.5 text-xs text-[var(--mc-text-secondary)] flex items-center gap-2 no-print">
        {tab === 'REQUEST' && <><Syringe className="h-3.5 w-3.5 text-[var(--mc-primary)] shrink-0" /> Requests from nurses, doctors & registrars — collect the specimen per test, then start processing.</>}
        {tab === 'RESULT' && <><FilePenLine className="h-3.5 w-3.5 text-[var(--mc-primary)] shrink-0" /> Samples collected & processing — record values, flags and rich-text narratives per test. Orders auto-COMPLETE when every test has results.</>}
        {tab === 'VERIFY' && <><ShieldCheck className="h-3.5 w-3.5 text-[var(--mc-primary)] shrink-0" /> Completed orders await verification & release. Verified reports can be printed as LABORATORY REQUEST / RESULT REPORT documents.</>}
      </div>

      <DataTable
        data={filtered} columns={baseColumns} actions={actionsFor(tab)}
        rowKey={r => r.id}
        title={activeTab.label}
        moduleLabel={`Lab Orders — ${activeTab.label}`}
        loading={loading}
        emptyMessage={`No orders in ${activeTab.label}`}
      />

      {/* ── View details modal ── */}
      <PremiumModal
        open={!!viewing || viewLoading} onOpenChange={o => { if (!o) setViewing(null); }}
        size="lg"
        title={`Lab Order ${viewing?.orderNo || ''}`}
        icon={<Eye className="h-5 w-5" />}
        description={viewing ? `${pname(viewing.patient)} · requested by ${viewing.requestedByName || '—'} · ${fmtDateTime(viewing.createdAt)}` : 'Loading…'}
        footerNote="Results become visible to the ordering clinician once VERIFIED"
      >
        {viewLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : viewing ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={viewing.status} />
              <PriorityPill priority={viewing.priority} />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />{pname(viewing.patient)}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />{fmtDateTime(viewing.createdAt)}
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <table className="mc-table">
                <thead>
                  <tr><th style={{ width: 44 }}>#</th><th>Test</th><th>Specimen</th><th>Sample Ref</th><th>Value</th><th>Flag</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {(viewing.items || []).map((it, i) => (
                    <tr key={it.id}>
                      <td className="text-muted-foreground">{i + 1}</td>
                      <td className="text-xs font-medium text-[var(--mc-text-primary)]">{it.testName}</td>
                      <td className="text-xs">{it.sampleType || it.labTest?.specimenType || '—'}</td>
                      <td className="text-xs font-mono">{it.sampleRef || '—'}</td>
                      <td className="text-xs">{it.resultValue ? `${it.resultValue} ${it.unit}` : '—'}</td>
                      <td>{it.flag ? <span className="text-[11px] font-bold" style={{ color: flagColor(it.flag) }}>{it.flag}</span> : <span className="text-xs">—</span>}</td>
                      <td><StatusBadge status={it.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {viewing.notes && (
              <div className="rounded-xl border border-[var(--mc-divider)] p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-primary)] mb-1">Order Notes</p>
                <p className="text-sm">{viewing.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Order not found.</p>
        )}
      </PremiumModal>

      {/* ── Collect sample modal (specimen per test) ── */}
      <PremiumModal
        open={collectOpen} onOpenChange={setCollectOpen} size="lg"
        title={`Collect Sample — ${collectOrder?.orderNo || ''}`}
        icon={<Syringe className="h-5 w-5" />}
        description={collectOrder ? `${pname(collectOrder.patient)} · record the specimen collected for each test` : ''}
        footerNote="Saving marks the order SAMPLE_COLLECTED and arms it for result entry"
        submitLabel="Record Samples" onSubmit={submitCollect}
        submitting={collectBusy} secondaryLabel="Cancel"
      >
        {sampleRows.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-24 rounded-xl" />
            <p className="text-sm text-muted-foreground text-center py-4">Loading order tests…</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sampleRows.map((r, i) => (
              <div key={r.itemId} className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)]">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-[var(--mc-primary)]">Test #{i + 1}</span>
                  <span className="text-sm font-semibold text-[var(--mc-text-primary)]">{r.testName}</span>
                  {r.defaultSpecimen && (
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      <TestTube2 className="inline h-3 w-3 mr-1 text-[var(--mc-primary)]" />
                      catalog specimen: {r.defaultSpecimen}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field icon={<TestTube2 className="h-3.5 w-3.5" />} label="Sample Type">
                    <McSelect
                      value={r.sampleType}
                      onValueChange={v => setSampleRow(r.itemId, { sampleType: v })}
                      options={SPECIMENS.map(s => ({ value: s, label: s }))}
                    />
                  </Field>
                  <Field icon={<Boxes className="h-3.5 w-3.5" />} label="Sample Ref / Barcode" hint="e.g. S-2026-0042">
                    <McInput
                      value={r.sampleRef}
                      onChange={e => setSampleRow(r.itemId, { sampleRef: e.target.value })}
                      placeholder="Sample reference"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
      </PremiumModal>

      {/* ── Record results modal (tiptap narrative per test, collapsible) ── */}
      <PremiumModal
        open={resultsOpen} onOpenChange={setResultsOpen} size="xl"
        title={`Record Results — ${resultsOrder?.orderNo || ''}`}
        icon={<FilePenLine className="h-5 w-5" />}
        description={resultsOrder ? `${pname(resultsOrder.patient)} · ${resultsOrder.status.replaceAll('_', ' ')} · ordered ${fmtDate(resultsOrder.createdAt)}` : ''}
        footerNote="An order auto-COMPLETES when every test has results — verify & release afterwards"
        submitLabel="Save Results" onSubmit={submitResults}
        submitting={resultsBusy} secondaryLabel="Cancel"
      >
        {resultRows.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-24 rounded-xl" />
            <p className="text-sm text-muted-foreground text-center py-4">Loading order tests…</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resultRows.map((r, i) => (
              <div key={r.itemId} className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] overflow-hidden">
                {/* Test header */}
                <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-[var(--mc-divider)] bg-white">
                  <span className="text-xs font-bold text-[var(--mc-primary)]">Test #{i + 1}</span>
                  <span className="text-sm font-semibold text-[var(--mc-text-primary)]">{r.testName}</span>
                  <StatusBadge status={r.itemStatus} />
                  {r.referenceRange && (
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      <Gauge className="inline h-3 w-3 mr-1 text-[var(--mc-primary)]" />
                      Ref: {r.referenceRange}
                    </span>
                  )}
                </div>

                {/* Values */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3">
                  <Field icon={<Gauge className="h-3.5 w-3.5" />} label="Result Value">
                    <McInput
                      value={r.resultValue}
                      onChange={e => setResultRow(r.itemId, { resultValue: e.target.value })}
                      placeholder="e.g. 12.4"
                    />
                  </Field>
                  <Field icon={<Gauge className="h-3.5 w-3.5" />} label="Unit">
                    <McInput
                      value={r.unit}
                      onChange={e => setResultRow(r.itemId, { unit: e.target.value })}
                      placeholder="e.g. g/dL"
                    />
                  </Field>
                  <Field icon={<Gauge className="h-3.5 w-3.5" />} label="Flag">
                    <McSelect
                      value={r.flag}
                      onValueChange={v => setResultRow(r.itemId, { flag: v })}
                      options={FLAGS.map(f => ({ value: f, label: f }))}
                    />
                  </Field>
                  <Field icon={<MessageSquareText className="h-3.5 w-3.5" />} label="Remarks">
                    <McInput
                      value={r.remarks}
                      onChange={e => setResultRow(r.itemId, { remarks: e.target.value })}
                      placeholder="Optional tech remarks…"
                    />
                  </Field>
                </div>

                {/* Collapsible narrative editor */}
                <div className="border-t border-[var(--mc-divider)]">
                  <button
                    type="button"
                    onClick={() => setResultRow(r.itemId, { narrativeOpen: !r.narrativeOpen })}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-[var(--mc-text-secondary)] hover:bg-[var(--mc-primary-light)] transition-colors"
                  >
                    {r.narrativeOpen ? <ChevronDown className="h-4 w-4 text-[var(--mc-primary)]" /> : <ChevronRight className="h-4 w-4 text-[var(--mc-primary)]" />}
                    <FilePenLine className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
                    Result Narrative
                    <span className="font-normal text-muted-foreground">— full lab story (rich text)</span>
                    {r.narrative && r.narrative !== '<p></p>' && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold">filled</span>
                    )}
                  </button>
                  {r.narrativeOpen && (
                    <div className="px-3 pb-3">
                      <RichTextEditor
                        value={r.narrative}
                        onChange={html => setResultRow(r.itemId, { narrative: html })}
                        placeholder="e.g. Trophozoites seen; moderate thrombocytopenia noted on smear…"
                        minHeight={160}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PremiumModal>
    </div>
  );
}
