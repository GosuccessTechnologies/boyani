'use client';

/**
 * SERVICES & PRICING (ADMIN-only pricing per requirements).
 * DataTable of /api/services + PremiumModal form + CSV import/export + delete.
 */

import * as React from 'react';
import {
  Stethoscope, Tag, Hash, Banknote, ShieldCheck, Clock, Building2,
  FileText, Pencil, Trash2, Plus, AlignLeft, Eye, Activity,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete, exportCsv } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, Field, FormSection, ConfirmModal, CsvImportControls, StatusBadge, BoolPill, PageHeading, SkeletonCards, McInput, McTextarea, ViewSection, ViewField } from '../_lib';

interface Service {
  id: string; code: string; name: string; category: string; description: string;
  price: number; shaCovered: boolean; durationMin: number; isActive: boolean;
  departmentId: string | null;
  department?: { name: string } | null;
}
interface Department { id: string; name: string }
interface ServicesResp { services: Service[]; total: number; page: number; perPage: number; totalPages: number }

const CATEGORIES = ['CLINICAL', 'LABORATORY', 'PHARMACY', 'ADMISSION', 'MCH', 'IMAGING', 'CONSULTATION'];
const CSV_HEADERS = ['name', 'category', 'price', 'shaCovered', 'durationMin'];

const emptyForm = {
  name: '', category: 'CLINICAL', price: '', shaCovered: false, durationMin: '30',
  departmentId: '', description: '',
};

