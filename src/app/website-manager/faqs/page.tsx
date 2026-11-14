'use client';

/**
 * FAQS — DataTable + modal (question, answer textarea, category,
 * displayOrder, isPublic).
 */

import * as React from 'react';
import {
  HelpCircle, CircleHelp, AlignLeft, Tag, Layers,
  Pencil, Trash2, Plus, ListOrdered,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, ConfirmModal, BoolPill, PageHeading, SkeletonCards, McInput, McTextarea, McSelect, SwitchRow } from '@/app/ops/_lib';

interface Faq {
  id: string; question: string; answer: string; category: string;
  displayOrder: number; isPublic: boolean;
}
interface FaqsResp { faqs: Faq[]; total: number; page: number; perPage: number; totalPages: number }

const CATEGORIES = ['GENERAL', 'BILLING', 'APPOINTMENTS', 'INSURANCE', 'PHARMACY', 'VISITING'];

const emptyForm = { question: '', answer: '', category: 'GENERAL', displayOrder: '0', isPublic: true };

export default function FaqsPage() {
  const [faqs, setFaqs] = React.useState<Faq[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Faq | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Faq | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<FaqsResp>(`/api/faqs?page=${p}&perPage=20`);
      setFaqs(res.faqs || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(1); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, displayOrder: String(faqs.length) });
    setModalOpen(true);
  };
  const openEdit = (f: Faq) => {
    setEditing(f);
    setForm({
      question: f.question, answer: f.answer || '', category: f.category || 'GENERAL',
      displayOrder: String(f.displayOrder ?? 0), isPublic: !!f.isPublic,
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.question.trim() || !form.answer.trim()) { toast.error('Question and answer are required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        question: form.question.trim(), answer: form.answer.trim(), category: form.category,
        displayOrder: form.displayOrder, isPublic: form.isPublic,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/faqs', payload)
        : await apiPost<{ message: string }>('/api/faqs', payload);
      toast.success(res.message || (editing ? 'FAQ updated' : 'FAQ created'));
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save FAQ');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/faqs?id=${deleting.id}`);
      toast.success(res.message || 'FAQ deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Faq>[] = [
    { key: 'question', header: 'Question', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)] text-sm">{r.question}</span>
    ) },
    { key: 'category', header: 'Category', defaultVisible: true, csvValue: r => r.category },
    { key: 'answer', header: 'Answer', defaultVisible: true, render: r => <span className="text-xs line-clamp-2">{r.answer}</span> },
    { key: 'isPublic', header: 'Status', defaultVisible: true, render: r => <BoolPill value={r.isPublic} trueLabel="Public" falseLabel="Hidden" />, csvValue: r => (r.isPublic ? 'PUBLIC' : 'HIDDEN') },
    { key: 'displayOrder', header: 'Order', align: 'right' },
  ];

  const actions: ActionBtn[] = [
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit FAQ', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete FAQ', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<HelpCircle className="h-5 w-5" />}
        title="FAQs"
        subtitle="Frequently asked questions — grouped by category, rendered as an accordion"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New FAQ</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="FAQs" value={total} icon={<CircleHelp className="h-5 w-5" />} accent="primary" />
          <StatCard label="Public" value={faqs.filter(f => f.isPublic).length} icon={<Layers className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Categories" value={new Set(faqs.map(f => f.category)).size} icon={<Tag className="h-5 w-5" />} accent="tertiary" />
          <StatCard label="Hidden" value={faqs.filter(f => !f.isPublic).length} icon={<ListOrdered className="h-5 w-5" />} accent="warning" hint="this page" />
        </div>
      )}

      <DataTable
        data={faqs} columns={columns} actions={actions}
        rowKey={r => r.id} title="FAQs" moduleLabel="Website FAQs"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="md"
        title={editing ? 'Edit FAQ' : 'New FAQ'}
        icon={<HelpCircle className="h-5 w-5" />}
        description="Question & answer pairs shown on the public FAQ page"
        footerNote="FAQs display in ascending display order, grouped by category"
        submitLabel={editing ? 'Update FAQ' : 'Create FAQ'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Question & Answer">
            <Field icon={<CircleHelp className="h-3.5 w-3.5" />} label="Question" className="sm:col-span-2">
              <McInput value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} placeholder="What are your visiting hours?" />
            </Field>
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Answer" className="sm:col-span-2">
              <McTextarea className="mc-input min-h-[110px]" value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} placeholder="General wards: 10:00 AM – 12:00 PM and 4:00 PM – 6:00 PM daily…" />
            </Field>
          </FormSection>

          <FormSection n={2} title="Organisation">
            <Field icon={<Tag className="h-3.5 w-3.5" />} label="Category">
              <McSelect value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
            </Field>
            <Field icon={<Layers className="h-3.5 w-3.5" />} label="Display Order">
              <McInput type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
            </Field>
            <div className="sm:col-span-2">
              <SwitchRow label="Public (visible on website)" checked={form.isPublic} onCheckedChange={c => setForm(f => ({ ...f, isPublic: c }))} />
            </div>
          </FormSection>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete FAQ"
        message={deleting ? `Delete "${deleting.question.slice(0, 70)}${deleting.question.length > 70 ? '…' : ''}"?` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
