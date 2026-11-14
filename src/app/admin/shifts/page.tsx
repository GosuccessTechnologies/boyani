'use client';

/**
 * STAFF SHIFTS & ASSIGNMENT — admin-only assigning (per requirements).
 * DataTable of /api/shifts + PremiumModal form (employee, department,
 * assignmentType, wardOrClinic, date, start/end, shiftType, notes, status).
 */

import * as React from 'react';
import {
  CalendarClock, User, Building2, Tag, MapPin, CalendarDays, Clock3, Moon, AlignLeft,
  Pencil, Trash2, Plus, Activity, Eye, Hash,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDate, isoDate, Field, FormSection, ConfirmModal, StatusBadge, PageHeading, SkeletonCards, McInput, McTextarea, ViewSection, ViewField } from '../_lib';

interface ShiftRow {
  id: string; employeeId: string; departmentId: string | null;
  assignmentType: string; wardOrClinic: string; shiftDate: string;
  shiftStart: string; shiftEnd: string; shiftType: string; notes: string; status: string;
  employee?: { id: string; employeeNo: string; firstName: string; lastName: string; department: string; profession: string; phone: string };
  department?: { id: string; name: string } | null;
}
interface Employee { id: string; employeeNo: string; firstName: string; lastName: string; department: string; profession: string }
interface Department { id: string; name: string }
interface ShiftsResp { shifts: ShiftRow[]; total: number; page: number; perPage: number; totalPages: number }

const ASSIGNMENT_TYPES = ['SHIFT', 'DUTY', 'WARD', 'CLINIC'];
const SHIFT_TYPES = ['DAY', 'EVENING', 'NIGHT', 'ON_CALL'];
const STATUSES = ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

const emptyForm = {
  employeeId: '', departmentId: '', assignmentType: 'SHIFT', wardOrClinic: '',
  shiftDate: '', shiftStart: '08:00', shiftEnd: '17:00', shiftType: 'DAY', notes: '', status: 'SCHEDULED',
};

