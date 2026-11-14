'use client';

/**
 * STAT CARD v2 — premium design with light tinted backgrounds that
 * alternate slowly (Instruction 14/16). Each accent renders a soft pastel
 * wash + matching icon chip; the background gently breathes between two
 * tints via the `mc-stat-shift` keyframes defined in globals.css.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  hint?: string;
  trend?: number; // % change
  accent?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
  /** Disable the background breathing animation (e.g. print views). */
  flat?: boolean;
}

/** Light tint pairs: [base, alternate] — animated slowly between. */
const accentTints: Record<string, { base: string; alt: string; chip: string; ring: string }> = {
  primary: { base: 'color-mix(in srgb, var(--mc-primary) 8%, white)', alt: 'color-mix(in srgb, var(--mc-primary) 16%, white)', chip: 'bg-[var(--mc-primary)]', ring: 'color-mix(in srgb, var(--mc-primary) 28%, transparent)' },
  secondary: { base: 'color-mix(in srgb, var(--mc-secondary) 8%, white)', alt: 'color-mix(in srgb, var(--mc-secondary) 16%, white)', chip: 'bg-[var(--mc-secondary)]', ring: 'color-mix(in srgb, var(--mc-secondary) 28%, transparent)' },
  tertiary: { base: 'color-mix(in srgb, var(--mc-tertiary) 8%, white)', alt: 'color-mix(in srgb, var(--mc-tertiary) 16%, white)', chip: 'bg-[var(--mc-tertiary)]', ring: 'color-mix(in srgb, var(--mc-tertiary) 28%, transparent)' },
  success: { base: '#F0FDF4', alt: '#DCFCE7', chip: 'bg-emerald-600', ring: 'rgba(5, 150, 105, 0.28)' },
  warning: { base: '#FFFBEB', alt: '#FEF3C7', chip: 'bg-amber-500', ring: 'rgba(217, 119, 6, 0.28)' },
  danger: { base: '#FEF2F2', alt: '#FEE2E2', chip: 'bg-red-600', ring: 'rgba(220, 38, 38, 0.28)' },
  info: { base: '#EFF6FF', alt: '#DBEAFE', chip: 'bg-blue-600', ring: 'rgba(37, 99, 235, 0.28)' },
};

export function StatCard({ label, value, icon, hint, trend, accent = 'primary', onClick, flat }: StatCardProps) {
  const t = accentTints[accent] || accentTints.primary;
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-[var(--mc-divider)] p-4 shadow-sm overflow-hidden transition-all',
        'bg-white',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
      )}
      onClick={onClick}
    >
      {/* Breathing tint layer — alternates infinitely at a slow speed */}
      {!flat && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 mc-stat-shift"
          style={{ ['--mc-stat-tint-base' as string]: t.base, ['--mc-stat-tint-alt' as string]: t.alt }}
        />
      )}
      {!flat && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl opacity-70"
          style={{ background: t.ring }}
        />
      )}

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[var(--mc-text-secondary)] uppercase tracking-wider truncate">{label}</p>
          <p className="text-2xl font-extrabold mt-1 text-[var(--mc-text-primary)] truncate">{value}</p>
          <div className="flex items-center gap-1 mt-1 min-h-[18px]">
            {trend !== undefined && (
              <span className={cn('inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full', trend >= 0 ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100')}>
                {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
            )}
            {hint && <span className="text-[11px] text-[var(--mc-text-muted)] truncate">{hint}</span>}
          </div>
        </div>
        {icon && (
          <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md', t.chip)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
