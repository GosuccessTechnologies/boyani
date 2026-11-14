import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination, getDateFilter } from '@/lib/api';

/**
 * ATTENDANCE API — PWA check-in/check-out with GPS zone validation.
 *
 * GET: any authenticated user — ?tab=my returns own records (date range /
 *      month filters); ADMIN/HR without tab see all records (+ employee search).
 *      Every row carries a server-resolved `employeeName` (employee relation →
 *      Employee(userId) secondary lookup → user account names) and records with
 *      a null employeeId are lazily backfilled when a matching Employee exists.
 * POST: any authenticated user — {action: 'check-in'|'check-out', latitude,
 *      longitude, device}. GPS coords are validated against the facility zone
 *      from AttendanceConfig (allowed_latitude/allowed_longitude/radius_meters);
 *      missing coords (desktop) are allowed but flagged {gpsSkipped: true}.
 * PUT: ADMIN/HR — correct records (status, notes, check-in/out times).
 *
 * One record per user per day (unique [userId, date]) — date stored at midnight.
 */

const HR_ROLES = ['ADMIN', 'HR'];
const EMPLOYEE_SELECT = { id: true, employeeNo: true, firstName: true, lastName: true, department: true, userId: true } as const;
const USER_SELECT = { id: true, firstName: true, lastName: true, username: true } as const;

type EmployeeLite = { id: string; employeeNo: string; firstName: string; lastName: string; department: string; userId: string | null };
type UserLite = { id: string; firstName: string; lastName: string; username: string };

/**
 * Server-side display-name resolution for attendance rows.
 * AttendanceRecord.userId is a plain string (no Prisma relation to User), so
 * names are resolved with secondary lookups:
 *  1. the linked Employee relation (employeeId FK),
 *  2. an Employee whose userId matches the record's userId (legacy databases
 *     stored the username in Employee.userId — matched as a fallback),
 *  3. the User account names (firstName/lastName, else username).
 * Rows whose employeeId is null but which match an Employee get a lazy,
 * non-blocking employeeId backfill. Each returned row carries `employeeName`.
 */
async function resolveAttendanceNames<
  T extends { id: string; userId: string; employeeId: string | null; employee: EmployeeLite | null },
