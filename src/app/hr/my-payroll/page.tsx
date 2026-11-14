'use client';

/**
 * MY PAYROLL (self-service) — for ANY authenticated staff member.
 *
 * A deliberate departure from the admin payroll console: greeting hero with
 * a month selector, a current-month payslip card with big numbers (gross,
 * PAYE, NSSF, SHIF, housing levy, net pay), a printable payslip download
 * via universal document printing, and a payroll history list with status
 * chips (DRAFT payslips are never shown — APPROVED/PAID only). Data comes
 * from GET /api/payroll?tab=my-payroll which resolves the caller's
 * Employee via their user account.
 */

import * as React from 'react';
import {
  Wallet, CalendarDays, Printer, Eye, TrendingUp, Banknote, Landmark,
  HeartPulse, Home, ReceiptText, PenLine, Clock3, UserRound, ShieldCheck, FileText,
} from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/client-api';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { kes, fmtDate, monthName, Field, StatusBadge, McSelect } from '@/app/ops/_lib';
import { printUniversalDocument, docSection, docTable, docRecordsTable } from '@/lib/document-print';

interface SelfEmployee {
  id: string; employeeNo: string; firstName: string; lastName: string;
  department: string; position: string; userId: string | null;
}
interface MyPayroll {
  id: string; payrollNo: string; employeeId: string; employee: SelfEmployee;
  periodMonth: number; periodYear: number;
  basicSalary: number; allowances: number; overtime: number; bonuses: number;
  grossPay: number; paye: number; nssfDeduction: number; shifDeduction: number;
  housingLevy: number; otherDeductions: number; netPay: number;
  status: string; paidAt: string | null; notes: string; createdAt: string;
}
interface MyPayrollResp {
  payrolls: MyPayroll[]; total: number; employee: SelfEmployee | null; message?: string;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }));
const YEARS = Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() - 3 + i));

const ename = (e?: SelfEmployee | null) => (e ? `${e.firstName} ${e.lastName}`.trim() : '—');

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const totalDeductionsOf = (p: MyPayroll) =>
  Number(p.paye || 0) + Number(p.nssfDeduction || 0) + Number(p.shifDeduction || 0) +
  Number(p.housingLevy || 0) + Number(p.otherDeductions || 0);

