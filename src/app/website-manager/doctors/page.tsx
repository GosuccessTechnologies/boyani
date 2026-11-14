'use client';

/**
 * DOCTORS DIRECTORY — DataTable + modal (name, title, specialization,
 * department, qualifications, bio, photoUrl FileUploader, experienceYears,
 * consultationFee, availableDays, availableHours, isAcceptingPatients,
 * isPublic, displayOrder). Feeds the public "Find a Doctor" page.
 */

import * as React from 'react';
import {
  Stethoscope, User, GraduationCap, Hospital, BriefcaseBusiness, AlignLeft, ImageIcon,
  Clock3, CalendarDays, Banknote, Layers, Pencil, Trash2, Plus, UserCheck,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { FileUploader } from '@/components/shared/FileUploader';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, Field, FormSection, ConfirmModal, BoolPill, PageHeading, SkeletonCards, McInput, McTextarea, SwitchRow } from '@/app/ops/_lib';

interface Doctor {
  id: string; employeeId: string; name: string; title: string; specialization: string;
  department: string; qualifications: string; bio: string; photoUrl: string;
  experienceYears: number; consultationFee: number; availableDays: string; availableHours: string;
  isAcceptingPatients: boolean; isPublic: boolean; displayOrder: number;
}
interface DoctorsResp { doctors: Doctor[]; total: number; page: number; perPage: number; totalPages: number }

const emptyForm = {
  name: '', title: 'Dr.', specialization: 'General Practitioner', department: '',
  qualifications: '', bio: '', photoUrl: '', experienceYears: '1', consultationFee: '',
  availableDays: 'Mon-Fri', availableHours: '08:00-17:00', isAcceptingPatients: true, isPublic: true, displayOrder: '0',
};

