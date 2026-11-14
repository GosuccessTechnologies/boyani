import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getPagination, money } from '@/lib/api';

/**
 * CONSULTATIONS API — doctor clinical encounters.
 * When a consultation is recorded with a diagnosis, a consultation fee is
 * automatically billed to the patient's active visit (UNPAID, settled at cashier).
 */

const ACTIVE_VISIT_STATUSES = ['ACTIVE', 'WAITING_LAB', 'WAITING_DOCTOR', 'WAITING_PHARMACY', 'READY_FOR_PAYMENT'];

// GET /api/consultations — list with filters; ?id= single
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'DOCTOR', 'NURSE']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const doctorId = searchParams.get('doctorId') || '';
    const status = searchParams.get('status') || '';
    const patientId = searchParams.get('patientId') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const consultation = await db.consultation.findUnique({
        where: { id },
        include: {
          patient: {
            select: {
              id: true, patientNo: true, firstName: true, lastName: true, gender: true,
              dateOfBirth: true, phone: true, bloodType: true, allergies: true, paymentMode: true,
            },
          },
        },
      });
      if (!consultation) return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });
      return NextResponse.json({ consultation });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { consultationNo: { contains: search } },
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
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;

    const [consultations, total] = await Promise.all([
      db.consultation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: perPage,
        include: {
          patient: { select: { patientNo: true, firstName: true, lastName: true, phone: true, gender: true } },
        },
      }),
      db.consultation.count({ where }),
    ]);

    return NextResponse.json({
      consultations, items: consultations, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Consultations GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch consultations' }, { status: 500 });
  }
}

// POST /api/consultations — record encounter; auto-bills consultation fee when a diagnosis is given
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'DOCTOR']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      patientId, visitId, doctorId, chiefComplaint, history, examination,
      diagnosis, differential, treatmentPlan, followUpDate,
    } = body;

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    const patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const consultationNo = await generateCode('CON');
    const consultation = await db.consultation.create({
      data: {
        consultationNo,
        patientId,
        visitId: visitId || null,
        doctorId: doctorId || auth.user.id,
        chiefComplaint: chiefComplaint || '',
        history: history || '',
        examination: examination || '',
        diagnosis: diagnosis || '',
        differential: differential || '',
        treatmentPlan: treatmentPlan || '',
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        status: 'IN_PROGRESS',
      },
      include: {
        patient: { select: { patientNo: true, firstName: true, lastName: true } },
      },
    });

    // Consultation fee — billed to the patient's active visit (paid at cashier)
    const response: Record<string, unknown> = {
      consultation,
      message: `Consultation ${consultationNo} recorded for ${patient.firstName} ${patient.lastName}`,
    };
    if (diagnosis) {
      const service =
        (await db.service.findUnique({ where: { code: 'CONS-GEN' } }).catch(() => null)) ||
        (await db.service.findFirst({ where: { category: 'CONSULTATION', isActive: true } }).catch(() => null));
      if (service) {
        const activeVisit = await db.visit.findFirst({
          where: { patientId, status: { in: ACTIVE_VISIT_STATUSES } },
          orderBy: { createdAt: 'desc' },
        });
        if (activeVisit) {
          const bill = await db.bill.create({
            data: {
              billNo: `BIL-${Date.now().toString(36).toUpperCase()}`,
              patientId,
              visitId: activeVisit.id,
              subtotal: money(service.price),
              totalAmount: money(service.price),
              status: 'UNPAID',
              items: {
                create: [{
                  itemType: 'CONSULTATION',
                  serviceId: service.id,
                  itemName: service.name,
                  quantity: 1,
                  unitPrice: money(service.price),
                  totalPrice: money(service.price),
                  department: service.category,
                  shaCovered: service.shaCovered,
                  sourceRef: consultation.id,
                }],
              },
            },
          });
          response.bill = bill;
          response.message = `${response.message} — consultation fee of KSh ${money(service.price)} billed to visit ${activeVisit.visitNo}`;
        }
      }
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'CONSULTATION_CREATE', entityName: 'Consultation', entityId: consultation.id,
        details: `Consultation ${consultationNo} for ${patient.patientNo}${diagnosis ? ` — dx: ${diagnosis}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Consultations POST error:', error);
    return NextResponse.json({ error: 'Failed to create consultation' }, { status: 500 });
  }
}

// PUT /api/consultations — update clinical fields + status (IN_PROGRESS, AWAITING_RESULTS, COMPLETED)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'DOCTOR']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      id, status, chiefComplaint, history, examination,
      diagnosis, differential, treatmentPlan, followUpDate, doctorId,
    } = body;
    if (!id) return NextResponse.json({ error: 'Consultation ID required' }, { status: 400 });

    const existing = await db.consultation.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (chiefComplaint !== undefined) updateData.chiefComplaint = chiefComplaint;
    if (history !== undefined) updateData.history = history;
    if (examination !== undefined) updateData.examination = examination;
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
    if (differential !== undefined) updateData.differential = differential;
    if (treatmentPlan !== undefined) updateData.treatmentPlan = treatmentPlan;
    if (doctorId !== undefined) updateData.doctorId = doctorId || '';
    if (followUpDate !== undefined) {
      updateData.followUpDate = followUpDate ? new Date(followUpDate) : null;
    }

    const consultation = await db.consultation.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'CONSULTATION_UPDATE', entityName: 'Consultation', entityId: id,
        details: `Consultation ${existing.consultationNo} updated${status ? ` — status → ${status}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ consultation, message: 'Consultation updated' });
  } catch (error) {
    console.error('Consultations PUT error:', error);
    return NextResponse.json({ error: 'Failed to update consultation' }, { status: 500 });
  }
}
