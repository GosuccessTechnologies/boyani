import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

async function getAuthUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) return null;
  const session = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;
  return session.user;
}

// GET /api/quotations/[id] — single quotation with items (for print view)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user || (user.role !== 'ADMIN' && user.role !== 'CASHIER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const quotation = await db.quotation.findUnique({
      where: { id },
      include: {
        items: true,
        createdBy: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });
    if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role === 'CASHIER' && quotation.createdById !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    return NextResponse.json({ quotation });
  } catch (error) {
    console.error('Quotation GET [id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch quotation' }, { status: 500 });
  }
}
