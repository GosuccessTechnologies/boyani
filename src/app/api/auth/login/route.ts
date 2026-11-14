import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';

// Simple sha256 hash (mirrors hills.zip pattern) — NOT exported: Next.js route
// files may only export HTTP handlers (fixes .next/types validator error).
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: {
        OR: [{ username }, { email: username }],
        isActive: true,
      },
    });

    if (!user || user.passwordHash !== hashPassword(password)) {
      // Record failed attempt for existing usernames (login history)
      if (user) {
        await db.userLoginHistory.create({
          data: {
            userId: user.id,
            action: 'FAILED',
            ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '',
            userAgent: (request.headers.get('user-agent') || '').slice(0, 240),
            loggedInAt: new Date(),
          },
        }).catch(() => {/* non-fatal */});
      }
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.session.create({ data: { userId: user.id, token, expiresAt } });
    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '';
    const ua = request.headers.get('user-agent') || '';
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entityName: 'User',
        entityId: user.id,
        details: `Login by ${user.username} (${user.role})`,
        ipAddress: ip,
      },
    });
    // Per-user login history (filterable in /admin/users → Login History)
    await db.userLoginHistory.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        ipAddress: ip,
        userAgent: ua.slice(0, 240),
        loggedInAt: new Date(),
      },
    }).catch(() => {/* non-fatal */});

    return NextResponse.json({
      token,
      user: {
        id: user.id, username: user.username, email: user.email,
        firstName: user.firstName, lastName: user.lastName,
        role: user.role, phone: user.phone, avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