export default function ServicesPage() {
  const [services, setServices] = React.useState<Service[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [departments, setDepartments] = React.useState<Department[]>([]);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Service | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Service | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [viewing, setViewing] = React.useState<Service | null>(null);

  const [csvOpen, setCsvOpen] = React.useState(false);
  const [csvBusy, setCsvBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<ServicesResp>(`/api/services?page=${p}&perPage=20`);
      setServices(res.services || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load(1);
    apiGet<{ departments: Department[] }>('/api/departments')
      .then(r => setDepartments(r.departments || []))
      .catch(() => {});
  }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setModalOpen(true); };
  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      name: s.name, category: s.category, price: String(s.price ?? ''), shaCovered: !!s.shaCovered,
      durationMin: String(s.durationMin ?? 30), departmentId: s.departmentId || '',
      description: s.description || '',
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Service name is required'); return; }
    if (!form.price || isNaN(Number(form.price))) { toast.error('Enter a valid price'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(), category: form.category, price: Number(form.price),
        shaCovered: form.shaCovered, durationMin: Number(form.durationMin) || 30,
        departmentId: form.departmentId || null, description: form.description,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/services', payload)
        : await apiPost<{ message: string }>('/api/services', payload);
      toast.success(res.message || (editing ? 'Service updated' : 'Service created'));
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save service');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string; softDeleted?: boolean }>(`/api/services?id=${deleting.id}`);
      toast.success(res.message || 'Service deleted');
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
        name: r.name, category: r.category, price: r.price,
        shaCovered: r.shaCovered, durationMin: r.durationMin,
      }));
      const res = await apiPost<{ imported: number }>('/api/services', { bulkItems });
      toast.success(`Imported ${res.imported} service(s)`);
      setCsvOpen(false);
      load(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'CSV import failed');
    } finally {
      setCsvBusy(false);
    }
  };

  const exportAll = () => {
    exportCsv('services-full.csv', ['code', 'name', 'category', 'price', 'shaCovered', 'durationMin', 'department', 'isActive'],
      services.map(s => [s.code, s.name, s.category, s.price, s.shaCovered ? 'true' : 'false', s.durationMin, s.department?.name || '', s.isActive ? 'true' : 'false']));
    toast.success('Services exported');
  };

  const columns: Column<Service>[] = [
    { key: 'name', header: 'Service Name', defaultVisible: true, render: r => <span className="font-semibold text-[var(--mc-text-primary)]">{r.name}</span> },
    { key: 'category', header: 'Category', defaultVisible: true, render: r => <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]">{r.category}</span> },
    { key: 'price', header: 'Price', defaultVisible: true, align: 'right', render: r => <span className="font-semibold">{kes(r.price)}</span>, csvValue: r => r.price },
    { key: 'shaCovered', header: 'SHA', defaultVisible: true, render: r => <BoolPill value={r.shaCovered} trueLabel="Covered" falseLabel="Cash" />, csvValue: r => (r.shaCovered ? 'true' : 'false') },
    { key: 'code', header: 'Code' },
    { key: 'department', header: 'Department', csvValue: r => r.department?.name || '' },
    { key: 'durationMin', header: 'Duration (min)', align: 'right', csvValue: r => r.durationMin },
    { key: 'isActive', header: 'Status', render: r => <StatusBadge status={r.isActive ? 'ACTIVE' : 'UNPAID'} />, csvValue: r => (r.isActive ? 'ACTIVE' : 'INACTIVE') },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View service', variant: 'view', onClick: r => setViewing(r) },
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit service', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete service', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const activeCount = services.filter(s => s.isActive).length;
  const shaCount = services.filter(s => s.shaCovered).length;
  const avgPrice = services.length ? services.reduce((s, x) => s + (x.price || 0), 0) / services.length : 0;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Stethoscope className="h-5 w-5" />}
        title="Services & Pricing"
        subtitle="Billable clinical services — pricing configured by ADMIN only"
        actions={<>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setCsvOpen(true)}><FileText className="h-4 w-4" /> CSV Import</Button>
          <Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Service</Button>
        </>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Services Listed" value={total} icon={<Stethoscope className="h-5 w-5" />} accent="primary" hint={`${activeCount} active on this page`} />
          <StatCard label="SHA Covered" value={shaCount} icon={<ShieldCheck className="h-5 w-5" />} accent="success" hint="insurance-ready" />
          <StatCard label="Avg Price" value={kes(avgPrice)} icon={<Banknote className="h-5 w-5" />} accent="secondary" hint="this page" />
          <StatCard label="Categories" value={CATEGORIES.length} icon={<Tag className="h-5 w-5" />} accent="tertiary" hint="pricing groups" />
        </div>
      )}

      <DataTable
        data={services} columns={columns} actions={actions}
        rowKey={r => r.id} title="Services" moduleLabel="Services & Pricing"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
        toolbarExtra={<Button size="sm" variant="outline" className="h-9 gap-1" onClick={exportAll}><FileText className="h-4 w-4" /> Export All</Button>}
      />

      {/* Create / edit modal */}
      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen}
        title={editing ? 'Edit Service' : 'New Service'}
        icon={<Stethoscope className="h-5 w-5" />}
        description={editing ? `${editing.code} — update pricing & details` : 'Register a billable service and set its price'}
        footerNote="Pricing is restricted to facility administrators"
        submitLabel={editing ? 'Update Service' : 'Create Service'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Service Identity & Pricing">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Service Name">
              <McInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Full Blood Count" />
            </Field>
            <Field icon={<Tag className="h-3.5 w-3.5" />} label="Category">
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field icon={<Banknote className="h-3.5 w-3.5" />} label="Price (KSh)">
              <McInput type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="1500" />
            </Field>
            <Field icon={<Clock className="h-3.5 w-3.5" />} label="Duration (minutes)">
              <McInput type="number" min="1" value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))} />
            </Field>
            <Field icon={<ShieldCheck className="h-3.5 w-3.5" />} label="SHA Covered">
              <div className="flex items-center gap-2 h-9">
                <Switch checked={form.shaCovered} onCheckedChange={v => setForm(f => ({ ...f, shaCovered: v }))} />
                <span className="text-xs text-muted-foreground">{form.shaCovered ? 'Insurable under SHA' : 'Cash only'}</span>
              </div>
            </Field>
            <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Department">
              <Select value={form.departmentId || 'none'} onValueChange={v => setForm(f => ({ ...f, departmentId: v === 'none' ? '' : v }))}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— none —</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>

          <FormSection n={2} title="Description">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Description" className="sm:col-span-2">
              <McTextarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What this service includes…" />
            </Field>
            {editing && (
              <Field icon={<Hash className="h-3.5 w-3.5" />} label="Service Code">
                <McInput value={editing.code} disabled />
              </Field>
            )}
          </FormSection>
        </div>
      </PremiumModal>

      {/* ── View service modal (Instruction 11) ── */}
      <PremiumModal
        open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }}
        title={viewing ? `Service — ${viewing.name}` : 'Service'}
        icon={<Stethoscope className="h-5 w-5" />}
        description={viewing ? `${viewing.code} · ${viewing.category}` : ''}
        footerNote={viewing ? (viewing.isActive ? 'Active — billable at the points of service' : 'Inactive — hidden from new billing') : ''}
        submitLabel="Close" onSubmit={() => setViewing(null)}
      >
        {viewing && (
          <div className="space-y-5">
            <ViewSection icon={<Stethoscope className="h-3.5 w-3.5" />} title="Service Details">
              <ViewField icon={<AlignLeft className="h-3.5 w-3.5" />} label="Service Name" value={viewing.name} />
              <ViewField icon={<Hash className="h-3.5 w-3.5" />} label="Code" value={viewing.code} />
              <ViewField icon={<Tag className="h-3.5 w-3.5" />} label="Category" value={<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]">{viewing.category}</span>} />
              <ViewField icon={<Building2 className="h-3.5 w-3.5" />} label="Department" value={viewing.department?.name || '—'} />
            </ViewSection>
            <ViewSection icon={<Banknote className="h-3.5 w-3.5" />} title="Pricing & Cover">
              <ViewField icon={<Banknote className="h-3.5 w-3.5" />} label="Price" value={kes(viewing.price)} />
              <ViewField icon={<ShieldCheck className="h-3.5 w-3.5" />} label="SHA Covered" value={<BoolPill value={viewing.shaCovered} trueLabel="Covered" falseLabel="Cash only" />} />
              <ViewField icon={<Clock className="h-3.5 w-3.5" />} label="Duration" value={`${viewing.durationMin} min`} />
              <ViewField icon={<Activity className="h-3.5 w-3.5" />} label="Status" value={<StatusBadge status={viewing.isActive ? 'ACTIVE' : 'UNPAID'} />} />
            </ViewSection>
            <ViewSection icon={<AlignLeft className="h-3.5 w-3.5" />} title="Description">
              <ViewField icon={<AlignLeft className="h-3.5 w-3.5" />} label="Description" value={viewing.description} className="sm:col-span-2" />
            </ViewSection>
          </div>
        )}
      </PremiumModal>

      {/* CSV import modal */}
      <PremiumModal
        open={csvOpen} onOpenChange={setCsvOpen}
        title="Bulk Import Services"
        icon={<FileText className="h-5 w-5" />}
        description="Download the CSV template, fill one service per row, then import"
        footerNote="Rows missing a name are skipped"
        submitLabel="Close" onSubmit={() => setCsvOpen(false)}
      >
        <CsvImportControls templateName="services-template.csv" headers={CSV_HEADERS} onParsed={importCsv} note={`Columns: ${CSV_HEADERS.join(', ')} — shaCovered: true/false`} />
        {csvBusy && <p className="text-xs text-muted-foreground mt-3">Importing…</p>}
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Service"
        message={deleting ? `Delete "${deleting.name}"? Services referenced by bills are deactivated instead.` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
