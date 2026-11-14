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
 * HOMEPAGE DESIGNS API — the 18 switchable homepage designs and their
 * widget compositions. public=1 returns the ACTIVE design + its widgets.
 * POST action=activate switches the site homepage instantly.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === '1';
    const siteSetting = await db.siteSetting.findUnique({ where: { id: 'main' } });
    const activeDesign = siteSetting?.activeHomepageDesign || 1;

    if (isPublic) {
      const design = await db.homepageDesign.findFirst({ where: { designKey: activeDesign } });
      if (design) {
        const widgets = await db.homepageWidget.findMany({
          where: { designId: design.id, isActive: true },
          orderBy: { displayOrder: 'asc' },
        });
        return NextResponse.json({ design, widgets, activeDesign });
      }
      return NextResponse.json({ design: null, widgets: [], activeDesign });
    }

    const designs = await db.homepageDesign.findMany({
      orderBy: { designKey: 'asc' },
      include: { widgets: { orderBy: { displayOrder: 'asc' } } },
    });
    return NextResponse.json({ designs, activeDesign });
  } catch (error) {
    console.error('Homepage-designs GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch homepage designs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const body = await request.json();

    // ── action: activate — switches the active homepage design ──
    if (body.action === 'activate' && body.designKey) {
      const designKey = parseInt(body.designKey);
      await db.siteSetting.upsert({
        where: { id: 'main' },
        create: { id: 'main', activeHomepageDesign: designKey },
        update: { activeHomepageDesign: designKey, updatedAt: new Date() },
      });
      await db.homepageDesign.updateMany({ data: { isActive: false } });
      await db.homepageDesign.updateMany({ where: { designKey }, data: { isActive: true } });
      await db.auditLog.create({
        data: {
          userId: user.id, action: 'HOMEPAGE_ACTIVATE', entityName: 'HomepageDesign', entityId: String(designKey),
          details: `Activated homepage design #${designKey}`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ message: `Homepage design #${designKey} activated`, activeHomepageDesign: designKey });
    }

    // ── action: sync-variants — applies the canonical HERO_VARIANT map to every
    //   design's HERO_SLIDER widget in the live DB. Idempotent — safe to re-run.
    //   Creates a HERO_SLIDER widget (at displayOrder 0) if none exists yet.
    if (body.action === 'sync-variants') {
      // Single source of truth — matches prisma/seed.ts and scripts/refine-homepages.js
      const HERO_VARIANT: Record<number, number> = {
        1:  1,   // Nairobi Hospital Classic  → Type A: fade + zoom + frosted box
        2:  4,   // Avenue Modern Care        → Type B: LTR + opaque bottom band
        3:  6,   // Karen Centres             → Type C: hero bg + framed image right
        4:  8,   // KNH Institutional         → Type D: diagonal + typewriter
        5:  2,   // Editorial Split           → Type A: LTR slide + zoom + frosted box
        6:  5,   // Bold Health Banner        → Type B: split-text + opaque bottom band
        7:  7,   // Magazine Health           → Type C: parallax + framed image right
        8:  9,   // Clinical Clarity          → Type D: diagonal + flip image right
        9:  3,   // Warm Community            → Type A: ken-burns + frosted box
        10: 11,  // Mega Department           → Type B: gradient opaque bottom band
        11: 13,  // App-first                 → Type D: diagonal teal split
        12: 6,   // Video Story               → Type C: hero bg + framed image right
        13: 10,  // Insurance & Trust         → Type A: blur + zoom + frosted box
        14: 14,  // Maternal Focus            → Type B: full-bleed + opaque bottom band
        15: 7,   // Diagnostics Lab           → Type C: parallax + framed image right
        16: 12,  // Pharmacy Retail           → carousel cards
        17: 8,   // Leadership Trust          → Type D: diagonal + typewriter
        18: 4,   // Booking-first             → Type B: LTR + opaque bottom band
      };

      const designs = await db.homepageDesign.findMany({ orderBy: { designKey: 'asc' } });
      const results: Array<{ designKey: number; name: string; sliderDesign: number; action: string }> = [];

      for (const d of designs) {
        const sliderDesign = HERO_VARIANT[d.designKey];
        if (!sliderDesign) continue; // unknown designKey — skip gracefully

        const updated = await db.homepageWidget.updateMany({
          where: { designId: d.id, moduleKey: 'HERO_SLIDER' },
          data: { variantId: sliderDesign },
        });

        if (updated.count > 0) {
          results.push({ designKey: d.designKey, name: d.name, sliderDesign, action: 'updated' });
        } else {
          // No HERO_SLIDER widget exists for this design yet — create one at the top
          await db.homepageWidget.create({
            data: {
              designId: d.id,
              moduleKey: 'HERO_SLIDER',
              variantId: sliderDesign,
              displayOrder: 0,
              isActive: true,
            },
          });
          results.push({ designKey: d.designKey, name: d.name, sliderDesign, action: 'created' });
        }
      }

      await db.auditLog.create({
        data: {
          userId: user.id, action: 'HOMEPAGE_SYNC_VARIANTS', entityName: 'HomepageWidget', entityId: 'all',
          details: `Synced HERO_SLIDER variantIds for ${results.length} homepage designs`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});

      return NextResponse.json({
        message: `Hero slider variants synced for ${results.length} homepage design(s)`,
        results,
      });
    }

    // ── Create a new homepage design ──
    if (body.name) {
      const design = await db.homepageDesign.create({
        data: {
          name: body.name,
          description: body.description || '',
          designKey: parseInt(body.designKey) || 1,
          previewUrl: body.previewUrl || '',
        },
      });
      return NextResponse.json({ design, message: 'Design created' }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Homepage-designs POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const body = await request.json();

    // Update widget
    if (body.widgetId) {
      const data: Record<string, unknown> = {};
      if (body.moduleKey) data.moduleKey = body.moduleKey;
      if (body.variantId !== undefined) data.variantId = parseInt(body.variantId) || 1;
      if (body.sectionTitle !== undefined) data.sectionTitle = body.sectionTitle;
      if (body.sectionSubtitle !== undefined) data.sectionSubtitle = body.sectionSubtitle;
      if (body.displayOrder !== undefined) data.displayOrder = parseInt(body.displayOrder) || 0;
      if (body.isActive !== undefined) data.isActive = !!body.isActive;
      if (body.widthColumns !== undefined) data.widthColumns = parseInt(body.widthColumns) || 12;
      if (body.backgroundColor !== undefined) data.backgroundColor = body.backgroundColor;
      if (body.customConfig !== undefined) data.customConfig = body.customConfig;
      const widget = await db.homepageWidget.update({ where: { id: body.widgetId }, data });
      return NextResponse.json({ widget, message: 'Widget updated' });
    }

    // Update design
    if (body.id) {
      const data: Record<string, unknown> = {};
      if (body.name) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.previewUrl !== undefined) data.previewUrl = body.previewUrl;
      const design = await db.homepageDesign.update({ where: { id: body.id }, data });
      return NextResponse.json({ design, message: 'Design updated' });
    }

    return NextResponse.json({ error: 'widgetId or id required' }, { status: 400 });
  } catch (error) {
    console.error('Homepage-designs PUT error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const widgetId = searchParams.get('widgetId');
    const id = searchParams.get('id');
    if (widgetId) {
      await db.homepageWidget.delete({ where: { id: widgetId } });
      return NextResponse.json({ message: 'Widget removed' });
    }
    if (id) {
      await db.homepageWidget.deleteMany({ where: { designId: id } });
      await db.homepageDesign.delete({ where: { id } });
      return NextResponse.json({ message: 'Design deleted' });
    }
    return NextResponse.json({ error: 'id or widgetId required' }, { status: 400 });
  } catch (error) {
    console.error('Homepage-designs DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
