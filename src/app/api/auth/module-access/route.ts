import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

// Role → launcher module slugs
const ROLE_MODULES: Record<string, string[]> = {
  ADMIN: ['facility', 'pharmacy', 'doctor', 'registrar', 'frontdesk', 'cashier', 'nursing', 'lab', 'attendance', 'inventory', 'hr', 'website-manager'],
  DOCTOR: ['doctor', 'attendance'],
  NURSE: ['nursing', 'attendance'],
  PHARMACIST: ['pharmacy', 'attendance'],
  LAB_TECH: ['lab', 'attendance'],
  CASHIER: ['cashier', 'attendance'],
  RECEPTIONIST: ['registrar', 'frontdesk', 'attendance'],
  HR: ['hr', 'attendance'],
  INVENTORY: ['inventory', 'attendance'],
  STAFF: ['attendance'],
};

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const modules = ROLE_MODULES[session.user.role] || ['attendance'];
  return NextResponse.json({ modules, role: session.user.role });
}
