'use client';

/**
 * FRONT DESK — CALLS (Instruction 27)
 * Log table (direction icon, caller, phone, category chip, duration, handler,
 * time) + "Log Call" PremiumModal (direction, caller name, phone, regarding,
 * category, duration, notes RichTextEditor) + view + edit + delete.
 */

import * as React from 'react';
import {
  PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, Eye, Pencil, Trash2,
  Search, RefreshCcw, ChevronLeft, ChevronRight, User, MessageSquareText, Timer, StickyNote,
} from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import {
  Field, FormSection, McInput, McSelect, PageHeading, ConfirmModal, fmtDateTime,
} from '@/app/ops/_lib';

interface CallRecord {
  id: string;
  direction: string;
  callerName: string;
  callerPhone: string;
  regarding: string;
  category: string;
  durationSec: number;
  notes: string;
  handledByName: string;
  callTime: string;
  createdAt: string;
}

const DIRECTIONS = ['IN', 'OUT', 'MISSED'];
const CATEGORIES = ['GENERAL', 'APPOINTMENT', 'INQUIRY', 'COMPLAINT', 'FOLLOWUP', 'EMERGENCY'];

const CATEGORY_TONES: Record<string, string> = {
  GENERAL: 'bg-slate-100 text-slate-600 border-slate-200',
  APPOINTMENT: 'bg-sky-100 text-sky-700 border-sky-200',
  INQUIRY: 'bg-blue-100 text-blue-700 border-blue-200',
  COMPLAINT: 'bg-red-100 text-red-700 border-red-200',
  FOLLOWUP: 'bg-amber-100 text-amber-700 border-amber-200',
  EMERGENCY: 'bg-rose-100 text-rose-700 border-rose-200',
};

