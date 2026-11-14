import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * NEWS API — hospital news, announcements & events for the public website.
 * GET works WITHOUT auth when ?public=1 (published posts only, newest first,
 * supports ?featured=1 and ?take=); authenticated GET returns everything.
 * Writes are ADMIN-only.
 */

function slugify(text: string): string {
  const slug = text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || `post-${Date.now().toString(36)}`;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  const clash = await db.newsPost.findUnique({ where: { slug } }).catch(() => null);
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;
  return slug;
}

// GET /api/news — public=1 → published posts (featured + take supported); auth → full list
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublicRead = searchParams.get('public') === '1';
    if (!isPublicRead) {
      const auth = await requireAuth(request);
      if (auth instanceof NextResponse) return auth;
    }

    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const featured = searchParams.get('featured') === '1';
    const take = parseInt(searchParams.get('take') || '0') || 0;
    const id = searchParams.get('id') || '';
    const slug = searchParams.get('slug') || '';

    // Single post by id or slug (public reads only see published posts)
    if (id || slug) {
      const post = id
        ? await db.newsPost.findUnique({ where: { id } })
        : await db.newsPost.findUnique({ where: { slug } });
      if (!post || (isPublicRead && (!post.isPublic || !post.publishedAt))) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      return NextResponse.json({ post });
    }

    const where: Record<string, unknown> = {};
    if (isPublicRead) {
      where.isPublic = true;
      where.publishedAt = { not: null };
    }
    if (search) where.title = { contains: search };
    if (category) where.category = category;
    if (featured) where.isFeatured = true;

    const [posts, total] = await Promise.all([
      db.newsPost.findMany({
        where,
        orderBy: isPublicRead ? { publishedAt: 'desc' } : { createdAt: 'desc' },
        skip: isPublicRead ? 0 : skip,
        take: isPublicRead ? (take || 50) : perPage,
        select: isPublicRead
          ? { id: true, slug: true, title: true, excerpt: true, content: true, category: true, coverImageUrl: true, author: true, tags: true, isFeatured: true, publishedAt: true }
          : undefined,
      }),
      db.newsPost.count({ where }),
    ]);

    if (isPublicRead) {
      return NextResponse.json({ items: posts, total });
    }
    return NextResponse.json({
      news: posts, items: posts, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('News GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}

// POST /api/news — create post (publishedAt stamped when public)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      title, slug, excerpt, content, category, coverImageUrl, author,
      tags, isFeatured, isPublic, publishedAt,
    } = body;

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const finalSlug = slug ? await uniqueSlug(slug) : await uniqueSlug(title);
    const isPublicFlag = isPublic !== undefined ? !!isPublic : true;
    const defaultAuthor = (author || `${auth.user.firstName} ${auth.user.lastName}`.trim() || auth.user.username);

    const post = await db.newsPost.create({
      data: {
        title,
        slug: finalSlug,
        excerpt: excerpt || '',
        content: content || '',
        category: category || 'ANNOUNCEMENTS',
        coverImageUrl: coverImageUrl || '',
        author: defaultAuthor,
        tags: tags || '',
        isFeatured: !!isFeatured,
        isPublic: isPublicFlag,
        publishedAt: isPublicFlag ? (publishedAt ? new Date(publishedAt) : new Date()) : null,
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'NEWS_CREATE', entityName: 'NewsPost', entityId: post.id,
        details: `News "${title}" (${finalSlug}) created${isPublicFlag ? ' — published' : ' — draft'}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ post, message: `News post "${title}" created` }, { status: 201 });
  } catch (error) {
    console.error('News POST error:', error);
    return NextResponse.json({ error: 'Failed to create news post' }, { status: 500 });
  }
}

// PUT /api/news — update post; first publish stamps publishedAt
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Post ID required' }, { status: 400 });

    const existing = await db.newsPost.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (data.title) updateData.title = data.title;
    if (data.slug !== undefined && data.slug && data.slug !== existing.slug) {
      updateData.slug = await uniqueSlug(data.slug);
    }
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.category) updateData.category = data.category;
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
    if (data.author !== undefined) updateData.author = data.author;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.isFeatured !== undefined) updateData.isFeatured = !!data.isFeatured;
    if (data.isPublic !== undefined) {
      updateData.isPublic = !!data.isPublic;
      if (data.isPublic && !existing.publishedAt && data.publishedAt === undefined) {
        updateData.publishedAt = new Date();
      }
    }
    if (data.publishedAt !== undefined) {
      updateData.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    }

    const post = await db.newsPost.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'NEWS_UPDATE', entityName: 'NewsPost', entityId: id,
        details: `News "${existing.title}" updated`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ post, message: 'News post updated' });
  } catch (error) {
    console.error('News PUT error:', error);
    return NextResponse.json({ error: 'Failed to update news post' }, { status: 500 });
  }
}

// DELETE /api/news?id=
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Post ID required' }, { status: 400 });

    const existing = await db.newsPost.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    await db.newsPost.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'NEWS_DELETE', entityName: 'NewsPost', entityId: id,
        details: `News "${existing.title}" (${existing.slug}) deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'News post deleted' });
  } catch (error) {
    console.error('News DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete news post' }, { status: 500 });
  }
}
