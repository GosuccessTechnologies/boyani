import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * INVENTORY API — non-pharmacy assets & consumables (InventoryItem + movements).
 * ADMIN/INVENTORY manage everything; other staff see only items assigned to
 * them (assignedTo contains their user id). Quantity changes are journaled as
 * InventoryMovement rows (IN on create, ADJUSTMENT on edit).
 */

const INVENTORY_ROLES = ['ADMIN', 'INVENTORY'];

// GET /api/inventory — all staff (non-managers see only their assigned items)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request); // any authenticated staff
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const condition = searchParams.get('condition') || '';
    const lowStock = searchParams.get('lowStock') || '';
    const id = searchParams.get('id') || '';
    const isInventoryView = INVENTORY_ROLES.includes(auth.user.role);

    // Single item with movement history
    if (id) {
      const item = await db.inventoryItem.findUnique({
        where: { id },
        include: { movements: { orderBy: { createdAt: 'desc' }, take: 50 } },
      });
      if (!item) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
      return NextResponse.json({ item });
    }

    const where: Record<string, unknown> = {};
    if (!isInventoryView) where.assignedTo = { contains: auth.user.id };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { sku: { contains: search } },
      ];
    }
    if (category) where.category = category;
    if (condition) where.condition = condition;

    // Low stock: quantity <= reorderLevel (SQLite can't compare two columns in
    // a where filter, so resolve candidate ids first)
    if (lowStock === '1' || lowStock === 'true') {
      const candidates = await db.inventoryItem.findMany({
        select: { id: true, quantity: true, reorderLevel: true },
      });
      const lowIds = candidates.filter(i => i.quantity <= i.reorderLevel).map(i => i.id);
      where.id = { in: lowIds };
    }

    const [items, total] = await Promise.all([
      db.inventoryItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: perPage,
      }),
      db.inventoryItem.count({ where }),
    ]);

    return NextResponse.json({
      items: items, inventory: items, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Inventory GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory items' }, { status: 500 });
  }
}

