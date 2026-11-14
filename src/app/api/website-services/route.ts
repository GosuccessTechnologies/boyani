import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * WEBSITE SERVICES API — public-facing CMS services (Instruction 5).
 * Completely SEPARATE from the facility Service pricing module; the two
 * only share Department for optional grouping.
 * GET ?public=1 works without auth (public website listings/detail).
 */

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const PUBLIC_SELECT = {
  id: true, slug: true, title: true, excerpt: true, content: true,
  featuredImage: true, bannerImage: true, iconKey: true, displayStyle: true,
  displayOrder: true, isFeatured: true,
  department: { select: { id: true, name: true, slug: true, color: true, iconKey: true } },
  subServices: {
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' as const },
    select: { id: true, title: true, description: true, iconKey: true },
  },
};

// GET /api/website-services?public=1[&slug=...]
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === '1';
    const slug = searchParams.get('slug');

    if (slug) {
      const service = await db.websiteService.findFirst({
        where: { slug, isActive: true },
        select: PUBLIC_SELECT,
      });
      if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      return NextResponse.json({ service });
    }

    const services = await db.websiteService.findMany({
      where: isPublic ? { isActive: true } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: isPublic ? PUBLIC_SELECT : {
        ...PUBLIC_SELECT,
        isActive: true,
        departmentId: true,
        subServices: { orderBy: { displayOrder: 'asc' as const }, select: { id: true, title: true, description: true, iconKey: true, displayOrder: true, isActive: true } },
      },
    });
    return NextResponse.json({ services });
  } catch (error) {
    console.error('Website services GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}

// POST /api/website-services — create (ADMIN)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

    let slug = slugify(String(body.slug || body.title));
    const exists = await db.websiteService.findUnique({ where: { slug } });
    if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const service = await db.websiteService.create({
      data: {
        slug,
        title: String(body.title),
        excerpt: String(body.excerpt || ''),
        content: String(body.content || ''),
        featuredImage: String(body.featuredImage || ''),
        bannerImage: String(body.bannerImage || ''),
        departmentId: body.departmentId || null,
        iconKey: String(body.iconKey || ''),
        displayStyle: ['cards', 'pills', 'table'].includes(body.displayStyle) ? body.displayStyle : 'cards',
        displayOrder: parseInt(body.displayOrder) || 0,
        isFeatured: !!body.isFeatured,
        isActive: body.isActive === undefined ? true : !!body.isActive,
        subServices: {
          create: (Array.isArray(body.subServices) ? body.subServices : [])
            .filter((s: { title?: string }) => s?.title)
            .map((s: { title: string; description?: string; iconKey?: string }, i: number) => ({
              title: String(s.title),
              description: String(s.description || ''),
              iconKey: String(s.iconKey || ''),
              displayOrder: i,
              isActive: true,
            })),
        },
      },
      include: { subServices: true },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'CREATE', entityName: 'WebsiteService', entityId: service.id,
        details: `Created website service "${service.title}"`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ service, message: 'Service created' }, { status: 201 });
  } catch (error) {
    console.error('Website services POST error:', error);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}

// PUT /api/website-services — update service or manage sub-services
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    // Add a sub-service {serviceId, sub:{title,description,iconKey}}
    if (body.action === 'add-sub' && body.serviceId) {
      const sub = await db.websiteSubService.create({
        data: {
          serviceId: body.serviceId,
          title: String(body.sub?.title || 'New sub-service'),
          description: String(body.sub?.description || ''),
          iconKey: String(body.sub?.iconKey || ''),
          displayOrder: parseInt(body.sub?.displayOrder) || 0,
          isActive: true,
        },
      });
      return NextResponse.json({ sub, message: 'Sub-service added' }, { status: 201 });
    }

    // Update a sub-service {subId, sub:{...}}
    if (body.action === 'update-sub' && body.subId) {
      const sub = await db.websiteSubService.update({
        where: { id: body.subId },
        data: {
          ...(body.sub?.title !== undefined && { title: String(body.sub.title) }),
          ...(body.sub?.description !== undefined && { description: String(body.sub.description) }),
          ...(body.sub?.iconKey !== undefined && { iconKey: String(body.sub.iconKey) }),
          ...(body.sub?.displayOrder !== undefined && { displayOrder: parseInt(body.sub.displayOrder) || 0 }),
          ...(body.sub?.isActive !== undefined && { isActive: !!body.sub.isActive }),
        },
      });
      return NextResponse.json({ sub, message: 'Sub-service updated' });
    }

    // Delete a sub-service {action:'delete-sub', subId}
    if (body.action === 'delete-sub' && body.subId) {
      await db.websiteSubService.delete({ where: { id: body.subId } });
      return NextResponse.json({ message: 'Sub-service deleted' });
    }

    // Reorder sub-services {action:'reorder-subs', orders:[{id,displayOrder}]}
    if (body.action === 'reorder-subs' && Array.isArray(body.orders)) {
      for (const o of body.orders) {
        await db.websiteSubService.update({ where: { id: o.id }, data: { displayOrder: parseInt(o.displayOrder) || 0 } }).catch(() => {});
      }
      return NextResponse.json({ message: 'Sub-services reordered' });
    }

    // Update the service itself {id, ...fields}
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = String(body.title);
    if (body.slug !== undefined && body.slug) data.slug = slugify(String(body.slug));
    if (body.excerpt !== undefined) data.excerpt = String(body.excerpt);
    if (body.content !== undefined) data.content = String(body.content);
    if (body.featuredImage !== undefined) data.featuredImage = String(body.featuredImage);
    if (body.bannerImage !== undefined) data.bannerImage = String(body.bannerImage);
    if (body.departmentId !== undefined) data.departmentId = body.departmentId || null;
    if (body.iconKey !== undefined) data.iconKey = String(body.iconKey);
    if (body.displayStyle !== undefined && ['cards', 'pills', 'table'].includes(body.displayStyle)) data.displayStyle = body.displayStyle;
    if (body.displayOrder !== undefined) data.displayOrder = parseInt(body.displayOrder) || 0;
    if (body.isFeatured !== undefined) data.isFeatured = !!body.isFeatured;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    const service = await db.websiteService.update({ where: { id: body.id }, data, include: { subServices: { orderBy: { displayOrder: 'asc' } } } });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'UPDATE', entityName: 'WebsiteService', entityId: service.id,
        details: `Updated website service "${service.title}"`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ service, message: 'Service updated' });
  } catch (error) {
    console.error('Website services PUT error:', error);
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 });
  }
}

// DELETE /api/website-services?id=...
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const service = await db.websiteService.findUnique({ where: { id } });
    if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.websiteService.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'DELETE', entityName: 'WebsiteService', entityId: id,
        details: `Deleted website service "${service.title}"`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});
    return NextResponse.json({ message: 'Service deleted' });
  } catch (error) {
    console.error('Website services DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
  }
}
