import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * VACCINATIONS API — immunization records (MCH / child welfare).
 * ?patientId= → the patient's vaccination history; otherwise a paginated list.
 */

const ROLES = ['ADMIN', 'NURSE', 'DOCTOR'];

/** Parse a date-ish body value → Date | null */
function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

// GET /api/vaccinations — ?patientId= history (desc), else paginated list
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const patientId = searchParams.get('patientId') || '';
    const search = searchParams.get('search') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const vaccination = await db.vaccinationRecord.findUnique({
        where: { id },
        include: {
          patient: { select: { patientNo: true, firstName: true, lastName: true, dateOfBirth: true } },
        },
      });
      if (!vaccination) return NextResponse.json({ error: 'Vaccination record not found' }, { status: 404 });
      return NextResponse.json({ vaccination });
    }

    // Patient history — newest first
    if (patientId) {
      const [vaccinations, patient] = await Promise.all([
        db.vaccinationRecord.findMany({
          where: { patientId },
          orderBy: { dateGiven: 'desc' },
          take: 100,
        }),
        db.patient.findUnique({
          where: { id: patientId },
          select: { patientNo: true, firstName: true, lastName: true, dateOfBirth: true, gender: true },
        }),
      ]);
      if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      return NextResponse.json({ vaccinations, items: vaccinations, patient });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { vaccineName: { contains: search } },
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

    const [vaccinations, total] = await Promise.all([
      db.vaccinationRecord.findMany({
        where,
        orderBy: { dateGiven: 'desc' },
        skip, take: perPage,
        include: {
          patient: { select: { patientNo: true, firstName: true, lastName: true, dateOfBirth: true } },
        },
      }),
      db.vaccinationRecord.count({ where }),
    ]);

    return NextResponse.json({
      vaccinations, items: vaccinations, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Vaccinations GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch vaccinations' }, { status: 500 });
  }
}

// POST /api/vaccinations — record a vaccination dose
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'NURSE']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      patientId, vaccineName, doseNumber, dateGiven, nextDueDate,
      batchNumber, administeredBy, site, notes,
    } = body;

    if (!patientId) return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    if (!vaccineName) return NextResponse.json({ error: 'vaccineName is required' }, { status: 400 });

    const patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const vaccination = await db.vaccinationRecord.create({
      data: {
        patientId,
        vaccineName,
        doseNumber: parseInt(String(doseNumber ?? 1), 10) || 1,
        dateGiven: parseDate(dateGiven) || new Date(),
        nextDueDate: parseDate(nextDueDate),
        batchNumber: batchNumber || '',
        administeredBy: administeredBy || auth.user.id,
        site: site || '',
        notes: notes || '',
      },
      include: {
        patient: { select: { patientNo: true, firstName: true, lastName: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'VACCINATION_CREATE', entityName: 'VaccinationRecord', entityId: vaccination.id,
        details: `${vaccineName} dose ${vaccination.doseNumber} given to ${patient.patientNo}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ vaccination, message: 'Vaccination recorded' }, { status: 201 });
  } catch (error) {
    console.error('Vaccinations POST error:', error);
    return NextResponse.json({ error: 'Failed to record vaccination' }, { status: 500 });
  }
}

// PUT /api/vaccinations — update vaccination record
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'NURSE']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      id, vaccineName, doseNumber, dateGiven, nextDueDate,
      batchNumber, administeredBy, site, notes,
    } = body;
    if (!id) return NextResponse.json({ error: 'Vaccination ID required' }, { status: 400 });

    const existing = await db.vaccinationRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Vaccination record not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (vaccineName) updateData.vaccineName = vaccineName;
    if (doseNumber !== undefined) updateData.doseNumber = parseInt(String(doseNumber), 10) || 1;
    if (dateGiven) updateData.dateGiven = parseDate(dateGiven) || existing.dateGiven;
    if (nextDueDate !== undefined) updateData.nextDueDate = parseDate(nextDueDate);
    if (batchNumber !== undefined) updateData.batchNumber = batchNumber;
    if (administeredBy !== undefined) updateData.administeredBy = administeredBy || '';
    if (site !== undefined) updateData.site = site;
    if (notes !== undefined) updateData.notes = notes;

    const vaccination = await db.vaccinationRecord.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'VACCINATION_UPDATE', entityName: 'VaccinationRecord', entityId: id,
        details: `${existing.vaccineName} record updated`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ vaccination, message: 'Vaccination record updated' });
  } catch (error) {
    console.error('Vaccinations PUT error:', error);
    return NextResponse.json({ error: 'Failed to update vaccination record' }, { status: 500 });
  }
}