// POST /api/inventory — register item (+ initial IN movement, bulk CSV import support)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, INVENTORY_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { bulkItems, ...data } = body;

    // Bulk CSV import
    if (bulkItems && Array.isArray(bulkItems) && bulkItems.length > 0) {
      let created = 0;
      for (const b of bulkItems) {
        if (!b.name) continue;
        const code = await generateCode('INV');
        const quantity = parseInt(b.quantity) || 0;
        const item = await db.inventoryItem.create({
          data: {
            code,
            name: b.name,
            category: b.category || 'GENERAL',
            sku: b.sku || '',
            quantity,
            unit: b.unit || 'pcs',
            unitCost: parseFloat(b.unitCost) || 0,
            unitPrice: parseFloat(b.unitPrice) || 0,
            reorderLevel: parseInt(b.reorderLevel) || 10,
            assignedTo: b.assignedTo || '',
            location: b.location || '',
            supplier: b.supplier || '',
            condition: b.condition || 'GOOD',
            notes: b.notes || '',
          },
        }).catch(() => null);
        if (item && quantity > 0) {
          await db.inventoryMovement.create({
            data: {
              itemId: item.id, movementType: 'IN', quantity,
              reference: code, notes: 'Bulk import — initial stock',
              createdById: auth.user.id,
            },
          }).catch(() => {});
        }
        created++;
      }
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'INVENTORY_BULK_IMPORT', entityName: 'InventoryItem',
          details: `Bulk imported ${created} inventory items`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ imported: created });
    }

    if (!data.name) return NextResponse.json({ error: 'Item name is required' }, { status: 400 });

    const code = typeof data.code === 'string' && data.code.trim() ? data.code.trim() : await generateCode('INV');
    const quantity = parseInt(data.quantity) || 0;
    // Instruction 25 loophole fix — stock can never start below zero
    if (quantity < 0) {
      return NextResponse.json({ error: 'Quantity cannot be negative' }, { status: 400 });
    }

    const item = await db.inventoryItem.create({
      data: {
        code,
        name: data.name,
        category: data.category || 'GENERAL',
        sku: data.sku || '',
        quantity,
        unit: data.unit || 'pcs',
        unitCost: parseFloat(data.unitCost) || 0,
        unitPrice: parseFloat(data.unitPrice) || 0,
        reorderLevel: parseInt(data.reorderLevel) || 10,
        assignedTo: data.assignedTo || '',
        location: data.location || '',
        supplier: data.supplier || '',
        condition: data.condition || 'GOOD',
        notes: data.notes || '',
      },
    });

    // Journal the initial stock
    if (quantity > 0) {
      await db.inventoryMovement.create({
        data: {
          itemId: item.id, movementType: 'IN', quantity,
          reference: code, notes: 'Initial stock on item registration',
          createdById: auth.user.id,
        },
      }).catch(() => {});
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'INVENTORY_ITEM_CREATE', entityName: 'InventoryItem', entityId: item.id,
        details: `Item "${item.name}" (${item.code}) registered — qty ${item.quantity} ${item.unit}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ item, message: `Item ${item.code} registered` }, { status: 201 });
  } catch (error) {
    console.error('Inventory POST error:', error);
    return NextResponse.json({ error: 'Failed to register inventory item' }, { status: 500 });
  }
}

// PUT /api/inventory — update item; quantity change journals an ADJUSTMENT movement
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, INVENTORY_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Item ID required' }, { status: 400 });

    const existing = await db.inventoryItem.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.code && data.code !== existing.code) {
      const codeTaken = await db.inventoryItem.findUnique({ where: { code: data.code } });
      if (codeTaken) return NextResponse.json({ error: 'Code already in use' }, { status: 409 });
      updateData.code = data.code;
    }
    for (const key of ['category', 'sku', 'unit', 'assignedTo', 'location', 'supplier', 'condition', 'notes']) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (data.quantity !== undefined) {
      const newQty = parseInt(data.quantity);
      // Instruction 25 loophole fix — quantity can never go below zero
      if (!isNaN(newQty) && newQty < 0) {
        return NextResponse.json({ error: `Quantity cannot go below 0 (currently ${existing.quantity}) — use the Movements journal to record stock out/disposal` }, { status: 400 });
      }
      if (!isNaN(newQty)) updateData.quantity = newQty;
    }
    if (data.unitCost !== undefined) updateData.unitCost = parseFloat(data.unitCost) || 0;
    if (data.unitPrice !== undefined) updateData.unitPrice = parseFloat(data.unitPrice) || 0;
    if (data.reorderLevel !== undefined) updateData.reorderLevel = parseInt(data.reorderLevel) || 0;
    if (data.isActive !== undefined) updateData.isActive = !!data.isActive;

    const item = await db.inventoryItem.update({ where: { id }, data: updateData });

    // Journal quantity adjustments
    const newQty = (updateData.quantity as number | undefined) ?? existing.quantity;
    if (newQty !== existing.quantity) {
      await db.inventoryMovement.create({
        data: {
          itemId: id,
          movementType: 'ADJUSTMENT',
          quantity: newQty - existing.quantity,
          reference: existing.code,
          notes: `Stock adjusted from ${existing.quantity} to ${newQty}`,
          createdById: auth.user.id,
        },
      }).catch(() => {});
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'INVENTORY_ITEM_UPDATE', entityName: 'InventoryItem', entityId: id,
        details: `Item "${existing.name}" (${existing.code}) updated${newQty !== existing.quantity ? ` — qty ${existing.quantity} → ${newQty}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ item, message: 'Inventory item updated' });
  } catch (error) {
    console.error('Inventory PUT error:', error);
    return NextResponse.json({ error: 'Failed to update inventory item' }, { status: 500 });
  }
}

// DELETE /api/inventory — ?id= (soft-deactivate when movements exist, else delete)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, INVENTORY_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Item ID required' }, { status: 400 });

    const existing = await db.inventoryItem.findUnique({
      where: { id },
      include: { _count: { select: { movements: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });

    // Movement history must be preserved → soft delete
    if (existing._count.movements > 0) {
      await db.inventoryItem.update({ where: { id }, data: { isActive: false, notes: `${existing.notes}${existing.notes ? ' · ' : ''}Deactivated` } });
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'INVENTORY_ITEM_DEACTIVATE', entityName: 'InventoryItem', entityId: id,
          details: `Item "${existing.name}" (${existing.code}) deactivated — ${existing._count.movements} movement records preserved`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ message: `Item ${existing.code} deactivated — movement history preserved`, softDeleted: true });
    }

    await db.inventoryItem.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'INVENTORY_ITEM_DELETE', entityName: 'InventoryItem', entityId: id,
        details: `Item "${existing.name}" (${existing.code}) deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Inventory item deleted', deleted: true });
  } catch (error) {
    console.error('Inventory DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete inventory item' }, { status: 500 });
  }
}
