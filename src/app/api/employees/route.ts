import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * EMPLOYEES API — HR staff registry.
 * All operations guarded to ADMIN + HR.
 * Deletion is soft (deactivate) when the employee has payroll/attendance/assignment
 * history, otherwise a hard delete.
 */

const HR_ROLES = ['ADMIN', 'HR'];

// GET /api/employees — search & list; ?id= single with counts
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || '';
    const profession = searchParams.get('profession') || '';
    const isActive = searchParams.get('isActive') || '';
    const id = searchParams.get('id') || '';

    // Single employee — full profile + recent assignments
    if (id) {
      const employee = await db.employee.findUnique({
        where: { id },
        include: {
          _count: { select: { attendance: true, payrolls: true, assignments: true } },
          assignments: { orderBy: { shiftDate: 'desc' }, take: 10 },
        },
      });
      if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      return NextResponse.json({ employee });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { employeeNo: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search } },
        { nationalId: { contains: search } },
      ];
    }
    if (department) where.department = department;
    if (profession) where.profession = profession;
    if (isActive) where.isActive = isActive === 'true' || isActive === '1';

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        skip, take: perPage,
        include: { _count: { select: { attendance: true, payrolls: true, assignments: true } } },
      }),
      db.employee.count({ where }),
    ]);

    return NextResponse.json({
      employees, items: employees, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Employees GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

// POST /api/employees — register employee (+ bulk CSV import support)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { bulkItems, ...data } = body;

    // Bulk CSV import
    if (bulkItems && Array.isArray(bulkItems) && bulkItems.length > 0) {
      let created = 0;
      for (const b of bulkItems) {
        if (!b.firstName || !b.lastName) continue;
        const employeeNo = await generateCode('EMP');
        await db.employee.create({
          data: {
            employeeNo,
            firstName: b.firstName, lastName: b.lastName,
            department: b.department || '', position: b.position || '',
            profession: b.profession || '', specialization: b.specialization || '',
            phone: b.phone || '', email: b.email || '',
            nationalId: b.nationalId || '', kraPin: b.kraPin || '',
            nssfNo: b.nssfNo || '', nhifNo: b.nhifNo || '',
            gender: b.gender || '',
            dateOfBirth: b.dateOfBirth ? new Date(b.dateOfBirth) : null,
            startDate: b.startDate ? new Date(b.startDate) : new Date(),
            salary: parseFloat(b.salary) || 0,
          },
        }).catch(() => null);
        created++;
      }
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'EMPLOYEE_BULK_IMPORT', entityName: 'Employee',
          details: `Bulk imported ${created} employees`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ imported: created });
    }

    if (!data.firstName || !data.lastName) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
    }

    const employeeNo = await generateCode('EMP');
    const employee = await db.employee.create({
      data: {
        employeeNo,
        firstName: data.firstName,
        lastName: data.lastName,
        userId: data.userId || null,
        department: data.department || '',
        position: data.position || '',
        profession: data.profession || '',
        specialization: data.specialization || '',
        phone: data.phone || '',
        email: data.email || '',
        nationalId: data.nationalId || '',
        kraPin: data.kraPin || '',
        nssfNo: data.nssfNo || '',
        nhifNo: data.nhifNo || '',
        gender: data.gender || '',
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        address: data.address || '',
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        salary: parseFloat(data.salary) || 0,
        bankName: data.bankName || '',
        bankAccount: data.bankAccount || '',
        photoUrl: data.photoUrl || '',
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'EMPLOYEE_REGISTER', entityName: 'Employee', entityId: employee.id,
        details: `Registered ${employee.firstName} ${employee.lastName} (${employee.employeeNo})`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({
      employee,
      message: `Employee registered successfully. Employee No: ${employeeNo}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Employees POST error:', error);
    return NextResponse.json({ error: 'Failed to register employee' }, { status: 500 });
  }
}

// PUT /api/employees — update profile; setting endDate deactivates
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });

    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    for (const key of ['firstName', 'lastName', 'userId', 'department', 'position', 'profession',
      'specialization', 'phone', 'email', 'nationalId', 'kraPin', 'nssfNo', 'nhifNo', 'gender',
      'address', 'bankName', 'bankAccount', 'photoUrl']) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.salary !== undefined) updateData.salary = parseFloat(data.salary) || 0;
    if (data.isActive !== undefined) updateData.isActive = !!data.isActive;

    // Employment end → deactivate
    if (data.endDate !== undefined) {
      if (data.endDate) {
        updateData.endDate = new Date(data.endDate);
        updateData.isActive = false;
      } else {
        updateData.endDate = null;
      }
    }

    const employee = await db.employee.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'EMPLOYEE_UPDATE', entityName: 'Employee', entityId: id,
        details: `Employee ${existing.employeeNo} (${existing.firstName} ${existing.lastName}) updated${data.endDate ? ' — employment ended' : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ employee, message: 'Employee updated' });
  } catch (error) {
    console.error('Employees PUT error:', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

// DELETE /api/employees?id= — soft delete (deactivate) when history exists, else hard delete
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });

    const existing = await db.employee.findUnique({
      where: { id },
      include: { _count: { select: { payrolls: true, attendance: true, assignments: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // Payroll / attendance / assignment history must be preserved → soft delete
    if (existing._count.payrolls > 0 || existing._count.attendance > 0 || existing._count.assignments > 0) {
      await db.employee.update({
        where: { id },
        data: { isActive: false, endDate: existing.endDate || new Date() },
      });
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'EMPLOYEE_DEACTIVATE', entityName: 'Employee', entityId: id,
          details: `Employee ${existing.employeeNo} deactivated (history preserved: ${existing._count.payrolls} payroll, ${existing._count.attendance} attendance, ${existing._count.assignments} assignment records)`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ message: `Employee ${existing.employeeNo} deactivated — history preserved`, softDeleted: true });
    }

    await db.employee.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'EMPLOYEE_DELETE', entityName: 'Employee', entityId: id,
        details: `Employee ${existing.employeeNo} (${existing.firstName} ${existing.lastName}) deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Employee deleted', deleted: true });
  } catch (error) {
    console.error('Employees DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
