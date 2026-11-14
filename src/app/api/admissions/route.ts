import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * ADMISSIONS API — inpatient ward management.
 * ?tab=ward-occupancy returns the live ward/bed board (bed status + current patient).
 * Admitting sets the bed OCCUPIED (auto-opens an INPATIENT visit if none active);
 * discharging frees the bed — a doctor's discharge moves the visit to READY_FOR_PAYMENT.
 */

const STAFF_ROLES = ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'CASHIER'];
const ACTIVE_VISIT_STATUSES = ['ACTIVE', 'WAITING_LAB', 'WAITING_DOCTOR', 'WAITING_PHARMACY', 'READY_FOR_PAYMENT'];

// GET /api/admissions — list / ward-occupancy board / ?id= single
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, STAFF_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const tab = searchParams.get('tab') || '';
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const wardId = searchParams.get('wardId') || '';
    const patientId = searchParams.get('patientId') || '';
    const id = searchParams.get('id') || '';

    // Ward & bed occupancy board
    if (tab === 'ward-occupancy') {
      const wards = await db.ward.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        include: { beds: { orderBy: { bedNumber: 'asc' } } },
      });
      const activeAdmissions = await db.admission.findMany({
        where: { status: 'ACTIVE' },
        include: {
          bed: true,
          patient: { select: { patientNo: true, firstName: true, lastName: true } },
        },
      });
      const bedPatientMap = new Map<string, { patientName: string; patientNo: string; admissionNo: string }>();
      for (const adm of activeAdmissions) {
        if (adm.bedId) {
          bedPatientMap.set(adm.bedId, {
            patientName: `${adm.patient.firstName} ${adm.patient.lastName}`.trim(),
            patientNo: adm.patient.patientNo,
            admissionNo: adm.admissionNo,
          });
        }
      }

      const board = wards.map(w => {
        const totalBeds = w.beds.length;
        const occupiedBeds = w.beds.filter(b => b.status === 'OCCUPIED').length;
        const availableBeds = w.beds.filter(b => b.status === 'AVAILABLE').length;
        return {
          id: w.id,
          name: w.name,
          wardType: w.wardType,
          dailyRate: w.dailyRate,
          totalBeds,
          occupiedBeds,
          availableBeds,
          beds: w.beds.map(b => {
            const occupant = bedPatientMap.get(b.id) || null;
            return {
              id: b.id,
              bedNumber: b.bedNumber,
              status: b.status,
              currentPatient: occupant ? occupant.patientName : null,
              currentPatientNo: occupant ? occupant.patientNo : null,
              currentAdmissionNo: occupant ? occupant.admissionNo : null,
            };
          }),
        };
      });

      return NextResponse.json({ wards: board });
    }

    // Single admission
    if (id) {
      const admission = await db.admission.findUnique({
        where: { id },
        include: {
          patient: {
            select: {
              id: true, patientNo: true, firstName: true, lastName: true, gender: true,
              dateOfBirth: true, phone: true, bloodType: true, allergies: true, paymentMode: true,
            },
          },
          bed: { include: { ward: true } },
        },
      });
      if (!admission) return NextResponse.json({ error: 'Admission not found' }, { status: 404 });
      return NextResponse.json({ admission });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { admissionNo: { contains: search } },
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
    if (wardId) where.bed = { wardId };

    const [admissions, total] = await Promise.all([
      db.admission.findMany({
        where,
        orderBy: { admissionDate: 'desc' },
        skip, take: perPage,
        include: {
          patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, phone: true, paymentMode: true, gender: true, dateOfBirth: true } },
          bed: { include: { ward: { select: { name: true, wardType: true, dailyRate: true } } } },
        },
      }),
      db.admission.count({ where }),
    ]);

    return NextResponse.json({
      admissions, items: admissions, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Admissions GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch admissions' }, { status: 500 });
  }
}

