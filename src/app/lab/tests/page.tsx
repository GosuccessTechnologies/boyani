'use client';

/**
 * LAB TEST CATALOG — Instruction 24.
 * GET /api/lab-tests syncs the catalog from Facility Services
 * (Service.category=LABORATORY) so pricing always matches the facility
 * price list. Read-only for LAB_TECH; ADMIN can edit the lab-managed
 * fields (specimen, turnaround, reference range, category) via PUT.
 */

import * as React from 'react';
import {
  BookOpen, Search, RefreshCw, FlaskConical, Clock3, TestTube2, Tag, Banknote,
  ShieldCheck, Pencil, Gauge, Link2, Activity,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, PageHeading, Field, FormSection, SkeletonCards, McInput, McSelect } from '@/app/clinical/_lib';
import { useAuthStore } from '@/stores/auth-store';

interface LabTestRow {
  id: string;
  code: string;
  name: string;
  category: string;
  specimenType: string;
  turnaroundHours: number;
  referenceRange: string;
  isActive?: boolean;
  service?: { code?: string; name?: string; price: number; shaCovered?: boolean; isActive?: boolean } | null;
}

const SPECIMENS = ['Blood', 'Serum', 'Plasma', 'Urine', 'Stool', 'Sputum', 'Swab', 'CSF', 'Synovial Fluid', 'Tissue', 'Saliva', 'Aspirate'];
const CATEGORIES = ['HEMATOLOGY', 'CHEMISTRY', 'MICROBIOLOGY', 'PARASITOLOGY', 'URINALYSIS', 'SEROLOGY', 'CYTOLOGY', 'POCT'];