export default function MyPayrollPage() {
  const user = useAuthStore(s => s.user);
  const now = new Date();
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [year, setYear] = React.useState(String(now.getFullYear()));

  const [payrolls, setPayrolls] = React.useState<MyPayroll[]>([]);
  const [employee, setEmployee] = React.useState<SelfEmployee | null>(null);
  const [noEmployee, setNoEmployee] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [viewing, setViewing] = React.useState<MyPayroll | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<MyPayrollResp>('/api/payroll?tab=my-payroll&perPage=100');
      setPayrolls(res.payrolls || []);
      setEmployee(res.employee || null);
      setNoEmployee(!res.employee && !!res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load your payroll');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Self-service rule: only APPROVED / PAID payslips are ever shown
  const visible = React.useMemo(
    () => payrolls.filter(p => p.status === 'APPROVED' || p.status === 'PAID'),
    [payrolls],
  );
  const selectedAny = payrolls.find(p => String(p.periodMonth) === month && String(p.periodYear) === year) || null;
  const selected = selectedAny && selectedAny.status !== 'DRAFT' ? selectedAny : null;
  const history = visible.filter(p => p !== selected);

  const displayName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username : '';

  // ── Printable payslip via universal document printing ──
  const downloadPayslip = (p: MyPayroll) => {
    const bodyHtml = [
      docSection('Employee & Period'),
      docTable([
        ['Name', ename(p.employee)],
        ['Employee No.', p.employee?.employeeNo || '—'],
        ['Department', p.employee?.department || '—'],
        ['Position', p.employee?.position || '—'],
        ['Period', `${monthName(p.periodMonth)} ${p.periodYear}`],
        ['Status', p.status],
      ]),
      docSection('Earnings'),
      docRecordsTable(['#', 'Description', 'Amount'], [
        ['1', 'Basic Salary', kes(p.basicSalary)],
        ['2', 'Allowances', kes(p.allowances)],
        ['3', 'Overtime', kes(p.overtime)],
        ['4', 'Bonuses', kes(p.bonuses)],
        ['', '<b>Gross Pay</b>', `<b>${kes(p.grossPay)}</b>`],
      ]),
      docSection('Statutory Deductions (Kenya)'),
      docRecordsTable(['#', 'Description', 'Amount'], [
        ['1', 'PAYE (income tax, net of personal relief)', kes(p.paye)],
        ['2', 'NSSF', kes(p.nssfDeduction)],
        ['3', 'SHIF', kes(p.shifDeduction)],
        ['4', 'Affordable Housing Levy', kes(p.housingLevy)],
        ['5', 'Other Deductions', kes(p.otherDeductions)],
        ['', '<b>Total Deductions</b>', `<b>${kes(totalDeductionsOf(p))}</b>`],
      ]),
      docSection('Net Pay'),
      docTable([
        ['Gross Pay', kes(p.grossPay)],
        ['Total Deductions', `− ${kes(totalDeductionsOf(p))}`],
        ['NET PAY', `<b>${kes(p.netPay)}</b>`],
      ]),
      p.notes ? `<p style="font-size:11px;color:#475569">Notes: ${p.notes}</p>` : '',
    ].join('');
    printUniversalDocument({
      title: 'PAYSLIP',
      docId: p.payrollNo,
      docDate: new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }),
      bodyHtml,
      footerNote: 'This is a computer-generated payslip. Queries? Contact the HR office.',
    });
  };

  return (
    <div className="space-y-4">
      {/* ── Hero: greeting + month selector ── */}
      <section className="rounded-2xl mc-gradient-primary text-white p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4 no-print">
        <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
          <Wallet className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
            {greeting()}{displayName ? `, ${displayName}` : ''}
          </p>
          <h1 className="text-2xl font-bold leading-tight">My Payroll</h1>
          <p className="text-xs text-white/75 mt-0.5">
            {employee
              ? `${employee.position || employee.department || 'Staff'} · Employee No. ${employee.employeeNo}`
              : 'Your payslips & Kenyan statutory deductions'}
          </p>
        </div>
        <div className="flex items-end gap-2 md:justify-end shrink-0">
          <div className="w-40">
            <p className="text-[11px] font-semibold text-white/75 mb-1">Month</p>
            <McSelect value={month} onValueChange={setMonth} options={MONTHS} />
          </div>
          <div className="w-24">
            <p className="text-[11px] font-semibold text-white/75 mb-1">Year</p>
            <McSelect value={year} onValueChange={setYear} options={YEARS.map(y => ({ value: y, label: y }))} />
          </div>
        </div>
      </section>

      {noEmployee && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm flex items-center gap-2 no-print">
          <UserRound className="h-4 w-4 shrink-0" />
          No employee record is linked to this account — contact HR to access your payslips.
        </div>
      )}

      {/* ── Current-month payslip card ── */}
      {loading && payrolls.length === 0 ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : (
        <section className="rounded-2xl border bg-white overflow-hidden">
          <div className="px-5 py-4 border-b bg-[var(--mc-bg-card)] flex flex-wrap items-center gap-3">
            <div className="h-10 w-10 rounded-xl mc-gradient-primary flex items-center justify-center text-white shrink-0">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">
                Payslip — {monthName(Number(month))} {year}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selected ? selected.payrollNo : 'Kenyan statutory deductions applied automatically'}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {selected && <StatusBadge status={selected.status} />}
              {selected?.paidAt && (
                <span className="text-xs text-muted-foreground">Paid {fmtDate(selected.paidAt)}</span>
              )}
            </div>
          </div>

          {selected ? (
            <div className="p-5 space-y-5">
              {/* Big numbers — gross & net */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border p-4">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> GROSS PAY
                  </p>
                  <p className="text-3xl font-bold text-[var(--mc-text-primary)] mt-1">{kes(selected.grossPay)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Basic {kes(selected.basicSalary)} · Allowances {kes(selected.allowances)}
                    {selected.overtime ? ` · Overtime ${kes(selected.overtime)}` : ''}
                    {selected.bonuses ? ` · Bonuses ${kes(selected.bonuses)}` : ''}
                  </p>
                </div>
                <div className="rounded-xl mc-gradient-primary text-white p-4">
                  <p className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" /> NET PAY
                  </p>
                  <p className="text-3xl font-bold mt-1">{kes(selected.netPay)}</p>
                  <p className="text-[11px] text-white/75 mt-1">Take-home for {monthName(Number(month))} {year}</p>
                </div>
              </div>

              {/* Deduction tiles */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {([
                  ['PAYE', selected.paye, <Landmark className="h-3.5 w-3.5" key="paye" />, 'Income tax after relief'],
                  ['NSSF', selected.nssfDeduction, <ShieldCheck className="h-3.5 w-3.5" key="nssf" />, 'Pension contribution'],
                  ['SHIF', selected.shifDeduction, <HeartPulse className="h-3.5 w-3.5" key="shif" />, 'Health insurance'],
                  ['Housing Levy', selected.housingLevy, <Home className="h-3.5 w-3.5" key="house" />, 'Affordable Housing'],
                ] as Array<[string, number, React.ReactNode, string]>).map(([label, value, icon, hint]) => (
                  <div key={label} className="rounded-xl border bg-[var(--mc-bg-card)] p-3.5">
                    <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                      <span className="text-[var(--mc-primary)]">{icon}</span> {label.toUpperCase()}
                    </p>
                    <p className="text-xl font-bold text-[var(--mc-text-primary)] mt-1">{kes(value)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 no-print">
                <Button className="gap-1" onClick={() => downloadPayslip(selected)}>
                  <Printer className="h-4 w-4" /> Download Payslip
                </Button>
                <Button variant="outline" className="gap-1" onClick={() => setViewing(selected)}>
                  <Eye className="h-4 w-4" /> View Details
                </Button>
                {selected.otherDeductions > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    Other deductions {kes(selected.otherDeductions)} included
                  </span>
                )}
              </div>
            </div>
          ) : selectedAny ? (
            // DRAFT — being prepared, never shown
            <div className="p-8 text-center">
              <div className="h-12 w-12 rounded-2xl bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] flex items-center justify-center mx-auto">
                <PenLine className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-[var(--mc-text-primary)] mt-3">
                Your {monthName(Number(month))} {year} payslip is being prepared
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                It will appear here as soon as HR approves it — draft payslips are never shown.
              </p>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="h-12 w-12 rounded-2xl bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] flex items-center justify-center mx-auto">
                <CalendarDays className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-[var(--mc-text-primary)] mt-3">
                No payroll record for {monthName(Number(month))} {year}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Pick another month above or check back after the payroll run.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── Payroll history (past months — APPROVED/PAID only) ── */}
      <section className="rounded-2xl border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b bg-[var(--mc-bg-card)] flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] flex items-center justify-center">
            <Clock3 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Payroll History</h2>
            <p className="text-xs text-muted-foreground">Approved & paid payslips from previous periods</p>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{history.length} payslip(s)</span>
        </div>
        {!loading && history.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">
            No approved payslips yet — your history will build up as payroll is approved and paid.
          </p>
        ) : (
          <div className="divide-y divide-[var(--mc-divider)]">
            {history.map(p => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="h-10 w-10 rounded-xl bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] flex items-center justify-center shrink-0">
                  <Banknote className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--mc-text-primary)]">
                    {monthName(p.periodMonth)} {p.periodYear}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Net {kes(p.netPay)} · Gross {kes(p.grossPay)} · {p.payrollNo}
                  </p>
                </div>
                <StatusBadge status={p.status} />
                <div className="flex items-center gap-1 no-print">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="View payslip" onClick={() => setViewing(p)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Download payslip" onClick={() => downloadPayslip(p)}>
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Payslip detail modal ── */}
      <PremiumModal
        open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }} size="md"
        title={viewing ? `Payslip — ${monthName(viewing.periodMonth)} ${viewing.periodYear}` : ''}
        icon={<Wallet className="h-5 w-5" />}
        description={viewing ? `${viewing.payrollNo} · net pay ${kes(viewing.netPay)}` : ''}
        footerNote="Kenyan statutory deductions: PAYE · NSSF · SHIF · Housing Levy"
        submitLabel="Download Payslip (PDF)"
        submitIcon={<Printer className="h-4 w-4" />}
        onSubmit={() => { if (viewing) downloadPayslip(viewing); }}
        secondaryLabel="Close"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <StatusBadge status={viewing.status} />
              {viewing.paidAt && <span className="text-xs text-muted-foreground">Paid {fmtDate(viewing.paidAt)}</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field icon={<UserRound className="h-3.5 w-3.5" />} label="Employee">
                <p className="text-sm font-medium text-[var(--mc-text-primary)]">
                  {ename(viewing.employee)}{viewing.employee?.employeeNo ? ` · ${viewing.employee.employeeNo}` : ''}
                </p>
              </Field>
              <Field icon={<Landmark className="h-3.5 w-3.5" />} label="Department / Position">
                <p className="text-sm text-[var(--mc-text-secondary)]">
                  {viewing.employee?.department || '—'}{viewing.employee?.position ? ` · ${viewing.employee.position}` : ''}
                </p>
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
          </div>
        )}
      </PremiumModal>
    </div>
  );
}
