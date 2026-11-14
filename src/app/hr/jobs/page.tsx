'use client';

/**
 * HR JOB POSTINGS — careers manager. DataTable + rich-text modal
 * (description + requirements). These postings appear on the public
 * careers page (isPublic + OPEN + valid deadline).
 */

import * as React from 'react';
import {
  BriefcaseBusiness, Building2, MapPin, Clock3, Users, Banknote, CalendarDays,
  Globe, Pencil, Trash2, Plus, ExternalLink, ListChecks, Globe2,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDate, isoDate, Field, FormSection, ConfirmModal, BoolPill, StatusBadge, PageHeading, SkeletonCards, McInput, McSelect, SwitchRow } from '@/app/ops/_lib';

interface Job {
  id: string; slug: string; title: string; department: string; location: string;
  employmentType: string; description: string; requirements: string; salaryRange: string;
  openings: number; deadline: string | null; isPublic: boolean; status: string;
  createdAt: string; _count?: { applications: number };
}
interface JobsResp { jobs: Job[]; total: number; page: number; perPage: number; totalPages: number }

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'LOCUM', 'INTERNSHIP'];
const JOB_STATUSES = ['OPEN', 'CLOSED', 'DRAFT'];

const emptyForm = {
  title: '', department: '', location: '', employmentType: 'FULL_TIME', salaryRange: '',
  openings: '1', deadline: '', description: '', requirements: '', isPublic: true, status: 'OPEN',
};

