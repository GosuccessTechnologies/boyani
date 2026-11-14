'use client';

/**
 * CMS PAGES — DataTable (title, slug, moduleKey, isPublic, displayOrder) +
 * rich-text modal (content, excerpt, SEO, hero/breadcrumb design selects,
 * isPublic switch) + preview link. Content is fetched per-page via ?id=
 * (the list endpoint omits the content field).
 */

import * as React from 'react';
import {
  FileText, Type, Hash, AlignLeft, Search, Sparkles, PanelTop, Link2,
  Pencil, Trash2, Plus, ExternalLink, Loader2, Eye, Layers,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDate, Field, FormSection, ConfirmModal, BoolPill, PageHeading, SkeletonCards, McInput, McTextarea, McSelect, SwitchRow } from '@/app/ops/_lib';

interface PageRow {
  id: string; slug: string; title: string; excerpt: string; moduleKey: string;
  heroDesignId: number; breadcrumbDesignId: number; seoTitle: string; seoDescription: string;
  showInMenu: boolean; isPublic: boolean; displayOrder: number; publishedAt: string | null;
  updatedAt: string;
}
interface PageFull extends PageRow { content: string }
interface PagesResp { webPages: PageRow[]; total: number; page: number; perPage: number; totalPages: number }

const MODULE_KEYS = ['PAGE', 'ABOUT', 'WHY_CHOOSE_US', 'VALUES', 'VISION_MISSION', 'CONTACT', 'SERVICES', 'PHARMACY', 'LABORATORY', 'MATERNITY'];
const HERO_DESIGNS = Array.from({ length: 6 }, (_, i) => ({ value: String(i + 1), label: `Hero ${i + 1}` }));
const BREADCRUMB_DESIGNS = Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: `Breadcrumb ${i + 1}` }));

const emptyForm = {
  title: '', slug: '', excerpt: '', content: '', moduleKey: 'PAGE',
  heroDesignId: '1', breadcrumbDesignId: '1',
  seoTitle: '', seoDescription: '', showInMenu: true, isPublic: true, displayOrder: '0',
};

