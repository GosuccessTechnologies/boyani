import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getCompanyConfig, getTaxEnabled, getTaxRate, money, getPagination } from '@/lib/api';

/**
 * CASHIER POS API — adapted for Boyani Health Dispensary (hospital cashier):
 *
 * visit charges tab (services+drugs+beds from all departments)
 * CASH / PESAPAL_MPESA / CARD          → CASH / MPESA / CARD / SHA (Kenyan insurance)
 * product stock deduction              → drug stock decrement for billed pharmacy items
 * cashier-sales tab                    → cashier collections history (paginated + summary)
 * receipt tab                          → bill receipt (A4/A5 portrait per printer settings)
 */

// GET: cashier POS data — tabs: pending-bills | bill-items | cashier-sales | receipt
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'CASHIER']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'pending-bills';
    const search = searchParams.get('search') || '';
    const company = await getCompanyConfig();

    // ── Pending visit bills: all unpaid charges across departments ──
    if (tab === 'pending-bills') {
      const visitWhere: Record<string, unknown> = {
        status: { in: ['ACTIVE', 'WAITING_LAB', 'WAITING_DOCTOR', 'WAITING_PHARMACY', 'READY_FOR_PAYMENT'] },
      };
      const visits = await db.visit.findMany({
        where: visitWhere,
        include: {
          patient: {
            select: {
              id: true, patientNo: true, firstName: true, lastName: true, phone: true,
              paymentMode: true, shaNumber: true, nationalId: true,
            },
          },
          bills: { where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, include: { items: true } },
          labOrders: { include: { items: { include: { labTest: { include: { service: true } } } } } },
          prescriptions: { where: { status: { in: ['PRESCRIBED', 'PARTIALLY_DISPENSED'] } }, include: { items: true } },
          admissions: { where: { status: 'ACTIVE' }, include: { bed: { include: { ward: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      // BILLED pharmacy sales (Instruction 22) — dispensed at the pharmacy POS
      // with billToVisit; the cashier collects them here. Linked to a pending
      // visit by visitId, or by patientId within the visit date range (for
      // sales billed before the visit link was recorded).
      const visitIds = visits.map(v => v.id).filter(Boolean);
      const patientIds = [...new Set(visits.map(v => v.patient?.id).filter(Boolean))] as string[];
      const minVisitDate = visits.length
        ? visits.reduce((min, v) => Math.min(min, new Date(v.visitDate).getTime()), Infinity)
        : Infinity;
      const billedPharmacySales = (visitIds.length || patientIds.length)
        ? await db.pharmacySale.findMany({
            where: {
              paymentStatus: 'BILLED',
              OR: [
                ...(visitIds.length ? [{ visitId: { in: visitIds } }] : []),
                ...(patientIds.length && minVisitDate !== Infinity
                  ? [{ patientId: { in: patientIds }, createdAt: { gte: new Date(minVisitDate) } }]
                  : []),
              ],
            },
            include: { items: true },
            take: 300,
          })
        : [];

      // Build chargeable summary per visit
      const pending = visits.map(v => {
        const existingBill = v.bills[0];
        const labCharges = v.labOrders.flatMap(o =>
          o.items.map(i => ({
            name: i.testName || i.labTest?.name || 'Lab test',
            price: i.labTest?.service?.price || 0,
            department: 'Laboratory',
            shaCovered: i.labTest?.service?.shaCovered || false,
            itemType: 'LAB',
          }))
        );
        const drugCharges = v.prescriptions.flatMap(p =>
          p.items.map(i => ({
            name: `${i.drugName}${i.dosage ? ` (${i.dosage})` : ''}`,
            price: i.unitPrice * Math.max(0, i.quantity - i.dispensedQty),
            department: 'Pharmacy',
            shaCovered: false,
            itemType: 'DRUG',
            quantity: Math.max(0, i.quantity - i.dispensedQty),
          }))
        );
        // Already-dispensed pharmacy sales billed to this visit (DRUG charges;
        // sourceRef = PharmacySale id so checkout can flip them to COMPLETED)
        const billedSaleCharges = billedPharmacySales
          .filter(s => s.visitId === v.id
            || (!s.visitId && s.patientId === v.patient?.id
              && new Date(s.createdAt).getTime() >= new Date(v.visitDate).getTime()))
          .flatMap(s => s.items.map(i => ({
            name: i.drugName,
            price: i.totalPrice,
            department: 'Pharmacy',
            shaCovered: false,
            itemType: 'DRUG',
            quantity: i.quantity,
            sourceRef: s.id,
            saleNo: s.saleNo,
          })));
        const bedCharges = v.admissions.map(a => ({
          name: `Bed ${a.bed?.bedNumber || ''} — ${a.bed?.ward?.name || 'Ward'} (${a.bed?.ward?.wardType || ''})`,
          price: a.bed?.ward?.dailyRate || 0,
          department: 'Admission',
          shaCovered: true,
          itemType: 'ADMISSION_BED',
        }));
        const serviceCharges: Array<{ name: string; price: number; department: string; shaCovered: boolean; itemType: string }> = [];
        if (existingBill) {
          for (const item of existingBill.items) {
            if (item.itemType !== 'SERVICE' && item.itemType !== 'CONSULTATION') continue;
            serviceCharges.push({ name: item.itemName, price: item.unitPrice, department: item.department || 'Clinical', shaCovered: item.shaCovered, itemType: item.itemType });
          }
        }

        const allCharges = [...serviceCharges, ...labCharges, ...drugCharges, ...billedSaleCharges, ...bedCharges];
        const total = allCharges.reduce((s, c) => s + c.price, 0);
        return {
          visitId: v.id,
          visitNo: v.visitNo,
          visitStatus: v.status,
          visitDate: v.createdAt,
          patient: v.patient,
          billId: existingBill?.id || null,
          charges: allCharges,
          totalCharges: money(total),
          shaTotal: money(allCharges.filter(c => c.shaCovered).reduce((s, c) => s + c.price, 0)),
          cashTotal: money(allCharges.filter(c => !c.shaCovered).reduce((s, c) => s + c.price, 0)),
        };
      }).filter(p => (search ? (p.patient.firstName + p.patient.lastName + p.patient.patientNo + p.patient.phone + p.visitNo).toLowerCase().includes(search.toLowerCase()) : true) && (searchParams.get('onlyWithCharges') !== 'true' || p.charges.length > 0));

      return NextResponse.json({ pending, company });
    }

    // ── Cashier collections history ──
    if (tab === 'cashier-sales') {
      const { page, perPage, skip } = getPagination(searchParams, 20);
      const dateFrom = searchParams.get('dateFrom') || '';
      const dateTo = searchParams.get('dateTo') || '';
      const specificDate = searchParams.get('specificDate') || '';

      // Payment records carry receivedById (the cashier) — schema has no cashierId on Payment
      const where: Record<string, unknown> = { receivedById: auth.user.id };
      const dateFilter: Record<string, unknown> = {};
      if (specificDate) {
        dateFilter.gte = new Date(specificDate + 'T00:00:00');
        dateFilter.lte = new Date(specificDate + 'T23:59:59');
      } else {
        if (dateFrom) dateFilter.gte = new Date(dateFrom);
        if (dateTo) dateFilter.lte = new Date(dateTo + 'T23:59:59');
      }
      if (Object.keys(dateFilter).length) where.createdAt = dateFilter;
      if (search.trim()) {
        where.OR = [
          { billNo: { contains: search } },
          { receiptNo: { contains: search } },
          { patient: { firstName: { contains: search } } },
          { patient: { lastName: { contains: search } } },
          { patient: { patientNo: { contains: search } } },
        ];
      }

      const [payments, total] = await Promise.all([
        db.payment.findMany({
          where,
          include: { bill: { include: { patient: { select: { patientNo: true, firstName: true, lastName: true, paymentMode: true, shaNumber: true } }, items: true } } },
          orderBy: { createdAt: 'desc' },
          skip, take: perPage,
        }),
        db.payment.count({ where }),
      ]);

      const summary = {
        totalCollections: payments.length,
        totalCash: payments.filter(p => p.method === 'CASH').reduce((s, p) => s + p.amount, 0),
        totalMpesa: payments.filter(p => p.method === 'MPESA').reduce((s, p) => s + p.amount, 0),
        totalSha: payments.filter(p => p.method === 'SHA').reduce((s, p) => s + p.amount, 0),
      };

      return NextResponse.json({ payments, summary, company, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } });
    }

    // ── Receipt for a bill ──
    if (tab === 'receipt') {
      const billId = searchParams.get('billId') || '';
      const bill = await db.bill.findUnique({
        where: { id: billId },
        include: {
          items: true,
          patient: { select: { patientNo: true, firstName: true, lastName: true, phone: true, paymentMode: true, shaNumber: true } },
          payments: true,
        },
      });
      return NextResponse.json({ bill, company });
    }

    return NextResponse.json({ pending: [], company });
  } catch (error) {
    console.error('GET /api/pos error:', error);
    return NextResponse.json({ error: 'Failed to fetch cashier POS data' }, { status: 500 });
  }
}

// POST: checkout — consolidate visit charges into Bill + Payment (CASH/MPESA/CARD/SHA)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'CASHIER']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      visitId, patientId, paymentMode, cashAmount, shaAmount, shaClaimRef,
      discountAmount, notes,
      charges, // [{name, price, quantity, department, shaCovered, itemType, sourceRef, serviceId}]
    } = body;

    if (!patientId) return NextResponse.json({ error: 'Patient is required' }, { status: 400 });
    if (!charges || charges.length === 0) return NextResponse.json({ error: 'No charges selected' }, { status: 400 });

    const company = await getCompanyConfig();
    const taxEnabled = getTaxEnabled(company);
    const taxRate = getTaxRate(company);
    const receiptPrefix = company.pos_receipt_prefix || company.posReceiptPrefix || 'MCH';

    const validModes = ['CASH', 'MPESA', 'CARD', 'SHA', 'MIXED'];
    const pm = paymentMode || 'CASH';
    if (!validModes.includes(pm)) {
      return NextResponse.json({ error: `Invalid payment mode: ${pm}` }, { status: 400 });
    }

    let subtotal = 0;
    const billItems: Array<Record<string, unknown>> = [];
    for (const charge of charges) {
      const quantity = charge.quantity || 1;
      const totalPrice = money((charge.price || 0) * quantity);
      subtotal += totalPrice;
      billItems.push({
        itemType: charge.itemType || 'SERVICE',
        serviceId: charge.serviceId || null,
        itemName: charge.name,
        quantity,
        unitPrice: money(charge.price || 0),
        totalPrice,
        department: charge.department || '',
        shaCovered: !!charge.shaCovered,
        sourceRef: charge.sourceRef || '',
      });
    }

    const discount = parseFloat(discountAmount) || 0;
    const taxAmount = taxEnabled ? money(subtotal * (taxRate / 100)) : 0;
    const totalAmount = money(subtotal + taxAmount - discount);

    const billNo = await generateCode('BIL');
    const receiptNo = `${receiptPrefix}-R-${String(Date.now()).slice(-8)}`;

    const bill = await db.$transaction(async (tx) => {
      const newBill = await tx.bill.create({
        data: {
          billNo,
          receiptNo,
          patientId,
          visitId: visitId || null,
          cashierId: auth.user.id,
          subtotal: money(subtotal),
          discountAmount: discount,
          taxAmount,
          totalAmount,
          paidAmount: totalAmount,
          paymentMode: pm,
          status: 'PAID',
          notes: notes || '',
          items: { create: billItems },
        },
        include: { items: true },
      });

      // Payment record
      const paymentNo = await generateCode('PAY');
      await tx.payment.create({
        data: {
          paymentNo,
          billId: newBill.id,
          patientId,
          amount: totalAmount,
          method: pm === 'MIXED' ? 'CASH' : pm,
          shaClaimRef: shaClaimRef || '',
          receivedById: auth.user.id,
          status: 'COMPLETED',
          notes: pm === 'MIXED' ? `Mixed payment — cash ${money(cashAmount || 0)}, SHA ${money(shaAmount || 0)}` : (notes || ''),
        },
      });

      // Mark visit ready for completion
      if (visitId) {
        await tx.visit.update({ where: { id: visitId }, data: { status: 'COMPLETED' } }).catch(() => {});
        // Mark prescriptions on this visit as billed
        await tx.prescription.updateMany({ where: { visitId }, data: { status: 'DISPENSED' } }).catch(() => {});
      }

      // BILLED pharmacy sales collected here (Instruction 22) — DRUG charges
      // whose sourceRef is the PharmacySale id flip to COMPLETED (and record
      // the actual settlement method) inside the same transaction.
      const collectedSaleIds = [...new Set(
        (charges as Array<{ itemType?: string; sourceRef?: string }>)
          .filter(c => (c.itemType || '') === 'DRUG' && c.sourceRef)
          .map(c => c.sourceRef as string)
      )];
      if (collectedSaleIds.length) {
        await tx.pharmacySale.updateMany({
          where: { id: { in: collectedSaleIds }, paymentStatus: 'BILLED' },
          data: {
            paymentStatus: 'COMPLETED',
            paymentMethod: pm === 'MIXED' ? 'MIXED' : pm,
          },
        }).catch(() => {});
      }

      return newBill;
    });

    // Deduct pharmacy stock for DRUG bill items (hills stock-deduction rigour)
    for (const charge of charges) {
      if ((charge.itemType || '') === 'DRUG' && charge.drugId) {
        await db.drug.update({
          where: { id: charge.drugId },
          data: { stock: { decrement: charge.quantity || 1 } },
        }).catch(() => {});
        await db.drugStockMovement.create({
          data: {
            drugId: charge.drugId,
            movementType: 'SALE',
            quantity: -(charge.quantity || 1),
            reference: bill.billNo,
            notes: 'Billed to visit via cashier',
            createdById: auth.user.id,
          },
        }).catch(() => {});
      }
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'CASHIER_CHECKOUT',
        entityName: 'Bill',
        entityId: bill.id,
        details: `Bill ${bill.billNo} — KES ${bill.totalAmount.toFixed(2)} via ${pm}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({
      bill,
      receiptNo: bill.receiptNo,
      message: 'Payment processed successfully',
      taxConfig: { taxEnabled, taxRate, kraPin: company.kra_pin || company.kraPin || '' },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Cashier checkout error:', error);
    const msg = error instanceof Error ? error.message : 'Checkout failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
