/**
 * Auth Middleware Utilities — session validation, role-based access control, and code generation.
 */

import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
  isActive: boolean;
}

export interface AuthResult {
  user: AuthUser;
  session: {
    id: string;
    token: string;
    role: string;
    expiresAt: Date;
  };
}

/**
 * Reads the Authorization: Bearer token from request headers,
 * validates it against the Session table, and returns user + session or null.
 */
export async function getSessionFromRequest(request: NextRequest): Promise<AuthResult | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

    const token = authHeader.substring(7).trim();
    if (!token) return null;

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) return null;

    // Check expiration
    if (new Date() > session.expiresAt) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    if (!session.user.isActive) return null;

    const user: AuthUser = {
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      role: session.user.role,
      phone: session.user.phone,
      isActive: session.user.isActive,
    };

    return {
      user,
      session: {
        id: session.id,
        token: session.token,
        role: session.user.role,
        expiresAt: session.expiresAt,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Wrapper that authenticates the request and optionally checks allowed roles.
 * Returns the authenticated user on success, or an error NextResponse on failure.
 */
export async function requireAuth(
  request: NextRequest,
  allowedRoles?: string[]
): Promise<{ user: AuthUser } | NextResponse> {
  const result = await getSessionFromRequest(request);

  if (!result) {
    return NextResponse.json({ success: false, error: 'Unauthorized — invalid or expired token' }, { status: 401 });
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(result.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden — insufficient permissions' }, { status: 403 });
  }

  return { user: result.user };
}

/**
 * Auto-generates sequential codes like PAT-2026-0001, SAL-0001, etc.
 * Looks at the latest record with the given prefix to determine the next number.
 */
export async function generateCode(prefix: string): Promise<string> {
  const modelMap: Record<string, { model: string; field: string }> = {
    PAT: { model: 'patient', field: 'patientNo' },
    VIS: { model: 'visit', field: 'visitNo' },
    APT: { model: 'appointment', field: 'appointmentNo' },
    CON: { model: 'consultation', field: 'consultationNo' },
    PRS: { model: 'prescription', field: 'prescriptionNo' },
    LAB: { model: 'labOrder', field: 'orderNo' },
    ADM: { model: 'admission', field: 'admissionNo' },
    ANC: { model: 'aNCRegistration', field: 'ancNo' },
    DEL: { model: 'deliveryRecord', field: 'deliveryNo' },
    SAL: { model: 'pharmacySale', field: 'saleNo' },
    BIL: { model: 'bill', field: 'billNo' },
    PAY: { model: 'payment', field: 'paymentNo' },
    QTN: { model: 'quotation', field: 'quotationNo' },
    EMP: { model: 'employee', field: 'employeeNo' },
    PRD: { model: 'payrollRecord', field: 'payrollNo' },
    INV: { model: 'inventoryItem', field: 'code' },
    JOB: { model: 'jobPosting', field: 'slug' },
  };

  const mapping = modelMap[prefix];
  if (!mapping) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  }

  // Scan the most recent codes (bounded) for the highest numeric suffix.
  // Robust against non-numeric suffixes (e.g. registrar quick-bills created as
  // `BIL-<base36>`), which previously reset the counter and collided on insert.
  const recentRecords: Array<Record<string, unknown>> = await (db as unknown as Record<string, { findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>> }>)[mapping.model]
    .findMany({
      where: {
        [mapping.field]: { startsWith: `${prefix}-` },
      },
      orderBy: { createdAt: 'desc' },
      select: { [mapping.field]: true },
      take: 200,
    })
    .catch(() => []);

  let nextNum = 1;
  for (const rec of recentRecords) {
    const codeValue = rec[mapping.field] as string | undefined;
    if (!codeValue) continue;
    const parts = codeValue.split('-');
    const parsed = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(parsed) && parsed + 1 > nextNum) {
      nextNum = parsed + 1;
    }
  }

  return `${prefix}-${String(nextNum).padStart(4, '0')}`;
}

/** Patient numbers include the year: PAT-2026-0001 */
export async function generatePatientNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PAT-${year}`;
  const latest = await db.patient.findFirst({
    where: { patientNo: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { patientNo: true },
  }).catch(() => null);

  let nextNum = 1;
  if (latest?.patientNo) {
    const parts = latest.patientNo.split('-');
    const parsed = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }
  return `${prefix}-${String(nextNum).padStart(4, '0')}`;
}
