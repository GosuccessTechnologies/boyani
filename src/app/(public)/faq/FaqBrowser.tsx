'use client';

/**
 * FAQ BROWSER — category tabs + accordion (same plain button+state pattern
 * as the homepage FaqAccordionWidget).
 */

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, HelpCircle } from 'lucide-react';

export interface PublicFaq {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'General',
  BILLING: 'Billing',
  APPOINTMENTS: 'Appointments',
  INSURANCE: 'Insurance',
  PHARMACY: 'Pharmacy',
  VISITING: 'Visiting Hours',
};

export default function FaqBrowser({ faqs }: { faqs: PublicFaq[] }) {
  const [category, setCategory] = React.useState('');
  const [open, setOpen] = React.useState<string | null>(faqs[0]?.id || null);

  const categories = React.useMemo(() => [...new Set(faqs.map(f => f.category))], [faqs]);
  const filtered = category ? faqs.filter(f => f.category === category) : faqs;

  if (!faqs.length) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--mc-divider)] bg-white p-12 text-center text-[var(--mc-text-secondary)]">
        No FAQs published yet — <a href="/contact" className="text-[var(--mc-primary)] font-semibold hover:underline">ask us directly</a>.
      </p>
    );
  }

  return (
    <div>
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setCategory('')}
          className={`rounded-full px-4 py-2 text-xs font-bold border transition-colors ${!category ? 'mc-gradient-primary text-white border-transparent shadow' : 'border-[var(--mc-divider)] bg-white text-[var(--mc-text-secondary)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)]'}`}
        >
          All questions ({faqs.length})
        </button>
        {categories.map(c => (
          <button
            key={c}
            onClick={() => {
              const next = category === c ? '' : c;
              setCategory(next);
              const nextList = next ? faqs.filter(f => f.category === next) : faqs;
              setOpen(nextList[0]?.id || null);
            }}
            className={`rounded-full px-4 py-2 text-xs font-bold border transition-colors ${category === c ? 'mc-gradient-primary text-white border-transparent shadow' : 'border-[var(--mc-divider)] bg-white text-[var(--mc-text-secondary)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)]'}`}
          >
            {CATEGORY_LABELS[c] || c.replaceAll('_', ' ')} ({faqs.filter(f => f.category === c).length})
          </button>
        ))}
      </div>

      {/* Accordion */}
      <div className="space-y-3">
        {filtered.map(f => (
          <div key={f.id} className="rounded-xl border border-[var(--mc-divider)] bg-white overflow-hidden">
            <button
              onClick={() => setOpen(o => (o === f.id ? null : f.id))}
              aria-expanded={open === f.id}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left font-semibold text-[var(--mc-text-primary)] hover:bg-[var(--mc-bg-card)] transition-colors"
            >
              <span className="flex items-center gap-3">
                <HelpCircle className="h-4 w-4 text-[var(--mc-primary)] shrink-0" />
                {f.question}
              </span>
              <ChevronRight className={`h-5 w-5 shrink-0 text-[var(--mc-primary)] transition-transform ${open === f.id ? 'rotate-90' : ''}`} />
            </button>
            {open === f.id && (
              <div className="px-5 pb-4 pl-12 text-sm text-[var(--mc-text-secondary)] leading-relaxed">{f.answer}</div>
            )}
          </div>
        ))}
      </div>

      {/* Still have questions */}
      <div className="mt-10 rounded-2xl mc-gradient-primary text-white p-8 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div>
          <h2 className="text-xl font-extrabold">Still have questions?</h2>
          <p className="text-white/80 text-sm mt-1">Our front office answers inquiries within one working day.</p>
        </div>
        <Link href="/contact" className="inline-flex items-center gap-2 rounded-full bg-white text-[var(--mc-primary-dark)] px-6 py-3 font-bold shadow hover:-translate-y-0.5 transition-transform shrink-0">
          Contact us
        </Link>
      </div>
    </div>
  );
}
