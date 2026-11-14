import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination, getDateFilter } from '@/lib/api';

/**
 * SHIFTS API — StaffAssignment (doctor/nurse duty & shift roster).
 * Assigning/shifting is done by ADMIN/HR at Facility Management only;
 * every staff member can VIEW their own assignments (matched via Employee.userId).
 */

const ASSIGN_ROLES = ['ADMIN', 'HR'];

// GET /api/shifts — ADMIN/HR see all; other staff see only their own assignments
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request); // any authenticated staff
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('departmentId') || '';
    const shiftType = searchParams.get('shiftType') || '';
    const status = searchParams.get('status') || '';
    const id = searchParams.get('id') || '';
    const isHRView = auth.user.role === 'ADMIN' || auth.user.role === 'HR';

    // Single assignment
    if (id) {
      const assignment = await db.staffAssignment.findUnique({
        where: { id },
        include: { employee: { select: { id: true, employeeNo: true, firstName: true, lastName: true, department: true, profession: true, phone: true, userId: true } } },
      });
      if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
      if (!isHRView && assignment.employee.userId !== auth.user.id) {
        return NextResponse.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 });
      }
      return NextResponse.json({ assignment });
    }

    const where: Record<string, unknown> = {};
    if (!isHRView) where.employee = { userId: auth.user.id };

    if (search) {
      where.OR = [
        { wardOrClinic: { contains: search } },
        { notes: { contains: search } },
        {
          employee: {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { employeeNo: { contains: search } },
            ],
          },
        },
      ];
    }
    if (departmentId) where.departmentId = departmentId;
    if (shiftType) where.shiftType = shiftType;
    if (status) where.status = status;

    // shiftDate range: specificDate / dateFrom / dateTo
    const dateFilter = getDateFilter(searchParams);
    if (Object.keys(dateFilter).length > 0) where.shiftDate = dateFilter;

    const [assignments, total] = await Promise.all([
      db.staffAssignment.findMany({
        where,
        orderBy: [{ shiftDate: 'desc' }, { createdAt: 'desc' }],
        skip, take: perPage,
        include: {
          employee: { select: { id: true, employeeNo: true, firstName: true, lastName: true, department: true, profession: true, phone: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      db.staffAssignment.count({ where }),
    ]);

    return NextResponse.json({
      shifts: assignments, items: assignments, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Shifts GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
  }
}

// POST /api/shifts — assign a shift/duty/ward/clinic (Facility Management)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ASSIGN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { employeeId, departmentId, assignmentType, wardOrClinic, shiftDate, shiftStart, shiftEnd, shiftType, notes } = body;

    if (!employeeId) return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });

    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const assignment = await db.staffAssignment.create({
      data: {
        employeeId,
        departmentId: departmentId || null,
        assignmentType: assignmentType || 'SHIFT',
        wardOrClinic: wardOrClinic || '',
        shiftDate: shiftDate ? new Date(shiftDate) : new Date(),
        shiftStart: shiftStart || '08:00',
        shiftEnd: shiftEnd || '17:00',
        shiftType: shiftType || 'DAY',
        notes: notes || '',
        status: 'SCHEDULED',
      },
      include: { employee: { select: { employeeNo: true, firstName: true, lastName: true } } },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'SHIFT_ASSIGN', entityName: 'StaffAssignment', entityId: assignment.id,
        details: `${assignment.assignmentType} assigned to ${employee.firstName} ${employee.lastName} (${employee.employeeNo}) — ${assignment.shiftType} on ${assignment.shiftDate.toISOString().slice(0, 10)}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({
      assignment,
      message: `Shift assigned to ${employee.firstName} ${employee.lastName}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Shifts POST error:', error);
    return NextResponse.json({ error: 'Failed to assign shift' }, { status: 500 });
  }
}

// PUT /api/shifts — update assignment fields / status flow (SCHEDULED→ACTIVE→COMPLETED/CANCELLED)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ASSIGN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });

    const existing = await db.staffAssignment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

    const validStatuses = ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
    if (data.status && !validStatuses.includes(data.status)) {
      return NextResponse.json({ error: `Invalid status — must be one of ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId || null;
    for (const key of ['assignmentType', 'wardOrClinic', 'shiftStart', 'shiftEnd', 'shiftType', 'notes', 'status']) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (data.shiftDate) updateData.shiftDate = new Date(data.shiftDate);

    const assignment = await db.staffAssignment.update({
      where: { id },
      data: updateData,
      include: { employee: { select: { employeeNo: true, firstName: true, lastName: true } } },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'SHIFT_UPDATE', entityName: 'StaffAssignment', entityId: id,
        details: `Assignment for employee ${existing.employeeId} updated${data.status ? ` — status → ${data.status}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ assignment, message: 'Assignment updated' });
  } catch (error) {
    console.error('Shifts PUT error:', error);
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}

// DELETE /api/shifts?id=
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ASSIGN_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });

    const existing = await db.staffAssignment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

    await db.staffAssignment.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'SHIFT_DELETE', entityName: 'StaffAssignment', entityId: id,
        details: `Assignment for employee ${existing.employeeId} (${existing.shiftType} on ${existing.shiftDate.toISOString().slice(0, 10)}) deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Assignment deleted' });
  } catch (error) {
    console.error('Shifts DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }
}
