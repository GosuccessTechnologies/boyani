'use client';

/**
 * 6 BREADCRUMB & PAGE HERO HEADER DESIGNS for public pages.
 */

import Link from 'next/link';
import { ChevronRight, Home, Phone, CalendarCheck } from 'lucide-react';
import { useCompany } from '@/hooks/use-company';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbHeroProps {
  title: string;
  items: BreadcrumbItem[];
  designId?: number;
  subtitle?: string;
}

function Crumbs({ items, light }: { items: BreadcrumbItem[]; light?: boolean }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center flex-wrap gap-1.5 text-sm ${light ? 'text-white/70' : 'text-[var(--mc-text-secondary)]'}`}>
      <Link href="/" className={`inline-flex items-center gap-1 ${light ? 'hover:text-white' : 'hover:text-[var(--mc-primary)]'}`}>
        <Home className="h-3.5 w-3.5" /> Home
      </Link>
      {items.map(item => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" />
          {item.href
            ? <Link href={item.href} className={light ? 'hover:text-white' : 'hover:text-[var(--mc-primary)]'}>{item.label}</Link>
            : <span className={light ? 'text-white font-semibold' : 'text-[var(--mc-text-primary)] font-semibold'}>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

// 1: Classic centered on gradient
export function BreadcrumbDesign1({ title, items, subtitle }: BreadcrumbHeroProps) {
  return (
    <section className="mc-gradient-primary text-white py-14">
      <div className="mc-container text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-3">{title}</h1>
        {subtitle && <p className="text-white/80 max-w-2xl mx-auto mb-4">{subtitle}</p>}
        <div className="flex justify-center"><Crumbs items={items} light /></div>
      </div>
    </section>
  );
}

// 2: Dark image band, left-aligned
export function BreadcrumbDesign2({ title, items, subtitle }: BreadcrumbHeroProps) {
  return (
    <section className="relative bg-[var(--mc-bg-sidebar)] text-white py-12 overflow-hidden">
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=1600&q=60)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div className="relative mc-container">
        <Crumbs items={items} light />
        <h1 className="text-3xl md:text-4xl font-extrabold mt-3">{title}</h1>
        {subtitle && <p className="text-white/75 max-w-2xl mt-2">{subtitle}</p>}
      </div>
    </section>
  );
}

// 3: Minimal light with accent underline
export function BreadcrumbDesign3({ title, items, subtitle }: BreadcrumbHeroProps) {
  return (
    <section className="bg-[var(--mc-bg-card)] border-b border-[var(--mc-divider)] py-10">
      <div className="mc-container">
        <Crumbs items={items} />
        <h1 className="text-3xl md:text-4xl font-extrabold mt-2 text-[var(--mc-text-primary)]">
          {title}<span className="text-[var(--mc-primary)]">.</span>
        </h1>
        {subtitle && <p className="text-[var(--mc-text-secondary)] max-w-2xl mt-2">{subtitle}</p>}
      </div>
    </section>
  );
}

// 4: Split — title left, CTA right
export function BreadcrumbDesign4({ title, items, subtitle }: BreadcrumbHeroProps) {
  return (
    <section className="bg-white border-b border-[var(--mc-divider)] py-9">
      <div className="mc-container flex items-center justify-between gap-6 flex-wrap">
        <div>
          <Crumbs items={items} />
          <h1 className="text-3xl md:text-4xl font-extrabold mt-2 text-[var(--mc-text-primary)]">{title}</h1>
          {subtitle && <p className="text-[var(--mc-text-secondary)] max-w-xl mt-1.5">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
          <Link href="/booking" className="inline-flex items-center gap-2 rounded-full mc-gradient-primary text-white px-5 py-2.5 text-sm font-bold shadow"><CalendarCheck className="h-4 w-4" /> Book Appointment</Link>
        </div>
      </div>
    </section>
  );
}

// 5: Curve bottom
export function BreadcrumbDesign5({ title, items, subtitle }: BreadcrumbHeroProps) {
  return (
    <section className="mc-gradient-primary text-white pt-12 pb-20 rounded-b-[3rem]">
      <div className="mc-container text-center">
        <div className="flex justify-center"><Crumbs items={items} light /></div>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-3">{title}</h1>
        {subtitle && <p className="text-white/80 max-w-2xl mx-auto mt-2">{subtitle}</p>}
      </div>
    </section>
  );
}

// 6: Pattern band with contact strip
export function BreadcrumbDesign6({ title, items, subtitle }: BreadcrumbHeroProps) {
  // Dynamic facility contacts — never hardcoded (Instruction 2).
  const { company } = useCompany();
  const phone = company.emergencyPhone || company.companyPhone;
  return (
    <section className="bg-[var(--mc-bg-sidebar)] text-white">
      <div className="mc-container py-10 flex items-center justify-between gap-6 flex-wrap">
        <div>
          <Crumbs items={items} light />
          <h1 className="text-3xl md:text-4xl font-extrabold mt-2">{title}</h1>
          {subtitle && <p className="text-white/70 max-w-xl mt-2">{subtitle}</p>}
        </div>
        <a href={`tel:${phone}`} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 rounded-full px-5 py-2.5 font-bold text-sm">
          <Phone className="h-4 w-4" /> Emergency {phone}
        </a>
      </div>
      <div className="h-1.5 mc-gradient-primary" />
    </section>
  );
}

export const BREADCRUMB_DESIGNS = [BreadcrumbDesign1, BreadcrumbDesign2, BreadcrumbDesign3, BreadcrumbDesign4, BreadcrumbDesign5, BreadcrumbDesign6];

export function BreadcrumbHero({ designId = 1, ...props }: BreadcrumbHeroProps) {
  const idx = Math.min(Math.max(designId, 1), BREADCRUMB_DESIGNS.length) - 1;
  const Component = BREADCRUMB_DESIGNS[idx];
  return <Component {...props} />;
}
