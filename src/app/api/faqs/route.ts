import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination } from '@/lib/api';

/**
 * FAQS API — frequently asked questions for the public website.
 * GET works WITHOUT auth when ?public=1 (published FAQs ordered for display);
 * authenticated GET returns all. Writes are ADMIN-only.
 */

// GET /api/faqs — public=1 → published FAQs; auth → full list
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
    const category = searchParams.get('category') || '';
    const id = searchParams.get('id') || '';

    if (id) {
      const faq = await db.faq.findUnique({ where: { id } });
      if (!faq || (isPublicRead && !faq.isPublic)) {
        return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });
      }
      return NextResponse.json({ faq });
    }

    const where: Record<string, unknown> = {};
    if (isPublicRead) where.isPublic = true;
    if (search) {
      where.OR = [
        { question: { contains: search } },
        { answer: { contains: search } },
      ];
    }
    if (category) where.category = category;

    const [faqs, total] = await Promise.all([
      db.faq.findMany({
        where,
        orderBy: { displayOrder: 'asc' },
        skip: isPublicRead ? 0 : skip,
        take: isPublicRead ? 100 : perPage,
      }),
      db.faq.count({ where }),
    ]);

    if (isPublicRead) {
      return NextResponse.json({ items: faqs, total });
    }
    return NextResponse.json({
      faqs, items: faqs, total, page, perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    console.error('Faqs GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch FAQs' }, { status: 500 });
  }
}

// POST /api/faqs — add FAQ
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { question, answer, category, displayOrder, isPublic } = body;

    if (!question || !answer) {
      return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 });
    }

    const faq = await db.faq.create({
      data: {
        question,
        answer,
        category: category || 'GENERAL',
        displayOrder: parseInt(displayOrder) || 0,
        isPublic: isPublic !== undefined ? !!isPublic : true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'FAQ_CREATE', entityName: 'Faq', entityId: faq.id,
        details: `FAQ "${question.slice(0, 60)}" added`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ faq, message: 'FAQ created' }, { status: 201 });
  } catch (error) {
    console.error('Faqs POST error:', error);
    return NextResponse.json({ error: 'Failed to create FAQ' }, { status: 500 });
  }
}

// PUT /api/faqs — update FAQ
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'FAQ ID required' }, { status: 400 });

    const existing = await db.faq.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (data.question) updateData.question = data.question;
    if (data.answer) updateData.answer = data.answer;
    if (data.category) updateData.category = data.category;
    if (data.displayOrder !== undefined) updateData.displayOrder = parseInt(data.displayOrder) || 0;
    if (data.isPublic !== undefined) updateData.isPublic = !!data.isPublic;

    const faq = await db.faq.update({ where: { id }, data: updateData });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'FAQ_UPDATE', entityName: 'Faq', entityId: id,
        details: `FAQ "${existing.question.slice(0, 60)}" updated`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ faq, message: 'FAQ updated' });
  } catch (error) {
    console.error('Faqs PUT error:', error);
    return NextResponse.json({ error: 'Failed to update FAQ' }, { status: 500 });
  }
}

// DELETE /api/faqs?id=
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'FAQ ID required' }, { status: 400 });

    const existing = await db.faq.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });

    await db.faq.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'FAQ_DELETE', entityName: 'Faq', entityId: id,
        details: `FAQ "${existing.question.slice(0, 60)}" deleted`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: 'FAQ deleted' });
  } catch (error) {
    console.error('Faqs DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete FAQ' }, { status: 500 });
  }
}
