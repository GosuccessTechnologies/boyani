import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const session = await db.session.findUnique({ where: { token: authHeader.replace('Bearer ', '') }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.role !== 'ADMIN') return null;
  return session.user;
}

/**
 * MENUS API — menu & mega-menu management.
 * GET public=1 returns active menus with nested items for the public header.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === '1';
    const slug = searchParams.get('slug') || '';

    const where: Record<string, unknown> = {};
    if (isPublic) where.isActive = true;
    if (slug) where.slug = slug;

    const menus = await db.menu.findMany({
      where,
      include: {
        items: {
          where: isPublic ? { isActive: true } : {},
          orderBy: { displayOrder: 'asc' },
          include: { children: { where: isPublic ? { isActive: true } : {}, orderBy: { displayOrder: 'asc' } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ menus });
  } catch (error) {
    console.error('Menus GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch menus' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error: 'Menu name required' }, { status: 400 });
    const slug = (body.slug || body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const menu = await db.menu.create({
      data: {
        name: body.name, slug, location: body.location || 'HEADER',
        designId: parseInt(body.designId) || 1, isActive: body.isActive !== false,
      },
    });
    return NextResponse.json({ menu, message: 'Menu created' }, { status: 201 });
  } catch (error) {
    console.error('Menus POST error:', error);
    return NextResponse.json({ error: 'Failed to create menu' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Update whole menu (design, active)
    if (!body.itemId) {
      const data: Record<string, unknown> = {};
      if (body.name) data.name = body.name;
      if (body.location) data.location = body.location;
      if (body.designId !== undefined) data.designId = parseInt(body.designId) || 1;
      if (body.isActive !== undefined) data.isActive = !!body.isActive;
      const menu = await db.menu.update({ where: { id: body.id }, data });
      return NextResponse.json({ menu, message: 'Menu updated' });
    }

    // Add or update a menu item: {id(menuId), itemId, label, url, moduleKey, parentId, isMega, megaColumns, megaImageUrl, megaDescription, iconKey, displayOrder, isActive, openInNewTab}
    const itemData: Record<string, unknown> = {
      menuId: body.id,
      label: body.label || 'Untitled',
      url: body.url || null,
      moduleKey: body.moduleKey || null,
      parentId: body.parentId || null,
      isMega: !!body.isMega,
      megaColumns: parseInt(body.megaColumns) || 2,
      megaImageUrl: body.megaImageUrl || null,
      megaDescription: body.megaDescription || '',
      iconKey: body.iconKey || null,
      displayOrder: parseInt(body.displayOrder) || 0,
      isActive: body.isActive !== false,
      openInNewTab: !!body.openInNewTab,
    };
    if (body.itemId) {
      const { menuId: _m, ...itemUpdate } = itemData;
      void _m;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = await db.menuItem.update({ where: { id: body.itemId }, data: itemUpdate as any });
      return NextResponse.json({ item, message: 'Menu item updated' });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = await db.menuItem.create({ data: itemData as any });
    return NextResponse.json({ item, message: 'Menu item added' }, { status: 201 });
  } catch (error) {
    console.error('Menus PUT error:', error);
    return NextResponse.json({ error: 'Failed to update menu' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const itemId = searchParams.get('itemId');
    if (itemId) {
      await db.menuItem.deleteMany({ where: { parentId: itemId } });
      await db.menuItem.delete({ where: { id: itemId } });
      return NextResponse.json({ message: 'Menu item deleted' });
    }
    if (id) {
      await db.menuItem.deleteMany({ where: { menuId: id } });
      await db.menu.delete({ where: { id } });
      return NextResponse.json({ message: 'Menu deleted' });
    }
    return NextResponse.json({ error: 'id or itemId required' }, { status: 400 });
  } catch (error) {
    console.error('Menus DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
