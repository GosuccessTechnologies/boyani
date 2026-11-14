import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination, getDateFilter } from '@/lib/api';

/**
 * CONTACT API — website inquiry inbox.
 * POST is PUBLIC (no auth) — the website contact form writes messages with status NEW.
 * GET/PUT are ADMIN-only (inbox, triage & replies).
 */

const MESSAGE_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM'];

// GET /api/contact — admin inbox; ?id= single thread
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const message = await db.contactMessage.findUnique({ where: { id } });
      if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      return NextResponse.json({ message });
    }

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { subject: { contains: search } },
      ];
    }
    if (status) where.status = status;
    const dateFilter = getDateFilter(searchParams);
    if (dateFilter.gte || dateFilter.lte) where.createdAt = dateFilter;

    const [messages, total] = await Promise.all([
      db.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: perPage,
      }),
      db.contactMessage.count({ where }),
    ]);

    return NextResponse.json({
      messages, items: messages, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Contact GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST /api/contact — PUBLIC website inquiry form (no auth)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, subject, message, department } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!message || !String(message).trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const created = await db.contactMessage.create({
      data: {
        name: String(name).trim().slice(0, 120),
        email: email || '',
        phone: phone || '',
        subject: subject || 'Website inquiry',
        message: String(message).trim(),
        department: department || 'GENERAL',
        status: 'NEW',
      },
    });

    // Public submission — audit without userId (appointments public-booking pattern)
    await db.auditLog.create({
      data: {
        action: 'CONTACT_CREATE', entityName: 'ContactMessage', entityId: created.id,
        details: `Website inquiry from ${created.name}${created.subject ? ` — ${created.subject}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json(
      { message: created, success: true, response: 'Message received. Our team will get back to you shortly.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('Contact POST error:', error);
    return NextResponse.json({ error: 'Failed to submit message' }, { status: 500 });
  }
}

// PUT /api/contact — admin triage: status, assignment, reply (stamps repliedAt)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, status, assignedTo, reply } = body;
    if (!id) return NextResponse.json({ error: 'Message ID required' }, { status: 400 });

    const existing = await db.contactMessage.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    if (status && !MESSAGE_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Use one of: ${MESSAGE_STATUSES.join(', ')}` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo || '';
    if (reply !== undefined) {
      updateData.reply = reply;
      if (reply && !existing.repliedAt) updateData.repliedAt = new Date();
    }

    const message = await db.contactMessage.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'CONTACT_UPDATE', entityName: 'ContactMessage', entityId: id,
        details: `Inquiry from ${existing.name} updated${status ? ` — status → ${status}` : ''}${reply ? ' — replied' : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message, success: true, response: 'Inquiry updated' });
  } catch (error) {
    console.error('Contact PUT error:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}

// DELETE /api/contact?id= — remove spam/old messages
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Message ID required' }, { status: 400 });

    const existing = await db.contactMessage.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    await db.contactMessage.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'CONTACT_DELETE', entityName: 'ContactMessage', entityId: id,
        details: `Inquiry from ${existing.name} deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, response: 'Inquiry deleted' });
  } catch (error) {
    console.error('Contact DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}
