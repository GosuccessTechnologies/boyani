'use client';

/**
 * SLIDERS — hero slide manager. Sortable-ish list (displayOrder up/down →
 * PUT), card per slide with image thumb, animation designId (1-14), CTAs,
 * isActive switch, autoRotate & delay. Modal with FileUploader.
 */

import * as React from 'react';
import {
  Images, Type, AlignLeft, ImageIcon, Palette, Droplets, MousePointerClick, Link2,
  Sparkles, ArrowUpDown, RotateCw, Clock3, Pencil, Trash2, Plus, ChevronUp, ChevronDown, Play,
} from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { FileUploader } from '@/components/shared/FileUploader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, ConfirmModal, BoolPill, PageHeading, McInput, McSelect } from '@/app/ops/_lib';

interface Slider {
  id: string; title: string; subtitle: string | null; description: string | null;
  imageUrl: string | null; videoUrl: string | null; backgroundUrl: string | null;
  overlayColor: string | null; overlayOpacity: number | null;
  ctaPrimaryText: string | null; ctaPrimaryUrl: string | null;
  ctaSecondaryText: string | null; ctaSecondaryUrl: string | null;
  designId: number; displayOrder: number; isActive: boolean;
  autoRotate: boolean; rotateDelayMs: number;
}

const ANIMATION_DESIGNS = [
  { value: '1', label: '1 — Fade' },
  { value: '2', label: '2 — Slide' },
  { value: '3', label: '3 — Zoom Ken Burns' },
  { value: '4', label: '4 — Vertical' },
  { value: '5', label: '5 — Split Text' },
  { value: '6', label: '6 — Clip Reveal' },
  { value: '7', label: '7 — Parallax' },
  { value: '8', label: '8 — Typewriter' },
  { value: '9', label: '9 — Flip' },
  { value: '10', label: '10 — Blur' },
  { value: '11', label: '11 — Cube' },
  { value: '12', label: '12 — Carousel Cards' },
  { value: '13', label: '13 — Split Slide (premium)' },
  { value: '14', label: '14 — Top Caption (premium)' },
];

const emptyForm = {
  title: '', subtitle: '', description: '', imageUrl: '', overlayColor: '', overlayOpacity: '0.4',
  ctaPrimaryText: '', ctaPrimaryUrl: '', ctaSecondaryText: '', ctaSecondaryUrl: '',
  designId: '1', displayOrder: '0', isActive: true, autoRotate: true, rotateDelayMs: '6000',
};