export default function ShiftsPage() {
  const [shifts, setShifts] = React.useState<ShiftRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ShiftRow | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<ShiftRow | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [viewing, setViewing] = React.useState<ShiftRow | null>(null);

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

  React.useEffect(() => {
    load(1);
    apiGet<{ employees: Employee[] }>('/api/employees?perPage=200&isActive=true')
      .then(r => setEmployees(r.employees || []))
      .catch(() => {});
    apiGet<{ departments: Department[] }>('/api/departments')
      .then(r => setDepartments(r.departments || []))
      .catch(() => {});
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, shiftDate: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };
  const openEdit = (s: ShiftRow) => {
    setEditing(s);
    setForm({
      employeeId: s.employeeId, departmentId: s.departmentId || '',
      assignmentType: s.assignmentType || 'SHIFT', wardOrClinic: s.wardOrClinic || '',
      shiftDate: isoDate(s.shiftDate), shiftStart: s.shiftStart || '08:00', shiftEnd: s.shiftEnd || '17:00',
      shiftType: s.shiftType || 'DAY', notes: s.notes || '', status: s.status || 'SCHEDULED',
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.employeeId) { toast.error('Select an employee'); return; }
    if (!form.shiftDate) { toast.error('Shift date is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        employeeId: form.employeeId, departmentId: form.departmentId || null,
        assignmentType: form.assignmentType, wardOrClinic: form.wardOrClinic,
        shiftDate: form.shiftDate, shiftStart: form.shiftStart, shiftEnd: form.shiftEnd,
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

  const empName = (s: ShiftRow) => s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : '—';

  const columns: Column<ShiftRow>[] = [
    { key: 'employee', header: 'Employee', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {empName(r)}
        {r.employee && <span className="text-muted-foreground font-normal text-xs"> · {r.employee.employeeNo}</span>}
      </span>
    ), csvValue: r => empName(r) },
    { key: 'shiftDate', header: 'Date', defaultVisible: true, render: r => fmtDate(r.shiftDate), csvValue: r => (r.shiftDate ? r.shiftDate.slice(0, 10) : '') },
    { key: 'shiftType', header: 'Shift', defaultVisible: true, render: r => <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]">{r.shiftType}</span> },
    { key: 'status', header: 'Status', defaultVisible: true, render: r => <StatusBadge status={r.status} /> },
    { key: 'assignmentType', header: 'Assignment' },
    { key: 'wardOrClinic', header: 'Ward / Clinic' },
    { key: 'shiftStart', header: 'Start', csvValue: r => r.shiftStart },
    { key: 'shiftEnd', header: 'End', csvValue: r => r.shiftEnd },
    { key: 'department', header: 'Department', csvValue: r => r.department?.name || '' },
    { key: 'notes', header: 'Notes' },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View assignment', variant: 'view', onClick: r => setViewing(r) },
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit assignment', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete assignment', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const scheduled = shifts.filter(s => s.status === 'SCHEDULED').length;
  const active = shifts.filter(s => s.status === 'ACTIVE').length;
  const nightCount = shifts.filter(s => s.shiftType === 'NIGHT').length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<CalendarClock className="h-5 w-5" />}
        title="Staff Shifts & Assignment"
        subtitle="Roster duty, ward and clinic assignments — assigned by ADMIN only"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> Assign Shift</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Assignments" value={total} icon={<CalendarClock className="h-5 w-5" />} accent="primary" />
          <StatCard label="Scheduled" value={scheduled} icon={<CalendarDays className="h-5 w-5" />} accent="secondary" hint="this page" />
          <StatCard label="Active Now" value={active} icon={<Activity className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Night Duty" value={nightCount} icon={<Moon className="h-5 w-5" />} accent="tertiary" hint="this page" />
        </div>
      )}

      <DataTable
        data={shifts} columns={columns} actions={actions}
        rowKey={r => r.id} title="Shift Assignments" moduleLabel="Staff Shifts"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen}
        title={editing ? 'Edit Assignment' : 'Assign Shift'}
        icon={<CalendarClock className="h-5 w-5" />}
        description={editing ? `${empName(editing)} — adjust schedule or status` : 'Assign a shift, duty, ward or clinic to an employee'}
        footerNote="Staff can view their own assignments; assignment is admin-managed"
        submitLabel={editing ? 'Update Assignment' : 'Assign Shift'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Assignment">
            <Field icon={<User className="h-3.5 w-3.5" />} label="Employee">
              <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.firstName} {e.lastName} · {e.employeeNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Field icon={<Tag className="h-3.5 w-3.5" />} label="Assignment Type">
              <Select value={form.assignmentType} onValueChange={v => setForm(f => ({ ...f, assignmentType: v }))}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{ASSIGNMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Ward / Clinic">
              <McInput value={form.wardOrClinic} onChange={e => setForm(f => ({ ...f, wardOrClinic: e.target.value }))} placeholder="e.g. Female Medical Ward" />
            </Field>
          </FormSection>

          <FormSection n={2} title="Schedule">
            <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Shift Date">
              <McInput type="date" value={form.shiftDate} onChange={e => setForm(f => ({ ...f, shiftDate: e.target.value }))} />
            </Field>
            <Field icon={<Moon className="h-3.5 w-3.5" />} label="Shift Type">
              <Select value={form.shiftType} onValueChange={v => setForm(f => ({ ...f, shiftType: v }))}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{SHIFT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replaceAll('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field icon={<Clock3 className="h-3.5 w-3.5" />} label="Start Time">
              <McInput type="time" value={form.shiftStart} onChange={e => setForm(f => ({ ...f, shiftStart: e.target.value }))} />
            </Field>
            <Field icon={<Clock3 className="h-3.5 w-3.5" />} label="End Time">
              <McInput type="time" value={form.shiftEnd} onChange={e => setForm(f => ({ ...f, shiftEnd: e.target.value }))} />
            </Field>
            {editing && (
              <Field icon={<Activity className="h-3.5 w-3.5" />} label="Status" className="sm:col-span-2" hint="SCHEDULED → ACTIVE → COMPLETED / CANCELLED">
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            )}
          </FormSection>

          <FormSection n={3} title="Notes">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Notes" className="sm:col-span-2">
              <McTextarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Handover instructions, cover arrangements…" />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>

      {/* ── View assignment modal (Instruction 11) ── */}
      <PremiumModal
        open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }}
        title={viewing ? `${viewing.shiftType} Assignment — ${empName(viewing)}` : 'Assignment'}
        icon={<CalendarClock className="h-5 w-5" />}
        description={viewing ? `${viewing.assignmentType} · ${fmtDate(viewing.shiftDate)}` : ''}
        footerNote={viewing ? `${viewing.shiftStart} – ${viewing.shiftEnd} · ${viewing.status}` : ''}
        submitLabel="Close" onSubmit={() => setViewing(null)}
      >
        {viewing && (
          <div className="space-y-5">
            <ViewSection icon={<User className="h-3.5 w-3.5" />} title="Staff & Department">
              <ViewField icon={<User className="h-3.5 w-3.5" />} label="Employee" value={
                viewing.employee ? (
                  <span>
                    {empName(viewing)}
                    <span className="text-muted-foreground font-normal text-xs"> · {viewing.employee.employeeNo}</span>
                  </span>
                ) : '—'
              } />
              <ViewField icon={<Hash className="h-3.5 w-3.5" />} label="Profession" value={viewing.employee?.profession} />
              <ViewField icon={<Building2 className="h-3.5 w-3.5" />} label="Department" value={viewing.department?.name} />
              <ViewField icon={<Tag className="h-3.5 w-3.5" />} label="Assignment Type" value={viewing.assignmentType} />
            </ViewSection>

            <ViewSection icon={<CalendarClock className="h-3.5 w-3.5" />} title="Schedule">
              <ViewField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Date" value={fmtDate(viewing.shiftDate)} />
              <ViewField icon={<Moon className="h-3.5 w-3.5" />} label="Shift Type" value={viewing.shiftType} />
              <ViewField icon={<Clock3 className="h-3.5 w-3.5" />} label="Start Time" value={viewing.shiftStart} />
              <ViewField icon={<Clock3 className="h-3.5 w-3.5" />} label="End Time" value={viewing.shiftEnd} />
              <ViewField icon={<Activity className="h-3.5 w-3.5" />} label="Status" value={<StatusBadge status={viewing.status} />} />
              <ViewField icon={<MapPin className="h-3.5 w-3.5" />} label="Ward / Clinic" value={viewing.wardOrClinic} />
            </ViewSection>

            <ViewSection icon={<AlignLeft className="h-3.5 w-3.5" />} title="Notes">
              <ViewField icon={<AlignLeft className="h-3.5 w-3.5" />} label="Notes" value={viewing.notes} className="sm:col-span-2" />
            </ViewSection>
          </div>
        )}
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Assignment"
        message={deleting ? `Delete the ${deleting.shiftType} assignment for ${empName(deleting)} on ${fmtDate(deleting.shiftDate)}?` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
