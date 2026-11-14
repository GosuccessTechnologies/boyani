'use client';

/**
 * THEME MANAGER — grid of theme preview cards (palette swatches + fonts),
 * active theme highlighted, one-click Apply → reload to re-inject CSS vars.
 * Full editing (incl. Google Font typography), duplicate and reset-to-preset.
 */

import * as React from 'react';
import {
  Palette, Check, Plus, Trash2, Paintbrush, Type, Layers, Building2, AlignLeft, Sparkles,
  RotateCcw, Copy, Pencil,
} from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, ConfirmModal, BoolPill, PageHeading, SkeletonCards, McInput } from '../_lib';
import { GOOGLE_FONTS } from '@/lib/google-fonts';

interface Theme {
  id: number; name: string; description: string | null; isPreset: boolean;
  primary: string; secondary: string; tertiary: string;
  fontBody: string; fontHeading: string; headingFormat: string;
  bgBody: string; bgCard: string; bgSidebar: string; bgHeader: string; bgFooter: string;
  bgCardHeader: string; textPrimary: string; textSecondary: string; textMuted: string;
  dividerColor: string; scrollbarColor: string; scrollbarTrack: string;
  bodyFormat: string; cardRadius: string; sidebarStyle: string; customCss?: string | null;
}

const SWATCHES: Array<{ key: keyof Theme; label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'tertiary', label: 'Tertiary' },
  { key: 'bgSidebar', label: 'Sidebar' },
  { key: 'bgFooter', label: 'Footer' },
];

const EDITABLE_FIELDS: Array<{ key: keyof Theme; label: string; icon: React.ReactNode }> = [
  { key: 'primary', label: 'Primary', icon: <Paintbrush className="h-3.5 w-3.5" /> },
  { key: 'secondary', label: 'Secondary', icon: <Paintbrush className="h-3.5 w-3.5" /> },
  { key: 'tertiary', label: 'Tertiary', icon: <Paintbrush className="h-3.5 w-3.5" /> },
  { key: 'bgBody', label: 'Body BG', icon: <AlignLeft className="h-3.5 w-3.5" /> },
  { key: 'bgCard', label: 'Card BG', icon: <AlignLeft className="h-3.5 w-3.5" /> },
  { key: 'bgSidebar', label: 'Sidebar BG', icon: <Building2 className="h-3.5 w-3.5" /> },
  { key: 'bgHeader', label: 'Header BG', icon: <Building2 className="h-3.5 w-3.5" /> },
  { key: 'bgFooter', label: 'Footer BG', icon: <Layers className="h-3.5 w-3.5" /> },
  { key: 'bgCardHeader', label: 'Card Header BG', icon: <Layers className="h-3.5 w-3.5" /> },
  { key: 'textPrimary', label: 'Text Primary', icon: <Type className="h-3.5 w-3.5" /> },
  { key: 'textSecondary', label: 'Text Secondary', icon: <Type className="h-3.5 w-3.5" /> },
  { key: 'textMuted', label: 'Text Muted', icon: <Type className="h-3.5 w-3.5" /> },
  { key: 'dividerColor', label: 'Divider', icon: <AlignLeft className="h-3.5 w-3.5" /> },
  { key: 'scrollbarColor', label: 'Scrollbar', icon: <AlignLeft className="h-3.5 w-3.5" /> },
  { key: 'scrollbarTrack', label: 'Scrollbar Track', icon: <AlignLeft className="h-3.5 w-3.5" /> },
];

