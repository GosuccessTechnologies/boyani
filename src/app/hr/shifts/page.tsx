'use client';

/**
 * HR SHIFTS — staff assignment (shift/duty/ward/clinic) CRUD.
 * ADMIN/HR assign; every staff member can VIEW their own via the same API
 * (this portal is ADMIN/HR so the full roster is visible).
 */

import * as React from 'react';
import {
  CalendarClock, User, Building2, Briefcase, Hospital, CalendarDays, Clock3, Clock,
  MoonStar, AlignLeft, Pencil, Trash2, Plus, ListChecks,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDate, isoDate, Field, FormSection, ConfirmModal, StatusBadge, PageHeading, SkeletonCards, McInput, McTextarea, McSelect } from '@/app/ops/_lib';

interface ShiftEmployee { id: string; employeeNo: string; firstName: string; lastName: string; department: string; profession: string; phone: string }
interface ShiftDepartment { id: string; name: string }
interface Assignment {
  id: string; employeeId: string; departmentId: string | null; assignmentType: string; wardOrClinic: string;
  shiftDate: string; shiftStart: string; shiftEnd: string; shiftType: string; notes: string; status: string;
  employee: ShiftEmployee; department: ShiftDepartment | null;
}
interface ShiftsResp { shifts: Assignment[]; total: number; page: number; perPage: number; totalPages: number }

const ASSIGNMENT_TYPES = ['SHIFT', 'DUTY', 'WARD', 'CLINIC'];
const SHIFT_TYPES = ['DAY', 'EVENING', 'NIGHT', 'ON_CALL'];
const STATUSES = ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

const emptyForm = {
  employeeId: '', departmentId: '', assignmentType: 'SHIFT', wardOrClinic: '',
  shiftDate: '', shiftStart: '08:00', shiftEnd: '17:00', shiftType: 'DAY', notes: '', status: 'SCHEDULED',
};

