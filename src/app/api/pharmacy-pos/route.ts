import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { money, getPagination } from '@/lib/api';

/**
 * PHARMACY POS API — imported from clinic.zip src/app/api/pharmacy-pos/route.ts
 * PHARMACY POS API — adapted and enhanced for Boyani Health Dispensary:
 *
 * proper PharmacySale + PharmacySaleItem tables
 * no auth                              → pharmacist/admin auth with role scoping
 * today-sales only                     → pharmacist sees own TODAY sales; ADMIN gets
 *                                        weekly/monthly/advanced filtered history
 * no prescription link                 → dispense from pending prescriptions
 * walk-in only                         → walk-in (pay at counter) OR bill-to-visit
 *                                        (registered patient pays at cashier)
 * no stock trail                       → DrugStockMovement ledger per sale
 */

// GET /api/pharmacy-pos ?section=drugs|sales|today-sales|prescriptions|patient-visit
//   drugs         → POS catalog (+ rackLocation/counterShelf/reorder/batch/supplier)
//   prescriptions → pending rx queue; optional &patientId= filters to one patient
//   patient-visit → patient's active visit (billToVisit linkage)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'PHARMACIST']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section') || 'drugs';
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const patientId = searchParams.get('patientId') || '';

    // ── Drug listing for POS (stock > 0 only — clinic.zip pattern) ──
    if (!section || section === 'drugs') {
      const where: Record<string, unknown> = { isActive: true, stock: { gt: 0 } };
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { genericName: { contains: search } },
          { code: { contains: search } },
        ];
      }
      if (category) where.category = category;

      const drugs = await db.drug.findMany({
        where,
        orderBy: { name: 'asc' },
        select: {
          id: true, code: true, name: true, genericName: true, category: true,
          dosageForm: true, strength: true, unit: true, stock: true, reorderLevel: true,
          unitPrice: true, unitCost: true, expiryDate: true, batchNumber: true,
          supplier: true, rackLocation: true, counterShelf: true,
          isControlled: true, notes: true,
        },
        take: 300,
      });

      const categories = await db.drug.findMany({
        where: { stock: { gt: 0 }, isActive: true },
        distinct: ['category'],
        select: { category: true },
      });

      return NextResponse.json({
        drugs,
        categories: categories.map(c => c.category).filter(Boolean),
      });
    }

    // ── Sales history ──
    // PHARMACIST: own sales, TODAY only (advanced filters reserved for ADMIN)
    // ADMIN: all sales, full filters (weekly/monthly/date range)
    if (section === 'sales') {
      const { page, perPage, skip } = getPagination(searchParams, 20);
      const isAdmin = auth.user.role === 'ADMIN';

      const where: Record<string, unknown> = {};
      if (!isAdmin) {
        where.pharmacistId = auth.user.id;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        where.createdAt = { gte: today, lt: tomorrow };
      } else {
        const dateFrom = searchParams.get('dateFrom') || '';
        const dateTo = searchParams.get('dateTo') || '';
        const specificDate = searchParams.get('specificDate') || '';
        if (specificDate) {
          where.createdAt = { gte: new Date(specificDate + 'T00:00:00'), lte: new Date(specificDate + 'T23:59:59') };
        } else if (dateFrom || dateTo) {
          const df: Record<string, unknown> = {};
          if (dateFrom) df.gte = new Date(dateFrom);
          if (dateTo) df.lte = new Date(dateTo + 'T23:59:59');
          where.createdAt = df;
        }
        if (search.trim()) {
          where.OR = [
            { saleNo: { contains: search } },
            { receiptNo: { contains: search } },
            { patientName: { contains: search } },
          ];
        }
      }

      const [sales, total] = await Promise.all([
        db.pharmacySale.findMany({
          where,
          include: { items: true },
          orderBy: { createdAt: 'desc' },
          skip, take: perPage,
        }),
        db.pharmacySale.count({ where }),
      ]);

      return NextResponse.json({
        sales,
        total, page, perPage,
        totalPages: Math.ceil(total / perPage),
        scope: isAdmin ? 'ALL_HISTORY' : 'OWN_TODAY',
      });
    }

    // ── Today's sales summary (clinic.zip pattern) ──
    if (section === 'today-sales') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

      const where: Record<string, unknown> = {
        createdAt: { gte: today, lt: tomorrow },
      };
      // Pharmacist sees only own day; admin sees facility-wide day
      if (auth.user.role !== 'ADMIN') where.pharmacistId = auth.user.id;

      const todaySales = await db.pharmacySale.findMany({
        where,
        include: { items: true },
      });

      const totalRevenue = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
      const totalItems = todaySales.reduce((sum, s) =>
        sum + s.items.reduce((is, item) => is + item.quantity, 0), 0);

      return NextResponse.json({
        totalRevenue: money(totalRevenue),
        totalSales: todaySales.length,
        totalItems,
        scope: auth.user.role === 'ADMIN' ? 'FACILITY' : 'PERSONAL',
      });
    }

    // ── Pending prescriptions to dispense ──
    // Optional ?patientId=<id> → only that patient's prescriptions (POS
    // "Load Prescriptions" panel for a selected registered patient).
    if (section === 'prescriptions') {
      const rxWhere: Record<string, unknown> = { status: { in: ['PRESCRIBED', 'PARTIALLY_DISPENSED'] } };
      if (patientId) rxWhere.patientId = patientId;
      const prescriptions = await db.prescription.findMany({
        where: rxWhere,
        include: {
          items: { include: { drug: { select: { id: true, name: true, stock: true, unitPrice: true, code: true } } } },
          patient: { select: { patientNo: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      return NextResponse.json({ prescriptions });
    }

    // ── Patient's ACTIVE visit (for billToVisit linkage — Instruction 17) ──
    if (section === 'patient-visit') {
      if (!patientId) {
        return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
      }
      const visit = await db.visit.findFirst({
        where: {
          patientId,
          status: { in: ['ACTIVE', 'WAITING_LAB', 'WAITING_DOCTOR', 'WAITING_PHARMACY', 'READY_FOR_PAYMENT'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, visitNo: true, status: true, visitDate: true, visitType: true },
      });
      return NextResponse.json({ visit });
    }

    return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
  } catch (error) {
    console.error('Pharmacy POS GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch pharmacy POS data' }, { status: 500 });
  }
}

// POST /api/pharmacy-pos — create a sale & update drug stock
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'PHARMACIST']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      items, patientId, patientName, patientPhone, paymentMethod, discount,
      prescriptionId, billToVisit, visitId, notes,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Sale must have at least one item' }, { status: 400 });
    }

    // Validate stock BEFORE any write (clinic.zip pattern, hardened)
    for (const item of items) {
      if (!item.drugId || !item.quantity) continue;
      const drug = await db.drug.findUnique({ where: { id: item.drugId } });
      if (!drug) {
        return NextResponse.json({ error: `Drug not found: ${item.drugName}` }, { status: 400 });
      }
      if (drug.stock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${item.drugName}. Available: ${drug.stock}` }, { status: 400 });
      }
    }

    const isBilled = !!billToVisit; // registered patient → pays at cashier
    const saleNo = await generateCode('SAL');
    const receiptNo = isBilled ? '' : `RXN-${String(Date.now()).slice(-8)}`;

    // compute totals from server-side drug data (never trust client prices)
    let subtotal = 0, totalCost = 0;
    const saleItems: Array<Record<string, unknown>> = [];
    for (const item of items) {
      const drug = await db.drug.findUnique({ where: { id: item.drugId } });
      if (!drug) continue;
      const quantity = item.quantity || 1;
      const unitPrice = drug.unitPrice;
      const unitCost = drug.unitCost;
      const totalPrice = money(unitPrice * quantity);
      subtotal += totalPrice;
      totalCost += unitCost * quantity;
      saleItems.push({
        drugId: drug.id,
        drugName: `${drug.name}${drug.strength ? ` ${drug.strength}` : ''}`,
        quantity,
        unitPrice,
        unitCost,
        dosageInstruction: item.dosageInstruction || '',
        totalPrice,
      });
    }

    const totalAmount = money(subtotal - (parseFloat(discount) || 0));

    if (totalAmount <= 0) {
      return NextResponse.json({ error: 'Total amount must be greater than 0' }, { status: 400 });
    }

    const sale = await db.$transaction(async (tx) => {
      // Deduct stock (clinic.zip pattern, inside transaction now)
      for (const item of saleItems) {
        await tx.drug.update({
          where: { id: item.drugId as string },
          data: { stock: { decrement: item.quantity as number } },
        });
        await tx.drugStockMovement.create({
          data: {
            drugId: item.drugId as string,
            movementType: 'SALE',
            quantity: -(item.quantity as number),
            reference: saleNo,
            notes: isBilled ? 'Billed to patient visit' : 'Counter sale',
            createdById: auth.user.id,
          },
        });
      }

      const newSale = await tx.pharmacySale.create({
        data: {
          saleNo,
          receiptNo,
          pharmacistId: auth.user.id,
          patientId: patientId || null,
          patientName: patientName || 'Walk-in Customer',
          patientPhone: patientPhone || '',
          prescriptionId: prescriptionId || '',
          subtotal: money(subtotal),
          discountAmount: parseFloat(discount) || 0,
          totalAmount,
          totalCost: money(totalCost),
          paymentMethod: isBilled ? 'BILLED_TO_VISIT' : (paymentMethod || 'CASH'),
          paymentStatus: isBilled ? 'BILLED' : 'COMPLETED',
          billToVisit: isBilled,
          visitId: visitId || '',
          notes: notes || '',
          items: { create: saleItems },
        },
        include: { items: true },
      });

      // ── Prescription dispense bookkeeping (Instruction 17 fix) ──
      // Increment dispensedQty per dispensed line (matched by drugId), then
      // recompute the prescription status from the ACTUAL persisted quantities.
      if (prescriptionId) {
        const pres = await tx.prescription.findUnique({ where: { id: prescriptionId }, include: { items: true } });
        if (pres) {
          for (const si of saleItems) {
            const pi = pres.items.find(x => x.drugId && x.drugId === (si.drugId as string));
            if (!pi) continue;
            // never credit more than the prescribed remaining quantity
            const remaining = Math.max(0, pi.quantity - pi.dispensedQty);
            const inc = Math.min(si.quantity as number, remaining);
            if (inc > 0) {
              await tx.prescriptionItem.update({
                where: { id: pi.id },
                data: { dispensedQty: { increment: inc } },
              });
            }
          }
          const refreshed = await tx.prescription.findUnique({
            where: { id: prescriptionId },
            include: { items: true },
          });
          const allDispensed = refreshed
            ? refreshed.items.every(pi => pi.dispensedQty >= pi.quantity)
            : false;
          await tx.prescription.update({
            where: { id: prescriptionId },
            data: {
              status: allDispensed ? 'DISPENSED' : 'PARTIALLY_DISPENSED',
              dispensedById: auth.user.id,
              dispensedAt: new Date(),
            },
          });
        }
      }

      return newSale;
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'PHARMACY_SALE',
        entityName: 'PharmacySale',
        entityId: sale.id,
        details: `Pharmacy sale ${sale.saleNo} — KES ${sale.totalAmount.toFixed(2)}${isBilled ? ' (billed to visit)' : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, sale });
  } catch (error) {
    console.error('Pharmacy POS POST error:', error);
    return NextResponse.json({ error: 'Failed to process sale' }, { status: 500 });
  }
}
