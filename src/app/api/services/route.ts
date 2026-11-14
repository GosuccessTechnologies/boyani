import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination, money } from '@/lib/api';

/**
 * SERVICES API — billable services. Pricing configured by ADMIN ONLY
 * (per instructions). Public read for website services pages.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === '1';
    const { page, perPage, skip } = getPagination(searchParams, 50);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const departmentId = searchParams.get('departmentId') || '';

    if (!isPublic) {
      const auth = await requireAuth(request, ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'CASHIER', 'LAB_TECH', 'NURSE']);
      if (auth instanceof NextResponse) return auth;
    }

    const where: Record<string, unknown> = {};
    if (isPublic) { where.isActive = true; where.department = { isPublic: true }; }
    if (search) where.OR = [{ name: { contains: search } }, { code: { contains: search } }, { description: { contains: search } }];
    if (category) where.category = category;
    if (departmentId) where.departmentId = departmentId;

    const [services, total] = await Promise.all([
      db.service.findMany({
        where, include: { department: { select: { name: true, slug: true, iconKey: true, color: true } } },
        orderBy: [{ category: 'asc' }, { name: 'asc' }], skip: isPublic ? 0 : skip, take: isPublic ? 200 : perPage,
      }),
      db.service.count({ where }),
    ]);
    return NextResponse.json({ services, total, page, perPage, totalPages: Math.ceil(total / perPage) });
  } catch (error) {
    console.error('Services GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error: 'Service name required' }, { status: 400 });

    if (body.bulkItems && Array.isArray(body.bulkItems)) {
      let created = 0;
      for (const b of body.bulkItems) {
        if (!b.name) continue;
        await db.service.create({
          data: {
            code: b.code || `SRV-${Date.now().toString(36).toUpperCase()}-${created}`,
            name: b.name, category: b.category || 'CLINICAL',
            description: b.description || '',
            price: parseFloat(b.price) || 0,
            shaCovered: b.shaCovered === 'true' || b.shaCovered === true,
            durationMin: parseInt(b.durationMin) || 30,
          },
        }).catch(() => null);
        created++;
      }
      return NextResponse.json({ imported: created });
    }

    const service = await db.service.create({
      data: {
        code: body.code || `SRV-${Date.now().toString(36).toUpperCase()}`,
        name: body.name,
        departmentId: body.departmentId || null,
        category: body.category || 'CLINICAL',
        description: body.description || '',
        price: money(parseFloat(body.price) || 0),
        shaCovered: !!body.shaCovered,
        durationMin: parseInt(body.durationMin) || 30,
      },
    });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'SERVICE_CREATE', entityName: 'Service', entityId: service.id,
        details: `${service.name} @ KES ${service.price}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});
    return NextResponse.json({ service, message: 'Service created' }, { status: 201 });
  } catch (error) {
    console.error('Services POST error:', error);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const data: Record<string, unknown> = {};
    for (const f of ['name', 'code', 'category', 'description']) if (body[f] !== undefined) data[f] = body[f];
    if (body.price !== undefined) data.price = money(parseFloat(body.price) || 0);
    if (body.shaCovered !== undefined) data.shaCovered = !!body.shaCovered;
    if (body.durationMin !== undefined) data.durationMin = parseInt(body.durationMin) || 30;
    if (body.departmentId !== undefined) data.departmentId = body.departmentId || null;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    const service = await db.service.update({ where: { id: body.id }, data });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'SERVICE_UPDATE', entityName: 'Service', entityId: body.id,
        details: `${service.name} → KES ${service.price}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});
    return NextResponse.json({ service, message: 'Service updated' });
  } catch (error) {
    console.error('Services PUT error:', error);
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const used = await db.billItem.count({ where: { serviceId: id } });
    if (used > 0) {
      await db.service.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ message: 'Service deactivated (referenced by bills)', softDeleted: true });
    }
    await db.service.delete({ where: { id } });
    return NextResponse.json({ message: 'Service deleted' });
  } catch (error) {
    console.error('Services DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
