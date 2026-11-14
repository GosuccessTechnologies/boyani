import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * ANC (ANTENATAL CARE) API — MCH registrations.
 * EDD is auto-computed as LMP + 280 days when not supplied.
 */

const LIST_ROLES = ['ADMIN', 'NURSE', 'DOCTOR'];

/** Parse a date-ish body value → Date | null */
function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

// GET /api/anc — list registrations; ?id= single
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, LIST_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const patientId = searchParams.get('patientId') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const anc = await db.aNCRegistration.findUnique({
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
      if (!anc) return NextResponse.json({ error: 'ANC registration not found' }, { status: 404 });
      return NextResponse.json({ anc });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { ancNo: { contains: search } },
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
    if (patientId) where.patientId = patientId;

    const [ancRecords, total] = await Promise.all([
      db.aNCRegistration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: perPage,
        include: {
          patient: { select: { patientNo: true, firstName: true, lastName: true, phone: true } },
        },
      }),
      db.aNCRegistration.count({ where }),
    ]);

    return NextResponse.json({
      ancRecords, items: ancRecords, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('ANC GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch ANC registrations' }, { status: 500 });
  }
}

// POST /api/anc — register antenatal client (EDD = LMP + 280 days if missing)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'NURSE']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      patientId, lmpDate, eddDate, gravida, para, gestationWeeks,
      bloodGroup, rhFactor, riskFactors, partnerName, partnerHivTested,
      pmtctEnrolled, supplements, registeredById,
    } = body;

    if (!patientId) return NextResponse.json({ error: 'patientId is required' }, { status: 400 });

    const patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const lmp = parseDate(lmpDate);
    let edd = parseDate(eddDate);
    if (lmp && !edd) {
      edd = new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000);
    }

    const ancNo = await generateCode('ANC');
    const anc = await db.aNCRegistration.create({
      data: {
        ancNo,
        patientId,
        lmpDate: lmp,
        eddDate: edd,
        gravida: parseInt(String(gravida ?? 1), 10) || 1,
        para: parseInt(String(para ?? 0), 10) || 0,
        gestationWeeks: parseInt(String(gestationWeeks ?? 0), 10) || 0,
        bloodGroup: bloodGroup || '',
        rhFactor: rhFactor || '',
        riskFactors: riskFactors || '',
        partnerName: partnerName || '',
        partnerHivTested: !!partnerHivTested,
        pmtctEnrolled: !!pmtctEnrolled,
        supplements: supplements || '',
        registeredById: registeredById || auth.user.id,
        status: 'ACTIVE',
      },
      include: {
        patient: { select: { patientNo: true, firstName: true, lastName: true, phone: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'ANC_CREATE', entityName: 'ANCRegistration', entityId: anc.id,
        details: `ANC ${ancNo} registered for ${patient.patientNo}${edd ? ` — EDD ${edd.toISOString().slice(0, 10)}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json(
      { anc, message: `ANC registration created. ANC No: ${ancNo}` },
      { status: 201 },
    );
  } catch (error) {
    console.error('ANC POST error:', error);
    return NextResponse.json({ error: 'Failed to create ANC registration' }, { status: 500 });
  }
}

// PUT /api/anc — update registration fields + status + visitsCompleted
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, LIST_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      id, lmpDate, eddDate, gravida, para, gestationWeeks, bloodGroup, rhFactor,
      riskFactors, partnerName, partnerHivTested, pmtctEnrolled, supplements,
      visitsCompleted, status,
    } = body;
    if (!id) return NextResponse.json({ error: 'ANC registration ID required' }, { status: 400 });

    const existing = await db.aNCRegistration.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'ANC registration not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (lmpDate !== undefined) updateData.lmpDate = parseDate(lmpDate);
    if (eddDate !== undefined) {
      updateData.eddDate = parseDate(eddDate);
    } else if (lmpDate !== undefined) {
      // LMP changed and no explicit EDD supplied → recompute
      const lmp = parseDate(lmpDate);
      if (lmp) updateData.eddDate = new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000);
    }
    if (gravida !== undefined) updateData.gravida = parseInt(String(gravida), 10) || 1;
    if (para !== undefined) updateData.para = parseInt(String(para), 10) || 0;
    if (gestationWeeks !== undefined) updateData.gestationWeeks = parseInt(String(gestationWeeks), 10) || 0;
    if (visitsCompleted !== undefined) updateData.visitsCompleted = parseInt(String(visitsCompleted), 10) || 0;
    if (status) updateData.status = status;
    if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup;
    if (rhFactor !== undefined) updateData.rhFactor = rhFactor;
    if (riskFactors !== undefined) updateData.riskFactors = riskFactors;
    if (partnerName !== undefined) updateData.partnerName = partnerName;
    if (partnerHivTested !== undefined) updateData.partnerHivTested = !!partnerHivTested;
    if (pmtctEnrolled !== undefined) updateData.pmtctEnrolled = !!pmtctEnrolled;
    if (supplements !== undefined) updateData.supplements = supplements;

    const anc = await db.aNCRegistration.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'ANC_UPDATE', entityName: 'ANCRegistration', entityId: id,
        details: `ANC ${existing.ancNo} updated${status ? ` — status → ${status}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ anc, message: 'ANC registration updated' });
  } catch (error) {
    console.error('ANC PUT error:', error);
    return NextResponse.json({ error: 'Failed to update ANC registration' }, { status: 500 });
  }
}
