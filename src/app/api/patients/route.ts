import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generatePatientNo, generateCode } from '@/lib/auth';
import { getPagination, money } from '@/lib/api';

/**
 * PATIENTS API — Registrar portal core.
 * Registration captures Kenyan demographics, next-of-kin, payment mode (CASH/SHA/INSURANCE),
 * auto-generates patient number, and opens a Visit.
 *
 * Instruction 21b:
 *  - GET ?search= matches name / phone / national ID / SHA no (duplicate check at the desk).
 *  - GET ?patientTimeline=<id> returns the full encounter timeline (visits, consultations,
 *    lab orders + results, prescriptions, vitals with recorder names, admissions).
 *  - POST accepts { existingPatientId } to continue with an existing record (update + new visit)
 *    and initialTests: [{ serviceId, atDesk }] — desk tests only bill; laboratory tests are
 *    billed AND placed on a PENDING LabOrder (requestSource RECEPTIONIST) for the lab tech.
 */

const STAFF_ROLES = ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'CASHIER'];

// GET /api/patients — search & list / ?id= full history / ?patientTimeline= encounter timeline
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, STAFF_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const paymentMode = searchParams.get('paymentMode') || '';
    const id = searchParams.get('id') || '';
    const patientTimeline = searchParams.get('patientTimeline') || '';

    // ── Encounter timeline (Instruction 21b — shared timeline interface) ──
    if (patientTimeline) {
      const [patient, visits, consultations, labOrders, prescriptions, vitals, admissions] = await Promise.all([
        db.patient.findUnique({
          where: { id: patientTimeline },
          select: {
            id: true, patientNo: true, firstName: true, lastName: true, gender: true, dateOfBirth: true,
            nationalId: true, phone: true, email: true, bloodType: true, allergies: true, maritalStatus: true,
            county: true, subCounty: true, location: true, village: true, address: true,
            kinName: true, kinRelationship: true, kinPhone: true,
            paymentMode: true, shaNumber: true, insuranceProvider: true, insuranceNo: true, createdAt: true,
          },
        }),
        db.visit.findMany({ where: { patientId: patientTimeline }, orderBy: { createdAt: 'desc' }, take: 50 }),
        db.consultation.findMany({ where: { patientId: patientTimeline }, orderBy: { createdAt: 'desc' }, take: 100 }),
        db.labOrder.findMany({
          where: { patientId: patientTimeline },
          orderBy: { createdAt: 'desc' }, take: 50,
          include: { items: true },
        }),
        db.prescription.findMany({
          where: { patientId: patientTimeline },
          orderBy: { createdAt: 'desc' }, take: 50,
          include: { items: { include: { drug: true } } },
        }),
        db.vitalRecord.findMany({ where: { patientId: patientTimeline }, orderBy: { recordedAt: 'desc' }, take: 100 }),
        db.admission.findMany({
          where: { patientId: patientTimeline },
          orderBy: { admissionDate: 'desc' }, take: 20,
          include: { bed: { include: { ward: true } } },
        }),
      ]);
      if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

      // Recorder names for vitals (VitalRecord has no User relation — resolve manually)
      const recorderIds = [...new Set(vitals.map(v => v.recordedById).filter(Boolean))];
      const recorders = recorderIds.length
        ? await db.user.findMany({ where: { id: { in: recorderIds } }, select: { id: true, firstName: true, lastName: true, username: true, role: true } })
        : [];
      const nameById = new Map(recorders.map(u => [u.id, `${u.firstName} ${u.lastName}`.trim() || u.username]));

      return NextResponse.json({
        patient,
        visits,
        consultations,
        labOrders,
        prescriptions,
        vitals: vitals.map(v => ({ ...v, recordedByName: v.recordedById ? (nameById.get(v.recordedById) || '') : '' })),
        admissions,
      });
    }

    // Single patient with full history
    if (id) {
      const patient = await db.patient.findUnique({
        where: { id },
        include: {
          visits: { orderBy: { createdAt: 'desc' }, take: 30, include: { bills: { include: { items: true } } } },
          appointments: { orderBy: { appointmentDate: 'desc' }, take: 20 },
          prescriptions: { orderBy: { createdAt: 'desc' }, take: 20, include: { items: true } },
          labOrders: { orderBy: { createdAt: 'desc' }, take: 20, include: { items: true } },
          admissions: { orderBy: { admissionDate: 'desc' }, take: 10, include: { bed: { include: { ward: true } } } },
          vitals: { orderBy: { recordedAt: 'desc' }, take: 10 },
          ancRecords: true,
          vaccinations: { orderBy: { dateGiven: 'desc' }, take: 20 },
          bills: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });
      if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      return NextResponse.json({ patient });
    }

    const where: Record<string, unknown> = { isActive: true };
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { patientNo: { contains: search } },
        { phone: { contains: search } },
        { nationalId: { contains: search } },
        { shaNumber: { contains: search } },
      ];
    }
    if (paymentMode) where.paymentMode = paymentMode;

    const [patients, total] = await Promise.all([
      db.patient.findMany({
        where, orderBy: { createdAt: 'desc' }, skip, take: perPage,
        include: {
          _count: { select: { visits: true, prescriptions: true, labOrders: true } },
          visits: { orderBy: { createdAt: 'desc' }, take: 1, select: { visitNo: true, createdAt: true, visitType: true, status: true } },
        },
      }),
      db.patient.count({ where }),
    ]);

    return NextResponse.json({
      patients, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Patients GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
  }
}

