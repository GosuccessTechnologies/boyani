'use client';

/**
 * INVENTORY ITEMS — Instruction 25 premium pass.
 * CRUD DataTable + multi-section modal + CSV bulk import + low-stock filter
 * chip. Category colour chips, KSh value formatting, amber low-stock row
 * highlights and a view-detail modal (identity / stock / value / assignment).
 * ADMIN/INVENTORY manage; STAFF see their assigned items only (API scopes
 * ?assignedTo to the caller's user id).
 */

import * as React from 'react';
import {
  Boxes, Tag, Hash, Package, Banknote, AlertTriangle, ClipboardList, MapPin,
  Truck, Wrench, AlignLeft, Pencil, Trash2, Plus, FileText, Barcode, Coins, Box, Eye,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, num, Field, FormSection, ConfirmModal, BoolPill, StatusBadge, PageHeading, SkeletonCards, McInput, McTextarea, McSelect, CsvImportControls } from '@/app/ops/_lib';
import { useAuthStore } from '@/stores/auth-store';

interface Item {
  id: string; code: string; name: string; category: string; sku: string;
  quantity: number; unit: string; unitCost: number; unitPrice: number; reorderLevel: number;
  assignedTo: string; location: string; supplier: string; condition: string;
  notes: string; isActive: boolean; createdAt: string;
}
interface ItemsResp { items: Item[]; total: number; page: number; perPage: number; totalPages: number }

const CATEGORIES = ['GENERAL', 'EQUIPMENT', 'FURNITURE', 'CONSUMABLES', 'STATIONERY', 'LINEN', 'KITCHEN', 'CLEANING', 'IT'];
const CONDITIONS = ['GOOD', 'FAIR', 'DAMAGED', 'UNDER_REPAIR'];
const UNITS = ['pcs', 'boxes', 'packs', 'sets', 'bottles', 'rolls', 'units', 'litres', 'kg'];

