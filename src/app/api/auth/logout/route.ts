import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (session) {
    await db.session.delete({ where: { id: session.session.id } }).catch(() => {});
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'LOGOUT',
        entityName: 'User',
        entityId: session.user.id,
        details: `Logout by ${session.user.username}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});
    // Close out the latest LOGIN row in the user's login history
    const lastLogin = await db.userLoginHistory.findFirst({
      where: { userId: session.user.id, action: 'LOGIN' },
      orderBy: { loggedInAt: 'desc' },
    }).catch(() => null);
    if (lastLogin && !lastLogin.loggedOutAt) {
      const mins = Math.max(0, Math.round((Date.now() - new Date(lastLogin.loggedInAt).getTime()) / 60000));
      await db.userLoginHistory.update({
        where: { id: lastLogin.id },
        data: { loggedOutAt: new Date(), durationMinutes: mins },
      }).catch(() => {});
    }
  }
  return NextResponse.json({ success: true });
}
