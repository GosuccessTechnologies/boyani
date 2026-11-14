import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * BEDS API — bed inventory per ward.
 * ADMIN + NURSE manage beds (add, reserve, maintenance); all staff read
 * (bed board, admissions desk).
 */

const STAFF_ROLES = ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'CASHIER'];
const BED_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'];

// GET /api/beds — bed list; ?id= single bed with ward
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, STAFF_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 50);
    const search = searchParams.get('search') || '';
    const wardId = searchParams.get('wardId') || '';
    const status = searchParams.get('status') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const bed = await db.bed.findUnique({
        where: { id },
        include: { ward: true, _count: { select: { admissions: true } } },
      });
      if (!bed) return NextResponse.json({ error: 'Bed not found' }, { status: 404 });
      return NextResponse.json({ bed });
    }

    const where: Record<string, unknown> = {};
    if (search) where.bedNumber = { contains: search };
    if (wardId) where.wardId = wardId;
    if (status) where.status = status;

    const [beds, total] = await Promise.all([
      db.bed.findMany({
        where,
        orderBy: { bedNumber: 'asc' },
        skip, take: perPage,
        include: { ward: { select: { id: true, name: true, code: true, wardType: true, dailyRate: true } } },
      }),
      db.bed.count({ where }),
    ]);

    return NextResponse.json({
      beds, items: beds, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Beds GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch beds' }, { status: 500 });
  }
}

// POST /api/beds — add bed (or bulk import)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'NURSE']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { bulkItems, ...data } = body;

    // Bulk CSV import
    if (bulkItems && Array.isArray(bulkItems) && bulkItems.length > 0) {
      let created = 0;
      for (const b of bulkItems) {
        if (!b.bedNumber || !b.wardId) continue;
        await db.bed.create({
          data: {
            bedNumber: b.bedNumber,
            wardId: b.wardId,
            status: b.status || 'AVAILABLE',
            notes: b.notes || '',
          },
        }).catch(() => null);
        created++;
      }
      return NextResponse.json({ imported: created });
    }

    if (!data.bedNumber || !data.wardId) {
      return NextResponse.json({ error: 'bedNumber and wardId are required' }, { status: 400 });
    }
    if (data.status && !BED_STATUSES.includes(data.status)) {
      return NextResponse.json({ error: `Invalid status. Use one of: ${BED_STATUSES.join(', ')}` }, { status: 400 });
    }

    const ward = await db.ward.findUnique({ where: { id: data.wardId } });
    if (!ward) return NextResponse.json({ error: 'Ward not found' }, { status: 404 });

    const clash = await db.bed.findUnique({ where: { bedNumber: data.bedNumber } }).catch(() => null);
    if (clash) return NextResponse.json({ error: `Bed number ${data.bedNumber} already exists` }, { status: 400 });

    const bed = await db.bed.create({
      data: {
        bedNumber: data.bedNumber,
        wardId: data.wardId,
        status: data.status || 'AVAILABLE',
        notes: data.notes || '',
      },
      include: { ward: { select: { name: true, code: true, wardType: true } } },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'BED_CREATE', entityName: 'Bed', entityId: bed.id,
        details: `Bed ${bed.bedNumber} added to ${ward.name} (${ward.code})`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ bed, message: `Bed ${bed.bedNumber} created` }, { status: 201 });
  } catch (error) {
    console.error('Beds POST error:', error);
    return NextResponse.json({ error: 'Failed to create bed' }, { status: 500 });
  }
}

// PUT /api/beds — update bed (status moves AVAILABLE/RESERVED/MAINTENANCE; occupancy flows via admissions)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'NURSE']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Bed ID required' }, { status: 400 });

    const existing = await db.bed.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Bed not found' }, { status: 404 });

    if (data.status && !BED_STATUSES.includes(data.status)) {
      return NextResponse.json({ error: `Invalid status. Use one of: ${BED_STATUSES.join(', ')}` }, { status: 400 });
    }
    if (existing.status === 'OCCUPIED' && data.status && data.status !== 'OCCUPIED') {
      return NextResponse.json({ error: 'Bed is OCCUPIED — discharge the admission first (/api/admissions PUT)' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.bedNumber && data.bedNumber !== existing.bedNumber) {
      const clash = await db.bed.findUnique({ where: { bedNumber: data.bedNumber } }).catch(() => null);
      if (clash) return NextResponse.json({ error: `Bed number ${data.bedNumber} already exists` }, { status: 400 });
      updateData.bedNumber = data.bedNumber;
    }
    if (data.wardId && data.wardId !== existing.wardId) {
      const ward = await db.ward.findUnique({ where: { id: data.wardId } });
      if (!ward) return NextResponse.json({ error: 'Ward not found' }, { status: 404 });
      updateData.wardId = data.wardId;
    }
    if (data.status) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const bed = await db.bed.update({
      where: { id }, data: updateData,
      include: { ward: { select: { name: true, code: true, wardType: true } } },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'BED_UPDATE', entityName: 'Bed', entityId: id,
        details: `Bed ${existing.bedNumber} updated${data.status && data.status !== existing.status ? ` — ${existing.status} → ${data.status}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ bed, message: 'Bed updated' });
  } catch (error) {
    console.error('Beds PUT error:', error);
    return NextResponse.json({ error: 'Failed to update bed' }, { status: 500 });
  }
}

// DELETE /api/beds?id= — blocked if admission history exists (deactivate → MAINTENANCE)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'NURSE']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Bed ID required' }, { status: 400 });

    const existing = await db.bed.findUnique({
      where: { id },
      include: { _count: { select: { admissions: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Bed not found' }, { status: 404 });

    if (existing._count.admissions > 0) {
      await db.bed.update({ where: { id }, data: { status: 'MAINTENANCE', notes: `${existing.notes} — retired ${new Date().toISOString().slice(0, 10)}`.trim() } });
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'BED_RETIRE', entityName: 'Bed', entityId: id,
          details: `Bed ${existing.bedNumber} retired to MAINTENANCE (${existing._count.admissions} admissions in history)`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ message: `Bed ${existing.bedNumber} has admission history — set to MAINTENANCE instead of deleting` });
    }

    if (existing.status === 'OCCUPIED') {
      return NextResponse.json({ error: 'Bed is OCCUPIED — discharge the admission first' }, { status: 400 });
    }

    await db.bed.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'BED_DELETE', entityName: 'Bed', entityId: id,
        details: `Bed ${existing.bedNumber} deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Bed deleted' });
  } catch (error) {
    console.error('Beds DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete bed' }, { status: 500 });
  }
}
