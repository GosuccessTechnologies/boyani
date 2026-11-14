import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getPagination, money } from '@/lib/api';

/**
 * PRESCRIPTIONS API — doctor prescribing with automatic drug price lookup.
 * Items store a price snapshot at prescribing time (drugName/unitPrice/totalPrice),
 * so later price changes never mutate historical prescriptions.
 */

const PATIENT_SELECT = { patientNo: true, firstName: true, lastName: true, phone: true, paymentMode: true };

/** Build priced prescription items from body items (drug lookup fills name + price). */
async function buildPricedItems(rawItems: Array<Record<string, unknown>>) {
  const drugIds = rawItems.map(i => i.drugId).filter(Boolean).map(String);
  const drugs = drugIds.length > 0 ? await db.drug.findMany({ where: { id: { in: drugIds } } }) : [];
  const drugMap = new Map(drugs.map(d => [d.id, d]));

  return rawItems.map(it => {
    const drug = it.drugId ? drugMap.get(String(it.drugId)) : undefined;
    const quantity = parseInt(String(it.quantity ?? 1), 10) || 1;
    const unitPrice = drug ? money(drug.unitPrice) : money(parseFloat(String(it.unitPrice ?? 0)) || 0);
    return {
      drugId: drug ? drug.id : null,
      drugName: drug ? drug.name : String(it.drugName || ''),
      dosage: String(it.dosage || ''),
      frequency: String(it.frequency || ''),
      duration: String(it.duration || ''),
      quantity,
      instructions: String(it.instructions || ''),
      unitPrice,
      totalPrice: money(unitPrice * quantity),
    };
  });
}

// GET /api/prescriptions — list with filters; ?id= single with items{drug} + patient
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const patientId = searchParams.get('patientId') || '';
    const visitId = searchParams.get('visitId') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const prescription = await db.prescription.findUnique({
        where: { id },
        include: {
          patient: { select: PATIENT_SELECT },
          items: { include: { drug: true } },
        },
      });
      if (!prescription) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
      return NextResponse.json({ prescription });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { prescriptionNo: { contains: search } },
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
    if (visitId) where.visitId = visitId;

    const [prescriptions, total] = await Promise.all([
      db.prescription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: perPage,
        include: {
          patient: { select: PATIENT_SELECT },
          _count: { select: { items: true } },
        },
      }),
      db.prescription.count({ where }),
    ]);

    return NextResponse.json({
      prescriptions, items: prescriptions, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Prescriptions GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch prescriptions' }, { status: 500 });
  }
}

// POST /api/prescriptions — create with priced items
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'DOCTOR']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { patientId, visitId, consultationId, doctorId, notes, items } = body;

    if (!patientId) return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one medication item is required' }, { status: 400 });
    }

    const patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const itemRows = await buildPricedItems(items);
    const prescriptionNo = await generateCode('PRS');
    const prescription = await db.prescription.create({
      data: {
        prescriptionNo,
        patientId,
        visitId: visitId || null,
        consultationId: consultationId || null,
        doctorId: doctorId || auth.user.id,
        notes: notes || '',
        status: 'PRESCRIBED',
        items: { create: itemRows },
      },
      include: {
        patient: { select: PATIENT_SELECT },
        items: { include: { drug: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'PRESCRIPTION_CREATE', entityName: 'Prescription', entityId: prescription.id,
        details: `Prescription ${prescriptionNo} for ${patient.patientNo} — ${itemRows.length} item(s)`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json(
      { prescription, message: `Prescription ${prescriptionNo} created` },
      { status: 201 },
    );
  } catch (error) {
    console.error('Prescriptions POST error:', error);
    return NextResponse.json({ error: 'Failed to create prescription' }, { status: 500 });
  }
}

// PUT /api/prescriptions — update status/notes, or replace items ({ id, items })
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'DOCTOR']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, status, notes, items } = body;
    if (!id) return NextResponse.json({ error: 'Prescription ID required' }, { status: 400 });

    const existing = await db.prescription.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });

    const replaceItems = Array.isArray(items) && items.length > 0;
    const itemRows = replaceItems ? await buildPricedItems(items) : null;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (itemRows) updateData.items = { create: itemRows };

    const prescription = await db.$transaction(async (tx) => {
      if (replaceItems) {
        await tx.prescriptionItem.deleteMany({ where: { prescriptionId: id } });
      }
      return tx.prescription.update({
        where: { id },
        data: updateData,
        include: {
          patient: { select: PATIENT_SELECT },
          items: { include: { drug: true } },
        },
      });
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'PRESCRIPTION_UPDATE', entityName: 'Prescription', entityId: id,
        details: `Prescription ${existing.prescriptionNo} updated${status ? ` — status → ${status}` : ''}${replaceItems ? ' — items replaced' : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ prescription, message: 'Prescription updated' });
  } catch (error) {
    console.error('Prescriptions PUT error:', error);
    return NextResponse.json({ error: 'Failed to update prescription' }, { status: 500 });
  }
}
