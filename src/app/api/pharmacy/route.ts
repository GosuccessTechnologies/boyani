import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination, money } from '@/lib/api';

/**
 * PHARMACY (Drug catalog) API — imported from clinic.zip src/app/api/pharmacy/route.ts
 * and enhanced:
 *  - auth added (writes ADMIN-only per instructions: pricing & catalog by admin)
 *  - KPIs retained (totalDrugs, lowStock, expiringSoon, totalValue)
 *  - batch/stock movements, CSV bulk import, richer filters
 */

// GET /api/pharmacy — list drugs with search, category filter, pagination + KPIs
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'PHARMACIST', 'CASHIER', 'DOCTOR', 'NURSE']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const stockFilter = searchParams.get('stockFilter') || ''; // LOW | EXPIRING | OUT

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { genericName: { contains: search } },
        { code: { contains: search } },
      ];
    }
    if (category) where.category = category;
    if (stockFilter === 'LOW') where.stock = { lte: 10 };
    if (stockFilter === 'OUT') where.stock = { lte: 0 };
    if (stockFilter === 'EXPIRING') {
      where.expiryDate = { lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), gte: new Date() };
    }

    const [drugs, total] = await Promise.all([
      db.drug.findMany({ where, skip, take: perPage, orderBy: { createdAt: 'desc' } }),
      db.drug.count({ where }),
    ]);

    // KPI calculations (pattern retained from clinic.zip)
    const [totalDrugs, lowStock, expiringSoon, stockValue] = await Promise.all([
      db.drug.count({ where: { isActive: true } }),
      db.drug.count({ where: { stock: { lte: 10 } } }),
      db.drug.count({
        where: {
          expiryDate: {
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
      }),
      db.drug.aggregate({ _sum: { stock: true } }),
    ]);
    const allDrugs = await db.drug.findMany({ where: { isActive: true }, select: { stock: true, unitCost: true, unitPrice: true } });
    const totalValue = allDrugs.reduce((s, d) => s + d.stock * d.unitPrice, 0);

    return NextResponse.json({
      items: drugs,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
      kpis: {
        totalDrugs,
        lowStock,
        expiringSoon,
        totalStockUnits: stockValue._sum.stock || 0,
        totalValue: money(totalValue),
      },
    });
  } catch (error) {
    console.error('Pharmacy GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch pharmacy data' }, { status: 500 });
  }
}

// POST /api/pharmacy — create or update drug (ADMIN only — pricing & catalog control)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, name, genericName, category, dosageForm, strength, stock, unitCost, unitPrice, expiryDate, supplier, reorderLevel, batchNumber, rackLocation, counterShelf, isControlled, notes, bulkItems } = body;

    // Bulk CSV import support
    if (bulkItems && Array.isArray(bulkItems) && bulkItems.length > 0) {
      let created = 0;
      for (const b of bulkItems) {
        if (!b.name) continue;
        const code = b.code || `DRG-${Date.now().toString(36).toUpperCase()}-${created}`;
        await db.drug.upsert({
          where: { code },
          create: {
            code,
            name: b.name,
            genericName: b.genericName || '',
            category: b.category || 'GENERAL',
            dosageForm: b.dosageForm || 'TABLET',
            strength: b.strength || '',
            stock: parseInt(b.stock) || 0,
            unitCost: parseFloat(b.unitCost) || 0,
            unitPrice: parseFloat(b.unitPrice) || 0,
            expiryDate: b.expiryDate ? new Date(b.expiryDate) : null,
            supplier: b.supplier || '',
          },
          update: {
            stock: parseInt(b.stock) || 0,
            unitCost: parseFloat(b.unitCost) || 0,
            unitPrice: parseFloat(b.unitPrice) || 0,
          },
        }).catch(() => null);
        created++;
      }
      return NextResponse.json({ success: true, imported: created });
    }

    if (id) {
      const before = await db.drug.findUnique({ where: { id } });
      const updated = await db.drug.update({
        where: { id },
        data: {
          name,
          genericName: genericName || '',
          category: category || 'GENERAL',
          dosageForm: dosageForm || 'TABLET',
          strength: strength || '',
          stock: stock ?? 0,
          unitCost: unitCost ?? 0,
          unitPrice: unitPrice ?? 0,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          supplier: supplier || '',
          reorderLevel: reorderLevel ?? 20,
          batchNumber: batchNumber || '',
          rackLocation: rackLocation || '',
          counterShelf: counterShelf || '', // counter shelf name/number for POS retrieval (Instruction 18c/11)
          isControlled: !!isControlled,
          notes: notes || '',
        },
      });
      // Stock adjustment movement
      if (before && (before.stock || 0) !== (stock ?? 0)) {
        await db.drugStockMovement.create({
          data: {
            drugId: id,
            movementType: 'ADJUSTMENT',
            quantity: (stock ?? 0) - (before.stock || 0),
            reference: 'manual-adjustment',
            notes: 'Stock adjusted via catalog edit',
            createdById: auth.user.id,
          },
        }).catch(() => {});
      }
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'DRUG_UPDATE', entityName: 'Drug', entityId: id,
          details: `Updated ${name}`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ success: true, data: updated });
    } else {
      if (!name) {
        return NextResponse.json({ error: 'Drug name is required' }, { status: 400 });
      }
      const code = `DRG-${Date.now().toString(36).toUpperCase()}`;
      const created = await db.drug.create({
        data: {
          code,
          name,
          genericName: genericName || '',
          category: category || 'GENERAL',
          dosageForm: dosageForm || 'TABLET',
          strength: strength || '',
          stock: stock ?? 0,
          unitCost: unitCost ?? 0,
          unitPrice: unitPrice ?? 0,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          supplier: supplier || '',
          reorderLevel: reorderLevel ?? 20,
          batchNumber: batchNumber || '',
          rackLocation: rackLocation || '',
          counterShelf: counterShelf || '',
          isControlled: !!isControlled,
          notes: notes || '',
        },
      });
      if ((stock ?? 0) > 0) {
        await db.drugStockMovement.create({
          data: {
            drugId: created.id, movementType: 'RESTOCK', quantity: stock ?? 0,
            reference: 'initial-stock', createdById: auth.user.id,
          },
        }).catch(() => {});
      }
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'DRUG_CREATE', entityName: 'Drug', entityId: created.id,
          details: `Created ${name}`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ success: true, data: created });
    }
  } catch (error) {
    console.error('Pharmacy POST error:', error);
    return NextResponse.json({ error: 'Failed to save drug' }, { status: 500 });
  }
}

// DELETE /api/pharmacy — delete drug (ADMIN only)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Drug ID is required' }, { status: 400 });
    }
    // Soft-delete: deactivate if referenced by sales
    const saleCount = await db.pharmacySaleItem.count({ where: { drugId: id } });
    if (saleCount > 0) {
      await db.drug.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ success: true, softDeleted: true });
    }
    await db.drug.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'DRUG_DELETE', entityName: 'Drug', entityId: id,
        details: `Deleted drug`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pharmacy DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete drug' }, { status: 500 });
  }
}