// POST /api/admissions — admit patient to a bed
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'NURSE']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { patientId, visitId, bedId, admissionType, doctorId, admittingDiagnosis } = body;

    if (!patientId) return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    if (!bedId) return NextResponse.json({ error: 'bedId is required' }, { status: 400 });

    const patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const bed = await db.bed.findUnique({ where: { id: bedId }, include: { ward: true } });
    if (!bed) return NextResponse.json({ error: 'Bed not found' }, { status: 404 });
    if (bed.status !== 'AVAILABLE') {
      return NextResponse.json({ error: `Bed ${bed.bedNumber} is not available (status: ${bed.status})` }, { status: 409 });
    }

    // Use the given visit, else the latest active visit, else auto-open an INPATIENT visit
    let visit = visitId ? await db.visit.findUnique({ where: { id: visitId } }) : null;
    if (!visit) {
      visit = await db.visit.findFirst({
        where: { patientId, status: { in: ACTIVE_VISIT_STATUSES } },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!visit) {
      visit = await db.visit.create({
        data: {
          visitNo: `VIS-${Date.now().toString(36).toUpperCase()}`,
          patientId,
          visitType: 'INPATIENT',
          status: 'ACTIVE',
          notes: 'Auto-opened at admission',
        },
      });
    }

    const admissionNo = await generateCode('ADM');
    const admission = await db.admission.create({
      data: {
        admissionNo,
        patientId,
        visitId: visit.id,
        bedId,
        admissionType: admissionType || 'EMERGENCY',
        admittedById: auth.user.id,
        doctorId: doctorId || '',
        admittingDiagnosis: admittingDiagnosis || '',
        status: 'ACTIVE',
      },
      include: {
        patient: { select: { patientNo: true, firstName: true, lastName: true } },
        bed: { include: { ward: { select: { name: true, wardType: true, dailyRate: true } } } },
      },
    });

    // Occupy the bed
    await db.bed.update({ where: { id: bedId }, data: { status: 'OCCUPIED' } });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'ADMISSION_CREATE', entityName: 'Admission', entityId: admission.id,
        details: `Admission ${admissionNo} — ${patient.patientNo} to bed ${bed.bedNumber} (${bed.ward.name})`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json(
      { admission, message: `Patient admitted. Admission No: ${admissionNo}` },
      { status: 201 },
    );
  } catch (error) {
    console.error('Admissions POST error:', error);
    return NextResponse.json({ error: 'Failed to create admission' }, { status: 500 });
  }
}

// PUT /api/admissions — discharge ({ id, dischargeType, dischargeNotes }); frees the bed
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'NURSE', 'DOCTOR']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, dischargeType, dischargeNotes } = body;
    if (!id) return NextResponse.json({ error: 'Admission ID required' }, { status: 400 });

    const existing = await db.admission.findUnique({ where: { id }, include: { bed: true } });
    if (!existing) return NextResponse.json({ error: 'Admission not found' }, { status: 404 });
    if (existing.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Admission already discharged' }, { status: 400 });
    }

    const admission = await db.admission.update({
      where: { id },
      data: {
        dischargeDate: new Date(),
        dischargeType: dischargeType || 'NORMAL',
        dischargeNotes: dischargeNotes || '',
        status: 'DISCHARGED',
      },
      include: {
        patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, gender: true, dateOfBirth: true, phone: true, bloodType: true, allergies: true, paymentMode: true } },
        bed: { include: { ward: { select: { name: true, wardType: true, dailyRate: true } } } },
      },
    });

    // Free the bed
    if (existing.bedId) {
      await db.bed.update({ where: { id: existing.bedId }, data: { status: 'AVAILABLE' } }).catch(() => {});
    }

    // Doctor approving discharge → visit moves to payment stage
    if (auth.user.role === 'DOCTOR' && existing.visitId) {
      await db.visit.update({
        where: { id: existing.visitId },
        data: { status: 'READY_FOR_PAYMENT' },
      }).catch(() => {});
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'ADMISSION_DISCHARGE', entityName: 'Admission', entityId: id,
        details: `Admission ${existing.admissionNo} discharged (${dischargeType || 'NORMAL'})`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ admission, message: `Discharged. Admission No: ${existing.admissionNo}` });
  } catch (error) {
    console.error('Admissions PUT error:', error);
    return NextResponse.json({ error: 'Failed to discharge admission' }, { status: 500 });
  }
}