export default function DoctorsDirectoryPage() {
  const [doctors, setDoctors] = React.useState<Doctor[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Doctor | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Doctor | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<DoctorsResp>(`/api/doctors?page=${p}&perPage=20`);
      setDoctors(res.doctors || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load doctor directory');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(1); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, displayOrder: String(doctors.length) });
    setModalOpen(true);
  };
  const openEdit = (d: Doctor) => {
    setEditing(d);
    setForm({
      name: d.name, title: d.title || 'Dr.', specialization: d.specialization || 'General Practitioner',
      department: d.department || '', qualifications: d.qualifications || '', bio: d.bio || '',
      photoUrl: d.photoUrl || '', experienceYears: String(d.experienceYears ?? 1),
      consultationFee: String(d.consultationFee ?? ''), availableDays: d.availableDays || 'Mon-Fri',
      availableHours: d.availableHours || '08:00-17:00',
      isAcceptingPatients: !!d.isAcceptingPatients, isPublic: !!d.isPublic,
      displayOrder: String(d.displayOrder ?? 0),
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Doctor name is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(), title: form.title, specialization: form.specialization,
        department: form.department, qualifications: form.qualifications, bio: form.bio,
        photoUrl: form.photoUrl, experienceYears: form.experienceYears,
        consultationFee: form.consultationFee, availableDays: form.availableDays,
        availableHours: form.availableHours, isAcceptingPatients: form.isAcceptingPatients,
        isPublic: form.isPublic, displayOrder: form.displayOrder,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/doctors', payload)
        : await apiPost<{ message: string }>('/api/doctors', payload);
      toast.success(res.message || (editing ? 'Doctor profile updated' : 'Doctor profile created'));
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save doctor profile');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/doctors?id=${deleting.id}`);
      toast.success(res.message || 'Doctor profile deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Doctor>[] = [
    { key: 'name', header: 'Doctor', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {r.title} {r.name}
        <span className="text-muted-foreground font-normal text-xs"> · {r.specialization}</span>
      </span>
    ), csvValue: r => `${r.title} ${r.name}` },
    { key: 'department', header: 'Department', defaultVisible: true },
    { key: 'experienceYears', header: 'Experience', defaultVisible: true, align: 'right', render: r => `${r.experienceYears} yr`, csvValue: r => r.experienceYears },
    { key: 'isPublic', header: 'Status', defaultVisible: true, render: r => <BoolPill value={r.isPublic} trueLabel="Public" falseLabel="Hidden" />, csvValue: r => (r.isPublic ? 'PUBLIC' : 'HIDDEN') },
    { key: 'consultationFee', header: 'Consultation', align: 'right', render: r => kes(r.consultationFee), csvValue: r => r.consultationFee },
    { key: 'isAcceptingPatients', header: 'Accepting', render: r => <BoolPill value={r.isAcceptingPatients} trueLabel="Yes" falseLabel="No" />, csvValue: r => (r.isAcceptingPatients ? 'YES' : 'NO') },
    { key: 'availableDays', header: 'Days' },
    { key: 'availableHours', header: 'Hours' },
    { key: 'qualifications', header: 'Qualifications' },
    { key: 'displayOrder', header: 'Order', align: 'right' },
  ];

  const actions: ActionBtn[] = [
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit profile', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete profile', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const accepting = doctors.filter(d => d.isAcceptingPatients).length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Stethoscope className="h-5 w-5" />}
        title="Doctors Directory"
        subtitle="Public 'Find a Doctor' profiles — specializations, availability & consultation fees"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Profile</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Profiles" value={total} icon={<Stethoscope className="h-5 w-5" />} accent="primary" />
          <StatCard label="Accepting Patients" value={accepting} icon={<UserCheck className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Public" value={doctors.filter(d => d.isPublic).length} icon={<Layers className="h-5 w-5" />} accent="secondary" hint="this page" />
          <StatCard label="Departments" value={new Set(doctors.map(d => d.department).filter(Boolean)).size} icon={<Hospital className="h-5 w-5" />} accent="tertiary" />
        </div>
      )}

      <DataTable
        data={doctors} columns={columns} actions={actions}
        rowKey={r => r.id} title="Doctors Directory" moduleLabel="Website Doctors Directory"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="lg"
        title={editing ? `Edit Profile — ${editing.title} ${editing.name}` : 'New Doctor Profile'}
        icon={<Stethoscope className="h-5 w-5" />}
        description="Directory entry shown on the public Find-a-Doctor page"
        footerNote="Link a staff Employee ID to keep profiles in sync with HR"
        submitLabel={editing ? 'Update Profile' : 'Create Profile'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Identity">
            <Field icon={<User className="h-3.5 w-3.5" />} label="Full Name">
              <McInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Amina Otieno" />
            </Field>
            <Field icon={<BriefcaseBusiness className="h-3.5 w-3.5" />} label="Title">
              <McInput value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Dr. / Prof." />
            </Field>
            <Field icon={<Stethoscope className="h-3.5 w-3.5" />} label="Specialization">
              <McInput value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} placeholder="Paediatric Cardiology" />
            </Field>
            <Field icon={<Hospital className="h-3.5 w-3.5" />} label="Department">
              <McInput value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Paediatrics" />
            </Field>
            <Field icon={<GraduationCap className="h-3.5 w-3.5" />} label="Qualifications" className="sm:col-span-2">
              <McInput value={form.qualifications} onChange={e => setForm(f => ({ ...f, qualifications: e.target.value }))} placeholder="MBChB (UoN), MMED Paediatrics, KMPDC Registered" />
            </Field>
          </FormSection>

          <FormSection n={2} title="Profile">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Bio" className="sm:col-span-2">
              <McTextarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Short biography shown on the doctor's public profile…" />
            </Field>
            <Field icon={<ImageIcon className="h-3.5 w-3.5" />} label="Photo" className="sm:col-span-2">
              <FileUploader value={form.photoUrl} onChange={url => setForm(f => ({ ...f, photoUrl: url }))} module="WEBSITE" label="Upload doctor photo" />
            </Field>
          </FormSection>

          <FormSection n={3} title="Practice">
            <Field icon={<Clock3 className="h-3.5 w-3.5" />} label="Experience (years)">
              <McInput type="number" min="0" value={form.experienceYears} onChange={e => setForm(f => ({ ...f, experienceYears: e.target.value }))} />
            </Field>
            <Field icon={<Banknote className="h-3.5 w-3.5" />} label="Consultation Fee (KSh)">
              <McInput type="number" min="0" step="0.01" value={form.consultationFee} onChange={e => setForm(f => ({ ...f, consultationFee: e.target.value }))} />
            </Field>
            <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Available Days">
              <McInput value={form.availableDays} onChange={e => setForm(f => ({ ...f, availableDays: e.target.value }))} placeholder="Mon-Fri" />
            </Field>
            <Field icon={<Clock3 className="h-3.5 w-3.5" />} label="Available Hours">
              <McInput value={form.availableHours} onChange={e => setForm(f => ({ ...f, availableHours: e.target.value }))} placeholder="08:00-17:00" />
            </Field>
          </FormSection>

          <FormSection n={4} title="Visibility">
            <Field icon={<Layers className="h-3.5 w-3.5" />} label="Display Order">
              <McInput type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-1 gap-2 content-start">
              <SwitchRow label="Accepting new patients" checked={form.isAcceptingPatients} onCheckedChange={c => setForm(f => ({ ...f, isAcceptingPatients: c }))} />
              <SwitchRow label="Public (visible on website)" checked={form.isPublic} onCheckedChange={c => setForm(f => ({ ...f, isPublic: c }))} />
            </div>
          </FormSection>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Doctor Profile"
        message={deleting ? `Delete the profile for ${deleting.title} ${deleting.name}?` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
