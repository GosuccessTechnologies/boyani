'use client';

/**
 * HR APPLICATIONS — recruitment pipeline review. DataTable + view modal
 * (cover letter, resume link) with status workflow buttons and review notes.
 * Applications arrive from the PUBLIC careers form (no-auth POST).
 */

import * as React from 'react';
import {
  FileStack, User, Mail, Phone, BriefcaseBusiness, AlignLeft, Link2, FileText,
  ClipboardList, CheckCircle2, XCircle, Plus, ListFilter, Clock,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDate, fmtDateTime, Field, StatusBadge, PageHeading, SkeletonCards, McTextarea } from '@/app/ops/_lib';

interface ApplicationJob { id: string; title: string; slug: string; department: string; status: string }
interface Application {
  id: string; jobPostingId: string; jobPosting: ApplicationJob | null;
  applicantName: string; email: string; phone: string; coverLetter: string; resumeUrl: string;
  status: string; reviewedBy: string; reviewNotes: string; createdAt: string; updatedAt: string;
}
interface ApplicationsResp { applications: Application[]; total: number; page: number; perPage: number; totalPages: number }

const WORKFLOW = ['RECEIVED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEWED', 'OFFERED', 'HIRED', 'REJECTED'];

export default function HrApplicationsPage() {
  const [apps, setApps] = React.useState<Application[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('');

  const [viewing, setViewing] = React.useState<Application | null>(null);
  const [notes, setNotes] = React.useState('');
  const [busyStatus, setBusyStatus] = React.useState('');

  const load = React.useCallback(async (p = 1, status = statusFilter) => {
    setLoading(true);
    try {
      const res = await apiGet<ApplicationsResp>(`/api/applications?page=${p}&perPage=20${status ? `&status=${status}` : ''}`);
      setApps(res.applications || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => { load(1);   }, [statusFilter]);

  const openView = (a: Application) => {
    setViewing(a);
    setNotes(a.reviewNotes || '');
  };

  const setStatus = async (status: string) => {
    if (!viewing) return;
    setBusyStatus(status);
    try {
      const res = await apiPut<{ application: Application; message: string }>('/api/applications', {
        id: viewing.id, status, reviewNotes: notes,
      });
      toast.success(res.message || `Marked ${status.replaceAll('_', ' ')}`);
      setViewing(res.application);
      setNotes(res.application.reviewNotes || '');
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update application');
    } finally {
      setBusyStatus('');
    }
  };

  const saveNotes = async () => {
    if (!viewing) return;
    setBusyStatus('NOTES');
    try {
      const res = await apiPut<{ application: Application; message: string }>('/api/applications', {
        id: viewing.id, reviewNotes: notes,
      });
      toast.success(res.message || 'Review notes saved');
      setViewing(res.application);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save notes');
    } finally {
      setBusyStatus('');
    }
  };

  const columns: Column<Application>[] = [
    { key: 'applicantName', header: 'Applicant', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">{r.applicantName}</span>
    ) },
    { key: 'job', header: 'Position', defaultVisible: true, csvValue: r => r.jobPosting?.title || '' },
    { key: 'status', header: 'Status', defaultVisible: true, render: r => <StatusBadge status={r.status} />, csvValue: r => r.status },
    { key: 'createdAt', header: 'Applied', defaultVisible: true, render: r => fmtDate(r.createdAt), csvValue: r => (r.createdAt ? r.createdAt.slice(0, 10) : '') },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'department', header: 'Department', csvValue: r => r.jobPosting?.department || '' },
    { key: 'reviewNotes', header: 'Review Notes' },
  ];

  const actions: ActionBtn[] = [
    { icon: <FileText className="h-4 w-4" />, title: 'Review application', variant: 'view', onClick: openView },
  ];

  const count = (s: string) => apps.filter(a => a.status === s).length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<FileStack className="h-5 w-5" />}
        title="Applications Review"
        subtitle="Recruitment pipeline — applications submitted from the public careers page"
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Applications" value={total} icon={<FileStack className="h-5 w-5" />} accent="primary" />
          <StatCard label="Received" value={count('RECEIVED')} icon={<Clock className="h-5 w-5" />} accent="secondary" hint="awaiting review" />
          <StatCard label="Shortlisted" value={count('SHORTLISTED') + count('INTERVIEWED')} icon={<ClipboardList className="h-5 w-5" />} accent="tertiary" hint="this page" />
          <StatCard label="Hired" value={count('HIRED')} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" hint="this page" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 no-print">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mr-1"><ListFilter className="h-3.5 w-3.5" /> Status:</span>
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${!statusFilter ? 'bg-[var(--mc-primary)] text-white border-transparent' : 'bg-white text-[var(--mc-text-secondary)] border-[var(--mc-divider)] hover:bg-[var(--mc-primary-light)]'}`}
        >
          All
        </button>
        {WORKFLOW.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${statusFilter === s ? 'bg-[var(--mc-primary)] text-white border-transparent' : 'bg-white text-[var(--mc-text-secondary)] border-[var(--mc-divider)] hover:bg-[var(--mc-primary-light)]'}`}
          >
            {s.replaceAll('_', ' ')}
          </button>
        ))}
      </div>

      <DataTable
        data={apps} columns={columns} actions={actions}
        rowKey={r => r.id} title="Applications" moduleLabel="HR Job Applications"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      <PremiumModal
        open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }} size="lg"
        title={viewing ? `Application — ${viewing.applicantName}` : ''}
        icon={<FileStack className="h-5 w-5" />}
        description={viewing?.jobPosting ? `${viewing.jobPosting.title}${viewing.jobPosting.department ? ` · ${viewing.jobPosting.department}` : ''}` : ''}
        footerNote="Workflow: RECEIVED → UNDER REVIEW → SHORTLISTED → INTERVIEWED → OFFERED → HIRED / REJECTED"
        secondaryLabel="Close"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field icon={<User className="h-3.5 w-3.5" />} label="Applicant">
                <p className="text-sm text-[var(--mc-text-primary)] font-medium">{viewing.applicantName}</p>
              </Field>
              <Field icon={<BriefcaseBusiness className="h-3.5 w-3.5" />} label="Current Status">
                <div><StatusBadge status={viewing.status} /></div>
              </Field>
              <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                <p className="text-sm text-[var(--mc-text-secondary)] break-all">{viewing.email || '—'}</p>
              </Field>
              <Field icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
                <p className="text-sm text-[var(--mc-text-secondary)]">{viewing.phone || '—'}</p>
              </Field>
              <Field icon={<Clock className="h-3.5 w-3.5" />} label="Submitted">
                <p className="text-sm text-[var(--mc-text-secondary)]">{fmtDateTime(viewing.createdAt)}</p>
              </Field>
              <Field icon={<Link2 className="h-3.5 w-3.5" />} label="Resume / CV">
                {viewing.resumeUrl ? (
                  <a href={viewing.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--mc-primary)] underline break-all inline-flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> {viewing.resumeUrl.split('/').pop() || 'Open resume'}
                  </a>
                ) : <p className="text-sm text-muted-foreground">—</p>}
              </Field>
            </div>

            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Cover Letter">
              <div className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-3 text-sm text-[var(--mc-text-secondary)] whitespace-pre-wrap min-h-[80px]">
                {viewing.coverLetter || 'No cover letter provided.'}
              </div>
            </Field>

            <Field icon={<ClipboardList className="h-3.5 w-3.5" />} label="Review Notes">
              <McTextarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Screening feedback, interview schedule, references…" />
            </Field>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--mc-text-secondary)] flex items-center gap-1"><Plus className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> Update Status (saves notes too)</p>
              <div className="flex flex-wrap gap-1.5">
                {WORKFLOW.filter(s => s !== 'RECEIVED').map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === 'REJECTED' ? 'destructive' : s === 'HIRED' ? 'default' : 'outline'}
                    className="h-8 text-xs gap-1"
                    disabled={busyStatus !== '' || viewing.status === s}
                    onClick={() => setStatus(s)}
                  >
                    {s === 'REJECTED' ? <XCircle className="h-3.5 w-3.5" /> : s === 'HIRED' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    {s.replaceAll('_', ' ')}
                    {busyStatus === s && '…'}
                  </Button>
                ))}
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" disabled={busyStatus !== ''} onClick={saveNotes}>
                <ClipboardList className="h-3.5 w-3.5" /> Save Notes Only
              </Button>
            </div>
          </div>
        )}
      </PremiumModal>
    </div>
  );
}
