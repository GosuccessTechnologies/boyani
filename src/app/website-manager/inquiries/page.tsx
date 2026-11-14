'use client';

/**
 * INQUIRIES — contact inbox. DataTable (name, email, phone, subject,
 * department, status badge, createdAt) + view modal (message + reply
 * textarea → PUT {id, status, reply}) + status filters (NEW / IN_PROGRESS /
 * RESOLVED / SPAM). Messages arrive from the public contact form.
 */

import * as React from 'react';
import {
  Inbox, User, Mail, Phone, Tag, MessageSquareText, AlignLeft, ListFilter,
  Clock, Send, Trash2, Reply, Loader2, Building2,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { apiGet, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDate, fmtDateTime, Field, ConfirmModal, StatusBadge, PageHeading, SkeletonCards, McTextarea, McSelect } from '@/app/ops/_lib';

interface Message {
  id: string; name: string; email: string; phone: string; subject: string;
  message: string; department: string; status: string; assignedTo: string;
  reply: string; repliedAt: string | null; createdAt: string;
}
interface MessagesResp { messages: Message[]; total: number; page: number; perPage: number; totalPages: number }

const STATUS_FILTERS = ['', 'NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM'];

export default function InquiriesPage() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('');

  const [viewing, setViewing] = React.useState<Message | null>(null);
  const [reply, setReply] = React.useState('');
  const [nextStatus, setNextStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Message | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1, status = statusFilter) => {
    setLoading(true);
    try {
      const res = await apiGet<MessagesResp>(`/api/contact?page=${p}&perPage=20${status ? `&status=${status}` : ''}`);
      setMessages(res.messages || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => { load(1);   }, [statusFilter]);

  const openView = (m: Message) => {
    setViewing(m);
    setReply(m.reply || '');
    setNextStatus(m.status === 'NEW' ? 'IN_PROGRESS' : m.status);
  };

  const sendReply = async () => {
    if (!viewing) return;
    setBusy(true);
    try {
      const res = await apiPut<{ message: Message }>('/api/contact', {
        id: viewing.id, reply, status: nextStatus || viewing.status,
      });
      toast.success('Reply saved & inquiry updated');
      setViewing(res.message);
      setReply(res.message?.reply || '');
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update inquiry');
    } finally {
      setBusy(false);
    }
  };

  const quickStatus = async (m: Message, status: string) => {
    try {
      await apiPut('/api/contact', { id: m.id, status });
      toast.success(`Marked ${status.replaceAll('_', ' ')}`);
      load(page);
      if (viewing?.id === m.id) setViewing(v => v ? { ...v, status } : v);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ response?: string }>(`/api/contact?id=${deleting.id}`);
      toast.success(res.response || 'Inquiry deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: Column<Message>[] = [
    { key: 'name', header: 'From', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {r.name}
        {r.subject && <span className="text-muted-foreground font-normal text-xs"> · {r.subject.slice(0, 40)}{r.subject.length > 40 ? '…' : ''}</span>}
      </span>
    ) },
    { key: 'department', header: 'Department', defaultVisible: true, csvValue: r => r.department },
    { key: 'status', header: 'Status', defaultVisible: true, render: r => <StatusBadge status={r.status} />, csvValue: r => r.status },
    { key: 'createdAt', header: 'Received', defaultVisible: true, render: r => fmtDate(r.createdAt), csvValue: r => (r.createdAt ? r.createdAt.slice(0, 10) : '') },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'subject', header: 'Subject' },
    { key: 'reply', header: 'Replied', render: r => (r.repliedAt ? fmtDate(r.repliedAt) : '—'), csvValue: r => (r.repliedAt ? r.repliedAt.slice(0, 10) : '') },
  ];

  const actions: ActionBtn[] = [
    { icon: <MessageSquareText className="h-4 w-4" />, title: 'Read & reply', variant: 'view', onClick: openView },
    { icon: <Reply className="h-4 w-4" />, title: 'Mark in progress', variant: 'edit', onClick: r => quickStatus(r, 'IN_PROGRESS') },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete inquiry', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const count = (s: string) => messages.filter(m => m.status === s).length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Inbox className="h-5 w-5" />}
        title="Inquiries Inbox"
        subtitle="Messages submitted through the public website contact form"
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Inquiries" value={total} icon={<Inbox className="h-5 w-5" />} accent="primary" />
          <StatCard label="New" value={count('NEW')} icon={<Clock className="h-5 w-5" />} accent="danger" hint="unread" />
          <StatCard label="In Progress" value={count('IN_PROGRESS')} icon={<Loader2 className="h-5 w-5" />} accent="warning" hint="this page" />
          <StatCard label="Resolved" value={count('RESOLVED')} icon={<Send className="h-5 w-5" />} accent="success" hint="this page" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 no-print">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mr-1"><ListFilter className="h-3.5 w-3.5" /> Status:</span>
        {STATUS_FILTERS.map(s => (
          <button
            key={s || 'ALL'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${statusFilter === s ? 'bg-[var(--mc-primary)] text-white border-transparent' : 'bg-white text-[var(--mc-text-secondary)] border-[var(--mc-divider)] hover:bg-[var(--mc-primary-light)]'}`}
          >
            {s ? s.replaceAll('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      <DataTable
        data={messages} columns={columns} actions={actions}
        rowKey={r => r.id} title="Contact Inquiries" moduleLabel="Website Inquiries"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      <PremiumModal
        open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }} size="lg"
        title={viewing ? `Inquiry — ${viewing.name}` : ''}
        icon={<Inbox className="h-5 w-5" />}
        description={viewing ? `${viewing.subject || 'Website inquiry'} · ${fmtDateTime(viewing.createdAt)}` : ''}
        footerNote="Saving a reply stamps repliedAt; status changes are audit-logged"
        submitLabel="Save Reply & Status"
        submitIcon={<Send className="h-4 w-4" />}
        onSubmit={sendReply} submitting={busy} secondaryLabel="Close"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field icon={<User className="h-3.5 w-3.5" />} label="From">
                <p className="text-sm font-medium text-[var(--mc-text-primary)]">{viewing.name}</p>
              </Field>
              <Field icon={<Tag className="h-3.5 w-3.5" />} label="Current Status">
                <div><StatusBadge status={viewing.status} /></div>
              </Field>
              <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                <p className="text-sm text-[var(--mc-text-secondary)] break-all">{viewing.email || '—'}</p>
              </Field>
              <Field icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
                <p className="text-sm text-[var(--mc-text-secondary)]">{viewing.phone || '—'}</p>
              </Field>
              <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Department">
                <p className="text-sm text-[var(--mc-text-secondary)]">{viewing.department || 'GENERAL'}</p>
              </Field>
              <Field icon={<Clock className="h-3.5 w-3.5" />} label="Replied At">
                <p className="text-sm text-[var(--mc-text-secondary)]">{viewing.repliedAt ? fmtDateTime(viewing.repliedAt) : '—'}</p>
              </Field>
            </div>

            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Message">
              <div className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-3 text-sm text-[var(--mc-text-secondary)] whitespace-pre-wrap min-h-[80px]">
                {viewing.message}
              </div>
            </Field>

            <Field icon={<Reply className="h-3.5 w-3.5" />} label="Reply" hint="sent to the inquirer's email by the communications team">
              <McTextarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Dear … thank you for reaching out…" />
            </Field>

            <Field icon={<ListFilter className="h-3.5 w-3.5" />} label="Set Status">
              <McSelect
                value={nextStatus || viewing.status}
                onValueChange={setNextStatus}
                options={['NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM'].map(s => ({ value: s, label: s.replaceAll('_', ' ') }))}
              />
            </Field>

            <div className="flex flex-wrap gap-2 no-print">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => quickStatus(viewing, 'RESOLVED')}>Mark Resolved</Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => quickStatus(viewing, 'SPAM')}>Mark Spam</Button>
              {viewing.email && (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(`mailto:${viewing.email}?subject=${encodeURIComponent('Re: ' + (viewing.subject || 'Your inquiry'))}`, '_self')}>
                  <Mail className="h-3.5 w-3.5" /> Email Directly
                </Button>
              )}
            </div>
          </div>
        )}
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Inquiry"
        message={deleting ? `Delete the inquiry from ${deleting.name}? Use SPAM status to keep an audit trail instead.` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
