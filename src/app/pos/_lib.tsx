'use client';

/**
 * POS PORTALS SHARED HELPERS — used by the Pharmacy POS, Cashier POS and
 * Attendance PWA. Copied & adapted from clinical/_lib.tsx (that module belongs
 * to the clinical portals; POS portals keep their own copy per task mandate).
 *
 * Extra POS-specific helpers:
 *  - PosNav      : nav pills strip (PortalShell "pos" layout renders no nav)
 *  - printReceipt: content-only printable receipt window with facility hero
 *                  header from /api/company + paper size from /api/printer-settings
 *  - stockTone   : drug stock badge colour helper
 */

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiGet } from '@/lib/client-api';

// ── Formatters (task-mandated) ──
export const kes = (n: number) => `KSh ${Number(n || 0).toLocaleString('en-KE')}`;
export const fmtDate = (x: unknown) =>
  x ? new Date(x as string).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const fmtDateTime = (x: unknown) =>
  x ? new Date(x as string).toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtTime = (x: unknown) =>
  x ? new Date(x as string).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '—';
export const num = (n: unknown) => Number(n || 0).toLocaleString('en-KE');

/** Patient full-name helper */
export const pname = (p?: { firstName?: string; lastName?: string; patientNo?: string } | null) =>
  p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.patientNo || '—' : '—';

/** ISO yyyy-mm-dd for date inputs */
export const isoDate = (x?: unknown) => {
  const d = x ? new Date(x as string) : new Date();
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

/** Current month as YYYY-MM for month pickers */
export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ── Field: label with small lucide icon + control ──
export function Field({ icon, label, children, hint, className }: {
  icon: React.ReactNode; label: string; children: React.ReactNode; hint?: string; className?: string;
}) {
  return (
    <div className={className ? `space-y-1.5 ${className}` : 'space-y-1.5'}>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--mc-text-secondary)]">
        <span className="text-[var(--mc-primary)]">{icon}</span>{label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Stat-card skeleton grid ──
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-[var(--mc-bg-card)] animate-pulse border border-[var(--mc-divider)]" />
      ))}
    </div>
  );
}

// ── Page heading block ──
export function PageHeading({ icon, title, subtitle, actions }: {
  icon: React.ReactNode; title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
      <div className="h-11 w-11 rounded-xl mc-gradient-primary flex items-center justify-center text-white shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-bold text-[var(--mc-text-primary)] leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── POS nav pills — PortalShell "pos" layout renders no nav of its own ──
export interface PosNavItem { label: string; href: string; icon?: React.ReactNode }

export function PosNav({ items }: { items: PosNavItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto no-print">
      {items.map(item => {
        const active = pathname === item.href;
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => router.push(item.href)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
              active
                ? 'bg-[var(--mc-primary)] text-white shadow'
                : 'text-[var(--mc-text-secondary)] hover:bg-[var(--mc-primary-light)]'
            )}
          >
            {item.icon}{item.label}
          </button>
        );
      })}
    </nav>
  );
}

// ── Small pill toggle for booleans in tables ──
export function BoolPill({ value, trueLabel = 'Yes', falseLabel = 'No' }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
      value ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-500 border-slate-200'
    }`}>
      {value ? trueLabel : falseLabel}
    </span>
  );
}

// ── Status badge with POS + attendance tones ──
const BADGE_TONES: Record<string, string> = {
  // greens
  PAID: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PRESENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  DISPENSED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  // ambers
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700 border-amber-200',
  PARTIALLY_DISPENSED: 'bg-amber-100 text-amber-700 border-amber-200',
  LATE: 'bg-amber-100 text-amber-700 border-amber-200',
  HALF_DAY: 'bg-amber-100 text-amber-700 border-amber-200',
  UNPAID: 'bg-amber-100 text-amber-700 border-amber-200',
  // sky
  BILLED: 'bg-sky-100 text-sky-700 border-sky-200',
  CHECKED_IN: 'bg-sky-100 text-sky-700 border-sky-200',
  READY_FOR_PAYMENT: 'bg-sky-100 text-sky-700 border-sky-200',
  PRESCRIBED: 'bg-sky-100 text-sky-700 border-sky-200',
  WAITING_LAB: 'bg-sky-100 text-sky-700 border-sky-200',
  WAITING_DOCTOR: 'bg-sky-100 text-sky-700 border-sky-200',
  WAITING_PHARMACY: 'bg-sky-100 text-sky-700 border-sky-200',
  // reds
  ABSENT: 'bg-red-100 text-red-700 border-red-200',
  ON_LEAVE: 'bg-red-100 text-red-700 border-red-200',
  // purples / slates
  BILLED_TO_VISIT: 'bg-purple-100 text-purple-700 border-purple-200',
  FACILITY: 'bg-purple-100 text-purple-700 border-purple-200',
  PERSONAL: 'bg-slate-100 text-slate-600 border-slate-200',
  OWN_TODAY: 'bg-slate-100 text-slate-600 border-slate-200',
  ALL_HISTORY: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = BADGE_TONES[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tone}`}>
      {status ? status.replaceAll('_', ' ') : '—'}
    </span>
  );
}

