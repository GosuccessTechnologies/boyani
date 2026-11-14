'use client';

/**
 * INVENTORY DASHBOARD — Instruction 25 premium pass.
 * KPI stat cards (totalItems, lowStock, assignedItems, stock value) +
 * a category stock-value distribution PieChart (recharts) on the
 * mc-chart-panel background + quick links. Managers get the facility-wide
 * picture; staff see their assigned items (API-scoped).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Boxes, AlertTriangle, ClipboardList, Banknote, ArrowRight,
  RefreshCw, PieChart as PieIcon, Package, TrendingUp,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { StatCard } from '@/components/shared/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/client-api';
import { useAuthStore } from '@/stores/auth-store';
import { kes, num, PageHeading } from '@/app/ops/_lib';

interface CategoryCount { name: string; count: number }
interface InventoryKpis {
  totalItems: number;
  lowStock: number;
  assignedItems: number;
  totalValue: number;
  categories: CategoryCount[];
}

interface Item {
  id: string; code: string; name: string; category: string;
  quantity: number; unit: string; unitCost: number; reorderLevel: number;
  assignedTo: string; isActive: boolean;
}
interface ItemsResp { items: Item[]; total: number; page: number; perPage: number; totalPages: number }

const PIE_COLORS = ['#0d9488', '#0891b2', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

export default function InventoryDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [kpis, setKpis] = React.useState<InventoryKpis | null>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [dash, itemsRes] = await Promise.all([
        apiGet<{ kpis: InventoryKpis }>('/api/dashboard?portal=inventory'),
        (async () => {
          let collected: Item[] = [];
          let p = 1;
          for (;;) {
            const res = await apiGet<ItemsResp>(`/api/inventory?page=${p}&perPage=100`);
            collected = collected.concat(res.items || []);
            const tp = res.totalPages || 1;
            if (p >= tp || p > 10) break; // hard stop at 1000 items
            p++;
          }
          return collected;
        })().catch(() => [] as Item[]),
      ]);
      setKpis(dash.kpis);
      setItems(itemsRes);
    } catch {
      setKpis({ totalItems: 0, lowStock: 0, assignedItems: 0, totalValue: 0, categories: [] });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const canManage = user?.role === 'ADMIN' || user?.role === 'INVENTORY';

  // Stock value per category (unit cost × qty) from the items list
  const categoryValue = React.useMemo(() => {
    const map: Record<string, { name: string; value: number; count: number }> = {};
    for (const i of items) {
      const key = i.category || 'GENERAL';
      if (!map[key]) map[key] = { name: key.replaceAll('_', ' '), value: 0, count: 0 };
      map[key].value += (i.unitCost || 0) * (i.quantity || 0);
      map[key].count += 1;
    }
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [items]);

  const trueStockValue = categoryValue.reduce((s, c) => s + c.value, 0);
  const lowStockItems = items.filter(i => i.quantity <= i.reorderLevel).slice(0, 6);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<LayoutDashboard className="h-5 w-5" />}
        title="Inventory Dashboard"
        subtitle={canManage ? 'Assets & consumables overview — full facility view' : 'Your assigned items overview'}
        actions={
          <Button size="sm" variant="outline" className="gap-1" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {loading || !kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Items" value={kpis.totalItems} icon={<Boxes className="h-5 w-5" />} accent="primary" onClick={() => router.push('/inventory/items')} />
          <StatCard label="Low Stock" value={kpis.lowStock} icon={<AlertTriangle className="h-5 w-5" />} accent="warning" hint="at/below reorder" onClick={() => router.push('/inventory/items?lowStock=1')} />
          <StatCard label="Assigned Items" value={kpis.assignedItems} icon={<ClipboardList className="h-5 w-5" />} accent="secondary" onClick={() => router.push('/inventory/assignments')} />
          <StatCard label="Stock Value" value={kes(trueStockValue || kpis.totalValue)} icon={<Banknote className="h-5 w-5" />} accent="success" hint="unit cost × qty" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Category stock-value pie chart */}
        <div className="rounded-xl border mc-chart-panel p-4 lg:col-span-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-white/80 text-[var(--mc-primary)] flex items-center justify-center shrink-0">
                <PieIcon className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Stock Value by Category</h2>
                <p className="text-[11px] text-muted-foreground">unit cost × quantity on hand (KSh)</p>
              </div>
            </div>
            <button className="text-xs text-[var(--mc-primary)] flex items-center gap-1 no-print" onClick={() => router.push('/inventory/items')}>
              View items <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {loading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : categoryValue.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center">No items yet — register inventory to see the distribution.</p>
          ) : (
            <ResponsiveContainer width="100%" height={264}>
              <PieChart>
                <Pie
                  data={categoryValue}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {categoryValue.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number | string, n: string) => [kes(Number(v)), n]}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Low stock watchlist */}
        <div className="rounded-xl border bg-white p-4 lg:col-span-2 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Low-stock Watchlist</h2>
              <p className="text-[11px] text-muted-foreground">at/below reorder level</p>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>
          ) : lowStockItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 flex-1 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-600 mr-1.5" /> All stock levels are healthy.</p>
          ) : (
            <div className="space-y-1.5 flex-1">
              {lowStockItems.map(i => (
                <div key={i.id} className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/70 px-2.5 py-2">
                  <Package className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--mc-text-primary)] truncate">{i.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{i.code}</p>
                  </div>
                  <span className="text-[11px] font-bold text-amber-700 whitespace-nowrap">
                    {num(i.quantity)}/{i.reorderLevel} {i.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
          {canManage && (
            <Button variant="outline" size="sm" className="mt-3 gap-1 no-print" onClick={() => router.push('/inventory/items?lowStock=1')}>
              <Boxes className="h-3.5 w-3.5" /> Open low-stock items
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
