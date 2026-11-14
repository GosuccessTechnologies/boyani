'use client';

/**
 * INVENTORY ASSIGNMENTS — Instruction 25: cleaner premium cards.
 * Items where assignedTo is set, rendered as a responsive card grid
 * (identity, holder, location, condition, stock & value). STAFF see
 * their own assigned items (API scopes non-managers); ADMIN/INVENTORY
 * re-assign / update condition via the PremiumModal (PUT /api/inventory).
 */

import * as React from 'react';
import {
  ClipboardList, Box, MapPin, Wrench, Pencil, User, Package, Search, Banknote,
  Boxes, CheckCircle2, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, num, Field, FormSection, StatusBadge, PageHeading, McInput, McTextarea, McSelect } from '@/app/ops/_lib';
import { useAuthStore } from '@/stores/auth-store';

interface Item {
  id: string; code: string; name: string; category: string; sku: string;
  quantity: number; unit: string; unitCost: number; unitPrice: number; reorderLevel: number;
  assignedTo: string; location: string; supplier: string; condition: string;
  notes: string; isActive: boolean; createdAt: string;
}
interface ItemsResp { items: Item[]; total: number; page: number; perPage: number; totalPages: number }

const CONDITIONS = ['GOOD', 'FAIR', 'DAMAGED', 'UNDER_REPAIR'];

const CONDITION_RING: Record<string, string> = {
  GOOD: 'border-emerald-200 bg-emerald-50/60',
  FAIR: 'border-amber-200 bg-amber-50/60',
  DAMAGED: 'border-red-200 bg-red-50/60',
  UNDER_REPAIR: 'border-sky-200 bg-sky-50/60',
};

