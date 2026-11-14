import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * LAB TESTS API — laboratory catalog (test menu) — Instruction 24.
 * The catalog is SYNCED from Facility Services (Service.category=LABORATORY):
 * every GET upserts a LabTest row per service (code/name/serviceId from the
 * service, specimen defaulting to 'Blood'), so pricing always matches the
 * facility price list. Specimen/turnaround/reference-range stay lab-managed
 * (ADMIN-editable via PUT); prices live ONLY on the linked Service.
 * GET is open to all staff (doctors order tests, lab techs run them,
 * cashiers see pricing).
 */

const STAFF_ROLES = ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'CASHIER'];

/**
 * Sync LabTest rows from Service(category=LABORATORY).
 * - Upsert by code: keeps lab-managed fields (specimen/turnaround/reference)
 *   intact while refreshing name/serviceId/active from the service.
 * - Creates with specimen default 'Blood'.
 * - Deactivates LabTests whose linked service is missing or inactive.
 * Returns the number of services synced.
 */
async function syncCatalogFromServices(): Promise<number> {
  const services = await db.service.findMany({ where: { category: 'LABORATORY' } });
  for (const s of services) {
    await db.labTest.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        serviceId: s.id,
        isActive: s.isActive,
      },
      create: {
        code: s.code,
        name: s.name,
        serviceId: s.id,
        specimenType: 'Blood',
        turnaroundHours: Math.max(1, Math.round(s.durationMin / 60)) || 24,
        isActive: s.isActive,
      },
    }).catch(() => null);
  }
  // Retire catalog rows whose service disappeared or was deactivated
  const activeCodes = new Set(services.filter(s => s.isActive).map(s => s.code));
  const stale = await db.labTest.findMany({ where: { serviceId: { not: null } }, select: { id: true, code: true, isActive: true } });
  for (const t of stale) {
    if (!activeCodes.has(t.code) && t.isActive) {
      await db.labTest.update({ where: { id: t.id }, data: { isActive: false } }).catch(() => null);
    }
  }
  return services.length;
}

// GET /api/lab-tests — SYNCs catalog from Service(category=LABORATORY), then lists
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, STAFF_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 30);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const labTest = await db.labTest.findUnique({
        where: { id },
        include: { service: true, _count: { select: { orderItems: true } } },
      });
      if (!labTest) return NextResponse.json({ error: 'Lab test not found' }, { status: 404 });
      return NextResponse.json({ labTest });
    }

    // Instruction 24 — derive the catalog from facility services (pricing consistency)
    const syncedServices = await syncCatalogFromServices().catch(() => 0);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ];
    }
    if (category) where.category = category;

    const [labTests, total] = await Promise.all([
      db.labTest.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { name: 'asc' }],
        skip, take: perPage,
        include: { service: { select: { id: true, code: true, name: true, price: true, shaCovered: true, isActive: true } } },
      }),
      db.labTest.count({ where }),
    ]);

    return NextResponse.json({
      labTests, items: labTests, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
      syncedFromServices: syncedServices,
    });
  } catch (error) {
    console.error('Lab tests GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch lab tests' }, { status: 500 });
  }
}

// POST /api/lab-tests — add catalog test (or bulk import); pricing lives on the linked Service
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { bulkItems, ...data } = body;

    // Bulk CSV import
    if (bulkItems && Array.isArray(bulkItems) && bulkItems.length > 0) {
      let created = 0;
      for (const b of bulkItems) {
        if (!b.name) continue;
        const code = b.code || `LT-${Date.now().toString(36).toUpperCase()}`;
        await db.labTest.create({
          data: {
            code,
            name: b.name,
            serviceId: b.serviceId || null,
            category: b.category || 'HEMATOLOGY',
            specimenType: b.specimenType || 'Blood',
            turnaroundHours: parseInt(b.turnaroundHours) || 24,
            referenceRange: b.referenceRange || '',
          },
        }).catch(() => null);
        created++;
      }
      return NextResponse.json({ imported: created });
    }

    if (!data.name) {
      return NextResponse.json({ error: 'Test name is required' }, { status: 400 });
    }

    const code = data.code || `LT-${Date.now().toString(36).toUpperCase()}`;
    const clash = await db.labTest.findUnique({ where: { code } }).catch(() => null);
    if (clash) return NextResponse.json({ error: `Code ${code} already exists` }, { status: 400 });

    const labTest = await db.labTest.create({
      data: {
        code,
        name: data.name,
        serviceId: data.serviceId || null,
        category: data.category || 'HEMATOLOGY',
        specimenType: data.specimenType || 'Blood',
        turnaroundHours: parseInt(data.turnaroundHours) || 24,
        referenceRange: data.referenceRange || '',
        isActive: data.isActive !== undefined ? !!data.isActive : true,
      },
      include: { service: true },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'LABTEST_CREATE', entityName: 'LabTest', entityId: labTest.id,
        details: `Lab test ${labTest.code} — ${labTest.name}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ labTest, message: `Lab test ${labTest.code} created` }, { status: 201 });
  } catch (error) {
    console.error('Lab tests POST error:', error);
    return NextResponse.json({ error: 'Failed to create lab test' }, { status: 500 });
  }
}

// PUT /api/lab-tests — update catalog entry (incl. serviceId pricing link)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Lab test ID required' }, { status: 400 });

    const existing = await db.labTest.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Lab test not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.code && data.code !== existing.code) {
      const clash = await db.labTest.findUnique({ where: { code: data.code } }).catch(() => null);
      if (clash) return NextResponse.json({ error: `Code ${data.code} already exists` }, { status: 400 });
      updateData.code = data.code;
    }
    if (data.serviceId !== undefined) updateData.serviceId = data.serviceId || null;
    if (data.category) updateData.category = data.category;
    if (data.specimenType) updateData.specimenType = data.specimenType;
    if (data.turnaroundHours !== undefined) updateData.turnaroundHours = parseInt(data.turnaroundHours) || existing.turnaroundHours;
    if (data.referenceRange !== undefined) updateData.referenceRange = data.referenceRange;
    if (data.isActive !== undefined) updateData.isActive = !!data.isActive;

    const labTest = await db.labTest.update({ where: { id }, data: updateData, include: { service: true } });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'LABTEST_UPDATE', entityName: 'LabTest', entityId: id,
        details: `Lab test ${existing.code} updated`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ labTest, message: 'Lab test updated' });
  } catch (error) {
    console.error('Lab tests PUT error:', error);
    return NextResponse.json({ error: 'Failed to update lab test' }, { status: 500 });
  }
}

// DELETE /api/lab-tests?id= — soft-remove from catalog (history stays intact)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Lab test ID required' }, { status: 400 });

    const existing = await db.labTest.findUnique({
      where: { id },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Lab test not found' }, { status: 404 });

    if (existing._count.orderItems > 0) {
      // Used in orders — deactivate instead of hard delete (FK safety)
      await db.labTest.update({ where: { id }, data: { isActive: false } });
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'LABTEST_DEACTIVATE', entityName: 'LabTest', entityId: id,
          details: `Lab test ${existing.code} deactivated (used by ${existing._count.orderItems} order items)`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ message: `Lab test ${existing.code} is referenced by past orders — deactivated instead of deleted` });
    }

    await db.labTest.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'LABTEST_DELETE', entityName: 'LabTest', entityId: id,
        details: `Lab test ${existing.code} deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Lab test deleted' });
  } catch (error) {
    console.error('Lab tests DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete lab test' }, { status: 500 });
  }
}
