import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination, getDateFilter } from '@/lib/api';

/**
 * CALLS API — facility call log (CallRecord).
 * Instruction 27 — Front Desk calls module.
 *
 * GET    ?direction=IN|OUT|MISSED&category=&search=&date filters → paginated log
 * POST   {direction, callerName, callerPhone, regarding, category, durationSec, notes, callTime?}
 * PUT    {id, ...fields} → edit a log entry
 * DELETE ?id= → remove a log entry
 *
 * Roles: ADMIN, RECEPTIONIST, DOCTOR, NURSE.
 */

const CALL_ROLES = ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'];
const DIRECTIONS = ['IN', 'OUT', 'MISSED'];
const CATEGORIES = ['GENERAL', 'APPOINTMENT', 'INQUIRY', 'COMPLAINT', 'FOLLOWUP', 'EMERGENCY'];

/** Map of userId → display name (handler resolution). */
async function resolveUserNames(ids: Array<string>): Promise<Record<string, string>> {
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (clean.length === 0) return {};
  const users = await db.user.findMany({
    where: { id: { in: clean } },
    select: { id: true, firstName: true, lastName: true, username: true },
  }).catch(() => []);
  const map: Record<string, string> = {};
  for (const u of users) {
    const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    map[u.id] = full || u.username;
  }
  return map;
}

// GET /api/calls — log with filters
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, CALL_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const direction = (searchParams.get('direction') || '').toUpperCase();
    const category = (searchParams.get('category') || '').toUpperCase();
    const search = (searchParams.get('search') || '').trim();

    const where: Record<string, unknown> = {};
    if (direction && DIRECTIONS.includes(direction)) where.direction = direction;
    if (category && CATEGORIES.includes(category)) where.category = category;
    const dateFilter = getDateFilter(searchParams);
    if (Object.keys(dateFilter).length > 0) where.callTime = dateFilter;
    if (search) {
      where.OR = [
        { callerName: { contains: search } },
        { callerPhone: { contains: search } },
        { regarding: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    const [calls, total, todayCount] = await Promise.all([
      db.callRecord.findMany({ where, orderBy: { callTime: 'desc' }, skip, take: perPage }),
      db.callRecord.count({ where }),
      db.callRecord.count({
        where: {
          callTime: {
            gte: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })(),
          },
        },
      }),
    ]);

    const names = await resolveUserNames(calls.map(c => c.handledById));
    const withNames = calls.map(c => ({ ...c, handledByName: names[c.handledById] || '' }));

    return NextResponse.json({ calls: withNames, total, page, perPage, totalPages: Math.ceil(total / perPage), todayCount });
  } catch (error) {
    console.error('Calls GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch call log' }, { status: 500 });
  }
}

// POST /api/calls — log a call
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, CALL_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const direction = String(body.direction || 'IN').toUpperCase();
    const category = String(body.category || 'GENERAL').toUpperCase();
    const callerPhone = String(body.callerPhone || '').trim();
    const callerName = String(body.callerName || '').trim();

    if (!DIRECTIONS.includes(direction)) {
      return NextResponse.json({ error: `direction must be one of: ${DIRECTIONS.join(', ')}` }, { status: 400 });
    }
    if (!CATEGORIES.includes(category)) {
      return NextResponse.json({ error: `category must be one of: ${CATEGORIES.join(', ')}` }, { status: 400 });
    }
    if (!callerPhone && !callerName) {
      return NextResponse.json({ error: 'Provide a caller phone number or name' }, { status: 400 });
    }

    const durationSec = Math.max(0, parseInt(String(body.durationSec ?? '0'), 10) || 0);
    const callTime = body.callTime ? new Date(String(body.callTime)) : new Date();

    const call = await db.callRecord.create({
      data: {
        direction,
        callerName,
        callerPhone,
        regarding: String(body.regarding || '').trim(),
        category,
        durationSec,
        notes: String(body.notes || '').trim(),
        handledById: auth.user.id,
        callTime: isNaN(callTime.getTime()) ? new Date() : callTime,
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'CALL_LOG_CREATE',
        entityName: 'CallRecord',
        entityId: call.id,
        details: `${direction} call ${callerPhone || callerName}${call.regarding ? ` — ${call.regarding}` : ''} (${category})`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ call, message: 'Call logged' }, { status: 201 });
  } catch (error) {
    console.error('Calls POST error:', error);
    return NextResponse.json({ error: 'Failed to log call' }, { status: 500 });
  }
}

// PUT /api/calls — update a log entry
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, CALL_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.callRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Call record not found' }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.direction !== undefined) {
      const direction = String(body.direction || '').toUpperCase();
      if (!DIRECTIONS.includes(direction)) {
        return NextResponse.json({ error: `direction must be one of: ${DIRECTIONS.join(', ')}` }, { status: 400 });
      }
      data.direction = direction;
    }
    if (body.category !== undefined) {
      const category = String(body.category || '').toUpperCase();
      if (!CATEGORIES.includes(category)) {
        return NextResponse.json({ error: `category must be one of: ${CATEGORIES.join(', ')}` }, { status: 400 });
      }
      data.category = category;
    }
    if (body.callerName !== undefined) data.callerName = String(body.callerName || '').trim();
    if (body.callerPhone !== undefined) data.callerPhone = String(body.callerPhone || '').trim();
    if (body.regarding !== undefined) data.regarding = String(body.regarding || '').trim();
    if (body.notes !== undefined) data.notes = String(body.notes || '').trim();
    if (body.durationSec !== undefined) {
      data.durationSec = Math.max(0, parseInt(String(body.durationSec), 10) || 0);
    }
    if (body.callTime !== undefined) {
      const t = new Date(String(body.callTime));
      if (!isNaN(t.getTime())) data.callTime = t;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const call = await db.callRecord.update({ where: { id }, data });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'CALL_LOG_UPDATE',
        entityName: 'CallRecord',
        entityId: id,
        details: `Updated call log ${call.callerPhone || call.callerName}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ call, message: 'Call log updated' });
  } catch (error) {
    console.error('Calls PUT error:', error);
    return NextResponse.json({ error: 'Failed to update call log' }, { status: 500 });
  }
}

// DELETE /api/calls?id= — remove a log entry
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, CALL_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.callRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Call record not found' }, { status: 404 });

    await db.callRecord.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'CALL_LOG_DELETE',
        entityName: 'CallRecord',
        entityId: id,
        details: `Deleted call log ${existing.callerPhone || existing.callerName}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Call log deleted' });
  } catch (error) {
    console.error('Calls DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete call log' }, { status: 500 });
  }
}
