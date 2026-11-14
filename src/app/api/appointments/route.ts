import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateCode } from '@/lib/auth';
import { getPagination, getDateFilter } from '@/lib/api';

/**
 * APPOINTMENTS API — public website booking → staff scheduling dashboard.
 * POST is intentionally PUBLIC (no requireAuth) so the public website booking
 * form can submit requests. Staff endpoints (GET/PUT/DELETE) require auth.
 */

const LIST_ROLES = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE'];

// GET /api/appointments — staff schedule list (search, status, doctor, department, date range); ?id= single
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, LIST_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const doctorId = searchParams.get('doctorId') || '';
    const departmentId = searchParams.get('departmentId') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const appointment = await db.appointment.findUnique({
        where: { id },
        include: {
          patient: {
            select: { id: true, patientNo: true, firstName: true, lastName: true, phone: true, paymentMode: true },
          },
        },
      });
      if (!appointment) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
      return NextResponse.json({ appointment });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { appointmentNo: { contains: search } },
        { patientName: { contains: search } },
        { patientPhone: { contains: search } },
        {
          patient: {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { patientNo: { contains: search } },
            ],
          },
        },
      ];
    }
    if (status) where.status = status;
    if (doctorId) where.doctorId = doctorId;
    if (departmentId) where.departmentId = departmentId;

    const dateFilter = getDateFilter(searchParams);
    if (Object.keys(dateFilter).length > 0) where.appointmentDate = dateFilter;

    const [appointments, total] = await Promise.all([
      db.appointment.findMany({
        where,
        orderBy: [{ appointmentDate: 'desc' }, { createdAt: 'desc' }],
        skip, take: perPage,
        include: {
          patient: { select: { patientNo: true, firstName: true, lastName: true, phone: true } },
        },
      }),
      db.appointment.count({ where }),
    ]);

    return NextResponse.json({
      appointments, items: appointments, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Appointments GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
  }
}

// POST /api/appointments — PUBLIC booking form (no auth). Optionally links an existing patient via patientId.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      patientId, patientName, patientPhone, patientEmail,
      doctorId, departmentId, appointmentDate, timeSlot, reason,
    } = body;

    if (!patientName && !patientId) {
      return NextResponse.json({ error: 'Patient name is required' }, { status: 400 });
    }
    const parsedDate = appointmentDate ? new Date(appointmentDate) : null;
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'A valid appointment date is required' }, { status: 400 });
    }

    // Optional: link an existing patient record (fills name/phone/email if missing)
    let linkedId: string | null = null;
    let name = patientName || '';
    let phone = patientPhone || '';
    let email = patientEmail || '';
    if (patientId) {
      const patient = await db.patient.findUnique({ where: { id: patientId } });
      if (patient) {
        linkedId = patient.id;
        if (!name) name = `${patient.firstName} ${patient.lastName}`.trim();
        if (!phone) phone = patient.phone;
        if (!email) email = patient.email;
      }
    }

    const appointmentNo = await generateCode('APT');
    const appointment = await db.appointment.create({
      data: {
        appointmentNo,
        patientId: linkedId,
        patientName: name,
        patientPhone: phone,
        patientEmail: email,
        doctorId: doctorId || '',
        departmentId: departmentId || null,
        appointmentDate: parsedDate,
        timeSlot: timeSlot || '',
        reason: reason || '',
        status: 'PENDING',
        source: 'WEBSITE',
      },
    });

    await db.auditLog.create({
      data: {
        action: 'APPOINTMENT_CREATE', entityName: 'Appointment', entityId: appointment.id,
        details: `Website booking ${appointmentNo} — ${name || 'linked patient'}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json(
      { appointment, appointmentNo, message: 'Appointment request received. We will confirm shortly.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('Appointments POST error:', error);
    return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 });
  }
}

// PUT /api/appointments — update status / notes / reschedule
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'DOCTOR', 'RECEPTIONIST']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      id, status, notes, appointmentDate, timeSlot,
      doctorId, departmentId, reason, patientName, patientPhone, patientEmail, source,
    } = body;
    if (!id) return NextResponse.json({ error: 'Appointment ID required' }, { status: 400 });

    const existing = await db.appointment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (timeSlot !== undefined) updateData.timeSlot = timeSlot;
    if (doctorId !== undefined) updateData.doctorId = doctorId || '';
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (reason !== undefined) updateData.reason = reason;
    if (patientName !== undefined) updateData.patientName = patientName;
    if (patientPhone !== undefined) updateData.patientPhone = patientPhone;
    if (patientEmail !== undefined) updateData.patientEmail = patientEmail;
    if (source) updateData.source = source;
    if (appointmentDate) {
      const parsed = new Date(appointmentDate);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid appointment date' }, { status: 400 });
      }
      updateData.appointmentDate = parsed;
    }

    const appointment = await db.appointment.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'APPOINTMENT_UPDATE', entityName: 'Appointment', entityId: id,
        details: `Appointment ${existing.appointmentNo} updated${status ? ` — status → ${status}` : ''}${appointmentDate ? ' — rescheduled' : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ appointment, message: 'Appointment updated' });
  } catch (error) {
    console.error('Appointments PUT error:', error);
    return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
  }
}

// DELETE /api/appointments — ?id=
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'RECEPTIONIST']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Appointment ID required (use ?id=)' }, { status: 400 });

    const existing = await db.appointment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

    await db.appointment.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'APPOINTMENT_DELETE', entityName: 'Appointment', entityId: id,
        details: `Appointment ${existing.appointmentNo} deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Appointment deleted' });
  } catch (error) {
    console.error('Appointments DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete appointment' }, { status: 500 });
  }
}
