'use client';

/**
 * FRONT DESK — PARCELS (Instruction 27)
 * Received | Dispatched tabs; cards/table with tracking code, sender/receiver,
 * courier, status pills (PENDING amber, IN_TRANSIT blue, DELIVERED/RETURNED
 * green, COLLECTED slate); "Receive Parcel" + "Dispatch Parcel" PremiumModal
 * forms; status advance + view modal + delete.
 */

import * as React from 'react';
import {
  Package, Inbox, Send, Eye, Trash2, ArrowRight, Search, RefreshCcw,
  ChevronLeft, ChevronRight, Truck, MapPin, User, StickyNote, PackageOpen, Undo2,
} from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import {
  Field, FormSection, McInput, McSelect, McTextarea, PageHeading, SkeletonCards,
  fmtDateTime, ConfirmModal,
} from '@/app/ops/_lib';

interface Parcel {
  id: string;
  trackingCode: string;
  type: string;
  description: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  courier: string;
  status: string;
  notes: string;
  handledByName: string;
  handledAt: string;
  createdAt: string;
}

const PARCEL_STATUSES = ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'COLLECTED', 'RETURNED'];

/** Mandated status tones: PENDING amber, IN_TRANSIT blue, DELIVERED/RETURNED green, COLLECTED slate. */
function ParcelStatusPill({ status }: { status: string }) {
  const tone =
    status === 'PENDING' ? 'bg-amber-100 text-amber-700 border-amber-200'
    : status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700 border-blue-200'
    : status === 'DELIVERED' || status === 'RETURNED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tone}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}

/** Lifecycle advance order. */
const FLOW: Record<string, string> = {
  PENDING: 'IN_TRANSIT',
  IN_TRANSIT: 'DELIVERED',
  DELIVERED: 'COLLECTED',
};

interface FormState {
  description: string;
  senderName: string; senderPhone: string; senderAddress: string;
  receiverName: string; receiverPhone: string; receiverAddress: string;
  courier: string; status: string; notes: string;
}

const EMPTY_FORM: FormState = {
  description: '',
  senderName: '', senderPhone: '', senderAddress: '',
  receiverName: '', receiverPhone: '', receiverAddress: '',
  courier: '', status: 'PENDING', notes: '',
};

export default function ParcelsPage() {
  const [tab, setTab] = React.useState<'RECEIVED' | 'DISPATCHED'>('RECEIVED');
  const [parcels, setParcels] = React.useState<Parcel[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [fStatus, setFStatus] = React.useState('ALL');
  const [fSearch, setFSearch] = React.useState('');
  const [fDate, setFDate] = React.useState('');

  // Modals
  const [formOpen, setFormOpen] = React.useState(false);
  const [formType, setFormType] = React.useState<'RECEIVED' | 'DISPATCHED'>('RECEIVED');
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [viewParcel, setViewParcel] = React.useState<Parcel | null>(null);
  const [deleteParcel, setDeleteParcel] = React.useState<Parcel | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [advancingId, setAdvancingId] = React.useState('');

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const loadParcels = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: tab, page: String(p), perPage: '12' });
      if (fStatus !== 'ALL') params.set('status', fStatus);
      if (fSearch.trim()) params.set('search', fSearch.trim());
      if (fDate) params.set('specificDate', fDate);
      const res = await apiGet<{ parcels: Parcel[]; total: number; totalPages: number }>(`/api/parcels?${params.toString()}`);
      setParcels(res.parcels || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      setPage(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load parcels');
    } finally {
      setLoading(false);
    }
  }, [tab, fStatus, fSearch, fDate]);

  React.useEffect(() => { loadParcels(1); }, [loadParcels]);

  const openForm = (type: 'RECEIVED' | 'DISPATCHED') => {
    setFormType(type);
    setForm({ ...EMPTY_FORM, status: type === 'RECEIVED' ? 'PENDING' : 'IN_TRANSIT' });
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!form.description.trim() && !(formType === 'RECEIVED' ? form.senderName : form.receiverName).trim()) {
      toast.error(formType === 'RECEIVED' ? 'Describe the parcel or name the sender' : 'Describe the parcel or name the receiver');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string }>('/api/parcels', { type: formType, ...form });
      toast.success(res.message || 'Parcel logged');
      setFormOpen(false);
      loadParcels(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to log parcel');
    } finally {
      setSubmitting(false);
    }
  };

  const advanceStatus = async (p: Parcel, forced?: string) => {
    const next = forced || FLOW[p.status];
    if (!next) return;
    setAdvancingId(p.id);
    try {
      const res = await apiPut<{ message: string }>('/api/parcels', { id: p.id, status: next });
      toast.success(res.message || 'Status advanced');
      loadParcels(page);
      if (viewParcel?.id === p.id) setViewParcel(vp => vp ? { ...vp, status: next } : vp);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to advance status');
    } finally {
      setAdvancingId('');
    }
  };

  const confirmDelete = async () => {
    if (!deleteParcel) return;
    setDeleting(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/parcels?id=${deleteParcel.id}`);
      toast.success(res.message || 'Parcel deleted');
      setDeleteParcel(null);
      loadParcels(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete parcel');
    } finally {
      setDeleting(false);
    }
  };

  const isReceivedTab = tab === 'RECEIVED';

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Package className="h-5 w-5" />}
        title="Parcels"
        subtitle="Receiving & dispatch — track every parcel that crosses the front desk"
        actions={
          <>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openForm('DISPATCHED')}>
              <Send className="h-4 w-4" /> Dispatch Parcel
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => openForm('RECEIVED')}>
              <Inbox className="h-4 w-4" /> Receive Parcel
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(['RECEIVED', 'DISPATCHED'] as const).map(t => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                active
                  ? 'bg-[var(--mc-primary)] text-white border-transparent shadow-md'
                  : 'bg-white text-[var(--mc-text-secondary)] border-[var(--mc-divider)] hover:bg-[var(--mc-primary-light)]'
              }`}
            >
              {t === 'RECEIVED' ? <Inbox className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {t === 'RECEIVED' ? 'Received' : 'Dispatched'}
            </button>
          );
        })}
        <span className="text-xs text-muted-foreground ml-1">{total} parcel(s)</span>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-white p-3 grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Field icon={<Search className="h-3.5 w-3.5" />} label="Search">
          <McInput placeholder="Tracking code, name, courier…" value={fSearch} onChange={e => setFSearch(e.target.value)} />
        </Field>
        <Field icon={<Truck className="h-3.5 w-3.5" />} label="Status">
          <McSelect value={fStatus} onValueChange={setFStatus} options={[
            { value: 'ALL', label: 'All statuses' },
            ...PARCEL_STATUSES.map(s => ({ value: s, label: s.replaceAll('_', ' ') })),
          ]} />
        </Field>
        <Field icon={<RefreshCcw className="h-3.5 w-3.5" />} label="Date">
          <McInput type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => { setFSearch(''); setFStatus('ALL'); setFDate(''); }}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : parcels.length === 0 ? (
          <div className="text-center py-14 px-4">
            <PackageOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--mc-text-primary)]">No {isReceivedTab ? 'received' : 'dispatched'} parcels</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isReceivedTab ? 'Log a parcel that arrives at the desk.' : 'Record a parcel leaving the facility.'}
            </p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => openForm(tab)}>
              {isReceivedTab ? <Inbox className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              {isReceivedTab ? 'Receive Parcel' : 'Dispatch Parcel'}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="mc-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Tracking Code</th>
                  <th>Description</th>
                  <th>{isReceivedTab ? 'Sender' : 'Receiver'}</th>
                  <th>{isReceivedTab ? 'Receiver' : 'Sender'}</th>
                  <th>Courier</th>
                  <th>Status</th>
                  <th>Logged</th>
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parcels.map((p, i) => (
                  <tr key={p.id}>
                    <td className="text-muted-foreground">{(page - 1) * 12 + i + 1}</td>
                    <td className="font-mono text-xs font-bold text-[var(--mc-primary-dark)] whitespace-nowrap">
                      <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${p.type === 'RECEIVED' ? 'bg-sky-500' : 'bg-violet-500'}`} />
                      {p.trackingCode}
                    </td>
                    <td className="text-sm max-w-[180px] truncate" title={p.description}>{p.description || '—'}</td>
                    <td className="text-sm">{(isReceivedTab ? p.senderName : p.receiverName) || '—'}</td>
                    <td className="text-sm">{(isReceivedTab ? p.receiverName : p.senderName) || '—'}</td>
                    <td className="text-sm whitespace-nowrap">{p.courier || '—'}</td>
                    <td><ParcelStatusPill status={p.status} /></td>
                    <td className="text-xs whitespace-nowrap">
                      {fmtDateTime(p.createdAt)}
                      <p className="text-[10px] text-muted-foreground">by {p.handledByName || '—'}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {FLOW[p.status] ? (
                          <Button
                            size="sm" variant="outline" className="h-7 gap-1 text-xs"
                            disabled={advancingId === p.id}
                            onClick={() => advanceStatus(p)}
                            title={`Advance to ${FLOW[p.status].replaceAll('_', ' ')}`}
                          >
                            <ArrowRight className="h-3 w-3" /> {FLOW[p.status].replaceAll('_', ' ')}
                          </Button>
                        ) : p.status !== 'RETURNED' ? (
                          <Button
                            size="sm" variant="outline" className="h-7 gap-1 text-xs"
                            disabled={advancingId === p.id}
                            onClick={() => advanceStatus(p, 'RETURNED')}
                            title="Mark as RETURNED"
                          >
                            <Undo2 className="h-3 w-3" /> Returned
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setViewParcel(p)} title="View details">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setDeleteParcel(p)} title="Delete">
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--mc-divider)]">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} parcel(s)</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page <= 1} onClick={() => loadParcels(page - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page >= totalPages} onClick={() => loadParcels(page + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Receive / Dispatch form modal ── */}
      <PremiumModal
        open={formOpen}
        onOpenChange={setFormOpen}
        size="lg"
        title={formType === 'RECEIVED' ? 'Receive Parcel' : 'Dispatch Parcel'}
        icon={formType === 'RECEIVED' ? <Inbox className="h-5 w-5 text-white" /> : <Send className="h-5 w-5 text-white" />}
        description={formType === 'RECEIVED'
          ? 'Log a parcel arriving at the facility — a PRC-XXXXXX tracking code is generated automatically.'
          : 'Record a parcel leaving the facility — a DSP-XXXXXX tracking code is generated automatically.'}
        footerNote={formType === 'RECEIVED' ? 'Incoming parcel · front desk receiving' : 'Outgoing parcel · front desk dispatch'}
        submitLabel={formType === 'RECEIVED' ? 'Log Received Parcel' : 'Log Dispatched Parcel'}
        submitIcon={<Package className="h-3.5 w-3.5" />}
        onSubmit={submitForm}
        submitting={submitting}
      >
        <div className="space-y-5">
          <FormSection n={1} title="Parcel details">
            <Field icon={<Package className="h-3.5 w-3.5" />} label="Description" className="sm:col-span-2">
              <McInput placeholder="e.g. Lab reagents box, 3kg" value={form.description} onChange={e => set('description', e.target.value)} />
            </Field>
            <Field icon={<Truck className="h-3.5 w-3.5" />} label="Courier / handler">
              <McInput placeholder="e.g. G4S, Sendy, staff name" value={form.courier} onChange={e => set('courier', e.target.value)} />
            </Field>
            <Field icon={<RefreshCcw className="h-3.5 w-3.5" />} label="Initial status">
              <McSelect value={form.status} onValueChange={v => set('status', v)} options={PARCEL_STATUSES.map(s => ({ value: s, label: s.replaceAll('_', ' ') }))} />
            </Field>
          </FormSection>

          <FormSection n={2} title={formType === 'RECEIVED' ? 'Sender (external party)' : 'Sender (from the facility)'}>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Sender name">
              <McInput placeholder="Sender name" value={form.senderName} onChange={e => set('senderName', e.target.value)} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Sender phone">
              <McInput placeholder="07XX XXX XXX" value={form.senderPhone} onChange={e => set('senderPhone', e.target.value)} />
            </Field>
            <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Sender address" className="sm:col-span-2">
              <McInput placeholder="Address / organisation" value={form.senderAddress} onChange={e => set('senderAddress', e.target.value)} />
            </Field>
          </FormSection>

          <FormSection n={3} title={formType === 'RECEIVED' ? 'Receiver (department / person here)' : 'Receiver (destination)'}>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Receiver name">
              <McInput placeholder="Receiver name" value={form.receiverName} onChange={e => set('receiverName', e.target.value)} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Receiver phone">
              <McInput placeholder="07XX XXX XXX" value={form.receiverPhone} onChange={e => set('receiverPhone', e.target.value)} />
            </Field>
            <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Receiver address" className="sm:col-span-2">
              <McInput placeholder="Address / department / ward" value={form.receiverAddress} onChange={e => set('receiverAddress', e.target.value)} />
            </Field>
          </FormSection>

          <FormSection n={4} title="Notes">
            <Field icon={<StickyNote className="h-3.5 w-3.5" />} label="Notes" className="sm:col-span-2">
              <McTextarea placeholder="Condition on arrival, contents checked by, remarks…" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>

      {/* ── View modal ── */}
      <PremiumModal
        open={!!viewParcel}
        onOpenChange={o => { if (!o) setViewParcel(null); }}
        size="lg"
        title={viewParcel ? `Parcel ${viewParcel.trackingCode}` : 'Parcel'}
        icon={<Package className="h-5 w-5 text-white" />}
        description={viewParcel ? `${viewParcel.type === 'RECEIVED' ? 'Received' : 'Dispatched'} · logged ${fmtDateTime(viewParcel.createdAt)} by ${viewParcel.handledByName || '—'}` : ''}
        footerNote={viewParcel ? `${viewParcel.trackingCode} · ${viewParcel.status.replaceAll('_', ' ')}` : ''}
        secondaryLabel="Close"
      >
        {viewParcel && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <ParcelStatusPill status={viewParcel.status} />
              <span className="text-xs font-mono text-[var(--mc-primary-dark)] font-bold">{viewParcel.trackingCode}</span>
              {viewParcel.courier && <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">{viewParcel.courier}</span>}
              {FLOW[viewParcel.status] && (
                <Button size="sm" className="h-7 gap-1 text-xs ml-auto" disabled={advancingId === viewParcel.id} onClick={() => advanceStatus(viewParcel)}>
                  <ArrowRight className="h-3 w-3" /> Advance to {FLOW[viewParcel.status].replaceAll('_', ' ')}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--mc-text-secondary)] mb-2 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> Sender
                </p>
                <p className="text-sm font-semibold text-[var(--mc-text-primary)]">{viewParcel.senderName || '—'}</p>
                <p className="text-xs text-muted-foreground">{viewParcel.senderPhone || 'no phone'}</p>
                <p className="text-xs text-muted-foreground">{viewParcel.senderAddress || 'no address'}</p>
              </div>
              <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--mc-text-secondary)] mb-2 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> Receiver
                </p>
                <p className="text-sm font-semibold text-[var(--mc-text-primary)]">{viewParcel.receiverName || '—'}</p>
                <p className="text-xs text-muted-foreground">{viewParcel.receiverPhone || 'no phone'}</p>
                <p className="text-xs text-muted-foreground">{viewParcel.receiverAddress || 'no address'}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)] space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--mc-text-secondary)] flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> Description & notes
              </p>
              <p className="text-sm text-[var(--mc-text-primary)]">{viewParcel.description || 'No description'}</p>
              {viewParcel.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{viewParcel.notes}</p>}
            </div>
          </div>
        )}
      </PremiumModal>

      {/* ── Delete confirm ── */}
      <ConfirmModal
        open={!!deleteParcel}
        onOpenChange={o => { if (!o) setDeleteParcel(null); }}
        title="Delete parcel record"
        message={deleteParcel ? `Delete ${deleteParcel.trackingCode} (${deleteParcel.description || 'no description'})? This cannot be undone.` : ''}
        onConfirm={confirmDelete}
        submitting={deleting}
      />
    </div>
  );
}