export default function WebsitePagesPage() {
  const [pages, setPages] = React.useState<PageRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PageRow | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);
  const [fetchingContent, setFetchingContent] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<PageRow | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<PagesResp>(`/api/web-pages?page=${p}&perPage=20`);
      setPages(res.webPages || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load pages');
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
  const openEdit = async (p: PageRow) => {
    setEditing(p);
    // list endpoint omits content — fetch the full record
    setForm({
      title: p.title, slug: p.slug, excerpt: p.excerpt || '', content: '',
      moduleKey: p.moduleKey || 'PAGE', heroDesignId: String(p.heroDesignId ?? 1),
      breadcrumbDesignId: String(p.breadcrumbDesignId ?? 1),
      seoTitle: p.seoTitle || '', seoDescription: p.seoDescription || '',
      showInMenu: !!p.showInMenu, isPublic: !!p.isPublic, displayOrder: String(p.displayOrder ?? 0),
    });
    setModalOpen(true);
    setFetchingContent(true);
    try {
      const res = await apiGet<{ page: PageFull }>(`/api/web-pages?id=${p.id}`);
      setForm(f => ({ ...f, content: res.page?.content || '' }));
    } catch {
      toast.error('Could not load page content');
    } finally {
      setFetchingContent(false);
    }
  };

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(), slug: form.slug.trim() || undefined, excerpt: form.excerpt,
        content: form.content, moduleKey: form.moduleKey,
        heroDesignId: form.heroDesignId, breadcrumbDesignId: form.breadcrumbDesignId,
        seoTitle: form.seoTitle, seoDescription: form.seoDescription,
        showInMenu: form.showInMenu, isPublic: form.isPublic, displayOrder: form.displayOrder,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/web-pages', payload)
        : await apiPost<{ message: string }>('/api/web-pages', payload);
      toast.success(res.message || (editing ? 'Page updated' : 'Page created'));
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save page');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/web-pages?id=${deleting.id}`);
      toast.success(res.message || 'Page deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<PageRow>[] = [
    { key: 'title', header: 'Title', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {r.title}
        <span className="text-muted-foreground font-normal text-xs"> · /{r.slug}</span>
      </span>
    ) },
    { key: 'moduleKey', header: 'Module', defaultVisible: true, csvValue: r => r.moduleKey.replaceAll('_', ' ') },
    { key: 'isPublic', header: 'Published', defaultVisible: true, render: r => <BoolPill value={r.isPublic} trueLabel="Public" falseLabel="Draft" />, csvValue: r => (r.isPublic ? 'PUBLIC' : 'DRAFT') },
    { key: 'displayOrder', header: 'Order', defaultVisible: true, align: 'right' },
    { key: 'publishedAt', header: 'Published At', render: r => fmtDate(r.publishedAt), csvValue: r => (r.publishedAt ? r.publishedAt.slice(0, 10) : '') },
    { key: 'seoTitle', header: 'SEO Title' },
    { key: 'excerpt', header: 'Excerpt' },
    { key: 'heroDesignId', header: 'Hero' },
    { key: 'breadcrumbDesignId', header: 'Breadcrumb' },
    { key: 'showInMenu', header: 'In Menu', render: r => <BoolPill value={r.showInMenu} />, csvValue: r => (r.showInMenu ? 'YES' : 'NO') },
    { key: 'updatedAt', header: 'Updated', render: r => fmtDate(r.updatedAt), csvValue: r => (r.updatedAt ? r.updatedAt.slice(0, 10) : '') },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'Preview page', variant: 'view', onClick: r => window.open(`/${r.slug}`, '_blank') },
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit page', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete page', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const publicCount = pages.filter(p => p.isPublic).length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<FileText className="h-5 w-5" />}
        title="CMS Pages"
        subtitle="About, values, vision & mission, contact info and custom pages — rich-text powered"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Page</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Pages" value={total} icon={<FileText className="h-5 w-5" />} accent="primary" />
          <StatCard label="Published" value={publicCount} icon={<ExternalLink className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Drafts" value={total - publicCount} icon={<Layers className="h-5 w-5" />} accent="warning" hint="this page" />
          <StatCard label="Modules" value={new Set(pages.map(p => p.moduleKey)).size} icon={<Layers className="h-5 w-5" />} accent="tertiary" />
        </div>
      )}

      <DataTable
        data={pages} columns={columns} actions={actions}
        rowKey={r => r.id} title="CMS Pages" moduleLabel="Website CMS Pages"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="lg"
        title={editing ? `Edit Page — ${editing.title}` : 'New CMS Page'}
        icon={<FileText className="h-5 w-5" />}
        description="Rich-text page rendered on the public website with hero & breadcrumb designs"
        footerNote="First publish stamps the publishedAt date; slugs stay unique"
        submitLabel={editing ? 'Update Page' : 'Create Page'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Basics">
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Title">
              <McInput value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="About Boyani Health Dispensary" />
            </Field>
            <Field icon={<Hash className="h-3.5 w-3.5" />} label="Slug" hint="blank = generated from title">
              <McInput value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="about" />
            </Field>
            <Field icon={<Link2 className="h-3.5 w-3.5" />} label="Module Key">
              <McSelect value={form.moduleKey} onValueChange={v => setForm(f => ({ ...f, moduleKey: v }))} options={MODULE_KEYS.map(m => ({ value: m, label: m.replaceAll('_', ' ') }))} />
            </Field>
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Excerpt">
              <McTextarea value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="One-paragraph summary (also default SEO description)" />
            </Field>
          </FormSection>

          <FormSection n={2} title="Content (Rich Text)">
            <Field icon={<FileText className="h-3.5 w-3.5" />} label="Page Body" className="sm:col-span-2">
              {fetchingContent ? (
                <div className="rounded-xl border border-[var(--mc-divider)] h-48 flex items-center justify-center text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading content…
                </div>
              ) : (
                <RichTextEditor value={form.content} onChange={html => setForm(f => ({ ...f, content: html }))} placeholder="Write the page content…" minHeight={240} />
              )}
            </Field>
          </FormSection>

          <FormSection n={3} title="SEO">
            <Field icon={<Search className="h-3.5 w-3.5" />} label="SEO Title">
              <McInput value={form.seoTitle} onChange={e => setForm(f => ({ ...f, seoTitle: e.target.value }))} placeholder="About Boyani Health Dispensary" />
            </Field>
            <Field icon={<Search className="h-3.5 w-3.5" />} label="SEO Description">
              <McTextarea value={form.seoDescription} onChange={e => setForm(f => ({ ...f, seoDescription: e.target.value }))} placeholder="Meta description for search engines" />
            </Field>
          </FormSection>

          <FormSection n={4} title="Presentation & Visibility">
            <Field icon={<Sparkles className="h-3.5 w-3.5" />} label="Hero Design (1-6)">
              <McSelect value={form.heroDesignId} onValueChange={v => setForm(f => ({ ...f, heroDesignId: v }))} options={HERO_DESIGNS} />
            </Field>
            <Field icon={<PanelTop className="h-3.5 w-3.5" />} label="Breadcrumb Design (1-8)">
              <McSelect value={form.breadcrumbDesignId} onValueChange={v => setForm(f => ({ ...f, breadcrumbDesignId: v }))} options={BREADCRUMB_DESIGNS} />
            </Field>
            <Field icon={<Layers className="h-3.5 w-3.5" />} label="Display Order">
              <McInput type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-1 gap-2 content-start">
              <SwitchRow label="Published (public)" hint="visible on the website" checked={form.isPublic} onCheckedChange={c => setForm(f => ({ ...f, isPublic: c }))} />
              <SwitchRow label="Show in menu" checked={form.showInMenu} onCheckedChange={c => setForm(f => ({ ...f, showInMenu: c }))} />
            </div>
          </FormSection>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Page"
        message={deleting ? `Delete "${deleting.title}" (/${deleting.slug})?` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
