import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getPagination, money } from '@/lib/api';

/**
 * PAYROLL API — PayrollRecord with automatic Kenyan statutory deductions.
 * ADMIN/HR manage payroll; ?tab=my-payroll lets any authenticated staff
 * view their own payslips (matched via Employee.userId) — the response also
 * carries the resolved employee profile for self-service pages.
 *
 * Deduction rules are READ FROM PayrollConfig (editable at HR → Settings,
 * seeded with the defaults below; unknown/missing/non-numeric keys keep the
 * defaults — simplified 2024/25 Kenyan bands):
 *  - PAYE: paye_lower_rate/paye_upper_rate progressive above paye_threshold
 *    up to paye_band_limit, minus paye_relief personal relief (floored at 0)
 *  - NSSF: nssf_rate of basic capped at nssf_cap
 *  - SHIF: six tiers on gross (shif_tier{1..5}_limit / _amount, tier 6 above)
 *  - Affordable Housing Levy: housing_levy_rate of gross
 */

const HR_ROLES = ['ADMIN', 'HR'];
const EMPLOYEE_SELECT = { id: true, employeeNo: true, firstName: true, lastName: true, department: true, position: true, userId: true } as const;

// ── Statutory rates: defaults, overridable per key from PayrollConfig ──
const DEFAULT_RATES = {
  paye_threshold: 24000,   // KES — PAYE tax-free band start
  paye_band_limit: 32333,  // KES — upper boundary of the lower band
  paye_lower_rate: 0.25,   // 25% between threshold and band limit (decimal)
  paye_upper_rate: 0.30,   // 30% above the band limit (decimal)
  paye_relief: 2400,       // KES — personal relief
  nssf_rate: 0.06,         // 6% of basic (decimal)
  nssf_cap: 1080,          // KES — NSSF maximum deduction
  shif_tier1_limit: 5999,  shif_tier1_amount: 150,
  shif_tier2_limit: 7999,  shif_tier2_amount: 300,
  shif_tier3_limit: 11999, shif_tier3_amount: 400,
  shif_tier4_limit: 19999, shif_tier4_amount: 500,
  shif_tier5_limit: 49999, shif_tier5_amount: 750,
  shif_tier6_amount: 1700, // gross above the tier-5 limit
  housing_levy_rate: 0.015, // 1.5% of gross (decimal)
};

type PayrollRates = { [K in keyof typeof DEFAULT_RATES]: number };

/** Read the effective rates — PayrollConfig rows override the defaults. */
async function getPayrollRates(): Promise<PayrollRates> {
  const rates: PayrollRates = { ...DEFAULT_RATES };
  const rows = await db.payrollConfig.findMany().catch(() => []);
  for (const row of rows) {
    if (!(row.key in rates)) continue; // unknown keys keep the defaults
    const parsed = parseFloat(row.value);
    if (isFinite(parsed)) rates[row.key as keyof PayrollRates] = parsed;
  }
  return rates;
}

function computeKenyanPayroll(rates: PayrollRates, basic: number, allowances: number, overtime: number, bonuses: number, otherDeductions: number) {
  const grossPay = money(basic + allowances + overtime + bonuses);

  // PAYE — progressive with personal relief (rates from PayrollConfig)
  let paye = 0;
  if (grossPay > rates.paye_threshold) {
    paye =
      Math.max(0, Math.min(grossPay, rates.paye_band_limit) - rates.paye_threshold) * rates.paye_lower_rate +
      Math.max(0, grossPay - rates.paye_band_limit) * rates.paye_upper_rate -
      rates.paye_relief;
    if (paye < 0) paye = 0;
  }

  // NSSF — % of basic capped (rate + cap from PayrollConfig)
  const nssfDeduction = money(Math.min(basic * rates.nssf_rate, rates.nssf_cap));

  // SHIF — tiered on gross pay (tiers from PayrollConfig)
  let shifDeduction = rates.shif_tier6_amount;
  if (grossPay <= rates.shif_tier1_limit) shifDeduction = rates.shif_tier1_amount;
  else if (grossPay <= rates.shif_tier2_limit) shifDeduction = rates.shif_tier2_amount;
  else if (grossPay <= rates.shif_tier3_limit) shifDeduction = rates.shif_tier3_amount;
  else if (grossPay <= rates.shif_tier4_limit) shifDeduction = rates.shif_tier4_amount;
  else if (grossPay <= rates.shif_tier5_limit) shifDeduction = rates.shif_tier5_amount;

  // Affordable Housing Levy — % of gross (rate from PayrollConfig)
  const housingLevy = money(grossPay * rates.housing_levy_rate);

  const netPay = money(grossPay - paye - nssfDeduction - shifDeduction - housingLevy - otherDeductions);

  return {
    grossPay,
    paye: money(paye),
    nssfDeduction,
    shifDeduction,
    housingLevy,
    otherDeductions: money(otherDeductions),
    netPay,
  };
}

