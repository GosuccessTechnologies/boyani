import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * WEB PAGES API — CMS pages for the public website
 * (About, Why Choose Us, Values, Vision & Mission, Contact info, custom pages).
 * GET works WITHOUT auth when ?public=1 (website reads — only published pages);
 * authenticated GET returns everything. Writes are ADMIN-only.
 */

function slugify(text: string): string {
  const slug = text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || `page-${Date.now().toString(36)}`;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  const clash = await db.webPage.findUnique({ where: { slug } }).catch(() => null);
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;
  return slug;
}

// GET /api/web-pages — public=1 → published pages for the website; auth → full list
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
    const moduleKey = searchParams.get('moduleKey') || '';
    const id = searchParams.get('id') || '';
    const slug = searchParams.get('slug') || '';

    // Single page by id or slug (public reads only see published pages)
    if (id || slug) {
      const webPage = id
        ? await db.webPage.findUnique({ where: { id } })
        : await db.webPage.findUnique({ where: { slug } });
      if (!webPage || (isPublicRead && !webPage.isPublic)) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }
      return NextResponse.json({ page: webPage });
    }

    const where: Record<string, unknown> = {};
    if (isPublicRead) where.isPublic = true;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { slug: { contains: search } },
      ];
    }
    if (moduleKey) where.moduleKey = moduleKey;

    const [webPages, total] = await Promise.all([
      db.webPage.findMany({
        where,
        orderBy: { displayOrder: 'asc' },
        skip: isPublicRead ? 0 : skip,
        take: isPublicRead ? 100 : perPage,
        select: {
          id: true, slug: true, title: true, excerpt: true, moduleKey: true,
          heroDesignId: true, breadcrumbDesignId: true, seoTitle: true, seoDescription: true,
          showInMenu: true, isPublic: true, displayOrder: true, publishedAt: true,
          updatedAt: true,
          ...(isPublicRead ? { content: true } : {}),
        },
      }),
      db.webPage.count({ where }),
    ]);

    if (isPublicRead) {
      return NextResponse.json({ items: webPages, total });
    }
    return NextResponse.json({
      webPages, items: webPages, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Web pages GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
}

// POST /api/web-pages — create CMS page (publishedAt set when isPublic first true)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      title, slug, excerpt, content, moduleKey, heroDesignId, breadcrumbDesignId,
      seoTitle, seoDescription, showInMenu, isPublic, displayOrder, publishedAt,
    } = body;

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const finalSlug = slug ? await uniqueSlug(slug) : await uniqueSlug(title);
    const isPublicFlag = isPublic !== undefined ? !!isPublic : true;

    const webPage = await db.webPage.create({
      data: {
        title,
        slug: finalSlug,
        excerpt: excerpt || '',
        content: content || '',
        moduleKey: moduleKey || 'PAGE',
        heroDesignId: parseInt(heroDesignId) || 1,
        breadcrumbDesignId: parseInt(breadcrumbDesignId) || 1,
        seoTitle: seoTitle || title,
        seoDescription: seoDescription || (excerpt || '').slice(0, 160),
        showInMenu: showInMenu !== undefined ? !!showInMenu : true,
        isPublic: isPublicFlag,
        displayOrder: parseInt(displayOrder) || 0,
        publishedAt: isPublicFlag ? (publishedAt ? new Date(publishedAt) : new Date()) : null,
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'WEBPAGE_CREATE', entityName: 'WebPage', entityId: webPage.id,
        details: `Page "${title}" (${finalSlug}) created${isPublicFlag ? ' — published' : ' — draft'}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ page: webPage, message: `Page "${title}" created` }, { status: 201 });
  } catch (error) {
    console.error('Web pages POST error:', error);
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 });
  }
}

// PUT /api/web-pages — update page; first publish stamps publishedAt
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Page ID required' }, { status: 400 });

    const existing = await db.webPage.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (data.title) updateData.title = data.title;
    if (data.slug !== undefined && data.slug && data.slug !== existing.slug) {
      updateData.slug = await uniqueSlug(data.slug);
    }
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.moduleKey) updateData.moduleKey = data.moduleKey;
    if (data.heroDesignId !== undefined) updateData.heroDesignId = parseInt(data.heroDesignId) || existing.heroDesignId;
    if (data.breadcrumbDesignId !== undefined) updateData.breadcrumbDesignId = parseInt(data.breadcrumbDesignId) || existing.breadcrumbDesignId;
    if (data.seoTitle !== undefined) updateData.seoTitle = data.seoTitle;
    if (data.seoDescription !== undefined) updateData.seoDescription = data.seoDescription;
    if (data.showInMenu !== undefined) updateData.showInMenu = !!data.showInMenu;
    if (data.displayOrder !== undefined) updateData.displayOrder = parseInt(data.displayOrder) || 0;
    if (data.isPublic !== undefined) {
      updateData.isPublic = !!data.isPublic;
      // First time going live → stamp publishedAt
      if (data.isPublic && !existing.publishedAt && data.publishedAt === undefined) {
        updateData.publishedAt = new Date();
      }
    }
    if (data.publishedAt !== undefined) {
      updateData.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    }

    const webPage = await db.webPage.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'WEBPAGE_UPDATE', entityName: 'WebPage', entityId: id,
        details: `Page "${existing.title}" updated`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ page: webPage, message: 'Page updated' });
  } catch (error) {
    console.error('Web pages PUT error:', error);
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 });
  }
}

// DELETE /api/web-pages?id=
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Page ID required' }, { status: 400 });

    const existing = await db.webPage.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

    await db.webPage.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'WEBPAGE_DELETE', entityName: 'WebPage', entityId: id,
        details: `Page "${existing.title}" (${existing.slug}) deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Page deleted' });
  } catch (error) {
    console.error('Web pages DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 });
  }
}