/** Category colour chips (soft tones). */
const CATEGORY_TONES: Record<string, string> = {
  GENERAL: 'bg-slate-100 text-slate-700 border-slate-200',
  EQUIPMENT: 'bg-sky-100 text-sky-700 border-sky-200',
  FURNITURE: 'bg-amber-100 text-amber-700 border-amber-200',
  CONSUMABLES: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  STATIONERY: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  LINEN: 'bg-pink-100 text-pink-700 border-pink-200',
  KITCHEN: 'bg-orange-100 text-orange-700 border-orange-200',
  CLEANING: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  IT: 'bg-violet-100 text-violet-700 border-violet-200',
};
const categoryChip = (c: string) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${CATEGORY_TONES[c] || CATEGORY_TONES.GENERAL}`}>
    {c ? c.replaceAll('_', ' ') : '—'}
  </span>
);

const CSV_HEADERS = ['name', 'category', 'sku', 'quantity', 'unit', 'unitCost', 'unitPrice', 'reorderLevel', 'assignedTo', 'location', 'supplier', 'condition', 'notes'];

const emptyForm = {
  code: '', name: '', category: 'GENERAL', sku: '', quantity: '0', unit: 'pcs',
  unitCost: '', unitPrice: '', reorderLevel: '10', assignedTo: '', location: '',
  supplier: '', condition: 'GOOD', notes: '',
};

export default function InventoryItemsPage() {
  const { user } = useAuthStore();
  const canManage = user?.role === 'ADMIN' || user?.role === 'INVENTORY';

  const [items, setItems] = React.useState<Item[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [lowStockOnly, setLowStockOnly] = React.useState(false);

  // Deep-link ?lowStock=1 (dashboard quick link) — read once on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('lowStock=1')) {
      setLowStockOnly(true);
    }
  }, []);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Item | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Item | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [csvOpen, setCsvOpen] = React.useState(false);
  const [csvBusy, setCsvBusy] = React.useState(false);

  // View-detail modal
  const [viewing, setViewing] = React.useState<Item | null>(null);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<ItemsResp>(`/api/inventory?page=${p}&perPage=20${lowStockOnly ? '&lowStock=1' : ''}`);
      setItems(res.items || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  }, [lowStockOnly]);

  React.useEffect(() => { load(1); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };
  const openEdit = (i: Item) => {
    setEditing(i);
    setForm({
      code: i.code, name: i.name, category: i.category || 'GENERAL', sku: i.sku || '',
      quantity: String(i.quantity ?? 0), unit: i.unit || 'pcs',
      unitCost: String(i.unitCost ?? ''), unitPrice: String(i.unitPrice ?? ''),
      reorderLevel: String(i.reorderLevel ?? 10), assignedTo: i.assignedTo || '',
      location: i.location || '', supplier: i.supplier || '', condition: i.condition || 'GOOD',
      notes: i.notes || '',
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Item name is required'); return; }
    if (parseInt(form.quantity) < 0) { toast.error('Quantity cannot be negative'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(), category: form.category, sku: form.sku,
        quantity: form.quantity, unit: form.unit, unitCost: form.unitCost, unitPrice: form.unitPrice,
        reorderLevel: form.reorderLevel, assignedTo: form.assignedTo, location: form.location,
        supplier: form.supplier, condition: form.condition, notes: form.notes,
        ...(editing ? { id: editing.id } : (form.code.trim() ? { code: form.code.trim() } : {})),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/inventory', payload)
        : await apiPost<{ message: string }>('/api/inventory', payload);
      toast.success(res.message || (editing ? 'Item updated' : 'Item registered'));
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string; softDeleted?: boolean }>(`/api/inventory?id=${deleting.id}`);
      toast.success(res.message || 'Item removed');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const importCsv = async (rows: Array<Record<string, string>>) => {
    setCsvBusy(true);
    try {
      const bulkItems = rows.map(r => ({
        name: r.name, category: r.category, sku: r.sku, quantity: r.quantity,
        unit: r.unit, unitCost: r.unitCost, unitPrice: r.unitPrice, reorderLevel: r.reorderLevel,
        assignedTo: r.assignedTo, location: r.location, supplier: r.supplier,
        condition: r.condition, notes: r.notes,
      }));
      const res = await apiPost<{ imported: number }>('/api/inventory', { bulkItems });
      toast.success(`Imported ${res.imported} item(s)`);
      setCsvOpen(false);
      load(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'CSV import failed');
    } finally {
      setCsvBusy(false);
    }
  };

  const columns: Column<Item>[] = [
    { key: 'code', header: 'Code', defaultVisible: true, render: r => (
      <span className="font-mono text-xs font-semibold text-[var(--mc-primary)]">{r.code}</span>
    ) },
    { key: 'name', header: 'Item', defaultVisible: true, render: r => (
      <div className="min-w-0">
        <p className="font-semibold text-[var(--mc-text-primary)] truncate">{r.name}</p>
        {r.quantity <= r.reorderLevel && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700">
            <AlertTriangle className="h-3 w-3" /> low stock
          </span>
        )}
      </div>
    ) },
    { key: 'quantity', header: 'Qty', defaultVisible: true, align: 'right', render: r => (
      <span className={r.quantity <= r.reorderLevel ? 'text-amber-600 font-bold' : 'font-semibold'}>
        {num(r.quantity)} <span className="text-muted-foreground font-normal text-xs">{r.unit}</span>
      </span>
    ), csvValue: r => r.quantity },
    { key: 'category', header: 'Category', defaultVisible: true, render: r => categoryChip(r.category), csvValue: r => r.category.replaceAll('_', ' ') },
    { key: 'condition', header: 'Condition', defaultVisible: true, render: r => <StatusBadge status={r.condition} />, csvValue: r => r.condition },
    { key: 'unitCost', header: 'Unit Cost', align: 'right', render: r => kes(r.unitCost), csvValue: r => r.unitCost },
    { key: 'value', header: 'Stock Value', align: 'right', render: r => (
      <span className="font-semibold">{kes(r.unitCost * r.quantity)}</span>
    ), csvValue: r => r.unitCost * r.quantity },
    { key: 'assignedTo', header: 'Assigned To' },
    { key: 'location', header: 'Location' },
    { key: 'reorderLevel', header: 'Reorder Level', align: 'right' },
    { key: 'sku', header: 'SKU' },
    { key: 'supplier', header: 'Supplier' },
    { key: 'unit', header: 'Unit' },
    { key: 'isActive', header: 'Active', render: r => <BoolPill value={r.isActive} />, csvValue: r => (r.isActive ? 'YES' : 'NO') },
    { key: 'notes', header: 'Notes' },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View item details', variant: 'view', onClick: r => setViewing(r) },
    ...(canManage ? [
      { icon: <Pencil className="h-4 w-4" />, title: 'Edit item', variant: 'edit' as const, onClick: openEdit },
      { icon: <Trash2 className="h-4 w-4" />, title: 'Delete item', variant: 'delete' as const, onClick: r => { setDeleting(r); setConfirmOpen(true); } },
    ] : []),
  ];

  const stockValue = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const lowCount = items.filter(i => i.quantity <= i.reorderLevel).length;
  const assignedCount = items.filter(i => i.assignedTo).length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Boxes className="h-5 w-5" />}
        title="Inventory Items"
        subtitle={canManage ? 'Assets & consumables master list — every change is journaled' : 'Items assigned to you'}
        actions={canManage && <>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setCsvOpen(true)}><FileText className="h-4 w-4" /> CSV Import</Button>
          <Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Item</Button>
        </>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Items" value={total} icon={<Box className="h-5 w-5" />} accent="primary" />
          <StatCard label="Low Stock" value={lowCount} icon={<AlertTriangle className="h-5 w-5" />} accent="danger" hint="this page" />
          <StatCard label="Assigned" value={assignedCount} icon={<ClipboardList className="h-5 w-5" />} accent="secondary" hint="this page" />
          <StatCard label="Stock Value" value={kes(stockValue)} icon={<Banknote className="h-5 w-5" />} accent="success" hint="this page" />
        </div>
      )}

      {/* Low-stock chip (amber highlight) */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button
          onClick={() => setLowStockOnly(v => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            lowStockOnly ? 'bg-amber-500 text-white border-transparent shadow' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Low stock only
        </button>
        <span className="text-xs text-muted-foreground">Quantity at/below reorder level — highlighted amber in the table</span>
      </div>

      <DataTable
        data={items} columns={columns} actions={actions}
        rowKey={r => r.id} title="Inventory Items" moduleLabel="Inventory Items"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      {canManage && (
        <PremiumModal
          open={modalOpen} onOpenChange={setModalOpen} size="lg"
          title={editing ? `Edit Item — ${editing.code}` : 'Register Inventory Item'}
          icon={<Boxes className="h-5 w-5" />}
          description={editing ? 'Quantity changes are journaled as ADJUSTMENT movements' : 'Initial stock is journaled as an IN movement automatically'}
          footerNote="Code (INV-…) auto-generated when left blank"
          submitLabel={editing ? 'Update Item' : 'Register Item'}
          onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
        >
          <div className="space-y-5">
            <FormSection n={1} title="Identity">
              <Field icon={<Box className="h-3.5 w-3.5" />} label="Item Name">
                <McInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Wheelchair — standard" />
              </Field>
              <Field icon={<Barcode className="h-3.5 w-3.5" />} label="Code" hint={editing ? 'Changing code requires uniqueness' : 'Auto-generated (INV-…) when blank'}>
                <McInput value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="INV-0001" disabled={!!editing} />
              </Field>
              <Field icon={<Tag className="h-3.5 w-3.5" />} label="Category">
                <McSelect value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))} options={CATEGORIES.map(c => ({ value: c, label: c.replaceAll('_', ' ') }))} />
              </Field>
              <Field icon={<Hash className="h-3.5 w-3.5" />} label="SKU">
                <McInput value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="WC-STD-01" />
              </Field>
            </FormSection>

            <FormSection n={2} title="Stock & Pricing">
              <Field icon={<Package className="h-3.5 w-3.5" />} label="Quantity">
                <McInput type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </Field>
              <Field icon={<Package className="h-3.5 w-3.5" />} label="Unit">
                <McSelect value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))} options={UNITS.map(u => ({ value: u, label: u }))} />
              </Field>
              <Field icon={<Coins className="h-3.5 w-3.5" />} label="Unit Cost (KSh)">
                <McInput type="number" min="0" step="0.01" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} />
              </Field>
              <Field icon={<Coins className="h-3.5 w-3.5" />} label="Unit Price (KSh)">
                <McInput type="number" min="0" step="0.01" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} />
              </Field>
              <Field icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Reorder Level">
                <McInput type="number" min="0" value={form.reorderLevel} onChange={e => setForm(f => ({ ...f, reorderLevel: e.target.value }))} />
              </Field>
              <Field icon={<Wrench className="h-3.5 w-3.5" />} label="Condition">
                <McSelect value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))} options={CONDITIONS.map(c => ({ value: c, label: c.replaceAll('_', ' ') }))} />
              </Field>
            </FormSection>

            <FormSection n={3} title="Assignment & Sourcing">
              <Field icon={<ClipboardList className="h-3.5 w-3.5" />} label="Assigned To" hint="Employee id/name — blank = in store">
                <McInput value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Store / employee id" />
              </Field>
              <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
                <McInput value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Store B, Rack 3" />
              </Field>
              <Field icon={<Truck className="h-3.5 w-3.5" />} label="Supplier">
                <McInput value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="MedSupplies Kenya Ltd" />
              </Field>
              <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Notes" className="sm:col-span-2">
                <McTextarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Serial numbers, service dates…" />
              </Field>
            </FormSection>
          </div>
        </PremiumModal>
      )}

      {canManage && (
        <PremiumModal
          open={csvOpen} onOpenChange={setCsvOpen}
          title="Bulk Import Items"
          icon={<FileText className="h-5 w-5" />}
          description="Download the CSV template, fill one item per row, then import"
          footerNote="Rows missing a name are skipped — codes auto-generated"
          submitLabel="Close" onSubmit={() => setCsvOpen(false)}
        >
          <CsvImportControls templateName="inventory-items-template.csv" headers={CSV_HEADERS} onParsed={importCsv} note={`Columns: ${CSV_HEADERS.join(', ')}`} />
          {csvBusy && <p className="text-xs text-muted-foreground mt-3">Importing…</p>}
        </PremiumModal>
      )}

      {canManage && (
        <ConfirmModal
          open={confirmOpen} onOpenChange={setConfirmOpen}
          title="Delete Inventory Item"
          message={deleting ? `Delete "${deleting.name}" (${deleting.code})? Items with movement history are deactivated instead.` : ''}
          onConfirm={doDelete} submitting={deleteBusy}
        />
      )}

      {/* ── View-detail modal (all fields in sections) ── */}
      <PremiumModal
        open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }} size="lg"
        title={viewing ? `Item Details — ${viewing.code}` : ''}
        icon={<Box className="h-5 w-5" />}
        description={viewing ? `${viewing.name} · registered ${new Date(viewing.createdAt).toLocaleDateString('en-KE')}` : ''}
        footerNote="Day-to-day stock changes belong in the Movements journal — recorded movements adjust quantity atomically"
      >
        {viewing && (
          <div className="space-y-5">
            {/* Identity */}
            <FormSection n={1} title="Identity">
              <Field icon={<Box className="h-3.5 w-3.5" />} label="Item Name">
                <p className="text-sm font-medium text-[var(--mc-text-primary)]">{viewing.name}</p>
              </Field>
              <Field icon={<Barcode className="h-3.5 w-3.5" />} label="Code / SKU">
                <p className="text-sm font-mono text-xs">{viewing.code}{viewing.sku ? ` · ${viewing.sku}` : ''}</p>
              </Field>
              <Field icon={<Tag className="h-3.5 w-3.5" />} label="Category">
                {categoryChip(viewing.category)}
              </Field>
              <Field icon={<Wrench className="h-3.5 w-3.5" />} label="Condition">
                <StatusBadge status={viewing.condition} />
              </Field>
            </FormSection>

            {/* Stock */}
            <FormSection n={2} title="Stock">
              <Field icon={<Package className="h-3.5 w-3.5" />} label="Quantity On Hand">
                <p className={`text-lg font-extrabold ${viewing.quantity <= viewing.reorderLevel ? 'text-amber-600' : 'text-[var(--mc-text-primary)]'}`}>
                  {num(viewing.quantity)} <span className="text-sm font-normal text-muted-foreground">{viewing.unit}</span>
                  {viewing.quantity <= viewing.reorderLevel && (
                    <span className="ml-2 text-[11px] font-bold text-amber-700 inline-flex items-center gap-1 align-middle">
                      <AlertTriangle className="h-3 w-3" /> low stock
                    </span>
                  )}
                </p>
              </Field>
              <Field icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Reorder Level">
                <p className="text-sm">{num(viewing.reorderLevel)} {viewing.unit}</p>
              </Field>
            </FormSection>

            {/* Value */}
            <FormSection n={3} title="Value">
              <Field icon={<Coins className="h-3.5 w-3.5" />} label="Unit Cost">
                <p className="text-sm font-semibold">{kes(viewing.unitCost)}</p>
              </Field>
              <Field icon={<Banknote className="h-3.5 w-3.5" />} label="Total Stock Value">
                <p className="text-sm font-bold text-emerald-700">{kes(viewing.unitCost * viewing.quantity)}</p>
              </Field>
            </FormSection>

            {/* Assignment */}
            <FormSection n={4} title="Assignment & Sourcing">
              <Field icon={<ClipboardList className="h-3.5 w-3.5" />} label="Assigned To">
                <p className="text-sm">{viewing.assignedTo || <span className="text-muted-foreground">in store</span>}</p>
              </Field>
              <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
                <p className="text-sm">{viewing.location || '—'}</p>
              </Field>
              <Field icon={<Truck className="h-3.5 w-3.5" />} label="Supplier">
                <p className="text-sm">{viewing.supplier || '—'}</p>
              </Field>
              <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Notes">
                <p className="text-sm">{viewing.notes || '—'}</p>
              </Field>
            </FormSection>
          </div>
        )}
      </PremiumModal>
    </div>
  );
}
