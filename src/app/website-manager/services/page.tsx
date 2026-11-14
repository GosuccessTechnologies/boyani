'use client';

/**
 * WEBSITE MANAGER → SERVICES (Instruction 5)
 * Public-facing website services CMS: tiptap content, featured image,
 * excerpt, department link, display style (cards/pills/table) and
 * sub-services management. Separate from facility /admin/services.
 */

import * as React from 'react';
import {
  BriefcaseMedical, Plus, Pencil, Trash2, Eye, EyeOff, Star, StarOff,
  Layers, Save, ChevronUp, ChevronDown, ListTree, ExternalLink,
} from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, ConfirmModal, BoolPill, PageHeading, SkeletonCards, McInput } from '../../admin/_lib';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { FileUploader } from '@/components/shared/FileUploader';

interface SubService { id: string; title: string; description: string; iconKey: string; displayOrder: number; isActive: boolean }
interface WebsiteService {
  id: string; slug: string; title: string; excerpt: string; content: string;
  featuredImage: string; bannerImage: string; departmentId: string | null;
  iconKey: string; displayStyle: string; displayOrder: number; isFeatured: boolean; isActive: boolean;
  department?: { id: string; name: string; color: string } | null;
  subServices: SubService[];
}
interface Department { id: string; name: string }

const emptyDraft = {
  id: '', slug: '', title: '', excerpt: '', content: '',
  featuredImage: '', bannerImage: '', departmentId: '', iconKey: '',
  displayStyle: 'cards', displayOrder: 0, isFeatured: false, isActive: true,
};

