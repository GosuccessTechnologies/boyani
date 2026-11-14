'use client';

/**
 * INVENTORY MOVEMENTS — Instruction 25.
 * Journal of every stock change (IN, OUT, ASSIGN, RETURN, ADJUSTMENT,
 * DISPOSE) with item / type / date-range filters + operator names.
 * NEW: "Record Movement" opens a PremiumModal (item select with search,
 * type chips, qty, notes, assign-to/location for ASSIGN) that POSTs
 * /api/inventory-movements — the API adjusts the item stock atomically
 * and refuses to drop quantity below 0. ADMIN/INVENTORY only.
 */

import * as React from 'react';
import {
  ArrowLeftRight, Package, CalendarDays, ListFilter, Search, Loader2,
  ArrowDownToLine, ArrowUpFromLine, Plus, Boxes, User, MapPin, AlignLeft, Hash,
  ClipboardList, RotateCcw, SlidersHorizontal, Trash2, UserCheck,
} from 'lucide-react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDateTime, num, Field, PageHeading, SkeletonCards, McInput, McSelect } from '@/app/ops/_lib';

interface MovementItem { id: string; code: string; name: string; unit: string }
interface Movement {
  id: string; itemId: string; item: MovementItem | null; movementType: string;
  quantity: number; reference: string; notes: string; createdById: string; createdAt: string;
  recordedByName?: string;
}
interface MovementsResp { movements: Movement[]; total: number; page: number; perPage: number; totalPages: number }

interface Item {
  id: string; code: string; name: string; category: string; quantity: number;
  unit: string; reorderLevel: number; assignedTo: string; location: string; isActive: boolean;
}
interface ItemsResp { items: Item[]; total: number; page: number; perPage: number; totalPages: number }

const MOVEMENT_TYPES = ['IN', 'OUT', 'ASSIGN', 'RETURN', 'ADJUSTMENT', 'DISPOSE'] as const;
type MovementType = typeof MOVEMENT_TYPES[number];

/** Chip colours per movement type. */
const TYPE_TONES: Record<string, string> = {
  IN: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  RETURN: 'bg-teal-100 text-teal-700 border-teal-300',
  OUT: 'bg-red-100 text-red-700 border-red-300',
  ASSIGN: 'bg-sky-100 text-sky-700 border-sky-300',
  ADJUSTMENT: 'bg-amber-100 text-amber-700 border-amber-300',
  DISPOSE: 'bg-rose-100 text-rose-700 border-rose-300',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  IN: <ArrowDownToLine className="h-3.5 w-3.5" />,
  RETURN: <RotateCcw className="h-3.5 w-3.5" />,
  OUT: <ArrowUpFromLine className="h-3.5 w-3.5" />,
  ASSIGN: <UserCheck className="h-3.5 w-3.5" />,
  ADJUSTMENT: <SlidersHorizontal className="h-3.5 w-3.5" />,
  DISPOSE: <Trash2 className="h-3.5 w-3.5" />,
};

const emptyForm = {
  itemId: '',
  movementType: 'IN' as MovementType,
  quantity: '',
  notes: '',
  assignedTo: '',
  location: '',
};

