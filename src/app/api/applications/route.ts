import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * APPLICATIONS API — JobApplication pipeline (careers page → HR review).
 * POST is PUBLIC (website careers form, no auth required);
 * GET/PUT are ADMIN/HR for recruitment management.
 */

const HR_ROLES = ['ADMIN', 'HR'];
const APPLICATION_STATUSES = ['RECEIVED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEWED', 'OFFERED', 'HIRED', 'REJECTED'];

// GET /api/applications — HR recruitment pipeline
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const jobPostingId = searchParams.get('jobPostingId') || '';
    const status = searchParams.get('status') || '';

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { applicantName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (jobPostingId) where.jobPostingId = jobPostingId;
    if (status) where.status = status;

    const [applications, total] = await Promise.all([
      db.jobApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: perPage,
        include: { jobPosting: { select: { id: true, title: true, slug: true, department: true, status: true } } },
      }),
      db.jobApplication.count({ where }),
    ]);

    return NextResponse.json({
      applications, items: applications, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Applications GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 });
  }
}

// POST /api/applications — PUBLIC careers form submission (no auth)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobPostingId, applicantName, email, phone, coverLetter, resumeUrl } = body;

    if (!applicantName || !jobPostingId) {
      return NextResponse.json({ error: 'Applicant name and job posting are required' }, { status: 400 });
    }

    const job = await db.jobPosting.findUnique({ where: { id: jobPostingId } });
    if (!job) return NextResponse.json({ error: 'Job posting not found' }, { status: 404 });

    const application = await db.jobApplication.create({
      data: {
        jobPostingId,
        applicantName,
        email: email || '',
        phone: phone || '',
        coverLetter: coverLetter || '',
        resumeUrl: resumeUrl || '',
        status: 'RECEIVED',
      },
      include: { jobPosting: { select: { id: true, title: true, slug: true } } },
    });

    await db.auditLog.create({
      data: {
        action: 'JOB_APPLICATION_SUBMIT', entityName: 'JobApplication', entityId: application.id,
        details: `Careers application from ${applicantName} for "${job.title}"`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json(
      { application, message: 'Application submitted successfully. We will contact you if shortlisted.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('Applications POST error:', error);
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 });
  }
}

// PUT /api/applications — HR status review (RECEIVED → … → HIRED/REJECTED)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, status, reviewNotes } = body;
    if (!id) return NextResponse.json({ error: 'Application ID required' }, { status: 400 });

    if (status && !APPLICATION_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status — must be one of ${APPLICATION_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    const existing = await db.jobApplication.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const updateData: Record<string, unknown> = { reviewedBy: auth.user.id };
    if (status !== undefined) updateData.status = status;
    if (reviewNotes !== undefined) updateData.reviewNotes = reviewNotes;

    const application = await db.jobApplication.update({
      where: { id },
      data: updateData,
      include: { jobPosting: { select: { id: true, title: true, slug: true } } },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'JOB_APPLICATION_REVIEW', entityName: 'JobApplication', entityId: id,
        details: `Application from ${existing.applicantName}${status ? ` — status → ${status}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ application, message: 'Application updated' });
  } catch (error) {
    console.error('Applications PUT error:', error);
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
  }
}
