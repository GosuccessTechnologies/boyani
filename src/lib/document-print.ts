'use client';

/**
 * UNIVERSAL DOCUMENT PRINTING (Instruction 19)
 * Generates print-ready HTML documents with the facility letterhead
 * (10 selectable designs) and document backgrounds (color / image /
 * watermark / page size) configured in CompanyConfig. Used across ALL
 * modules for PDF printing & downloads — receipts keep their own style.
 */

export interface DocFacility {
  name: string;
  slogan: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logoUrl: string;
  website: string;
}

export interface DocBackgroundConfig {
  enabled: boolean;
  type: 'color' | 'image' | 'watermark';
  color: string;
  image: string;
  watermarkText: string;
  watermarkOpacity: number;
  pageSize: 'A4' | 'A5' | 'LETTER';
}

export interface DocPrintOptions {
  title: string;
  docId?: string;
  docDate?: string;
  facility: DocFacility;
  letterheadDesign: number; // 1..10
  background: DocBackgroundConfig;
  accentColor?: string;
  bodyHtml: string;
  footerNote?: string;
  copies?: number;
}

const PAGE_SIZES: Record<string, string> = {
  A4: '210mm 297mm',
  A5: '148mm 210mm',
  LETTER: '216mm 279mm',
};

function esc(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The 10 letterhead designs. Each returns HTML for the top of the document. */
function letterheadHtml(o: DocPrintOptions): string {
  const accent = o.accentColor || '#0d9488';
  const f = o.facility;
  const logo = `<img src="${esc(f.logoUrl && f.logoUrl !== '/favicon.svg' ? f.logoUrl : '/logo.svg')}" alt="" style="height:52px;width:52px;object-fit:cover;border-radius:10px" />`;
  const contact = `${esc(f.address)}${f.city ? `, ${esc(f.city)}` : ''} · ${esc(f.phone)} · ${esc(f.email)}`;

  switch (Math.min(Math.max(o.letterheadDesign || 1, 1), 10)) {
    case 1: // Classic centered
      return `<div style="text-align:center;padding-bottom:14px;border-bottom:3px double ${accent};margin-bottom:22px">
        <div style="display:flex;align-items:center;justify-content:center;gap:14px">${logo}
          <div style="text-align:left"><div style="font-size:22px;font-weight:800;color:#0f172a">${esc(f.name)}</div>
          <div style="font-size:11px;color:#64748b;letter-spacing:1px">${esc(f.slogan)}</div></div></div>
        <div style="font-size:10.5px;color:#475569;margin-top:8px">${contact}</div></div>`;
    case 2: // Left banner strip
      return `<div style="display:flex;gap:16px;align-items:center;background:linear-gradient(90deg,${accent}12,transparent);border-left:6px solid ${accent};padding:14px 16px;margin-bottom:22px">
        ${logo}<div style="flex:1"><div style="font-size:21px;font-weight:800;color:#0f172a">${esc(f.name)}</div>
        <div style="font-size:11px;color:#64748b">${esc(f.slogan)}</div>
        <div style="font-size:10.5px;color:#475569;margin-top:4px">${contact}</div></div></div>`;
    case 3: // Full color band
      return `<div style="background:linear-gradient(120deg,${accent},${accent}cc);color:#fff;padding:18px 22px;border-radius:12px 12px 0 0;margin:-18px -22px 22px;display:flex;align-items:center;gap:14px">
        ${logo}<div style="flex:1"><div style="font-size:22px;font-weight:800">${esc(f.name)}</div>
        <div style="font-size:11px;opacity:.85">${esc(f.slogan)}</div></div>
        <div style="font-size:10px;text-align:right;opacity:.85">${esc(f.phone)}<br/>${esc(f.email)}</div></div>`;
    case 4: // Minimal rule
      return `<div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:10px;border-bottom:2px solid ${accent};margin-bottom:22px">
        <div style="display:flex;gap:12px;align-items:center">${logo}<div><div style="font-size:20px;font-weight:800;color:#0f172a">${esc(f.name)}</div>
        <div style="font-size:10.5px;color:#64748b">${esc(f.slogan)}</div></div></div>
        <div style="font-size:10px;color:#475569;text-align:right">${esc(f.phone)}<br/>${esc(f.email)}</div></div>`;
    case 5: // Boxed crest
      return `<div style="border:2px solid ${accent};border-radius:14px;padding:14px 18px;margin-bottom:22px;display:flex;align-items:center;gap:14px">
        ${logo}<div style="flex:1"><div style="font-size:21px;font-weight:800;color:${accent}">${esc(f.name)}</div>
        <div style="font-size:10.5px;color:#475569">${contact}</div></div>
        <div style="font-size:9px;color:#94a3b8;text-align:right">${esc(f.website || '')}</div></div>`;
    case 6: // Two-tone split
      return `<div style="margin-bottom:22px">
        <div style="display:flex;align-items:center;gap:14px;padding-bottom:10px">${logo}
          <div><div style="font-size:22px;font-weight:800;color:#0f172a">${esc(f.name)}</div>
          <div style="font-size:11px;color:${accent};font-weight:600">${esc(f.slogan)}</div></div></div>
        <div style="height:4px;background:linear-gradient(90deg,${accent} 0%,${accent} 45%,#e2e8f0 45%,#e2e8f0 100%);border-radius:2px"></div>
        <div style="font-size:10px;color:#64748b;margin-top:6px">${contact}</div></div>`;
    case 7: // Sidebar accent bar
      return `<div style="display:flex;gap:0;margin-bottom:22px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="width:8px;background:${accent}"></div>
        <div style="flex:1;padding:14px 18px;display:flex;align-items:center;gap:14px">${logo}
          <div><div style="font-size:21px;font-weight:800;color:#0f172a">${esc(f.name)}</div>
          <div style="font-size:10.5px;color:#475569">${contact}</div></div></div></div>`;
    case 8: // Watermark crest top
      return `<div style="text-align:center;margin-bottom:22px;position:relative">
        <div style="position:absolute;top:0;left:0;font-size:42px;font-weight:900;color:${accent}18;letter-spacing:2px">${esc(f.name.toUpperCase())}</div>
        <div style="position:relative;display:inline-flex;align-items:center;gap:12px;padding-top:18px">${logo}
          <div style="text-align:left"><div style="font-size:20px;font-weight:800;color:#0f172a">${esc(f.name)}</div>
          <div style="font-size:10px;color:#64748b">${esc(f.slogan)}</div></div></div>
        <div style="font-size:10px;color:#475569;margin-top:6px">${contact}</div></div>`;
    case 9: // Modern gradient line
      return `<div style="margin-bottom:22px">
        <div style="display:flex;align-items:center;gap:14px">${logo}
          <div style="flex:1"><div style="font-size:22px;font-weight:800;color:#0f172a">${esc(f.name)}</div>
          <div style="font-size:10.5px;color:#64748b">${contact}</div></div></div>
        <div style="margin-top:10px;height:3px;border-radius:99px;background:linear-gradient(90deg,${accent},${accent}55,transparent)"></div></div>`;
    case 10: // Bold header block
    default:
      return `<div style="background:#0f172a;color:#fff;padding:20px 22px;margin:-18px -22px 22px;display:flex;align-items:center;gap:16px">
        ${logo}<div style="flex:1"><div style="font-size:22px;font-weight:800;letter-spacing:.5px">${esc(f.name)}</div>
        <div style="font-size:11px;color:${accent};font-weight:600">${esc(f.slogan)}</div></div>
        <div style="font-size:10px;text-align:right;opacity:.75">${esc(f.address)}${f.city ? `, ${esc(f.city)}` : ''}<br/>${esc(f.phone)} · ${esc(f.email)}</div></div>`;
  }
}

/** Background layer CSS per DocBackgroundConfig (image/color/watermark). */
function backgroundHtml(bg: DocBackgroundConfig): { style: string; layer: string } {
  if (!bg.enabled) return { style: '', layer: '' };
  if (bg.type === 'image' && bg.image) {
    return {
      style: '',
      layer: `<div style="position:fixed;inset:0;z-index:0;background:url('${esc(bg.image)}') center/cover;opacity:0.10;pointer-events:none"></div>`,
    };
  }
  if (bg.type === 'watermark') {
    return {
      style: bg.color && bg.color !== '#FFFFFF' ? `background:${esc(bg.color)};` : '',
      layer: `<div style="position:fixed;inset:0;z-index:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
        <div style="transform:rotate(-32deg);font-size:64px;font-weight:900;color:rgba(15,23,42,${Number(bg.watermarkOpacity) || 0.06});letter-spacing:6px;white-space:nowrap">${esc(bg.watermarkText || '')}</div></div>`,
    };
  }
  // color
  return { style: `background:${esc(bg.color || '#ffffff')};`, layer: '' };
}

/** Builds the complete printable HTML document. */
export function buildDocumentHtml(o: DocPrintOptions): string {
  const bg = backgroundHtml(o.background);
  const size = PAGE_SIZES[o.background.pageSize] || PAGE_SIZES.A4;
  const meta = [
    o.docId ? `<div><span style="color:#64748b">Ref:</span> <b>${esc(o.docId)}</b></div>` : '',
    o.docDate ? `<div><span style="color:#64748b">Date:</span> <b>${esc(o.docDate)}</b></div>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${esc(o.title)}</title>
<style>
  @page { size: ${size}; margin: 16mm 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color:#0f172a; margin:0; ${bg.style} }
  .doc-content { position:relative; z-index:1; padding: 12px 22px 22px; }
  .doc-title { text-align:center; font-size:16px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; color:#0f172a;
    background:${o.accentColor || '#0d9488'}18; border:1px solid ${o.accentColor || '#0d9488'}55; border-radius:8px; padding:8px 12px; margin:0 auto 18px; max-width:420px }
  .doc-meta { display:flex; gap:18px; justify-content:center; font-size:11px; margin-bottom:18px; flex-wrap:wrap }
  table.data { width:100%; border-collapse:collapse; font-size:11.5px; margin:10px 0 }
  table.data th { background:${o.accentColor || '#0d9488'}15; text-align:left; padding:7px 9px; border:1px solid #e2e8f0; font-weight:700; color:#334155 }
  table.data td { padding:7px 9px; border:1px solid #e2e8f0; vertical-align:top }
  h1,h2,h3 { margin:14px 0 8px; color:#0f172a }
  p { margin:8px 0; line-height:1.65 }
  .section-title { font-size:13px; font-weight:800; color:${o.accentColor || '#0d9488'}; text-transform:uppercase; letter-spacing:1px;
    border-bottom:2px solid ${o.accentColor || '#0d9488'}33; padding-bottom:4px; margin:20px 0 10px }
  .doc-footer { margin-top:28px; padding-top:10px; border-top:1px solid #e2e8f0; font-size:9.5px; color:#94a3b8; text-align:center }
  .signature-row { display:flex; justify-content:space-between; margin-top:48px; gap:40px }
  .signature-box { flex:1; text-align:center; font-size:10.5px; color:#475569 }
  .signature-box .line { border-top:1.5px dotted #64748b; margin-bottom:5px; padding-top:26px }
  @media print { .no-print { display:none } }
</style></head>
<body>
${bg.layer}
<div class="doc-content">
  ${letterheadHtml(o)}
  <div class="doc-title">${esc(o.title)}</div>
  ${meta ? `<div class="doc-meta">${meta}</div>` : ''}
  ${o.bodyHtml}
  <div class="signature-row">
    <div class="signature-box"><div class="line"></div>Prepared / Authorized by</div>
    <div class="signature-box"><div class="line"></div>Official Stamp</div>
  </div>
  <div class="doc-footer">${esc(o.footerNote || `${o.facility.name} · ${o.facility.address}${o.facility.city ? `, ${o.facility.city}` : ''} · ${o.facility.phone}`)}${o.copies && o.copies > 1 ? ` · Copies: ${o.copies}` : ''}</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
</body></html>`;
}

/** Fetch facility + doc background config then print a document. */
export async function printUniversalDocument(opts: {
  title: string;
  docId?: string;
  docDate?: string;
  bodyHtml: string;
  footerNote?: string;
  accentColor?: string;
}) {
  const [companyRes, printerRes] = await Promise.all([
    fetch('/api/company').then(r => r.json()).catch(() => ({})),
    fetch('/api/printer-settings').then(r => r.json()).catch(() => ({})),
  ]);
  const c = companyRes.company || {};
  const g = (k: string, d: string) => (typeof c[k] === 'string' && c[k] ? c[k] : d);

  const facility: DocFacility = {
    name: g('companyName', 'Boyani Health Dispensary'),
    slogan: g('companySlogan', 'Quality Care, Compassionate Service'),
    address: g('companyAddress', 'Boyani, Vihiga County'),
    city: g('companyCity', 'Vihiga'),
    phone: g('companyPhone', '0750239057'),
    email: g('companyEmail', 'info@africandivinechurch.org'),
    logoUrl: g('logoUrl', ''),
    website: g('companyWebsite', ''),
  };
  const background: DocBackgroundConfig = {
    enabled: g('doc_bg_enabled', 'false') === 'true',
    type: (g('doc_bg_type', 'color') as DocBackgroundConfig['type']) || 'color',
    color: g('doc_bg_color', '#FFFFFF'),
    image: g('doc_bg_image', ''),
    watermarkText: g('doc_bg_watermark_text', facility.name),
    watermarkOpacity: Number(g('doc_bg_watermark_opacity', '0.06')),
    pageSize: (g('doc_bg_page_size', 'A4') as DocBackgroundConfig['pageSize']) || 'A4',
  };
  const letterheadDesign = Number(g('doc_letterhead_design', '1')) || 1;

  const html = buildDocumentHtml({
    title: opts.title,
    docId: opts.docId,
    docDate: opts.docDate || new Date().toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' }),
    facility,
    letterheadDesign,
    background,
    accentColor: opts.accentColor || g('doc_letterhead_color', '#0d9488'),
    bodyHtml: opts.bodyHtml,
    footerNote: opts.footerNote,
  });

  const w = window.open('', '_blank', 'width=880,height=1000');
  if (!w) { alert('Please allow popups to print documents.'); return; }
  w.document.write(html);
  w.document.close();
}

/** Section title helper for bodyHtml composition. */
export function docSection(title: string): string {
  return `<div class="section-title">${esc(title)}</div>`;
}

/** Key-value table helper. */
export function docTable(rows: Array<[string, string]>): string {
  return `<table class="data">${rows.map(([k, v]) => `<tr><th style="width:32%">${esc(k)}</th><td>${v}</td></tr>`).join('')}</table>`;
}

/** Generic records table helper. */
export function docRecordsTable(headers: string[], rows: string[][]): string {
  return `<table class="data"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