export default function WebsiteServicesPage() {
  const [services, setServices] = React.useState<WebsiteService[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({ ...emptyDraft });
  const [saving, setSaving] = React.useState(false);
  const [isNew, setIsNew] = React.useState(true);

  // Sub-service management inside editor
  const [subs, setSubs] = React.useState<SubService[]>([]);
  const [subDraft, setSubDraft] = React.useState({ title: '', description: '' });
  const [subBusy, setSubBusy] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<WebsiteService | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [svcRes, deptRes] = await Promise.all([
        apiGet<{ services: WebsiteService[] }>('/api/website-services'),
        apiGet<{ departments: Department[] }>('/api/departments?public=1'),
      ]);
      setServices(svcRes.services || []);
      setDepartments(deptRes.departments || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setDraft({ ...emptyDraft, displayOrder: services.length });
    setSubs([]);
    setIsNew(true);
    setEditorOpen(true);
  };

  const openEdit = (s: WebsiteService) => {
    setDraft({
      id: s.id, slug: s.slug, title: s.title, excerpt: s.excerpt, content: s.content,
      featuredImage: s.featuredImage, bannerImage: s.bannerImage,
      departmentId: s.departmentId || '', iconKey: s.iconKey,
      displayStyle: s.displayStyle, displayOrder: s.displayOrder,
      isFeatured: s.isFeatured, isActive: s.isActive,
    });
    setSubs(s.subServices || []);
    setIsNew(false);
    setEditorOpen(true);
  };

  const saveService = async () => {
    if (!draft.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const payload = { ...draft, departmentId: draft.departmentId || null };
      if (isNew) {
        await apiPost('/api/website-services', payload);
        toast.success('Service created');
      } else {
        await apiPut('/api/website-services', payload);
        toast.success('Service updated');
      }
      setEditorOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: WebsiteService) => {
    try {
      await apiPut('/api/website-services', { id: s.id, isActive: !s.isActive });
      setServices(list => list.map(x => x.id === s.id ? { ...x, isActive: !x.isActive } : x));
      toast.success(s.isActive ? 'Service hidden from website' : 'Service published');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const toggleFeatured = async (s: WebsiteService) => {
    try {
      await apiPut('/api/website-services', { id: s.id, isFeatured: !s.isFeatured });
      setServices(list => list.map(x => x.id === s.id ? { ...x, isFeatured: !x.isFeatured } : x));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const moveOrder = async (s: WebsiteService, dir: -1 | 1) => {
    const idx = services.findIndex(x => x.id === s.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= services.length) return;
    const next = [...services];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setServices(next);
    try {
      await Promise.all(next.map((x, i) => apiPut('/api/website-services', { id: x.id, displayOrder: i })));
    } catch { load(); }
  };

  const addSub = async () => {
    if (!subDraft.title.trim()) { toast.error('Sub-service title required'); return; }
    setSubBusy(true);
    try {
      if (isNew) {
        // Not yet persisted — keep locally, saved with the parent
        setSubs(list => [...list, {
          id: `local-${Date.now()}`, title: subDraft.title, description: subDraft.description,
          iconKey: '', displayOrder: list.length, isActive: true,
        }]);
      } else {
        const res = await apiPut<{ sub: SubService }>('/api/website-services', {
          action: 'add-sub', serviceId: draft.id, sub: { ...subDraft, displayOrder: subs.length },
        });
        setSubs(list => [...list, res.sub]);
      }
      setSubDraft({ title: '', description: '' });
      toast.success('Sub-service added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setSubBusy(false);
    }
  };

  const removeSub = async (sub: SubService) => {
    try {
      if (!sub.id.startsWith('local-')) {
        await apiPut('/api/website-services', { action: 'delete-sub', subId: sub.id });
      }
      setSubs(list => list.filter(x => x.id !== sub.id));
      toast.success('Sub-service removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove');
    }
  };

  const saveServiceWithSubs = async () => {
    if (!draft.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        departmentId: draft.departmentId || null,
        subServices: isNew ? subs.filter(s => s.id.startsWith('local-')).map(s => ({ title: s.title, description: s.description })) : undefined,
      };
      if (isNew) {
        await apiPost('/api/website-services', payload);
        toast.success('Service created');
      } else {
        await apiPut('/api/website-services', payload);
        toast.success('Service updated');
      }
      setEditorOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiDelete(`/api/website-services?id=${deleting.id}`);
      toast.success('Service deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<BriefcaseMedical className="h-5 w-5" />}
        title="Website Services"
        subtitle="Public-facing services for the website — separate from facility pricing; rich content with sub-services"
        actions={
          <div className="flex gap-2">
            <a href="/services" target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="gap-1"><ExternalLink className="h-4 w-4" /> View Public Page</Button>
            </a>
            <Button size="sm" className="gap-1" onClick={openNew}><Plus className="h-4 w-4" /> New Service</Button>
          </div>
        }
      />

      {loading ? <SkeletonCards count={3} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Services" value={services.length} icon={<BriefcaseMedical className="h-5 w-5" />} accent="primary" />
          <StatCard label="Published" value={services.filter(s => s.isActive).length} icon={<Eye className="h-5 w-5" />} accent="success" />
          <StatCard label="Featured" value={services.filter(s => s.isFeatured).length} icon={<Star className="h-5 w-5" />} accent="warning" />
          <StatCard label="Sub-services" value={services.reduce((a, s) => a + (s.subServices?.length || 0), 0)} icon={<ListTree className="h-5 w-5" />} accent="tertiary" />
        </div>
      )}

      {/* Services list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((s, i) => (
            <div key={s.id} className="rounded-xl border border-[var(--mc-divider)] bg-white p-4 shadow-sm flex items-center gap-4">
              {/* Order controls */}
              <div className="flex flex-col gap-1 shrink-0">
                <button disabled={i === 0} onClick={() => moveOrder(s, -1)} className="p-1 rounded text-muted-foreground hover:text-[var(--mc-primary)] disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <span className="text-[10px] font-bold text-center text-muted-foreground">{i + 1}</span>
                <button disabled={i === services.length - 1} onClick={() => moveOrder(s, 1)} className="p-1 rounded text-muted-foreground hover:text-[var(--mc-primary)] disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              </div>

              {/* Featured image thumb */}
              <div className="h-16 w-24 rounded-lg overflow-hidden bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] shrink-0 flex items-center justify-center">
                {s.featuredImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.featuredImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <BriefcaseMedical className="h-6 w-6 text-[var(--mc-text-muted)]" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-[var(--mc-text-primary)] truncate">{s.title}</h3>
                  {s.isFeatured && <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Featured</span>}
                  <BoolPill value={s.isActive} trueLabel="Published" falseLabel="Hidden" />
                  <span className="text-[10px] text-muted-foreground">/{s.slug}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{s.excerpt || 'No excerpt yet'}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> {s.subServices?.length || 0} sub-services</span>
                  <span>Style: <b className="capitalize">{s.displayStyle}</b></span>
                  {s.department?.name && <span>Dept: <b>{s.department.name}</b></span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" title={s.isFeatured ? 'Unfeature' : 'Feature on homepage'} className="mc-action-btn mc-action-print" onClick={() => toggleFeatured(s)}>
                  {s.isFeatured ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                </button>
                <button type="button" title={s.isActive ? 'Hide from website' : 'Publish'} className="mc-action-btn mc-action-view" onClick={() => toggleActive(s)}>
                  {s.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button type="button" title="Edit service" className="mc-action-btn mc-action-edit" onClick={() => openEdit(s)}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" title="Delete service" className="mc-action-btn mc-action-delete" onClick={() => { setDeleting(s); setConfirmOpen(true); }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {!services.length && (
            <div className="text-center py-16 border-2 border-dashed border-[var(--mc-divider)] rounded-xl">
              <BriefcaseMedical className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-semibold">No website services yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create the services shown to patients on the public website.</p>
              <Button size="sm" className="gap-1 mt-4" onClick={openNew}><Plus className="h-4 w-4" /> New Service</Button>
            </div>
          )}
        </div>
      )}

      {/* Service editor modal */}
      <PremiumModal
        open={editorOpen} onOpenChange={setEditorOpen} size="xl"
        title={isNew ? 'New Website Service' : `Edit — ${draft.title}`}
        icon={<BriefcaseMedical className="h-5 w-5" />}
        description="Rich content with tiptap, featured image, excerpt and sub-services — no pricing is shown publicly"
        footerNote="Sub-services can be listed as cards, pills or a table on the public page"
        submitLabel={isNew ? 'Create Service' : 'Save Changes'} onSubmit={saveServiceWithSubs} submitting={saving} secondaryLabel="Cancel"
        submitIcon={<Save className="h-4 w-4" />}
      >
        <div className="space-y-6">
          <FormSection n={1} title="Basics & Listing">
            <div className="grid md:grid-cols-2 gap-3">
              <Field icon={<Pencil className="h-3.5 w-3.5" />} label="Title">
                <McInput value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Maternal & Child Health" />
              </Field>
              <Field icon={<Layers className="h-3.5 w-3.5" />} label="Slug (URL)">
                <McInput value={draft.slug} onChange={e => setDraft(d => ({ ...d, slug: e.target.value }))} placeholder="auto-generated from title" disabled={!isNew} />
              </Field>
              <Field icon={<Layers className="h-3.5 w-3.5" />} label="Clinical Department (optional grouping)">
                <select className="mc-input h-10 w-full rounded-lg text-sm" value={draft.departmentId} onChange={e => setDraft(d => ({ ...d, departmentId: e.target.value }))}>
                  <option value="">— None —</option>
                  {departments.map(dep => <option key={dep.id} value={dep.id}>{dep.name}</option>)}
                </select>
              </Field>
              <Field icon={<ListTree className="h-3.5 w-3.5" />} label="Sub-service listing style (public page)">
                <select className="mc-input h-10 w-full rounded-lg text-sm" value={draft.displayStyle} onChange={e => setDraft(d => ({ ...d, displayStyle: e.target.value }))}>
                  <option value="cards">Cards</option>
                  <option value="pills">Pills</option>
                  <option value="table">Table</option>
                </select>
              </Field>
            </div>
            <Field icon={<Eye className="h-3.5 w-3.5" />} label="Excerpt (homepage & listings)">
              <textarea
                className="mc-input w-full rounded-lg p-3 text-sm min-h-[70px]"
                placeholder="One or two sentences representing this service before users click to read more…"
                value={draft.excerpt}
                onChange={e => setDraft(d => ({ ...d, excerpt: e.target.value }))}
              />
            </Field>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                <input type="checkbox" checked={draft.isFeatured} onChange={e => setDraft(d => ({ ...d, isFeatured: e.target.checked }))} className="h-4 w-4 accent-[var(--mc-primary)]" />
                Feature this service on the homepage
              </label>
              <label className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                <input type="checkbox" checked={draft.isActive} onChange={e => setDraft(d => ({ ...d, isActive: e.target.checked }))} className="h-4 w-4 accent-[var(--mc-primary)]" />
                Published (visible on website)
              </label>
            </div>
          </FormSection>

          <FormSection n={2} title="Featured Image & Banner">
            <div className="grid md:grid-cols-2 gap-4">
              <Field icon={<Star className="h-3.5 w-3.5" />} label="Featured Image">
                <FileUploader value={draft.featuredImage} onChange={url => setDraft(d => ({ ...d, featuredImage: url }))} module="WEBSITE" accept="image/*" />
              </Field>
              <Field icon={<Layers className="h-3.5 w-3.5" />} label="Detail Banner Image (optional)">
                <FileUploader value={draft.bannerImage} onChange={url => setDraft(d => ({ ...d, bannerImage: url }))} module="WEBSITE" accept="image/*" />
              </Field>
            </div>
          </FormSection>

          <FormSection n={3} title="Full Content (rich text — images, tables, word import)">
            <RichTextEditor
              value={draft.content}
              onChange={html => setDraft(d => ({ ...d, content: html }))}
              placeholder="Write the full service description in paragraphs. Insert images, tables, links…"
              minHeight={280}
            />
          </FormSection>

          <FormSection n={4} title={`Sub-services (${subs.length})`}>
            <div className="space-y-2">
              {subs.map(sub => (
                <div key={sub.id} className="flex items-start gap-3 rounded-lg border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)]">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-[var(--mc-text-primary)]">{sub.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{sub.description || 'No description'}</p>
                  </div>
                  <button type="button" className="mc-action-btn mc-action-delete shrink-0" onClick={() => removeSub(sub)} title="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {!subs.length && <p className="text-xs text-muted-foreground">No sub-services yet — add the treatments/procedures listed under this service.</p>}
            </div>
            <div className="flex flex-col md:flex-row gap-2 pt-1">
              <McInput value={subDraft.title} onChange={e => setSubDraft(s => ({ ...s, title: e.target.value }))} placeholder="Sub-service title e.g. Antenatal Clinic" className="md:w-1/3" />
              <McInput value={subDraft.description} onChange={e => setSubDraft(s => ({ ...s, description: e.target.value }))} placeholder="Short description" className="flex-1" />
              <Button type="button" size="sm" className="gap-1 h-10 shrink-0" onClick={addSub} disabled={subBusy}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </FormSection>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Service"
        message={deleting ? `Delete "${deleting.title}" and all its sub-services? This cannot be undone.` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
