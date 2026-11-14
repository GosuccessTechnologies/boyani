'use client';

/**
 * DOWNLOADS — downloads centre manager. DataTable + modal (title,
 * description, fileUrl FileUploader, category, coverImageUrl, isPublic,
 * displayOrder). Shows downloadCount.
 */

import * as React from 'react';
import {
  Download, Type, Tag, FileText, ImageIcon, AlignLeft, Layers,
  Pencil, Trash2, Plus, ExternalLink, Eye, TrendingUp,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { FileUploader } from '@/components/shared/FileUploader';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { num, Field, FormSection, ConfirmModal, BoolPill, PageHeading, SkeletonCards, McInput, McTextarea, McSelect, SwitchRow } from '@/app/ops/_lib';

interface DownloadItem {
  id: string; title: string; description: string; fileUrl: string; fileExt: string;
  fileSize: number; category: string; coverImageUrl: string; downloadCount: number;
  isPublic: boolean; displayOrder: number; createdAt: string;
}
interface DownloadsResp { downloads: DownloadItem[]; total: number; page: number; perPage: number; totalPages: number }

const CATEGORIES = ['GENERAL', 'FORMS', 'REPORTS', 'POLICIES', 'BROCHURES', 'TENDER_DOCS'];

const emptyForm = {
  title: '', description: '', fileUrl: '', category: 'GENERAL', coverImageUrl: '', isPublic: true, displayOrder: '0',
};

export default function DownloadsPage() {
  const [items, setItems] = React.useState<DownloadItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DownloadItem | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<DownloadItem | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<DownloadsResp>(`/api/downloads?page=${p}&perPage=20`);
      setItems(res.downloads || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load downloads');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(1); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };
  const openEdit = (d: DownloadItem) => {
    setEditing(d);
    setForm({
      title: d.title, description: d.description || '', fileUrl: d.fileUrl || '',
      category: d.category || 'GENERAL', coverImageUrl: d.coverImageUrl || '',
      isPublic: !!d.isPublic, displayOrder: String(d.displayOrder ?? 0),
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim() || !form.fileUrl.trim()) { toast.error('Title and file are required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(), description: form.description, fileUrl: form.fileUrl.trim(),
        category: form.category, coverImageUrl: form.coverImageUrl,
        isPublic: form.isPublic, displayOrder: form.displayOrder,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/downloads', payload)
        : await apiPost<{ message: string }>('/api/downloads', payload);
      toast.success(res.message || (editing ? 'Download updated' : 'Download created'));
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save download');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/downloads?id=${deleting.id}`);
      toast.success(res.message || 'Download deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<DownloadItem>[] = [
    { key: 'title', header: 'Title', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {r.title}
        <span className="text-muted-foreground font-normal text-xs"> · {r.fileExt}</span>
      </span>
    ) },
    { key: 'category', header: 'Category', defaultVisible: true, csvValue: r => r.category.replaceAll('_', ' ') },
    { key: 'downloadCount', header: 'Downloads', defaultVisible: true, align: 'right', render: r => (
      <span className="font-semibold">{num(r.downloadCount)}</span>
    ), csvValue: r => r.downloadCount },
    { key: 'isPublic', header: 'Status', defaultVisible: true, render: r => <BoolPill value={r.isPublic} trueLabel="Public" falseLabel="Hidden" />, csvValue: r => (r.isPublic ? 'PUBLIC' : 'HIDDEN') },
    { key: 'description', header: 'Description' },
    { key: 'fileExt', header: 'Type' },
    { key: 'displayOrder', header: 'Order', align: 'right' },
    { key: 'fileUrl', header: 'File URL' },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'Open file', variant: 'view', onClick: r => window.open(r.fileUrl, '_blank') },
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit download', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete download', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const totalDownloadsCount = items.reduce((s, d) => s + d.downloadCount, 0);
  const publicCount = items.filter(d => d.isPublic).length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Download className="h-5 w-5" />}
        title="Downloads Centre"
        subtitle="Forms, reports, policies, brochures & tender documents for the public website"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Download</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Downloads" value={total} icon={<Download className="h-5 w-5" />} accent="primary" />
          <StatCard label="Public" value={publicCount} icon={<ExternalLink className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Total Hits" value={num(totalDownloadsCount)} icon={<TrendingUp className="h-5 w-5" />} accent="secondary" hint="this page" />
          <StatCard label="Categories" value={new Set(items.map(d => d.category)).size} icon={<Layers className="h-5 w-5" />} accent="tertiary" />
        </div>
      )}

      <DataTable
        data={items} columns={columns} actions={actions}
        rowKey={r => r.id} title="Downloads" moduleLabel="Website Downloads"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="lg"
        title={editing ? `Edit Download — ${editing.title}` : 'New Download'}
        icon={<Download className="h-5 w-5" />}
        description="Public downloads centre — visitors click to download (counter increments)"
        footerNote="File type/size auto-detected from the uploaded file"
        submitLabel={editing ? 'Update Download' : 'Create Download'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Details">
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Title">
              <McInput value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Patient Registration Form" />
            </Field>
            <Field icon={<Tag className="h-3.5 w-3.5" />} label="Category">
              <McSelect value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))} options={CATEGORIES.map(c => ({ value: c, label: c.replaceAll('_', ' ') }))} />
            </Field>
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Description" className="sm:col-span-2">
              <McTextarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What this file contains…" />
            </Field>
          </FormSection>

          <FormSection n={2} title="File & Cover">
            <Field icon={<FileText className="h-3.5 w-3.5" />} label="File" className="sm:col-span-2" hint="PDF, DOCX, XLSX… (no compression for documents)">
              <FileUploader value={form.fileUrl} onChange={url => setForm(f => ({ ...f, fileUrl: url }))} module="DOCS" accept="*/*" compress={false} label="Upload the downloadable file" />
            </Field>
            <Field icon={<ImageIcon className="h-3.5 w-3.5" />} label="Cover Image (optional)" className="sm:col-span-2">
              <FileUploader value={form.coverImageUrl} onChange={url => setForm(f => ({ ...f, coverImageUrl: url }))} module="WEBSITE" label="Upload cover image" />
            </Field>
          </FormSection>

          <FormSection n={3} title="Visibility">
            <Field icon={<Layers className="h-3.5 w-3.5" />} label="Display Order">
              <McInput type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
            </Field>
            <SwitchRow label="Public (visible on website)" checked={form.isPublic} onCheckedChange={c => setForm(f => ({ ...f, isPublic: c }))} />
          </FormSection>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Download"
        message={deleting ? `Delete "${deleting.title}"?` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
