import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * SITE SETTINGS API — global site state (active homepage/header/footer/menu
 * designs, page layout, SEO defaults). public=1 read works without auth.
 */

const SETTING_FIELDS = [
  'activeHomepageDesign', 'activeHeaderDesign', 'activeFooterDesign',
  'activeMenuDesign', 'activeBreadcrumbDesign', 'activeHeroDesign',
  'activeLoginDesign',
  'pageLayout', 'defaultSeoTitle', 'defaultSeoDescription',
] as const;

export async function GET(request: NextRequest) {
  try {
    const setting = await db.siteSetting.findUnique({ where: { id: 'main' } });
    if (!setting) {
      const created = await db.siteSetting.create({ data: { id: 'main' } });
      return NextResponse.json({ setting: created });
    }
    return NextResponse.json({ setting });
  } catch (error) {
    console.error('Site-settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch site settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};
    for (const f of SETTING_FIELDS) {
      if (body[f] === undefined) continue;
      if (f.startsWith('active')) data[f] = parseInt(body[f]) || 1;
      else data[f] = String(body[f]);
    }

    const setting = await db.siteSetting.upsert({
      where: { id: 'main' },
      create: { id: 'main', ...data },
      update: { ...data, updatedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'SITE_SETTING_UPDATE', entityName: 'SiteSetting', entityId: 'main',
        details: `Updated: ${Object.keys(data).join(', ')}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ setting, message: 'Site settings updated' });
  } catch (error) {
    console.error('Site-settings PUT error:', error);
    return NextResponse.json({ error: 'Failed to update site settings' }, { status: 500 });
  }
}
