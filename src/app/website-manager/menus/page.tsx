'use client';

/**
 * MENUS — menu & mega-menu manager. Select a menu → items tree (parent /
 * children indented) with add/edit/delete item modals. Menu designId
 * select (1-20) + location + active switch. Items support moduleKey,
 * mega-menu options, icon keys, ordering & open-in-new-tab.
 */

import * as React from 'react';
import {
  Menu as MenuIcon, ListTree, Type, Link2, Blocks, LayoutGrid, ImageIcon, AlignLeft,
  Sparkles, ArrowUpDown, Pencil, Trash2, Plus, ChevronRight, PanelTop, EyeOff,
} from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { FileUploader } from '@/components/shared/FileUploader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, ConfirmModal, PageHeading, McInput, McSelect } from '@/app/ops/_lib';

interface MenuItem {
  id: string; menuId: string; parentId: string | null; label: string; url: string | null;
  moduleKey: string | null; isMega: boolean; megaColumns: number; megaImageUrl: string | null;
  megaDescription: string; iconKey: string | null; displayOrder: number; isActive: boolean;
  openInNewTab: boolean; children?: MenuItem[];
}
interface Menu {
  id: string; name: string; slug: string; location: string; designId: number; isActive: boolean;
  items: MenuItem[];
}

const MODULE_KEYS = ['SERVICES', 'NEWS', 'CONTACT', 'BOOKING', 'DOWNLOADS', 'GALLERY', 'CAREERS'];
const MENU_LOCATIONS = ['HEADER', 'FOOTER'];
const MENU_DESIGNS = Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: `Design ${i + 1}` }));

const emptyItem = {
  label: '', url: '', moduleKey: 'none', parentId: 'none', isMega: false, megaColumns: '2',
  megaImageUrl: '', megaDescription: '', iconKey: '', displayOrder: '0', isActive: true, openInNewTab: false,
};