// POST /api/patients — register patient (+ open visit + bulk import support)
// Instruction 21b: { existingPatientId } continues with an existing record (update + new visit);
// initialTests: [{ serviceId, atDesk }] — atDesk tests bill only, laboratory tests ALSO open a
// PENDING LabOrder (requestSource RECEPTIONIST) so the lab tech sees them at their worklist.
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'RECEPTIONIST']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { bulkItems, openVisit, existingPatientId, ...data } = body;

    // Bulk CSV import
    if (bulkItems && Array.isArray(bulkItems) && bulkItems.length > 0) {
      let created = 0;
      for (const b of bulkItems) {
        if (!b.firstName || !b.lastName) continue;
        const patientNo = await generatePatientNo();
        await db.patient.create({
          data: {
            patientNo,
            firstName: b.firstName, lastName: b.lastName,
            dateOfBirth: b.dateOfBirth ? new Date(b.dateOfBirth) : null,
            gender: b.gender || 'UNKNOWN',
            nationalId: b.nationalId || '',
            phone: b.phone || '',
            county: b.county || '', subCounty: b.subCounty || '',
            location: b.location || '', village: b.village || '',
            paymentMode: b.paymentMode || 'CASH',
            kinName: b.kinName || '', kinPhone: b.kinPhone || '',
          },
        }).catch(() => null);
        created++;
      }
      return NextResponse.json({ imported: created });
    }

    // ── Continue with an EXISTING patient (duplicate confirmed at the desk) ──
    let patient;
    let continuedExisting = false;
    if (existingPatientId) {
      patient = await db.patient.findUnique({ where: { id: existingPatientId } });
      if (!patient) return NextResponse.json({ error: 'Existing patient not found' }, { status: 404 });

      const updateData: Record<string, unknown> = {};
      for (const key of ['firstName', 'lastName', 'phone', 'email', 'nationalId', 'gender', 'bloodType', 'allergies', 'maritalStatus', 'county', 'subCounty', 'location', 'subLocation', 'village', 'address', 'kinName', 'kinRelationship', 'kinPhone', 'paymentMode', 'shaNumber', 'insuranceProvider', 'insuranceNo']) {
        if (data[key] !== undefined && data[key] !== '') updateData[key] = data[key];
      }
      if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);

      patient = Object.keys(updateData).length
        ? await db.patient.update({ where: { id: existingPatientId }, data: updateData })
        : patient;
      continuedExisting = true;
    } else {
      if (!data.firstName || !data.lastName) {
        return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
      }

      const patientNo = await generatePatientNo();
      patient = await db.patient.create({
        data: {
          patientNo,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          gender: data.gender || 'UNKNOWN',
          nationalId: data.nationalId || '',
          phone: data.phone || '',
          email: data.email || '',
          bloodType: data.bloodType || '',
          allergies: data.allergies || '',
          maritalStatus: data.maritalStatus || '',
          county: data.county || '',
          subCounty: data.subCounty || '',
          location: data.location || '',
          subLocation: data.subLocation || '',
          village: data.village || '',
          address: data.address || '',
          kinName: data.kinName || '',
          kinRelationship: data.kinRelationship || '',
          kinPhone: data.kinPhone || '',
          paymentMode: data.paymentMode || 'CASH',
          shaNumber: data.shaNumber || '',
          insuranceProvider: data.insuranceProvider || '',
          insuranceNo: data.insuranceNo || '',
        },
      });
    }

    // Optionally open a visit immediately (registration → testing/doctor flow)
    let visit: Awaited<ReturnType<typeof db.visit.create>> | null = null;
    if (openVisit !== false) {
      const visitNo = `VIS-${Date.now().toString(36).toUpperCase()}`;
      visit = await db.visit.create({
        data: {
          visitNo,
          patientId: patient.id,
          visitType: data.visitType || 'OUTPATIENT',
          status: 'ACTIVE',
          notes: data.registrationNotes || '',
        },
      });
    }

    // ── Initial quick tests — desk vs laboratory split (Instruction 21b) ──
    // Accepts the legacy shape (serviceId[]) and the new shape ([{ serviceId, atDesk }]).
    const rawTests: unknown[] = Array.isArray(body.initialTests) ? body.initialTests : [];
    const testEntries = rawTests
      .map(t => (typeof t === 'string' ? { serviceId: t, atDesk: true } : t as { serviceId?: string; atDesk?: boolean }))
      .filter((t): t is { serviceId: string; atDesk: boolean } => !!t && !!t.serviceId);

    let billItems: Array<Record<string, unknown>> = [];
    let labOrder: Awaited<ReturnType<typeof db.labOrder.create>> | null = null;

    if (testEntries.length > 0) {
      const services = await db.service.findMany({ where: { id: { in: testEntries.map(t => t.serviceId) } } });
      const serviceById = new Map(services.map(s => [s.id, s]));

      // Everything selected is billed to the visit (paid at the cashier)
      billItems = testEntries
        .filter(t => serviceById.has(t.serviceId))
        .map(t => {
          const s = serviceById.get(t.serviceId)!;
          return {
            itemType: t.atDesk === false ? 'LAB' : 'SERVICE',
            serviceId: s.id,
            itemName: s.name,
            quantity: 1,
            unitPrice: money(s.price),
            totalPrice: money(s.price),
            department: s.category,
            shaCovered: s.shaCovered,
          };
        });

      if (visit && billItems.length > 0) {
        await db.bill.create({
          data: {
            billNo: `BIL-${Date.now().toString(36).toUpperCase()}`,
            patientId: patient.id,
            visitId: visit.id,
            subtotal: billItems.reduce((s, i) => s + (i.totalPrice as number), 0),
            totalAmount: billItems.reduce((s, i) => s + (i.totalPrice as number), 0),
            status: 'UNPAID',
            items: { create: billItems },
          },
        });
      }

      // Laboratory selections ALSO open a PENDING lab order for the lab tech
      const labEntries = testEntries.filter(t => t.atDesk === false && serviceById.has(t.serviceId));
      if (labEntries.length > 0) {
        const linkedTests = await db.labTest.findMany({
          where: { serviceId: { in: labEntries.map(t => t.serviceId) } },
        });
        const testByService = new Map(linkedTests.map(t => [t.serviceId as string, t]));

        const orderItems: Array<{ labTestId: string; testName: string }> = [];
        for (const entry of labEntries) {
          let labTest: { id: string } | null | undefined = testByService.get(entry.serviceId);
          if (!labTest) {
            // No LabTest linked to this service yet — create one so the order can be tracked
            const svc = serviceById.get(entry.serviceId)!;
            labTest = await db.labTest.create({
              data: {
                code: svc.code || `LT-${Date.now().toString(36).toUpperCase()}`,
                name: svc.name,
                serviceId: svc.id,
                category: 'POCT',
                specimenType: 'Blood',
                turnaroundHours: 24,
              },
            }).catch(() => null);
          }
          if (labTest) {
            orderItems.push({ labTestId: labTest.id, testName: serviceById.get(entry.serviceId)!.name });
          }
        }

        if (orderItems.length > 0) {
          const orderNo = await generateCode('LAB');
          labOrder = await db.labOrder.create({
            data: {
              orderNo,
              patientId: patient.id,
              visitId: visit?.id || null,
              orderedById: auth.user.id,
              requestSource: 'RECEPTIONIST',
              status: 'PENDING',
              priority: 'ROUTINE',
              notes: 'Ordered at the registration desk',
              items: { create: orderItems },
            },
            include: { items: true },
          });
        }
      }
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: continuedExisting ? 'PATIENT_UPDATE_AND_VISIT' : 'PATIENT_REGISTER',
        entityName: 'Patient', entityId: patient.id,
        details: continuedExisting
          ? `Continued registration for ${patient.firstName} ${patient.lastName} (${patient.patientNo}) — new visit ${visit?.visitNo || ''}`
          : `Registered ${patient.firstName} ${patient.lastName} (${patient.patientNo})`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({
      patient,
      visit,
      initialCharges: billItems,
      labOrder,
      message: continuedExisting
        ? `Visit opened for existing patient ${patient.patientNo}`
        : `Patient registered successfully. Patient No: ${patient.patientNo}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Patients POST error:', error);
    return NextResponse.json({ error: 'Failed to register patient' }, { status: 500 });
  }
}

// PUT /api/patients — update patient
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'RECEPTIONIST']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Patient ID required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    for (const key of ['firstName', 'lastName', 'phone', 'email', 'nationalId', 'gender', 'bloodType', 'allergies', 'maritalStatus', 'county', 'subCounty', 'location', 'subLocation', 'village', 'address', 'kinName', 'kinRelationship', 'kinPhone', 'paymentMode', 'shaNumber', 'insuranceProvider', 'insuranceNo']) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);

    const updated = await db.patient.update({ where: { id }, data: updateData });
    return NextResponse.json({ patient: updated, message: 'Patient updated' });
  } catch (error) {
    console.error('Patients PUT error:', error);
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 });
  }
}
