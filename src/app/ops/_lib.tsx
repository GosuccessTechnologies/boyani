'use client';

/**
 * OPS PORTALS SHARED HELPERS (HR · Inventory · Website Manager) — form
 * primitives, formatters, confirm modal, CSV import controls. Copied &
 * adapted from admin/_lib.tsx pattern (admin/ is another agent's dir).
 * Underscore file = not a route.
 */

import * as React from 'react';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { downloadCsvTemplate, parseCsvTemplate } from '@/lib/client-api';
import { toast } from 'sonner';

// ── Formatters (task-mandated) ──
export const kes = (n: number) => `KSh ${Number(n || 0).toLocaleString('en-KE')}`;
export const fmtDate = (x: unknown) =>
  x ? new Date(x as string).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const fmtDateTime = (x: unknown) =>
  x ? new Date(x as string).toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const num = (n: unknown) => Number(n || 0).toLocaleString('en-KE');

/** ISO yyyy-mm-dd for date inputs */
export const isoDate = (x: unknown) => {
  if (!x) return '';
  const d = new Date(x as string);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

/** Month name for payroll periods etc. */
export const monthName = (m: number) => new Date(2000, Math.max(1, Math.min(12, m)) - 1, 1).toLocaleString('en-KE', { month: 'long' });

/** Human file size */
export const fileSize = (bytes: number) => {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
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

// ── Numbered form section ──
export function FormSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-6 w-6 rounded-full bg-[var(--mc-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">{n}</span>
        <h3 className="text-sm font-bold text-[var(--mc-text-primary)]">{title}</h3>
        <div className="flex-1 h-px bg-[var(--mc-divider)]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

// ── Stat-card skeleton grid ──
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );
}

// ── Confirm modal (delete etc.) built on PremiumModal ──
export function ConfirmModal({ open, onOpenChange, title, message, onConfirm, submitting, confirmLabel = 'Delete' }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; message: string;
  onConfirm: () => void; submitting?: boolean; confirmLabel?: string;
}) {
  return (
    <PremiumModal
      open={open} onOpenChange={onOpenChange} size="sm"
      title={title} icon={<AlertTriangle className="h-5 w-5" />}
      description={message} footerNote={message}
      submitLabel={confirmLabel} submitVariant="destructive" onSubmit={onConfirm}
      secondaryLabel="Cancel" submitting={submitting}
    >
      <p className="text-sm text-[var(--mc-text-secondary)]">{message}</p>
    </PremiumModal>
  );
}

// ── CSV import controls: download template + upload & parse ──
export function CsvImportControls({ templateName, headers, onParsed, note }: {
  templateName: string; headers: string[];
  onParsed: (rows: Array<Record<string, string>>) => void; note?: string;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl border border-dashed border-[var(--mc-divider)] p-3 space-y-1.5 bg-[var(--mc-bg-card)]">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs"
          onClick={() => downloadCsvTemplate(templateName, headers)}>
          <Download className="h-3.5 w-3.5" /> Download CSV template
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs"
          onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Import filled CSV
        </Button>
        <input
          ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={async e => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const rows = await parseCsvTemplate(f);
              if (!rows.length) { toast.error('CSV has no data rows'); return; }
              onParsed(rows);
            } catch {
              toast.error('Failed to parse CSV file');
            } finally {
              e.target.value = '';
            }
          }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">{note || `Template columns: ${headers.join(', ')}`}</p>
    </div>
  );
}

// ── Status badge with colour tones (HR / inventory / website statuses) ──
const BADGE_TONES: Record<string, string> = {
  // greens
  PAID: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  HIRED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  OFFERED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  OPEN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PRESENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  RESOLVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  GOOD: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  IN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  RETURN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  // ambers
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700 border-amber-200',
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  EXPIRED: 'bg-amber-100 text-amber-700 border-amber-200',
  DRAFT: 'bg-amber-100 text-amber-700 border-amber-200',
  LATE: 'bg-amber-100 text-amber-700 border-amber-200',
  HALF_DAY: 'bg-amber-100 text-amber-700 border-amber-200',
  ON_LEAVE: 'bg-amber-100 text-amber-700 border-amber-200',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700 border-amber-200',
  FAIR: 'bg-amber-100 text-amber-700 border-amber-200',
  UNDER_REPAIR: 'bg-amber-100 text-amber-700 border-amber-200',
  // sky
  RECEIVED: 'bg-sky-100 text-sky-700 border-sky-200',
  SCHEDULED: 'bg-sky-100 text-sky-700 border-sky-200',
  SHORTLISTED: 'bg-sky-100 text-sky-700 border-sky-200',
  INTERVIEWED: 'bg-sky-100 text-sky-700 border-sky-200',
  IN_PROGRESS: 'bg-sky-100 text-sky-700 border-sky-200',
  NEW: 'bg-sky-100 text-sky-700 border-sky-200',
  ASSIGN: 'bg-sky-100 text-sky-700 border-sky-200',
  ADJUSTMENT: 'bg-sky-100 text-sky-700 border-sky-200',
  // reds / oranges / purples
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  CLOSED: 'bg-red-100 text-red-700 border-red-200',
  ABSENT: 'bg-red-100 text-red-700 border-red-200',
  SPAM: 'bg-red-100 text-red-700 border-red-200',
  DAMAGED: 'bg-red-100 text-red-700 border-red-200',
  OUT: 'bg-orange-100 text-orange-700 border-orange-200',
  DISPOSE: 'bg-purple-100 text-purple-700 border-purple-200',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = BADGE_TONES[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tone}`}>
      {status ? status.replaceAll('_', ' ') : '—'}
    </span>
  );
}

// ── Small pill toggle for booleans in tables ──
export function BoolPill({ value, trueLabel = 'Yes', falseLabel = 'No' }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
      value ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
    }`}>
      {value ? trueLabel : falseLabel}
    </span>
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

// ── Reusable text/number input with mc-input class ──
export function McInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <Input {...props} className={`mc-input h-9 ${props.className || ''}`} />;
}

export function McTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Textarea {...props} className={`mc-input min-h-[70px] ${props.className || ''}`} />;
}

// ── Uniform branded select ──
export function McSelect({ value, onValueChange, options, placeholder }: {
  value: string;
  onValueChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger className="mc-input h-9 w-full"><SelectValue placeholder={placeholder || 'Select…'} /></SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ── Small labelled switch row (boolean form fields) ──
export function SwitchRow({ label, checked, onCheckedChange, hint }: {
  label: string; checked: boolean; onCheckedChange: (c: boolean) => void; hint?: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] px-3 py-2.5 cursor-pointer">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--mc-text-primary)] leading-tight">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </label>
  );
}

// ── Mini progress bar (category counts, occupancy etc.) ──
export function MiniBar({ value, total, tone = 'primary' }: { value: number; total: number; tone?: 'primary' | 'danger' | 'success' }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const bar = tone === 'danger' ? 'bg-red-500' : tone === 'success' ? 'bg-emerald-500' : 'bg-[var(--mc-primary)]';
  return (
    <div className="w-full h-2 rounded-full bg-[var(--mc-divider)] overflow-hidden">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