export default function MenusPage() {
  const [menus, setMenus] = React.useState<Menu[]>([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  const [itemModal, setItemModal] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<MenuItem | null>(null);
  const [iForm, setIForm] = React.useState({ ...emptyItem });
  const [itemBusy, setItemBusy] = React.useState(false);

  const [menuModal, setMenuModal] = React.useState(false);
  const [mForm, setMForm] = React.useState({ name: '', location: 'HEADER', designId: '1' });
  const [menuBusy, setMenuBusy] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmMsg, setConfirmMsg] = React.useState('');
  const [confirmAction, setConfirmAction] = React.useState<(() => Promise<void>) | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ menus: Menu[] }>('/api/menus');
      const list = res.menus || [];
      setMenus(list);
      setSelectedId(prev => (list.some(m => m.id === prev) ? prev : (list[0]?.id || '')));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load menus');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const selected = menus.find(m => m.id === selectedId) || null;
  const parents = selected?.items || [];

  const openCreateItem = (parentId = '') => {
    setEditingItem(null);
    setIForm({ ...emptyItem, parentId: parentId || 'none', displayOrder: String((selected?.items || []).length) });
    setItemModal(true);
  };
  const openEditItem = (it: MenuItem) => {
    setEditingItem(it);
    setIForm({
      label: it.label, url: it.url || '', moduleKey: it.moduleKey || 'none', parentId: it.parentId || 'none',
      isMega: !!it.isMega, megaColumns: String(it.megaColumns ?? 2), megaImageUrl: it.megaImageUrl || '',
      megaDescription: it.megaDescription || '', iconKey: it.iconKey || '',
      displayOrder: String(it.displayOrder ?? 0), isActive: !!it.isActive, openInNewTab: !!it.openInNewTab,
    });
    setItemModal(true);
  };

  const submitItem = async () => {
    if (!selected || !iForm.label.trim()) { toast.error('Label is required'); return; }
    setItemBusy(true);
    try {
      const payload = {
        id: selected.id,
        ...(editingItem ? { itemId: editingItem.id } : {}),
        label: iForm.label.trim(),
        url: iForm.url || null,
        moduleKey: iForm.moduleKey === 'none' ? null : iForm.moduleKey,
        parentId: iForm.parentId === 'none' ? null : iForm.parentId,
        isMega: iForm.isMega,
        megaColumns: iForm.megaColumns,
        megaImageUrl: iForm.megaImageUrl || null,
        megaDescription: iForm.megaDescription,
        iconKey: iForm.iconKey || null,
        displayOrder: iForm.displayOrder,
        isActive: iForm.isActive,
        openInNewTab: iForm.openInNewTab,
      };
      const res = await apiPut<{ message: string }>('/api/menus', payload);
      toast.success(res.message || (editingItem ? 'Menu item updated' : 'Menu item added'));
      setItemModal(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save menu item');
    } finally {
      setItemBusy(false);
    }
  };

  const deleteItem = (it: MenuItem) => {
    setConfirmMsg(`Delete "${it.label}"${it.children?.length ? ` and its ${it.children.length} child item(s)` : ''}?`);
    setConfirmAction(async () => {
      await apiDelete(`/api/menus?itemId=${it.id}`);
      toast.success('Menu item deleted');
      load();
    });
    setConfirmOpen(true);
  };

  const updateMenu = async (patch: Record<string, unknown>) => {
    if (!selected) return;
    try {
      await apiPut('/api/menus', { id: selected.id, ...patch });
      toast.success('Menu updated');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update menu');
    }
  };

  const createMenu = async () => {
    if (!mForm.name.trim()) { toast.error('Menu name is required'); return; }
    setMenuBusy(true);
    try {
      const res = await apiPost<{ menu: Menu; message: string }>('/api/menus', { name: mForm.name.trim(), location: mForm.location, designId: mForm.designId });
      toast.success(res.message || 'Menu created');
      setMenuModal(false);
      setMForm({ name: '', location: 'HEADER', designId: '1' });
      await load();
      setSelectedId(res.menu?.id || '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create menu');
    } finally {
      setMenuBusy(false);
    }
  };

  const deleteMenu = () => {
    if (!selected) return;
    setConfirmMsg(`Delete menu "${selected.name}" with ALL its items?`);
    setConfirmAction(async () => {
      await apiDelete(`/api/menus?id=${selected.id}`);
      toast.success('Menu deleted');
      setSelectedId('');
      load();
    });
    setConfirmOpen(true);
  };

  const runConfirm = async () => {
    if (!confirmAction) return;
    setBusy(true);
    try {
      await confirmAction();
      setConfirmOpen(false);
      setConfirmAction(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  const totalItems = parents.reduce((s, p) => s + 1 + (p.children?.length || 0), 0);
  const megaCount = parents.reduce((s, p) => s + (p.isMega ? 1 : 0) + (p.children?.filter(c => c.isMega).length || 0), 0);

  const renderItem = (it: MenuItem, child = false) => (
    <div key={it.id} className={`${child ? 'ml-8 border-l-2 border-[var(--mc-divider)] pl-3' : ''}`}>
      <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 mb-2 ${it.isActive ? 'border-[var(--mc-divider)] bg-white' : 'border-slate-200 bg-slate-50 opacity-75'}`}>
        {child && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="h-6 w-6 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center shrink-0">{it.displayOrder}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-[var(--mc-text-primary)] truncate">{it.label}</p>
            {it.isMega && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold">MEGA ×{it.megaColumns}</span>}
            {it.moduleKey && <span className="px-1.5 py-0.5 rounded bg-[var(--mc-primary-light)] text-[var(--mc-primary)] text-[10px] font-bold">{it.moduleKey}</span>}
            {!it.isActive && <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 font-semibold"><EyeOff className="h-3 w-3" /> hidden</span>}
            {it.openInNewTab && <span className="text-[10px] text-muted-foreground">new tab</span>}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{it.url || it.moduleKey || '—'}{it.iconKey ? ` · icon: ${it.iconKey}` : ''}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!child && (
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Add child item" onClick={() => openCreateItem(it.id)}><Plus className="h-3.5 w-3.5" /></Button>
          )}
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Edit item" onClick={() => openEditItem(it)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-600 hover:bg-red-50" title="Delete item" onClick={() => deleteItem(it)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      {(it.children || []).map(c => renderItem(c, true))}
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<MenuIcon className="h-5 w-5" />}
        title="Menus & Mega Menus"
        subtitle="Website navigation — 20 menu designs, nested items, mega-menu columns & module links"
        actions={<Button size="sm" className="gap-1" onClick={() => setMenuModal(true)}><Plus className="h-4 w-4" /> New Menu</Button>}
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-xl" />
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : menus.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">No menus yet — create your first navigation menu.</p>
          <Button size="sm" className="gap-1" onClick={() => setMenuModal(true)}><Plus className="h-4 w-4" /> New Menu</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Menus" value={menus.length} icon={<MenuIcon className="h-5 w-5" />} accent="primary" />
            <StatCard label="Items" value={totalItems} icon={<ListTree className="h-5 w-5" />} accent="secondary" hint={selected?.name || ''} />
            <StatCard label="Mega Items" value={megaCount} icon={<Blocks className="h-5 w-5" />} accent="tertiary" />
            <StatCard label="Menu Design" value={`#${selected?.designId ?? 1}`} icon={<Sparkles className="h-5 w-5" />} accent="success" hint={selected?.name || ''} />
          </div>

          {/* Menu selector + settings */}
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field icon={<MenuIcon className="h-3.5 w-3.5" />} label="Menu">
                <McSelect
                  value={selectedId}
                  onValueChange={setSelectedId}
                  options={menus.map(m => ({ value: m.id, label: `${m.name} (${m.location} · ${m.items.length} top items)` }))}
                />
              </Field>
              <Field icon={<PanelTop className="h-3.5 w-3.5" />} label="Menu Design (1-20)">
                <McSelect
                  value={String(selected?.designId ?? 1)}
                  onValueChange={v => updateMenu({ designId: v })}
                  options={MENU_DESIGNS}
                />
              </Field>
              <div className="flex items-center gap-3 pb-0.5">
                <label className="flex items-center gap-2 text-xs text-[var(--mc-text-secondary)] cursor-pointer">
                  <Switch checked={!!selected?.isActive} onCheckedChange={c => updateMenu({ isActive: c })} />
                  {selected?.isActive ? 'Active' : 'Inactive'}
                </label>
                <Button size="sm" variant="outline" className="h-9 gap-1" onClick={deleteMenu}><Trash2 className="h-4 w-4" /> Delete Menu</Button>
              </div>
            </div>
          </div>

          {/* Items tree */}
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold text-[var(--mc-text-primary)] flex items-center gap-2">
                <ListTree className="h-4 w-4 text-[var(--mc-primary)]" /> {selected?.name} — Item Tree
              </h2>
              <Button size="sm" className="gap-1" onClick={() => openCreateItem()}><Plus className="h-4 w-4" /> Add Item</Button>
            </div>
            {parents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No items in this menu yet.</p>
            ) : (
              parents.map(it => renderItem(it))
            )}
          </div>
        </>
      )}

      {/* Item modal */}
      <PremiumModal
        open={itemModal} onOpenChange={setItemModal} size="lg"
        title={editingItem ? `Edit Item — ${editingItem.label}` : 'Add Menu Item'}
        icon={<ListTree className="h-5 w-5" />}
        description={selected ? `Menu: ${selected.name}` : ''}
        footerNote="Items with a moduleKey link to dynamic website modules (services, news, careers…)"
        submitLabel={editingItem ? 'Update Item' : 'Add Item'}
        onSubmit={submitItem} submitting={itemBusy} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Basic">
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Label">
              <McInput value={iForm.label} onChange={e => setIForm(f => ({ ...f, label: e.target.value }))} placeholder="Our Services" />
            </Field>
            <Field icon={<Link2 className="h-3.5 w-3.5" />} label="URL" hint="ignored when a moduleKey is set">
              <McInput value={iForm.url} onChange={e => setIForm(f => ({ ...f, url: e.target.value }))} placeholder="/services" />
            </Field>
            <Field icon={<Blocks className="h-3.5 w-3.5" />} label="Module Key">
              <McSelect
                value={iForm.moduleKey}
                onValueChange={v => setIForm(f => ({ ...f, moduleKey: v }))}
                options={[{ value: 'none', label: '— static URL —' }, ...MODULE_KEYS.map(m => ({ value: m, label: m }))]}
              />
            </Field>
            <Field icon={<ListTree className="h-3.5 w-3.5" />} label="Parent Item">
              <McSelect
                value={iForm.parentId}
                onValueChange={v => setIForm(f => ({ ...f, parentId: v }))}
                options={[{ value: 'none', label: '— top level —' }, ...parents.filter(p => p.id !== editingItem?.id).map(p => ({ value: p.id, label: p.label }))]}
              />
            </Field>
            <Field icon={<ArrowUpDown className="h-3.5 w-3.5" />} label="Display Order">
              <McInput type="number" value={iForm.displayOrder} onChange={e => setIForm(f => ({ ...f, displayOrder: e.target.value }))} />
            </Field>
            <Field icon={<Sparkles className="h-3.5 w-3.5" />} label="Icon Key" hint="lucide icon name shown in mega menus">
              <McInput value={iForm.iconKey} onChange={e => setIForm(f => ({ ...f, iconKey: e.target.value }))} placeholder="stethoscope" />
            </Field>
          </FormSection>

          <FormSection n={2} title="Mega Menu">
            <div className="sm:col-span-2">
              <label className="flex items-center gap-3 rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] px-3 py-2.5 cursor-pointer">
                <Switch checked={iForm.isMega} onCheckedChange={c => setIForm(f => ({ ...f, isMega: c }))} />
                <span className="text-sm text-[var(--mc-text-secondary)]">Mega menu item (multi-column dropdown)</span>
              </label>
            </div>
            {iForm.isMega && (
              <>
                <Field icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Mega Columns">
                  <McSelect value={iForm.megaColumns} onValueChange={v => setIForm(f => ({ ...f, megaColumns: v }))} options={[2, 3, 4].map(n => ({ value: String(n), label: `${n} columns` }))} />
                </Field>
                <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Mega Description">
                  <McInput value={iForm.megaDescription} onChange={e => setIForm(f => ({ ...f, megaDescription: e.target.value }))} placeholder="Explore our centres of excellence" />
                </Field>
                <Field icon={<ImageIcon className="h-3.5 w-3.5" />} label="Mega Image" className="sm:col-span-2">
                  <FileUploader value={iForm.megaImageUrl} onChange={url => setIForm(f => ({ ...f, megaImageUrl: url }))} module="WEBSITE" label="Upload mega menu image" />
                </Field>
              </>
            )}
          </FormSection>

          <FormSection n={3} title="Behaviour">
            <label className="flex items-center gap-3 rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] px-3 py-2.5 cursor-pointer">
              <Switch checked={iForm.isActive} onCheckedChange={c => setIForm(f => ({ ...f, isActive: c }))} />
              <span className="text-sm text-[var(--mc-text-secondary)]">Active (visible)</span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] px-3 py-2.5 cursor-pointer">
              <Switch checked={iForm.openInNewTab} onCheckedChange={c => setIForm(f => ({ ...f, openInNewTab: c }))} />
              <span className="text-sm text-[var(--mc-text-secondary)]">Open in new tab</span>
            </label>
          </FormSection>
        </div>
      </PremiumModal>

      {/* New menu modal */}
      <PremiumModal
        open={menuModal} onOpenChange={setMenuModal} size="sm"
        title="New Menu"
        icon={<MenuIcon className="h-5 w-5" />}
        description="Create a navigation menu, then add items to it"
        footerNote="Slug auto-generated from the name"
        submitLabel="Create Menu"
        onSubmit={createMenu} submitting={menuBusy} secondaryLabel="Cancel"
      >
        <div className="space-y-3">
          <Field icon={<Type className="h-3.5 w-3.5" />} label="Menu Name">
            <McInput value={mForm.name} onChange={e => setMForm(f => ({ ...f, name: e.target.value }))} placeholder="Main Navigation" />
          </Field>
          <Field icon={<PanelTop className="h-3.5 w-3.5" />} label="Location">
            <McSelect value={mForm.location} onValueChange={v => setMForm(f => ({ ...f, location: v }))} options={MENU_LOCATIONS.map(l => ({ value: l, label: l }))} />
          </Field>
          <Field icon={<Sparkles className="h-3.5 w-3.5" />} label="Menu Design (1-20)">
            <McSelect value={mForm.designId} onValueChange={v => setMForm(f => ({ ...f, designId: v }))} options={MENU_DESIGNS} />
          </Field>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={o => { if (!o) { setConfirmOpen(false); setConfirmAction(null); } }}
        title="Confirm Deletion"
        message={confirmMsg}
        onConfirm={runConfirm} submitting={busy}
      />
    </div>
  );
}
