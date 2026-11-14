import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * FILES API — file manager portal: all uploaded files grouped by module & date.
 */

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 30);
    const module = searchParams.get('module') || '';
    const search = searchParams.get('search') || '';
    const date = searchParams.get('date') || '';

    const where: Record<string, unknown> = {};
    if (module) where.module = module;
    if (search) where.OR = [{ originalName: { contains: search } }, { fileName: { contains: search } }];
    if (date) {
      where.createdAt = { gte: new Date(date + 'T00:00:00'), lt: new Date(date + 'T23:59:59') };
    }

    const [files, total, moduleGroups, dateGroups] = await Promise.all([
      db.fileRecord.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: perPage }),
      db.fileRecord.count({ where }),
      db.fileRecord.groupBy({ by: ['module'], _count: true }),
      db.fileRecord.findMany({ select: { createdAt: true }, distinct: undefined, orderBy: { createdAt: 'desc' }, take: 500 }),
    ]);

    // Group dates as YYYY-MM-DD
    const dates = [...new Set(dateGroups.map(f => new Date(f.createdAt).toISOString().slice(0, 10)))].slice(0, 60);

    return NextResponse.json({
      files, total, page, perPage, totalPages: Math.ceil(total / perPage),
      moduleGroups: moduleGroups.map(g => ({ name: g.module, count: g._count })),
      dateGroups: dates,
    });
  } catch (error) {
    console.error('Files GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

// PUT /api/files — edit file metadata (display name, module, folder)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const data: Record<string, string> = {};
    if (body.originalName !== undefined && String(body.originalName).trim()) data.originalName = String(body.originalName).trim().slice(0, 180);
    if (body.module !== undefined) data.module = String(body.module).toUpperCase().slice(0, 30) || 'GENERAL';
    if (body.folder !== undefined) data.folder = String(body.folder).slice(0, 120) || '/';
    const file = await db.fileRecord.update({ where: { id: body.id }, data });
    return NextResponse.json({ file, message: 'Metadata updated' });
  } catch (error) {
    console.error('Files PUT error:', error);
    return NextResponse.json({ error: 'Failed to update metadata' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await db.fileRecord.delete({ where: { id } }).catch(() => null);
    return NextResponse.json({ message: 'File record removed' });
  } catch (error) {
    console.error('Files DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