export default function HrShiftsPage() {
  const [shifts, setShifts] = React.useState<Assignment[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [employees, setEmployees] = React.useState<ShiftEmployee[]>([]);
  const [departments, setDepartments] = React.useState<ShiftDepartment[]>([]);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Assignment | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Assignment | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<ShiftsResp>(`/api/shifts?page=${p}&perPage=20`);
      setShifts(res.shifts || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(1); }, [load]);

  React.useEffect(() => {
    (async () => {
      try {
        const [empRes, depRes] = await Promise.all([
          apiGet<{ employees: ShiftEmployee[] }>('/api/employees?perPage=200'),
          apiGet<{ departments: ShiftDepartment[] }>('/api/departments'),
        ]);
        setEmployees(empRes.employees || []);
        setDepartments(depRes.departments || []);
      } catch {
        // selects fall back to manual entry below; keep silent
      }
    })();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, shiftDate: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };
  const openEdit = (a: Assignment) => {
    setEditing(a);
    setForm({
      employeeId: a.employeeId, departmentId: a.departmentId || '', assignmentType: a.assignmentType,
      wardOrClinic: a.wardOrClinic || '', shiftDate: isoDate(a.shiftDate),
      shiftStart: a.shiftStart || '08:00', shiftEnd: a.shiftEnd || '17:00',
      shiftType: a.shiftType || 'DAY', notes: a.notes || '', status: a.status || 'SCHEDULED',
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.employeeId) { toast.error('Select an employee'); return; }
    setSubmitting(true);
    try {
      const payload = {
        employeeId: form.employeeId,
        departmentId: form.departmentId || null,
        assignmentType: form.assignmentType,
        wardOrClinic: form.wardOrClinic,
        shiftDate: form.shiftDate || undefined,
        shiftStart: form.shiftStart, shiftEnd: form.shiftEnd,
        shiftType: form.shiftType, notes: form.notes,
        ...(editing ? { id: editing.id, status: form.status } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/shifts', payload)
        : await apiPost<{ message: string }>('/api/shifts', payload);
      toast.success(res.message || (editing ? 'Assignment updated' : 'Shift assigned'));
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/shifts?id=${deleting.id}`);
      toast.success(res.message || 'Assignment deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const ename = (a: Assignment) => a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : '—';
  const todayStr = new Date().toISOString().slice(0, 10);

  const columns: Column<Assignment>[] = [
    { key: 'employee', header: 'Employee', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {ename(r)}
        <span className="text-muted-foreground font-normal text-xs"> · {r.employee?.employeeNo}</span>
      </span>
    ), csvValue: r => ename(r) },
    { key: 'shiftDate', header: 'Date', defaultVisible: true, render: r => fmtDate(r.shiftDate), csvValue: r => (r.shiftDate ? r.shiftDate.slice(0, 10) : '') },
    { key: 'time', header: 'Time', defaultVisible: true, render: r => `${r.shiftStart} – ${r.shiftEnd}`, csvValue: r => `${r.shiftStart}-${r.shiftEnd}` },
    { key: 'status', header: 'Status', defaultVisible: true, render: r => <StatusBadge status={r.status} />, csvValue: r => r.status },
    { key: 'shiftType', header: 'Shift Type', render: r => <StatusBadge status={r.shiftType} />, csvValue: r => r.shiftType },
    { key: 'assignmentType', header: 'Assignment', csvValue: r => r.assignmentType },
    { key: 'wardOrClinic', header: 'Ward / Clinic' },
    { key: 'department', header: 'Department', csvValue: r => r.department?.name || '' },
    { key: 'notes', header: 'Notes' },
  ];

  const actions: ActionBtn[] = [
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit assignment', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete assignment', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const todayCount = shifts.filter(s => isoDate(s.shiftDate) === todayStr).length;
  const scheduled = shifts.filter(s => s.status === 'SCHEDULED').length;
  const nightCount = shifts.filter(s => s.shiftType === 'NIGHT').length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<CalendarClock className="h-5 w-5" />}
        title="Shift Assignment"
        subtitle="Duty roster — shifts, wards, clinics and on-call for every staff member"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> Assign Shift</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Assignments" value={total} icon={<ListChecks className="h-5 w-5" />} accent="primary" />
          <StatCard label="Today" value={todayCount} icon={<CalendarDays className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Scheduled" value={scheduled} icon={<CalendarClock className="h-5 w-5" />} accent="secondary" hint="awaiting start" />
          <StatCard label="Night Duty" value={nightCount} icon={<MoonStar className="h-5 w-5" />} accent="tertiary" hint="this page" />
        </div>
      )}

      <DataTable
        data={shifts} columns={columns} actions={actions}
        rowKey={r => r.id} title="Shift Roster" moduleLabel="HR Shift Assignments"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="lg"
        title={editing ? `Edit Assignment — ${ename(editing)}` : 'Assign Shift / Duty'}
        icon={<CalendarClock className="h-5 w-5" />}
        description={editing ? 'Update the roster entry or walk its status' : 'Only ADMIN & HR can assign shifts (permission matrix)'}
        footerNote="Every staff member sees their own assignments in their portal"
        submitLabel={editing ? 'Update Assignment' : 'Assign'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Assignment">
            <Field icon={<User className="h-3.5 w-3.5" />} label="Employee">
              {employees.length > 0 ? (
                <McSelect
                  value={form.employeeId}
                  onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}
                  options={employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName} · ${e.employeeNo}` }))}
                  placeholder="Select employee…"
                />
              ) : (
                <McInput value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} placeholder="Employee ID" />
              )}
            </Field>
            <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Department">
              {departments.length > 0 ? (
                <McSelect
                  value={form.departmentId}
                  onValueChange={v => setForm(f => ({ ...f, departmentId: v === 'none' ? '' : v }))}
                  options={[{ value: 'none', label: '— none —' }, ...departments.map(d => ({ value: d.id, label: d.name }))]}
                  placeholder="Select department…"
                />
              ) : (
                <McInput value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} placeholder="Department ID" />
              )}
            </Field>
            <Field icon={<Briefcase className="h-3.5 w-3.5" />} label="Assignment Type">
              <McSelect value={form.assignmentType} onValueChange={v => setForm(f => ({ ...f, assignmentType: v }))} options={ASSIGNMENT_TYPES.map(t => ({ value: t, label: t.replaceAll('_', ' ') }))} />
            </Field>
            <Field icon={<Hospital className="h-3.5 w-3.5" />} label="Ward / Clinic">
              <McInput value={form.wardOrClinic} onChange={e => setForm(f => ({ ...f, wardOrClinic: e.target.value }))} placeholder="Ward 3 / MCH Clinic" />
            </Field>
          </FormSection>

          <FormSection n={2} title="Schedule">
            <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Shift Date">
              <McInput type="date" value={form.shiftDate} onChange={e => setForm(f => ({ ...f, shiftDate: e.target.value }))} />
            </Field>
            <Field icon={<Clock3 className="h-3.5 w-3.5" />} label="Shift Type">
              <McSelect value={form.shiftType} onValueChange={v => setForm(f => ({ ...f, shiftType: v }))} options={SHIFT_TYPES.map(t => ({ value: t, label: t.replaceAll('_', ' ') }))} />
            </Field>
            <Field icon={<Clock className="h-3.5 w-3.5" />} label="Start Time">
              <McInput type="time" value={form.shiftStart} onChange={e => setForm(f => ({ ...f, shiftStart: e.target.value }))} />
            </Field>
            <Field icon={<Clock className="h-3.5 w-3.5" />} label="End Time">
              <McInput type="time" value={form.shiftEnd} onChange={e => setForm(f => ({ ...f, shiftEnd: e.target.value }))} />
            </Field>
            {editing && (
              <Field icon={<ListChecks className="h-3.5 w-3.5" />} label="Status" hint="SCHEDULED → ACTIVE → COMPLETED / CANCELLED">
                <McSelect value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} options={STATUSES.map(s => ({ value: s, label: s }))} />
              </Field>
            )}
          </FormSection>

          <FormSection n={3} title="Notes">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Assignment Notes" className="sm:col-span-2">
              <McTextarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Handover instructions, relief arrangements…" />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Assignment"
        message={deleting ? `Remove the ${deleting.assignmentType.toLowerCase()} for ${ename(deleting)} on ${fmtDate(deleting.shiftDate)}?` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
