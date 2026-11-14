import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getPagination, money } from '@/lib/api';

/**
 * LAB ORDERS API — test ordering & results workflow (Instruction 24 extension).
 * POST (doctor/admin) creates the order AND an UNPAID Bill with LAB BillItems priced
 * from each test's linked Service (paid at cashier). Items may reference either a
 * catalog LabTest (labTestId) or a facility Service (serviceId — the doctor-facing
 * LABORATORY services list); services without a LabTest get one created on the fly.
 * PUT (lab tech/admin) walks the status flow PENDING → SAMPLE_COLLECTED → IN_PROGRESS
 * → COMPLETED → VERIFIED (CANCELLED from any point), records per-item results via
 * itemResults[] (incl. tiptap narrative HTML), or collects samples per test via
 * action='collect-samples'. PUT {action:'doctor-notes'} (doctor/admin, Instruction 21)
 * writes the doctor's medication/interpretation notes stored under the results.
 */

const STAFF_ROLES = ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'CASHIER'];
const STATUS_FLOW = ['PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'];
const ACTIVE_VISIT_STATUSES = ['ACTIVE', 'WAITING_LAB', 'WAITING_DOCTOR', 'WAITING_PHARMACY', 'READY_FOR_PAYMENT'];

interface ItemResultInput {
  itemId?: string;
  result?: string;
  resultValue?: string;
  unit?: string;
  flag?: string;
  remarks?: string;
  narrative?: string; // tiptap HTML narrative (Instruction 24)
}

interface ItemSampleInput {
  itemId?: string;
  sampleType?: string;
  sampleRef?: string;
}

interface OrderItemInput {
  labTestId?: string;
  serviceId?: string;
  testCode?: string;
  testName?: string;
  price?: number;
}

/** Map of userId → display name for requester/operator resolution. */
async function resolveUserNames(ids: Array<string>): Promise<Record<string, string>> {
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (clean.length === 0) return {};
  const users = await db.user.findMany({
    where: { id: { in: clean } },
    select: { id: true, firstName: true, lastName: true, username: true, role: true },
  }).catch(() => []);
  const map: Record<string, string> = {};
  for (const u of users) {
    const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    map[u.id] = full || u.username;
  }
  return map;
}

// GET /api/lab-orders — worklist; ?id= single order with items{labTest{service}} + patient
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, STAFF_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const patientId = searchParams.get('patientId') || '';
    const doctorId = searchParams.get('doctorId') || '';
    const id = searchParams.get('id') || '';

    // Single order — result entry sheet
    if (id) {
      const labOrder = await db.labOrder.findUnique({
        where: { id },
        include: {
          patient: {
            select: {
              id: true, patientNo: true, firstName: true, lastName: true, gender: true,
              dateOfBirth: true, phone: true, bloodType: true, paymentMode: true, shaNumber: true,
            },
          },
          items: { include: { labTest: { include: { service: true } } } }, // insertion order
        },
      });
      if (!labOrder) return NextResponse.json({ error: 'Lab order not found' }, { status: 404 });
      const names = await resolveUserNames([labOrder.orderedById, ...labOrder.items.map(i => i.performedById)]);
      return NextResponse.json({
        labOrder: { ...labOrder, requestedByName: names[labOrder.orderedById] || '' },
        performedByNames: names,
      });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { orderNo: { contains: search } },
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

    // Doctor scope (Instruction 21) — orders for the doctor's patients from ALL
    // sources (doctor / nurse / registrar): patients seen by this doctor (visits,
    // consultations, appointments) plus any order the doctor placed themselves.
    if (doctorId) {
      const [docVisits, docConsults, docAppts] = await Promise.all([
        db.visit.findMany({ where: { doctorId }, select: { patientId: true } }),
        db.consultation.findMany({ where: { doctorId }, select: { patientId: true } }),
        db.appointment.findMany({ where: { doctorId }, select: { patientId: true } }),
      ]);
      const patientIds = Array.from(
        new Set(
          [...docVisits, ...docConsults, ...docAppts]
            .map(v => v.patientId)
            .filter((x): x is string => !!x),
        ),
      );
      const scope: Record<string, unknown> = {
        OR: [
          { orderedById: doctorId },
          ...(patientIds.length > 0 ? [{ patientId: { in: patientIds } }] : []),
        ],
      };
      where.AND = Array.isArray(where.AND) ? [...where.AND, scope] : [scope];
    }

    const [labOrders, total] = await Promise.all([
      db.labOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: perPage,
        include: {
          patient: { select: { patientNo: true, firstName: true, lastName: true, phone: true, gender: true } },
          _count: { select: { items: true } },
        },
      }),
      db.labOrder.count({ where }),
    ]);

    // Requester names (nurse / doctor / registrar who ordered)
    const names = await resolveUserNames(labOrders.map(o => o.orderedById));
    const withRequester = labOrders.map(o => ({ ...o, requestedByName: names[o.orderedById] || '' }));

    return NextResponse.json({
      labOrders: withRequester, items: withRequester, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Lab orders GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch lab orders' }, { status: 500 });
  }
}

