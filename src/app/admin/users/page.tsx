'use client';

/**
 * USERS & ROLES — system accounts management.
 * DataTable of /api/users + PremiumModal form (create + edit w/ password reset)
 * + isActive toggle + deactivate with confirm.
 *
 * Instruction 18a: per-row "Login History" action + global "All Login History"
 * button → PremiumModal (xl) with a DataTable-style login/session audit table
 * (action pills, extracted browser/OS, durations) + per-day/month/year filters,
 * search and summary chips (total logins, unique days, avg duration).
 */

import * as React from 'react';
import {
  Users, User, AtSign, Mail, Phone, KeyRound, ShieldCheck, Power, Pencil, Plus, Hash, IdCard,
  History, Clock, CalendarDays, MonitorSmartphone, LogIn, LogOut, XCircle, Search,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDate, fmtDateTime, Field, FormSection, StatusBadge, PageHeading, SkeletonCards, McInput } from '../_lib';

interface UserRow {
  id: string; username: string; email: string; firstName: string; lastName: string;
  role: string; phone: string; avatarUrl: string; isActive: boolean;
  lastLogin: string | null; createdAt: string;
}
interface UsersResp { users: UserRow[]; total: number; page: number; perPage: number; totalPages: number }

interface LoginHistoryRow {
  id: string; userId: string; action: string; ipAddress: string; userAgent: string;
  loggedInAt: string; loggedOutAt: string | null; durationMinutes: number;
  user?: { id: string; username: string; firstName: string; lastName: string; role: string } | null;
}
interface HistoryResp { history: LoginHistoryRow[]; total: number; page: number; perPage: number; totalPages: number }

const ROLES = ['ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'CASHIER', 'RECEPTIONIST', 'HR', 'INVENTORY', 'STAFF'];

const emptyForm = {
  username: '', email: '', firstName: '', lastName: '', role: 'STAFF', phone: '', password: '',
};

// ── Login history helpers ──

/** Shortened user agent: "Chrome · Windows" style browser + OS extraction. */
function shortDevice(ua: string): string {
  if (!ua) return '—';
  let browser = 'Unknown';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/curl|PostmanRuntime/i.test(ua)) browser = 'API Client';
  let os = 'Unknown';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/(iPhone|iPad|iPod)/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return `${browser} · ${os}`;
}