export default function SlidersPage() {
  const [sliders, setSliders] = React.useState<Slider[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Slider | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);
  const [busyId, setBusyId] = React.useState('');

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Slider | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ sliders: Slider[] }>('/api/sliders');
      const list = [...(res.sliders || [])].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      setSliders(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load sliders');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, displayOrder: String(sliders.length) });
    setModalOpen(true);
  };
  const openEdit = (s: Slider) => {
    setEditing(s);
    setForm({
      title: s.title, subtitle: s.subtitle || '', description: s.description || '',
      imageUrl: s.imageUrl || '', overlayColor: s.overlayColor || '',
      overlayOpacity: s.overlayOpacity != null ? String(s.overlayOpacity) : '0.4',
      ctaPrimaryText: s.ctaPrimaryText || '', ctaPrimaryUrl: s.ctaPrimaryUrl || '',
      ctaSecondaryText: s.ctaSecondaryText || '', ctaSecondaryUrl: s.ctaSecondaryUrl || '',
      designId: String(s.designId || 1), displayOrder: String(s.displayOrder ?? 0),
      isActive: !!s.isActive, autoRotate: !!s.autoRotate,
      rotateDelayMs: String(s.rotateDelayMs ?? 6000),
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Slide title is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(), subtitle: form.subtitle || null, description: form.description || null,
        imageUrl: form.imageUrl || null, overlayColor: form.overlayColor || null,
        overlayOpacity: form.overlayOpacity === '' ? null : Number(form.overlayOpacity),
        ctaPrimaryText: form.ctaPrimaryText || null, ctaPrimaryUrl: form.ctaPrimaryUrl || null,
        ctaSecondaryText: form.ctaSecondaryText || null, ctaSecondaryUrl: form.ctaSecondaryUrl || null,
        designId: form.designId, displayOrder: form.displayOrder,
        isActive: form.isActive, autoRotate: form.autoRotate, rotateDelayMs: form.rotateDelayMs,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/sliders', payload)
        : await apiPost<{ message: string }>('/api/sliders', payload);
      toast.success(res.message || (editing ? 'Slide updated' : 'Slide created'));
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save slide');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/sliders?id=${deleting.id}`);
      toast.success(res.message || 'Slide deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  // ── Reorder: swap displayOrder with neighbour then PUT both ──
  const move = async (s: Slider, dir: -1 | 1) => {
    const idx = sliders.findIndex(x => x.id === s.id);
    const other = sliders[idx + dir];
    if (!other) return;
    setBusyId(s.id);
    try {
      await apiPut('/api/sliders', { id: s.id, displayOrder: other.displayOrder });
      await apiPut('/api/sliders', { id: other.id, displayOrder: s.displayOrder });
      toast.success('Order updated');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reorder');
    } finally {
      setBusyId('');
    }
  };

  const toggleActive = async (s: Slider) => {
    setBusyId(s.id);
    try {
      await apiPut('/api/sliders', { id: s.id, isActive: !s.isActive });
      toast.success(s.isActive ? 'Slide hidden' : 'Slide activated');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to toggle');
    } finally {
      setBusyId('');
    }
  };

  const activeCount = sliders.filter(s => s.isActive).length;
  const withCta = sliders.filter(s => s.ctaPrimaryText || s.ctaSecondaryText).length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Images className="h-5 w-5" />}
        title="Hero Sliders"
        subtitle="Homepage hero slides — 14 animation designs, CTAs & overlays"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Slide</Button>}
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Slides" value={sliders.length} icon={<Images className="h-5 w-5" />} accent="primary" />
            <StatCard label="Active" value={activeCount} icon={<Play className="h-5 w-5" />} accent="success" />
            <StatCard label="With CTAs" value={withCta} icon={<MousePointerClick className="h-5 w-5" />} accent="secondary" />
            <StatCard label="Animations" value={new Set(sliders.map(s => s.designId)).size} icon={<Sparkles className="h-5 w-5" />} accent="tertiary" hint="distinct designs" />
          </div>

          {sliders.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No slides yet — create your first hero slide.</p>
          )}

          <div className="space-y-3">
            {sliders.map((s, i) => (
              <div key={s.id} className={`rounded-xl border bg-white p-4 flex flex-col md:flex-row gap-4 ${s.isActive ? '' : 'opacity-70'}`}>
                {/* Thumb */}
                <div className="w-full md:w-56 h-32 rounded-lg overflow-hidden bg-slate-100 shrink-0 relative">
                  {s.imageUrl ? (
                     
                    <img src={s.imageUrl} alt={s.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon className="h-8 w-8" /></div>
                  )}
                  {s.overlayColor && (
                    <div className="absolute inset-0" style={{ background: s.overlayColor, opacity: s.overlayOpacity ?? 0.4 }} />
                  )}
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">#{s.displayOrder} · Animation {s.designId}</span>
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-[var(--mc-text-primary)] truncate">{s.title}</h3>
                    <BoolPill value={s.isActive} trueLabel="Live" falseLabel="Hidden" />
                    {s.autoRotate && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><RotateCw className="h-3 w-3" /> {(s.rotateDelayMs / 1000).toFixed(1)}s</span>}
                  </div>
                  {s.subtitle && <p className="text-xs font-medium text-[var(--mc-text-secondary)] truncate">{s.subtitle}</p>}
                  {s.description && <p className="text-[11px] text-muted-foreground line-clamp-2">{s.description}</p>}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {s.ctaPrimaryText && <span className="px-2 py-0.5 rounded-full bg-[var(--mc-primary)] text-white text-[10px] font-bold">{s.ctaPrimaryText}</span>}
                    {s.ctaSecondaryText && <span className="px-2 py-0.5 rounded-full border border-[var(--mc-divider)] text-[var(--mc-text-secondary)] text-[10px] font-bold">{s.ctaSecondaryText}</span>}
                    {!s.ctaPrimaryText && !s.ctaSecondaryText && <span className="text-[10px] text-muted-foreground">No CTAs</span>}
                  </div>
                  <div className="flex items-center gap-3 pt-1.5">
                    <label className="flex items-center gap-2 text-xs text-[var(--mc-text-secondary)] cursor-pointer">
                      <Switch checked={s.isActive} onCheckedChange={() => toggleActive(s)} disabled={busyId === s.id} />
                      {s.isActive ? 'Active' : 'Inactive'}
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex md:flex-col items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={i === 0 || busyId === s.id} onClick={() => move(s, -1)} title="Move up"><ChevronUp className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={i === sliders.length - 1 || busyId === s.id} onClick={() => move(s, 1)} title="Move down"><ChevronDown className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => openEdit(s)} title="Edit slide"><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50" onClick={() => { setDeleting(s); setConfirmOpen(true); }} title="Delete slide"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="lg"
        title={editing ? `Edit Slide — ${editing.title}` : 'New Hero Slide'}
        icon={<Images className="h-5 w-5" />}
        description="Slides render through the active slider animation design on the public homepage"
        footerNote="Overlay colour + opacity sit on top of the image behind the text"
        submitLabel={editing ? 'Update Slide' : 'Create Slide'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Content">
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Title">
              <McInput value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Compassionate care, every family" />
            </Field>
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Subtitle">
              <McInput value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="Nairobi's trusted hospital since 1995" />
            </Field>
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Description" className="sm:col-span-2">
              <McInput value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short supporting line rendered under the subtitle" />
            </Field>
          </FormSection>

          <FormSection n={2} title="Image & Overlay">
            <Field icon={<ImageIcon className="h-3.5 w-3.5" />} label="Slide Image" className="sm:col-span-2">
              <FileUploader value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} module="WEBSITE" label="Upload slide image (16:9 recommended)" />
            </Field>
            <Field icon={<Palette className="h-3.5 w-3.5" />} label="Overlay Colour">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-12 rounded-lg border border-[var(--mc-divider)] bg-white cursor-pointer"
                  value={/^#[0-9a-fA-F]{6}$/.test(form.overlayColor) ? form.overlayColor : '#000000'}
                  onChange={e => setForm(f => ({ ...f, overlayColor: e.target.value }))}
                />
                <McInput value={form.overlayColor} onChange={e => setForm(f => ({ ...f, overlayColor: e.target.value }))} placeholder="#0f172a or rgba()" />
              </div>
            </Field>
            <Field icon={<Droplets className="h-3.5 w-3.5" />} label="Overlay Opacity (0 – 1)">
              <McInput type="number" min="0" max="1" step="0.05" value={form.overlayOpacity} onChange={e => setForm(f => ({ ...f, overlayOpacity: e.target.value }))} />
            </Field>
          </FormSection>

          <FormSection n={3} title="Calls To Action">
            <Field icon={<MousePointerClick className="h-3.5 w-3.5" />} label="Primary CTA Text">
              <McInput value={form.ctaPrimaryText} onChange={e => setForm(f => ({ ...f, ctaPrimaryText: e.target.value }))} placeholder="Book Appointment" />
            </Field>
            <Field icon={<Link2 className="h-3.5 w-3.5" />} label="Primary CTA URL">
              <McInput value={form.ctaPrimaryUrl} onChange={e => setForm(f => ({ ...f, ctaPrimaryUrl: e.target.value }))} placeholder="/booking" />
            </Field>
            <Field icon={<MousePointerClick className="h-3.5 w-3.5" />} label="Secondary CTA Text">
              <McInput value={form.ctaSecondaryText} onChange={e => setForm(f => ({ ...f, ctaSecondaryText: e.target.value }))} placeholder="Our Services" />
            </Field>
            <Field icon={<Link2 className="h-3.5 w-3.5" />} label="Secondary CTA URL">
              <McInput value={form.ctaSecondaryUrl} onChange={e => setForm(f => ({ ...f, ctaSecondaryUrl: e.target.value }))} placeholder="/services" />
            </Field>
          </FormSection>

          <FormSection n={4} title="Animation & Behaviour">
            <Field icon={<Sparkles className="h-3.5 w-3.5" />} label="Animation Design (1-12)">
              <McSelect value={form.designId} onValueChange={v => setForm(f => ({ ...f, designId: v }))} options={ANIMATION_DESIGNS} />
            </Field>
            <Field icon={<ArrowUpDown className="h-3.5 w-3.5" />} label="Display Order">
              <McInput type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
            </Field>
            <Field icon={<Clock3 className="h-3.5 w-3.5" />} label="Rotate Delay (ms)">
              <McInput type="number" min="1000" step="500" value={form.rotateDelayMs} onChange={e => setForm(f => ({ ...f, rotateDelayMs: e.target.value }))} />
            </Field>
            <div className="space-y-2">
              <label className="flex items-center gap-3 rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] px-3 py-2.5 cursor-pointer">
                <Switch checked={form.isActive} onCheckedChange={c => setForm(f => ({ ...f, isActive: c }))} />
                <span className="text-sm text-[var(--mc-text-secondary)]">Active (visible on website)</span>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] px-3 py-2.5 cursor-pointer">
                <Switch checked={form.autoRotate} onCheckedChange={c => setForm(f => ({ ...f, autoRotate: c }))} />
                <span className="text-sm text-[var(--mc-text-secondary)]">Auto-rotate</span>
              </label>
            </div>
          </FormSection>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Slide"
        message={deleting ? `Delete slide "${deleting.title}"?` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
