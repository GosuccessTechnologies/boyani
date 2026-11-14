import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination, getDateFilter, money } from '@/lib/api';

/**
 * BILLS API — patient billing.
 * Bills are auto-created by lab orders / consultations / admissions and consolidated
 * at the POS; this route covers manual charge capture (POST) and cashier settlement
 * adjustments (PUT: status, discount, notes → totalAmount recomputed).
 */

const BILL_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];

interface ManualItemInput {
  itemType?: string;
  serviceId?: string;
  itemName?: string;
  quantity?: number | string;
  unitPrice?: number | string;
  department?: string;
  shaCovered?: boolean;
}

// GET /api/bills — bill list; ?id= single bill with items + payments + patient
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'CASHIER', 'RECEPTIONIST', 'DOCTOR']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const patientId = searchParams.get('patientId') || '';
    const id = searchParams.get('id') || '';

    // Single bill — full statement
    if (id) {
      const bill = await db.bill.findUnique({
        where: { id },
        include: {
          items: true,
          payments: { orderBy: { createdAt: 'desc' } },
          patient: {
            select: { id: true, patientNo: true, firstName: true, lastName: true, phone: true, paymentMode: true, shaNumber: true },
          },
        },
      });
      if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
      return NextResponse.json({ bill });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { billNo: { contains: search } },
        { receiptNo: { contains: search } },
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
    const dateFilter = getDateFilter(searchParams);
    if (dateFilter.gte || dateFilter.lte) where.createdAt = dateFilter;

    const [bills, total] = await Promise.all([
      db.bill.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: perPage,
        include: {
          patient: { select: { patientNo: true, firstName: true, lastName: true, phone: true } },
          _count: { select: { items: true, payments: true } },
        },
      }),
      db.bill.count({ where }),
    ]);

    return NextResponse.json({
      bills, items: bills, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Bills GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}

// POST /api/bills — manually add charges (e.g. nursing procedures, supplies)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { patientId, visitId, items, notes } = body;

    if (!patientId) return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one charge item is required' }, { status: 400 });
    }

    const patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    if (visitId) {
      const visit = await db.visit.findUnique({ where: { id: visitId } }).catch(() => null);
      if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    const inputs: ManualItemInput[] = items;
    const billItems = inputs.map(i => {
      const quantity = Math.max(1, parseInt(String(i.quantity)) || 1);
      const unitPrice = money(parseFloat(String(i.unitPrice)) || 0);
      return {
        itemType: i.itemType || 'SERVICE',
        serviceId: i.serviceId || null,
        itemName: i.itemName || 'Charge',
        quantity,
        unitPrice,
        totalPrice: money(quantity * unitPrice),
        department: i.department || '',
        shaCovered: !!i.shaCovered,
      };
    });

    const subtotal = money(billItems.reduce((s, i) => s + i.totalPrice, 0));
    const bill = await db.bill.create({
      data: {
        billNo: `BIL-${Date.now().toString(36).toUpperCase()}`,
        patientId,
        visitId: visitId || null,
        subtotal,
        totalAmount: subtotal,
        status: 'UNPAID',
        notes: notes || '',
        items: { create: billItems },
      },
      include: {
        items: true,
        patient: { select: { patientNo: true, firstName: true, lastName: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'BILL_CREATE', entityName: 'Bill', entityId: bill.id,
        details: `Manual bill ${bill.billNo} for ${patient.patientNo} — ${billItems.length} item(s), KSh ${subtotal}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ bill, message: `Bill ${bill.billNo} created — KSh ${subtotal}` }, { status: 201 });
  } catch (error) {
    console.error('Bills POST error:', error);
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
  }
}

// PUT /api/bills — cashier adjusts status / discount / notes; totalAmount recomputed
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'CASHIER']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, status, notes, discountAmount, receiptNo, cashierId } = body;
    if (!id) return NextResponse.json({ error: 'Bill ID required' }, { status: 400 });

    const existing = await db.bill.findUnique({ where: { id }, include: { items: true } });
    if (!existing) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    if (existing.status === 'CANCELLED' && status && status !== 'CANCELLED') {
      return NextResponse.json({ error: 'Bill is cancelled — status cannot change' }, { status: 400 });
    }
    if (status && !BILL_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Use one of: ${BILL_STATUSES.join(', ')}` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (receiptNo !== undefined && receiptNo !== '') updateData.receiptNo = receiptNo;
    if (cashierId !== undefined) updateData.cashierId = cashierId || '';
    if (discountAmount !== undefined) {
      const discount = Math.max(0, money(parseFloat(String(discountAmount)) || 0));
      updateData.discountAmount = discount;
      updateData.totalAmount = money(existing.subtotal + existing.taxAmount - discount);
    }

    const bill = await db.bill.update({
      where: { id }, data: updateData,
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
        patient: { select: { patientNo: true, firstName: true, lastName: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'BILL_UPDATE', entityName: 'Bill', entityId: id,
        details: `Bill ${existing.billNo} updated${status ? ` — status → ${status}` : ''}${discountAmount !== undefined ? ` — discount KSh ${money(parseFloat(String(discountAmount)) || 0)}, total KSh ${bill.totalAmount}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ bill, message: 'Bill updated' });
  } catch (error) {
    console.error('Bills PUT error:', error);
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 });
  }
}

// DELETE /api/bills?id= — cancelled-bill cleanup only (audit-logged)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'CASHIER']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Bill ID required' }, { status: 400 });

    const existing = await db.bill.findUnique({
      where: { id },
      include: { _count: { select: { payments: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });

    if (existing._count.payments > 0 || existing.paidAmount > 0) {
      return NextResponse.json({ error: 'Bill has payments recorded — cancel it instead of deleting' }, { status: 400 });
    }
    if (existing.status !== 'CANCELLED') {
      return NextResponse.json({ error: 'Only CANCELLED bills can be deleted — set status CANCELLED first' }, { status: 400 });
    }

    await db.bill.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'BILL_DELETE', entityName: 'Bill', entityId: id,
        details: `Cancelled bill ${existing.billNo} purged`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Bill deleted' });
  } catch (error) {
    console.error('Bills DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 });
  }
}
