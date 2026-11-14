import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * DOCTORS API — public doctor directory for the website (Find a Doctor).
 * GET works WITHOUT auth when ?public=1 (published profiles, display order);
 * authenticated GET returns all. Writes are ADMIN-only.
 */

// GET /api/doctors — public=1 → published profiles; auth → full directory
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublicRead = searchParams.get('public') === '1';
    if (!isPublicRead) {
      const auth = await requireAuth(request);
      if (auth instanceof NextResponse) return auth;
    }

    const { page, perPage, skip } = getPagination(searchParams, 30);
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || '';
    const specialization = searchParams.get('specialization') || '';
    const accepting = searchParams.get('accepting') === '1';
    const id = searchParams.get('id') || '';

    // Single profile
    if (id) {
      const doctor = await db.doctorProfile.findUnique({ where: { id } });
      if (!doctor || (isPublicRead && !doctor.isPublic)) {
        return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
      }
      return NextResponse.json({ doctor });
    }

    const where: Record<string, unknown> = {};
    if (isPublicRead) where.isPublic = true;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { specialization: { contains: search } },
      ];
    }
    if (department) where.department = department;
    if (specialization) where.specialization = specialization;
    if (accepting) where.isAcceptingPatients = true;

    const [doctors, total] = await Promise.all([
      db.doctorProfile.findMany({
        where,
        orderBy: { displayOrder: 'asc' },
        skip: isPublicRead ? 0 : skip,
        take: isPublicRead ? 100 : perPage,
      }),
      db.doctorProfile.count({ where }),
    ]);

    if (isPublicRead) {
      return NextResponse.json({ items: doctors, total });
    }
    return NextResponse.json({
      doctors, items: doctors, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Doctors GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch doctors' }, { status: 500 });
  }
}

// POST /api/doctors — add directory profile
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      employeeId, name, title, specialization, department, qualifications,
      bio, photoUrl, experienceYears, consultationFee, availableDays, availableHours,
      isAcceptingPatients, isPublic, displayOrder,
    } = body;

    if (!name) return NextResponse.json({ error: 'Doctor name is required' }, { status: 400 });

    const doctor = await db.doctorProfile.create({
      data: {
        employeeId: employeeId || '',
        name,
        title: title || 'Dr.',
        specialization: specialization || 'General Practitioner',
        department: department || '',
        qualifications: qualifications || '',
        bio: bio || '',
        photoUrl: photoUrl || '',
        experienceYears: Math.max(0, parseInt(experienceYears) || 1),
        consultationFee: parseFloat(consultationFee) || 0,
        availableDays: availableDays || 'Mon-Fri',
        availableHours: availableHours || '08:00-17:00',
        isAcceptingPatients: isAcceptingPatients !== undefined ? !!isAcceptingPatients : true,
        isPublic: isPublic !== undefined ? !!isPublic : true,
        displayOrder: parseInt(displayOrder) || 0,
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'DOCTOR_PROFILE_CREATE', entityName: 'DoctorProfile', entityId: doctor.id,
        details: `Doctor profile ${doctor.title} ${doctor.name} (${doctor.specialization}) added`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ doctor, message: `Doctor profile for ${doctor.name} created` }, { status: 201 });
  } catch (error) {
    console.error('Doctors POST error:', error);
    return NextResponse.json({ error: 'Failed to create doctor profile' }, { status: 500 });
  }
}

// PUT /api/doctors — update directory profile
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Doctor profile ID required' }, { status: 400 });

    const existing = await db.doctorProfile.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;
    if (data.name) updateData.name = data.name;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.specialization) updateData.specialization = data.specialization;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.qualifications !== undefined) updateData.qualifications = data.qualifications;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
    if (data.experienceYears !== undefined) updateData.experienceYears = Math.max(0, parseInt(data.experienceYears) || existing.experienceYears);
    if (data.consultationFee !== undefined) updateData.consultationFee = parseFloat(data.consultationFee) || 0;
    if (data.availableDays !== undefined) updateData.availableDays = data.availableDays;
    if (data.availableHours !== undefined) updateData.availableHours = data.availableHours;
    if (data.isAcceptingPatients !== undefined) updateData.isAcceptingPatients = !!data.isAcceptingPatients;
    if (data.isPublic !== undefined) updateData.isPublic = !!data.isPublic;
    if (data.displayOrder !== undefined) updateData.displayOrder = parseInt(data.displayOrder) || 0;

    const doctor = await db.doctorProfile.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'DOCTOR_PROFILE_UPDATE', entityName: 'DoctorProfile', entityId: id,
        details: `Doctor profile ${existing.name} updated`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ doctor, message: 'Doctor profile updated' });
  } catch (error) {
    console.error('Doctors PUT error:', error);
    return NextResponse.json({ error: 'Failed to update doctor profile' }, { status: 500 });
  }
}

// DELETE /api/doctors?id=
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Doctor profile ID required' }, { status: 400 });

    const existing = await db.doctorProfile.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });

    await db.doctorProfile.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'DOCTOR_PROFILE_DELETE', entityName: 'DoctorProfile', entityId: id,
        details: `Doctor profile ${existing.name} deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Doctor profile deleted' });
  } catch (error) {
    console.error('Doctors DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete doctor profile' }, { status: 500 });
  }
}
