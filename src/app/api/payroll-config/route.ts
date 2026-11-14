import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * PAYROLL-CONFIG API — PayrollConfig key/value settings
 * (PAYE bands, NSSF cap, SHIF tiers, housing levy %, paye relief…).
 * GET/PUT guarded to ADMIN + HR. Bulk upsert via {settings: {key: value}}.
 */

const HR_ROLES = ['ADMIN', 'HR'];

// GET /api/payroll-config — all payroll settings
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const configs = await db.payrollConfig.findMany({ orderBy: { key: 'asc' } });
    return NextResponse.json({
      configs: configs.map(c => ({ key: c.key, value: c.value, description: c.description })),
    });
  } catch (error) {
    console.error('Payroll-config GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch payroll settings' }, { status: 500 });
  }
}

// PUT /api/payroll-config — bulk upsert {settings: {key: value}} (or single {key, value})
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    let rawSettings: Record<string, string> = {};

    if (body.key && body.value !== undefined) {
      rawSettings[String(body.key)] = String(body.value);
    } else if (body.settings && typeof body.settings === 'object') {
      for (const [key, value] of Object.entries(body.settings)) {
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue;
        rawSettings[key] = String(value);
      }
    } else {
      return NextResponse.json({ error: 'Provide {key, value} or {settings: {...}}' }, { status: 400 });
    }

    if (Object.keys(rawSettings).length === 0) {
      return NextResponse.json({ error: 'No valid settings provided' }, { status: 400 });
    }

    // Sequential upsert to avoid SQLite concurrent write issues (company route pattern)
    let updated = 0;
    for (const [key, value] of Object.entries(rawSettings)) {
      await db.payrollConfig.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      updated++;
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'PAYROLL_CONFIG_UPDATE', entityName: 'PayrollConfig',
        details: `Updated ${updated} payroll settings (${Object.keys(rawSettings).join(', ')})`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ updated, message: `${updated} payroll setting(s) saved` });
  } catch (error) {
    console.error('Payroll-config PUT error:', error);
    return NextResponse.json({ error: 'Failed to update payroll settings' }, { status: 500 });
  }
}