export default function InventoryAssignmentsPage() {
  const { user } = useAuthStore();
  const canManage = user?.role === 'ADMIN' || user?.role === 'INVENTORY';

  const [allItems, setAllItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');

  const [reassigning, setReassigning] = React.useState<Item | null>(null);
  const [form, setForm] = React.useState({ assignedTo: '', location: '', condition: 'GOOD', notes: '' });
  const [submitting, setSubmitting] = React.useState(false);

  // Load every page (managers: whole facility; staff: API-scoped own items)
  const load = React.useCallback(async () => {
    setLoading(true);
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
      setAllItems(collected);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const assigned = React.useMemo(
    () => allItems.filter(i => i.assignedTo && i.assignedTo.trim() !== ''),
    [allItems],
  );
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assigned;
    return assigned.filter(i =>
      i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
      || i.assignedTo.toLowerCase().includes(q) || i.location.toLowerCase().includes(q),
    );
  }, [assigned, search]);

  const openReassign = (i: Item) => {
    setReassigning(i);
    setForm({
      assignedTo: i.assignedTo || '', location: i.location || '',
      condition: i.condition || 'GOOD', notes: i.notes || '',
    });
  };

  const submit = async () => {
    if (!reassigning) return;
    setSubmitting(true);
    try {
      const res = await apiPut<{ message: string }>('/api/inventory', {
        id: reassigning.id,
        assignedTo: form.assignedTo,
        location: form.location,
        condition: form.condition,
        notes: form.notes,
      });
      toast.success(res.message || `Assignment updated for ${reassigning.code}`);
      setReassigning(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const goodCount = assigned.filter(i => i.condition === 'GOOD').length;
  const attentionCount = assigned.filter(i => i.condition === 'DAMAGED' || i.condition === 'UNDER_REPAIR').length;
  const totalValue = assigned.reduce((s, i) => s + i.unitCost * i.quantity, 0);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<ClipboardList className="h-5 w-5" />}
        title="Assigned Items"
        subtitle={canManage
          ? 'All items currently assigned to staff/wards — re-assign or update condition'
          : 'Items assigned to you — read-only (contact inventory management for changes)'}
        actions={
          <Button size="sm" variant="outline" className="gap-1" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Assigned Items" value={assigned.length} icon={<ClipboardList className="h-5 w-5" />} accent="primary" />
          <StatCard label="Good Condition" value={goodCount} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
          <StatCard label="Needs Attention" value={attentionCount} icon={<Wrench className="h-5 w-5" />} accent="warning" hint="damaged / repair" />
          <StatCard label="Assigned Value" value={kes(totalValue)} icon={<Banknote className="h-5 w-5" />} accent="secondary" hint="unit cost basis" />
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm no-print">
        <McInput
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by item, code, holder or location…"
          className="pl-8"
        />
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center">
          <Boxes className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-semibold text-[var(--mc-text-primary)]">No assigned items{search ? ' match your search' : ''}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {canManage ? 'Assign items via the Movements journal (ASSIGN) or the items page.' : 'Items assigned to you will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(i => (
            <div
              key={i.id}
              className={`rounded-2xl border p-4 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col gap-3 ${CONDITION_RING[i.condition] || CONDITION_RING.GOOD}`}
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl mc-gradient-primary flex items-center justify-center text-white shrink-0">
                  <Box className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[var(--mc-text-primary)] truncate" title={i.name}>{i.name}</p>
                  <p className="text-[11px] font-mono text-[var(--mc-primary)]">{i.code}{i.sku ? ` · ${i.sku}` : ''}</p>
                </div>
                <StatusBadge status={i.condition} />
              </div>

              {/* Holder */}
              <div className="rounded-xl bg-white/80 border border-[var(--mc-divider)] p-2.5 space-y-1.5 text-xs">
                <p className="flex items-center gap-1.5 text-[var(--mc-text-secondary)]">
                  <User className="h-3.5 w-3.5 text-[var(--mc-primary)] shrink-0" />
                  <span className="font-semibold text-[var(--mc-text-primary)] truncate">{i.assignedTo}</span>
                </p>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-[var(--mc-primary)] shrink-0" />
                  {i.location || '—'}
                </p>
              </div>

              {/* Stock & value row */}
              <div className="flex items-center gap-2 text-[11px]">
                <span className={`px-2 py-1 rounded-lg border font-semibold ${i.quantity <= i.reorderLevel ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] border-transparent'}`}>
                  <Package className="inline h-3 w-3 mr-1" />{num(i.quantity)} {i.unit}
                </span>
                <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                  {kes(i.unitCost * i.quantity)}
                </span>
                {i.quantity <= i.reorderLevel && (
                  <span className="ml-auto inline-flex items-center gap-1 text-amber-700 font-bold">
                    <AlertTriangle className="h-3 w-3" /> low
                  </span>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-2 mt-auto pt-1">
                <span className="text-[11px] text-muted-foreground truncate flex-1">{i.category.replaceAll('_', ' ')}</span>
                {canManage && (
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => openReassign(i)}>
                    <Pencil className="h-3 w-3" /> Re-assign
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && !loading && assigned.length > 0 && (
        <div className="rounded-xl border bg-white p-4 no-print">
          <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-2 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[var(--mc-primary)]" /> Managing Assignments
          </h2>
          <p className="text-xs text-muted-foreground">
            Use <b>Re-assign</b> on any card to change the holder, move its location or update its condition.
            Stock-taking assignments are journaled in the Movements journal (ASSIGN / RETURN).
          </p>
        </div>
      )}

      {/* Re-assign modal */}
      {canManage && (
        <PremiumModal
          open={!!reassigning} onOpenChange={o => { if (!o) setReassigning(null); }} size="md"
          title={reassigning ? `Re-assign — ${reassigning.name}` : ''}
          icon={<User className="h-5 w-5" />}
          description={reassigning ? `${reassigning.code} · currently ${reassigning.assignedTo || 'unassigned'}` : ''}
          footerNote="Clearing Assigned To returns the item to the store"
          submitLabel="Save Assignment"
          onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
        >
          {reassigning && (
            <div className="space-y-5">
              <FormSection n={1} title="Item">
                <Field icon={<Box className="h-3.5 w-3.5" />} label="Item">
                  <p className="text-sm font-medium text-[var(--mc-text-primary)]">{reassigning.name} ({reassigning.code})</p>
                </Field>
                <Field icon={<Package className="h-3.5 w-3.5" />} label="Stock">
                  <p className="text-sm text-[var(--mc-text-secondary)]">{num(reassigning.quantity)} {reassigning.unit} · {kes(reassigning.unitCost)} each</p>
                </Field>
              </FormSection>
              <FormSection n={2} title="Assignment">
                <Field icon={<User className="h-3.5 w-3.5" />} label="Assigned To" hint="employee id/name — blank = back to store">
                  <McInput value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="employee id or name" />
                </Field>
                <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
                  <McInput value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Ward 4 / MCH Clinic" />
                </Field>
                <Field icon={<Wrench className="h-3.5 w-3.5" />} label="Condition">
                  <McSelect value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))} options={CONDITIONS.map(c => ({ value: c, label: c.replaceAll('_', ' ') }))} />
                </Field>
                <Field icon={<ClipboardList className="h-3.5 w-3.5" />} label="Notes" className="sm:col-span-2">
                  <McTextarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Handover condition, accessories…" />
                </Field>
              </FormSection>
            </div>
          )}
        </PremiumModal>
      )}
    </div>
  );
}