export default function LabTestsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [rows, setRows] = React.useState<LabTestRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [syncedCount, setSyncedCount] = React.useState<number | null>(null);

  // ADMIN edit modal (lab-managed fields only — prices live on the linked Service)
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LabTestRow | null>(null);
  const [form, setForm] = React.useState({ specimenType: 'Blood', turnaroundHours: '24', referenceRange: '', category: 'HEMATOLOGY' });
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ labTests: LabTestRow[]; syncedFromServices?: number }>('/api/lab-tests?perPage=300');
      setRows(res.labTests || []);
      setSyncedCount(typeof res.syncedFromServices === 'number' ? res.syncedFromServices : null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load test catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const categories = Array.from(new Set(rows.map(r => r.category).filter(Boolean))).sort();

  const filtered = rows.filter(r => {
    if (category && r.category !== category) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.specimenType.toLowerCase().includes(q) ||
        (r.referenceRange || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openEdit = (t: LabTestRow) => {
    setEditing(t);
    setForm({
      specimenType: t.specimenType || 'Blood',
      turnaroundHours: String(t.turnaroundHours ?? 24),
      referenceRange: t.referenceRange || '',
      category: t.category || 'HEMATOLOGY',
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editing) return;
    setSubmitting(true);
    try {
      const res = await apiPut<{ message: string }>('/api/lab-tests', {
        id: editing.id,
        specimenType: form.specimenType,
        turnaroundHours: form.turnaroundHours,
        referenceRange: form.referenceRange,
        category: form.category,
      });
      toast.success(res.message || 'Test updated');
      setEditOpen(false);
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update test');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<LabTestRow>[] = [
    {
      key: 'code', header: 'Code', defaultVisible: true,
      render: r => (
        <span className="font-mono text-xs font-semibold text-[var(--mc-primary)]">{r.code}</span>
      ),
    },
    {
      key: 'name', header: 'Test Name', defaultVisible: true,
      render: r => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--mc-text-primary)] truncate">{r.name}</p>
          {r.isActive === false && <span className="text-[10px] text-red-600 font-semibold">inactive</span>}
        </div>
      ),
    },
    {
      key: 'price', header: 'Price', defaultVisible: true, align: 'right',
      csvValue: r => r.service?.price ?? 0,
      render: r => (
        <div className="text-right">
          <p className="text-sm font-bold text-[var(--mc-text-primary)]">{r.service ? kes(r.service.price) : '—'}</p>
          {r.service?.shaCovered && <span className="text-[10px] text-emerald-600 font-semibold">SHA covered</span>}
        </div>
      ),
    },
    {
      key: 'category', header: 'Category', defaultVisible: true,
      render: r => <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">{r.category}</span>,
    },
    {
      key: 'turnaroundHours', header: 'Turnaround', sortable: true, align: 'right',
      csvValue: r => r.turnaroundHours,
      render: r => <span className="text-xs whitespace-nowrap"><Clock3 className="inline h-3.5 w-3.5 mr-1 text-[var(--mc-primary)]" />{r.turnaroundHours}h</span>,
    },
    {
      key: 'specimenType', header: 'Specimen',
      render: r => <span className="text-xs"><TestTube2 className="inline h-3.5 w-3.5 mr-1 text-[var(--mc-primary)]" />{r.specimenType || '—'}</span>,
    },
    {
      key: 'referenceRange', header: 'Reference Range',
      render: r => <span className="text-xs text-muted-foreground">{r.referenceRange || '—'}</span>,
    },
    {
      key: 'service', header: 'Linked Service',
      render: r => r.service ? (
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Link2 className="h-3 w-3 text-emerald-600" />{r.service.code || r.service.name}
        </span>
      ) : <span className="text-[11px] text-red-500">unlinked</span>,
    },
  ];

  const actions: ActionBtn[] = isAdmin
    ? [{ icon: <Pencil className="h-4 w-4" />, title: 'Edit specimen / turnaround', variant: 'edit', onClick: openEdit }]
    : [];

  const avgTurnaround = rows.length ? Math.round(rows.reduce((s, r) => s + (r.turnaroundHours || 0), 0) / rows.length) : 0;
  const activeCount = rows.filter(r => r.isActive !== false).length;
  const shaCount = rows.filter(r => r.service?.shaCovered).length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<BookOpen className="h-5 w-5" />}
        title="Test Catalog"
        subtitle="Laboratory test menu — synced from the facility services & pricing list"
        actions={
          <Button size="sm" variant="outline" className="gap-1" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Re-sync
          </Button>
        }
      />

      {/* Synced-from-services badge */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          <ShieldCheck className="h-3.5 w-3.5" />
          Synced from Facility Services{syncedCount !== null ? ` — ${syncedCount} LABORATORY services` : ''}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--mc-primary-light)] border border-[var(--mc-divider)] text-[var(--mc-primary-dark)] text-xs font-semibold">
          <Banknote className="h-3.5 w-3.5" /> Prices managed on the linked service
        </span>
      </div>

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Catalog Tests" value={activeCount} icon={<FlaskConical className="h-5 w-5" />} accent="primary" hint={`of ${rows.length} synced`} />
          <StatCard label="Categories" value={categories.length} icon={<Tag className="h-5 w-5" />} accent="secondary" />
          <StatCard label="Avg Turnaround" value={`${avgTurnaround}h`} icon={<Clock3 className="h-5 w-5" />} accent="tertiary" />
          <StatCard label="SHA Covered" value={shaCount} icon={<Activity className="h-5 w-5" />} accent="success" hint="insurance billable" />
        </div>
      )}

      {/* Search + category filter */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <div className="relative flex-1 min-w-[220px]">
          <McInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tests by name, code, specimen or reference range…"
            className="pl-8"
          />
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <div className="w-52">
          <McSelect
            value={category || 'ALL'}
            onValueChange={v => setCategory(v === 'ALL' ? '' : v)}
            options={[{ value: 'ALL', label: 'All categories' }, ...categories.map(c => ({ value: c, label: c }))]}
            placeholder="All categories"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setSearch(''); setCategory(''); }}>Reset</Button>
      </div>

      <DataTable
        data={filtered} columns={columns} actions={actions}
        rowKey={r => r.id} title="Lab Test Catalog" moduleLabel="Lab Test Catalog"
        loading={loading} emptyMessage="No lab tests match your filters"
      />

      <p className="text-xs text-muted-foreground flex items-center gap-1.5 no-print">
        <Banknote className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
        {isAdmin
          ? 'Read-only for LAB_TECH — you can edit specimen, turnaround and reference range; prices are configured on the facility service (Facility Management → Services & Pricing).'
          : 'Read-only for LAB_TECH — test prices and turnaround are configured by Facility Management (ADMIN) on the linked billable service.'}
      </p>

      {/* ADMIN edit — lab-managed fields only */}
      {isAdmin && (
        <PremiumModal
          open={editOpen} onOpenChange={setEditOpen} size="md"
          title={editing ? `Edit Test — ${editing.code}` : ''}
          icon={<FlaskConical className="h-5 w-5" />}
          description={editing ? `${editing.name} · price ${editing.service ? kes(editing.service.price) : '—'} (managed on the linked service)` : ''}
          footerNote="Specimen, turnaround and reference range are lab-managed; the price stays on the facility service"
          submitLabel="Save Changes" onSubmit={submitEdit}
          submitting={submitting} secondaryLabel="Cancel"
        >
          {editing && (
            <div className="space-y-5">
              <FormSection n={1} title="Lab Configuration">
                <Field icon={<TestTube2 className="h-3.5 w-3.5" />} label="Specimen Type">
                  <McSelect
                    value={form.specimenType}
                    onValueChange={v => setForm(f => ({ ...f, specimenType: v }))}
                    options={SPECIMENS.map(s => ({ value: s, label: s }))}
                  />
                </Field>
                <Field icon={<Clock3 className="h-3.5 w-3.5" />} label="Turnaround (hours)">
                  <McInput
                    type="number" min="1"
                    value={form.turnaroundHours}
                    onChange={e => setForm(f => ({ ...f, turnaroundHours: e.target.value }))}
                  />
                </Field>
                <Field icon={<Tag className="h-3.5 w-3.5" />} label="Lab Department / Category">
                  <McSelect
                    value={form.category}
                    onValueChange={v => setForm(f => ({ ...f, category: v }))}
                    options={CATEGORIES.map(c => ({ value: c, label: c }))}
                  />
                </Field>
                <Field icon={<Gauge className="h-3.5 w-3.5" />} label="Reference Range">
                  <McInput
                    value={form.referenceRange}
                    onChange={e => setForm(f => ({ ...f, referenceRange: e.target.value }))}
                    placeholder="e.g. 12.0–15.5 g/dL"
                  />
                </Field>
              </FormSection>
              <div className="rounded-xl border border-[var(--mc-divider)] p-3 bg-[var(--mc-bg-card)] text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 font-semibold text-[var(--mc-text-secondary)] mb-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Facility-linked test
                </p>
                Name, code, price and SHA coverage are refreshed from the linked service on every catalog sync. Only the fields above are stored on the lab record.
              </div>
            </div>
          )}
        </PremiumModal>
      )}
    </div>
  );
}
