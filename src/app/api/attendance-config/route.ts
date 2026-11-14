import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * ATTENDANCE-CONFIG API — AttendanceConfig key/value settings
 * (facility_ip, allowed_latitude, allowed_longitude, radius_meters) used by
 * the PWA check-in GPS zone validation.
 * GET: ADMIN/HR. PUT: ADMIN only. Bulk upsert via {settings: {key: value}}.
 */

const HR_ROLES = ['ADMIN', 'HR'];
const ALLOWED_KEYS = ['facility_ip', 'allowed_latitude', 'allowed_longitude', 'radius_meters'];

// GET /api/attendance-config — all attendance settings
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const configs = await db.attendanceConfig.findMany({ orderBy: { key: 'asc' } });
    return NextResponse.json({
      configs: configs.map(c => ({ key: c.key, value: c.value })),
    });
  } catch (error) {
    console.error('Attendance-config GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance settings' }, { status: 500 });
  }
}

// PUT /api/attendance-config — bulk upsert {settings: {…}} (ADMIN only)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
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

    // Restrict to known attendance settings keys
    rawSettings = Object.fromEntries(Object.entries(rawSettings).filter(([k]) => ALLOWED_KEYS.includes(k)));
    if (Object.keys(rawSettings).length === 0) {
      return NextResponse.json(
        { error: `No valid settings provided — allowed keys: ${ALLOWED_KEYS.join(', ')}` },
        { status: 400 },
      );
    }

    // Sequential upsert to avoid SQLite concurrent write issues (company route pattern)
    let updated = 0;
    for (const [key, value] of Object.entries(rawSettings)) {
      await db.attendanceConfig.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      updated++;
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'ATTENDANCE_CONFIG_UPDATE', entityName: 'AttendanceConfig',
        details: `Updated ${updated} attendance settings (${Object.keys(rawSettings).join(', ')})`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ updated, message: `${updated} attendance setting(s) saved` });
  } catch (error) {
    console.error('Attendance-config PUT error:', error);
    return NextResponse.json({ error: 'Failed to update attendance settings' }, { status: 500 });
  }
}