export default function InventoryMovementsPage() {
  const [movements, setMovements] = React.useState<Movement[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [items, setItems] = React.useState<Item[]>([]);
  const [itemSearch, setItemSearch] = React.useState('');
  const [filterItemId, setFilterItemId] = React.useState('');
  const [movementType, setMovementType] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [applied, setApplied] = React.useState({ itemId: '', movementType: '', dateFrom: '', dateTo: '' });

  // Record Movement modal
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [recordItemSearch, setRecordItemSearch] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Load the journal
  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(p), perPage: '20' });
      if (applied.itemId) q.set('itemId', applied.itemId);
      if (applied.movementType) q.set('movementType', applied.movementType);
      if (applied.dateFrom) q.set('dateFrom', applied.dateFrom);
      if (applied.dateTo) q.set('dateTo', applied.dateTo);
      const res = await apiGet<MovementsResp>(`/api/inventory-movements?${q.toString()}`);
      setMovements(res.movements || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  }, [applied]);

  // Load items for the selects (managers only reach this page)
  const loadItems = React.useCallback(async () => {
    try {
      let collected: Item[] = [];
      let p = 1;
      for (;;) {
        const res = await apiGet<ItemsResp>(`/api/inventory?page=${p}&perPage=100`);
        collected = collected.concat(res.items || []);
        const tp = res.totalPages || 1;
        if (p >= tp || p > 10) break; // hard stop at 1000 items
        p++;
      }
      setItems(collected);
    } catch {
      setItems([]);
    }
  }, []);

  React.useEffect(() => { load(1); }, [load]);
  React.useEffect(() => { loadItems(); }, [loadItems]);

  const applyFilters = () => setApplied({ itemId: filterItemId, movementType, dateFrom, dateTo });
  const clearFilters = () => {
    setFilterItemId(''); setMovementType(''); setDateFrom(''); setDateTo('');
    setApplied({ itemId: '', movementType: '', dateFrom: '', dateTo: '' });
  };

  // ── Record Movement ──
  const openRecord = () => {
    setForm({ ...emptyForm });
    setRecordItemSearch('');
    setRecordOpen(true);
  };

  const selectedItem = items.find(i => i.id === form.itemId) || null;

  const submitMovement = async () => {
    if (!form.itemId) { toast.error('Select an item'); return; }
    const qty = parseInt(form.quantity);
    if (isNaN(qty) || qty === 0) { toast.error('Enter a non-zero quantity (ADJUSTMENT may be negative)'); return; }
    if (form.movementType !== 'ADJUSTMENT' && qty < 0) { toast.error('Quantity must be positive for this movement type'); return; }
    if (form.movementType === 'ASSIGN' && !form.assignedTo.trim()) { toast.error('Assign To is required for ASSIGN movements'); return; }
    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string; item: Item }>('/api/inventory-movements', {
        itemId: form.itemId,
        movementType: form.movementType,
        quantity: qty,
        notes: form.notes,
        ...(form.movementType === 'ASSIGN' ? { assignedTo: form.assignedTo, location: form.location } : {}),
        ...(form.movementType === 'RETURN' && form.location ? { location: form.location } : {}),
      });
      toast.success(res.message || 'Movement recorded');
      setRecordOpen(false);
      load(1);
      loadItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record movement');
    } finally {
      setSubmitting(false);
    }
  };

  // Item options for the two selects (search-filtered, capped for the dropdown)
  const itemOptions = (search: string) => {
    const q = search.trim().toLowerCase();
    const list = q
      ? items.filter(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
      : items;
    return list.slice(0, 60).map(i => ({
      value: i.id,
      label: `${i.name} · ${i.code} (${i.quantity} ${i.unit})`,
    }));
  };

  const columns: Column<Movement>[] = [
    { key: 'item', header: 'Item', defaultVisible: true, render: r => r.item ? (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {r.item.name}
        <span className="text-muted-foreground font-normal text-xs"> · {r.item.code}</span>
      </span>
    ) : '—', csvValue: r => r.item?.name || '' },
    { key: 'movementType', header: 'Type', defaultVisible: true, render: r => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${TYPE_TONES[r.movementType] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
        {TYPE_ICONS[r.movementType]}{r.movementType}
      </span>
    ), csvValue: r => r.movementType },
    { key: 'quantity', header: 'Qty', defaultVisible: true, align: 'right', render: r => (
      <span className={`font-semibold ${r.quantity < 0 ? 'text-red-600' : r.quantity > 0 ? 'text-emerald-600' : 'text-[var(--mc-text-primary)]'}`}>
        {r.quantity > 0 ? '+' : ''}{num(r.quantity)}
        {r.item?.unit && <span className="text-muted-foreground font-normal text-xs"> {r.item.unit}</span>}
      </span>
    ), csvValue: r => r.quantity },
    { key: 'createdAt', header: 'Date', defaultVisible: true, render: r => fmtDateTime(r.createdAt), csvValue: r => (r.createdAt ? r.createdAt.slice(0, 16).replace('T', ' ') : '') },
    { key: 'recordedByName', header: 'Recorded By', defaultVisible: true, csvValue: r => r.recordedByName || r.createdById || '', render: r => (
      <span className="text-xs text-[var(--mc-text-secondary)] inline-flex items-center gap-1 whitespace-nowrap">
        <User className="h-3 w-3 text-[var(--mc-primary)]" />
        {r.recordedByName || (r.createdById ? `${r.createdById.slice(0, 8)}…` : 'system')}
      </span>
    ) },
    { key: 'reference', header: 'Reference' },
    { key: 'notes', header: 'Notes' },
    { key: 'itemCode', header: 'Item Code', csvValue: r => r.item?.code || '' },
    { key: 'unit', header: 'Unit', csvValue: r => r.item?.unit || '' },
  ];

  const count = (t: string) => movements.filter(m => m.movementType === t).length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<ArrowLeftRight className="h-5 w-5" />}
        title="Movement Journal"
        subtitle="Every stock change is journaled — record movements manually and track who touched what"
        actions={
          <Button size="sm" className="gap-1" onClick={openRecord}>
            <Plus className="h-4 w-4" /> Record Movement
          </Button>
        }
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Movements" value={total} icon={<ArrowLeftRight className="h-5 w-5" />} accent="primary" />
          <StatCard label="Stock In" value={count('IN') + count('RETURN')} icon={<ArrowDownToLine className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Stock Out" value={count('OUT') + count('DISPOSE')} icon={<ArrowUpFromLine className="h-5 w-5" />} accent="danger" hint="this page" />
          <StatCard label="Assignments" value={count('ASSIGN')} icon={<ListFilter className="h-5 w-5" />} accent="secondary" hint="this page" />
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border bg-white p-4 flex flex-wrap items-end gap-3 no-print">
        <div className="w-64 space-y-1.5">
          <Field icon={<Search className="h-3.5 w-3.5" />} label="Filter by Item">
            <McInput value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Search items…" />
          </Field>
          <McSelect
            value={filterItemId || 'ALL'}
            onValueChange={v => setFilterItemId(v === 'ALL' ? '' : v)}
            options={[{ value: 'ALL', label: 'All items' }, ...itemOptions(itemSearch)]}
            placeholder="All items"
          />
        </div>
        <Field icon={<ListFilter className="h-3.5 w-3.5" />} label="Movement Type">
          <McSelect value={movementType || 'ALL'} onValueChange={v => setMovementType(v === 'ALL' ? '' : v)} options={[{ value: 'ALL', label: 'All types' }, ...MOVEMENT_TYPES.map(t => ({ value: t, label: t }))]} />
        </Field>
        <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="From">
          <McInput type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </Field>
        <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="To">
          <McInput type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </Field>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-9 gap-1" onClick={applyFilters}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Apply
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={clearFilters}>Clear</Button>
        </div>
      </div>

      <DataTable
        data={movements} columns={columns}
        rowKey={r => r.id} title="Inventory Movements" moduleLabel="Inventory Movement Journal"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
        toolbarExtra={<span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Negative quantities = stock out · ADJUSTMENT rows show the signed delta</span>}
      />

      {/* ── Record Movement modal ── */}
      <PremiumModal
        open={recordOpen} onOpenChange={setRecordOpen} size="md"
        title="Record Movement"
        icon={<ArrowLeftRight className="h-5 w-5" />}
        description="Adjust stock manually — the movement is journaled and the item quantity updates atomically"
        footerNote="Quantity can never drop below 0 — insufficient stock is rejected"
        submitLabel="Record Movement"
        onSubmit={submitMovement} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-4">
          {/* Item select with search */}
          <Field icon={<Boxes className="h-3.5 w-3.5" />} label="Item" hint={selectedItem ? `Current stock: ${selectedItem.quantity} ${selectedItem.unit} · reorder at ${selectedItem.reorderLevel}` : 'Search by name or code'}>
            <div className="space-y-2">
              <div className="relative">
                <McInput
                  value={recordItemSearch}
                  onChange={e => setRecordItemSearch(e.target.value)}
                  placeholder="Search items…"
                  className="pl-8"
                />
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
              <McSelect
                value={form.itemId}
                onValueChange={v => setForm(f => ({ ...f, itemId: v }))}
                options={itemOptions(recordItemSearch)}
                placeholder="Select an item…"
              />
            </div>
          </Field>

          {/* Movement type chips */}
          <Field icon={<ListFilter className="h-3.5 w-3.5" />} label="Movement Type">
            <div className="flex flex-wrap gap-2">
              {MOVEMENT_TYPES.map(t => {
                const active = form.movementType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, movementType: t }))}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                      active
                        ? `${TYPE_TONES[t]} shadow-sm scale-[1.03] ring-2 ring-offset-1 ring-[var(--mc-primary)]`
                        : 'bg-white text-[var(--mc-text-secondary)] border-[var(--mc-divider)] hover:bg-[var(--mc-primary-light)]'
                    }`}
                  >
                    {TYPE_ICONS[t]}{t}
                  </button>
                );
              })}
            </div>
          </Field>
          <p className="text-[11px] text-muted-foreground -mt-2">
            IN adds · RETURN adds back (clears assignment) · OUT / ASSIGN / DISPOSE subtract · ADJUSTMENT applies a signed delta
          </p>

          {/* Quantity & notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={<Hash className="h-3.5 w-3.5" />} label={form.movementType === 'ADJUSTMENT' ? 'Delta (± qty)' : 'Quantity'}>
              <McInput
                type="number" step="1"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder={form.movementType === 'ADJUSTMENT' ? 'e.g. -5 or +10' : 'e.g. 10'}
              />
            </Field>
            {selectedItem && (
              <Field icon={<Package className="h-3.5 w-3.5" />} label="Resulting Stock">
                <div className="h-9 px-3 rounded-lg border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] flex items-center gap-2 text-sm">
                  {(() => {
                    const qty = parseInt(form.quantity) || 0;
                    const delta = ['OUT', 'ASSIGN', 'DISPOSE'].includes(form.movementType) ? -Math.abs(qty) : qty;
                    const newQty = selectedItem.quantity + delta;
                    return (
                      <>
                        <span className="text-muted-foreground">{selectedItem.quantity}</span>
                        <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                        <span className={newQty < 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>{newQty}</span>
                        <span className="text-muted-foreground text-xs">{selectedItem.unit}</span>
                        {newQty < 0 && <span className="text-[10px] text-red-600 font-semibold ml-auto">insufficient!</span>}
                      </>
                    );
                  })()}
                </div>
              </Field>
            )}
          </div>

          {/* ASSIGN extras */}
          {form.movementType === 'ASSIGN' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
              <Field icon={<User className="h-3.5 w-3.5" />} label="Assign To" hint="employee id/name — required">
                <McInput
                  value={form.assignedTo}
                  onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                  placeholder="Nurse Amina / employee id"
                />
              </Field>
              <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
                <McInput
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Ward 3 / MCH Clinic"
                />
              </Field>
            </div>
          )}
          {form.movementType === 'RETURN' && (
            <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Return Location (optional)" hint="RETURN clears the assignment — the item goes back to the store">
              <McInput
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Store B, Rack 2"
              />
            </Field>
          )}

          <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Notes">
            <McInput
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Reason / reference (GRN no., ward restock…)"
            />
          </Field>

          {selectedItem && selectedItem.quantity <= selectedItem.reorderLevel && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
              <ClipboardList className="h-3.5 w-3.5 shrink-0" />
              {selectedItem.name} is at/below its reorder level ({selectedItem.reorderLevel} {selectedItem.unit}) — consider restocking.
            </div>
          )}
        </div>
      </PremiumModal>
    </div>
  );
}
