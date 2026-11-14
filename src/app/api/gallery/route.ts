import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * GALLERY API — public photo albums.
 * GET works WITHOUT auth when ?public=1 (published albums with their photos);
 * authenticated GET returns all. Writes are ADMIN-only.
 * Photos are managed through this same route:
 *   POST {albumId, photo:{...}}  → append one photo
 *   PUT  {albumId, photos:[...]} → replace all photos in the album
 *   DELETE ?photoId=             → remove one photo
 */

interface PhotoInput {
  imageUrl?: string;
  title?: string;
  caption?: string;
  displayOrder?: number | string;
}

function slugify(text: string): string {
  const slug = text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || `album-${Date.now().toString(36)}`;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  const clash = await db.galleryAlbum.findUnique({ where: { slug } }).catch(() => null);
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;
  return slug;
}

// GET /api/gallery — public=1 → published albums w/ photos; auth → full list
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
    const id = searchParams.get('id') || '';
    const albumId = searchParams.get('albumId') || '';

    // Single album with photos
    if (id || albumId) {
      const album = await db.galleryAlbum.findUnique({
        where: id ? { id } : { id: albumId },
        include: { photos: { orderBy: { displayOrder: 'asc' } } },
      });
      if (!album || (isPublicRead && !album.isPublic)) {
        return NextResponse.json({ error: 'Album not found' }, { status: 404 });
      }
      return NextResponse.json({ album });
    }

    const where: Record<string, unknown> = {};
    if (isPublicRead) where.isPublic = true;
    if (search) {
      where.OR = [{ title: { contains: search } }, { description: { contains: search } }];
    }

    const [albums, total] = await Promise.all([
      db.galleryAlbum.findMany({
        where,
        orderBy: { displayOrder: 'asc' },
        skip: isPublicRead ? 0 : skip,
        take: isPublicRead ? 100 : perPage,
        include: { photos: isPublicRead ? { orderBy: { displayOrder: 'asc' } } : { select: { id: true } } },
      }),
      db.galleryAlbum.count({ where }),
    ]);

    if (isPublicRead) {
      const items = albums.map(a => ({ ...a, photoCount: a.photos.length }));
      return NextResponse.json({ items, total });
    }
    return NextResponse.json({
      albums, items: albums, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Gallery GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch albums' }, { status: 500 });
  }
}

// POST /api/gallery — create album OR {albumId, photo} append a photo
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { title, description, coverImageUrl, displayOrder, isPublic, albumId, photo } = body;

    // Append a photo to an existing album
    if (albumId && photo) {
      const album = await db.galleryAlbum.findUnique({ where: { id: albumId } });
      if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 });
      if (!photo.imageUrl) {
        return NextResponse.json({ error: 'photo.imageUrl is required' }, { status: 400 });
      }
      const created = await db.galleryPhoto.create({
        data: {
          albumId,
          imageUrl: photo.imageUrl,
          title: photo.title || '',
          caption: photo.caption || '',
          displayOrder: parseInt(photo.displayOrder) || 0,
        },
      });
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'GALLERY_PHOTO_CREATE', entityName: 'GalleryPhoto', entityId: created.id,
          details: `Photo added to album "${album.title}"`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ photo: created, message: 'Photo added' }, { status: 201 });
    }

    // Create album
    if (!title) return NextResponse.json({ error: 'Album title is required' }, { status: 400 });

    const album = await db.galleryAlbum.create({
      data: {
        title,
        slug: await uniqueSlug(body.slug || title),
        description: description || '',
        coverImageUrl: coverImageUrl || '',
        displayOrder: parseInt(displayOrder) || 0,
        isPublic: isPublic !== undefined ? !!isPublic : true,
      },
      include: { photos: true },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'GALLERY_ALBUM_CREATE', entityName: 'GalleryAlbum', entityId: album.id,
        details: `Album "${title}" created`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ album, message: `Album "${title}" created` }, { status: 201 });
  } catch (error) {
    console.error('Gallery POST error:', error);
    return NextResponse.json({ error: 'Failed to create album' }, { status: 500 });
  }
}

// PUT /api/gallery — update album OR {albumId, photos:[...]} replace all photos
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, title, description, coverImageUrl, displayOrder, isPublic, albumId, photos } = body;

    // Replace the photo set of an album (deleteMany → recreate)
    if (albumId && Array.isArray(photos)) {
      const album = await db.galleryAlbum.findUnique({ where: { id: albumId } });
      if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 });

      const photoData = (photos as PhotoInput[])
        .filter(p => p.imageUrl)
        .map((p, idx) => ({
          albumId,
          imageUrl: p.imageUrl!,
          title: p.title || '',
          caption: p.caption || '',
          displayOrder: parseInt(String(p.displayOrder)) || idx,
        }));

      await db.$transaction(async (tx) => {
        await tx.galleryPhoto.deleteMany({ where: { albumId } });
        if (photoData.length > 0) {
          await tx.galleryPhoto.createMany({ data: photoData });
        }
      });

      const refreshed = await db.galleryAlbum.findUnique({
        where: { id: albumId },
        include: { photos: { orderBy: { displayOrder: 'asc' } } },
      });
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'GALLERY_PHOTOS_REPLACE', entityName: 'GalleryAlbum', entityId: albumId,
          details: `Album "${album.title}" photos replaced (${photos.length} photo(s))`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});

      return NextResponse.json({ album: refreshed, message: 'Photos replaced' });
    }

    // Update album metadata
    if (!id) return NextResponse.json({ error: 'Album ID required' }, { status: 400 });
    const existing = await db.galleryAlbum.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Album not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (title) updateData.title = title;
    if (body.slug !== undefined && body.slug && body.slug !== existing.slug) {
      updateData.slug = await uniqueSlug(body.slug);
    }
    if (description !== undefined) updateData.description = description;
    if (coverImageUrl !== undefined) updateData.coverImageUrl = coverImageUrl;
    if (displayOrder !== undefined) updateData.displayOrder = parseInt(displayOrder) || 0;
    if (isPublic !== undefined) updateData.isPublic = !!isPublic;

    const album = await db.galleryAlbum.update({
      where: { id }, data: updateData,
      include: { photos: { orderBy: { displayOrder: 'asc' } } },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'GALLERY_ALBUM_UPDATE', entityName: 'GalleryAlbum', entityId: id,
        details: `Album "${existing.title}" updated`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ album, message: 'Album updated' });
  } catch (error) {
    console.error('Gallery PUT error:', error);
    return NextResponse.json({ error: 'Failed to update gallery' }, { status: 500 });
  }
}

// DELETE /api/gallery?id= (album — photos cascade) OR ?photoId= (single photo)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';
    const photoId = searchParams.get('photoId') || '';

    if (photoId) {
      const photo = await db.galleryPhoto.findUnique({ where: { id: photoId } });
      if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
      await db.galleryPhoto.delete({ where: { id: photoId } });
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'GALLERY_PHOTO_DELETE', entityName: 'GalleryPhoto', entityId: photoId,
          details: `Photo removed from album ${photo.albumId}`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ message: 'Photo deleted' });
    }

    if (!id) return NextResponse.json({ error: 'Album ID (or photoId) required' }, { status: 400 });
    const existing = await db.galleryAlbum.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Album not found' }, { status: 404 });

    await db.galleryAlbum.delete({ where: { id } }); // photos cascade-delete
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'GALLERY_ALBUM_DELETE', entityName: 'GalleryAlbum', entityId: id,
        details: `Album "${existing.title}" deleted (with photos)`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Album deleted' });
  } catch (error) {
    console.error('Gallery DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete gallery item' }, { status: 500 });
  }
}
