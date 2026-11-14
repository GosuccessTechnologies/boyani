import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * WARDS API — ward catalog (nursing units).
 * dailyRate (bed/day charge) is a pricing decision → ADMIN-only writes.
 * All staff read (bed board, admissions desk).
 */

const STAFF_ROLES = ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'CASHIER'];

// GET /api/wards — ward list with bed counts; ?id= single ward with beds
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, STAFF_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 30);
    const search = searchParams.get('search') || '';
    const wardType = searchParams.get('wardType') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const ward = await db.ward.findUnique({
        where: { id },
        include: { beds: { orderBy: { bedNumber: 'asc' } }, _count: { select: { beds: true } } },
      });
      if (!ward) return NextResponse.json({ error: 'Ward not found' }, { status: 404 });
      return NextResponse.json({ ward });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [{ name: { contains: search } }, { code: { contains: search } }];
    }
    if (wardType) where.wardType = wardType;

    const [wards, total] = await Promise.all([
      db.ward.findMany({
        where,
        orderBy: [{ wardType: 'asc' }, { name: 'asc' }],
        skip, take: perPage,
        include: { _count: { select: { beds: true } } },
      }),
      db.ward.count({ where }),
    ]);

    return NextResponse.json({
      wards, items: wards, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Wards GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch wards' }, { status: 500 });
  }
}

// POST /api/wards — create ward (or bulk import)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { bulkItems, ...data } = body;

    // Bulk CSV import
    if (bulkItems && Array.isArray(bulkItems) && bulkItems.length > 0) {
      let created = 0;
      for (const b of bulkItems) {
        if (!b.name) continue;
        const code = b.code || `WRD-${Date.now().toString(36).toUpperCase()}`;
        await db.ward.create({
          data: {
            name: b.name,
            code,
            wardType: b.wardType || 'GENERAL',
            gender: b.gender || 'MIXED',
            dailyRate: parseFloat(b.dailyRate) || 0,
            floor: b.floor || '',
            description: b.description || '',
          },
        }).catch(() => null);
        created++;
      }
      return NextResponse.json({ imported: created });
    }

    if (!data.name) return NextResponse.json({ error: 'Ward name is required' }, { status: 400 });

    const code = data.code || `WRD-${Date.now().toString(36).toUpperCase()}`;
    const clash = await db.ward.findUnique({ where: { code } }).catch(() => null);
    if (clash) return NextResponse.json({ error: `Ward code ${code} already exists` }, { status: 400 });

    const ward = await db.ward.create({
      data: {
        name: data.name,
        code,
        wardType: data.wardType || 'GENERAL',
        gender: data.gender || 'MIXED',
        dailyRate: parseFloat(data.dailyRate) || 0,
        floor: data.floor || '',
        description: data.description || '',
        isActive: data.isActive !== undefined ? !!data.isActive : true,
      },
      include: { _count: { select: { beds: true } } },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'WARD_CREATE', entityName: 'Ward', entityId: ward.id,
        details: `Ward ${ward.name} (${ward.code}) — KSh ${ward.dailyRate}/day`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ ward, message: `Ward ${ward.code} created` }, { status: 201 });
  } catch (error) {
    console.error('Wards POST error:', error);
    return NextResponse.json({ error: 'Failed to create ward' }, { status: 500 });
  }
}

// PUT /api/wards — update ward (dailyRate changes are audit-logged)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Ward ID required' }, { status: 400 });

    const existing = await db.ward.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Ward not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.code && data.code !== existing.code) {
      const clash = await db.ward.findUnique({ where: { code: data.code } }).catch(() => null);
      if (clash) return NextResponse.json({ error: `Ward code ${data.code} already exists` }, { status: 400 });
      updateData.code = data.code;
    }
    if (data.wardType) updateData.wardType = data.wardType;
    if (data.gender) updateData.gender = data.gender;
    if (data.dailyRate !== undefined) updateData.dailyRate = parseFloat(data.dailyRate) || 0;
    if (data.floor !== undefined) updateData.floor = data.floor;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = !!data.isActive;

    const ward = await db.ward.update({
      where: { id }, data: updateData,
      include: { _count: { select: { beds: true } } },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'WARD_UPDATE', entityName: 'Ward', entityId: id,
        details: `Ward ${existing.code} updated${data.dailyRate !== undefined && parseFloat(data.dailyRate) !== existing.dailyRate ? ` — dailyRate KSh ${existing.dailyRate} → KSh ${parseFloat(data.dailyRate) || 0}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ ward, message: 'Ward updated' });
  } catch (error) {
    console.error('Wards PUT error:', error);
    return NextResponse.json({ error: 'Failed to update ward' }, { status: 500 });
  }
}

// DELETE /api/wards?id= — blocked if beds exist (deactivate instead)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Ward ID required' }, { status: 400 });

    const existing = await db.ward.findUnique({
      where: { id },
      include: { _count: { select: { beds: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Ward not found' }, { status: 404 });

    if (existing._count.beds > 0) {
      await db.ward.update({ where: { id }, data: { isActive: false } });
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'WARD_DEACTIVATE', entityName: 'Ward', entityId: id,
          details: `Ward ${existing.code} deactivated (${existing._count.beds} beds still assigned)`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ message: `Ward ${existing.code} has ${existing._count.beds} bed(s) — deactivated instead of deleted` });
    }

    await db.ward.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'WARD_DELETE', entityName: 'Ward', entityId: id,
        details: `Ward ${existing.code} deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Ward deleted' });
  } catch (error) {
    console.error('Wards DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete ward' }, { status: 500 });
  }
}