/** Payment method badge (CASH/MPESA/CARD/SHA/MIXED) */
export function MethodBadge({ method }: { method: string }) {
  const tones: Record<string, string> = {
    CASH: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    MPESA: 'bg-red-100 text-red-700 border-red-200',
    CARD: 'bg-sky-100 text-sky-700 border-sky-200',
    SHA: 'bg-purple-100 text-purple-700 border-purple-200',
    MIXED: 'bg-amber-100 text-amber-700 border-amber-200',
    BILLED_TO_VISIT: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const tone = tones[method] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tone}`}>
      {method ? method.replaceAll('_', ' ') : '—'}
    </span>
  );
}

/** Department badge for bill items */
export function DeptBadge({ dept }: { dept: string }) {
  const tones: Record<string, string> = {
    Pharmacy: 'bg-amber-100 text-amber-700 border-amber-200',
    Laboratory: 'bg-purple-100 text-purple-700 border-purple-200',
    Admission: 'bg-sky-100 text-sky-700 border-sky-200',
    Clinical: 'bg-teal-100 text-teal-700 border-teal-200',
    Consultation: 'bg-teal-100 text-teal-700 border-teal-200',
  };
  const tone = tones[dept] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${tone}`}>
      {dept || '—'}
    </span>
  );
}

/** Stock badge colour tone for drug cards */
export function stockTone(stock: number): 'out' | 'low' | 'mid' | 'ok' {
  if (stock <= 0) return 'out';
  if (stock <= 10) return 'low';
  if (stock <= 50) return 'mid';
  return 'ok';
}

