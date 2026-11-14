'use client';

/**
 * CLINICAL PORTALS SHARED HELPERS — form primitives, formatters, confirm modal,
 * CSV import controls. Copied & adapted from admin/_lib.tsx pattern (admin/ is
 * another agent's dir). Used by the doctor / registrar / nursing / lab portals.
 */

import * as React from 'react';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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

/** Age in years from a dateOfBirth value */
export const age = (dob: unknown) => {
  if (!dob) return '—';
  const d = new Date(dob as string);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a < 0 ? 0 : a;
};

/** ISO yyyy-mm-dd for date inputs */
export const isoDate = (x: unknown) => {
  if (!x) return '';
  const d = new Date(x as string);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

/** Patient full-name helper */
export const pname = (p?: { firstName?: string; lastName?: string; patientNo?: string } | null) =>
  p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.patientNo || '—' : '—';

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

// ── Confirm modal (destructive actions) built on PremiumModal ──
export function ConfirmModal({ open, onOpenChange, title, message, onConfirm, submitting, confirmLabel = 'Confirm' }: {
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

// ── Status badge with colour tones (clinical statuses included) ──
const BADGE_TONES: Record<string, string> = {
  // greens
  PAID: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ACCEPTED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  VERIFIED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CONFIRMED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  AVAILABLE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  DISPENSED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  DISCHARGED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  NORMAL: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  // ambers
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700 border-amber-200',
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  EXPIRED: 'bg-amber-100 text-amber-700 border-amber-200',
  PARTIALLY_DISPENSED: 'bg-amber-100 text-amber-700 border-amber-200',
  SAMPLE_COLLECTED: 'bg-amber-100 text-amber-700 border-amber-200',
  RESERVED: 'bg-amber-100 text-amber-700 border-amber-200',
  AWAITING_RESULTS: 'bg-amber-100 text-amber-700 border-amber-200',
  URGENT: 'bg-amber-100 text-amber-700 border-amber-200',
  // sky
  RECEIVED: 'bg-sky-100 text-sky-700 border-sky-200',
  SENT: 'bg-sky-100 text-sky-700 border-sky-200',
  SCHEDULED: 'bg-sky-100 text-sky-700 border-sky-200',
  IN_PROGRESS: 'bg-sky-100 text-sky-700 border-sky-200',
  CHECKED_IN: 'bg-sky-100 text-sky-700 border-sky-200',
  WAITING_LAB: 'bg-sky-100 text-sky-700 border-sky-200',
  WAITING_DOCTOR: 'bg-sky-100 text-sky-700 border-sky-200',
  WAITING_PHARMACY: 'bg-sky-100 text-sky-700 border-sky-200',
  PRESCRIBED: 'bg-sky-100 text-sky-700 border-sky-200',
  READY_FOR_PAYMENT: 'bg-sky-100 text-sky-700 border-sky-200',
  ROUTINE: 'bg-sky-100 text-sky-700 border-sky-200',
  // reds
  UNPAID: 'bg-red-100 text-red-700 border-red-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  STAT: 'bg-red-100 text-red-700 border-red-200',
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-red-100 text-red-700 border-red-200',
  OCCUPIED: 'bg-red-100 text-red-700 border-red-200',
  EMERGENCY: 'bg-red-100 text-red-700 border-red-200',
  // purples / slates
  CONVERTED_TO_BILL: 'bg-purple-100 text-purple-700 border-purple-200',
  MAINTENANCE: 'bg-slate-100 text-slate-600 border-slate-200',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200',
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
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

// ── Mini progress bar (ward occupancy etc.) ──
export function MiniBar({ value, total, tone = 'primary' }: { value: number; total: number; tone?: 'primary' | 'danger' | 'success' }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const bar = tone === 'danger' ? 'bg-red-500' : tone === 'success' ? 'bg-emerald-500' : 'bg-[var(--mc-primary)]';
  return (
    <div className="w-full h-2 rounded-full bg-[var(--mc-divider)] overflow-hidden">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
