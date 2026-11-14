'use client';

/**
 * PREMIUM MODAL — hero header (icon + title + blinking red X close)
 * + hero footer (description left, actions right). DEVELOPER-MANUAL §6.4.
 */

import * as React from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PremiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: React.ReactNode;
  description?: string;
  footerNote?: string;
  children: React.ReactNode;
  submitLabel?: string;
  submitIcon?: React.ReactNode;
  onSubmit?: () => void | Promise<void>;
  submitVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
  secondaryLabel?: string;
  onSecondary?: () => void;
  submitDisabled?: boolean;
  submitting?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Optional extra content rendered in the footer actions row (e.g. Reset link). */
  extraFooter?: React.ReactNode;
}

const sizeClass = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-[95vw]',
};

export function PremiumModal({
  open, onOpenChange, title, icon, description, footerNote, children,
  submitLabel, submitIcon, onSubmit, submitVariant = 'default',
  secondaryLabel, onSecondary, submitDisabled, submitting, size = 'md', extraFooter,
}: PremiumModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Single red close button only — shadcn's built-in X is disabled here */}
      <DialogContent showCloseButton={false} className={cn(sizeClass[size], 'p-0 overflow-hidden gap-0 max-h-[92vh] flex flex-col')}>
        {/* Hero header */}
        <div className="mc-card-header px-5 py-4 flex items-center gap-3 shrink-0">
          {icon && <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center">{icon}</div>}
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-white font-semibold text-base truncate">{title}</DialogTitle>
            {description && <DialogDescription className="text-white/70 text-xs mt-0.5">{description}</DialogDescription>}
          </div>
          <button
            type="button"
            aria-label="Close"
            className="mc-close-blink h-8 w-8 shrink-0 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-transform hover:scale-105"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 flex-1 min-h-0">
          {children}
        </div>

        {/* Hero footer */}
        <div className="border-t bg-[var(--mc-bg-card)] px-5 py-3 flex items-center gap-3 shrink-0">
          {extraFooter}
          <p className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
            {footerNote || description || title}
          </p>
          <div className="flex items-center gap-2">
            {secondaryLabel && (
              <Button variant="outline" size="sm" onClick={onSecondary || (() => onOpenChange(false))} disabled={submitting}>
                {secondaryLabel}
              </Button>
            )}
            {submitLabel && onSubmit && (
              <Button size="sm" variant={submitVariant} onClick={onSubmit} disabled={submitDisabled || submitting}>
                {submitting ? 'Working…' : submitLabel}
                {submitIcon}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
