'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

/**
 * ROOT ERROR BOUNDARY — catches unexpected errors anywhere in the app and
 * offers a retry instead of the bare Next.js "This page couldn't load"
 * fallback (Instruction 3). Must be a client component.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for server logs / browser console diagnostics.
    console.error('Public page error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 bg-[var(--mc-bg-body)]">
      <div className="text-center max-w-xl">
        <div className="mx-auto h-20 w-20 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center mb-6">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--mc-text-primary)]">
          Something went wrong
        </h1>
        <p className="text-[var(--mc-text-secondary)] mt-3">
          We hit an unexpected problem loading this page. Please try again —
          if the issue persists, contact us and we&apos;ll help you right away.
        </p>
        {error?.digest && (
          <p className="text-xs text-[var(--mc-text-muted)] mt-2">Reference: {error.digest}</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full mc-gradient-primary text-white px-6 py-3 font-bold shadow hover:-translate-y-0.5 transition-transform"
          >
            <RotateCcw className="h-4 w-4" /> Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--mc-divider)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)] px-6 py-3 font-bold transition-colors"
          >
            <Home className="h-4 w-4" /> Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