function FontSelect({ value, onChange, preview }: { value: string; onChange: (v: string) => void; preview: string }) {
  return (
    <select
      className="mc-input h-10 w-full rounded-lg text-sm"
      style={{ fontFamily: value ? `"${value}", system-ui` : undefined }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">System default</option>
      {GOOGLE_FONTS.map(f => (
        <option key={`${f.family}-${f.category}`} value={f.family} style={{ fontFamily: `"${f.family}"` }}>
          {f.family} ({f.category}) {f.family === preview ? '· current' : ''}
        </option>
      ))}
    </select>
  );
}

export default function ThemesPage() {
  const [themes, setThemes] = React.useState<Theme[]>([]);
  const [activeThemeId, setActiveThemeId] = React.useState<number>(1);
  const [loading, setLoading] = React.useState(true);
  const [applying, setApplying] = React.useState<number | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const [editing, setEditing] = React.useState<Theme | null>(null);
  const [editDraft, setEditDraft] = React.useState<Partial<Theme>>({});
  const [editOpen, setEditOpen] = React.useState(false);
  const [savingEdit, setSavingEdit] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Theme | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [resetConfirm, setResetConfirm] = React.useState(false);
  const [resetBusy, setResetBusy] = React.useState(false);

  const [emptyCustom, setEmptyCustom] = React.useState({
    name: '', description: '',
    primary: '#0d9488', secondary: '#f59e0b', tertiary: '#0891b2',
    bgBody: '#ffffff', bgCard: '#f8fafc', bgSidebar: '#0f172a', bgHeader: '#ffffff', bgFooter: '#0f172a',
    bgCardHeader: '#134e4a', textPrimary: '#0f172a', textSecondary: '#475569',
    textMuted: '#94a3b8', dividerColor: '#e2e8f0', fontBody: 'Inter', fontHeading: 'Inter',
  });
  const [custom, setCustom] = React.useState(emptyCustom);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ themes: Theme[]; activeThemeId: number }>('/api/themes');
      setThemes(res.themes || []);
      setActiveThemeId(res.activeThemeId || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const applyTheme = async (t: Theme) => {
    setApplying(t.id);
    try {
      const res = await apiPut<{ message: string }>('/api/themes', { action: 'apply', themeId: t.id });
      toast.success(res.message || `Theme "${t.name}" applied — reloading…`);
      setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to apply theme');
      setApplying(null);
    }
  };

  const createCustom = async () => {
    if (!custom.name.trim()) { toast.error('Theme name is required'); return; }
    setCreating(true);
    try {
      const res = await apiPost<{ message: string }>('/api/themes', { ...custom, name: custom.name.trim() });
      toast.success(res.message || 'Custom theme created');
      setCreateOpen(false);
      setCustom(emptyCustom);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create theme');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (t: Theme) => {
    setEditing(t);
    setEditDraft({ ...t });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const { id, isPreset, ...fields } = editDraft as Theme & Record<string, unknown>;
      const payload: Record<string, unknown> = { id: editing.id };
      for (const k of ['name', 'description', 'fontBody', 'fontHeading', 'headingFormat', 'bodyFormat', 'cardRadius', 'sidebarStyle', 'customCss']) {
        if (fields[k] !== undefined) payload[k] = fields[k];
      }
      for (const k of ['primary', 'secondary', 'tertiary', 'bgBody', 'bgCard', 'bgSidebar', 'bgHeader', 'bgFooter', 'bgCardHeader', 'textPrimary', 'textSecondary', 'textMuted', 'dividerColor', 'scrollbarColor', 'scrollbarTrack']) {
        if (fields[k] !== undefined) payload[k] = fields[k];
      }
      const res = await apiPut<{ message: string }>('/api/themes', payload);
      toast.success(res.message || 'Theme updated');
      setEditOpen(false);
      setEditing(null);
      const isActive = editing.id === activeThemeId;
      if (isActive) {
        toast.info('Active theme edited — reloading to apply…');
        setTimeout(() => window.location.reload(), 900);
      } else {
        load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update theme');
    } finally {
      setSavingEdit(false);
    }
  };

  const duplicateTheme = async (t: Theme) => {
    try {
      const res = await apiPut<{ message: string }>('/api/themes', { action: 'duplicate', themeId: t.id });
      toast.success(res.message || 'Theme duplicated');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to duplicate');
    }
  };

  const resetTheme = async () => {
    if (!editing) return;
    setResetBusy(true);
    try {
      const res = await apiPut<{ message: string }>('/api/themes', { action: 'reset', themeId: editing.id });
      toast.success(res.message || 'Theme reset');
      setResetConfirm(false);
      setEditOpen(false);
      setEditing(null);
      const isActive = editing.id === activeThemeId;
      if (isActive) {
        toast.info('Reloading to apply reset theme…');
        setTimeout(() => window.location.reload(), 900);
      } else {
        load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset');
    } finally {
      setResetBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/themes?id=${deleting.id}`);
      toast.success(res.message || 'Theme deleted');
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
        icon={<Palette className="h-5 w-5" />}
        title="Theme Manager"
        subtitle="Switch the entire system theme — dashboards and the public website follow instantly"
        actions={<Button size="sm" className="gap-1" onClick={() => { setCustom(emptyCustom); setCreateOpen(true); }}><Plus className="h-4 w-4" /> Custom Theme</Button>}
      />

      {loading ? <SkeletonCards count={3} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Themes Available" value={themes.length} icon={<Palette className="h-5 w-5" />} accent="primary" />
          <StatCard label="Presets" value={themes.filter(t => t.isPreset).length} icon={<Sparkles className="h-5 w-5" />} accent="secondary" />
          <StatCard label="Custom" value={themes.filter(t => !t.isPreset).length} icon={<Paintbrush className="h-5 w-5" />} accent="tertiary" />
          <StatCard label="Google Fonts" value={GOOGLE_FONTS.length} icon={<Type className="h-5 w-5" />} accent="warning" hint="selectable typography" />
        </div>
      )}

      {/* Theme cards grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {themes.map(t => {
            const active = t.id === activeThemeId;
            return (
              <div
                key={t.id}
                className={`rounded-xl border-2 bg-white p-4 transition-all ${active ? 'border-[var(--mc-primary)] shadow-lg' : 'border-[var(--mc-divider)] hover:border-[var(--mc-tertiary)] hover:shadow-md'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-[var(--mc-text-primary)] flex items-center gap-1.5 truncate">
                      {active && <span className="h-5 w-5 rounded-full bg-[var(--mc-primary)] text-white flex items-center justify-center shrink-0"><Check className="h-3 w-3" /></span>}
                      {t.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{t.description || 'No description'}</p>
                  </div>
                  <BoolPill value={t.isPreset} trueLabel="Preset" falseLabel="Custom" />
                </div>

                {/* Mini palette swatches */}
                <div className="flex gap-1.5 mb-2">
                  {SWATCHES.map(sw => (
                    <div key={sw.key} className="flex-1 group/swatch">
                      <div
                        className="h-9 rounded-lg border border-[var(--mc-divider)]"
                        style={{ background: String(t[sw.key]) }}
                        title={`${sw.label}: ${String(t[sw.key])}`}
                      />
                      <p className="text-[9px] text-center text-muted-foreground mt-0.5 truncate">{sw.label}</p>
                    </div>
                  ))}
                </div>

                {/* Preview strip: sidebar + card + text */}
                <div className="flex rounded-lg overflow-hidden border border-[var(--mc-divider)] h-12 mb-3">
                  <div className="w-1/4" style={{ background: t.bgSidebar }} />
                  <div className="flex-1 flex flex-col justify-center px-2" style={{ background: t.bgBody }}>
                    <span className="text-[10px] font-bold" style={{ color: t.textPrimary, fontFamily: `"${t.fontHeading}", system-ui` }}>Heading font</span>
                    <span className="text-[9px]" style={{ color: t.textSecondary, fontFamily: `"${t.fontBody}", system-ui` }}>Body font</span>
                    <div className="flex gap-1 mt-0.5">
                      <span className="h-1.5 w-6 rounded-full" style={{ background: t.primary }} />
                      <span className="h-1.5 w-4 rounded-full" style={{ background: t.secondary }} />
                      <span className="h-1.5 w-3 rounded-full" style={{ background: t.tertiary }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground truncate">
                    {t.fontHeading} / {t.fontBody} · {t.bodyFormat}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" title="Edit theme" className="mc-action-btn mc-action-view" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" title="Duplicate as custom copy" className="mc-action-btn mc-action-print" onClick={() => duplicateTheme(t)}>
                      <Copy className="h-4 w-4" />
                    </button>
                    {!t.isPreset && !active && (
                      <button type="button" title="Delete custom theme" className="mc-action-btn mc-action-delete" onClick={() => { setDeleting(t); setConfirmOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {active ? (
                      <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled>
                        <Check className="h-3.5 w-3.5" /> Active
                      </Button>
                    ) : (
                      <Button
                        size="sm" className="h-8 gap-1 text-xs"
                        onClick={() => applyTheme(t)} disabled={applying !== null}
                      >
                        {applying === t.id ? 'Applying…' : <><Paintbrush className="h-3.5 w-3.5" /> Apply</>}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom theme create modal */}
      <PremiumModal
        open={createOpen} onOpenChange={setCreateOpen} size="lg"
        title="Create Custom Theme"
        icon={<Paintbrush className="h-5 w-5" />}
        description="Name your theme, choose Google Fonts and pick its core colours"
        footerNote="Custom themes can be applied, edited and deleted like presets"
        submitLabel="Create Theme" onSubmit={createCustom} submitting={creating} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Identity & Typography">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Theme Name">
              <McInput value={custom.name} onChange={e => setCustom(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Lakeside Breeze" />
            </Field>
            <Field icon={<Sparkles className="h-3.5 w-3.5" />} label="Description">
              <McInput value={custom.description} onChange={e => setCustom(c => ({ ...c, description: e.target.value }))} placeholder="What inspired this palette" />
            </Field>
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Heading Font (Google Fonts)">
              <FontSelect value={custom.fontHeading} onChange={v => setCustom(c => ({ ...c, fontHeading: v }))} preview="Inter" />
            </Field>
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Body Font (Google Fonts)">
              <FontSelect value={custom.fontBody} onChange={v => setCustom(c => ({ ...c, fontBody: v }))} preview="Inter" />
            </Field>
          </FormSection>

          <FormSection n={2} title="Colours">
            {EDITABLE_FIELDS.filter(f => !['scrollbarColor', 'scrollbarTrack'].includes(f.key)).map(f => (
              <Field key={f.key} icon={f.icon} label={f.label}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={String(custom[f.key as keyof typeof custom])}
                    onChange={e => setCustom(c => ({ ...c, [f.key]: e.target.value }))}
                    className="h-9 w-12 rounded-lg border border-[var(--mc-divider)] bg-white cursor-pointer p-1"
                  />
                  <McInput
                    value={String(custom[f.key as keyof typeof custom])}
                    onChange={e => setCustom(c => ({ ...c, [f.key]: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </Field>
            ))}
          </FormSection>
        </div>
      </PremiumModal>

      {/* Edit theme modal */}
      <PremiumModal
        open={editOpen} onOpenChange={setEditOpen} size="lg"
        title={`Edit Theme — ${editing?.name || ''}`}
        icon={<Pencil className="h-5 w-5" />}
        description="Adjust typography and colours. If this theme is active, changes apply after save."
        footerNote="Use Reset to restore the original preset values"
        submitLabel="Save Changes" onSubmit={saveEdit} submitting={savingEdit} secondaryLabel="Cancel"
        extraFooter={
          editing?.isPreset ? (
            <button
              type="button" className="text-xs font-semibold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1"
              onClick={() => setResetConfirm(true)}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset to initial settings
            </button>
          ) : null
        }
      >
        <div className="space-y-5">
          <FormSection n={1} title="Identity & Typography">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Theme Name">
              <McInput value={String(editDraft.name || '')} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} />
            </Field>
            <Field icon={<Sparkles className="h-3.5 w-3.5" />} label="Description">
              <McInput value={String(editDraft.description || '')} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))} />
            </Field>
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Heading Font (Google Fonts)">
              <FontSelect value={String(editDraft.fontHeading || '')} onChange={v => setEditDraft(d => ({ ...d, fontHeading: v }))} preview={String(editDraft.fontHeading || '')} />
            </Field>
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Body Font (Google Fonts)">
              <FontSelect value={String(editDraft.fontBody || '')} onChange={v => setEditDraft(d => ({ ...d, fontBody: v }))} preview={String(editDraft.fontBody || '')} />
            </Field>
            <Field icon={<Layers className="h-3.5 w-3.5" />} label="Body Format">
              <select className="mc-input h-10 w-full rounded-lg text-sm" value={String(editDraft.bodyFormat || 'full-width')} onChange={e => setEditDraft(d => ({ ...d, bodyFormat: e.target.value }))}>
                <option value="full-width">Full-width</option>
                <option value="boxed">Boxed</option>
              </select>
            </Field>
            <Field icon={<Layers className="h-3.5 w-3.5" />} label="Card Radius">
              <select className="mc-input h-10 w-full rounded-lg text-sm" value={String(editDraft.cardRadius || 'rounded-xl')} onChange={e => setEditDraft(d => ({ ...d, cardRadius: e.target.value }))}>
                <option value="rounded-xl">Rounded (xl)</option>
                <option value="rounded-lg">Rounded (lg)</option>
                <option value="rounded-2xl">Rounded (2xl)</option>
                <option value="rounded-md">Rounded (md)</option>
                <option value="0.25rem">Subtle</option>
              </select>
            </Field>
          </FormSection>

          <FormSection n={2} title="Colours">
            {EDITABLE_FIELDS.map(f => (
              <Field key={f.key} icon={f.icon} label={f.label}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={String(editDraft[f.key] || '#ffffff')}
                    onChange={e => setEditDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    className="h-9 w-12 rounded-lg border border-[var(--mc-divider)] bg-white cursor-pointer p-1"
                  />
                  <McInput
                    value={String(editDraft[f.key] || '')}
                    onChange={e => setEditDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </Field>
            ))}
          </FormSection>

          <FormSection n={3} title="Custom CSS (optional)">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Custom CSS">
              <textarea
                className="mc-input w-full rounded-lg p-3 text-xs font-mono min-h-[110px]"
                placeholder=".my-class { color: red; }"
                value={String(editDraft.customCss || '')}
                onChange={e => setEditDraft(d => ({ ...d, customCss: e.target.value }))}
              />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Theme"
        message={deleting ? `Delete custom theme "${deleting.name}"? The active theme cannot be deleted.` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />

      <ConfirmModal
        open={resetConfirm} onOpenChange={setResetConfirm}
        title="Reset Theme"
        message={editing ? `Reset "${editing.name}" to its original preset colours and fonts? Your edits to this theme will be lost.` : ''}
        onConfirm={resetTheme} submitting={resetBusy}
      />
    </div>
  );
}
