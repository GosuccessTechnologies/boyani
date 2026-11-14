import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination, getDateFilter } from '@/lib/api';

/**
 * PARCELS API — receiving & dispatch log (ParcelRecord).
 * Instruction 27 — Front Desk parcels module.
 *
 * GET    ?type=RECEIVED|DISPATCHED&status=&search=&date filters → paginated list
 * POST   {type, description, sender/receiver, courier, status?, notes}
 *        → auto tracking code PRC-XXXXXX (received) / DSP-XXXXXX (dispatched)
 * PUT    {id, status?, notes?} → advance status / update notes
 * DELETE ?id= → remove a record
 *
 * Roles: ADMIN, RECEPTIONIST.
 */

const PARCEL_ROLES = ['ADMIN', 'RECEPTIONIST'];
const PARCEL_TYPES = ['RECEIVED', 'DISPATCHED'];
const PARCEL_STATUSES = ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'COLLECTED', 'RETURNED'];

/** Next sequential tracking code: PRC-000001 / DSP-000001 … */
async function generateTrackingCode(type: string): Promise<string> {
  const prefix = type === 'DISPATCHED' ? 'DSP' : 'PRC';
  const latest = await db.parcelRecord.findFirst({
    where: { trackingCode: { startsWith: `${prefix}-` } },
    orderBy: { createdAt: 'desc' },
    select: { trackingCode: true },
  }).catch(() => null);
  let nextNum = 1;
  if (latest?.trackingCode) {
    const parts = latest.trackingCode.split('-');
    const parsed = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }
  return `${prefix}-${String(nextNum).padStart(6, '0')}`;
}

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

// GET /api/parcels — list with filters
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, PARCEL_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const type = (searchParams.get('type') || '').toUpperCase();
    const status = (searchParams.get('status') || '').toUpperCase();
    const search = (searchParams.get('search') || '').trim();

    const where: Record<string, unknown> = {};
    if (type && PARCEL_TYPES.includes(type)) where.type = type;
    if (status && PARCEL_STATUSES.includes(status)) where.status = status;
    const dateFilter = getDateFilter(searchParams);
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
    if (search) {
      where.OR = [
        { trackingCode: { contains: search } },
        { description: { contains: search } },
        { senderName: { contains: search } },
        { receiverName: { contains: search } },
        { courier: { contains: search } },
        { senderPhone: { contains: search } },
        { receiverPhone: { contains: search } },
      ];
    }

    const [parcels, total, pendingCount] = await Promise.all([
      db.parcelRecord.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: perPage }),
      db.parcelRecord.count({ where }),
      db.parcelRecord.count({ where: { status: { in: ['PENDING', 'IN_TRANSIT'] } } }),
    ]);

    const names = await resolveUserNames(parcels.map(p => p.handledById));
    const withNames = parcels.map(p => ({ ...p, handledByName: names[p.handledById] || '' }));

    return NextResponse.json({ parcels: withNames, total, page, perPage, totalPages: Math.ceil(total / perPage), pendingCount });
  } catch (error) {
    console.error('Parcels GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch parcels' }, { status: 500 });
  }
}

// POST /api/parcels — receive / dispatch a parcel
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, PARCEL_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const type = String(body.type || 'RECEIVED').toUpperCase();
    if (!PARCEL_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${PARCEL_TYPES.join(', ')}` }, { status: 400 });
    }
    const status = String(body.status || 'PENDING').toUpperCase();
    if (!PARCEL_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${PARCEL_STATUSES.join(', ')}` }, { status: 400 });
    }
    if (type === 'RECEIVED' && !String(body.senderName || '').trim() && !String(body.description || '').trim()) {
      return NextResponse.json({ error: 'Provide a sender name or description for a received parcel' }, { status: 400 });
    }
    if (type === 'DISPATCHED' && !String(body.receiverName || '').trim() && !String(body.description || '').trim()) {
      return NextResponse.json({ error: 'Provide a receiver name or description for a dispatched parcel' }, { status: 400 });
    }

    const trackingCode = await generateTrackingCode(type);
    const parcel = await db.parcelRecord.create({
      data: {
        trackingCode,
        type,
        description: String(body.description || '').trim(),
        senderName: String(body.senderName || '').trim(),
        senderPhone: String(body.senderPhone || '').trim(),
        senderAddress: String(body.senderAddress || '').trim(),
        receiverName: String(body.receiverName || '').trim(),
        receiverPhone: String(body.receiverPhone || '').trim(),
        receiverAddress: String(body.receiverAddress || '').trim(),
        courier: String(body.courier || '').trim(),
        status,
        notes: String(body.notes || '').trim(),
        handledById: auth.user.id,
        handledAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'PARCEL_CREATE',
        entityName: 'ParcelRecord',
        entityId: parcel.id,
        details: `${type} parcel ${trackingCode}${parcel.courier ? ` via ${parcel.courier}` : ''} — ${parcel.description || parcel.senderName || parcel.receiverName}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ parcel, message: `Parcel logged — ${trackingCode}` }, { status: 201 });
  } catch (error) {
    console.error('Parcels POST error:', error);
    return NextResponse.json({ error: 'Failed to log parcel' }, { status: 500 });
  }
}

// PUT /api/parcels — update status / notes
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, PARCEL_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.parcelRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });

    const data: Record<string, unknown> = {};
    let status = '';
    if (body.status !== undefined) {
      status = String(body.status || '').toUpperCase();
      if (!PARCEL_STATUSES.includes(status)) {
        return NextResponse.json({ error: `status must be one of: ${PARCEL_STATUSES.join(', ')}` }, { status: 400 });
      }
      data.status = status;
      // status change re-assigns the handler timestamp
      data.handledById = auth.user.id;
      data.handledAt = new Date();
    }
    if (body.notes !== undefined) data.notes = String(body.notes || '').trim();

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update — provide status and/or notes' }, { status: 400 });
    }

    const parcel = await db.parcelRecord.update({ where: { id }, data });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'PARCEL_UPDATE',
        entityName: 'ParcelRecord',
        entityId: id,
        details: `${existing.trackingCode}${status && status !== existing.status ? ` status ${existing.status} → ${status}` : ''}${body.notes !== undefined ? ' · notes updated' : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ parcel, message: status ? `${existing.trackingCode} → ${status}` : 'Notes updated' });
  } catch (error) {
    console.error('Parcels PUT error:', error);
    return NextResponse.json({ error: 'Failed to update parcel' }, { status: 500 });
  }
}

// DELETE /api/parcels?id= — remove a record
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, PARCEL_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.parcelRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });

    await db.parcelRecord.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'PARCEL_DELETE',
        entityName: 'ParcelRecord',
        entityId: id,
        details: `Deleted ${existing.type} parcel ${existing.trackingCode}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: `Parcel ${existing.trackingCode} deleted` });
  } catch (error) {
    console.error('Parcels DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete parcel' }, { status: 500 });
  }
}
