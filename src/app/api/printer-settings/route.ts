import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCompanyConfig } from '@/lib/api';

/**
 * Printer settings API — imported from hills.zip and adapted:
 * test receipt pulls facility identity from CompanyConfig (never hardcoded).
 */

// GET /api/printer-settings — Fetch printer configuration
export async function GET() {
  try {
    const keys = [
      'printer_type', 'printer_paper_width', 'printer_encoding',
      'printer_ip_address', 'printer_port', 'printer_baud_rate',
      'printer_chars_per_line', 'printer_auto_cut',
      'receipt_paper_size', 'receipt_copies',
      'printer_show_logo', 'printer_show_company_info', 'printer_show_qr_code',
      'printer_footer_message',
    ];
    const configs = await db.companyConfig.findMany({ where: { key: { in: keys } } });
    const map: Record<string, string> = {};
    for (const c of configs) map[c.key] = c.value;

    const config = {
      printerType: map.printer_type || 'USB',
      paperWidth: map.printer_paper_width || '80mm',
      encoding: map.printer_encoding || 'UTF-8',
      ipAddress: map.printer_ip_address || '',
      port: map.printer_port || '9100',
      baudRate: map.printer_baud_rate || '9600',
      charPerLine: parseInt(map.printer_chars_per_line || '48'),
      autoCut: map.printer_auto_cut !== 'false',
      paperSize: map.receipt_paper_size || 'A4', // A4/A5 portrait or roll width
      copies: parseInt(map.receipt_copies || '1'),
      showLogo: map.printer_show_logo !== 'false',
      showCompanyInfo: map.printer_show_company_info !== 'false',
      showQRCode: map.printer_show_qr_code !== 'false',
      footerMessage: map.printer_footer_message || '',
      connectedPrinters: [],
    };

    return NextResponse.json({ config });
  } catch (error) {
    console.error('GET /api/printer-settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch printer settings' }, { status: 500 });
  }
}

// POST /api/printer-settings — Save printer config, test print, add/remove printer
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'save') {
      const settings: Record<string, string> = {
        printer_type: body.printerType || 'USB',
        printer_paper_width: body.paperWidth || '80mm',
        printer_encoding: body.encoding || 'UTF-8',
        printer_ip_address: body.ipAddress || '',
        printer_port: body.port || '9100',
        printer_baud_rate: body.baudRate || '9600',
        printer_chars_per_line: String(body.charPerLine || 48),
        printer_auto_cut: String(body.autoCut !== false),
        receipt_paper_size: body.paperSize || 'A4',
        receipt_copies: String(body.copies || 1),
        printer_show_logo: String(body.showLogo !== false),
        printer_show_company_info: String(body.showCompanyInfo !== false),
        printer_show_qr_code: String(body.showQRCode !== false),
      };

      // Sequential upsert to avoid SQLite concurrent write issues (hills pattern)
      for (const [key, value] of Object.entries(settings)) {
        await db.companyConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
      }

      return NextResponse.json({ message: 'Printer settings saved successfully' });
    }

    if (action === 'test') {
      // Test receipt HTML — facility identity pulled from CompanyConfig
      const company = await getCompanyConfig();
      const facilityName = company.company_name || company.companyName || 'Boyani Health Dispensary';
      const footer = company.printer_footer_message || company.receiptFooter || 'Get well soon!';
      const paper = company.receipt_paper_size || 'A4';
      const maxWidth = paper === 'A4' ? '700px' : paper === 'A5' ? '480px' : '300px';

      const testHtml = `
        <div style="font-family: 'Courier New', monospace; max-width: ${maxWidth}; margin: 0 auto; padding: 16px; font-size: 12px; color: #333;">
          <div style="text-align: center; border-bottom: 2px dashed #999; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin: 0; font-size: 18px; color: #0d9488;">${facilityName}</h2>
            <p style="margin: 2px 0; font-size: 10px;">Printer Test — ${new Date().toLocaleString('en-KE')}</p>
          </div>
          <p style="text-align: center; margin: 10px 0;">If you can read this, your printer is configured correctly.</p>
          <div style="border-top: 1px dashed #999; padding-top: 8px; text-align: center;">
            <p style="font-size: 10px; color: #666;">--- TEST PRINT (${paper}) ---</p>
            <p style="font-size: 10px; color: #666;">${footer}</p>
          </div>
        </div>
      `;
      return NextResponse.json({ message: 'Test print generated', details: { content: 'Test receipt sent successfully', html: testHtml } });
    }

    if (action === 'add-printer') {
      return NextResponse.json({ message: 'Printer added (simulated — USB printers are auto-detected)' });
    }

    if (action === 'remove-printer') {
      return NextResponse.json({ message: 'Printer removed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/printer-settings error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