export default function HrJobsPage() {
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Job | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Job | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<JobsResp>(`/api/jobs?page=${p}&perPage=20`);
      setJobs(res.jobs || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load job postings');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(1); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };
  const openEdit = (j: Job) => {
    setEditing(j);
    setForm({
      title: j.title, department: j.department || '', location: j.location || '',
      employmentType: j.employmentType || 'FULL_TIME', salaryRange: j.salaryRange || '',
      openings: String(j.openings ?? 1), deadline: isoDate(j.deadline),
      description: j.description || '', requirements: j.requirements || '',
      isPublic: !!j.isPublic, status: j.status || 'OPEN',
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Job title is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(), department: form.department, location: form.location,
        employmentType: form.employmentType, salaryRange: form.salaryRange,
        openings: form.openings, deadline: form.deadline || null,
        description: form.description, requirements: form.requirements,
        isPublic: form.isPublic, status: form.status,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/jobs', payload)
        : await apiPost<{ message: string }>('/api/jobs', payload);
      toast.success(res.message || (editing ? 'Job posting updated' : 'Job posting created'));
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save job posting');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/jobs?id=${deleting.id}`);
      toast.success(res.message || 'Job posting deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Job>[] = [
    { key: 'title', header: 'Title', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {r.title}
        {(r._count?.applications ?? 0) > 0 && <span className="text-muted-foreground font-normal text-xs"> · {r._count?.applications} application(s)</span>}
      </span>
    ) },
    { key: 'department', header: 'Department', defaultVisible: true },
    { key: 'location', header: 'Location', defaultVisible: true },
    { key: 'status', header: 'Status', defaultVisible: true, render: r => <StatusBadge status={r.status} />, csvValue: r => r.status },
    { key: 'employmentType', header: 'Employment', csvValue: r => r.employmentType.replaceAll('_', ' ') },
    { key: 'openings', header: 'Openings', align: 'right' },
    { key: 'deadline', header: 'Deadline', render: r => fmtDate(r.deadline), csvValue: r => (r.deadline ? r.deadline.slice(0, 10) : '') },
    { key: 'salaryRange', header: 'Salary Range' },
    { key: 'isPublic', header: 'Public', render: r => <BoolPill value={r.isPublic} trueLabel="Careers" falseLabel="Internal" />, csvValue: r => (r.isPublic ? 'PUBLIC' : 'INTERNAL') },
    { key: 'applications', header: 'Applications', align: 'right', csvValue: r => r._count?.applications ?? 0 },
    { key: 'createdAt', header: 'Created', render: r => fmtDate(r.createdAt), csvValue: r => (r.createdAt ? r.createdAt.slice(0, 10) : '') },
  ];

  const actions: ActionBtn[] = [
    { icon: <ExternalLink className="h-4 w-4" />, title: 'View on careers page', variant: 'view', onClick: () => window.open('/careers', '_blank') },
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit posting', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete posting', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const openCount = jobs.filter(j => j.status === 'OPEN').length;
  const publicCount = jobs.filter(j => j.isPublic && j.status === 'OPEN').length;
  const appCount = jobs.reduce((s, j) => s + (j._count?.applications ?? 0), 0);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<BriefcaseBusiness className="h-5 w-5" />}
        title="Job Postings"
        subtitle="Careers manager — public postings feed the website careers page"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Posting</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Postings" value={total} icon={<BriefcaseBusiness className="h-5 w-5" />} accent="primary" />
          <StatCard label="Open" value={openCount} icon={<ListChecks className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Live on Careers" value={publicCount} icon={<Globe2 className="h-5 w-5" />} accent="tertiary" hint="public + open" />
          <StatCard label="Applications" value={appCount} icon={<Users className="h-5 w-5" />} accent="secondary" hint="this page" />
        </div>
      )}

      <DataTable
        data={jobs} columns={columns} actions={actions}
        rowKey={r => r.id} title="Job Postings" moduleLabel="HR Job Postings"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
        toolbarExtra={
          <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => window.open('/careers', '_blank')}>
            <Globe className="h-4 w-4" /> Careers Page
          </Button>
        }
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="lg"
        title={editing ? `Edit Posting — ${editing.title}` : 'New Job Posting'}
        icon={<BriefcaseBusiness className="h-5 w-5" />}
        description={editing ? 'Slug preserved automatically; deadline expiry hides the posting publicly' : 'Slug auto-generated from the title'}
        footerNote="Postings with applications cannot be deleted — close them instead"
        submitLabel={editing ? 'Update Posting' : 'Publish Posting'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Position">
            <Field icon={<BriefcaseBusiness className="h-3.5 w-3.5" />} label="Job Title">
              <McInput value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Registered Nurse — ICU" />
            </Field>
            <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Department">
              <McInput value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Critical Care" />
            </Field>
            <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
              <McInput value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Nairobi — Main Hospital" />
            </Field>
            <Field icon={<Clock3 className="h-3.5 w-3.5" />} label="Employment Type">
              <McSelect value={form.employmentType} onValueChange={v => setForm(f => ({ ...f, employmentType: v }))} options={EMPLOYMENT_TYPES.map(t => ({ value: t, label: t.replaceAll('_', ' ') }))} />
            </Field>
            <Field icon={<Banknote className="h-3.5 w-3.5" />} label="Salary Range">
              <McInput value={form.salaryRange} onChange={e => setForm(f => ({ ...f, salaryRange: e.target.value }))} placeholder="KSh 80,000 – 120,000" />
            </Field>
            <Field icon={<Users className="h-3.5 w-3.5" />} label="Openings">
              <McInput type="number" min="1" value={form.openings} onChange={e => setForm(f => ({ ...f, openings: e.target.value }))} />
            </Field>
            <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Application Deadline">
              <McInput type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </Field>
            <Field icon={<ListChecks className="h-3.5 w-3.5" />} label="Status">
              <McSelect value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} options={JOB_STATUSES.map(s => ({ value: s, label: s }))} />
            </Field>
          </FormSection>

          <FormSection n={2} title="Description (Rich Text)">
            <Field icon={<BriefcaseBusiness className="h-3.5 w-3.5" />} label="Job Description" className="sm:col-span-2">
              <RichTextEditor value={form.description} onChange={html => setForm(f => ({ ...f, description: html }))} placeholder="Role purpose, responsibilities, reporting line…" minHeight={180} />
            </Field>
          </FormSection>

          <FormSection n={3} title="Requirements (Rich Text)">
            <Field icon={<ListChecks className="h-3.5 w-3.5" />} label="Qualifications & Requirements" className="sm:col-span-2">
              <RichTextEditor value={form.requirements} onChange={html => setForm(f => ({ ...f, requirements: html }))} placeholder="Education, registration (KMPDC/NCK), experience…" minHeight={160} />
            </Field>
          </FormSection>

          <FormSection n={4} title="Visibility">
            <div className="sm:col-span-2">
              <SwitchRow
                label="Show on public careers page"
                hint="Public + OPEN + unexpired deadline = visible to applicants"
                checked={form.isPublic}
                onCheckedChange={c => setForm(f => ({ ...f, isPublic: c }))}
              />
            </div>
          </FormSection>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Job Posting"
        message={deleting ? `Delete "${deleting.title}"? Postings with applications cannot be deleted — close them instead.` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
