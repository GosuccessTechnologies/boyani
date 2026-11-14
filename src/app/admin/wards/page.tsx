'use client';

/**
 * WARDS & BEDS — ward catalog (dailyRate = ADMIN only) + per-ward bed view.
 * DataTable of /api/wards + PremiumModal ward form + secondary beds panel
 * (GET /api/beds?wardId=) with add-bed modal.
 */

import * as React from 'react';
import {
  BedDouble, AlignLeft, Tag, Banknote, Building, Users, Eye, Pencil, Trash2, Plus, Hash, DoorOpen, Armchair, StickyNote,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, Field, FormSection, ConfirmModal, BoolPill, StatusBadge, PageHeading, SkeletonCards, McInput, McTextarea } from '../_lib';

interface Ward {
  id: string; name: string; code: string; wardType: string; gender: string;
  dailyRate: number; floor: string; description: string; isActive: boolean;
  _count?: { beds: number };
}
interface Bed {
  id: string; bedNumber: string; wardId: string; status: string; notes: string;
  ward?: { name: string; code: string; wardType: string; dailyRate: number };
}

const WARD_TYPES = ['GENERAL', 'SEMI_PRIVATE', 'PRIVATE', 'EXECUTIVE', 'ICU', 'HDU', 'ISOLATION', 'PEDIATRIC', 'NEONATAL', 'MATERNITY', 'BARIATRIC', 'ORTHOPEDIC'];
const GENDERS = ['MALE', 'FEMALE', 'MIXED'];
const BED_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'];

const emptyWard = { name: '', code: '', wardType: 'GENERAL', gender: 'MIXED', dailyRate: '', floor: '', description: '' };
const emptyBed = { bedNumber: '', status: 'AVAILABLE', notes: '' };