>(records: T[]): Promise<Array<T & { employee: EmployeeLite | null; employeeName: string }>> {
  const orphanUserIds = [...new Set(records.filter(r => !r.employee && r.userId).map(r => r.userId))];

  if (!orphanUserIds.length) {
    return records.map(r => ({
      ...r,
      employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}`.trim() : '',
    }));
  }

  // Secondary lookups: the user accounts behind the records + employees linked via userId
  const users = await db.user.findMany({ where: { id: { in: orphanUserIds } }, select: USER_SELECT });
  const userById = new Map<string, UserLite>(users.map(u => [u.id, u]));

  const employeeByUserId = new Map<string, EmployeeLite>();
  for (const e of await db.employee.findMany({ where: { userId: { in: orphanUserIds } }, select: EMPLOYEE_SELECT })) {
    employeeByUserId.set(e.userId as string, e);
  }
  // Legacy fallback — Employee.userId holding the account username instead of the id
  const unmatched = users.filter(u => !employeeByUserId.has(u.id));
  if (unmatched.length) {
    const byUsername = await db.employee.findMany({
      where: { userId: { in: unmatched.map(u => u.username) } },
      select: EMPLOYEE_SELECT,
    });
    for (const e of byUsername) {
      const u = unmatched.find(x => x.username === e.userId);
      if (u && !employeeByUserId.has(u.id)) employeeByUserId.set(u.id, e);
    }
  }

  return records.map(r => {
    const linked = r.employee || (r.userId ? employeeByUserId.get(r.userId) : undefined) || null;
    const u = r.userId ? userById.get(r.userId) : undefined;
    const employeeName = linked
      ? `${linked.firstName} ${linked.lastName}`.trim()
      : u ? `${u.firstName} ${u.lastName}`.trim() || u.username : '';

    if (!r.employeeId && linked) {
      // Lazy backfill — link the record to its Employee (non-blocking, idempotent)
      db.attendanceRecord.update({ where: { id: r.id }, data: { employeeId: linked.id } }).catch(() => {});
    }

    return { ...r, employee: linked, employeeName };
  });
}

/** Great-circle distance in metres (haversine) */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function midnightOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// GET /api/attendance — ?tab=my own records; ADMIN/HR all records; ?id= single
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request); // any authenticated user
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 31);
    const tab = searchParams.get('tab') || '';
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const month = searchParams.get('month') || '';
    const id = searchParams.get('id') || '';
    const isHRView = HR_ROLES.includes(auth.user.role) && tab !== 'my';

    // Single record
    if (id) {
      const record = await db.attendanceRecord.findUnique({
        where: { id },
        include: { employee: { select: EMPLOYEE_SELECT } },
      });
      if (!record) return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
      const [row] = await resolveAttendanceNames([record]);
      return NextResponse.json({ record: row });
    }

    const where: Record<string, unknown> = {};
    if (!isHRView) where.userId = auth.user.id;

    // Date filtering: month=YYYY-MM wins over specificDate/dateFrom/dateTo
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      where.date = { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) };
    } else {
      const dateFilter = getDateFilter(searchParams);
      if (Object.keys(dateFilter).length > 0) where.date = dateFilter;
    }

    if (status) where.status = status;
    if (isHRView && search) {
      where.OR = [
        {
          employee: {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { employeeNo: { contains: search } },
            ],
          },
        },
      ];
    }

    const [records, total] = await Promise.all([
      db.attendanceRecord.findMany({
        where,
        orderBy: [{ date: 'desc' }, { checkIn: 'desc' }],
        skip, take: perPage,
        include: { employee: { select: EMPLOYEE_SELECT } },
      }),
      db.attendanceRecord.count({ where }),
    ]);

    const rows = await resolveAttendanceNames(records);

    return NextResponse.json({
      records: rows, items: rows, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Attendance GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance records' }, { status: 500 });
  }
}

// POST /api/attendance — PWA check-in / check-out with GPS zone validation
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request); // any authenticated staff
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { action, latitude, longitude, device } = body;

    if (action !== 'check-in' && action !== 'check-out') {
      return NextResponse.json({ error: "action must be 'check-in' or 'check-out'" }, { status: 400 });
    }

    // Facility GPS zone from AttendanceConfig (defaults: Nairobi CBD, 200m)
    const cfgRows = await db.attendanceConfig.findMany({
      where: { key: { in: ['allowed_latitude', 'allowed_longitude', 'radius_meters'] } },
    });
    const cfg: Record<string, string> = {};
    for (const r of cfgRows) cfg[r.key] = r.value;
    const facilityLat = parseFloat(cfg.allowed_latitude || '-1.2921');
    const facilityLng = parseFloat(cfg.allowed_longitude || '36.8219');
    const radiusMeters = parseFloat(cfg.radius_meters || '200') || 200;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const hasGps = isFinite(lat) && isFinite(lng);

    let gpsSkipped = false;
    if (hasGps) {
      const distance = haversineMeters(facilityLat, facilityLng, lat, lng);
      if (distance > radiusMeters) {
        return NextResponse.json(
          { error: `You are outside the facility GPS zone (${Math.round(distance)}m away)` },
          { status: 400 },
        );
      }
    } else {
      gpsSkipped = true; // desktop check-in without geolocation
    }

    const now = new Date();
    const today = midnightOf(now);

    // Link the employee record (for HR reporting) when one is tied to this account
    const employee = await db.employee.findFirst({ where: { userId: auth.user.id } }).catch(() => null);

    if (action === 'check-in') {
      const existing = await db.attendanceRecord.findUnique({
        where: { userId_date: { userId: auth.user.id, date: today } },
      });
      if (existing && existing.checkIn) {
        return NextResponse.json({ error: 'Already checked in today' }, { status: 400 });
      }

      const status = now.getHours() >= 9 ? 'LATE' : 'PRESENT';
      const created = await db.attendanceRecord.upsert({
        where: { userId_date: { userId: auth.user.id, date: today } },
        create: {
          userId: auth.user.id,
          employeeId: employee?.id || null, // nullable — empty string would violate the Employee FK
          date: today,
          checkIn: now,
          checkInLat: hasGps ? lat : null,
          checkInLng: hasGps ? lng : null,
          checkInDevice: device || '',
          status,
        },
        update: {
          employeeId: employee?.id || existing?.employeeId || null, // nullable — empty string would violate the Employee FK
          checkIn: now,
          checkInLat: hasGps ? lat : null,
          checkInLng: hasGps ? lng : null,
          checkInDevice: device || '',
          status,
        },
        include: { employee: { select: EMPLOYEE_SELECT } },
      });
      const record = (await resolveAttendanceNames([created]))[0];

      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'ATTENDANCE_CHECK_IN', entityName: 'AttendanceRecord', entityId: record.id,
          details: `Check-in ${now.toISOString()} (${status}${gpsSkipped ? ', GPS skipped' : ''}) by ${auth.user.username}`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});

      return NextResponse.json({
        record, gpsSkipped,
        message: `Checked in at ${now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })} — ${status}`,
      });
    }

    // check-out
    const existing = await db.attendanceRecord.findUnique({
      where: { userId_date: { userId: auth.user.id, date: today } },
    });
    if (!existing || !existing.checkIn) {
      return NextResponse.json({ error: 'No check-in found for today' }, { status: 400 });
    }
    if (existing.checkOut) {
      return NextResponse.json({ error: 'Already checked out today' }, { status: 400 });
    }

    const workHours = Math.round(((now.getTime() - new Date(existing.checkIn).getTime()) / 3600000) * 100) / 100;
    const updated = await db.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        checkOutLat: hasGps ? lat : null,
        checkOutLng: hasGps ? lng : null,
        workHours,
      },
      include: { employee: { select: EMPLOYEE_SELECT } },
    });
    const record = (await resolveAttendanceNames([updated]))[0];

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'ATTENDANCE_CHECK_OUT', entityName: 'AttendanceRecord', entityId: record.id,
        details: `Check-out ${now.toISOString()} — ${workHours}h worked${gpsSkipped ? ', GPS skipped' : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({
      record, gpsSkipped, workHours,
      message: `Checked out — ${workHours}h worked today`,
    });
  } catch (error) {
    console.error('Attendance POST error:', error);
    return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 });
  }
}

