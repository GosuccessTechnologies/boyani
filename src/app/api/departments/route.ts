import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * DEPARTMENTS API — clinical departments. Public read for website.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === '1';
    const where: Record<string, unknown> = {};
    if (isPublic) { where.isPublic = true; where.isActive = true; }

    const departments = await db.department.findMany({
      where,
      include: { _count: { select: { services: true } } },
      orderBy: { displayOrder: 'asc' },
    });
    return NextResponse.json({ departments });
  } catch (error) {
    console.error('Departments GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const slug = (body.slug || body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const department = await db.department.create({
      data: {
        name: body.name, slug,
        description: body.description || '',
        iconKey: body.iconKey || '',
        imageUrl: body.imageUrl || '',
        color: body.color || '#0d9488',
        displayOrder: parseInt(body.displayOrder) || 0,
        isPublic: body.isPublic !== false,
      },
    });
    return NextResponse.json({ department, message: 'Department created' }, { status: 201 });
  } catch (error) {
    console.error('Departments POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const data: Record<string, unknown> = {};
    for (const f of ['name', 'description', 'iconKey', 'imageUrl', 'color']) if (body[f] !== undefined) data[f] = body[f];
    if (body.displayOrder !== undefined) data.displayOrder = parseInt(body.displayOrder) || 0;
    if (body.isPublic !== undefined) data.isPublic = !!body.isPublic;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    const department = await db.department.update({ where: { id: body.id }, data });
    return NextResponse.json({ department, message: 'Department updated' });
  } catch (error) {
    console.error('Departments PUT error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const used = await db.service.count({ where: { departmentId: id } });
    if (used > 0) {
      await db.department.update({ where: { id }, data: { isActive: false, isPublic: false } });
      return NextResponse.json({ message: 'Department deactivated (has services)', softDeleted: true });
    }
    await db.department.delete({ where: { id } });
    return NextResponse.json({ message: 'Department deleted' });
  } catch (error) {
    console.error('Departments DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
