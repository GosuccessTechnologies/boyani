import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * JOBS API — JobPosting for the public careers page + internal HR management.
 * GET works WITHOUT auth when ?public=1 (only public OPEN postings with a valid
 * deadline); authenticated GET (ADMIN/HR) returns everything with pagination.
 * Writes are ADMIN/HR only.
 */

const HR_ROLES = ['ADMIN', 'HR'];

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// GET /api/jobs — public=1 → careers listing; auth → full admin listing
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublicRead = searchParams.get('public') === '1';
    if (!isPublicRead) {
      const auth = await requireAuth(request, HR_ROLES);
      if (auth instanceof NextResponse) return auth;
    }

    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || '';
    const employmentType = searchParams.get('employmentType') || '';
    const status = searchParams.get('status') || '';
    const id = searchParams.get('id') || '';
    const slug = searchParams.get('slug') || '';

    // Single posting — by id or slug
    if (id || slug) {
      const job = await db.jobPosting.findUnique({
        where: id ? { id } : { slug },
        include: { _count: { select: { applications: true } } },
      });
      if (!job || (isPublicRead && (!job.isPublic || job.status !== 'OPEN'))) {
        return NextResponse.json({ error: 'Job posting not found' }, { status: 404 });
      }
      return NextResponse.json({ job });
    }

    const conditions: Record<string, unknown>[] = [];
    if (isPublicRead) {
      conditions.push(
        { isPublic: true },
        { status: 'OPEN' },
        { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] },
      );
    }
    if (search) {
      conditions.push({ OR: [{ title: { contains: search } }, { department: { contains: search } }, { location: { contains: search } }] });
    }
    if (department) conditions.push({ department });
    if (employmentType) conditions.push({ employmentType });
    if (status && !isPublicRead) conditions.push({ status });

    const where: Record<string, unknown> = conditions.length > 0 ? { AND: conditions } : {};

    const [jobs, total] = await Promise.all([
      db.jobPosting.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: isPublicRead ? 0 : skip,
        take: isPublicRead ? 100 : perPage,
        include: isPublicRead ? undefined : { _count: { select: { applications: true } } },
      }),
      db.jobPosting.count({ where }),
    ]);

    if (isPublicRead) {
      return NextResponse.json({ items: jobs, total });
    }
    return NextResponse.json({
      jobs, items: jobs, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Jobs GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch job postings' }, { status: 500 });
  }
}

// POST /api/jobs — create a posting (slug auto-generated from title)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { title, slug, department, location, employmentType, description, requirements, salaryRange, openings, deadline, isPublic, status } = body;

    if (!title) return NextResponse.json({ error: 'Job title is required' }, { status: 400 });

    // Slug: explicit > derived from title > timestamp fallback; ensure unique
    const baseSlug = (typeof slug === 'string' && slug.trim()) || slugify(title) || `job-${Date.now().toString(36)}`;
    let finalSlug = baseSlug;
    const slugTaken = await db.jobPosting.findUnique({ where: { slug: finalSlug } });
    if (slugTaken) finalSlug = `${baseSlug}-${Date.now().toString(36)}`;

    const job = await db.jobPosting.create({
      data: {
        title,
        slug: finalSlug,
        department: department || '',
        location: location || '',
        employmentType: employmentType || 'FULL_TIME',
        description: description || '',
        requirements: requirements || '',
        salaryRange: salaryRange || '',
        openings: parseInt(openings) || 1,
        deadline: deadline ? new Date(deadline) : null,
        isPublic: isPublic !== undefined ? !!isPublic : true,
        status: status || 'OPEN',
        createdBy: auth.user.id,
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'JOB_POSTING_CREATE', entityName: 'JobPosting', entityId: job.id,
        details: `Job posting "${job.title}" (${job.slug}) created — ${job.status}${job.isPublic ? ' · public' : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ job, message: `Job posting "${job.title}" created` }, { status: 201 });
  } catch (error) {
    console.error('Jobs POST error:', error);
    return NextResponse.json({ error: 'Failed to create job posting' }, { status: 500 });
  }
}

// PUT /api/jobs — update a posting
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'Job posting ID required' }, { status: 400 });

    const existing = await db.jobPosting.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Job posting not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    for (const key of ['title', 'department', 'location', 'employmentType', 'description', 'requirements', 'salaryRange', 'status']) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (data.slug !== undefined && data.slug && data.slug !== existing.slug) {
      const slugTaken = await db.jobPosting.findUnique({ where: { slug: data.slug } });
      if (slugTaken) return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
      updateData.slug = data.slug;
    }
    if (data.openings !== undefined) updateData.openings = parseInt(data.openings) || 1;
    if (data.deadline !== undefined) updateData.deadline = data.deadline ? new Date(data.deadline) : null;
    if (data.isPublic !== undefined) updateData.isPublic = !!data.isPublic;

    const job = await db.jobPosting.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'JOB_POSTING_UPDATE', entityName: 'JobPosting', entityId: id,
        details: `Job posting "${existing.title}" updated${data.status ? ` — status → ${data.status}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ job, message: 'Job posting updated' });
  } catch (error) {
    console.error('Jobs PUT error:', error);
    return NextResponse.json({ error: 'Failed to update job posting' }, { status: 500 });
  }
}

// DELETE /api/jobs?id= — blocked when applications exist (close the posting instead)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, HR_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Job posting ID required' }, { status: 400 });

    const existing = await db.jobPosting.findUnique({
      where: { id },
      include: { _count: { select: { applications: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Job posting not found' }, { status: 404 });

    if (existing._count.applications > 0) {
      return NextResponse.json(
        { error: `Cannot delete a posting with ${existing._count.applications} application(s) — set status to CLOSED instead` },
        { status: 400 },
      );
    }

    await db.jobPosting.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'JOB_POSTING_DELETE', entityName: 'JobPosting', entityId: id,
        details: `Job posting "${existing.title}" (${existing.slug}) deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'Job posting deleted' });
  } catch (error) {
    console.error('Jobs DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete job posting' }, { status: 500 });
  }
}
