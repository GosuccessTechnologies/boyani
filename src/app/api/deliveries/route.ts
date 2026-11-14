import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getPagination, getDateFilter } from '@/lib/api';

/**
 * DELIVERIES API — MCH delivery records (outcomes, baby details, Apgar).
 */

const ROLES = ['ADMIN', 'NURSE', 'DOCTOR'];

/** Parse a date-ish body value → Date | null */
function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

// GET /api/deliveries — list with filters; ?id= single
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const outcome = searchParams.get('outcome') || '';
    const deliveryType = searchParams.get('deliveryType') || '';
    const patientId = searchParams.get('patientId') || '';
    const ancId = searchParams.get('ancId') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const delivery = await db.deliveryRecord.findUnique({
        where: { id },
        include: {
          patient: {
            select: {
              id: true, patientNo: true, firstName: true, lastName: true, gender: true,
              dateOfBirth: true, phone: true, bloodType: true, paymentMode: true,
            },
          },
        },
      });
      if (!delivery) return NextResponse.json({ error: 'Delivery record not found' }, { status: 404 });
      return NextResponse.json({ delivery });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { deliveryNo: { contains: search } },
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
    if (outcome) where.outcome = outcome;
    if (deliveryType) where.deliveryType = deliveryType;
    if (patientId) where.patientId = patientId;
    if (ancId) where.ancId = ancId;

    const dateFilter = getDateFilter(searchParams);
    if (Object.keys(dateFilter).length > 0) where.deliveryDate = dateFilter;

    const [deliveries, total] = await Promise.all([
      db.deliveryRecord.findMany({
        where,
        orderBy: { deliveryDate: 'desc' },
        skip, take: perPage,
        include: {
          patient: { select: { patientNo: true, firstName: true, lastName: true, phone: true } },
        },
      }),
      db.deliveryRecord.count({ where }),
    ]);

    return NextResponse.json({
      deliveries, items: deliveries, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Deliveries GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
  }
}

// POST /api/deliveries — record a delivery
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      patientId, ancId, deliveryDate, deliveryType, outcome,
      babyGender, babyWeight, apgarScore, complications, deliveredById,
    } = body;

    if (!patientId) return NextResponse.json({ error: 'patientId is required' }, { status: 400 });

    const patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const deliveryNo = await generateCode('DEL');
    const delivery = await db.deliveryRecord.create({
      data: {
        deliveryNo,
        patientId,
        ancId: ancId || null,
        deliveryDate: parseDate(deliveryDate) || new Date(),
        deliveryType: deliveryType || 'VAGINAL',
        outcome: outcome || 'LIVE_BIRTH',
        babyGender: babyGender || '',
        babyWeight: babyWeight !== undefined && babyWeight !== null && String(babyWeight) !== ''
          ? (parseFloat(String(babyWeight)) || null)
          : null,
        apgarScore: parseInt(String(apgarScore ?? 0), 10) || 0,
        complications: complications || '',
        deliveredById: deliveredById || auth.user.id,
        status: 'COMPLETED',
      },
      include: {
        patient: { select: { patientNo: true, firstName: true, lastName: true, phone: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'DELIVERY_CREATE', entityName: 'DeliveryRecord', entityId: delivery.id,
        details: `Delivery ${deliveryNo} — ${patient.patientNo} (${delivery.outcome})`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json(
      { delivery, message: `Delivery recorded. Delivery No: ${deliveryNo}` },
      { status: 201 },
    );
  } catch (error) {
    console.error('Deliveries POST error:', error);
    return NextResponse.json({ error: 'Failed to create delivery record' }, { status: 500 });
  }
}

// PUT /api/deliveries — update delivery record
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      id, ancId, deliveryDate, deliveryType, outcome,
      babyGender, babyWeight, apgarScore, complications, deliveredById, status,
    } = body;
    if (!id) return NextResponse.json({ error: 'Delivery ID required' }, { status: 400 });

    const existing = await db.deliveryRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Delivery record not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (ancId !== undefined) updateData.ancId = ancId || null;
    if (deliveryDate) updateData.deliveryDate = parseDate(deliveryDate) || existing.deliveryDate;
    if (deliveryType) updateData.deliveryType = deliveryType;
    if (outcome) updateData.outcome = outcome;
    if (babyGender !== undefined) updateData.babyGender = babyGender;
    if (babyWeight !== undefined) {
      updateData.babyWeight = babyWeight === null || String(babyWeight) === ''
        ? null
        : (parseFloat(String(babyWeight)) || null);
    }
    if (apgarScore !== undefined) updateData.apgarScore = parseInt(String(apgarScore), 10) || 0;
    if (complications !== undefined) updateData.complications = complications;
    if (deliveredById !== undefined) updateData.deliveredById = deliveredById || '';
    if (status) updateData.status = status;

    const delivery = await db.deliveryRecord.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'DELIVERY_UPDATE', entityName: 'DeliveryRecord', entityId: id,
        details: `Delivery ${existing.deliveryNo} updated`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ delivery, message: 'Delivery record updated' });
  } catch (error) {
    console.error('Deliveries PUT error:', error);
    return NextResponse.json({ error: 'Failed to update delivery record' }, { status: 500 });
  }
}
