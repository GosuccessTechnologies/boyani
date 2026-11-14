'use client';

/**
 * HR PAYROLL — month/year picker, batch "Generate Payroll" (loops the
 * single-employee POST over active employees with a progress bar),
 * records DataTable, approve / mark-paid actions, and an itemised payslip
 * modal with printable PDF download (facility hero header from /api/company).
 */

import * as React from 'react';
import {
  Banknote, User, CalendarDays, TrendingUp, Wallet, CheckCircle2,
  BadgeCheck, Eye, Trash2, Printer, Play, ListFilter, Landmark, FileText, Loader2,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, fmtDate, fmtDateTime, monthName, Field, ConfirmModal, StatusBadge, PageHeading, SkeletonCards, McSelect } from '@/app/ops/_lib';

interface PayrollEmployee { id: string; employeeNo: string; firstName: string; lastName: string; department: string; position: string }
interface Payroll {
  id: string; payrollNo: string; employeeId: string; employee: PayrollEmployee;
  periodMonth: number; periodYear: number;
  basicSalary: number; allowances: number; overtime: number; bonuses: number;
  grossPay: number; paye: number; nssfDeduction: number; shifDeduction: number;
  housingLevy: number; otherDeductions: number; netPay: number;
  status: string; paidAt: string | null; notes: string; createdAt: string;
}
interface PayrollsResp { payrolls: Payroll[]; total: number; page: number; perPage: number; totalPages: number }
interface CompanyConfig { [k: string]: string }

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }));
const YEARS = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - 3 + i));
const STATUS_FILTERS = ['', 'DRAFT', 'APPROVED', 'PAID'];

const ename = (p: Payroll) => p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—';

