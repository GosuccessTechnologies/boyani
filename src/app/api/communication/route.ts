import { db } from '@/lib/db';
import type { SmsMessage, EmailMessage } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPagination, getDateFilter } from '@/lib/api';

/**
 * COMMUNICATION API — SMS (Africa's Talking REST) + EMAIL (SMTP via nodemailer).
 * Instruction 27 — Front Desk communication hub.
 *
 * GET  ?channel=sms|email            → paginated history (filters: status, audience,
 *                                      date range, search) incl. sentByName
 * GET  ?templates=1                  → built-in message templates (static list)
 * GET  ?preview=1&audience=…         → resolved recipient preview (count + list)
 * GET  ?stats=1                      → dashboard counts + recent activity lists
 * POST {channel, audience, recipients?, subject?, message, templateId?}
 *                                    → resolves audience server-side, creates one
 *                                      QUEUED row per recipient, then attempts
 *                                      delivery via the configured provider.
 *                                      No credentials → rows stay QUEUED with a note.
 * PUT  {id, status}                  → mark (SENT/QUEUED/FAILED) or RETRY delivery.
 *
 * Roles: ADMIN, RECEPTIONIST (Front Desk portal).
 */

const COMM_ROLES = ['ADMIN', 'RECEPTIONIST'];
const AUDIENCES = ['INDIVIDUAL', 'PATIENTS', 'ADMITTED', 'WALKIN', 'CSV', 'APPOINTMENTS', 'CUSTOM'];
const SMS_STATUSES = ['QUEUED', 'SENT', 'DELIVERED', 'FAILED'];

interface Recipient {
  name: string;
  phone: string;
  email: string;
}