// POST /api/lab-orders — doctor orders tests; auto-bills them to the visit (UNPAID, settled at cashier)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'DOCTOR']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { patientId, visitId, orderedById, priority, notes, requestSource, items } = body;

    if (!patientId) return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one test item ({labTestId} or {serviceId}) is required' }, { status: 400 });
    }

    const patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    // Resolve tests (with pricing service). Items reference either a catalog
    // LabTest (labTestId) or a facility Service (serviceId — the doctor-facing
    // LABORATORY services list, Instruction 21); services without a LabTest get
    // one created so the lab can attach results to them.
    const rawItems = items as OrderItemInput[];
    const labTestIds = rawItems.map(i => i.labTestId).filter((x): x is string => !!x);
    const serviceIds = rawItems.map(i => i.serviceId).filter((x): x is string => !!x);
    if (labTestIds.length === 0 && serviceIds.length === 0) {
      return NextResponse.json({ error: 'Each item needs a labTestId or serviceId' }, { status: 400 });
    }

    const tests = await db.labTest.findMany({
      where: {
        OR: [
          ...(labTestIds.length > 0 ? [{ id: { in: labTestIds } }] : []),
          ...(serviceIds.length > 0 ? [{ serviceId: { in: serviceIds } }] : []),
        ],
      },
      include: { service: true },
    });
    const byTestId = new Map(tests.map(t => [t.id, t]));
    const byServiceId = new Map(
      tests.filter(t => t.serviceId).map(t => [t.serviceId as string, t]),
    );

    const resolvedTests: Array<(typeof tests)[number]> = [];
    for (const it of rawItems) {
      const found =
        (it.labTestId && byTestId.get(it.labTestId)) ||
        (it.serviceId && byServiceId.get(it.serviceId)) || null;
      if (found) {
        if (!resolvedTests.some(t => t.id === found.id)) resolvedTests.push(found);
        continue;
      }
      // No catalog LabTest — create one from the facility service so results attach
      if (it.serviceId) {
        const service = await db.service.findUnique({ where: { id: it.serviceId } });
        if (!service) continue;
        const created = await db.labTest.create({
          data: {
            code: service.code || `LT-${Date.now().toString(36).toUpperCase()}`,
            name: it.testName || service.name,
            serviceId: service.id,
          },
          include: { service: true },
        }).catch(() => null);
        if (created) resolvedTests.push(created);
      }
    }
    if (resolvedTests.length === 0) {
      return NextResponse.json({ error: 'No valid lab tests found for the given items' }, { status: 400 });
    }

    // Target visit — the given one, else the patient's latest active visit (consultations pattern)
    let targetVisitId: string | null = null;
    if (visitId) {
      const visit = await db.visit.findUnique({ where: { id: visitId } }).catch(() => null);
      if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
      targetVisitId = visit.id;
    } else {
      const activeVisit = await db.visit.findFirst({
        where: { patientId, status: { in: ACTIVE_VISIT_STATUSES } },
        orderBy: { createdAt: 'desc' },
      });
      targetVisitId = activeVisit?.id || null;
    }

    const orderNo = await generateCode('LAB');
    const labOrder = await db.labOrder.create({
      data: {
        orderNo,
        patientId,
        visitId: targetVisitId,
        orderedById: orderedById || auth.user.id,
        requestSource: requestSource || 'DOCTOR',
        priority: priority || 'ROUTINE',
        notes: notes || '',
        status: 'PENDING',
        items: {
          create: resolvedTests.map(t => ({
            labTestId: t.id,
            testName: t.name,
          })),
        },
      },
      include: {
        patient: { select: { patientNo: true, firstName: true, lastName: true } },
        items: { include: { labTest: { include: { service: true } } } },
      },
    });

    // Bill the tests — priced from each LabTest's linked Service (UNPAID, cashier settles)
    const response: Record<string, unknown> = {
      labOrder,
      message: `Lab order ${orderNo} created with ${resolvedTests.length} test(s)`,
    };
    const billable = resolvedTests.filter(t => t.service);
    if (billable.length > 0) {
      const billItems = billable.map(t => ({
        itemType: 'LAB',
        serviceId: t.service!.id,
        itemName: t.name,
        quantity: 1,
        unitPrice: money(t.service!.price),
        totalPrice: money(t.service!.price),
        department: 'Laboratory',
        shaCovered: t.service!.shaCovered,
        sourceRef: orderNo,
      }));
      const subtotal = money(billItems.reduce((s, i) => s + i.totalPrice, 0));
      const bill = await db.bill.create({
        data: {
          billNo: `BIL-${Date.now().toString(36).toUpperCase()}`,
          patientId,
          visitId: targetVisitId,
          subtotal,
          totalAmount: subtotal,
          status: 'UNPAID',
          items: { create: billItems },
        },
        include: { items: true },
      });
      response.bill = bill;
      response.message = `${response.message} — KSh ${subtotal} billed to ${targetVisitId ? 'visit' : 'patient account'}`;
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'LAB_ORDER_CREATE', entityName: 'LabOrder', entityId: labOrder.id,
        details: `Lab order ${orderNo} for ${patient.patientNo} — ${resolvedTests.map(t => t.code).join(', ')}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Lab orders POST error:', error);
    return NextResponse.json({ error: 'Failed to create lab order' }, { status: 500 });
  }
}

// PUT /api/lab-orders — {id, status, notes} workflow move, {id, itemResults:[...]} result
// entry (incl. narrative HTML), or {id, action:'collect-samples', itemSamples:[...]} to
// record the specimen collected PER TEST and move the order to SAMPLE_COLLECTED.
// {action:'doctor-notes', id, notes} (Instruction 21) — doctor's medication notes under results.
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'LAB_TECH', 'DOCTOR']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, status, notes, itemResults, action, itemSamples } = body;
    if (!id) return NextResponse.json({ error: 'Lab order ID required' }, { status: 400 });

    // Doctor medication/interpretation notes shown under the results (Instruction 21)
    if (action === 'doctor-notes') {
      if (auth.user.role !== 'ADMIN' && auth.user.role !== 'DOCTOR') {
        return NextResponse.json({ error: 'Only doctors can write doctor notes' }, { status: 403 });
      }
      const doctorNotesOrder = await db.labOrder.findUnique({ where: { id } });
      if (!doctorNotesOrder) return NextResponse.json({ error: 'Lab order not found' }, { status: 404 });
      const labOrder = await db.labOrder.update({
        where: { id },
        data: { doctorNotes: typeof notes === 'string' ? notes : '' },
        include: {
          patient: { select: { patientNo: true, firstName: true, lastName: true } },
          items: { include: { labTest: { include: { service: true } } } },
        },
      });
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'LAB_ORDER_DOCTOR_NOTES', entityName: 'LabOrder', entityId: id,
          details: `Doctor notes on lab order ${doctorNotesOrder.orderNo}`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ labOrder, message: 'Doctor notes saved' });
    }

    // Everything below is lab-tech / admin workflow
    if (auth.user.role === 'DOCTOR') {
      return NextResponse.json({ error: 'Doctors can only update doctor notes' }, { status: 403 });
    }

    const existing = await db.labOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return NextResponse.json({ error: 'Lab order not found' }, { status: 404 });

    let message = 'Lab order updated';

    // 0) Sample collection — record specimen per test, then move to SAMPLE_COLLECTED
    if (action === 'collect-samples') {
      if (existing.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Cannot collect samples on a cancelled order' }, { status: 400 });
      }
      if (['COMPLETED', 'VERIFIED'].includes(existing.status)) {
        return NextResponse.json({ error: `Order is already ${existing.status} — samples cannot be re-collected` }, { status: 400 });
      }
      const inputs: ItemSampleInput[] = Array.isArray(itemSamples) ? itemSamples : [];
      if (inputs.length === 0) {
        return NextResponse.json({ error: 'itemSamples[] with at least one {itemId, sampleType} is required' }, { status: 400 });
      }
      const byId = new Set(existing.items.map(i => i.id));
      let recorded = 0;
      for (const s of inputs) {
        if (!s.itemId || !byId.has(s.itemId)) continue;
        await db.labOrderItem.update({
          where: { id: s.itemId },
          data: {
            sampleType: s.sampleType || '',
            sampleRef: s.sampleRef || '',
          },
        }).then(() => { recorded++; }).catch(() => null);
      }
      if (recorded === 0) {
        return NextResponse.json({ error: 'No valid test items matched itemSamples[]' }, { status: 400 });
      }
      if (existing.status === 'PENDING') {
        await db.labOrder.update({ where: { id }, data: { status: 'SAMPLE_COLLECTED' } });
      }
      message = `Samples recorded for ${recorded} test(s) — order ${existing.orderNo} → SAMPLE_COLLECTED`;
    }

    // 1) Result entry — mark items COMPLETED; auto-COMPLETE the order when all done
    if (Array.isArray(itemResults) && itemResults.length > 0) {
      if (existing.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Cannot record results on a cancelled order' }, { status: 400 });
      }
      const inputs: ItemResultInput[] = itemResults;
      const byId = new Set(existing.items.map(i => i.id));
      for (const r of inputs) {
        if (!r.itemId || !byId.has(r.itemId)) continue;
        await db.labOrderItem.update({
          where: { id: r.itemId },
          data: {
            result: r.result || '',
            resultValue: r.resultValue || '',
            unit: r.unit || '',
            flag: r.flag || '',
            remarks: r.remarks || '',
            narrative: r.narrative || '',
            status: 'COMPLETED',
            completedAt: new Date(),
            performedById: auth.user.id,
          },
        }).catch(() => null);
      }
      // Order completes when every item is COMPLETED
      const remaining = await db.labOrderItem.count({
        where: { orderId: id, status: { not: 'COMPLETED' } },
      });
      if (remaining === 0) {
        await db.labOrder.update({ where: { id }, data: { status: 'COMPLETED' } }).catch(() => null);
        message = 'All results recorded — order COMPLETED';
      } else {
        message = `Results saved — ${remaining} item(s) still pending`;
      }
    }

    // 2) Workflow status move (forward-only; CANCELLED allowed from any live status)
    if (status) {
      if (existing.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Order is cancelled — status cannot change' }, { status: 400 });
      }
      if (status === 'CANCELLED') {
        await db.labOrder.update({ where: { id }, data: { status } });
        message = 'Lab order cancelled';
      } else {
        const currentIdx = STATUS_FLOW.indexOf(existing.status);
        const nextIdx = STATUS_FLOW.indexOf(status);
        if (nextIdx === -1) {
          return NextResponse.json({ error: `Invalid status. Use one of: ${[...STATUS_FLOW, 'CANCELLED'].join(', ')}` }, { status: 400 });
        }
        if (currentIdx !== -1 && nextIdx < currentIdx) {
          return NextResponse.json({ error: `Status cannot move backwards (${existing.status} → ${status})` }, { status: 400 });
        }
        await db.labOrder.update({ where: { id }, data: { status } });
        message = `Lab order ${existing.orderNo} → ${status}`;
      }
    }

    // 3) Notes
    if (notes !== undefined) {
      await db.labOrder.update({ where: { id }, data: { notes } }).catch(() => null);
    }

    const labOrder = await db.labOrder.findUnique({
      where: { id },
      include: {
        patient: { select: { patientNo: true, firstName: true, lastName: true } },
        items: { include: { labTest: { include: { service: true } } } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'LAB_ORDER_UPDATE', entityName: 'LabOrder', entityId: id,
        details: `Lab order ${existing.orderNo}${action === 'collect-samples' ? ' — samples collected' : ''}${status ? ` — status → ${status}` : ''}${Array.isArray(itemResults) && itemResults.length ? ` — ${itemResults.length} result(s) recorded` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ labOrder, message });
  } catch (error) {
    console.error('Lab orders PUT error:', error);
    return NextResponse.json({ error: 'Failed to update lab order' }, { status: 500 });
  }
}
