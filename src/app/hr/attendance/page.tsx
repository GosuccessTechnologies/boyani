'use client';

/**
 * HR ATTENDANCE REVIEW — admin/HR see all records. Date-range + search
 * filters, DataTable (employee, date, check-in/out, work hours, status)
 * and status/time correction via PUT /api/attendance.
 */

import * as React from 'react';
import {
  CalendarCheck2, User, CalendarDays, Clock, Clock3, ListChecks, AlignLeft,
  Pencil, Search, Loader2, Timer, MapPin,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDate, Field, FormSection, StatusBadge, PageHeading, SkeletonCards, McInput, McTextarea, McSelect } from '@/app/ops/_lib';

interface AttEmployee { id: string; employeeNo: string; firstName: string; lastName: string; department: string }
interface Attendance {
  id: string; userId: string; employeeId: string | null; employee: AttEmployee | null;
  employeeName?: string; // server-resolved display name (API falls back through employee → Employee(userId) → user names)
  date: string; checkIn: string | null; checkOut: string | null;
  checkInDevice: string; status: string; workHours: number; notes: string;
  checkInLat: number | null; checkInLng: number | null;
}
interface AttendanceResp { records: Attendance[]; total: number; page: number; perPage: number; totalPages: number }

const STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE', 'HALF_DAY'];

