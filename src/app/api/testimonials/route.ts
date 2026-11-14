import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * TESTIMONIALS API — patient testimonials for the public website.
 * GET works WITHOUT auth when ?public=1 (published testimonials, featured first);
 * authenticated GET returns all. Writes are ADMIN-only.
 */

// GET /api/testimonials — public=1 → published testimonials; auth → full list
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublicRead = searchParams.get('public') === '1';
    if (!isPublicRead) {
      const auth = await requireAuth(request);
      if (auth instanceof NextResponse) return auth;
    }

    const { page, perPage, skip } = getPagination(searchParams, 30);
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || '';
    const featured = searchParams.get('featured') === '1';
    const id = searchParams.get('id') || '';

    if (id) {
      const testimonial = await db.testimonial.findUnique({ where: { id } });
      if (!testimonial || (isPublicRead && !testimonial.isPublic)) {
        return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });
      }
      return NextResponse.json({ testimonial });
    }

    const where: Record<string, unknown> = {};
    if (isPublicRead) where.isPublic = true;
    if (search) {
      where.OR = [
        { patientName: { contains: search } },
        { quote: { contains: search } },
      ];
    }
    if (department) where.department = department;
    if (featured) where.isFeatured = true;

    const [testimonials, total] = await Promise.all([
      db.testimonial.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'desc' }],
        skip: isPublicRead ? 0 : skip,
        take: isPublicRead ? 100 : perPage,
      }),
      db.testimonial.count({ where }),
    ]);

    if (isPublicRead) {
      return NextResponse.json({ items: testimonials, total });
    }
    return NextResponse.json({
      testimonials, items: testimonials, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Testimonials GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch testimonials' }, { status: 500 });
  }
}

// POST /api/testimonials — add testimonial
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { patientName, patientTitle, quote, rating, photoUrl, department, isFeatured, isPublic, displayOrder } = body;

    if (!patientName || !quote) {
      return NextResponse.json({ error: 'Patient name and quote are required' }, { status: 400 });
    }

    const testimonial = await db.testimonial.create({
      data: {
        patientName,
        patientTitle: patientTitle || 'Patient',
        quote,
        rating: Math.min(5, Math.max(1, parseInt(rating) || 5)),
        photoUrl: photoUrl || '',
        department: department || '',
        isFeatured: !!isFeatured,
        isPublic: isPublic !== undefined ? !!isPublic : true,
        displayOrder: parseInt(displayOrder) || 0,
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'TESTIMONIAL_CREATE', entityName: 'Testimonial', entityId: testimonial.id,
        details: `Testimonial from ${patientName} (${testimonial.rating}★) added`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ testimonial, message: 'Testimonial created' }, { status: 201 });
  } catch (error) {
    console.error('Testimonials POST error:', error);
    return NextResponse.json({ error: 'Failed to create testimonial' }, { status: 500 });
  }
}

// PUT /api/testimonials — update testimonial
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Testimonial ID required' }, { status: 400 });

    const existing = await db.testimonial.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (data.patientName) updateData.patientName = data.patientName;
    if (data.patientTitle !== undefined) updateData.patientTitle = data.patientTitle;
    if (data.quote) updateData.quote = data.quote;
    if (data.rating !== undefined) updateData.rating = Math.min(5, Math.max(1, parseInt(data.rating) || existing.rating));
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.isFeatured !== undefined) updateData.isFeatured = !!data.isFeatured;
    if (data.isPublic !== undefined) updateData.isPublic = !!data.isPublic;
    if (data.displayOrder !== undefined) updateData.displayOrder = parseInt(data.displayOrder) || 0;

    const testimonial = await db.testimonial.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'TESTIMONIAL_UPDATE', entityName: 'Testimonial', entityId: id,
        details: `Testimonial from ${existing.patientName} updated`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ testimonial, message: 'Testimonial updated' });
  } catch (error) {
    console.error('Testimonials PUT error:', error);
    return NextResponse.json({ error: 'Failed to update testimonial' }, { status: 500 });
  }
}

// DELETE /api/testimonials?id=
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Testimonial ID required' }, { status: 400 });

    const existing = await db.testimonial.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });

    await db.testimonial.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'TESTIMONIAL_DELETE', entityName: 'Testimonial', entityId: id,
        details: `Testimonial from ${existing.patientName} deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Testimonial deleted' });
  } catch (error) {
    console.error('Testimonials DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete testimonial' }, { status: 500 });
  }
}