// GET /api/payroll — ADMIN/HR list; ?tab=my-payroll → own payslips (any staff)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request); // any authenticated (my-payroll needs staff access)
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const tab = searchParams.get('tab') || '';
    const employeeId = searchParams.get('employeeId') || '';
    const periodMonth = searchParams.get('periodMonth') || '';
    const periodYear = searchParams.get('periodYear') || '';
    const status = searchParams.get('status') || '';
    const id = searchParams.get('id') || '';

    // Staff self-service — own payslips (any authenticated user). The Employee
    // is resolved via userId; legacy databases stored the account username in
    // Employee.userId, so both are tried.
    if (tab === 'my-payroll') {
      const employee = await db.employee.findFirst({
        where: { OR: [{ userId: auth.user.id }, { userId: auth.user.username }] },
      });
      if (!employee) {
        return NextResponse.json({
          payrolls: [], items: [], total: 0, page, perPage, totalPages: 0, employee: null,
          message: 'No employee record linked to this account',
        });
      }
      const where: Record<string, unknown> = { employeeId: employee.id };
      if (periodMonth) where.periodMonth = parseInt(periodMonth);
      if (periodYear) where.periodYear = parseInt(periodYear);
      if (status) where.status = status;

      const [payrolls, total] = await Promise.all([
        db.payrollRecord.findMany({
          where, orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }], skip, take: perPage,
          include: { employee: { select: EMPLOYEE_SELECT } },
        }),
        db.payrollRecord.count({ where }),
      ]);
      return NextResponse.json({
        payrolls, items: payrolls, total, page, perPage,
        totalPages: Math.ceil(total / perPage),
        // Resolved employee profile for the self-service page header
        employee: {
          id: employee.id, employeeNo: employee.employeeNo,
          firstName: employee.firstName, lastName: employee.lastName,
          department: employee.department, position: employee.position, userId: employee.userId,
        },
      });
    }

    // Admin/HR area
    if (!HR_ROLES.includes(auth.user.role)) {
      return NextResponse.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 });
    }

    // Single payroll slip
    if (id) {
      const payroll = await db.payrollRecord.findUnique({
        where: { id },
        include: { employee: { select: EMPLOYEE_SELECT } },
      });
      if (!payroll) return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 });
      return NextResponse.json({ payroll });
    }

    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (periodMonth) where.periodMonth = parseInt(periodMonth);
    if (periodYear) where.periodYear = parseInt(periodYear);
    if (status) where.status = status;

    const [payrolls, total] = await Promise.all([
      db.payrollRecord.findMany({
        where, orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { createdAt: 'desc' }], skip, take: perPage,
        include: { employee: { select: EMPLOYEE_SELECT } },
      }),
      db.payrollRecord.count({ where }),
    ]);

    return NextResponse.json({
      payrolls, items: payrolls, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Payroll GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch payroll records' }, { status: 500 });
  }
}

