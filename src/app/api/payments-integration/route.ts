import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * PAYMENTS INTEGRATION API — M-Pesa Daraja STK Push + PesaPal v3 card checkout.
 * Instruction 28 — admin credential management + POS activation.
 *
 * GET  (ADMIN)             → integration status + config (secrets masked, last 4 only)
 * GET  ?status=public      → ONLY the payment methods active at POS (no secrets) —
 *                            {cash, mpesa, pesapal, activeMethod} — used by POS pages.
 * PUT  (ADMIN)             → save credential fields + toggles.
 *                            Secret fields: empty / masked echo → keep existing value.
 * POST {action:'mpesa-stk-push', amount, phone, accountReference, description}
 *                           → Daraja STK push (OAuth token + processrequest).
 * POST {action:'mpesa-stk-status', checkoutRequestId}
 *                           → Daraja STK push status query.
 * POST {action:'mpesa-callback'}  (action via body or ?action= query)
 *                           → Daraja result callback — UNAUTHENTICATED (external
 *                             Safaricom server). Parses Body.stkCallback, records
 *                             an AuditLog 'MPESA_CALLBACK' entry, returns {ResultCode:0}.
 * POST {action:'pesapal-submit-order', amount, phone, email, description}
 *                           → PesaPal v3 SubmitOrderRequest → redirect_iframe_url.
 *
 * Roles: POST payment actions → ADMIN, CASHIER, PHARMACIST (POS operators).
 */

const PAY_ROLES = ['ADMIN', 'CASHIER', 'PHARMACIST'];

const MPESA_KEYS = [
  'mpesa_enabled', 'mpesa_environment', 'mpesa_consumer_key', 'mpesa_consumer_secret',
  'mpesa_shortcode', 'mpesa_passkey', 'mpesa_callback_url',
] as const;
const PESAPAL_KEYS = [
  'pesapal_enabled', 'pesapal_environment', 'pesapal_consumer_key',
  'pesapal_consumer_secret', 'pesapal_ipn_url',
] as const;
const SECRET_KEYS = new Set(['mpesa_consumer_secret', 'mpesa_passkey', 'pesapal_consumer_secret']);
const POS_METHODS = ['CASH_ONLY', 'MPESA_ONLY', 'PESAPAL_ONLY', 'BOTH'] as const;
type PosMethod = typeof POS_METHODS[number];

/** Read CompanyConfig as a snake_case map. */
async function getConfigMap(): Promise<Record<string, string>> {
  const configs = await db.companyConfig.findMany().catch(() => []);
  const map: Record<string, string> = {};
  for (const c of configs) map[c.key] = c.value;
  return map;
}

/** Mask a secret — show only the last 4 characters. */
function maskSecret(value: string): string {
  const s = String(value || '').trim();
  if (!s) return '';
  return '••••' + s.slice(-4);
}

function mpesaCredsSet(c: Record<string, string>): boolean {
  return !!(c.mpesa_consumer_key || '').trim()
    && !!(c.mpesa_consumer_secret || '').trim()
    && !!(c.mpesa_shortcode || '').trim()
    && !!(c.mpesa_passkey || '').trim();
}

function pesapalCredsSet(c: Record<string, string>): boolean {
  return !!(c.pesapal_consumer_key || '').trim() && !!(c.pesapal_consumer_secret || '').trim();
}

/** Which payment methods are live at the POS right now. */
function computeActive(c: Record<string, string>): { cash: boolean; mpesa: boolean; pesapal: boolean; activeMethod: PosMethod } {
  const method: PosMethod = (POS_METHODS as readonly string[]).includes(c.pos_payment_active_method || '')
    ? (c.pos_payment_active_method as PosMethod)
    : 'CASH_ONLY';
  const mpesaReady = c.mpesa_enabled === 'true' && mpesaCredsSet(c);
  const pesapalReady = c.pesapal_enabled === 'true' && pesapalCredsSet(c);
  let cash = method === 'CASH_ONLY' || method === 'BOTH';
  const mpesa = (method === 'MPESA_ONLY' || method === 'BOTH') && mpesaReady;
  const pesapal = (method === 'PESAPAL_ONLY' || method === 'BOTH') && pesapalReady;
  // Safety net: never leave the POS with zero payment methods (e.g. a *_ONLY
  // method selected before its credentials were saved) — fall back to cash.
  if (!cash && !mpesa && !pesapal) cash = true;
  return { cash, mpesa, pesapal, activeMethod: method };
}

