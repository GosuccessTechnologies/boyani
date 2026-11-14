import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination, getDateFilter } from '@/lib/api';

/**
 * INVENTORY-MOVEMENTS API — movement journal for InventoryItem
 * (IN, OUT, ASSIGN, RETURN, ADJUSTMENT, DISPOSE). ADMIN/INVENTORY only.
 *
 * Instruction 25 — POST records a MANUAL movement and adjusts the item
 * quantity atomically in one transaction:
 *   IN        → adds stock
 *   RETURN    → adds stock back (and clears the assignment)
 *   OUT       → subtracts stock
 *   ASSIGN    → subtracts stock & sets assignedTo (+optional location)
 *   DISPOSE   → subtracts stock (written off)
 *   ADJUSTMENT→ signed delta (new qty = old qty + delta)
 * Quantity can never drop below 0 — insufficient stock returns a 400 error.
 * The journal shows the operator name (createdById resolved to the user).
 */

const INVENTORY_ROLES = ['ADMIN', 'INVENTORY'];
const MOVEMENT_TYPES = ['IN', 'OUT', 'ASSIGN', 'RETURN', 'ADJUSTMENT', 'DISPOSE'];
const STOCK_IN_TYPES = ['IN', 'RETURN'];
const STOCK_OUT_TYPES = ['OUT', 'ASSIGN', 'DISPOSE'];

/** Map of userId → display name for operator resolution. */
async function resolveUserNames(ids: Array<string>): Promise<Record<string, string>> {
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (clean.length === 0) return {};
  const users = await db.user.findMany({
    where: { id: { in: clean } },
    select: { id: true, firstName: true, lastName: true, username: true },
  }).catch(() => []);
  const map: Record<string, string> = {};
  for (const u of users) {
    const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    map[u.id] = full || u.username;
  }
  return map;
}

// GET /api/inventory-movements — journal with filters + pagination (+ operator names)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, INVENTORY_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const itemId = searchParams.get('itemId') || '';
    const movementType = searchParams.get('movementType') || '';

    const where: Record<string, unknown> = {};
    if (itemId) where.itemId = itemId;
    if (movementType) where.movementType = movementType;

    // Date range on movement date: specificDate / dateFrom / dateTo
    const dateFilter = getDateFilter(searchParams);
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;

    const [movements, total] = await Promise.all([
      db.inventoryMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: perPage,
        include: { item: { select: { id: true, code: true, name: true, unit: true } } },
      }),
      db.inventoryMovement.count({ where }),
    ]);

    // Operator names (who recorded each movement)
    const names = await resolveUserNames(movements.map(m => m.createdById));
    const withOperator = movements.map(m => ({ ...m, recordedByName: names[m.createdById] || '' }));

    return NextResponse.json({
      movements: withOperator, items: withOperator, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Inventory-movements GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory movements' }, { status: 500 });
  }
}

// POST /api/inventory-movements — record a manual movement & adjust stock atomically
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, INVENTORY_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { itemId, movementType, quantity, notes, assignedTo, location, reference } = body;

    if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    if (!movementType || !MOVEMENT_TYPES.includes(movementType)) {
      return NextResponse.json({ error: `movementType must be one of: ${MOVEMENT_TYPES.join(', ')}` }, { status: 400 });
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty === 0) {
      return NextResponse.json({ error: 'quantity must be a non-zero number' }, { status: 400 });
    }
    // Only ADJUSTMENT accepts a negative (signed delta); all other types are positive
    if (movementType !== 'ADJUSTMENT' && qty < 0) {
      return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 });
    }

    const item = await db.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    if (!item.isActive) return NextResponse.json({ error: `Item ${item.code} is deactivated` }, { status: 400 });

    // Compute the new quantity
    let newQty = item.quantity;
    if (STOCK_IN_TYPES.includes(movementType)) newQty = item.quantity + Math.abs(qty);
    else if (STOCK_OUT_TYPES.includes(movementType)) newQty = item.quantity - Math.abs(qty);
    else if (movementType === 'ADJUSTMENT') newQty = item.quantity + qty; // signed delta

    if (newQty < 0) {
      return NextResponse.json(
        { error: `Insufficient stock — ${item.name} has ${item.quantity} ${item.unit}, cannot ${movementType.toLowerCase()} ${Math.abs(qty)}` },
        { status: 400 },
      );
    }

    const { movement, updatedItem } = await db.$transaction(async tx => {
      const itemUpdate: Record<string, unknown> = { quantity: newQty };
      if (movementType === 'ASSIGN') {
        if (assignedTo) itemUpdate.assignedTo = String(assignedTo);
        if (location) itemUpdate.location = String(location);
      }
      if (movementType === 'RETURN') {
        itemUpdate.assignedTo = ''; // back to the store
        if (location) itemUpdate.location = String(location);
      }
      const updatedItem = await tx.inventoryItem.update({ where: { id: itemId }, data: itemUpdate });

      const movement = await tx.inventoryMovement.create({
        data: {
          itemId,
          movementType,
          quantity: STOCK_OUT_TYPES.includes(movementType) ? -Math.abs(qty) : (movementType === 'ADJUSTMENT' ? qty : Math.abs(qty)),
          reference: reference || item.code,
          notes: notes
            ? String(notes)
            : `Manual ${movementType.toLowerCase()}${movementType === 'ASSIGN' && assignedTo ? ` to ${assignedTo}` : ''} — stock ${item.quantity} → ${newQty}`,
          createdById: auth.user.id,
        },
        include: { item: { select: { id: true, code: true, name: true, unit: true, quantity: true } } },
      });
      return { movement, updatedItem };
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'INVENTORY_MOVEMENT_CREATE', entityName: 'InventoryMovement', entityId: movement.id,
        details: `${movementType} ${movement.quantity} ${item.unit} — ${item.name} (${item.code}) · qty ${item.quantity} → ${newQty}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({
      movement,
      item: updatedItem,
      message: `${movementType} recorded — ${item.name} now ${newQty} ${item.unit}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Inventory-movements POST error:', error);
    return NextResponse.json({ error: 'Failed to record movement' }, { status: 500 });
  }
}