/** Duration in minutes → "2h 14m" / "45m" / "—" */
function fmtDuration(mins: number): string {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const ACTION_PILLS: Record<string, string> = {
  LOGIN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  LOGOUT: 'bg-slate-100 text-slate-600 border-slate-200',
  FAILED: 'bg-red-100 text-red-700 border-red-200',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LH_PER_PAGE = 15;

export default function UsersPage() {
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [roleFilter, setRoleFilter] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  // ── Login history modal state (Instruction 18a) ──
  const [lhOpen, setLhOpen] = React.useState(false);
  const [lhFor, setLhFor] = React.useState<UserRow | null>(null); // null → all users
  const [lhRows, setLhRows] = React.useState<LoginHistoryRow[]>([]);
  const [lhTotal, setLhTotal] = React.useState(0);
  const [lhLoading, setLhLoading] = React.useState(false);
  const [lhYear, setLhYear] = React.useState('all');
  const [lhMonth, setLhMonth] = React.useState('all');
  const [lhDay, setLhDay] = React.useState('all');
  const [lhSearch, setLhSearch] = React.useState('');
  const [lhPage, setLhPage] = React.useState(1);

  const load = React.useCallback(async (p = 1, role = roleFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), perPage: '20' });
      if (role) params.set('role', role);
      const res = await apiGet<UsersResp>(`/api/users?${params.toString()}`);
      setUsers(res.users || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  React.useEffect(() => { load(1); }, [roleFilter]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setModalOpen(true); };
  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({
      username: u.username, email: u.email, firstName: u.firstName, lastName: u.lastName,
      role: u.role, phone: u.phone, password: '',
    });
    setModalOpen(true);
  };

  // ── Login history: fetch latest 200 rows for one user or all users ──
  const openHistory = async (u: UserRow | null) => {
    setLhFor(u);
    setLhOpen(true);
    setLhLoading(true);
    setLhYear('all'); setLhMonth('all'); setLhDay('all'); setLhSearch(''); setLhPage(1);
    try {
      const params = new URLSearchParams({ loginHistory: u ? u.id : 'all', perPage: '200' });
      const res = await apiGet<HistoryResp>(`/api/users?${params.toString()}`);
      setLhRows(res.history || []);
      setLhTotal(res.total || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load login history');
      setLhRows([]); setLhTotal(0);
    } finally {
      setLhLoading(false);
    }
  };

  // Distinct years / months / days present in the loaded history (for the filter selects)
  const lhDates = React.useMemo(
    () => lhRows.map(r => new Date(r.loggedInAt)).filter(d => !isNaN(d.getTime())),
    [lhRows],
  );
  const lhYears = React.useMemo(
    () => [...new Set(lhDates.map(d => String(d.getFullYear())))].sort((a, b) => Number(b) - Number(a)),
    [lhDates],
  );
  const lhMonths = React.useMemo(() => {
    if (lhYear === 'all') return [...new Set(lhDates.map(d => d.getMonth()))].sort((a, b) => a - b);
    return [...new Set(lhDates.filter(d => String(d.getFullYear()) === lhYear).map(d => d.getMonth()))].sort((a, b) => a - b);
  }, [lhDates, lhYear]);
  const lhDays = React.useMemo(() => {
    const inMonth = lhDates.filter(d =>
      (lhYear === 'all' || String(d.getFullYear()) === lhYear)
      && (lhMonth === 'all' || d.getMonth() === Number(lhMonth)));
    return [...new Set(inMonth.map(d => d.getDate()))].sort((a, b) => a - b);
  }, [lhDates, lhYear, lhMonth]);

  // Client-side per-day / per-month / per-year + search filtering
  const lhFiltered = React.useMemo(() => {
    const q = lhSearch.trim().toLowerCase();
    return lhRows.filter(r => {
      const d = new Date(r.loggedInAt);
      if (isNaN(d.getTime())) return false;
      if (lhYear !== 'all' && String(d.getFullYear()) !== lhYear) return false;
      if (lhMonth !== 'all' && d.getMonth() !== Number(lhMonth)) return false;
      if (lhDay !== 'all' && d.getDate() !== Number(lhDay)) return false;
      if (q) {
        const user = r.user ? `${r.user.firstName} ${r.user.lastName} ${r.user.username}`.toLowerCase() : '';
        const hay = `${user} ${r.action} ${r.ipAddress} ${shortDevice(r.userAgent)} ${r.userAgent}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [lhRows, lhYear, lhMonth, lhDay, lhSearch]);

  // Summary chips: total logins, unique days, avg duration
  const lhSummary = React.useMemo(() => {
    const logins = lhFiltered.filter(r => r.action === 'LOGIN');
    const days = new Set(logins.map(r => new Date(r.loggedInAt).toDateString()));
    const withDuration = logins.filter(r => (r.durationMinutes || 0) > 0);
    const avg = withDuration.length
      ? withDuration.reduce((s, r) => s + (r.durationMinutes || 0), 0) / withDuration.length
      : 0;
    return { totalLogins: logins.length, uniqueDays: days.size, avgDuration: avg, failed: lhFiltered.filter(r => r.action === 'FAILED').length };
  }, [lhFiltered]);

  const lhTotalPages = Math.max(1, Math.ceil(lhFiltered.length / LH_PER_PAGE));
  const lhPaged = React.useMemo(() => {
    const p = Math.min(lhPage, lhTotalPages);
    return lhFiltered.slice((p - 1) * LH_PER_PAGE, p * LH_PER_PAGE);
  }, [lhFiltered, lhPage, lhTotalPages]);

  React.useEffect(() => { setLhPage(1); }, [lhYear, lhMonth, lhDay, lhSearch]);

  const submit = async () => {
    if (!form.username.trim()) { toast.error('Username is required'); return; }
    if (!editing && !form.password) { toast.error('Password is required for new users'); return; }
    setSubmitting(true);
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          id: editing.id, username: form.username.trim(), email: form.email.trim(),
          firstName: form.firstName, lastName: form.lastName, role: form.role, phone: form.phone,
        };
        if (form.password) payload.password = form.password;
        const res = await apiPut<{ message: string }>('/api/users', payload);
        toast.success(res.message || 'User updated');
      } else {
        const res = await apiPost<{ message: string }>('/api/users', {
          username: form.username.trim(), email: form.email.trim(), firstName: form.firstName,
          lastName: form.lastName, role: form.role, phone: form.phone, password: form.password,
        });
        toast.success(res.message || 'User created');
      }
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (u: UserRow) => {
    try {
      const res = await apiPut<{ message: string }>('/api/users', { id: u.id, isActive: !u.isActive });
      toast.success(res.message || (u.isActive ? 'User deactivated' : 'User activated'));
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to toggle user');
    }
  };

  const columns: Column<UserRow>[] = [
    { key: 'username', header: 'Username', defaultVisible: true, render: r => <span className="font-semibold text-[var(--mc-text-primary)]">{r.username}</span> },
    { key: 'role', header: 'Role', defaultVisible: true, render: r => <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]">{r.role}</span> },
    { key: 'isActive', header: 'Status', defaultVisible: true, render: r => <StatusBadge status={r.isActive ? 'ACTIVE' : 'CANCELLED'} />, csvValue: r => (r.isActive ? 'ACTIVE' : 'INACTIVE') },
    { key: 'lastLogin', header: 'Last Login', defaultVisible: true, render: r => <span className="text-xs">{fmtDateTime(r.lastLogin)}</span>, csvValue: r => (r.lastLogin ? r.lastLogin.slice(0, 16).replace('T', ' ') : '') },
    { key: 'firstName', header: 'First Name', csvValue: r => `${r.firstName} ${r.lastName}` },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'createdAt', header: 'Created', render: r => fmtDate(r.createdAt), csvValue: r => (r.createdAt ? r.createdAt.slice(0, 10) : '') },
  ];

  const actions: ActionBtn[] = [
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit user', variant: 'edit', onClick: openEdit },
    { icon: <History className="h-4 w-4" />, title: 'Login history', variant: 'view', onClick: r => openHistory(r as UserRow) },
    { icon: <Power className="h-4 w-4" />, title: 'Toggle active / deactivate', variant: 'download', onClick: r => toggleActive(r as UserRow) },
  ];

  const roleCounts = ROLES.map(role => ({ role, count: users.filter(u => u.role === role).length })).filter(x => x.count > 0);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Users className="h-5 w-5" />}
        title="Users & Roles"
        subtitle="System accounts, role assignment, activation & password resets"
        actions={<>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => openHistory(null)}>
            <History className="h-4 w-4" /> All Login History
          </Button>
          <Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New User</Button>
        </>}
      />

      {loading && !users.length ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Users" value={total} icon={<Users className="h-5 w-5" />} accent="primary" />
          <StatCard label="Active" value={users.filter(u => u.isActive).length} icon={<Power className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Admins" value={users.filter(u => u.role === 'ADMIN').length} icon={<ShieldCheck className="h-5 w-5" />} accent="danger" hint="this page" />
          <StatCard label="Clinical Roles" value={users.filter(u => ['DOCTOR', 'NURSE', 'LAB_TECH', 'PHARMACIST'].includes(u.role)).length} icon={<IdCard className="h-5 w-5" />} accent="tertiary" hint="this page" />
        </div>
      )}

      <DataTable
        data={users} columns={columns} actions={actions}
        rowKey={r => r.id} title="System Users" moduleLabel="Users & Roles"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
        toolbarExtra={<div className="flex items-center gap-2">
          <Select value={roleFilter || 'all'} onValueChange={v => setRoleFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="mc-input h-9 w-44"><SelectValue placeholder="All roles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          {roleCounts.length > 0 && (
            <span className="hidden lg:flex items-center gap-1 text-[11px] text-muted-foreground">
              {roleCounts.map(x => <span key={x.role} className="px-1.5 py-0.5 rounded bg-[var(--mc-bg-card)] border border-[var(--mc-divider)]">{x.role}:{x.count}</span>)}
            </span>
          )}
        </div>}
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen}
        title={editing ? `Edit User — ${editing.username}` : 'New User'}
        icon={<User className="h-5 w-5" />}
        description={editing ? 'Update profile, role, contact details or reset the password' : 'Create a staff login account'}
        footerNote={editing ? 'Leave password blank to keep the current one — resetting kills active sessions' : 'Password is required at creation'}
        submitLabel={editing ? 'Update User' : 'Create User'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Account">
            <Field icon={<AtSign className="h-3.5 w-3.5" />} label="Username">
              <McInput value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="jdoe" />
            </Field>
            <Field icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Role">
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field icon={<KeyRound className="h-3.5 w-3.5" />} label={editing ? 'New Password (optional)' : 'Password'}>
              <McInput type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editing ? 'Leave blank to keep current' : 'Set a strong password'} />
            </Field>
            {editing && (
              <Field icon={<Hash className="h-3.5 w-3.5" />} label="Status">
                <div className="flex items-center gap-2 h-9">
                  <StatusBadge status={editing.isActive ? 'ACTIVE' : 'CANCELLED'} />
                  <span className="text-xs text-muted-foreground">toggle from the table</span>
                </div>
              </Field>
            )}
          </FormSection>

          <FormSection n={2} title="Profile & Contact">
            <Field icon={<User className="h-3.5 w-3.5" />} label="First Name">
              <McInput value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Last Name">
              <McInput value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </Field>
            <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email">
              <McInput type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@boyanihealth.africandivinechurch.org" />
            </Field>
            <Field icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
              <McInput value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254 7XX XXX XXX" />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>

      {/* ── Login history modal (Instruction 18a) ── */}
      <PremiumModal
        open={lhOpen} onOpenChange={setLhOpen} size="xl"
        title={lhFor ? `Login History — ${lhFor.firstName || lhFor.username} ${lhFor.lastName || ''}`.trim() : 'All Login History'}
        icon={<History className="h-5 w-5" />}
        description={lhFor
          ? `${lhFor.username} · ${lhFor.role} — sessions, failed attempts, devices & durations`
          : 'Session audit across every system account — logins, failed attempts, devices & durations'}
        footerNote={lhTotal > lhRows.length
          ? `Showing the latest ${lhRows.length} of ${lhTotal} record(s) — narrow with the filters below`
          : `${lhFiltered.length} record(s) shown`}
        submitLabel="Close" onSubmit={() => setLhOpen(false)}
      >
        <div className="space-y-3">
          {/* Summary chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <LogIn className="h-3.5 w-3.5" /> Total logins: <b>{lhSummary.totalLogins}</b>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-semibold">
              <CalendarDays className="h-3.5 w-3.5" /> Unique days: <b>{lhSummary.uniqueDays}</b>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold">
              <Clock className="h-3.5 w-3.5" /> Avg duration: <b>{lhSummary.avgDuration ? fmtDuration(lhSummary.avgDuration) : '—'}</b>
            </span>
            {lhSummary.failed > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                <XCircle className="h-3.5 w-3.5" /> Failed attempts: <b>{lhSummary.failed}</b>
              </span>
            )}
          </div>

          {/* Filters: per-year / per-month / per-day + search (client-side) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={lhYear} onValueChange={v => { setLhYear(v); setLhMonth('all'); setLhDay('all'); }}>
              <SelectTrigger className="mc-input h-9 w-full"><SelectValue placeholder="All years" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {lhYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={lhMonth === 'all' ? 'all' : String(lhMonth)} onValueChange={v => { setLhMonth(v === 'all' ? 'all' : v); setLhDay('all'); }}>
              <SelectTrigger className="mc-input h-9 w-full"><SelectValue placeholder="All months" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {lhMonths.map(m => <SelectItem key={m} value={String(m)}>{MONTHS[m]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={lhDay === 'all' ? 'all' : String(lhDay)} onValueChange={v => setLhDay(v === 'all' ? 'all' : v)}>
              <SelectTrigger className="mc-input h-9 w-full"><SelectValue placeholder="All days" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All days</SelectItem>
                {lhDays.map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <McInput
                placeholder="Search user, IP, device…" value={lhSearch}
                onChange={e => setLhSearch(e.target.value)} className="pl-8"
              />
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* DataTable-style table */}
          <div className="rounded-xl border overflow-x-auto bg-white">
            <table className="mc-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Date</th>
                  {!lhFor && <th>User</th>}
                  <th>Action</th>
                  <th>IP Address</th>
                  <th>Device</th>
                  <th>Logged In</th>
                  <th>Logged Out</th>
                  <th style={{ textAlign: 'right' }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {lhLoading ? (
                  <tr><td colSpan={!lhFor ? 9 : 8} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
                ) : lhPaged.length === 0 ? (
                  <tr><td colSpan={!lhFor ? 9 : 8} className="text-center py-10 text-muted-foreground">No login history records</td></tr>
                ) : lhPaged.map((r, i) => (
                  <tr key={r.id}>
                    <td className="text-muted-foreground">{(Math.min(lhPage, lhTotalPages) - 1) * LH_PER_PAGE + i + 1}</td>
                    <td>{fmtDate(r.loggedInAt)}</td>
                    {!lhFor && (
                      <td>
                        {r.user ? (
                          <span className="font-semibold text-[var(--mc-text-primary)]">
                            {`${r.user.firstName} ${r.user.lastName}`.trim() || r.user.username}
                            <span className="text-muted-foreground font-normal text-xs"> · {r.user.role}</span>
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${ACTION_PILLS[r.action] || ACTION_PILLS.LOGOUT}`}>
                        {r.action === 'LOGIN' && <LogIn className="h-3 w-3" />}
                        {r.action === 'LOGOUT' && <LogOut className="h-3 w-3" />}
                        {r.action === 'FAILED' && <XCircle className="h-3 w-3" />}
                        {r.action}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{r.ipAddress || '—'}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <MonitorSmartphone className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
                        {shortDevice(r.userAgent)}
                      </span>
                    </td>
                    <td className="text-xs">{new Date(r.loggedInAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="text-xs">{r.loggedOutAt ? new Date(r.loggedOutAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style={{ textAlign: 'right' }} className="text-xs font-semibold">{fmtDuration(r.durationMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Client-side pagination */}
          {lhTotalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{lhFiltered.length} record(s)</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={lhPage <= 1} onClick={() => setLhPage(p => Math.max(1, p - 1))}>Prev</Button>
                <span className="px-2">Page {Math.min(lhPage, lhTotalPages)} / {lhTotalPages}</span>
                <Button variant="outline" size="sm" disabled={lhPage >= lhTotalPages} onClick={() => setLhPage(p => Math.min(lhTotalPages, p + 1))}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </PremiumModal>
    </div>
  );
}
