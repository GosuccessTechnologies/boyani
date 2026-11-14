'use client';

/**
 * TESTIMONIALS — DataTable + modal (patientName, patientTitle, quote
 * textarea, rating 1-5 stars input, photoUrl FileUploader, department,
 * isFeatured, isPublic).
 */

import * as React from 'react';
import {
  Quote, User, BriefcaseBusiness, AlignLeft, Star, ImageIcon, Hospital,
  Pencil, Trash2, Plus, Layers,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { FileUploader } from '@/components/shared/FileUploader';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, ConfirmModal, BoolPill, PageHeading, SkeletonCards, McInput, McTextarea, SwitchRow } from '@/app/ops/_lib';

interface Testimonial {
  id: string; patientName: string; patientTitle: string; quote: string; rating: number;
  photoUrl: string; department: string; isFeatured: boolean; isPublic: boolean; displayOrder: number;
}
interface TestimonialsResp { testimonials: Testimonial[]; total: number; page: number; perPage: number; totalPages: number }

const emptyForm = {
  patientName: '', patientTitle: 'Patient', quote: '', rating: '5', photoUrl: '',
  department: '', isFeatured: false, isPublic: true, displayOrder: '0',
};

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < value ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
      ))}
    </span>
  );
}

export default function TestimonialsPage() {
  const [items, setItems] = React.useState<Testimonial[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Testimonial | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Testimonial | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<TestimonialsResp>(`/api/testimonials?page=${p}&perPage=20`);
      setItems(res.testimonials || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(1); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, displayOrder: String(items.length) });
    setModalOpen(true);
  };
  const openEdit = (t: Testimonial) => {
    setEditing(t);
    setForm({
      patientName: t.patientName, patientTitle: t.patientTitle || 'Patient', quote: t.quote || '',
      rating: String(t.rating ?? 5), photoUrl: t.photoUrl || '', department: t.department || '',
      isFeatured: !!t.isFeatured, isPublic: !!t.isPublic, displayOrder: String(t.displayOrder ?? 0),
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.patientName.trim() || !form.quote.trim()) { toast.error('Patient name and quote are required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        patientName: form.patientName.trim(), patientTitle: form.patientTitle, quote: form.quote.trim(),
        rating: form.rating, photoUrl: form.photoUrl, department: form.department,
        isFeatured: form.isFeatured, isPublic: form.isPublic, displayOrder: form.displayOrder,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/testimonials', payload)
        : await apiPost<{ message: string }>('/api/testimonials', payload);
      toast.success(res.message || (editing ? 'Testimonial updated' : 'Testimonial created'));
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save testimonial');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/testimonials?id=${deleting.id}`);
      toast.success(res.message || 'Testimonial deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Testimonial>[] = [
    { key: 'patientName', header: 'Patient', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {r.patientName}
        <span className="text-muted-foreground font-normal text-xs"> · {r.patientTitle || 'Patient'}</span>
      </span>
    ) },
    { key: 'quote', header: 'Quote', defaultVisible: true, render: r => <span className="text-xs line-clamp-2">{r.quote}</span> },
    { key: 'rating', header: 'Rating', defaultVisible: true, render: r => <Stars value={r.rating} />, csvValue: r => `${r.rating}/5` },
    { key: 'isPublic', header: 'Status', defaultVisible: true, render: r => <BoolPill value={r.isPublic} trueLabel="Public" falseLabel="Hidden" />, csvValue: r => (r.isPublic ? 'PUBLIC' : 'HIDDEN') },
    { key: 'department', header: 'Department' },
    { key: 'isFeatured', header: 'Featured', render: r => <BoolPill value={r.isFeatured} />, csvValue: r => (r.isFeatured ? 'YES' : 'NO') },
    { key: 'displayOrder', header: 'Order', align: 'right' },
  ];

  const actions: ActionBtn[] = [
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit testimonial', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete testimonial', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const avgRating = items.length ? items.reduce((s, t) => s + t.rating, 0) / items.length : 0;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Quote className="h-5 w-5" />}
        title="Testimonials"
        subtitle="Patient voices — featured testimonials feed the homepage carousel"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Testimonial</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Testimonials" value={total} icon={<Quote className="h-5 w-5" />} accent="primary" />
          <StatCard label="Avg Rating" value={avgRating ? `${avgRating.toFixed(1)} / 5` : '—'} icon={<Star className="h-5 w-5" />} accent="warning" />
          <StatCard label="Featured" value={items.filter(t => t.isFeatured).length} icon={<Star className="h-5 w-5" />} accent="secondary" hint="this page" />
          <StatCard label="Public" value={items.filter(t => t.isPublic).length} icon={<Layers className="h-5 w-5" />} accent="success" hint="this page" />
        </div>
      )}

      <DataTable
        data={items} columns={columns} actions={actions}
        rowKey={r => r.id} title="Testimonials" moduleLabel="Website Testimonials"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="lg"
        title={editing ? `Edit Testimonial — ${editing.patientName}` : 'New Testimonial'}
        icon={<Quote className="h-5 w-5" />}
        description="Patient feedback shown on the website & homepage carousel widget"
        footerNote="Featured testimonials display first"
        submitLabel={editing ? 'Update Testimonial' : 'Create Testimonial'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Patient">
            <Field icon={<User className="h-3.5 w-3.5" />} label="Patient Name">
              <McInput value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} placeholder="Jane Wanjiru" />
            </Field>
            <Field icon={<BriefcaseBusiness className="h-3.5 w-3.5" />} label="Title">
              <McInput value={form.patientTitle} onChange={e => setForm(f => ({ ...f, patientTitle: e.target.value }))} placeholder="Mother of two / Outpatient" />
            </Field>
            <Field icon={<Hospital className="h-3.5 w-3.5" />} label="Department">
              <McInput value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Maternity" />
            </Field>
            <Field icon={<Star className="h-3.5 w-3.5" />} label="Rating (1 – 5)">
              <div className="flex items-center gap-1.5 rounded-xl border border-[var(--mc-divider)] bg-white px-3 py-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, rating: String(i + 1) }))}
                    title={`${i + 1} star${i ? 's' : ''}`}
                    className="p-0.5"
                  >
                    <Star className={`h-5 w-5 transition-colors ${i < Number(form.rating) ? 'text-amber-500 fill-amber-500' : 'text-slate-300 hover:text-amber-300'}`} />
                  </button>
                ))}
                <span className="ml-2 text-xs font-semibold text-[var(--mc-text-secondary)]">{form.rating} / 5</span>
              </div>
            </Field>
          </FormSection>

          <FormSection n={2} title="Voice">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Quote" className="sm:col-span-2">
              <McTextarea className="mc-input min-h-[100px]" value={form.quote} onChange={e => setForm(f => ({ ...f, quote: e.target.value }))} placeholder="The maternity team took such good care of us…" />
            </Field>
            <Field icon={<ImageIcon className="h-3.5 w-3.5" />} label="Patient Photo" className="sm:col-span-2">
              <FileUploader value={form.photoUrl} onChange={url => setForm(f => ({ ...f, photoUrl: url }))} module="WEBSITE" label="Upload patient photo (with consent)" />
            </Field>
          </FormSection>

          <FormSection n={3} title="Display">
            <Field icon={<Layers className="h-3.5 w-3.5" />} label="Display Order">
              <McInput type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-1 gap-2 content-start">
              <SwitchRow label="Featured" hint="shown first / homepage" checked={form.isFeatured} onCheckedChange={c => setForm(f => ({ ...f, isFeatured: c }))} />
              <SwitchRow label="Public (visible)" checked={form.isPublic} onCheckedChange={c => setForm(f => ({ ...f, isPublic: c }))} />
            </div>
          </FormSection>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Testimonial"
        message={deleting ? `Delete the testimonial from ${deleting.patientName}?` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