// ── Built-in message templates (static — placeholders replaced at send time) ──
const MESSAGE_TEMPLATES = [
  {
    id: 'appointment-reminder',
    name: 'Appointment Reminder',
    channels: ['sms', 'email'],
    subject: 'Appointment Reminder — {facilityName}',
    body: 'Dear {patientName}, this is a kind reminder of your upcoming appointment at {facilityName} on {date}. Please arrive 15 minutes early with your ID. For rescheduling call us. Thank you.',
  },
  {
    id: 'follow-up',
    name: 'Patient Follow-up',
    channels: ['sms', 'email'],
    subject: 'How are you feeling? — {facilityName}',
    body: 'Dear {patientName}, we hope you are recovering well after your visit to {facilityName}. If you have any concerns or your symptoms persist, please reach out to us or book a review. Wishing you good health.',
  },
  {
    id: 'promotion',
    name: 'Promotion / Offer',
    channels: ['sms', 'email'],
    subject: 'A special offer from {facilityName}',
    body: 'Hello {patientName}! {facilityName} is pleased to share a special health offer for our valued patients this {date}. Visit us or call us to learn more and book. We look forward to serving you.',
  },
  {
    id: 'results-ready',
    name: 'Results Ready',
    channels: ['sms', 'email'],
    subject: 'Your results are ready — {facilityName}',
    body: 'Dear {patientName}, your test results are ready for collection at {facilityName} as of {date}. Please come with your ID, or contact us to arrange collection. Thank you.',
  },
  {
    id: 'custom',
    name: 'Custom Message',
    channels: ['sms', 'email'],
    subject: '',
    body: '',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Map of userId → display name (sender / handler resolution). */
async function resolveUserNames(ids: Array<string>): Promise<Record<string, string>> {
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (clean.length === 0) return {};
  const users = await db.user.findMany({
    where: { id: { in: clean } },
    select: { id: true, firstName: true, lastName: true, username: true },
  }).catch(() => []);
  const map: Record<string, string> = {};
  for (const u of users) {
    const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    map[u.id] = full || u.username;
  }
  return map;
}

/** Read CompanyConfig as a snake_case map. */
async function getConfigMap(): Promise<Record<string, string>> {
  const configs = await db.companyConfig.findMany().catch(() => []);
  const map: Record<string, string> = {};
  for (const c of configs) map[c.key] = c.value;
  return map;
}

/** Normalise a Kenyan phone number to E.164 (+254…) for provider matching. */
function normalizePhone(raw: string): string {
  const s = String(raw || '').trim().replace(/[\s\-()]/g, '');
  if (!s) return '';
  if (s.startsWith('+')) return s;
  if (s.startsWith('254')) return `+${s}`;
  if (s.startsWith('0') && s.length >= 10) return `+254${s.slice(1)}`;
  return s;
}

/** Replace template placeholders for one recipient. */
function personalize(text: string, name: string, facilityName: string): string {
  const date = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
  return String(text || '')
    .replaceAll('{patientName}', name || 'Patient')
    .replaceAll('{facilityName}', facilityName)
    .replaceAll('{date}', date);
}

function fromExplicit(explicit: unknown): Recipient[] {
  if (!Array.isArray(explicit)) return [];
  return explicit
    .map(r => {
      const o = (r || {}) as Record<string, unknown>;
      return {
        name: String(o.name || '').trim(),
        phone: String(o.phone || '').trim(),
        email: String(o.email || '').trim(),
      };
    })
    .filter(r => !!r.phone || !!r.email);
}

/** Resolve an audience to a de-duplicated recipient list (server-side). */
async function resolveAudience(audience: string, channel: string, explicit: unknown): Promise<Recipient[]> {
  const wantEmail = channel === 'email';
  const dedupe = (list: Recipient[]): Recipient[] => {
    const seen = new Set<string>();
    return list.filter(r => {
      const key = (wantEmail ? r.email : r.phone).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const patientToRecipient = (p: { firstName?: string; lastName?: string; patientNo?: string; phone?: string; email?: string }): Recipient => ({
    name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.patientNo || '',
    phone: (p.phone || '').trim(),
    email: (p.email || '').trim(),
  });

  switch (audience) {
    // Explicit lists from the client (typed rows / CSV import / custom)
    case 'INDIVIDUAL':
    case 'CSV':
    case 'CUSTOM':
      return dedupe(fromExplicit(explicit));

    // All registered patients with a phone (SMS) or email (EMAIL)
    case 'PATIENTS': {
      const patients = await db.patient.findMany({
        where: wantEmail ? { email: { not: '' } } : { phone: { not: '' } },
        select: { firstName: true, lastName: true, patientNo: true, phone: true, email: true },
      }).catch(() => []);
      return dedupe(patients.map(patientToRecipient));
    }

    // Patients behind current (ACTIVE) admissions
    case 'ADMITTED': {
      const admissions = await db.admission.findMany({
        where: { status: 'ACTIVE' },
        include: { patient: { select: { firstName: true, lastName: true, patientNo: true, phone: true, email: true } } },
      }).catch(() => []);
      return dedupe(admissions.map(a => patientToRecipient(a.patient)));
    }

    // Distinct walk-in pharmacy sale customer phones (SMS only — sales carry no emails)
    case 'WALKIN': {
      if (wantEmail) return [];
      const sales = await db.pharmacySale.findMany({
        where: { patientPhone: { not: '' } },
        select: { patientName: true, patientPhone: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }).catch(() => []);
      return dedupe(sales.map(s => ({ name: s.patientName || '', phone: (s.patientPhone || '').trim(), email: '' })));
    }

    // Patients with future (non-cancelled) appointments
    case 'APPOINTMENTS': {
      const appts = await db.appointment.findMany({
        where: { appointmentDate: { gte: new Date() }, status: { not: 'CANCELLED' } },
        include: { patient: { select: { firstName: true, lastName: true, patientNo: true, phone: true, email: true } } },
      }).catch(() => []);
      const list: Recipient[] = [];
      for (const a of appts) {
        if (a.patient) {
          list.push(patientToRecipient(a.patient));
        } else {
          // guest appointment — use the contact captured on the booking itself
          list.push({ name: a.patientName || '', phone: (a.patientPhone || '').trim(), email: (a.patientEmail || '').trim() });
        }
      }
      return dedupe(list);
    }

    default:
      return [];
  }
}

// ── Delivery providers ──────────────────────────────────────────────────────

interface DeliveryResult {
  status: 'SENT' | 'FAILED';
  providerRef: string;
}

/**
 * Africa's Talking REST SMS — one batched request per ≤100 recipients.
 * Returns a map of normalized phone → result.
 */
async function sendViaAfricasTalking(
  phones: string[],
  message: string,
  config: Record<string, string>,
): Promise<Record<string, DeliveryResult>> {
  const out: Record<string, DeliveryResult> = {};
  const apiKey = (config.sms_api_key || '').trim();
  const username = (config.sms_username || '').trim();
  if (!apiKey || !username) throw new Error('MISSING_CREDENTIALS');

  const isSandbox = (config.sms_environment || '').trim().toLowerCase() === 'sandbox';
  const base = isSandbox ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com';
  const from = (config.sms_sender_id || '').trim();

  // chunk into ≤100 numbers per request (AT limit)
  for (let i = 0; i < phones.length; i += 100) {
    const chunk = phones.slice(i, i + 100);
    try {
      const form = new URLSearchParams({ username, to: chunk.join(','), message });
      if (from) form.set('from', from);
      const res = await fetch(`${base}/version1/messaging`, {
        method: 'POST',
        headers: { apiKey, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: form.toString(),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json().catch(() => null) as {
        SMSMessageData?: { Message?: string; Recipients?: Array<{ phoneNumber?: string; status?: string; messageId?: string }> };
      } | null;
      if (!res.ok || !data?.SMSMessageData?.Recipients) {
        const err = data?.SMSMessageData?.Message || `HTTP ${res.status}`;
        for (const p of chunk) out[normalizePhone(p)] = { status: 'FAILED', providerRef: err.slice(0, 240) };
        continue;
      }
      for (const r of data.SMSMessageData.Recipients) {
        const key = normalizePhone(r.phoneNumber || '');
        out[key] = r.status === 'Success'
          ? { status: 'SENT', providerRef: r.messageId || 'africastalking' }
          : { status: 'FAILED', providerRef: (r.status || 'Failed').slice(0, 240) };
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'network error';
      for (const p of chunk) out[normalizePhone(p)] = { status: 'FAILED', providerRef: err.slice(0, 240) };
    }
  }
  return out;
}

/** SMTP email via nodemailer (dynamic import — server-side only). */
async function sendViaSmtp(to: string, subject: string, html: string, config: Record<string, string>): Promise<DeliveryResult> {
  const host = (config.smtp_host || '').trim();
  if (!host) throw new Error('MISSING_CREDENTIALS');
  const port = parseInt(config.smtp_port || '587', 10) || 587;
  const user = (config.smtp_username || '').trim();
  const pass = (config.smtp_password || '').trim();
  const fromEmail = (config.smtp_from_email || user || 'noreply@example.com').trim();
  const fromName = (config.smtp_from_name || 'MedCare').trim();

  const nodemailer = (await import('nodemailer')).default;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: config.smtp_secure === 'true' || port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  const info = await transporter.sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, html });
  return { status: 'SENT', providerRef: (info.messageId || 'smtp').slice(0, 240) };
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, COMM_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);

    // Built-in templates
    if (searchParams.get('templates') === '1') {
      return NextResponse.json({ templates: MESSAGE_TEMPLATES });
    }

    // Recipient preview for an audience (count + bounded list)
    if (searchParams.get('preview') === '1') {
      const channel = (searchParams.get('channel') || 'sms').toLowerCase() === 'email' ? 'email' : 'sms';
      const audience = (searchParams.get('audience') || '').toUpperCase();
      if (!AUDIENCES.includes(audience)) {
        return NextResponse.json({ error: `audience must be one of: ${AUDIENCES.join(', ')}` }, { status: 400 });
      }
      const recipients = await resolveAudience(audience, channel, undefined);
      return NextResponse.json({
        audience, channel, count: recipients.length,
        recipients: recipients.slice(0, 200),
      });
    }

    // Dashboard stats + recent activity
    if (searchParams.get('stats') === '1') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [smsSent, smsQueued, smsFailed, emailSent, emailQueued, emailFailed, callsToday, parcelsPending,
        recentSms, recentEmails, recentParcels, recentCalls] = await Promise.all([
        db.smsMessage.count({ where: { status: 'SENT' } }),
        db.smsMessage.count({ where: { status: 'QUEUED' } }),
        db.smsMessage.count({ where: { status: 'FAILED' } }),
        db.emailMessage.count({ where: { status: 'SENT' } }),
        db.emailMessage.count({ where: { status: 'QUEUED' } }),
        db.emailMessage.count({ where: { status: 'FAILED' } }),
        db.callRecord.count({ where: { callTime: { gte: startOfDay } } }),
        db.parcelRecord.count({ where: { status: { in: ['PENDING', 'IN_TRANSIT'] } } }),
        db.smsMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
        db.emailMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
        db.parcelRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
        db.callRecord.findMany({ orderBy: { callTime: 'desc' }, take: 6 }),
      ]);
      const names = await resolveUserNames([
        ...recentSms.map(m => m.sentById),
        ...recentEmails.map(m => m.sentById),
        ...recentParcels.map(p => p.handledById),
        ...recentCalls.map(c => c.handledById),
      ]);
      return NextResponse.json({
        stats: {
          smsSent, smsQueued, smsFailed,
          emailSent, emailQueued, emailFailed,
          callsToday, parcelsPending,
        },
        recentSms: recentSms.map(m => ({ id: m.id, recipient: m.recipientPhone, recipientName: m.recipientName, status: m.status, audience: m.audience, createdAt: m.createdAt, sentByName: names[m.sentById] || '' })),
        recentEmails: recentEmails.map(m => ({ id: m.id, recipient: m.toEmail, recipientName: m.toName, subject: m.subject, status: m.status, audience: m.audience, createdAt: m.createdAt, sentByName: names[m.sentById] || '' })),
        recentParcels: recentParcels.map(p => ({ id: p.id, trackingCode: p.trackingCode, type: p.type, description: p.description, senderName: p.senderName, receiverName: p.receiverName, courier: p.courier, status: p.status, createdAt: p.createdAt, handledByName: names[p.handledById] || '' })),
        recentCalls: recentCalls.map(c => ({ id: c.id, direction: c.direction, callerName: c.callerName, callerPhone: c.callerPhone, category: c.category, durationSec: c.durationSec, callTime: c.callTime, handledByName: names[c.handledById] || '' })),
      });
    }

    // History list — one channel at a time
    const channel = (searchParams.get('channel') || 'sms').toLowerCase() === 'email' ? 'email' : 'sms';
    const { page, perPage, skip } = getPagination(searchParams, 20);
    const status = searchParams.get('status') || '';
    const audience = (searchParams.get('audience') || '').toUpperCase();
    const search = (searchParams.get('search') || '').trim();

    const where: Record<string, unknown> = {};
    if (status && SMS_STATUSES.includes(status)) where.status = status;
    if (audience && AUDIENCES.includes(audience)) where.audience = audience;
    const dateFilter = getDateFilter(searchParams);
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
    if (search) {
      where.OR = channel === 'email'
        ? [
            { toEmail: { contains: search } },
            { toName: { contains: search } },
            { subject: { contains: search } },
            { body: { contains: search } },
          ]
        : [
            { recipientPhone: { contains: search } },
            { recipientName: { contains: search } },
            { message: { contains: search } },
          ];
    }

    const [rows, total] = channel === 'email'
      ? await Promise.all([
          db.emailMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: perPage }),
          db.emailMessage.count({ where }),
        ])
      : await Promise.all([
          db.smsMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: perPage }),
          db.smsMessage.count({ where }),
        ]);

    const names = await resolveUserNames(rows.map(r => (r as { sentById: string }).sentById));
    const messages = rows.map(r => {
      const o = r as unknown as Record<string, string>;
      return {
        id: o.id,
        channel,
        recipient: channel === 'email' ? o.toEmail : o.recipientPhone,
        recipientName: channel === 'email' ? o.toName : o.recipientName,
        subject: channel === 'email' ? o.subject : '',
        message: channel === 'email' ? o.body : o.message,
        audience: o.audience,
        status: o.status,
        provider: o.provider,
        providerRef: o.providerRef,
        direction: o.direction,
        sentByName: names[o.sentById] || '',
        createdAt: o.createdAt,
      };
    });

    return NextResponse.json({ messages, total, page, perPage, totalPages: Math.ceil(total / perPage) });
  } catch (error) {
    console.error('Communication GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch communication history' }, { status: 500 });
  }
}