// PUT /api/attendance — ADMIN/HR correction of records (status, notes, check-in/out)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, status, notes, checkIn, checkOut } = body;
    if (!id) return NextResponse.json({ error: 'Attendance record ID required' }, { status: 400 });

    const existing = await db.attendanceRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (checkIn !== undefined) updateData.checkIn = checkIn ? new Date(checkIn) : null;
    if (checkOut !== undefined) updateData.checkOut = checkOut ? new Date(checkOut) : null;

    // Recompute work hours when both timestamps are known
    const mergedIn = updateData.checkIn !== undefined ? (updateData.checkIn as Date | null) : existing.checkIn;
    const mergedOut = updateData.checkOut !== undefined ? (updateData.checkOut as Date | null) : existing.checkOut;
    if (mergedIn && mergedOut) {
      updateData.workHours = Math.round(((new Date(mergedOut).getTime() - new Date(mergedIn).getTime()) / 3600000) * 100) / 100;
    }

    const updatedRecord = await db.attendanceRecord.update({
      where: { id },
      data: updateData,
      include: { employee: { select: EMPLOYEE_SELECT } },
    });
    const record = (await resolveAttendanceNames([updatedRecord]))[0];

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'ATTENDANCE_CORRECT', entityName: 'AttendanceRecord', entityId: id,
        details: `Record for ${existing.date.toISOString().slice(0, 10)} corrected${status ? ` — status → ${status}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ record, message: 'Attendance record corrected' });
  } catch (error) {
    console.error('Attendance PUT error:', error);
    return NextResponse.json({ error: 'Failed to correct attendance record' }, { status: 500 });
  }
}
