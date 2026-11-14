import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/company  — facility configuration
 * PUT /api/company  — update configuration (ADMIN only)
 */

const DEFAULT_COMPANY_CONFIG: Record<string, string> = {
  companyName: 'Boyani Health Dispensary',
  companyTagline: 'Quality Care, Compassionate Service',
  companyEmail: 'info@africandivinechurch.org',
  companyPhone: '0750239057',
  emergencyPhone: '0750239057',
  companyAddress: 'Boyani, Vihiga County',
  companyPostalAddress: 'Vihiga, Kenya',
  companyWebsite: 'https://www.boyanihealth.africandivinechurch.org',
  currency: 'KES',
  currencySymbol: 'KSh',
  taxRate: '16',
  enableTax: 'false',
  posTaxEnabled: 'false',
  posTaxRate: '16',
  posAllowBargaining: 'false',
  posFixedPrice: 'true',
  posDefaultCurrency: 'KES',
  posReceiptPrefix: 'BHD',
  kraPin: '',
  receiptPaperSize: 'A4', // A4 portrait | A5 portrait | 80mm | 58mm
  receiptCopies: '1',
  receiptFooter: 'Thank you for choosing Boyani Health Dispensary. Get well soon!',
  logoUrl: '/logo.svg',
  themeColor: '#0d9488',
  openingHours: 'Mon–Sat 08:00–20:00',
  mapLatitude: '0.0659',
  mapLongitude: '34.7180',
};

// Map camelCase frontend keys to snake_case DB keys (pattern retained from hills)
const KEY_MAP_CAMEL_TO_SNAKE: Record<string, string> = {
  companyName: 'company_name',
  companyTagline: 'company_slogan',
  logoUrl: 'company_logo',
  faviconUrl: 'company_favicon',
  companyEmail: 'company_email',
  companyPhone: 'company_phone',
  emergencyPhone: 'emergency_phone',
  companyAddress: 'company_address',
  companyPostalAddress: 'company_postal_address',
  companyWebsite: 'company_website',
  openingHours: 'opening_hours',
  currency: 'currency',
  currencySymbol: 'currency_symbol',
  mapLatitude: 'company_latitude',
  mapLongitude: 'company_longitude',
  mapZoom: 'company_map_zoom',
  socialFacebook: 'company_facebook',
  socialTwitter: 'company_twitter',
  socialInstagram: 'company_instagram',
  socialLinkedIn: 'company_linkedin',
  socialYouTube: 'company_youtube',
  socialTikTok: 'company_tiktok',
  socialWhatsApp: 'company_whatsapp',
  printerType: 'printer_type',
  printerPaperWidth: 'printer_paper_width',
  printerCharsPerLine: 'printer_chars_per_line',
  printerShowLogo: 'printer_show_logo',
  printerShowCompanyInfo: 'printer_show_company_info',
  printerShowQRCode: 'printer_show_qr_code',
  receiptFooter: 'printer_footer_message',
  kraPin: 'kra_pin',
  receiptPaperSize: 'receipt_paper_size',
  receiptCopies: 'receipt_copies',
  posAllowBargaining: 'pos_allow_bargaining',
  posFixedPrice: 'pos_fixed_price',
  posDefaultCurrency: 'pos_default_currency',
  posTaxRate: 'pos_tax_rate',
  posTaxEnabled: 'pos_tax_enabled',
  posReceiptPrefix: 'pos_receipt_prefix',
};

const KEY_MAP_SNAKE_TO_CAMEL: Record<string, string> = {};
for (const [camel, snake] of Object.entries(KEY_MAP_CAMEL_TO_SNAKE)) {
  KEY_MAP_SNAKE_TO_CAMEL[snake] = camel;
}

function toSnakeCase(camelKey: string): string {
  return KEY_MAP_CAMEL_TO_SNAKE[camelKey] || camelKey;
}

function toCamelCase(snakeKey: string): string {
  return KEY_MAP_SNAKE_TO_CAMEL[snakeKey] || snakeKey;
}

// GET - Get all facility config (PUBLIC — needed by public website)
export async function GET(request: NextRequest) {
  try {
    const configs = await db.companyConfig.findMany();
    const snakeMap: Record<string, string> = {};
    for (const c of configs) snakeMap[c.key] = c.value;

    const configMap: Record<string, string> = {};
    for (const [snakeKey, value] of Object.entries(snakeMap)) {
      const camelKey = toCamelCase(snakeKey);
      configMap[camelKey] = value;
      configMap[snakeKey] = value; // backward compatibility
    }
    for (const [key, value] of Object.entries(DEFAULT_COMPANY_CONFIG)) {
      if (!(key in configMap)) configMap[key] = value;
    }

    if (new URL(request.url).searchParams.get('format') === 'settings') {
      return NextResponse.json({ settings: configs.map(c => ({ key: c.key, value: c.value })) });
    }
    // `company` mirrors `config` — legacy consumers (use-company hook, login page,
    // document-print, login-designs, admin documents) read `company`; newer code
    // reads `config`. Both point at the same map so nothing is hardcoded.
    return NextResponse.json({ success: true, company: configMap, config: configMap, settings: configs.map(c => ({ key: c.key, value: c.value })) });
  } catch (error) {
    console.error('GET /api/company error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch facility settings' }, { status: 500 });
  }
}

// PUT - Update facility config (ADMIN only)
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    let rawSettings: Record<string, string> = {};

    if (body.key && body.value !== undefined) {
      rawSettings[toSnakeCase(body.key)] = String(body.value);
    } else if (body.settings && typeof body.settings === 'object') {
      // camelCase source wins over stale snake_case echo (fix retained from hills)
      const pending: Record<string, { value: string; fromCamelCase: boolean }> = {};
      for (const [srcKey, value] of Object.entries(body.settings)) {
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue;
        const snakeKey = toSnakeCase(srcKey);
        const fromCamelCase = KEY_MAP_CAMEL_TO_SNAKE[srcKey] !== undefined;
        const existing = pending[snakeKey];
        if (!existing || (fromCamelCase && !existing.fromCamelCase)) {
          pending[snakeKey] = { value: String(value), fromCamelCase };
        }
      }
      for (const [snakeKey, info] of Object.entries(pending)) rawSettings[snakeKey] = info.value;
    } else {
      return NextResponse.json({ success: false, error: 'Provide {key, value} or {settings: {...}}' }, { status: 400 });
    }

    // Sequential upsert to avoid SQLite concurrent write issues (hills pattern)
    let updated = 0;
    for (const [key, value] of Object.entries(rawSettings)) {
      await db.companyConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
      updated++;
    }

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'COMPANY_CONFIG_UPDATE',
        entityName: 'CompanyConfig',
        details: `Updated ${updated} facility settings`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error('PUT /api/company error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update facility settings' }, { status: 500 });
  }
}
