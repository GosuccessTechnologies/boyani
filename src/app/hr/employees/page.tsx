'use client';

/**
 * HR EMPLOYEES — staff registry: DataTable + full-profile multi-section modal
 * + CSV bulk import. Data: /api/employees (ADMIN + HR guarded).
 */

import * as React from 'react';
import {
  IdCard, User, AlignLeft, Building2, Briefcase, GraduationCap, Phone, Mail, Fingerprint,
  FileBadge, Banknote, Landmark, Pencil, Trash2, Plus, FileText, CalendarDays, Cake, ShieldAlert, ImageIcon,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { FileUploader } from '@/components/shared/FileUploader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, fmtDate, isoDate, Field, FormSection, ConfirmModal, BoolPill, PageHeading, SkeletonCards, McInput, CsvImportControls } from '@/app/ops/_lib';

interface Employee {
  id: string; employeeNo: string; firstName: string; lastName: string; userId: string | null;
  department: string; position: string; profession: string; specialization: string;
  phone: string; email: string; nationalId: string; kraPin: string; nssfNo: string; nhifNo: string;
  gender: string; dateOfBirth: string | null; address: string;
  startDate: string; endDate: string | null; salary: number;
  bankName: string; bankAccount: string; photoUrl: string; isActive: boolean;
  _count?: { attendance: number; payrolls: number; assignments: number };
}
interface EmployeesResp { employees: Employee[]; total: number; page: number; perPage: number; totalPages: number }

const CSV_HEADERS = ['firstName', 'lastName', 'department', 'position', 'profession', 'phone', 'email', 'nationalId', 'kraPin', 'nssfNo', 'nhifNo', 'salary', 'gender', 'startDate'];

const emptyForm = {
  firstName: '', lastName: '', department: '', position: '', profession: '', specialization: '',
  phone: '', email: '', nationalId: '', kraPin: '', nssfNo: '', nhifNo: '', gender: '',
  dateOfBirth: '', address: '', startDate: '', endDate: '', salary: '',
  bankName: '', bankAccount: '', photoUrl: '',
};

export default function HrEmployeesPage() {
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Employee | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Employee | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [csvOpen, setCsvOpen] = React.useState(false);
  const [csvBusy, setCsvBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<EmployeesResp>(`/api/employees?page=${p}&perPage=20`);
      setEmployees(res.employees || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(1); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, startDate: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };
  const openEdit = (e: Employee) => {
    setEditing(e);
    setForm({
      firstName: e.firstName, lastName: e.lastName, department: e.department || '',
      position: e.position || '', profession: e.profession || '', specialization: e.specialization || '',
      phone: e.phone || '', email: e.email || '', nationalId: e.nationalId || '', kraPin: e.kraPin || '',
      nssfNo: e.nssfNo || '', nhifNo: e.nhifNo || '', gender: e.gender || '',
      dateOfBirth: isoDate(e.dateOfBirth), address: e.address || '',
      startDate: isoDate(e.startDate), endDate: isoDate(e.endDate), salary: String(e.salary ?? ''),
      bankName: e.bankName || '', bankAccount: e.bankAccount || '', photoUrl: e.photoUrl || '',
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { toast.error('First and last name are required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName.trim(), lastName: form.lastName.trim(),
        department: form.department, position: form.position, profession: form.profession,
        specialization: form.specialization, phone: form.phone, email: form.email,
        nationalId: form.nationalId, kraPin: form.kraPin, nssfNo: form.nssfNo, nhifNo: form.nhifNo,
        gender: form.gender, dateOfBirth: form.dateOfBirth || null, address: form.address,
        startDate: form.startDate || undefined, endDate: form.endDate || null,
        salary: Number(form.salary) || 0,
        bankName: form.bankName, bankAccount: form.bankAccount, photoUrl: form.photoUrl,
        ...(editing ? { id: editing.id } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/employees', payload)
        : await apiPost<{ message: string }>('/api/employees', payload);
      toast.success(res.message || (editing ? 'Employee updated' : 'Employee registered'));
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save employee');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string; softDeleted?: boolean }>(`/api/employees?id=${deleting.id}`);
      toast.success(res.message || 'Employee removed');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const importCsv = async (rows: Array<Record<string, string>>) => {
    setCsvBusy(true);
    try {
      const bulkItems = rows.map(r => ({
        firstName: r.firstName, lastName: r.lastName, department: r.department,
        position: r.position, profession: r.profession, phone: r.phone, email: r.email,
        nationalId: r.nationalId, kraPin: r.kraPin, nssfNo: r.nssfNo, nhifNo: r.nhifNo,
        salary: r.salary, gender: r.gender, startDate: r.startDate,
      }));
      const res = await apiPost<{ imported: number }>('/api/employees', { bulkItems });
      toast.success(`Imported ${res.imported} employee(s)`);
      setCsvOpen(false);
      load(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'CSV import failed');
    } finally {
      setCsvBusy(false);
    }
  };

  const name = (e: Employee) => `${e.firstName} ${e.lastName}`;

  const columns: Column<Employee>[] = [
    { key: 'name', header: 'Employee', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {name(r)}
        <span className="text-muted-foreground font-normal text-xs"> · {r.employeeNo}</span>
      </span>
    ), csvValue: r => name(r) },
    { key: 'department', header: 'Department', defaultVisible: true },
    { key: 'position', header: 'Position', defaultVisible: true },
    { key: 'isActive', header: 'Status', defaultVisible: true, render: r => <BoolPill value={r.isActive} trueLabel="Active" falseLabel="Ended" />, csvValue: r => (r.isActive ? 'ACTIVE' : 'INACTIVE') },
    { key: 'profession', header: 'Profession' },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email' },
    { key: 'salary', header: 'Salary', align: 'right', render: r => kes(r.salary), csvValue: r => r.salary },
    { key: 'startDate', header: 'Start Date', render: r => fmtDate(r.startDate), csvValue: r => (r.startDate ? r.startDate.slice(0, 10) : '') },
    { key: 'endDate', header: 'End Date', render: r => fmtDate(r.endDate), csvValue: r => (r.endDate ? r.endDate.slice(0, 10) : '') },
    { key: 'nationalId', header: 'National ID' },
    { key: 'kraPin', header: 'KRA PIN' },
    { key: 'nssfNo', header: 'NSSF No.' },
    { key: 'nhifNo', header: 'SHIF No.' },
    { key: 'bankName', header: 'Bank' },
    { key: 'specialization', header: 'Specialization' },
  ];

  const actions: ActionBtn[] = [
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit employee', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete employee', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const activeCount = employees.filter(e => e.isActive).length;
  const payrollMass = employees.reduce((s, e) => s + (e.isActive ? e.salary || 0 : 0), 0);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<IdCard className="h-5 w-5" />}
        title="Employees Registry"
        subtitle="Staff master file — demographics, roles, statutory numbers, salary & bank details"
        actions={<>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setCsvOpen(true)}><FileText className="h-4 w-4" /> CSV Import</Button>
          <Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Employee</Button>
        </>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Employees" value={total} icon={<IdCard className="h-5 w-5" />} accent="primary" />
          <StatCard label="Active" value={activeCount} icon={<User className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Monthly Payroll" value={kes(payrollMass)} icon={<Banknote className="h-5 w-5" />} accent="secondary" hint="basic salaries, this page" />
          <StatCard label="Departments" value={new Set(employees.map(e => e.department).filter(Boolean)).size} icon={<Building2 className="h-5 w-5" />} accent="tertiary" />
        </div>
      )}

      <DataTable
        data={employees} columns={columns} actions={actions}
        rowKey={r => r.id} title="Employees" moduleLabel="HR Employees Registry"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="lg"
        title={editing ? `Edit Employee — ${editing.employeeNo}` : 'New Employee'}
        icon={<IdCard className="h-5 w-5" />}
        description={editing ? 'Update staff record; setting an end-date deactivates' : 'Employee number (EMP-…) is generated automatically'}
        footerNote="Payroll, attendance & assignment history is preserved on deletion"
        submitLabel={editing ? 'Update Employee' : 'Register Employee'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Identity & Photo">
            <Field icon={<User className="h-3.5 w-3.5" />} label="First Name">
              <McInput value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Last Name">
              <McInput value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </Field>
            <Field icon={<Fingerprint className="h-3.5 w-3.5" />} label="National ID">
              <McInput value={form.nationalId} onChange={e => setForm(f => ({ ...f, nationalId: e.target.value }))} placeholder="12345678" />
            </Field>
            <Field icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Gender">
              <Select value={form.gender || 'none'} onValueChange={v => setForm(f => ({ ...f, gender: v === 'none' ? '' : v }))}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— unspecified —</SelectItem>
                  <SelectItem value="MALE">MALE</SelectItem>
                  <SelectItem value="FEMALE">FEMALE</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field icon={<Cake className="h-3.5 w-3.5" />} label="Date of Birth">
              <McInput type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
            </Field>
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Postal Address">
              <McInput value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </Field>
            <Field icon={<ImageIcon className="h-3.5 w-3.5" />} label="Staff Photo" className="sm:col-span-2">
              <FileUploader value={form.photoUrl} onChange={url => setForm(f => ({ ...f, photoUrl: url }))} module="HR" label="Upload staff photo" />
            </Field>
          </FormSection>

          <FormSection n={2} title="Employment">
            <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Department">
              <McInput value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Nursing" />
            </Field>
            <Field icon={<Briefcase className="h-3.5 w-3.5" />} label="Position">
              <McInput value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Ward In-charge" />
            </Field>
            <Field icon={<GraduationCap className="h-3.5 w-3.5" />} label="Profession">
              <McInput value={form.profession} onChange={e => setForm(f => ({ ...f, profession: e.target.value }))} placeholder="Registered Nurse" />
            </Field>
            <Field icon={<GraduationCap className="h-3.5 w-3.5" />} label="Specialization">
              <McInput value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} placeholder="ICU / Critical care" />
            </Field>
            <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Start Date">
              <McInput type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </Field>
            <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="End Date (optional)" hint="Setting an end date deactivates the employee">
              <McInput type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </Field>
            <Field icon={<Banknote className="h-3.5 w-3.5" />} label="Basic Salary (KSh)">
              <McInput type="number" min="0" step="0.01" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} />
            </Field>
          </FormSection>

          <FormSection n={3} title="Contact & Statutory Compliance">
            <Field icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
              <McInput value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254 7XX XXX XXX" />
            </Field>
            <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email">
              <McInput type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field icon={<FileBadge className="h-3.5 w-3.5" />} label="KRA PIN">
              <McInput value={form.kraPin} onChange={e => setForm(f => ({ ...f, kraPin: e.target.value }))} placeholder="A123456789B" />
            </Field>
            <Field icon={<FileBadge className="h-3.5 w-3.5" />} label="NSSF No.">
              <McInput value={form.nssfNo} onChange={e => setForm(f => ({ ...f, nssfNo: e.target.value }))} />
            </Field>
            <Field icon={<FileBadge className="h-3.5 w-3.5" />} label="SHIF / NHIF No.">
              <McInput value={form.nhifNo} onChange={e => setForm(f => ({ ...f, nhifNo: e.target.value }))} />
            </Field>
          </FormSection>

          <FormSection n={4} title="Bank Details">
            <Field icon={<Landmark className="h-3.5 w-3.5" />} label="Bank Name">
              <McInput value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="Equity Bank" />
            </Field>
            <Field icon={<Landmark className="h-3.5 w-3.5" />} label="Bank Account">
              <McInput value={form.bankAccount} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} placeholder="1234567890" />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>

      <PremiumModal
        open={csvOpen} onOpenChange={setCsvOpen}
        title="Bulk Import Employees"
        icon={<FileText className="h-5 w-5" />}
        description="Download the CSV template, fill one employee per row, then import"
        footerNote="Rows missing first/last name are skipped — EMP numbers auto-generated"
        submitLabel="Close" onSubmit={() => setCsvOpen(false)}
      >
        <CsvImportControls templateName="hr-employees-template.csv" headers={CSV_HEADERS} onParsed={importCsv} note={`Columns: ${CSV_HEADERS.join(', ')} — dates as YYYY-MM-DD`} />
        {csvBusy && <p className="text-xs text-muted-foreground mt-3">Importing…</p>}
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Employee"
        message={deleting ? `Delete ${name(deleting)}? Employees with payroll/attendance/assignment history are deactivated instead.` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
