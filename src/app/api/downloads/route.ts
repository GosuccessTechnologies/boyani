import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * DOWNLOADS API — public downloads centre (forms, reports, policies, brochures, tenders).
 * GET works WITHOUT auth when ?public=1 (published files); authenticated GET returns all.
 * Content writes are ADMIN-only. PUT {id, downloadCount} alone is a public counter ping
 * (website increments the counter when a visitor downloads — no separate PATCH needed).
 */

const CONTENT_FIELDS = ['title', 'description', 'fileUrl', 'fileExt', 'fileSize', 'category', 'coverImageUrl', 'isPublic', 'displayOrder'];

// GET /api/downloads — public=1 → published downloads; auth → full list
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
    const category = searchParams.get('category') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const download = await db.download.findUnique({ where: { id } });
      if (!download || (isPublicRead && !download.isPublic)) {
        return NextResponse.json({ error: 'Download not found' }, { status: 404 });
      }
      return NextResponse.json({ download });
    }

    const where: Record<string, unknown> = {};
    if (isPublicRead) where.isPublic = true;
    if (search) where.title = { contains: search };
    if (category) where.category = category;

    const [downloads, total] = await Promise.all([
      db.download.findMany({
        where,
        orderBy: { displayOrder: 'asc' },
        skip: isPublicRead ? 0 : skip,
        take: isPublicRead ? 100 : perPage,
      }),
      db.download.count({ where }),
    ]);

    if (isPublicRead) {
      return NextResponse.json({ items: downloads, total });
    }
    return NextResponse.json({
      downloads, items: downloads, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Downloads GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch downloads' }, { status: 500 });
  }
}

// POST /api/downloads — add a downloadable file (counter starts at 0 — nothing incremented)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { title, description, fileUrl, fileExt, fileSize, category, coverImageUrl, isPublic, displayOrder } = body;

    if (!title || !fileUrl) {
      return NextResponse.json({ error: 'Title and fileUrl are required' }, { status: 400 });
    }

    const download = await db.download.create({
      data: {
        title,
        description: description || '',
        fileUrl,
        fileExt: fileExt || (fileUrl.split('.').pop() || 'pdf').toLowerCase(),
        fileSize: parseInt(fileSize) || 0,
        category: category || 'GENERAL',
        coverImageUrl: coverImageUrl || '',
        isPublic: isPublic !== undefined ? !!isPublic : true,
        displayOrder: parseInt(displayOrder) || 0,
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'DOWNLOAD_CREATE', entityName: 'Download', entityId: download.id,
        details: `Download "${title}" (${download.category}) added`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ download, message: `Download "${title}" created` }, { status: 201 });
  } catch (error) {
    console.error('Downloads POST error:', error);
    return NextResponse.json({ error: 'Failed to create download' }, { status: 500 });
  }
}

// PUT /api/downloads — update file details (ADMIN) OR {id, downloadCount} counter ping (public)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, downloadCount, ...rest } = body;
    if (!id) return NextResponse.json({ error: 'Download ID required' }, { status: 400 });

    const existing = await db.download.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Download not found' }, { status: 404 });

    const hasContentFields = Object.keys(rest).some(k => CONTENT_FIELDS.includes(k));

    // Counter ping — website download click (no auth, increments only)
    if (downloadCount !== undefined && !hasContentFields) {
      const download = await db.download.update({
        where: { id },
        data: { downloadCount: { increment: Math.max(1, parseInt(downloadCount) || 1) } },
      });
      return NextResponse.json({ downloadCount: download.downloadCount });
    }

    // Content edit — ADMIN only; downloadCount (when sent alongside) still means "increment"
    const auth = await requireAuth(request, ['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const updateData: Record<string, unknown> = {};
    if (rest.title) updateData.title = rest.title;
    if (rest.description !== undefined) updateData.description = rest.description;
    if (rest.fileUrl) updateData.fileUrl = rest.fileUrl;
    if (rest.fileExt !== undefined) updateData.fileExt = rest.fileExt;
    if (rest.fileSize !== undefined) updateData.fileSize = parseInt(rest.fileSize) || 0;
    if (rest.category) updateData.category = rest.category;
    if (rest.coverImageUrl !== undefined) updateData.coverImageUrl = rest.coverImageUrl;
    if (rest.isPublic !== undefined) updateData.isPublic = !!rest.isPublic;
    if (rest.displayOrder !== undefined) updateData.displayOrder = parseInt(rest.displayOrder) || 0;
    if (downloadCount !== undefined) {
      updateData.downloadCount = { increment: Math.max(1, parseInt(downloadCount) || 1) };
    }

    const download = await db.download.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'DOWNLOAD_UPDATE', entityName: 'Download', entityId: id,
        details: `Download "${existing.title}" updated${downloadCount !== undefined ? ` — counter incremented` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ download, message: 'Download updated' });
  } catch (error) {
    console.error('Downloads PUT error:', error);
    return NextResponse.json({ error: 'Failed to update download' }, { status: 500 });
  }
}

// DELETE /api/downloads?id=
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Download ID required' }, { status: 400 });

    const existing = await db.download.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Download not found' }, { status: 404 });

    await db.download.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'DOWNLOAD_DELETE', entityName: 'Download', entityId: id,
        details: `Download "${existing.title}" deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Download deleted' });
  } catch (error) {
    console.error('Downloads DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete download' }, { status: 500 });
  }
}