/** Config payload for the admin UI — secrets masked to their last 4 chars. */
function maskedConfig(c: Record<string, string>) {
  const active = computeActive(c);
  return {
    mpesa_enabled: c.mpesa_enabled === 'true' ? 'true' : 'false',
    mpesa_environment: c.mpesa_environment === 'production' ? 'production' : 'sandbox',
    mpesa_consumer_key: c.mpesa_consumer_key || '',
    mpesa_consumer_secret: maskSecret(c.mpesa_consumer_secret),
    mpesa_shortcode: c.mpesa_shortcode || '',
    mpesa_passkey: maskSecret(c.mpesa_passkey),
    mpesa_callback_url: c.mpesa_callback_url || '',
    pesapal_enabled: c.pesapal_enabled === 'true' ? 'true' : 'false',
    pesapal_environment: c.pesapal_environment === 'production' ? 'production' : 'sandbox',
    pesapal_consumer_key: c.pesapal_consumer_key || '',
    pesapal_consumer_secret: maskSecret(c.pesapal_consumer_secret),
    pesapal_ipn_url: c.pesapal_ipn_url || '',
    pos_payment_active_method: active.activeMethod,
  };
}

// ─────────────────────────────────────────────────────────────
// GET — config (ADMIN) | ?status=public (open, POS pages)
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const config = await getConfigMap();

    // Public POS status — booleans only, no credentials ever leave the server.
    if (new URL(request.url).searchParams.get('status') === 'public') {
      const active = computeActive(config);
      return NextResponse.json({ success: true, ...active });
    }

    const auth = await requireAuth(request, ['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const active = computeActive(config);
    return NextResponse.json({
      success: true,
      config: maskedConfig(config),
      status: {
        mpesa: {
          enabled: config.mpesa_enabled === 'true',
          credentialsSet: mpesaCredsSet(config),
          ready: config.mpesa_enabled === 'true' && mpesaCredsSet(config),
        },
        pesapal: {
          enabled: config.pesapal_enabled === 'true',
          credentialsSet: pesapalCredsSet(config),
          ready: config.pesapal_enabled === 'true' && pesapalCredsSet(config),
        },
        pos: active,
      },
    });
  } catch (error) {
    console.error('GET /api/payments-integration error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch payment integration settings' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// PUT — save credentials + toggles (ADMIN)
// ─────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const source: Record<string, unknown> =
      body.settings && typeof body.settings === 'object' ? body.settings : body;

    const incoming: Record<string, string> = {};
    for (const [key, value] of Object.entries(source)) {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue;
      incoming[key] = String(value);
    }

    const allowedKeys = [...MPESA_KEYS, ...PESAPAL_KEYS, 'pos_payment_active_method'];
    const existing = await getConfigMap();
    const toSave: Record<string, string> = {};
    const changed: string[] = [];

    for (const key of allowedKeys) {
      if (!(key in incoming)) continue;
      let value = (incoming[key] || '').trim();

      // Secret fields: an empty value or a masked echo (••••) means "keep existing".
      if (SECRET_KEYS.has(key)) {
        if (!value || value.includes('•')) continue;
      }
      if (key.endsWith('_enabled')) value = value === 'true' ? 'true' : 'false';
      if (key === 'mpesa_environment' || key === 'pesapal_environment') {
        value = value === 'production' ? 'production' : 'sandbox';
      }
      if (key === 'pos_payment_active_method') {
        if (!(POS_METHODS as readonly string[]).includes(value)) continue;
      }
      if ((existing[key] || '') === value) continue; // unchanged
      toSave[key] = value;
      changed.push(key);
    }

    // Sequential upsert (SQLite concurrent-write safety, hills pattern)
    for (const [key, value] of Object.entries(toSave)) {
      await db.companyConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'PAYMENT_INTEGRATION_UPDATE',
        entityName: 'CompanyConfig',
        details: changed.length
          ? `Payment integrations updated: ${changed.join(', ')}${changed.some(k => SECRET_KEYS.has(k)) ? ' (secret values hidden)' : ''}`
          : 'Payment integration settings saved (no changes)',
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    const config = await getConfigMap();
    return NextResponse.json({
      success: true,
      updated: changed.length,
      changed,
      config: maskedConfig(config),
    });
  } catch (error) {
    console.error('PUT /api/payments-integration error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save payment integration settings' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// M-Pesa Daraja helpers
// ─────────────────────────────────────────────────────────────

function mpesaBase(env: string): string {
  return env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
}

/** YYYYMMDDHHmmss in East Africa Time (UTC+3) — must match the password timestamp. */
function darajaTimestamp(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

/** Normalize a Kenyan phone to 2547XXXXXXXX (07xx → 2547xx, +2547xx, 7xx…). */
function normalizePhone(raw: string): string {
  let s = String(raw || '').replace(/[\s\-()]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('0')) s = '254' + s.slice(1);
  else if (s.startsWith('7') || s.startsWith('1')) s = '254' + s;
  return s;
}

/** Daraja OAuth token — GET /oauth/v1/generate with Basic base64(key:secret). */
async function getMpesaToken(base: string, consumerKey: string, consumerSecret: string): Promise<string> {
  const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({} as { access_token?: string }));
  if (!res.ok || !data.access_token) {
    throw new Error(String((data as { error_description?: string }).error_description || `Daraja authentication failed (${res.status})`));
  }
  return data.access_token;
}

/** base64(shortcode + passkey + timestamp) — Daraja STK password formula. */
function stkPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

async function handleStkPush(
  request: NextRequest,
  auth: { user: { id: string } },
  config: Record<string, string>,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const consumerKey = (config.mpesa_consumer_key || '').trim();
  const consumerSecret = (config.mpesa_consumer_secret || '').trim();
  const shortcode = (config.mpesa_shortcode || '').trim();
  const passkey = (config.mpesa_passkey || '').trim();
  if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
    return NextResponse.json({ success: false, error: 'Mpesa credentials not configured' }, { status: 400 });
  }

  const amount = Math.round(Number(body.amount));
  if (!amount || amount <= 0) {
    return NextResponse.json({ success: false, error: 'A positive amount is required' }, { status: 400 });
  }
  const phone = normalizePhone(String(body.phone || ''));
  if (!/^254[17]\d{8}$/.test(phone)) {
    return NextResponse.json({ success: false, error: 'A valid Kenyan phone number is required (e.g. 0712 345 678)' }, { status: 400 });
  }

  const base = mpesaBase(config.mpesa_environment);
  const timestamp = darajaTimestamp();
  const origin = new URL(request.url).origin;
  const callbackUrl = (config.mpesa_callback_url || '').trim() || `${origin}/api/payments-integration?action=mpesa-callback`;
  // Daraja limits: AccountReference ≤ 12 chars, TransactionDesc short free text.
  const accountReference = String(body.accountReference || 'ACCOUNT').slice(0, 12);
  const description = String(body.description || 'Payment').slice(0, 60);

  let token: string;
  try {
    token = await getMpesaToken(base, consumerKey, consumerSecret);
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Daraja authentication failed' }, { status: 502 });
  }

  let data: Record<string, unknown>;
  try {
    const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: stkPassword(shortcode, passkey, timestamp),
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: description,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok || String(data.ResponseCode ?? '') !== '0') {
      const error = data.errorMessage || data.ResponseDescription || `Daraja STK push failed (${res.status})`;
      await db.auditLog.create({
        data: {
          userId: auth.user.id,
          action: 'MPESA_STK_PUSH',
          entityName: 'Payment',
          details: `STK push FAILED — ${amount} to ${phone}: ${String(error)}`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ success: false, error: String(error) }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Daraja STK push request failed' }, { status: 502 });
  }

  await db.auditLog.create({
    data: {
      userId: auth.user.id,
      action: 'MPESA_STK_PUSH',
      entityName: 'Payment',
      entityId: String(data.CheckoutRequestID || ''),
      details: `STK push initiated — ${amount} to ${phone} (${config.mpesa_environment === 'production' ? 'production' : 'sandbox'}) · CheckoutRequestID ${String(data.CheckoutRequestID || '')}`,
      ipAddress: request.headers.get('x-forwarded-for') || '',
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    CheckoutRequestID: data.CheckoutRequestID,
    MerchantRequestID: data.MerchantRequestID,
    CustomerMessage: data.CustomerMessage || 'Success. Request accepted for processing',
  });
}

async function handleStkStatus(
  config: Record<string, string>,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const consumerKey = (config.mpesa_consumer_key || '').trim();
  const consumerSecret = (config.mpesa_consumer_secret || '').trim();
  const shortcode = (config.mpesa_shortcode || '').trim();
  const passkey = (config.mpesa_passkey || '').trim();
  if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
    return NextResponse.json({ success: false, error: 'Mpesa credentials not configured' }, { status: 400 });
  }

  const checkoutRequestId = String(body.checkoutRequestId || '').trim();
  if (!checkoutRequestId) {
    return NextResponse.json({ success: false, error: 'checkoutRequestId is required' }, { status: 400 });
  }

  const base = mpesaBase(config.mpesa_environment);
  const timestamp = darajaTimestamp();

  let token: string;
  try {
    token = await getMpesaToken(base, consumerKey, consumerSecret);
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Daraja authentication failed' }, { status: 502 });
  }

  try {
    const res = await fetch(`${base}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: stkPassword(shortcode, passkey, timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    // ResultCode 0 → the customer paid. Anything else (incl. "being processed"
    // errorCode 500.001) is reported back verbatim for the POS to display.
    const paid = String(data.ResultCode ?? '') === '0';
    return NextResponse.json({
      success: paid,
      paid,
      ResultCode: data.ResultCode ?? null,
      ResultDesc: data.ResultDesc || data.errorMessage || data.ResponseDescription || '',
      ResponseCode: data.ResponseCode ?? null,
      ResponseDescription: data.ResponseDescription || '',
      errorMessage: data.errorMessage || null,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Daraja status query failed' }, { status: 502 });
  }
}

// ─────────────────────────────────────────────────────────────
// M-Pesa callback — UNAUTHENTICATED (Safaricom server → us)
// POST /api/payments-integration?action=mpesa-callback
// Body: { Body: { stkCallback: { ResultCode, ResultDesc, CheckoutRequestID,
//          CallbackMetadata: { Item: [{ Name, Value }] } } } }
// ─────────────────────────────────────────────────────────────
interface DarajaCallbackItem { Name?: string; Value?: string | number }
interface DarajaStkCallback {
  ResultCode?: number | string;
  ResultDesc?: string;
  CheckoutRequestID?: string;
  MerchantRequestID?: string;
  CallbackMetadata?: { Item?: DarajaCallbackItem[] };
}

async function handleMpesaCallback(body: Record<string, unknown>): Promise<NextResponse> {
  const stk = (body as { Body?: { stkCallback?: DarajaStkCallback } })?.Body?.stkCallback;
  const resultCode = stk?.ResultCode;
  const checkoutId = String(stk?.CheckoutRequestID || '');

  // Flatten CallbackMetadata Item list → { Amount, MpesaReceiptNumber, … }
  const meta: Record<string, string | number> = {};
  for (const item of stk?.CallbackMetadata?.Item || []) {
    if (item?.Name) meta[item.Name] = item.Value ?? '';
  }

  await db.auditLog.create({
    data: {
      userId: null,
      action: 'MPESA_CALLBACK',
      entityName: 'Payment',
      entityId: checkoutId,
      details: JSON.stringify({
        ResultCode: resultCode ?? null,
        ResultDesc: stk?.ResultDesc || '',
        CheckoutRequestID: checkoutId,
        MerchantRequestID: stk?.MerchantRequestID || '',
        ...meta,
      }),
      ipAddress: '',
    },
  }).catch(() => {});

  // Daraja expects a 200 with ResultCode 0 acknowledgement.
  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Success — callback received' });
}

// ─────────────────────────────────────────────────────────────
// PesaPal v3 helpers
// ─────────────────────────────────────────────────────────────

function pesapalBase(env: string): string {
  return env === 'production' ? 'https://pay.pesapal.com' : 'https://cyb.pesapal.com';
}

/** PesaPal v3 OAuth — POST {base}/v3/api/Auth/RequestToken {consumer_key, consumer_secret}. */
async function getPesapalToken(base: string, consumerKey: string, consumerSecret: string): Promise<string> {
  const res = await fetch(`${base}/v3/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  const token = data.token as string | undefined;
  if (!res.ok || !token) {
    const err = (data.error as { message?: string } | undefined)?.message || data.message;
    throw new Error(String(err || `PesaPal authentication failed (${res.status})`));
  }
  return token;
}

/** Get-or-register the IPN id for the configured pesapal_ipn_url (cached in config). */
async function ensurePesapalIpnId(base: string, token: string, config: Record<string, string>): Promise<string> {
  const cached = (config.pesapal_ipn_id || '').trim();
  if (cached) return cached;
  const ipnUrl = (config.pesapal_ipn_url || '').trim();
  if (!ipnUrl) return '';
  const res = await fetch(`${base}/v3/api/URLSetup/RegisterIPN`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: 'GET' }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  const ipnId = String(data.ipn_id || data.IPNId || '');
  if (ipnId) {
    await db.companyConfig.upsert({
      where: { key: 'pesapal_ipn_id' },
      create: { key: 'pesapal_ipn_id', value: ipnId },
      update: { value: ipnId },
    }).catch(() => {});
  }
  return ipnId;
}

async function handlePesapalSubmitOrder(
  request: NextRequest,
  auth: { user: { id: string } },
  config: Record<string, string>,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const consumerKey = (config.pesapal_consumer_key || '').trim();
  const consumerSecret = (config.pesapal_consumer_secret || '').trim();
  if (!consumerKey || !consumerSecret) {
    return NextResponse.json({ success: false, error: 'PesaPal credentials not configured' }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return NextResponse.json({ success: false, error: 'A positive amount is required' }, { status: 400 });
  }

  const base = pesapalBase(config.pesapal_environment);
  const origin = new URL(request.url).origin;

  let token: string;
  try {
    token = await getPesapalToken(base, consumerKey, consumerSecret);
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'PesaPal authentication failed' }, { status: 502 });
  }

  // IPN notification id — registered once from the configured pesapal_ipn_url.
  const notificationId = await ensurePesapalIpnId(base, token, config).catch(() => '');

  const orderRef = `MC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const phone = normalizePhone(String(body.phone || ''));
  const email = String(body.email || '').trim() || (config.company_email || '').trim();
  const description = String(body.description || 'Payment').slice(0, 100);
  const callbackUrl = String(body.callbackUrl || `${origin}/cashier`).trim();

  try {
    const res = await fetch(`${base}/v3/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        id: orderRef,
        currency: 'KES',
        amount: Math.round(amount * 100) / 100,
        description,
        callback_url: callbackUrl,
        notification_id: notificationId,
        billing_address: {
          email_address: email,
          phone_number: phone ? `+${phone}` : '',
          first_name: String(body.firstName || 'Walk-in'),
          last_name: String(body.lastName || 'Customer'),
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    const redirectUrl = String(data.redirect_url || data.redirect_iframe_url || '');
    if (!res.ok || !redirectUrl) {
      const err = (data.error as { message?: string } | undefined)?.message || data.message;
      return NextResponse.json({ success: false, error: String(err || `PesaPal order submission failed (${res.status})`) }, { status: 502 });
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'PESAPAL_ORDER_SUBMITTED',
        entityName: 'Payment',
        entityId: orderRef,
        details: `PesaPal card checkout ${amount} — order ${orderRef} (${config.pesapal_environment === 'production' ? 'production' : 'sandbox'})`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      orderRef,
      orderTrackingId: data.order_tracking_id || '',
      redirectUrl,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'PesaPal order submission failed' }, { status: 502 });
  }
}

// ─────────────────────────────────────────────────────────────
// POST — action router
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      body = {};
    }
    const action = String(body.action || new URL(request.url).searchParams.get('action') || '');

    // Daraja result callback — external, no Bearer token available.
    if (action === 'mpesa-callback') return handleMpesaCallback(body);

    const auth = await requireAuth(request, PAY_ROLES);
    if (auth instanceof NextResponse) return auth;

    const config = await getConfigMap();

    switch (action) {
      case 'mpesa-stk-push':
        return handleStkPush(request, auth, config, body);
      case 'mpesa-stk-status':
        return handleStkStatus(config, body);
      case 'pesapal-submit-order':
        return handlePesapalSubmitOrder(request, auth, config, body);
      default:
        return NextResponse.json({ success: false, error: 'Unknown action — expected mpesa-stk-push | mpesa-stk-status | mpesa-callback | pesapal-submit-order' }, { status: 400 });
    }
  } catch (error) {
    console.error('POST /api/payments-integration error:', error);
    return NextResponse.json({ success: false, error: 'Payments integration request failed' }, { status: 500 });
  }
}