function CategoryChip({ category }: { category: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${CATEGORY_TONES[category] || CATEGORY_TONES.GENERAL}`}>
      {category}
    </span>
  );
}

function DirectionIcon({ direction, size = 'h-4 w-4' }: { direction: string; size?: string }) {
  if (direction === 'IN') return <PhoneIncoming className={`${size} text-emerald-600`} />;
  if (direction === 'OUT') return <PhoneOutgoing className={`${size} text-sky-600`} />;
  return <PhoneMissed className={`${size} text-red-600`} />;
}

const DIRECTION_LABEL: Record<string, string> = { IN: 'Incoming', OUT: 'Outgoing', MISSED: 'Missed' };

const fmtDuration = (sec: number) => {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`;
};

interface FormState {
  direction: string;
  callerName: string;
  callerPhone: string;
  regarding: string;
  category: string;
  durMin: string;
  durSec: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  direction: 'IN', callerName: '', callerPhone: '', regarding: '',
  category: 'GENERAL', durMin: '0', durSec: '0', notes: '',
};

export default function CallsPage() {
  const [calls, setCalls] = React.useState<CallRecord[]>([]);
  const [total, setTotal] = React.useState(0);
  const [todayCount, setTodayCount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [fDirection, setFDirection] = React.useState('ALL');
  const [fCategory, setFCategory] = React.useState('ALL');
  const [fSearch, setFSearch] = React.useState('');
  const [fDate, setFDate] = React.useState('');

  // Modals
  const [formOpen, setFormOpen] = React.useState(false);
  const [editId, setEditId] = React.useState(''); // '' = new log
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [viewCall, setViewCall] = React.useState<CallRecord | null>(null);
  const [deleteCall, setDeleteCall] = React.useState<CallRecord | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const loadCalls = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), perPage: '15' });
      if (fDirection !== 'ALL') params.set('direction', fDirection);
      if (fCategory !== 'ALL') params.set('category', fCategory);
      if (fSearch.trim()) params.set('search', fSearch.trim());
      if (fDate) params.set('specificDate', fDate);
      const res = await apiGet<{ calls: CallRecord[]; total: number; totalPages: number; todayCount: number }>(`/api/calls?${params.toString()}`);
      setCalls(res.calls || []);
      setTotal(res.total || 0);
      setTodayCount(res.todayCount || 0);
      setTotalPages(res.totalPages || 1);
      setPage(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load call log');
    } finally {
      setLoading(false);
    }
  }, [fDirection, fCategory, fSearch, fDate]);

  React.useEffect(() => { loadCalls(1); }, [loadCalls]);

  const openNew = () => {
    setEditId('');
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (c: CallRecord) => {
    setEditId(c.id);
    setForm({
      direction: c.direction,
      callerName: c.callerName,
      callerPhone: c.callerPhone,
      regarding: c.regarding,
      category: c.category,
      durMin: String(Math.floor((c.durationSec || 0) / 60)),
      durSec: String((c.durationSec || 0) % 60),
      notes: c.notes || '',
    });
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!form.callerPhone.trim() && !form.callerName.trim()) {
      toast.error('Provide a caller phone number or name');
      return;
    }
    setSubmitting(true);
    try {
      const durationSec = (parseInt(form.durMin || '0', 10) || 0) * 60 + (parseInt(form.durSec || '0', 10) || 0);
      const payload = {
        direction: form.direction,
        callerName: form.callerName,
        callerPhone: form.callerPhone,
        regarding: form.regarding,
        category: form.category,
        durationSec,
        notes: form.notes,
      };
      const res = editId
        ? await apiPut<{ message: string }>('/api/calls', { id: editId, ...payload })
        : await apiPost<{ message: string }>('/api/calls', payload);
      toast.success(res.message || (editId ? 'Call log updated' : 'Call logged'));
      setFormOpen(false);
      loadCalls(editId ? page : 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save call log');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteCall) return;
    setDeleting(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/calls?id=${deleteCall.id}`);
      toast.success(res.message || 'Call log deleted');
      setDeleteCall(null);
      loadCalls(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete call log');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<PhoneCall className="h-5 w-5" />}
        title="Calls"
        subtitle={`Facility call log — ${todayCount} call${todayCount === 1 ? '' : 's'} logged today`}
        actions={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <PhoneCall className="h-4 w-4" /> Log Call
          </Button>
        }
      />

      {/* Filters */}
      <div className="rounded-xl border bg-white p-3 grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <Field icon={<Search className="h-3.5 w-3.5" />} label="Search">
          <McInput placeholder="Caller, phone, regarding…" value={fSearch} onChange={e => setFSearch(e.target.value)} />
        </Field>
        <Field icon={<PhoneCall className="h-3.5 w-3.5" />} label="Direction">
          <McSelect value={fDirection} onValueChange={setFDirection} options={[
            { value: 'ALL', label: 'All directions' },
            ...DIRECTIONS.map(d => ({ value: d, label: DIRECTION_LABEL[d] })),
          ]} />
        </Field>
        <Field icon={<MessageSquareText className="h-3.5 w-3.5" />} label="Category">
          <McSelect value={fCategory} onValueChange={setFCategory} options={[
            { value: 'ALL', label: 'All categories' },
            ...CATEGORIES.map(c => ({ value: c, label: c })),
          ]} />
        </Field>
        <Field icon={<RefreshCcw className="h-3.5 w-3.5" />} label="Date">
          <McInput type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => { setFSearch(''); setFDirection('ALL'); setFCategory('ALL'); setFDate(''); }}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {/* Log table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : calls.length === 0 ? (
          <div className="text-center py-14 px-4">
            <PhoneMissed className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--mc-text-primary)]">No calls logged</p>
            <p className="text-xs text-muted-foreground mt-1">Log incoming, outgoing and missed calls handled at the desk.</p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={openNew}><PhoneCall className="h-3.5 w-3.5" /> Log Call</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="mc-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th style={{ width: 44 }}>Dir</th>
                  <th>Caller</th>
                  <th>Phone</th>
                  <th>Regarding</th>
                  <th>Category</th>
                  <th>Duration</th>
                  <th>Handler</th>
                  <th>Time</th>
                  <th style={{ width: 130 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c, i) => (
                  <tr key={c.id}>
                    <td className="text-muted-foreground">{(page - 1) * 15 + i + 1}</td>
                    <td><DirectionIcon direction={c.direction} /></td>
                    <td className="text-sm font-semibold text-[var(--mc-text-primary)]">{c.callerName || 'Unknown caller'}</td>
                    <td className="text-sm whitespace-nowrap">{c.callerPhone || '—'}</td>
                    <td className="text-sm max-w-[200px] truncate" title={c.regarding}>{c.regarding || '—'}</td>
                    <td><CategoryChip category={c.category} /></td>
                    <td className="text-xs whitespace-nowrap">
                      {c.direction === 'MISSED' ? <span className="text-muted-foreground">—</span> : fmtDuration(c.durationSec)}
                    </td>
                    <td className="text-xs whitespace-nowrap">{c.handledByName || '—'}</td>
                    <td className="text-xs whitespace-nowrap">{fmtDateTime(c.callTime)}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setViewCall(c)} title="View">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openEdit(c)} title="Edit">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setDeleteCall(c)} title="Delete">
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
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} call(s)</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page <= 1} onClick={() => loadCalls(page - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page >= totalPages} onClick={() => loadCalls(page + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Log / Edit call modal ── */}
      <PremiumModal
        open={formOpen}
        onOpenChange={setFormOpen}
        size="lg"
        title={editId ? 'Edit Call Log' : 'Log Call'}
        icon={<PhoneCall className="h-5 w-5 text-white" />}
        description={editId ? 'Update the details of this logged call.' : 'Record a call received, made or missed at the front desk.'}
        footerNote={editId ? 'Editing an existing call record' : `${DIRECTION_LABEL[form.direction]} call · ${form.category}`}
        submitLabel={editId ? 'Save Changes' : 'Log Call'}
        submitIcon={<PhoneCall className="h-3.5 w-3.5" />}
        onSubmit={submitForm}
        submitting={submitting}
      >
        <div className="space-y-5">
          <FormSection n={1} title="Call details">
            <Field icon={<PhoneCall className="h-3.5 w-3.5" />} label="Direction">
              <McSelect value={form.direction} onValueChange={v => set('direction', v)} options={DIRECTIONS.map(d => ({ value: d, label: DIRECTION_LABEL[d] }))} />
            </Field>
            <Field icon={<MessageSquareText className="h-3.5 w-3.5" />} label="Category">
              <McSelect value={form.category} onValueChange={v => set('category', v)} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Caller name">
              <McInput placeholder="e.g. Jane Doe" value={form.callerName} onChange={e => set('callerName', e.target.value)} />
            </Field>
            <Field icon={<PhoneCall className="h-3.5 w-3.5" />} label="Phone number">
              <McInput placeholder="07XX XXX XXX" value={form.callerPhone} onChange={e => set('callerPhone', e.target.value)} />
            </Field>
            <Field icon={<MessageSquareText className="h-3.5 w-3.5" />} label="Regarding" className="sm:col-span-2">
              <McInput placeholder="e.g. Appointment reschedule, lab results enquiry…" value={form.regarding} onChange={e => set('regarding', e.target.value)} />
            </Field>
            <Field icon={<Timer className="h-3.5 w-3.5" />} label="Duration" hint="Ignored for missed calls" className="sm:col-span-2">
              <div className="flex items-center gap-2">
                <McInput type="number" min={0} placeholder="min" className="w-24" value={form.durMin} onChange={e => set('durMin', e.target.value)} />
                <span className="text-xs text-muted-foreground">min</span>
                <McInput type="number" min={0} max={59} placeholder="sec" className="w-24" value={form.durSec} onChange={e => set('durSec', e.target.value)} />
                <span className="text-xs text-muted-foreground">sec</span>
                <span className="text-xs text-muted-foreground ml-2">
                  = {fmtDuration((parseInt(form.durMin || '0', 10) || 0) * 60 + (parseInt(form.durSec || '0', 10) || 0))}
                </span>
              </div>
            </Field>
          </FormSection>

          <FormSection n={2} title="Notes">
            <Field icon={<StickyNote className="h-3.5 w-3.5" />} label="Call notes (rich text)" className="sm:col-span-2">
              <RichTextEditor value={form.notes} onChange={v => set('notes', v)} placeholder="What was discussed, follow-ups promised…" minHeight={160} />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>

      {/* ── View modal ── */}
      <PremiumModal
        open={!!viewCall}
        onOpenChange={o => { if (!o) setViewCall(null); }}
        size="lg"
        title={viewCall ? `${DIRECTION_LABEL[viewCall.direction]} Call` : 'Call'}
        icon={<PhoneCall className="h-5 w-5 text-white" />}
        description={viewCall ? `${viewCall.callerName || 'Unknown caller'} · ${fmtDateTime(viewCall.callTime)} · handled by ${viewCall.handledByName || '—'}` : ''}
        footerNote={viewCall ? `${DIRECTION_LABEL[viewCall.direction]} · ${viewCall.category} · ${fmtDuration(viewCall.durationSec)}` : ''}
        secondaryLabel="Close"
        extraFooter={viewCall ? (
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => { const c = viewCall; setViewCall(null); openEdit(c); }}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        ) : undefined}
      >
        {viewCall && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)] text-center">
                <DirectionIcon direction={viewCall.direction} size="h-5 w-5" />
                <p className="text-[10px] uppercase font-bold text-[var(--mc-text-secondary)] mt-1">Direction</p>
                <p className="text-xs font-semibold text-[var(--mc-text-primary)]">{DIRECTION_LABEL[viewCall.direction]}</p>
              </div>
              <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)] text-center">
                <Timer className="h-5 w-5 mx-auto text-[var(--mc-primary)]" />
                <p className="text-[10px] uppercase font-bold text-[var(--mc-text-secondary)] mt-1">Duration</p>
                <p className="text-xs font-semibold text-[var(--mc-text-primary)]">{viewCall.direction === 'MISSED' ? '—' : fmtDuration(viewCall.durationSec)}</p>
              </div>
              <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)] text-center">
                <MessageSquareText className="h-5 w-5 mx-auto text-[var(--mc-primary)]" />
                <p className="text-[10px] uppercase font-bold text-[var(--mc-text-secondary)] mt-1">Category</p>
                <div className="mt-1 flex justify-center"><CategoryChip category={viewCall.category} /></div>
              </div>
              <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)] text-center">
                <User className="h-5 w-5 mx-auto text-[var(--mc-primary)]" />
                <p className="text-[10px] uppercase font-bold text-[var(--mc-text-secondary)] mt-1">Handler</p>
                <p className="text-xs font-semibold text-[var(--mc-text-primary)] truncate">{viewCall.handledByName || '—'}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)] space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--mc-text-secondary)]">Caller</p>
              <p className="text-sm font-semibold text-[var(--mc-text-primary)]">{viewCall.callerName || 'Unknown caller'} · {viewCall.callerPhone || 'no phone'}</p>
              {viewCall.regarding && <p className="text-xs text-muted-foreground">Regarding: {viewCall.regarding}</p>}
            </div>

            <div className="rounded-xl border border-[var(--mc-divider)] bg-white p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--mc-text-secondary)] mb-2">Notes</p>
              {viewCall.notes && viewCall.notes !== '<p></p>'
                ? <div className="mc-prose text-sm" dangerouslySetInnerHTML={{ __html: viewCall.notes }} />
                : <p className="text-xs text-muted-foreground">No notes recorded.</p>}
            </div>
          </div>
        )}
      </PremiumModal>

      {/* ── Delete confirm ── */}
      <ConfirmModal
        open={!!deleteCall}
        onOpenChange={o => { if (!o) setDeleteCall(null); }}
        title="Delete call record"
        message={deleteCall ? `Delete the ${DIRECTION_LABEL[deleteCall.direction].toLowerCase()} call from ${deleteCall.callerName || deleteCall.callerPhone || 'unknown caller'}? This cannot be undone.` : ''}
        onConfirm={confirmDelete}
        submitting={deleting}
      />
    </div>
  );
}
