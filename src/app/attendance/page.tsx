'use client';

/**
 * ATTENDANCE PWA — single-page app (mobile-first, installable).
 *
 *  • Big live clock + today's status card (check-in / check-out / work hours /
 *    PRESENT-LATE badge)
 *  • Check In / Check Out with GPS: navigator.geolocation → POST
 *    /api/attendance {action, latitude, longitude, device} — the API validates
 *    the haversine distance to the facility zone; if geolocation is denied we
 *    confirm and post without coords (api allows → gpsSkipped)
 *  • My history: month picker (?tab=my&month=YYYY-MM) as mobile cards + month
 *    summary (days present, late, total hours)
 *  • ADMIN extra tab "All Staff": GET /api/attendance (all records) with
 *    search + date range filters in a DataTable
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  LogIn, LogOut, Loader2, MapPin, CalendarDays, Clock, User, Users, Search, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { apiGet, apiPost } from '@/lib/client-api';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { fmtDate, fmtTime, currentMonth, isoDate, StatusBadge, McInput, McSelect } from '@/app/pos/_lib';
import { InstallPrompt } from './_install-prompt';

// ── API shapes (src/app/api/attendance/route.ts) ──
interface AttRecord {
  id: string;
  userId: string;
  employeeId?: string | null;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string; // PRESENT | LATE | ABSENT | ON_LEAVE | HALF_DAY
  workHours: number;
  notes?: string;
  employee?: { id: string; employeeNo: string; firstName: string; lastName: string; department: string } | null;
}
interface AttResponse {
  record: AttRecord;
  gpsSkipped?: boolean;
  workHours?: number;
  message: string;
}

const hoursLabel = (h: number) => {
  const v = Number(h) || 0;
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)}h`;
};

export default function AttendancePage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  // auth guard — staff of ANY role
  React.useEffect(() => {
    if (!token) router.replace('/login');
  }, [token, router]);

  // ── live clock (client-only to avoid SSR/CSR mismatch) ──
  const [mounted, setMounted] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── tabs ──
  const [tab, setTab] = React.useState<'me' | 'all'>('me');

  // ── today's record ──
  const [todayRec, setTodayRec] = React.useState<AttRecord | null>(null);
  const [todayLoading, setTodayLoading] = React.useState(true);

  const loadToday = React.useCallback(async () => {
    setTodayLoading(true);
    try {
      const res = await apiGet<{ records: AttRecord[] }>(`/api/attendance?tab=my&specificDate=${isoDate()}`);
      setTodayRec(res.records[0] || null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load today\'s attendance');
    } finally {
      setTodayLoading(false);
    }
  }, []);

  // ── my month history ──
  const [month, setMonth] = React.useState(currentMonth());
  const [myRecords, setMyRecords] = React.useState<AttRecord[]>([]);
  const [myLoading, setMyLoading] = React.useState(true);

  const loadMy = React.useCallback(async () => {
    setMyLoading(true);
    try {
      const res = await apiGet<{ records: AttRecord[] }>(`/api/attendance?tab=my&month=${month}&perPage=62`);
      setMyRecords(res.records);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load attendance history');
    } finally {
      setMyLoading(false);
    }
  }, [month]);

  React.useEffect(() => { loadToday(); }, [loadToday]);
  React.useEffect(() => { loadMy(); }, [loadMy]);

  // ── check-in / check-out with GPS ──
  const [busy, setBusy] = React.useState<'check-in' | 'check-out' | null>(null);

  const handleResponse = (res: AttResponse) => {
    toast.success(res.message + (res.gpsSkipped ? ' (GPS skipped)' : ''));
    setTodayRec(res.record);
    loadMy();
  };

  const doAction = (action: 'check-in' | 'check-out') => {
    setBusy(action);
    const device = navigator.userAgent.slice(0, 80);

    const send = async (latitude?: number, longitude?: number) => {
      try {
        const res = await apiPost<AttResponse>('/api/attendance', {
          action, latitude, longitude, device,
        });
        handleResponse(res);
      } catch (e) {
        // GPS-out-of-zone error carries the distance message from the API
        toast.error(e instanceof Error ? e.message : 'Failed to record attendance');
      } finally {
        setBusy(null);
      }
    };

    const sendWithoutGps = () => send();

    if (!('geolocation' in navigator)) {
      if (window.confirm('Share location to verify you are at the facility. Continue without GPS?')) sendWithoutGps();
      else setBusy(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => { void send(pos.coords.latitude, pos.coords.longitude); },
      () => {
        // permission denied / unavailable / timeout → confirm fallback
        if (window.confirm('Share location to verify you are at the facility. Continue without GPS?')) sendWithoutGps();
        else setBusy(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const checkedIn = !!todayRec?.checkIn;
  const checkedOut = !!todayRec?.checkOut;

  // ── month summary ──
  const daysPresent = myRecords.filter(r => r.status === 'PRESENT').length;
  const lateDays = myRecords.filter(r => r.status === 'LATE').length;
  const totalHours = myRecords.reduce((s, r) => s + (r.workHours || 0), 0);

  // ── admin: all staff records ──
  const [allRecords, setAllRecords] = React.useState<AttRecord[]>([]);
  const [allLoading, setAllLoading] = React.useState(false);
  const [allTotal, setAllTotal] = React.useState(0);
  const [allPage, setAllPage] = React.useState(1);
  const [allSearch, setAllSearch] = React.useState('');
  const [allDateFrom, setAllDateFrom] = React.useState('');
  const [allDateTo, setAllDateTo] = React.useState('');
  const [allStatus, setAllStatus] = React.useState('');

  const loadAll = React.useCallback(async () => {
    if (!isAdmin || tab !== 'all') return;
    setAllLoading(true);
    try {
      const params = new URLSearchParams({ page: String(allPage), perPage: '31' });
      if (allSearch.trim()) params.set('search', allSearch.trim());
      if (allDateFrom) params.set('dateFrom', allDateFrom);
      if (allDateTo) params.set('dateTo', allDateTo);
      if (allStatus) params.set('status', allStatus);
      const res = await apiGet<{ records: AttRecord[]; total: number }>(`/api/attendance?${params}`);
      setAllRecords(res.records);
      setAllTotal(res.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load staff attendance');
    } finally {
      setAllLoading(false);
    }
  }, [isAdmin, tab, allPage, allSearch, allDateFrom, allDateTo, allStatus]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const allColumns: Column<AttRecord>[] = [
    {
      key: 'employee', header: 'Employee', defaultVisible: true,
      render: r => (
        <div className="min-w-0">
          <p className="font-medium truncate">
            {r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : 'Unlinked account'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {r.employee?.employeeNo || r.employee?.department || '—'}
          </p>
        </div>
      ),
      csvValue: r => (r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : ''),
    },
    { key: 'date', header: 'Date', defaultVisible: true, render: r => fmtDate(r.date), csvValue: r => r.date },
    { key: 'checkIn', header: 'Check-in', defaultVisible: true, render: r => fmtTime(r.checkIn), csvValue: r => r.checkIn || '' },
    { key: 'checkOut', header: 'Check-out', defaultVisible: true, render: r => fmtTime(r.checkOut), csvValue: r => r.checkOut || '' },
    { key: 'workHours', header: 'Hours', align: 'right', render: r => hoursLabel(r.workHours), csvValue: r => r.workHours },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status} /> },
  ];

  if (!token) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading attendance…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* install prompt (PWA) */}
      <InstallPrompt />

      {/* tabs */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] p-1">
        <button
          type="button"
          className={`h-11 rounded-lg flex items-center justify-center gap-1.5 text-sm font-bold transition-colors ${
            tab === 'me' ? 'bg-[var(--mc-primary)] text-white shadow' : 'text-[var(--mc-text-secondary)]'
          }`}
          onClick={() => setTab('me')}
        >
          <User className="h-4 w-4" /> My Attendance
        </button>
        {isAdmin ? (
          <button
            type="button"
            className={`h-11 rounded-lg flex items-center justify-center gap-1.5 text-sm font-bold transition-colors ${
              tab === 'all' ? 'bg-[var(--mc-primary)] text-white shadow' : 'text-[var(--mc-text-secondary)]'
            }`}
            onClick={() => setTab('all')}
          >
            <Users className="h-4 w-4" /> All Staff
          </button>
        ) : (
          <div className="h-11 rounded-lg flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <CalendarDays className="h-4 w-4" /> {myRecords.length} day(s)
          </div>
        )}
      </div>

      {tab === 'me' ? (
        <>
          {/* ── live clock ── */}
          <div className="rounded-2xl mc-gradient-primary text-white p-5 text-center shadow-lg">
            <p className="text-xs uppercase tracking-widest text-white/70 font-bold">
              {mounted ? now.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '— — —'}
            </p>
            <p className="text-4xl font-extrabold tabular-nums tracking-tight mt-1.5">
              {mounted ? now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
            </p>
          </div>

          {/* ── today's status card ── */}
          <div className="rounded-2xl border border-[var(--mc-divider)] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[var(--mc-text-primary)] flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-[var(--mc-primary)]" /> Today
              </h2>
              {todayLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : todayRec ? (
                <StatusBadge status={todayRec.status} />
              ) : (
                <span className="text-[11px] text-muted-foreground font-semibold">Not checked in</span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] p-2">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Check-in</p>
                <p className="text-sm font-bold text-[var(--mc-text-primary)]">{fmtTime(todayRec?.checkIn)}</p>
              </div>
              <div className="rounded-xl bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] p-2">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Check-out</p>
                <p className="text-sm font-bold text-[var(--mc-text-primary)]">{fmtTime(todayRec?.checkOut)}</p>
              </div>
              <div className="rounded-xl bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] p-2">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Work hours</p>
                <p className="text-sm font-bold text-[var(--mc-primary)]">
                  {todayRec?.workHours ? hoursLabel(todayRec.workHours) : '—'}
                </p>
              </div>
            </div>

            {/* GPS hint */}
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[var(--mc-primary)] shrink-0" />
              You must be within the facility GPS zone (configured by admin).
            </p>

            {/* big action buttons (≥44px touch targets) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy !== null || checkedIn}
                onClick={() => doAction('check-in')}
                className="h-14 rounded-2xl bg-[var(--mc-primary)] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow disabled:opacity-40 disabled:shadow-none active:scale-[0.98] transition-all"
              >
                {busy === 'check-in' ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                {busy === 'check-in' ? 'Checking in…' : checkedIn ? 'Checked In' : 'Check In'}
              </button>
              <button
                type="button"
                disabled={busy !== null || !checkedIn || checkedOut}
                onClick={() => doAction('check-out')}
                className="h-14 rounded-2xl border-2 border-[var(--mc-primary)] text-[var(--mc-primary)] bg-white font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {busy === 'check-out' ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                {busy === 'check-out' ? 'Checking out…' : checkedOut ? 'Checked Out' : 'Check Out'}
              </button>
            </div>
          </div>

          {/* ── month history ── */}
          <div className="rounded-2xl border border-[var(--mc-divider)] bg-white p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--mc-primary)]" />
              <h2 className="text-sm font-bold text-[var(--mc-text-primary)] flex-1">My History</h2>
              <input
                type="month"
                value={month}
                max={currentMonth()}
                onChange={e => setMonth(e.target.value || currentMonth())}
                className="mc-input h-9 px-2 text-sm bg-white"
              />
            </div>

            {/* month summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2">
                <p className="text-[10px] uppercase font-bold text-emerald-700">Days present</p>
                <p className="text-lg font-extrabold text-emerald-700">{daysPresent}</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-2">
                <p className="text-[10px] uppercase font-bold text-amber-700">Late</p>
                <p className="text-lg font-extrabold text-amber-700">{lateDays}</p>
              </div>
              <div className="rounded-xl bg-[var(--mc-primary-light)] border border-[var(--mc-divider)] p-2">
                <p className="text-[10px] uppercase font-bold text-[var(--mc-primary-dark)]">Total hours</p>
                <p className="text-lg font-extrabold text-[var(--mc-primary-dark)]">{hoursLabel(totalHours)}</p>
              </div>
            </div>

            {/* records — mobile cards */}
            {myLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-[var(--mc-bg-card)] animate-pulse border border-[var(--mc-divider)]" />
                ))}
              </div>
            ) : myRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No attendance records for this month yet.
              </p>
            ) : (
              <div className="space-y-2">
                {myRecords.map(r => (
                  <div key={r.id} className="rounded-xl border border-[var(--mc-divider)] p-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[var(--mc-text-primary)]">{fmtDate(r.date)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtTime(r.checkIn)} → {fmtTime(r.checkOut)} · {r.workHours ? hoursLabel(r.workHours) : '—'}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── ADMIN: all staff attendance ── */
        <div className="space-y-3">
          <div className="rounded-2xl border border-[var(--mc-divider)] bg-white p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--mc-primary)]" />
              <h2 className="text-sm font-bold text-[var(--mc-text-primary)] flex-1">All Staff Attendance</h2>
              <button
                type="button"
                className="h-11 px-3 rounded-xl border border-[var(--mc-divider)] text-xs font-semibold text-[var(--mc-text-secondary)] hover:bg-[var(--mc-primary-light)] flex items-center gap-1"
                onClick={() => loadAll()}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <McInput
                className="pl-8"
                placeholder="Search staff by name or employee No…"
                value={allSearch}
                onChange={e => { setAllSearch(e.target.value); setAllPage(1); }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <McInput type="date" value={allDateFrom} onChange={e => { setAllDateFrom(e.target.value); setAllPage(1); }} />
              <McInput type="date" value={allDateTo} onChange={e => { setAllDateTo(e.target.value); setAllPage(1); }} />
            </div>
            <McSelect
              value={allStatus}
              onValueChange={v => { setAllStatus(v); setAllPage(1); }}
              options={[
                { value: 'PRESENT', label: 'Present' },
                { value: 'LATE', label: 'Late' },
                { value: 'ABSENT', label: 'Absent' },
                { value: 'ON_LEAVE', label: 'On leave' },
                { value: 'HALF_DAY', label: 'Half day' },
              ]}
              placeholder="All statuses"
            />
          </div>

          <DataTable<AttRecord>
            data={allRecords}
            columns={allColumns}
            rowKey={r => r.id}
            loading={allLoading}
            moduleLabel="staff-attendance"
            title="All Staff Attendance"
            emptyMessage="No attendance records match the filters"
            page={allPage}
            perPage={31}
            total={allTotal}
            onPageChange={p => setAllPage(p)}
          />
        </div>
      )}
    </div>
  );
}
