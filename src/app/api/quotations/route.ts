import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { money, getPagination } from '@/lib/api';

/**
 * QUOTATIONS API — imported from hills.zip src/app/api/quotations/route.ts and adapted:
 * items are now medical SERVICE / DRUG / PACKAGE lines instead of perfume products.
 * Cashier/Admin roles retained; CONVERTED_TO_BILL guard instead of CONVERTED_TO_SALE.
 */

async function getAuthUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || new URL(request.url).searchParams.get('token') || '';
  if (!token) return null;
  const session = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;
  return session.user;
}

// ─── GET: List quotations (paginated, filtered) ───
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || (user.role !== 'ADMIN' && user.role !== 'CASHIER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (user.role === 'CASHIER') where.createdById = user.id;
    if (search) {
      where.OR = [
        { quotationNo: { contains: search } },
        { customerName: { contains: search } },
        { customerEmail: { contains: search } },
        { customerPhone: { contains: search } },
      ];
    }

    const [quotations, total] = await Promise.all([
      db.quotation.findMany({
        where,
        include: {
          items: true,
          createdBy: { select: { id: true, username: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip, take: perPage,
      }),
      db.quotation.count({ where }),
    ]);

    return NextResponse.json({
      quotations,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    });
  } catch (error) {
    console.error('Quotation GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 });
  }
}

// ─── POST: Create quotation ───
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || (user.role !== 'ADMIN' && user.role !== 'CASHIER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { customerName, customerPhone, customerEmail, items, discountAmount, notes, validUntil, taxEnabled, taxRate } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    const quotationNo = await generateCode('QTN');
    const applyTax = taxEnabled !== undefined ? taxEnabled : false;
    const rate = taxRate || 16;

    let subtotal = 0;
    const quotationItems: Array<Record<string, unknown>> = [];

    for (const item of items) {
      const itemType = item.itemType || 'SERVICE';

      if (itemType === 'DRUG') {
        const drug = await db.drug.findUnique({ where: { id: item.referenceId } });
        if (!drug) {
          return NextResponse.json({ error: `Drug not found: ${item.referenceId}` }, { status: 400 });
        }
        const unitPrice = item.unitPrice ?? drug.unitPrice;
        const quantity = item.quantity || 1;
        const totalPrice = money(unitPrice * quantity);
        subtotal += totalPrice;
        quotationItems.push({
          itemType: 'DRUG',
          referenceId: drug.id,
          serviceId: null,
          itemName: `${drug.name}${drug.strength ? ` ${drug.strength}` : ''}`,
          quantity,
          unitPrice,
          totalPrice,
          notes: item.notes || '',
        });
      } else {
        // SERVICE or PACKAGE
        let serviceName = item.itemName || 'Medical service';
        let unitPrice = item.unitPrice || 0;
        if (item.serviceId) {
          const service = await db.service.findUnique({ where: { id: item.serviceId } });
          if (!service) {
            return NextResponse.json({ error: `Service not found: ${item.serviceId}` }, { status: 400 });
          }
          serviceName = service.name;
          unitPrice = item.unitPrice ?? service.price;
        }
        const quantity = item.quantity || 1;
        const totalPrice = money(unitPrice * quantity);
        subtotal += totalPrice;
        quotationItems.push({
          itemType,
          referenceId: '',
          serviceId: item.serviceId || null,
          itemName: serviceName,
          quantity,
          unitPrice,
          totalPrice,
          notes: item.notes || '',
        });
      }
    }

    const taxAmount = applyTax ? money(subtotal * (rate / 100)) : 0;
    const totalAmount = money(subtotal + taxAmount - (parseFloat(discountAmount) || 0));

    const quotation = await db.quotation.create({
      data: {
        quotationNo,
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        customerEmail: customerEmail || '',
        subtotal: money(subtotal),
        taxAmount,
        discountAmount: parseFloat(discountAmount) || 0,
        totalAmount,
        status: 'DRAFT',
        validUntil: validUntil ? new Date(validUntil) : null,
        notes: notes || '',
        createdById: user.id,
        items: { create: quotationItems },
      },
      include: { items: true },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'QUOTATION_CREATE',
        entityName: 'Quotation',
        entityId: quotation.id,
        details: `Quotation ${quotation.quotationNo} — KES ${quotation.totalAmount.toFixed(2)}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ quotation, message: 'Quotation created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Quotation POST error:', error);
    return NextResponse.json({ error: 'Failed to create quotation' }, { status: 500 });
  }
}

// ─── PUT: Update quotation ───
export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || (user.role !== 'ADMIN' && user.role !== 'CASHIER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, customerName, customerPhone, customerEmail, items, discountAmount, notes, validUntil, status, taxEnabled, taxRate } = body;

    const existing = await db.quotation.findUnique({ where: { id }, include: { items: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }
    if (user.role === 'CASHIER' && existing.createdById !== user.id) {
      return NextResponse.json({ error: 'Not authorized to edit this quotation' }, { status: 403 });
    }
    if (existing.status === 'CONVERTED_TO_BILL') {
      return NextResponse.json({ error: 'Cannot edit a quotation that has been converted to a bill' }, { status: 400 });
    }

    let subtotal = 0;
    let taxAmount = 0;
    let totalAmount = 0;

    if (items && items.length > 0) {
      await db.quotationItem.deleteMany({ where: { quotationId: id } });

      const applyTax = taxEnabled !== undefined ? taxEnabled : false;
      const rate = taxRate || 16;

      for (const item of items) {
        const itemType = item.itemType || 'SERVICE';
        let itemName = item.itemName || 'Item';
        let unitPrice = item.unitPrice || 0;
        let serviceId = item.serviceId || null;
        let referenceId = '';

        if (itemType === 'DRUG' && item.referenceId) {
          const drug = await db.drug.findUnique({ where: { id: item.referenceId } });
          if (!drug) continue;
          itemName = `${drug.name}${drug.strength ? ` ${drug.strength}` : ''}`;
          unitPrice = item.unitPrice ?? drug.unitPrice;
          referenceId = drug.id;
          serviceId = null;
        } else if (item.serviceId) {
          const service = await db.service.findUnique({ where: { id: item.serviceId } });
          if (!service) continue;
          itemName = service.name;
          unitPrice = item.unitPrice ?? service.price;
        }

        const quantity = item.quantity || 1;
        const totalPrice = money(unitPrice * quantity);
        subtotal += totalPrice;

        await db.quotationItem.create({
          data: {
            quotationId: id, itemType, referenceId, serviceId,
            itemName, quantity, unitPrice, totalPrice,
            notes: item.notes || '',
          },
        });
      }

      taxAmount = applyTax ? money(subtotal * (rate / 100)) : 0;
      totalAmount = money(subtotal + taxAmount - (parseFloat(discountAmount) || 0));
    } else {
      subtotal = existing.subtotal;
      taxAmount = existing.taxAmount;
      totalAmount = money(subtotal + taxAmount - ((parseFloat(discountAmount) || existing.discountAmount)));
    }

    const updated = await db.quotation.update({
      where: { id },
      data: {
        customerName: customerName !== undefined ? customerName : existing.customerName,
        customerPhone: customerPhone !== undefined ? customerPhone : existing.customerPhone,
        customerEmail: customerEmail !== undefined ? customerEmail : existing.customerEmail,
        subtotal: money(subtotal),
        taxAmount: money(taxAmount),
        discountAmount: parseFloat(discountAmount) || existing.discountAmount,
        totalAmount: money(totalAmount),
        status: status || existing.status,
        validUntil: validUntil !== undefined ? (validUntil ? new Date(validUntil) : null) : existing.validUntil,
        notes: notes !== undefined ? notes : existing.notes,
      },
      include: { items: true },
    });

    return NextResponse.json({ quotation: updated, message: 'Quotation updated' });
  } catch (error) {
    console.error('Quotation PUT error:', error);
    return NextResponse.json({ error: 'Failed to update quotation' }, { status: 500 });
  }
}

// ─── DELETE: Delete quotation ───
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const existing = await db.quotation.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status === 'CONVERTED_TO_BILL') {
      return NextResponse.json({ error: 'Cannot delete a converted quotation' }, { status: 400 });
    }

    await db.quotationItem.deleteMany({ where: { quotationId: id } });
    await db.quotation.delete({ where: { id } });

    return NextResponse.json({ message: 'Quotation deleted' });
  } catch (error) {
    console.error('Quotation DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete quotation' }, { status: 500 });
  }
}
