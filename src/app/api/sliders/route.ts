import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * SLIDERS API — public read (public=1 → active only) + admin management.
 * designId selects one of the 12 slider animation designs.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === '1';
    const where: Record<string, unknown> = isPublic ? { isActive: true } : {};
    const sliders = await db.slider.findMany({ where, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }] });
    return NextResponse.json({ sliders });
  } catch (error) {
    console.error('Sliders GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch sliders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  void searchParams;
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await db.session.findUnique({ where: { token: authHeader.replace('Bearer ', '') }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
    const slider = await db.slider.create({
      data: {
        title: body.title,
        subtitle: body.subtitle || null,
        description: body.description || null,
        imageUrl: body.imageUrl || null,
        videoUrl: body.videoUrl || null,
        backgroundUrl: body.backgroundUrl || null,
        overlayColor: body.overlayColor || null,
        overlayOpacity: body.overlayOpacity !== undefined ? parseFloat(body.overlayOpacity) : null,
        ctaPrimaryText: body.ctaPrimaryText || null,
        ctaPrimaryUrl: body.ctaPrimaryUrl || null,
        ctaSecondaryText: body.ctaSecondaryText || null,
        ctaSecondaryUrl: body.ctaSecondaryUrl || null,
        designId: parseInt(body.designId) || 1,
        displayOrder: parseInt(body.displayOrder) || 0,
        isActive: body.isActive !== false,
        autoRotate: body.autoRotate !== false,
        rotateDelayMs: parseInt(body.rotateDelayMs) || 6000,
      },
    });
    return NextResponse.json({ slider, message: 'Slide created' }, { status: 201 });
  } catch (error) {
    console.error('Sliders POST error:', error);
    return NextResponse.json({ error: 'Failed to create slide' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await db.session.findUnique({ where: { token: authHeader.replace('Bearer ', '') }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const data: Record<string, unknown> = {};
    const strFields = ['title', 'subtitle', 'description', 'imageUrl', 'videoUrl', 'backgroundUrl', 'overlayColor', 'ctaPrimaryText', 'ctaPrimaryUrl', 'ctaSecondaryText', 'ctaSecondaryUrl'];
    for (const f of strFields) if (body[f] !== undefined) data[f] = body[f] === null ? null : String(body[f]);
    const numFields = ['designId', 'displayOrder', 'rotateDelayMs'];
    for (const f of numFields) if (body[f] !== undefined) data[f] = parseInt(body[f]) || 0;
    if (body.overlayOpacity !== undefined) data.overlayOpacity = parseFloat(body.overlayOpacity);
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    if (body.autoRotate !== undefined) data.autoRotate = !!body.autoRotate;

    const slider = await db.slider.update({ where: { id: body.id }, data });
    return NextResponse.json({ slider, message: 'Slide updated' });
  } catch (error) {
    console.error('Sliders PUT error:', error);
    return NextResponse.json({ error: 'Failed to update slide' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await db.session.findUnique({ where: { token: authHeader.replace('Bearer ', '') }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await db.slider.delete({ where: { id } });
    return NextResponse.json({ message: 'Slide deleted' });
  } catch (error) {
    console.error('Sliders DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete slide' }, { status: 500 });
  }
}