// POST /api/payroll — create (or update via upsert) a payroll with statutory deductions
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { employeeId, periodMonth, periodYear, basicSalary, allowances, overtime, bonuses, otherDeductions, notes } = body;

    if (!employeeId) return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });

    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const month = Math.min(12, Math.max(1, parseInt(periodMonth) || new Date().getMonth() + 1));
    const year = Math.min(2100, Math.max(2000, parseInt(periodYear) || new Date().getFullYear()));

    const basic = money(parseFloat(basicSalary) || 0);
    const allow = money(parseFloat(allowances) || 0);
    const ot = money(parseFloat(overtime) || 0);
    const bon = money(parseFloat(bonuses) || 0);
    const ded = money(parseFloat(otherDeductions) || 0);
    // Statutory rates are read from PayrollConfig (HR → Settings) on every run
    const rates = await getPayrollRates();
    const computed = computeKenyanPayroll(rates, basic, allow, ot, bon, ded);

    // Upsert — one payroll per employee per period
    const existing = await db.payrollRecord.findUnique({
      where: { employeeId_periodMonth_periodYear: { employeeId, periodMonth: month, periodYear: year } },
    });
    const payrollNo = existing ? existing.payrollNo : await generateCode('PRD');

    const payroll = await db.payrollRecord.upsert({
      where: { employeeId_periodMonth_periodYear: { employeeId, periodMonth: month, periodYear: year } },
      create: {
        payrollNo,
        employeeId,
        periodMonth: month, periodYear: year,
        basicSalary: basic, allowances: allow, overtime: ot, bonuses: bon,
        ...computed,
        status: 'DRAFT',
        notes: notes || '',
      },
      update: {
        basicSalary: basic, allowances: allow, overtime: ot, bonuses: bon,
        ...computed,
        notes: notes !== undefined ? notes : existing?.notes,
      },
      include: { employee: { select: EMPLOYEE_SELECT } },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'PAYROLL_CREATE', entityName: 'PayrollRecord', entityId: payroll.id,
        details: `Payroll ${payroll.payrollNo} for ${employee.firstName} ${employee.lastName} (${month}/${year}) — gross ${computed.grossPay}, net ${computed.netPay}${existing ? ' — updated existing period' : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({
      payroll,
      updated: !!existing,
      message: existing
        ? `Payroll for ${month}/${year} updated for ${employee.firstName} ${employee.lastName}`
        : `Payroll ${payrollNo} created for ${month}/${year}`,
    }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error('Payroll POST error:', error);
    return NextResponse.json({ error: 'Failed to process payroll' }, { status: 500 });
  }
}

// PUT /api/payroll — status flow DRAFT → APPROVED → PAID (paidAt stamped when PAID)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, status, notes, paidAt } = body;
    if (!id) return NextResponse.json({ error: 'Payroll record ID required' }, { status: 400 });

    const existing = await db.payrollRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 });

    const validStatuses = ['DRAFT', 'APPROVED', 'PAID'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status — must be one of ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (status === 'PAID') updateData.paidAt = paidAt ? new Date(paidAt) : new Date();

    const payroll = await db.payrollRecord.update({
      where: { id },
      data: updateData,
      include: { employee: { select: EMPLOYEE_SELECT } },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'PAYROLL_UPDATE', entityName: 'PayrollRecord', entityId: id,
        details: `Payroll ${existing.payrollNo} updated${status ? ` — status → ${status}` : ''}${status === 'PAID' ? ' (paid)' : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ payroll, message: 'Payroll updated' });
  } catch (error) {
    console.error('Payroll PUT error:', error);
    return NextResponse.json({ error: 'Failed to update payroll' }, { status: 500 });
  }
}

// DELETE /api/payroll?id= — only while DRAFT
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Payroll record ID required' }, { status: 400 });

    const existing = await db.payrollRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 });

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Only DRAFT payroll records can be deleted (current status: ${existing.status})` },
        { status: 400 },
      );
    }

    await db.payrollRecord.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'PAYROLL_DELETE', entityName: 'PayrollRecord', entityId: id,
        details: `Draft payroll ${existing.payrollNo} (${existing.periodMonth}/${existing.periodYear}) deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Payroll record deleted' });
  } catch (error) {
    console.error('Payroll DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete payroll record' }, { status: 500 });
  }
}