export function StockBadge({ stock }: { stock: number }) {
  const tones = {
    out: 'bg-red-100 text-red-700 border-red-200',
    low: 'bg-red-100 text-red-700 border-red-200',
    mid: 'bg-amber-100 text-amber-700 border-amber-200',
    ok: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  } as const;
  const labels = { out: 'Out of stock', low: `Low · ${stock}`, mid: `${stock} in stock`, ok: `${stock} in stock` } as const;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tones[stockTone(stock)]}`}>
      {labels[stockTone(stock)]}
    </span>
  );
}

/** Uniform branded select (native select — POS-friendly, no portal deps) */
export function McSelect({ value, onValueChange, options, placeholder, className }: {
  value: string; onValueChange: (v: string) => void;
  options: Array<{ value: string; label: string }>; placeholder?: string; className?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onValueChange(e.target.value)}
      className={`mc-input h-9 w-full px-2.5 text-sm bg-white ${className || ''}`}
    >
      <option value="">{placeholder || 'Select…'}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Reusable text/number input with mc-input class ──
export function McInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`mc-input h-9 px-3 text-sm ${props.className || ''}`} />;
}

// ─────────────────────────────────────────────────────────────
// PRINTABLE RECEIPT — content-only window with facility hero header
// from /api/company; paper size (A4/A5/roll) from /api/printer-settings
// (DEVELOPER-MANUAL §6.7 — never app chrome, never hardcoded facility data)
// ─────────────────────────────────────────────────────────────

export interface ReceiptLine {
  name: string;
  qty?: number;
  unitPrice?: number;
  total: number;
  meta?: string; // department / dosage / extra note
}

export interface PrintReceiptOpts {
  title: string;
  receiptNo: string;
  meta: Array<[string, string]>; // [label, value] e.g. ['Patient', 'John Doe']
  lines: ReceiptLine[];
  totals: Array<[string, string]>; // ordered; last one is the grand total
  paymentNote?: string; // e.g. 'PAID VIA MPESA'
  /** Cash change calculator (Instruction 17) — rendered under the totals as
   *  "Tendered: X / Change: Y" when both values are provided. */
  tendered?: number;
  change?: number;
}

interface PrinterCfg {
  config?: {
    paperSize?: string;
    copies?: number;
    showLogo?: boolean;
    showCompanyInfo?: boolean;
    footerMessage?: string;
  };
}

const esc = (s: string) => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export async function printReceipt(opts: PrintReceiptOpts): Promise<void> {
  // Facility identity + printer settings (both public GETs) — never hardcoded
  const [companyRes, printerRes] = await Promise.all([
    apiGet<{ config?: Record<string, string> }>('/api/company').catch(() => ({ config: {} } as { config?: Record<string, string> })),
    apiGet<PrinterCfg>('/api/printer-settings').catch(() => ({ config: {} } as PrinterCfg)),
  ]);
  const cfg = companyRes.config || {};
  const printer = printerRes.config || {};

  const facilityName = cfg.companyName || cfg.company_name || 'Boyani Health Dispensary';
  const tagline = cfg.companyTagline || cfg.company_slogan || '';
  const address = cfg.companyAddress || cfg.company_address || '';
  const phone = cfg.companyPhone || cfg.company_phone || '';
  const email = cfg.companyEmail || cfg.company_email || '';
  const website = cfg.companyWebsite || cfg.company_website || '';
  const kraPin = cfg.kraPin || cfg.kra_pin || '';
  const logoUrl = cfg.logoUrl || cfg.company_logo || '/logo.svg';
  const footer = printer.footerMessage || cfg.receiptFooter || cfg.printer_footer_message || '';

  const paper = (printer.paperSize || 'A4').toUpperCase();
  const isRoll = paper !== 'A4' && paper !== 'A5';
  const maxWidth = paper === 'A4' ? '760px' : paper === 'A5' ? '540px' : '320px';
  const fontFamily = isRoll
    ? `'Courier New', monospace`
    : `'Segoe UI', Arial, sans-serif`;

  const logoHtml = printer.showLogo !== false && logoUrl
    ? `<img src="${esc(logoUrl)}" alt="logo" style="height:52px;object-fit:contain" />`
    : '';

  const companyHtml = printer.showCompanyInfo !== false ? `
    <div style="font-size:11px;color:#475569;line-height:1.5;margin-top:4px">
      ${address ? `<div>${esc(address)}</div>` : ''}
      ${phone ? `<div>Tel: ${esc(phone)}${email ? ` · ${esc(email)}` : ''}</div>` : ''}
      ${website ? `<div>${esc(website)}</div>` : ''}
      ${kraPin ? `<div>KRA PIN: ${esc(kraPin)}</div>` : ''}
    </div>` : '';

  const metaRows = opts.meta
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `<tr><td style="color:#64748b">${esc(k)}:</td><td style="text-align:right;font-weight:600">${esc(String(v))}</td></tr>`)
    .join('');

  const lineRows = opts.lines.map(l => `
    <tr>
      <td>${esc(l.name)}${l.meta ? `<div style="font-size:10px;color:#94a3b8">${esc(l.meta)}</div>` : ''}</td>
      ${opts.lines.some(x => x.qty !== undefined) ? `<td style="text-align:center">${l.qty ?? 1}</td>` : ''}
      ${opts.lines.some(x => x.unitPrice !== undefined) ? `<td style="text-align:right">${l.unitPrice !== undefined ? kes(l.unitPrice) : '—'}</td>` : ''}
      <td style="text-align:right;font-weight:600">${kes(l.total)}</td>
    </tr>`).join('');

  const hasQty = opts.lines.some(x => x.qty !== undefined);
  const hasPrice = opts.lines.some(x => x.unitPrice !== undefined);

  const totalRows = opts.totals.map(([k, v], i) => {
    const last = i === opts.totals.length - 1;
    return `<tr>
      <td colspan="${1 + (hasQty ? 1 : 0) + (hasPrice ? 1 : 0)}" style="text-align:right;${last ? 'font-weight:800;font-size:15px;color:#0f766e' : 'color:#475569'}">${esc(k)}</td>
      <td style="text-align:right;${last ? 'font-weight:800;font-size:15px;color:#0f766e' : 'font-weight:600'}">${esc(v)}</td>
    </tr>`;
  }).join('');

  const copies = Math.max(1, printer.copies || 1);

  // Cash change calculator rows — "Tendered: X / Change: Y" (Instruction 17)
  const hasTender = opts.tendered !== undefined && opts.change !== undefined && !isNaN(opts.tendered) && !isNaN(opts.change);
  const tenderSpan = 1 + (hasQty ? 1 : 0) + (hasPrice ? 1 : 0);
  const tenderHtml = hasTender
    ? `<tr>
        <td colspan="${tenderSpan}" style="text-align:right;color:#475569">Amount Tendered</td>
        <td style="text-align:right;font-weight:600">${kes(opts.tendered as number)}</td>
      </tr>
      <tr>
        <td colspan="${tenderSpan}" style="text-align:right;color:#475569">Change</td>
        <td style="text-align:right;font-weight:800">${kes(opts.change as number)}</td>
      </tr>`
    : '';

  const html = `<!DOCTYPE html><html><head><title>${esc(opts.title)} ${esc(opts.receiptNo)}</title>
    <style>
      @page { size: ${paper === 'A4' ? 'A4' : paper === 'A5' ? 'A5' : '80mm'} portrait; margin: 12mm; }
      body { font-family: ${fontFamily}; color: #0f172a; margin: 0; padding: 16px; }
      .sheet { max-width: ${maxWidth}; margin: 0 auto; }
      .hero { text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 12px; margin-bottom: 14px; }
      .hero h1 { margin: 6px 0 2px; font-size: 22px; color: #0d9488; letter-spacing: 0.5px; }
      .hero .tagline { font-size: 11px; color: #64748b; margin: 0; }
      .title { text-align: center; font-size: 14px; font-weight: 800; letter-spacing: 2px; margin: 10px 0 12px; color: #0f172a; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .meta td { padding: 2px 4px; }
      .items th { background: #134e4a; color: #fff; padding: 7px 8px; text-align: left; font-size: 11px; letter-spacing: 0.5px; }
      .items td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
      .totals td { padding: 4px 8px; }
      .paynote { text-align: center; margin-top: 10px; font-size: 12px; font-weight: 700; color: #0f766e; }
      .footer { text-align: center; margin-top: 18px; border-top: 2px dashed #94a3b8; padding-top: 10px; font-size: 11px; color: #64748b; }
      .copies-note { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 8px; }
      @media print { .no-print { display: none; } .toolbar { display: none; } }
      .toolbar { text-align: center; margin-bottom: 14px; }
      .toolbar button { padding: 8px 18px; border: none; border-radius: 6px; background: #0d9488; color: #fff; font-weight: 600; cursor: pointer; }
    </style></head><body>
    <div class="toolbar no-print">
      <button onclick="window.print()">Print Receipt</button>
    </div>
    <div class="sheet">
      <div class="hero">
        ${logoHtml}
        <h1>${esc(facilityName)}</h1>
        ${tagline ? `<p class="tagline">${esc(tagline)}</p>` : ''}
        ${companyHtml}
      </div>
      <div class="title">${esc(opts.title)}</div>
      <table class="meta">
        <tr><td style="color:#64748b">Receipt No:</td><td style="text-align:right;font-weight:700">${esc(opts.receiptNo || '—')}</td></tr>
        ${metaRows}
        <tr><td style="color:#64748b">Date:</td><td style="text-align:right;font-weight:600">${new Date().toLocaleString('en-KE')}</td></tr>
      </table>
      <table class="items" style="margin-top:12px">
        <thead><tr>
          <th>Item</th>
          ${hasQty ? '<th style="text-align:center">Qty</th>' : ''}
          ${hasPrice ? '<th style="text-align:right">Unit Price</th>' : ''}
          <th style="text-align:right">Amount</th>
        </tr></thead>
        <tbody>${lineRows}</tbody>
      </table>
      <table class="totals" style="margin-top:10px">${totalRows}${tenderHtml}</table>
      ${opts.paymentNote ? `<div class="paynote">${esc(opts.paymentNote)}</div>` : ''}
      ${footer ? `<div class="footer">${esc(footer)}</div>` : ''}
      ${copies > 1 ? `<div class="copies-note">Print ${copies} cop${copies > 1 ? 'ies' : 'y'} for facility &amp; patient records</div>` : ''}
    </div>
    <script>window.onload = function () { setTimeout(function () { window.print(); }, 350); };</script>
    </body></html>`;

  const win = window.open('', '_blank', 'width=820,height=900');
  if (!win) {
    toast.error('Popup blocked — allow popups to print the receipt');
    return;
  }
  win.document.write(html);
  win.document.close();
}
