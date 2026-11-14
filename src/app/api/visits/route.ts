import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * VISITS API — core clinical encounter tracker.
 * A Visit is opened at registration (or auto-opened at admission) and walks the flow:
 * ACTIVE → WAITING_LAB → WAITING_DOCTOR → WAITING_PHARMACY → READY_FOR_PAYMENT → COMPLETED/CANCELLED
 */

const STAFF_ROLES = ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'CASHIER'];

// GET /api/visits — list & filter; ?id= → single visit with full encounter detail
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, STAFF_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const visitType = searchParams.get('visitType') || '';
    const patientId = searchParams.get('patientId') || '';
    const id = searchParams.get('id') || '';

    // Single visit — full encounter sheet
    if (id) {
      const visit = await db.visit.findUnique({
        where: { id },
        include: {
          patient: {
            select: {
              id: true, patientNo: true, firstName: true, lastName: true, gender: true,
              dateOfBirth: true, phone: true, bloodType: true, allergies: true,
              paymentMode: true, shaNumber: true,
            },
          },
          bills: { orderBy: { createdAt: 'desc' }, include: { items: true } },
          labOrders: { orderBy: { createdAt: 'desc' }, include: { items: { include: { labTest: true } } } },
          prescriptions: { orderBy: { createdAt: 'desc' }, include: { items: true } },
          admissions: { include: { bed: { include: { ward: true } } } },
        },
      });
      if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
      return NextResponse.json({ visit });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { visitNo: { contains: search } },
        {
          patient: {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { patientNo: { contains: search } },
            ],
          },
        },
      ];
    }
    if (status) where.status = status;
    if (visitType) where.visitType = visitType;
    if (patientId) where.patientId = patientId;

    const [visits, total] = await Promise.all([
      db.visit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: perPage,
        include: {
          patient: { select: { patientNo: true, firstName: true, lastName: true, phone: true, paymentMode: true } },
          _count: { select: { bills: true, labOrders: true, prescriptions: true } },
        },
      }),
      db.visit.count({ where }),
    ]);

    return NextResponse.json({
      visits, items: visits, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Visits GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch visits' }, { status: 500 });
  }
}

// POST /api/visits — open a visit (or bulk import)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'RECEPTIONIST']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { bulkItems, ...data } = body;

    // Bulk CSV import
    if (bulkItems && Array.isArray(bulkItems) && bulkItems.length > 0) {
      let created = 0;
      for (const b of bulkItems) {
        if (!b.patientId) continue;
        const visitNo = await generateCode('VIS');
        await db.visit.create({
          data: {
            visitNo,
            patientId: b.patientId,
            visitType: b.visitType || 'OUTPATIENT',
            status: 'ACTIVE',
            notes: b.notes || '',
          },
        }).catch(() => null);
        created++;
      }
      return NextResponse.json({ imported: created });
    }

    if (!data.patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    const patient = await db.patient.findUnique({ where: { id: data.patientId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const visitNo = await generateCode('VIS');
    const visit = await db.visit.create({
      data: {
        visitNo,
        patientId: data.patientId,
        visitType: data.visitType || 'OUTPATIENT',
        status: 'ACTIVE',
        doctorId: data.doctorId || null,
        notes: data.notes || '',
      },
      include: {
        patient: { select: { patientNo: true, firstName: true, lastName: true, phone: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'VISIT_CREATE', entityName: 'Visit', entityId: visit.id,
        details: `Visit ${visitNo} opened for ${patient.firstName} ${patient.lastName} (${patient.patientNo})`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ visit, message: `Visit opened. Visit No: ${visitNo}` }, { status: 201 });
  } catch (error) {
    console.error('Visits POST error:', error);
    return NextResponse.json({ error: 'Failed to create visit' }, { status: 500 });
  }
}

// PUT /api/visits — update visit (status flow, notes, doctor)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'RECEPTIONIST']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, status, notes, doctorId, visitType } = body;
    if (!id) return NextResponse.json({ error: 'Visit ID required' }, { status: 400 });

    const existing = await db.visit.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (visitType) updateData.visitType = visitType;
    if (notes !== undefined) updateData.notes = notes;
    if (doctorId !== undefined) updateData.doctorId = doctorId || null;

    const visit = await db.visit.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'VISIT_UPDATE', entityName: 'Visit', entityId: id,
        details: `Visit ${existing.visitNo} updated${status ? ` — status → ${status}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ visit, message: 'Visit updated' });
  } catch (error) {
    console.error('Visits PUT error:', error);
    return NextResponse.json({ error: 'Failed to update visit' }, { status: 500 });
  }
}