export default function HrPayrollPage() {
  const now = new Date();
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [statusFilter, setStatusFilter] = React.useState('');

  const [payrolls, setPayrolls] = React.useState<Payroll[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [company, setCompany] = React.useState<CompanyConfig>({});

  const [generating, setGenerating] = React.useState(false);
  const [genProgress, setGenProgress] = React.useState({ done: 0, total: 0, label: '' });

  const [viewing, setViewing] = React.useState<Payroll | null>(null);
  const [busyKeys, setBusyKeys] = React.useState<Set<string>>(new Set());

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Payroll | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiGet<PayrollsResp>(`/api/payroll?periodMonth=${month}&periodYear=${year}${statusFilter ? `&status=${statusFilter}` : ''}&page=${p}&perPage=20`);
      setPayrolls(res.payrolls || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load payroll records');
    } finally {
      setLoading(false);
    }
  }, [month, year, statusFilter]);

  React.useEffect(() => { load(1); }, [load]);

  React.useEffect(() => {
    apiGet<{ config: CompanyConfig }>('/api/company')
      .then(r => setCompany(r.config || {}))
      .catch(() => {});
  }, []);

  // ── Batch generate: loop the single-employee POST over active employees ──
  const generatePayroll = async () => {
    setGenerating(true);
    setGenProgress({ done: 0, total: 0, label: 'Fetching active employees…' });
    try {
      const empRes = await apiGet<{ employees: Array<PayrollEmployee & { salary: number }> }>('/api/employees?isActive=true&perPage=200');
      const employees = empRes.employees || [];
      if (!employees.length) {
        toast.info('No active employees to generate payroll for');
        setGenerating(false);
        return;
      }
      let created = 0, updated = 0, failed = 0;
      for (let i = 0; i < employees.length; i++) {
        const e = employees[i];
        setGenProgress({ done: i, total: employees.length, label: `${e.firstName} ${e.lastName} (${e.employeeNo})` });
        try {
          const res = await apiPost<{ updated?: boolean }>('/api/payroll', {
            employeeId: e.id,
            periodMonth: month,
            periodYear: year,
            basicSalary: e.salary || 0,
            allowances: 0, overtime: 0, bonuses: 0, otherDeductions: 0,
            notes: `Batch payroll — ${monthName(Number(month))} ${year}`,
          });
          if (res.updated) updated++; else created++;
        } catch {
          failed++;
        }
      }
      setGenProgress({ done: employees.length, total: employees.length, label: 'Complete' });
      toast.success(`Payroll for ${monthName(Number(month))} ${year}: ${created} created, ${updated} updated${failed ? `, ${failed} failed` : ''}`);
      load(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate payroll');
    } finally {
      setGenerating(false);
    }
  };

  const setStatus = async (p: Payroll, status: 'APPROVED' | 'PAID') => {
    const key = `${p.id}-${status}`;
    setBusyKeys(k => new Set(k).add(key));
    try {
      const res = await apiPut<{ message: string }>('/api/payroll', { id: p.id, status });
      toast.success(res.message || `Payroll ${p.payrollNo} marked ${status}`);
      load(page);
      if (viewing?.id === p.id) {
        const refreshed = await apiGet<{ payroll: Payroll }>(`/api/payroll?id=${p.id}`);
        setViewing(refreshed.payroll);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update payroll');
    } finally {
      setBusyKeys(k => { const n = new Set(k); n.delete(key); return n; });
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/payroll?id=${deleting.id}`);
      toast.success(res.message || 'Draft payroll deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  // ── Printable payslip (facility hero + employee + earnings/deductions) ──
  const printPayslip = (p: Payroll) => {
    const facilityName = company.companyName || 'Boyani Health Dispensary';
    const address = company.companyAddress || '';
    const phone = company.companyPhone || '';
    const email = company.companyEmail || '';
    const kraPin = company.kraPin || '';
    const period = `${monthName(p.periodMonth)} ${p.periodYear}`;
    const money = (n: number) => `KSh ${Number(n || 0).toLocaleString('en-KE')}`;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { toast.error('Popup blocked — allow popups to print'); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>Payslip ${p.payrollNo}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
        .hero { text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 12px; margin-bottom: 16px; }
        .hero h1 { margin: 0; font-size: 22px; color: #0d9488; }
        .hero p { margin: 4px 0; font-size: 12px; color: #64748b; }
        h2 { font-size: 14px; color: #134e4a; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 1px; }
        .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 14px; }
        .meta b { display: block; font-size: 13px; margin-bottom: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
        th { background: #134e4a; color: #fff; padding: 8px; text-align: left; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) td { background: #f0fdfa; }
        td.r, th.r { text-align: right; }
        .net { margin-top: 14px; margin-left: auto; width: 320px; font-size: 13px; }
        .net div { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #cbd5e1; }
        .net .grand { font-weight: bold; font-size: 15px; color: #0d9488; border-bottom: none; }
        .foot { margin-top: 24px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        .pill { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: bold; }
      </style></head><body>
      <div class="hero">
        <h1>${facilityName}</h1>
        <p>${address}${phone ? ` · ${phone}` : ''}${email ? ` · ${email}` : ''}</p>
        <p>${kraPin ? `KRA PIN: ${kraPin} · ` : ''}PAYSLIP — ${period}</p>
      </div>
      <div class="meta">
        <div><b>${ename(p)}</b>${p.employee?.employeeNo || ''}${p.employee?.department ? ` · ${p.employee.department}` : ''}${p.employee?.position ? ` · ${p.employee.position}` : ''}</div>
        <div style="text-align:right"><b>${p.payrollNo}</b>Period: ${period}<br/>Status: <span class="pill">${p.status}</span>${p.paidAt ? `<br/>Paid: ${new Date(p.paidAt).toLocaleDateString('en-KE')}` : ''}</div>
      </div>
      <h2>Earnings</h2>
      <table><thead><tr><th>#</th><th>Description</th><th class="r">Amount</th></tr></thead><tbody>
        <tr><td>1</td><td>Basic Salary</td><td class="r">${money(p.basicSalary)}</td></tr>
        <tr><td>2</td><td>Allowances</td><td class="r">${money(p.allowances)}</td></tr>
        <tr><td>3</td><td>Overtime</td><td class="r">${money(p.overtime)}</td></tr>
        <tr><td>4</td><td>Bonuses</td><td class="r">${money(p.bonuses)}</td></tr>
        <tr><td colspan="2" style="text-align:right;font-weight:bold">Gross Pay</td><td class="r" style="font-weight:bold">${money(p.grossPay)}</td></tr>
      </tbody></table>
      <h2>Statutory Deductions (Kenya)</h2>
      <table><thead><tr><th>#</th><th>Description</th><th class="r">Amount</th></tr></thead><tbody>
        <tr><td>1</td><td>PAYE (Income Tax — incl. KSh 2,400 personal relief)</td><td class="r">${money(p.paye)}</td></tr>
        <tr><td>2</td><td>NSSF (6% of basic, capped KSh 1,080)</td><td class="r">${money(p.nssfDeduction)}</td></tr>
        <tr><td>3</td><td>SHIF (tiered on gross pay)</td><td class="r">${money(p.shifDeduction)}</td></tr>
        <tr><td>4</td><td>Affordable Housing Levy (1.5% of gross)</td><td class="r">${money(p.housingLevy)}</td></tr>
        <tr><td>5</td><td>Other Deductions</td><td class="r">${money(p.otherDeductions)}</td></tr>
        <tr><td colspan="2" style="text-align:right;font-weight:bold">Total Deductions</td><td class="r" style="font-weight:bold">${money(Number(p.paye || 0) + Number(p.nssfDeduction || 0) + Number(p.shifDeduction || 0) + Number(p.housingLevy || 0) + Number(p.otherDeductions || 0))}</td></tr>
      </tbody></table>
      <div class="net">
        <div><span>Gross Pay</span><span>${money(p.grossPay)}</span></div>
        <div><span>Total Deductions</span><span>− ${money(Number(p.paye || 0) + Number(p.nssfDeduction || 0) + Number(p.shifDeduction || 0) + Number(p.housingLevy || 0) + Number(p.otherDeductions || 0))}</span></div>
        <div class="grand"><span>NET PAY</span><span>${money(p.netPay)}</span></div>
      </div>
      ${p.notes ? `<p style="font-size:11px;color:#475569">Notes: ${p.notes}</p>` : ''}
      <div class="foot">This is a computer-generated payslip · Generated ${new Date().toLocaleString('en-KE')}<br/>${company.receiptFooter || 'Thank you for your service.'}</div>
      <script>window.onload = () => setTimeout(() => window.print(), 300)</script>
      </body></html>`);
    win.document.close();
  };

  const columns: Column<Payroll>[] = [
    { key: 'employeeNo', header: 'Employee No.', defaultVisible: true, csvValue: r => r.employee?.employeeNo || '' },
    { key: 'name', header: 'Employee', defaultVisible: true, csvValue: r => ename(r) },
    { key: 'period', header: 'Period', defaultVisible: true, csvValue: r => `${monthName(r.periodMonth)} ${r.periodYear}`, render: r => `${monthName(r.periodMonth)} ${r.periodYear}` },
    { key: 'netPay', header: 'Net Pay', defaultVisible: true, align: 'right', render: r => <span className="font-bold text-[var(--mc-text-primary)]">{kes(r.netPay)}</span>, csvValue: r => r.netPay },
    { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status} />, csvValue: r => r.status },
    { key: 'basicSalary', header: 'Basic Salary', align: 'right', render: r => kes(r.basicSalary), csvValue: r => r.basicSalary },
    { key: 'allowances', header: 'Allowances', align: 'right', render: r => kes(r.allowances), csvValue: r => r.allowances },
    { key: 'grossPay', header: 'Gross Pay', align: 'right', render: r => kes(r.grossPay), csvValue: r => r.grossPay },
    { key: 'paye', header: 'PAYE', align: 'right', render: r => kes(r.paye), csvValue: r => r.paye },
    { key: 'nssfDeduction', header: 'NSSF', align: 'right', render: r => kes(r.nssfDeduction), csvValue: r => r.nssfDeduction },
    { key: 'shifDeduction', header: 'SHIF', align: 'right', render: r => kes(r.shifDeduction), csvValue: r => r.shifDeduction },
    { key: 'housingLevy', header: 'Housing Levy', align: 'right', render: r => kes(r.housingLevy), csvValue: r => r.housingLevy },
    { key: 'otherDeductions', header: 'Other Deduct.', align: 'right', render: r => kes(r.otherDeductions), csvValue: r => r.otherDeductions },
    { key: 'payrollNo', header: 'Payroll No.' },
    { key: 'paidAt', header: 'Paid At', render: r => fmtDate(r.paidAt), csvValue: r => (r.paidAt ? r.paidAt.slice(0, 10) : '') },
    { key: 'department', header: 'Department', csvValue: r => r.employee?.department || '' },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View payslip', variant: 'view', onClick: r => setViewing(r) },
    { icon: <BadgeCheck className="h-4 w-4" />, title: 'Approve payroll', variant: 'edit', onClick: r => setStatus(r, 'APPROVED') },
    { icon: <CheckCircle2 className="h-4 w-4" />, title: 'Mark paid', variant: 'download', onClick: r => setStatus(r, 'PAID') },
    { icon: <Printer className="h-4 w-4" />, title: 'Download payslip (PDF)', variant: 'print', onClick: r => printPayslip(r) },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete draft', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const totalNet = payrolls.reduce((s, p) => s + p.netPay, 0);
  const totalGross = payrolls.reduce((s, p) => s + p.grossPay, 0);
  const draftCount = payrolls.filter(p => p.status === 'DRAFT').length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Banknote className="h-5 w-5" />}
        title="Payroll Management"
        subtitle="Kenyan statutory deductions — PAYE, NSSF, SHIF & housing levy computed automatically"
      />

      {loading && payrolls.length === 0 ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Records" value={total} icon={<Banknote className="h-5 w-5" />} accent="primary" hint={`${monthName(Number(month))} ${year}`} />
          <StatCard label="Gross Pay" value={kes(totalGross)} icon={<TrendingUp className="h-5 w-5" />} accent="secondary" hint="this page" />
          <StatCard label="Net Pay" value={kes(totalNet)} icon={<Wallet className="h-5 w-5" />} accent="success" hint="this page" />
          <StatCard label="Drafts" value={draftCount} icon={<ListFilter className="h-5 w-5" />} accent="warning" hint="awaiting approval" />
        </div>
      )}

      {/* Period picker + generate */}
      <div className="rounded-xl border bg-white p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Month">
            <McSelect value={month} onValueChange={setMonth} options={MONTHS} />
          </Field>
          <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Year">
            <McSelect value={year} onValueChange={setYear} options={YEARS.map(y => ({ value: y, label: y }))} />
          </Field>
          <Field icon={<ListFilter className="h-3.5 w-3.5" />} label="Status">
            <McSelect
              value={statusFilter || 'ALL'}
              onValueChange={v => setStatusFilter(v === 'ALL' ? '' : v)}
              options={[{ value: 'ALL', label: 'All statuses' }, ...STATUS_FILTERS.filter(Boolean).map(s => ({ value: s, label: s }))]}
            />
          </Field>
          <Button size="sm" className="gap-1 h-9" disabled={generating} onClick={generatePayroll}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Generate Payroll
          </Button>
        </div>
        {generating && (
          <div className="space-y-1.5">
            <Progress value={genProgress.total ? Math.round((genProgress.done / genProgress.total) * 100) : 5} />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {genProgress.total ? `${genProgress.done} / ${genProgress.total} — ` : ''}{genProgress.label}
            </p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Generation loops every active employee (basic salary from the registry) — one payroll per employee per period; re-running a period updates it. DRAFT → APPROVED → PAID.
        </p>
      </div>

      <DataTable
        data={payrolls} columns={columns} actions={actions}
        rowKey={r => r.id} title="Payroll Records" moduleLabel="HR Payroll"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
      />

      {/* Payslip view modal */}
      <PremiumModal
        open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }} size="md"
        title={viewing ? `Payslip — ${ename(viewing)}` : ''}
        icon={<Banknote className="h-5 w-5" />}
        description={viewing ? `${viewing.payrollNo} · ${monthName(viewing.periodMonth)} ${viewing.periodYear}` : ''}
        footerNote="Kenyan statutory deductions: PAYE · NSSF · SHIF · Housing Levy"
        submitLabel="Download Payslip (PDF)"
        submitIcon={<Printer className="h-4 w-4" />}
        onSubmit={() => { if (viewing) printPayslip(viewing); }}
        secondaryLabel="Close"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <StatusBadge status={viewing.status} />
              {viewing.paidAt && <span className="text-xs text-muted-foreground">Paid {fmtDateTime(viewing.paidAt)}</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field icon={<User className="h-3.5 w-3.5" />} label="Employee">
                <p className="text-sm font-medium text-[var(--mc-text-primary)]">{ename(viewing)} · {viewing.employee?.employeeNo}</p>
              </Field>
              <Field icon={<Landmark className="h-3.5 w-3.5" />} label="Department / Position">
                <p className="text-sm text-[var(--mc-text-secondary)]">{viewing.employee?.department || '—'}{viewing.employee?.position ? ` · ${viewing.employee.position}` : ''}</p>
              </Field>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <table className="mc-table">
                <thead><tr><th>Earnings</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                <tbody>
                  <tr><td>Basic Salary</td><td style={{ textAlign: 'right' }}>{kes(viewing.basicSalary)}</td></tr>
                  <tr><td>Allowances</td><td style={{ textAlign: 'right' }}>{kes(viewing.allowances)}</td></tr>
                  <tr><td>Overtime</td><td style={{ textAlign: 'right' }}>{kes(viewing.overtime)}</td></tr>
                  <tr><td>Bonuses</td><td style={{ textAlign: 'right' }}>{kes(viewing.bonuses)}</td></tr>
                  <tr><td className="font-bold">Gross Pay</td><td style={{ textAlign: 'right' }} className="font-bold">{kes(viewing.grossPay)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <table className="mc-table">
                <thead><tr><th>Deductions (Kenyan statutory)</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                <tbody>
                  <tr><td>PAYE (income tax)</td><td style={{ textAlign: 'right' }}>{kes(viewing.paye)}</td></tr>
                  <tr><td>NSSF</td><td style={{ textAlign: 'right' }}>{kes(viewing.nssfDeduction)}</td></tr>
                  <tr><td>SHIF</td><td style={{ textAlign: 'right' }}>{kes(viewing.shifDeduction)}</td></tr>
                  <tr><td>Housing Levy</td><td style={{ textAlign: 'right' }}>{kes(viewing.housingLevy)}</td></tr>
                  <tr><td>Other Deductions</td><td style={{ textAlign: 'right' }}>{kes(viewing.otherDeductions)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-xl mc-gradient-primary text-white px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-2"><Wallet className="h-4 w-4" /> NET PAY</span>
              <span className="text-xl font-bold">{kes(viewing.netPay)}</span>
            </div>

            {viewing.notes && (
              <Field icon={<FileText className="h-3.5 w-3.5" />} label="Notes">
                <p className="text-sm text-[var(--mc-text-secondary)]">{viewing.notes}</p>
              </Field>
            )}

            <div className="flex flex-wrap gap-2 no-print">
              {viewing.status === 'DRAFT' && (
                <Button size="sm" variant="outline" className="gap-1" disabled={[...busyKeys].some(k => k.endsWith('-APPROVED'))}
                  onClick={() => setStatus(viewing, 'APPROVED')}>
                  <BadgeCheck className="h-4 w-4" /> Approve
                </Button>
              )}
              {viewing.status !== 'PAID' && (
                <Button size="sm" className="gap-1" disabled={[...busyKeys].some(k => k.endsWith('-PAID'))}
                  onClick={() => setStatus(viewing, 'PAID')}>
                  <CheckCircle2 className="h-4 w-4" /> Mark Paid
                </Button>
              )}
            </div>
          </div>
        )}
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Payroll Record"
        message={deleting ? `Delete draft payroll ${deleting.payrollNo} (${ename(deleting)})? Only DRAFT records can be deleted.` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
