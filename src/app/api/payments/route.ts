import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getPagination, getDateFilter, money } from '@/lib/api';

/**
 * PAYMENTS API — money received against bills (or on-account patient payments).
 * POST creates the payment and updates the linked bill: paidAmount += amount,
 * status PAID when fully settled, else PARTIALLY_PAID.
 */

const PAYMENT_METHODS = ['CASH', 'MPESA', 'CARD', 'SHA'];

// GET /api/payments — payment journal; ?id= single with bill + patient
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'CASHIER']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const method = searchParams.get('method') || '';
    const billId = searchParams.get('billId') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const payment = await db.payment.findUnique({
        where: { id },
        include: {
          bill: { include: { patient: { select: { patientNo: true, firstName: true, lastName: true } } } },
          patient: { select: { patientNo: true, firstName: true, lastName: true } },
        },
      });
      if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      return NextResponse.json({ payment });
    }

    const where: Record<string, unknown> = {};
    if (search) where.paymentNo = { contains: search };
    if (method) where.method = method;
    if (billId) where.billId = billId;
    const dateFilter = getDateFilter(searchParams);
    if (dateFilter.gte || dateFilter.lte) where.createdAt = dateFilter;

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: perPage,
        include: {
          bill: { select: { billNo: true, totalAmount: true, paidAmount: true, status: true } },
          patient: { select: { patientNo: true, firstName: true, lastName: true } },
        },
      }),
      db.payment.count({ where }),
    ]);

    return NextResponse.json({
      payments, items: payments, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Payments GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST /api/payments — record money received; reconciles the bill
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'CASHIER']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { billId, patientId, amount, method, shaClaimRef, notes } = body;

    const parsedAmount = money(parseFloat(String(amount)) || 0);
    if (!billId && !patientId) {
      return NextResponse.json({ error: 'billId or patientId is required' }, { status: 400 });
    }
    if (parsedAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }
    if (method && !PAYMENT_METHODS.includes(method)) {
      return NextResponse.json({ error: `Invalid method. Use one of: ${PAYMENT_METHODS.join(', ')}` }, { status: 400 });
    }
    if (method === 'SHA' && !shaClaimRef) {
      return NextResponse.json({ error: 'shaClaimRef is required for SHA payments' }, { status: 400 });
    }

    // Resolve bill + patient
    let resolvedBillId: string | null = null;
    let resolvedPatientId: string | null = null;
    if (billId) {
      const bill = await db.bill.findUnique({ where: { id: billId } });
      if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
      if (bill.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Cannot pay a cancelled bill' }, { status: 400 });
      }
      resolvedBillId = bill.id;
      resolvedPatientId = patientId || bill.patientId;
    } else {
      const patient = await db.patient.findUnique({ where: { id: patientId } });
      if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      resolvedPatientId = patient.id;
    }

    const paymentNo = await generateCode('PAY');
    const payment = await db.payment.create({
      data: {
        paymentNo,
        billId: resolvedBillId,
        patientId: resolvedPatientId,
        amount: parsedAmount,
        method: method || 'CASH',
        shaClaimRef: shaClaimRef || '',
        receivedById: auth.user.id,
        status: 'COMPLETED',
        notes: notes || '',
      },
      include: {
        bill: { select: { billNo: true, totalAmount: true, paidAmount: true, status: true } },
        patient: { select: { patientNo: true, firstName: true, lastName: true } },
      },
    });

    // Reconcile the bill
    let message = `Payment ${paymentNo} recorded — KSh ${parsedAmount}`;
    if (resolvedBillId) {
      const bill = await db.bill.findUnique({ where: { id: resolvedBillId } });
      if (bill) {
        const newPaid = money(bill.paidAmount + parsedAmount);
        const newStatus = newPaid >= bill.totalAmount ? 'PAID' : 'PARTIALLY_PAID';
        await db.bill.update({
          where: { id: resolvedBillId },
          data: { paidAmount: newPaid, status: newStatus, cashierId: auth.user.id },
        });
        message = `${message} — bill ${bill.billNo} ${newStatus === 'PAID' ? 'fully paid' : `partially paid (KSh ${newPaid}/${bill.totalAmount})`}`;
      }
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'PAYMENT_CREATE', entityName: 'Payment', entityId: payment.id,
        details: `${paymentNo} — KSh ${parsedAmount} via ${payment.method}${resolvedBillId ? ` against bill` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ payment, message }, { status: 201 });
  } catch (error) {
    console.error('Payments POST error:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}

// PUT /api/payments — correct notes / reverse a payment (REVERSED) and roll back bill totals
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'CASHIER']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, notes, status } = body;
    if (!id) return NextResponse.json({ error: 'Payment ID required' }, { status: 400 });

    const existing = await db.payment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;
    if (status) {
      if (!['COMPLETED', 'PENDING', 'REVERSED'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status. Use COMPLETED, PENDING or REVERSED' }, { status: 400 });
      }
      if (status === 'REVERSED' && existing.status !== 'REVERSED') {
        // Reverse the effect on the bill
        if (existing.billId) {
          const bill = await db.bill.findUnique({ where: { id: existing.billId } });
          if (bill) {
            const newPaid = money(Math.max(0, bill.paidAmount - existing.amount));
            const newStatus = newPaid <= 0 ? 'UNPAID' : 'PARTIALLY_PAID';
            await db.bill.update({
              where: { id: bill.id },
              data: { paidAmount: newPaid, status: newStatus },
            });
          }
        }
      }
      updateData.status = status;
    }

    const payment = await db.payment.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'PAYMENT_UPDATE', entityName: 'Payment', entityId: id,
        details: `Payment ${existing.paymentNo} updated${status ? ` — status → ${status}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ payment, message: 'Payment updated' });
  } catch (error) {
    console.error('Payments PUT error:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}