/** Local datetime-local value from an ISO string */
const localDateTime = (x: unknown) => {
  if (!x) return '';
  const d = new Date(x as string);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Display name resolved server-side by /api/attendance (employee relation →
// Employee(userId) lookup → user account names) — '—' only when unresolvable.
const ename = (r: Attendance) => r.employeeName || '—';

export default function HrAttendancePage() {
  const [records, setRecords] = React.useState<Attendance[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [applied, setApplied] = React.useState({ search: '', status: '', dateFrom: '', dateTo: '' });

  const [editing, setEditing] = React.useState<Attendance | null>(null);
  const [form, setForm] = React.useState({ status: 'PRESENT', checkIn: '', checkOut: '', notes: '' });
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(p), perPage: '31' });
      if (applied.search) q.set('search', applied.search);
      if (applied.status) q.set('status', applied.status);
      if (applied.dateFrom) q.set('dateFrom', applied.dateFrom);
      if (applied.dateTo) q.set('dateTo', applied.dateTo);
      const res = await apiGet<AttendanceResp>(`/api/attendance?${q.toString()}`);
      setRecords(res.records || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [applied]);

  React.useEffect(() => { load(1); }, [load]);

  const applyFilters = () => setApplied({ search, status: statusFilter, dateFrom, dateTo });
  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo('');
    setApplied({ search: '', status: '', dateFrom: '', dateTo: '' });
  };

  const openEdit = (r: Attendance) => {
    setEditing(r);
    setForm({
      status: r.status || 'PRESENT',
      checkIn: localDateTime(r.checkIn),
      checkOut: localDateTime(r.checkOut),
      notes: r.notes || '',
    });
  };

  const submit = async () => {
    if (!editing) return;
    setSubmitting(true);
    try {
      // Only send times when the (pre-filled) value is present — blank = leave untouched
      const payload: Record<string, unknown> = { id: editing.id, status: form.status, notes: form.notes };
      if (form.checkIn) payload.checkIn = new Date(form.checkIn).toISOString();
      if (form.checkOut) payload.checkOut = new Date(form.checkOut).toISOString();
      const res = await apiPut<{ message: string }>('/api/attendance', payload);
      toast.success(res.message || 'Attendance corrected');
      setEditing(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to correct record');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<Attendance>[] = [
    { key: 'employee', header: 'Employee', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {ename(r)}
        {r.employee?.employeeNo && <span className="text-muted-foreground font-normal text-xs"> · {r.employee.employeeNo}</span>}
      </span>
    ), csvValue: r => ename(r) },
    { key: 'date', header: 'Date', defaultVisible: true, render: r => fmtDate(r.date), csvValue: r => (r.date ? r.date.slice(0, 10) : '') },
    { key: 'checkIn', header: 'Check In', defaultVisible: true, render: r => r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '—', csvValue: r => (r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-KE') : '') },
    { key: 'checkOut', header: 'Check Out', defaultVisible: true, render: r => r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '—', csvValue: r => (r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-KE') : '') },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status} />, csvValue: r => r.status },
    { key: 'workHours', header: 'Work Hours', align: 'right', render: r => r.workHours ? `${r.workHours}h` : '—', csvValue: r => r.workHours },
    { key: 'department', header: 'Department', csvValue: r => r.employee?.department || '' },
    { key: 'checkInDevice', header: 'Device' },
    { key: 'gps', header: 'GPS', csvValue: r => (r.checkInLat != null ? `${r.checkInLat}, ${r.checkInLng}` : ''), render: r => r.checkInLat != null ? (
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.checkInLat?.toFixed(4)}, {r.checkInLng?.toFixed(4)}</span>
    ) : '—' },
    { key: 'notes', header: 'Notes' },
  ];

  const actions: ActionBtn[] = [
    { icon: <Pencil className="h-4 w-4" />, title: 'Correct record', variant: 'edit', onClick: openEdit },
  ];

  const presentCount = records.filter(r => r.status === 'PRESENT').length;
  const lateCount = records.filter(r => r.status === 'LATE').length;
  const leaveCount = records.filter(r => r.status === 'ON_LEAVE').length;
  const avgHours = records.length ? (records.reduce((s, r) => s + (r.workHours || 0), 0) / records.filter(r => r.workHours > 0).length || 0) : 0;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<CalendarCheck2 className="h-5 w-5" />}
        title="Attendance Review"
        subtitle="All-staff PWA check-in/out records with GPS — correct statuses & times (ADMIN/HR)"
      />

      {loading && records.length === 0 ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Records" value={total} icon={<ListChecks className="h-5 w-5" />} accent="primary" />
          <StatCard label="Present" value={presentCount} icon={<CalendarCheck2 className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Late" value={lateCount} icon={<Clock3 className="h-5 w-5" />} accent="warning" hint="this page" />
          <StatCard label="Avg Hours" value={avgHours ? `${avgHours.toFixed(1)}h` : '—'} icon={<Timer className="h-5 w-5" />} accent="secondary" hint={`on leave: ${leaveCount}`} />
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border bg-white p-4 flex flex-wrap items-end gap-3 no-print">
        <Field icon={<Search className="h-3.5 w-3.5" />} label="Employee Search">
          <McInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or employee no." />
        </Field>
        <Field icon={<ListChecks className="h-3.5 w-3.5" />} label="Status">
          <McSelect value={statusFilter || 'ALL'} onValueChange={v => setStatusFilter(v === 'ALL' ? '' : v)} options={[{ value: 'ALL', label: 'All statuses' }, ...STATUSES.map(s => ({ value: s, label: s.replaceAll('_', ' ') }))]} />
        </Field>
        <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="From">
          <McInput type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </Field>
        <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="To">
          <McInput type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </Field>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-9 gap-1" onClick={applyFilters}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Apply
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={clearFilters}>Clear</Button>
        </div>
      </div>

      <DataTable
        data={records} columns={columns} actions={actions}
        rowKey={r => r.id} title="Attendance Records" moduleLabel="HR Attendance Review"
        loading={loading} page={page} perPage={31} total={total}
        onPageChange={p => load(p)}
      />

      {/* Correction modal */}
      <PremiumModal
        open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }} size="md"
        title={editing ? `Correct Record — ${ename(editing)}` : ''}
        icon={<Pencil className="h-5 w-5" />}
        description={editing ? `${fmtDate(editing.date)} · work hours recomputed automatically` : ''}
        footerNote="Corrections are audit-logged — one record per user per day"
        submitLabel="Save Correction"
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        {editing && (
          <div className="space-y-5">
            <FormSection n={1} title="Current Record">
              <Field icon={<User className="h-3.5 w-3.5" />} label="Employee">
                <p className="text-sm font-medium text-[var(--mc-text-primary)]">{ename(editing)}</p>
              </Field>
              <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Date">
                <p className="text-sm text-[var(--mc-text-secondary)]">{fmtDate(editing.date)}</p>
              </Field>
              <Field icon={<Clock className="h-3.5 w-3.5" />} label="Recorded Check-In">
                <p className="text-sm text-[var(--mc-text-secondary)]">{editing.checkIn ? new Date(editing.checkIn).toLocaleString('en-KE') : '—'}</p>
              </Field>
              <Field icon={<Clock className="h-3.5 w-3.5" />} label="Recorded Check-Out">
                <p className="text-sm text-[var(--mc-text-secondary)]">{editing.checkOut ? new Date(editing.checkOut).toLocaleString('en-KE') : '—'}</p>
              </Field>
            </FormSection>

            <FormSection n={2} title="Correction">
              <Field icon={<ListChecks className="h-3.5 w-3.5" />} label="Status">
                <McSelect value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} options={STATUSES.map(s => ({ value: s, label: s.replaceAll('_', ' ') }))} />
              </Field>
              <Field icon={<Clock className="h-3.5 w-3.5" />} label="Corrected Check-In">
                <McInput type="datetime-local" value={form.checkIn} onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))} />
              </Field>
              <Field icon={<Clock className="h-3.5 w-3.5" />} label="Corrected Check-Out">
                <McInput type="datetime-local" value={form.checkOut} onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))} />
              </Field>
              <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Correction Notes" className="sm:col-span-2">
                <McTextarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason for correction (audit trail)…" />
              </Field>
            </FormSection>
          </div>
        )}
      </PremiumModal>
    </div>
  );
}
