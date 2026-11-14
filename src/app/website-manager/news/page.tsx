'use client';

/**
 * NEWS — hospital news & events manager. DataTable + modal (title, category
 * select, excerpt, RichTextEditor content, coverImageUrl FileUploader, author,
 * tags, isFeatured, isPublic, publishedAt date).
 */

import * as React from 'react';
import {
  Newspaper, Type, Tag, CalendarDays, User, Star, ImageIcon, AlignLeft,
  Pencil, Trash2, Plus, ExternalLink, Eye,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { FileUploader } from '@/components/shared/FileUploader';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDate, isoDate, Field, FormSection, ConfirmModal, BoolPill, PageHeading, SkeletonCards, McInput, McTextarea, McSelect, SwitchRow } from '@/app/ops/_lib';

interface Post {
  id: string; slug: string; title: string; excerpt: string; content: string;
  category: string; coverImageUrl: string; author: string; tags: string;
  isFeatured: boolean; isPublic: boolean; publishedAt: string | null; createdAt: string;
}
interface NewsResp { news: Post[]; total: number; page: number; perPage: number; totalPages: number }

const CATEGORIES = ['ANNOUNCEMENTS', 'EVENTS', 'HEALTH_TIPS', 'RESEARCH', 'NEWS'];

const emptyForm = {
  title: '', category: 'ANNOUNCEMENTS', excerpt: '', content: '',
  coverImageUrl: '', author: '', tags: '', isFeatured: false, isPublic: true, publishedAt: '',
};

export default function NewsPage() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Post | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Post | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<NewsResp>(`/api/news?page=${p}&perPage=20`);
      setPosts(res.news || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(1); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, publishedAt: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };
  const openEdit = (p: Post) => {
    setEditing(p);
    setForm({
      title: p.title, category: p.category || 'ANNOUNCEMENTS', excerpt: p.excerpt || '',
      content: p.content || '', coverImageUrl: p.coverImageUrl || '', author: p.author || '',
      tags: p.tags || '', isFeatured: !!p.isFeatured, isPublic: !!p.isPublic,
      publishedAt: isoDate(p.publishedAt),
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(), category: form.category, excerpt: form.excerpt,
        content: form.content, coverImageUrl: form.coverImageUrl, author: form.author,
        tags: form.tags, isFeatured: form.isFeatured, isPublic: form.isPublic,
        publishedAt: form.publishedAt || null,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/news', payload)
        : await apiPost<{ message: string }>('/api/news', payload);
      toast.success(res.message || (editing ? 'News post updated' : 'News post created'));
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save news post');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/news?id=${deleting.id}`);
      toast.success(res.message || 'News post deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Post>[] = [
    { key: 'title', header: 'Title', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {r.title}
        {r.isFeatured && <span className="ml-1 text-amber-500">★</span>}
        <span className="text-muted-foreground font-normal text-xs"> · {r.category.replaceAll('_', ' ')}</span>
      </span>
    ) },
    { key: 'author', header: 'Author', defaultVisible: true },
    { key: 'publishedAt', header: 'Published', defaultVisible: true, render: r => fmtDate(r.publishedAt), csvValue: r => (r.publishedAt ? r.publishedAt.slice(0, 10) : '') },
    { key: 'isPublic', header: 'Status', defaultVisible: true, render: r => <BoolPill value={r.isPublic} trueLabel="Public" falseLabel="Draft" />, csvValue: r => (r.isPublic ? 'PUBLIC' : 'DRAFT') },
    { key: 'category', header: 'Category', csvValue: r => r.category.replaceAll('_', ' ') },
    { key: 'tags', header: 'Tags' },
    { key: 'isFeatured', header: 'Featured', render: r => <BoolPill value={r.isFeatured} />, csvValue: r => (r.isFeatured ? 'YES' : 'NO') },
    { key: 'excerpt', header: 'Excerpt' },
    { key: 'createdAt', header: 'Created', render: r => fmtDate(r.createdAt), csvValue: r => (r.createdAt ? r.createdAt.slice(0, 10) : '') },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View on website', variant: 'view', onClick: r => window.open(`/news/${r.slug}`, '_blank') },
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit post', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete post', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const publicCount = posts.filter(p => p.isPublic).length;
  const featuredCount = posts.filter(p => p.isFeatured).length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Newspaper className="h-5 w-5" />}
        title="News & Events"
        subtitle="Hospital announcements, events, health tips & research — feeds the public news page"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Post</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Posts" value={total} icon={<Newspaper className="h-5 w-5" />} accent="primary" />
          <StatCard label="Published" value={publicCount} icon={<ExternalLink className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Featured" value={featuredCount} icon={<Star className="h-5 w-5" />} accent="warning" hint="this page" />
          <StatCard label="Categories" value={new Set(posts.map(p => p.category)).size} icon={<Tag className="h-5 w-5" />} accent="tertiary" />
        </div>
      )}

      <DataTable
        data={posts} columns={columns} actions={actions}
        rowKey={r => r.id} title="News Posts" moduleLabel="Website News"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="lg"
        title={editing ? `Edit Post — ${editing.title}` : 'New News Post'}
        icon={<Newspaper className="h-5 w-5" />}
        description="Published posts appear on the public news listing & homepage news widgets"
        footerNote="Slug auto-generated; first publish stamps publishedAt"
        submitLabel={editing ? 'Update Post' : 'Create Post'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Basics">
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Title">
              <McInput value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Boyani Health Dispensary launches new service" />
            </Field>
            <Field icon={<Tag className="h-3.5 w-3.5" />} label="Category">
              <McSelect value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))} options={CATEGORIES.map(c => ({ value: c, label: c.replaceAll('_', ' ') }))} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Author">
              <McInput value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="Communications Team" />
            </Field>
            <Field icon={<Tag className="h-3.5 w-3.5" />} label="Tags" hint="comma separated">
              <McInput value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="maternity, launch, nairobi" />
            </Field>
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Excerpt" className="sm:col-span-2">
              <McTextarea value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="Short summary shown in listings" />
            </Field>
          </FormSection>

          <FormSection n={2} title="Content (Rich Text)">
            <Field icon={<Newspaper className="h-3.5 w-3.5" />} label="Article Body" className="sm:col-span-2">
              <RichTextEditor value={form.content} onChange={html => setForm(f => ({ ...f, content: html }))} placeholder="Write the full story…" minHeight={220} />
            </Field>
          </FormSection>

          <FormSection n={3} title="Cover & Publication">
            <Field icon={<ImageIcon className="h-3.5 w-3.5" />} label="Cover Image" className="sm:col-span-2">
              <FileUploader value={form.coverImageUrl} onChange={url => setForm(f => ({ ...f, coverImageUrl: url }))} module="NEWS" label="Upload cover image" />
            </Field>
            <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Publish Date">
              <McInput type="date" value={form.publishedAt} onChange={e => setForm(f => ({ ...f, publishedAt: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-1 gap-2 content-start">
              <SwitchRow label="Featured" hint="pinned to the top / homepage" checked={form.isFeatured} onCheckedChange={c => setForm(f => ({ ...f, isFeatured: c }))} />
              <SwitchRow label="Published (public)" checked={form.isPublic} onCheckedChange={c => setForm(f => ({ ...f, isPublic: c }))} />
            </div>
          </FormSection>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete News Post"
        message={deleting ? `Delete "${deleting.title}"?` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