// ── POST — compose & send to an audience ────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, COMM_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const channel = String(body.channel || 'sms').toLowerCase() === 'email' ? 'email' : 'sms';
    const audience = String(body.audience || '').toUpperCase();
    const message = String(body.message || '').trim();
    const subject = String(body.subject || '').trim();
    const templateId = body.templateId ? String(body.templateId) : '';

    if (!AUDIENCES.includes(audience)) {
      return NextResponse.json({ error: `audience must be one of: ${AUDIENCES.join(', ')}` }, { status: 400 });
    }
    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });
    if (channel === 'email' && !subject) return NextResponse.json({ error: 'subject is required for email' }, { status: 400 });

    // Resolve the audience server-side
    const recipients = await resolveAudience(audience, channel, body.recipients);
    const valid = recipients.filter(r => (channel === 'email' ? !!r.email : !!r.phone));
    if (valid.length === 0) {
      return NextResponse.json({ error: `No recipients resolved for audience ${audience} (${channel})` }, { status: 400 });
    }

    const config = await getConfigMap();
    const facilityName = config.company_name || 'Boyani Health Dispensary';

    // 1) Create one QUEUED row per recipient
    const created: Array<{ id: string; recipient: Recipient }> = [];
    for (const r of valid) {
      const personalized = personalize(message, r.name, facilityName);
      if (channel === 'email') {
        const row = await db.emailMessage.create({
          data: {
            toEmail: r.email,
            toName: r.name,
            subject: personalize(subject, r.name, facilityName),
            body: personalized,
            audience,
            status: 'QUEUED',
            provider: 'smtp',
            sentById: auth.user.id,
          },
        });
        created.push({ id: row.id, recipient: r });
      } else {
        const row = await db.smsMessage.create({
          data: {
            recipientPhone: r.phone,
            recipientName: r.name,
            message: personalized,
            audience,
            status: 'QUEUED',
            provider: 'africastalking',
            sentById: auth.user.id,
          },
        });
        created.push({ id: row.id, recipient: r });
      }
    }

    // 2) Attempt delivery
    let delivered = 0;
    let failed = 0;
    let queuedNote = '';

    if (channel === 'sms') {
      const apiKey = (config.sms_api_key || '').trim();
      const username = (config.sms_username || '').trim();
      if (!apiKey || !username) {
        // No credentials — rows stay QUEUED with a note
        queuedNote = 'awaiting credentials';
        await Promise.all(created.map(c => db.smsMessage.update({ where: { id: c.id }, data: { providerRef: 'awaiting credentials' } })));
      } else {
        const results = await sendViaAfricasTalking(valid.map(r => r.phone), message, config);
        for (const c of created) {
          const key = normalizePhone(c.recipient.phone);
          const res = results[key];
          if (!res) {
            await db.smsMessage.update({ where: { id: c.id }, data: { status: 'FAILED', providerRef: 'No provider response for this recipient' } });
            failed++;
          } else if (res.status === 'SENT') {
            await db.smsMessage.update({ where: { id: c.id }, data: { status: 'SENT', providerRef: res.providerRef } });
            delivered++;
          } else {
            await db.smsMessage.update({ where: { id: c.id }, data: { status: 'FAILED', providerRef: res.providerRef } });
            failed++;
          }
        }
      }
    } else {
      const host = (config.smtp_host || '').trim();
      if (!host) {
        queuedNote = 'awaiting SMTP credentials';
        await Promise.all(created.map(c => db.emailMessage.update({ where: { id: c.id }, data: { providerRef: 'awaiting SMTP credentials' } })));
      } else {
        await Promise.all(created.map(async c => {
          try {
            const res = await sendViaSmtp(c.recipient.email, subject, personalize(message, c.recipient.name, facilityName), config);
            await db.emailMessage.update({ where: { id: c.id }, data: { status: res.status, providerRef: res.providerRef } });
            if (res.status === 'SENT') delivered++; else failed++;
          } catch (e) {
            const err = e instanceof Error ? e.message : 'SMTP error';
            await db.emailMessage.update({ where: { id: c.id }, data: { status: 'FAILED', providerRef: err.slice(0, 240) } });
            failed++;
          }
        }));
      }
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'COMMUNICATION_SEND',
        entityName: channel === 'email' ? 'EmailMessage' : 'SmsMessage',
        entityId: created[0]?.id || '',
        details: `${channel.toUpperCase()} → ${audience} · ${created.length} recipient(s)${templateId ? ` · template ${templateId}` : ''} · ${delivered} sent / ${failed} failed${queuedNote ? ` / ${queuedNote}` : ''}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    const summaryNote = queuedNote
      ? `${created.length} message(s) queued — ${queuedNote}. Configure the provider in Facility Management → Settings.`
      : `${created.length} message(s) processed — ${delivered} sent, ${failed} failed.`;

    return NextResponse.json({ created: created.length, sent: delivered, failed, note: queuedNote, message: summaryNote }, { status: 201 });
  } catch (error) {
    console.error('Communication POST error:', error);
    return NextResponse.json({ error: 'Failed to send communication' }, { status: 500 });
  }
}

// ── PUT — mark status or retry delivery ─────────────────────────────────────

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, COMM_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const id = String(body.id || '');
    const status = String(body.status || '').toUpperCase();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const config = await getConfigMap();

    // Locate the row (channel hint optional — search both tables)
    const channel = String(body.channel || '').toLowerCase();
    let smsRow: SmsMessage | null = null;
    let emailRow: EmailMessage | null = null;
    if (channel !== 'email') smsRow = await db.smsMessage.findUnique({ where: { id } });
    if (!smsRow && channel !== 'sms') emailRow = await db.emailMessage.findUnique({ where: { id } });
    if (!smsRow && !emailRow) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    // RETRY — re-attempt provider delivery for this row
    if (status === 'RETRY') {
      if (smsRow) {
        const apiKey = (config.sms_api_key || '').trim();
        const username = (config.sms_username || '').trim();
        if (!apiKey || !username) {
          await db.smsMessage.update({ where: { id }, data: { status: 'QUEUED', providerRef: 'awaiting credentials' } });
          return NextResponse.json({ message: 'Still awaiting SMS credentials — row re-queued', status: 'QUEUED' });
        }
        const results = await sendViaAfricasTalking([smsRow.recipientPhone], smsRow.message, config);
        const res = results[normalizePhone(smsRow.recipientPhone)];
        const updated = await db.smsMessage.update({
          where: { id },
          data: res
            ? { status: res.status === 'SENT' ? 'SENT' : 'FAILED', providerRef: res.providerRef }
            : { status: 'FAILED', providerRef: 'No provider response' },
        });
        await db.auditLog.create({
          data: {
            userId: auth.user.id, action: 'COMMUNICATION_RETRY', entityName: 'SmsMessage', entityId: id,
            details: `SMS retry → ${smsRow.recipientPhone} · ${updated.status}`,
            ipAddress: request.headers.get('x-forwarded-for') || '',
          },
        }).catch(() => {});
        return NextResponse.json({ message: `Retry ${updated.status === 'SENT' ? 'sent' : 'failed'}`, status: updated.status, smsMessage: updated });
      } else if (emailRow) {
        const host = (config.smtp_host || '').trim();
        if (!host) {
          await db.emailMessage.update({ where: { id }, data: { status: 'QUEUED', providerRef: 'awaiting SMTP credentials' } });
          return NextResponse.json({ message: 'Still awaiting SMTP credentials — row re-queued', status: 'QUEUED' });
        }
        try {
          const res = await sendViaSmtp(emailRow.toEmail, emailRow.subject, emailRow.body, config);
          const updated = await db.emailMessage.update({ where: { id }, data: { status: res.status, providerRef: res.providerRef } });
          await db.auditLog.create({
            data: {
              userId: auth.user.id, action: 'COMMUNICATION_RETRY', entityName: 'EmailMessage', entityId: id,
              details: `Email retry → ${emailRow.toEmail} · ${updated.status}`,
              ipAddress: request.headers.get('x-forwarded-for') || '',
            },
          }).catch(() => {});
          return NextResponse.json({ message: 'Retry sent', status: updated.status, emailMessage: updated });
        } catch (e) {
          const err = e instanceof Error ? e.message : 'SMTP error';
          const updated = await db.emailMessage.update({ where: { id }, data: { status: 'FAILED', providerRef: err.slice(0, 240) } });
          return NextResponse.json({ message: `Retry failed — ${err.slice(0, 120)}`, status: updated.status, emailMessage: updated });
        }
      }
    }

    // Direct mark
    if (!SMS_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${SMS_STATUSES.join(', ')}, RETRY` }, { status: 400 });
    }
    const updated = smsRow
      ? await db.smsMessage.update({ where: { id }, data: { status } })
      : await db.emailMessage.update({ where: { id }, data: { status } });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'COMMUNICATION_MARK',
        entityName: smsRow ? 'SmsMessage' : 'EmailMessage',
        entityId: id,
        details: `Marked ${smsRow ? 'SMS' : 'email'} as ${status}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ message: `Marked as ${status}`, smsMessage: smsRow ? updated : undefined, emailMessage: smsRow ? undefined : updated });
  } catch (error) {
    console.error('Communication PUT error:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}
