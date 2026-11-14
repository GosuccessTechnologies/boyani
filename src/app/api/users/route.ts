import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';
import { createHash, randomBytes } from 'crypto';

function hashPassword(p: string) { return createHash('sha256').update(p).digest('hex'); }

// GET /api/users — ADMIN: all users; others: forbidden
//   ?loginHistory=<userId> → paginated UserLoginHistory for one user (newest first)
//   ?loginHistory=all      → login history across all users (with user names)
//   Optional ?lhFrom=&lhTo= (yyyy-mm-dd) date-range filters + ?lhAction= LOGIN|LOGOUT|FAILED
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);

    // ── Login history branch (Instruction 18a) ──
    const loginHistory = searchParams.get('loginHistory');
    if (loginHistory) {
      const lhFrom = searchParams.get('lhFrom') || '';
      const lhTo = searchParams.get('lhTo') || '';
      const lhAction = searchParams.get('lhAction') || '';

      const lhWhere: Record<string, unknown> = {};
      if (loginHistory !== 'all') lhWhere.userId = loginHistory;
      if (lhAction) lhWhere.action = lhAction;
      const loggedInAt: Record<string, unknown> = {};
      if (lhFrom) loggedInAt.gte = new Date(`${lhFrom}T00:00:00`);
      if (lhTo) loggedInAt.lte = new Date(`${lhTo}T23:59:59`);
      if (Object.keys(loggedInAt).length) lhWhere.loggedInAt = loggedInAt;

      const [history, total] = await Promise.all([
        db.userLoginHistory.findMany({
          where: lhWhere,
          include: { user: { select: { id: true, username: true, firstName: true, lastName: true, role: true } } },
          orderBy: { loggedInAt: 'desc' },
          skip, take: perPage,
        }),
        db.userLoginHistory.count({ where: lhWhere }),
      ]);
      return NextResponse.json({ history, total, page, perPage, totalPages: Math.ceil(total / perPage) });
    }

    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';

    const where: Record<string, unknown> = {};
    if (search) where.OR = [
      { username: { contains: search } }, { email: { contains: search } },
      { firstName: { contains: search } }, { lastName: { contains: search } },
    ];
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      db.user.findMany({
        where, select: { id: true, username: true, email: true, firstName: true, lastName: true, role: true, phone: true, avatarUrl: true, isActive: true, lastLogin: true, createdAt: true },
        orderBy: { createdAt: 'desc' }, skip, take: perPage,
      }),
      db.user.count({ where }),
    ]);
    return NextResponse.json({ users, total, page, perPage, totalPages: Math.ceil(total / perPage) });
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/users — create user (ADMIN)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    if (!body.username || !body.password || !body.role) {
      return NextResponse.json({ error: 'Username, password and role are required' }, { status: 400 });
    }
    const exists = await db.user.findFirst({ where: { OR: [{ username: body.username }, { email: body.email || body.username }] } });
    if (exists) return NextResponse.json({ error: 'Username or email already exists' }, { status: 400 });

    const user = await db.user.create({
      data: {
        username: body.username,
        email: body.email || `${body.username}@boyanihealth.africandivinechurch.org`,
        firstName: body.firstName || '',
        lastName: body.lastName || '',
        passwordHash: hashPassword(body.password),
        role: body.role,
        phone: body.phone || '',
        avatarUrl: body.avatarUrl || '',
        isActive: body.isActive !== false,
      },
    });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'USER_CREATE', entityName: 'User', entityId: user.id,
        details: `Created user ${user.username} (${user.role})`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});
    return NextResponse.json({ user: { id: user.id, username: user.username, role: user.role }, message: 'User created' }, { status: 201 });
  } catch (error) {
    console.error('Users POST error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

// PUT /api/users — update user (ADMIN) — supports password reset
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const data: Record<string, unknown> = {};
    for (const f of ['username', 'email', 'firstName', 'lastName', 'role', 'phone', 'avatarUrl']) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    if (body.password) data.passwordHash = hashPassword(body.password);

    const user = await db.user.update({ where: { id: body.id }, data });
    // Kill sessions when deactivated or password reset
    if (body.isActive === false || body.password) {
      await db.session.deleteMany({ where: { userId: body.id } }).catch(() => {});
    }
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'USER_UPDATE', entityName: 'User', entityId: body.id,
        details: `Updated user ${user.username}${body.password ? ' (password reset)' : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});
    return NextResponse.json({ message: 'User updated' });
  } catch (error) {
    console.error('Users PUT error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/users — deactivate (ADMIN)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (id === auth.user.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    await db.session.deleteMany({ where: { userId: id } });
    await db.user.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ message: 'User deactivated' });
  } catch (error) {
    console.error('Users DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

