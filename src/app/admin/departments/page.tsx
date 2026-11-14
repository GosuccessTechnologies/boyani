'use client';

/**
 * DEPARTMENTS — clinical departments CRUD.
 * DataTable of /api/departments + PremiumModal form (name, description,
 * iconKey, colour picker, displayOrder, isPublic) + delete with confirm.
 */

import * as React from 'react';
import {
  Building2, AlignLeft, Sparkles, Palette, ListOrdered, Globe, Pencil, Trash2, Plus, Hash, Eye, Activity,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, ConfirmModal, BoolPill, PageHeading, SkeletonCards, McInput, McTextarea, ViewSection, ViewField } from '../_lib';

interface Department {
  id: string; name: string; slug: string; description: string; iconKey: string;
  imageUrl: string; color: string; displayOrder: number; isPublic: boolean; isActive: boolean;
  _count?: { services: number };
}

const emptyForm = {
  name: '', description: '', iconKey: '', color: '#0d9488', displayOrder: '0', isPublic: true,
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Department | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Department | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [viewing, setViewing] = React.useState<Department | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ departments: Department[] }>('/api/departments');
      setDepartments(res.departments || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setModalOpen(true); };
  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({
      name: d.name, description: d.description || '', iconKey: d.iconKey || '',
      color: d.color || '#0d9488', displayOrder: String(d.displayOrder ?? 0),
      isPublic: !!d.isPublic,
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Department name is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(), description: form.description, iconKey: form.iconKey,
        color: form.color, displayOrder: Number(form.displayOrder) || 0, isPublic: form.isPublic,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/departments', payload)
        : await apiPost<{ message: string }>('/api/departments', payload);
      toast.success(res.message || (editing ? 'Department updated' : 'Department created'));
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save department');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/departments?id=${deleting.id}`);
      toast.success(res.message || 'Department deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Department>[] = [
    {
      key: 'name', header: 'Department', defaultVisible: true,
      render: r => (
        <span className="flex items-center gap-2 font-semibold text-[var(--mc-text-primary)]">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: r.color }} />
          {r.name}
        </span>
      ),
    },
    { key: 'services', header: 'Services', defaultVisible: true, align: 'right', csvValue: r => r._count?.services ?? 0, render: r => <span className="font-semibold">{r._count?.services ?? 0}</span> },
    { key: 'displayOrder', header: 'Order', defaultVisible: true, align: 'right', csvValue: r => r.displayOrder },
    { key: 'isPublic', header: 'Public', defaultVisible: true, render: r => <BoolPill value={r.isPublic} trueLabel="Website" falseLabel="Internal" />, csvValue: r => (r.isPublic ? 'true' : 'false') },
    { key: 'slug', header: 'Slug' },
    { key: 'iconKey', header: 'Icon Key' },
    { key: 'color', header: 'Colour', render: r => <span className="inline-flex items-center gap-1.5 text-xs"><span className="h-3 w-3 rounded-sm border" style={{ background: r.color }} />{r.color}</span> },
    { key: 'isActive', header: 'Status', render: r => <BoolPill value={r.isActive} trueLabel="Active" falseLabel="Inactive" />, csvValue: r => (r.isActive ? 'ACTIVE' : 'INACTIVE') },
    { key: 'description', header: 'Description', csvValue: r => r.description },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View department', variant: 'view', onClick: r => setViewing(r) },
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit department', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete department', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const publicCount = departments.filter(d => d.isPublic).length;
  const totalServices = departments.reduce((s, d) => s + (d._count?.services || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Building2 className="h-5 w-5" />}
        title="Departments"
        subtitle="Clinical departments, their branding colours and website visibility"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Department</Button>}
      />

      {loading ? <SkeletonCards count={3} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Departments" value={departments.length} icon={<Building2 className="h-5 w-5" />} accent="primary" />
          <StatCard label="Public on Website" value={publicCount} icon={<Globe className="h-5 w-5" />} accent="success" />
          <StatCard label="Linked Services" value={totalServices} icon={<ListOrdered className="h-5 w-5" />} accent="secondary" />
          <StatCard label="Colours Set" value={departments.filter(d => d.color).length} icon={<Palette className="h-5 w-5" />} accent="tertiary" />
        </div>
      )}

      <DataTable
        data={departments} columns={columns} actions={actions}
        rowKey={r => r.id} title="Departments" moduleLabel="Departments"
        loading={loading}
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen}
        title={editing ? 'Edit Department' : 'New Department'}
        icon={<Building2 className="h-5 w-5" />}
        description={editing ? `${editing.name} — update details & branding` : 'Create a clinical department'}
        footerNote="Departments with linked services cannot be hard-deleted"
        submitLabel={editing ? 'Update Department' : 'Create Department'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Department Identity">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Name">
              <McInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Radiology & Imaging" />
            </Field>
            <Field icon={<Sparkles className="h-3.5 w-3.5" />} label="Icon Key" hint="Lucide icon name, e.g. stethoscope, scan, baby">
              <McInput value={form.iconKey} onChange={e => setForm(f => ({ ...f, iconKey: e.target.value }))} placeholder="activity" />
            </Field>
            <Field icon={<Palette className="h-3.5 w-3.5" />} label="Brand Colour">
              <div className="flex items-center gap-2">
                <input
                  type="color" value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="h-9 w-12 rounded-lg border border-[var(--mc-divider)] bg-white cursor-pointer p-1"
                />
                <McInput value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="flex-1" />
              </div>
            </Field>
            <Field icon={<ListOrdered className="h-3.5 w-3.5" />} label="Display Order">
              <McInput type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
            </Field>
            <Field icon={<Globe className="h-3.5 w-3.5" />} label="Public on Website">
              <div className="flex items-center gap-2 h-9">
                <Switch checked={form.isPublic} onCheckedChange={v => setForm(f => ({ ...f, isPublic: v }))} />
                <span className="text-xs text-muted-foreground">{form.isPublic ? 'Visible publicly' : 'Internal only'}</span>
              </div>
            </Field>
            {editing && (
              <Field icon={<Hash className="h-3.5 w-3.5" />} label="Slug (auto)">
                <McInput value={editing.slug} disabled />
              </Field>
            )}
          </FormSection>

          <FormSection n={2} title="Description">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Description" className="sm:col-span-2">
              <McTextarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short summary shown on the website & dashboards" />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>

      {/* ── View department modal (Instruction 11) ── */}
      <PremiumModal
        open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }}
        title={viewing ? `Department — ${viewing.name}` : 'Department'}
        icon={<Building2 className="h-5 w-5" />}
        description={viewing ? viewing.slug : ''}
        footerNote={viewing ? (viewing.isActive ? 'Active department' : 'Deactivated — hidden from new service links') : ''}
        submitLabel="Close" onSubmit={() => setViewing(null)}
      >
        {viewing && (
          <div className="space-y-5">
            <ViewSection icon={<Building2 className="h-3.5 w-3.5" />} title="Department Details">
              <ViewField icon={<AlignLeft className="h-3.5 w-3.5" />} label="Name" value={
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: viewing.color }} />
                  {viewing.name}
                </span>
              } />
              <ViewField icon={<Hash className="h-3.5 w-3.5" />} label="Slug" value={viewing.slug} />
              <ViewField icon={<Sparkles className="h-3.5 w-3.5" />} label="Icon Key" value={viewing.iconKey} />
              <ViewField icon={<Palette className="h-3.5 w-3.5" />} label="Brand Colour" value={
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-4 w-4 rounded-sm border border-[var(--mc-divider)]" style={{ background: viewing.color }} />
                  <span className="font-mono text-xs">{viewing.color}</span>
                </span>
              } />
              <ViewField icon={<ListOrdered className="h-3.5 w-3.5" />} label="Display Order" value={viewing.displayOrder} />
              <ViewField icon={<Activity className="h-3.5 w-3.5" />} label="Status" value={<BoolPill value={viewing.isActive} trueLabel="Active" falseLabel="Inactive" />} />
            </ViewSection>

            <ViewSection icon={<Globe className="h-3.5 w-3.5" />} title="Visibility & Services">
              <ViewField icon={<Globe className="h-3.5 w-3.5" />} label="Public on Website" value={<BoolPill value={viewing.isPublic} trueLabel="Website" falseLabel="Internal" />} />
              <ViewField icon={<ListOrdered className="h-3.5 w-3.5" />} label="Linked Services" value={`${viewing._count?.services ?? 0} service(s)`} />
            </ViewSection>

            <ViewSection icon={<AlignLeft className="h-3.5 w-3.5" />} title="Description">
              <ViewField icon={<AlignLeft className="h-3.5 w-3.5" />} label="Description" value={viewing.description} className="sm:col-span-2" />
            </ViewSection>
          </div>
        )}
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Department"
        message={deleting ? `Delete "${deleting.name}"? Departments with linked services are deactivated instead.` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