export default function WardsPage() {
  const [wards, setWards] = React.useState<Ward[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Ward | null>(null);
  const [form, setForm] = React.useState({ ...emptyWard });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Ward | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  // Beds secondary view
  const [selectedWard, setSelectedWard] = React.useState<Ward | null>(null);
  const [beds, setBeds] = React.useState<Bed[]>([]);
  const [bedsLoading, setBedsLoading] = React.useState(false);
  const [bedModalOpen, setBedModalOpen] = React.useState(false);
  const [bedForm, setBedForm] = React.useState({ ...emptyBed });
  const [bedSubmitting, setBedSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ wards: Ward[] }>('/api/wards?perPage=100');
      setWards(res.wards || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load wards');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const loadBeds = React.useCallback(async (wardId: string) => {
    setBedsLoading(true);
    try {
      const res = await apiGet<{ beds: Bed[] }>(`/api/beds?wardId=${wardId}&perPage=200`);
      setBeds(res.beds || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load beds');
    } finally {
      setBedsLoading(false);
    }
  }, []);

  const viewBeds = (w: Ward) => {
    setSelectedWard(w);
    loadBeds(w.id);
    setTimeout(() => document.getElementById('beds-panel')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const openCreate = () => { setEditing(null); setForm({ ...emptyWard }); setModalOpen(true); };
  const openEdit = (w: Ward) => {
    setEditing(w);
    setForm({
      name: w.name, code: w.code, wardType: w.wardType, gender: w.gender,
      dailyRate: String(w.dailyRate ?? ''), floor: w.floor || '', description: w.description || '',
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Ward name is required'); return; }
    if (form.dailyRate === '' || isNaN(Number(form.dailyRate))) { toast.error('Enter a valid daily rate'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(), code: form.code.trim() || undefined, wardType: form.wardType,
        gender: form.gender, dailyRate: Number(form.dailyRate), floor: form.floor, description: form.description,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/wards', payload)
        : await apiPost<{ message: string }>('/api/wards', payload);
      toast.success(res.message || (editing ? 'Ward updated' : 'Ward created'));
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save ward');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/wards?id=${deleting.id}`);
      toast.success(res.message || 'Ward deleted');
      if (selectedWard?.id === deleting.id) { setSelectedWard(null); setBeds([]); }
      setConfirmOpen(false);
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const submitBed = async () => {
    if (!selectedWard) return;
    if (!bedForm.bedNumber.trim()) { toast.error('Bed number is required'); return; }
    setBedSubmitting(true);
    try {
      const res = await apiPost<{ message: string }>('/api/beds', {
        bedNumber: bedForm.bedNumber.trim(), wardId: selectedWard.id,
        status: bedForm.status, notes: bedForm.notes,
      });
      toast.success(res.message || 'Bed added');
      setBedModalOpen(false);
      setBedForm({ ...emptyBed });
      loadBeds(selectedWard.id);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add bed');
    } finally {
      setBedSubmitting(false);
    }
  };

  const columns: Column<Ward>[] = [
    { key: 'name', header: 'Ward', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {r.name}<span className="text-muted-foreground font-normal text-xs"> · {r.code}</span>
      </span>
    ) },
    { key: 'wardType', header: 'Type', defaultVisible: true, render: r => <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]">{r.wardType.replaceAll('_', ' ')}</span> },
    { key: 'dailyRate', header: 'Daily Rate', defaultVisible: true, align: 'right', render: r => <span className="font-semibold">{kes(r.dailyRate)}</span>, csvValue: r => r.dailyRate },
    { key: 'beds', header: 'Beds', defaultVisible: true, align: 'right', csvValue: r => r._count?.beds ?? 0, render: r => <span className="font-semibold">{r._count?.beds ?? 0}</span> },
    { key: 'gender', header: 'Gender' },
    { key: 'floor', header: 'Floor' },
    { key: 'isActive', header: 'Status', render: r => <BoolPill value={r.isActive} trueLabel="Active" falseLabel="Inactive" />, csvValue: r => (r.isActive ? 'ACTIVE' : 'INACTIVE') },
    { key: 'description', header: 'Description' },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View beds', variant: 'view', onClick: viewBeds },
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit ward', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete ward', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const bedColumns: Column<Bed>[] = [
    { key: 'bedNumber', header: 'Bed No.', defaultVisible: true, render: r => <span className="font-semibold text-[var(--mc-text-primary)]">{r.bedNumber}</span> },
    { key: 'status', header: 'Status', defaultVisible: true, render: r => <StatusBadge status={r.status} /> },
    { key: 'ward', header: 'Ward Rate', defaultVisible: true, align: 'right', csvValue: r => r.ward?.dailyRate ?? 0, render: r => <span>{kes(r.ward?.dailyRate ?? 0)}</span> },
    { key: 'notes', header: 'Notes', defaultVisible: true },
  ];

  const totalBeds = wards.reduce((s, w) => s + (w._count?.beds || 0), 0);
  const avgRate = wards.length ? wards.reduce((s, w) => s + (w.dailyRate || 0), 0) / wards.length : 0;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<BedDouble className="h-5 w-5" />}
        title="Wards & Beds"
        subtitle="Nursing units and bed inventory — daily rates are set by ADMIN only"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Ward</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Wards" value={wards.length} icon={<BedDouble className="h-5 w-5" />} accent="primary" />
          <StatCard label="Total Beds" value={totalBeds} icon={<Armchair className="h-5 w-5" />} accent="tertiary" />
          <StatCard label="Avg Daily Rate" value={kes(avgRate)} icon={<Banknote className="h-5 w-5" />} accent="success" />
          <StatCard label="Ward Types" value={new Set(wards.map(w => w.wardType)).size} icon={<Building className="h-5 w-5" />} accent="secondary" />
        </div>
      )}

      <DataTable
        data={wards} columns={columns} actions={actions}
        rowKey={r => r.id} title="Wards" moduleLabel="Wards & Beds"
        loading={loading}
      />

      {/* ── Secondary beds view ── */}
      <div id="beds-panel" className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
            <DoorOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">
              {selectedWard ? `Beds — ${selectedWard.name} (${selectedWard.code})` : 'Beds'}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {selectedWard ? `${selectedWard.wardType.replaceAll('_', ' ')} · ${selectedWard.gender} · ${kes(selectedWard.dailyRate)}/day` : 'Select the eye icon on a ward row to list its beds'}
            </p>
          </div>
          {selectedWard && (
            <Button size="sm" className="gap-1" onClick={() => { setBedForm({ ...emptyBed }); setBedModalOpen(true); }}>
              <Plus className="h-4 w-4" /> Add Bed
            </Button>
          )}
        </div>
        {selectedWard ? (
          <DataTable
            data={beds} columns={bedColumns}
            rowKey={r => r.id} title={`Beds — ${selectedWard.name}`}
            moduleLabel={`Beds — ${selectedWard.name}`}
            loading={bedsLoading}
            emptyMessage="No beds in this ward yet — add the first one"
          />
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">No ward selected.</p>
        )}
      </div>

      {/* Ward form modal */}
      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen}
        title={editing ? 'Edit Ward' : 'New Ward'}
        icon={<BedDouble className="h-5 w-5" />}
        description={editing ? `${editing.name} — daily-rate changes are audit-logged` : 'Create a nursing unit'}
        footerNote="Daily bed rates are a pricing decision restricted to administrators"
        submitLabel={editing ? 'Update Ward' : 'Create Ward'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Ward Details">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Ward Name">
              <McInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Female Medical Ward" />
            </Field>
            <Field icon={<Hash className="h-3.5 w-3.5" />} label="Ward Code" hint={editing ? 'unique — changing may clash' : 'auto-generated when blank'}>
              <McInput value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="WRD-…" />
            </Field>
            <Field icon={<Tag className="h-3.5 w-3.5" />} label="Ward Type">
              <Select value={form.wardType} onValueChange={v => setForm(f => ({ ...f, wardType: v }))}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{WARD_TYPES.map(t => <SelectItem key={t} value={t}>{t.replaceAll('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field icon={<Users className="h-3.5 w-3.5" />} label="Gender Policy">
              <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field icon={<Banknote className="h-3.5 w-3.5" />} label="Daily Rate (KSh)" hint="charged per bed-day to inpatient visits">
              <McInput type="number" min="0" step="0.01" value={form.dailyRate} onChange={e => setForm(f => ({ ...f, dailyRate: e.target.value }))} placeholder="3500" />
            </Field>
            <Field icon={<Building className="h-3.5 w-3.5" />} label="Floor / Block">
              <McInput value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} placeholder="Block B — Floor 2" />
            </Field>
          </FormSection>
          <FormSection n={2} title="Description">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Description" className="sm:col-span-2">
              <McTextarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>

      {/* Add bed modal */}
      <PremiumModal
        open={bedModalOpen} onOpenChange={setBedModalOpen} size="sm"
        title={`Add Bed — ${selectedWard?.name || ''}`}
        icon={<Armchair className="h-5 w-5" />}
        description="Register a physical bed under this ward"
        footerNote="Bed numbers are unique facility-wide"
        submitLabel="Add Bed" onSubmit={submitBed} submitting={bedSubmitting} secondaryLabel="Cancel"
      >
        <div className="space-y-3">
          <Field icon={<Hash className="h-3.5 w-3.5" />} label="Bed Number">
            <McInput value={bedForm.bedNumber} onChange={e => setBedForm(f => ({ ...f, bedNumber: e.target.value }))} placeholder="e.g. B-204" />
          </Field>
          <Field icon={<Tag className="h-3.5 w-3.5" />} label="Status">
            <Select value={bedForm.status} onValueChange={v => setBedForm(f => ({ ...f, status: v }))}>
              <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{BED_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field icon={<StickyNote className="h-3.5 w-3.5" />} label="Notes">
            <McTextarea value={bedForm.notes} onChange={e => setBedForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Ward"
        message={deleting ? `Delete "${deleting.name}"? Wards with beds are deactivated instead.` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
