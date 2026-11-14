'use client';

/**
 * HOMEPAGE DESIGNS — the 18 switchable designs. Grid of design cards
 * (designKey, name, description, widget chips, active badge) with
 * Activate action (POST /api/homepage-designs {action:'activate', designKey}),
 * preview link (/?design=N) and a widget manager modal (PUT {widgetId, …}).
 */

import * as React from 'react';
import {
  Home, Layers, Zap, Eye, Pencil, CheckCircle2, ExternalLink, Sparkles, Hash, Type, ArrowUpDown, ToggleRight, Loader2,
} from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, PageHeading, McInput, McSelect } from '@/app/ops/_lib';

interface Widget {
  id: string; designId: string; moduleKey: string; variantId: number;
  sectionTitle: string | null; sectionSubtitle: string | null;
  displayOrder: number; isActive: boolean; widthColumns: number;
  backgroundColor: string | null; customConfig: string | null;
}
interface Design {
  id: string; name: string; description: string; designKey: number;
  isActive: boolean; previewUrl: string; widgets: Widget[];
}
interface DesignsResp { designs: Design[]; activeDesign: number }

export default function HomepageDesignsPage() {
  const [designs, setDesigns] = React.useState<Design[]>([]);
  const [activeDesign, setActiveDesign] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [activating, setActivating] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);

  const [managing, setManaging] = React.useState<Design | null>(null);
  const [editingWidget, setEditingWidget] = React.useState<Widget | null>(null);
  const [wForm, setWForm] = React.useState({ moduleKey: '', variantId: '1', sectionTitle: '', sectionSubtitle: '', displayOrder: '0', isActive: true });
  const [savingWidget, setSavingWidget] = React.useState(false);

  const load = React.useCallback(async (): Promise<Design[]> => {
    setLoading(true);
    try {
      const res = await apiGet<DesignsResp>('/api/homepage-designs');
      setDesigns(res.designs || []);
      setActiveDesign(res.activeDesign || 1);
      return res.designs || [];
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load homepage designs');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const activate = async (designKey: number) => {
    setActivating(designKey);
    try {
      const res = await apiPost<{ message: string; activeHomepageDesign: number }>('/api/homepage-designs', { action: 'activate', designKey });
      toast.success(res.message || `Design #${designKey} activated`);
      setActiveDesign(res.activeHomepageDesign || designKey);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to activate design');
    } finally {
      setActivating(0);
    }
  };

  const syncVariants = async () => {
    setSyncing(true);
    try {
      const res = await apiPost<{ message: string; results: Array<{ designKey: number; name: string; sliderDesign: number; action: string }> }>('/api/homepage-designs', { action: 'sync-variants' });
      toast.success(res.message || 'Hero slider variants synced');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const openWidget = (d: Design, w: Widget) => {
    setEditingWidget(w);
    setWForm({
      moduleKey: w.moduleKey || '',
      variantId: String(w.variantId ?? 1),
      sectionTitle: w.sectionTitle || '',
      sectionSubtitle: w.sectionSubtitle || '',
      displayOrder: String(w.displayOrder ?? 0),
      isActive: !!w.isActive,
    });
    setManaging(d);
  };

  const saveWidget = async () => {
    if (!editingWidget) return;
    setSavingWidget(true);
    try {
      const res = await apiPut<{ message: string }>('/api/homepage-designs', {
        widgetId: editingWidget.id,
        moduleKey: wForm.moduleKey,
        variantId: wForm.variantId,
        sectionTitle: wForm.sectionTitle,
        sectionSubtitle: wForm.sectionSubtitle,
        displayOrder: wForm.displayOrder,
        isActive: wForm.isActive,
      });
      toast.success(res.message || 'Widget updated');
      setEditingWidget(null);
      const fresh = await load();
      // keep the managing modal in sync with fresh data
      setManaging(prev => (prev ? fresh.find(d => d.id === prev.id) || prev : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update widget');
    } finally {
      setSavingWidget(false);
    }
  };

  const widgetCount = designs.reduce((s, d) => s + d.widgets.length, 0);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Home className="h-5 w-5" />}
        title="Homepage Designs"
        subtitle="18 switchable designs — activate one instantly or fine-tune its widget composition"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={syncVariants} disabled={syncing} title="Apply the correct hero slider design to every homepage design">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {syncing ? 'Syncing…' : 'Sync Hero Sliders'}
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(`/?design=${activeDesign}`, '_blank')}><ExternalLink className="h-4 w-4" /> Preview Active</Button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Designs" value={designs.length} icon={<Layers className="h-5 w-5" />} accent="primary" />
            <StatCard label="Active Design" value={`#${activeDesign}`} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" hint={designs.find(d => d.designKey === activeDesign)?.name || ''} />
            <StatCard label="Widgets Total" value={widgetCount} icon={<Sparkles className="h-5 w-5" />} accent="secondary" />
            <StatCard label="Compositions" value={designs.filter(d => d.widgets.length > 0).length} icon={<Layers className="h-5 w-5" />} accent="tertiary" hint="with widgets" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {designs.map(d => {
              const isActive = d.designKey === activeDesign;
              return (
                <div
                  key={d.id}
                  className={`rounded-xl border bg-white p-4 flex flex-col gap-3 transition-all ${isActive ? 'border-[var(--mc-primary)] shadow-md ring-1 ring-[var(--mc-primary)]' : 'hover:shadow-md'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 ${isActive ? 'mc-gradient-primary' : 'bg-slate-400'}`}>
                      {d.designKey}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[var(--mc-text-primary)] truncate">{d.name}</h3>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0">
                            <CheckCircle2 className="h-3 w-3" /> ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{d.description || 'No description'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {d.widgets.slice(0, 8).map(w => (
                      <button
                        key={w.id}
                        onClick={() => openWidget(d, w)}
                        title={`${w.moduleKey} — click to edit`}
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold transition-colors ${w.isActive ? 'bg-[var(--mc-primary-light)] text-[var(--mc-primary)] border-[var(--mc-primary)]/30 hover:bg-[var(--mc-primary)] hover:text-white' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                      >
                        {w.moduleKey.replaceAll('_', ' ')}
                      </button>
                    ))}
                    {d.widgets.length > 8 && <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground">+{d.widgets.length - 8} more</span>}
                    {d.widgets.length === 0 && <span className="text-[10px] text-muted-foreground">No widgets</span>}
                  </div>

                  <div className="flex items-center gap-2 mt-auto pt-1">
                    <Button size="sm" className="h-8 gap-1 flex-1" disabled={isActive || activating === d.designKey} onClick={() => activate(d.designKey)}>
                      {activating === d.designKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                      {isActive ? 'Active' : 'Activate'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => window.open(`/?design=${d.designKey}`, '_blank')} title={`Preview /?design=${d.designKey}`}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setManaging(d)} title="Manage widgets">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Widget manager modal */}
      <PremiumModal
        open={!!managing} onOpenChange={o => { if (!o) { setManaging(null); setEditingWidget(null); } }} size="lg"
        title={managing ? `Widgets — Design #${managing.designKey} ${managing.name}` : ''}
        icon={<Sparkles className="h-5 w-5" />}
        description={managing ? `${managing.widgets.length} widget(s) rendered in display order` : ''}
        footerNote="Click any widget to edit its module, variant, section titles, order & active state"
        secondaryLabel="Close"
      >
        {managing && (
          <div className="space-y-2">
            {(managing.widgets || []).map(w => (
              <div key={w.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${editingWidget?.id === w.id ? 'border-[var(--mc-primary)] bg-[var(--mc-primary-light)]' : 'border-[var(--mc-divider)] bg-white'}`}>
                <span className="h-6 w-6 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center shrink-0">{w.displayOrder}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--mc-text-primary)] truncate">{w.moduleKey.replaceAll('_', ' ')} <span className="text-muted-foreground font-normal text-xs">v{w.variantId}</span></p>
                  <p className="text-[11px] text-muted-foreground truncate">{w.sectionTitle || 'No section title'}</p>
                </div>
                {!w.isActive && <span className="text-[10px] text-slate-400 font-semibold shrink-0">hidden</span>}
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs shrink-0" onClick={() => openWidget(managing, w)}>
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
              </div>
            ))}
            {managing.widgets.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">This design has no widgets yet.</p>}
          </div>
        )}
      </PremiumModal>

      {/* Widget edit modal */}
      <PremiumModal
        open={!!editingWidget} onOpenChange={o => { if (!o) setEditingWidget(null); }} size="md"
        title={editingWidget ? `Edit Widget — ${editingWidget.moduleKey.replaceAll('_', ' ')}` : ''}
        icon={<Pencil className="h-5 w-5" />}
        description={editingWidget ? `Design #${managing?.designKey} · variant ${editingWidget.variantId}` : ''}
        footerNote="Changes apply instantly to the public homepage when this design is active"
        submitLabel="Save Widget"
        onSubmit={saveWidget} submitting={savingWidget} secondaryLabel="Cancel"
      >
        {editingWidget && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={<Hash className="h-3.5 w-3.5" />} label="Widget Module Key">
              <McInput value={wForm.moduleKey} onChange={e => setWForm(f => ({ ...f, moduleKey: e.target.value }))} placeholder="HERO_SLIDER" />
            </Field>
            <Field icon={<Sparkles className="h-3.5 w-3.5" />} label="Variant">
              <McSelect value={wForm.variantId} onValueChange={v => setWForm(f => ({ ...f, variantId: v }))} options={[1, 2, 3].map(n => ({ value: String(n), label: `Variant ${n}` }))} />
            </Field>
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Section Title">
              <McInput value={wForm.sectionTitle} onChange={e => setWForm(f => ({ ...f, sectionTitle: e.target.value }))} placeholder="Our Departments" />
            </Field>
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Section Subtitle">
              <McInput value={wForm.sectionSubtitle} onChange={e => setWForm(f => ({ ...f, sectionSubtitle: e.target.value }))} placeholder="Centres of excellence" />
            </Field>
            <Field icon={<ArrowUpDown className="h-3.5 w-3.5" />} label="Display Order">
              <McInput type="number" value={wForm.displayOrder} onChange={e => setWForm(f => ({ ...f, displayOrder: e.target.value }))} />
            </Field>
            <Field icon={<ToggleRight className="h-3.5 w-3.5" />} label="Active">
              <div className="flex items-center gap-3 rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] px-3 py-2">
                <Switch checked={wForm.isActive} onCheckedChange={c => setWForm(f => ({ ...f, isActive: c }))} />
                <span className="text-sm text-[var(--mc-text-secondary)]">{wForm.isActive ? 'Rendered on homepage' : 'Hidden'}</span>
              </div>
            </Field>
          </div>
        )}
      </PremiumModal>
    </div>
  );
}
