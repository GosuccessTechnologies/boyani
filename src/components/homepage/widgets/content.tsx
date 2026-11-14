'use client';

/**
 * HOMEPAGE WIDGETS — CONTENT BATCH (14 modules)
 * SERVICES_GRID, DEPARTMENTS_MEGA, ABOUT_SPLIT, WHY_CHOOSE_US, MCH_HIGHLIGHT,
 * MATERNITY_SHOWCASE, LAB_SHOWCASE, PHARMACY_SHOWCASE, ADMISSION_INFO,
 * VALUES_CARDS, VISION_MISSION_SPLIT, TIMELINE_HISTORY, PRICING_TABLES, HEALTH_TIPS
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Baby, BedDouble, FlaskConical, Pill, ShieldCheck, HeartHandshake, Sparkles, Award, Target, Eye, Siren, Stethoscope, ChevronRight, CheckCircle2, Syringe, Microscope, ScanLine, Ambulance, Clock, Users, HardHat, Brain } from 'lucide-react';
import { WidgetProps, SectionHead } from './core';

const IconFor = ({ name, className }: { name?: string | null; className?: string }) => {
  const map: Record<string, any> = { Siren, Stethoscope, Baby, FlaskConical, Pill, ScanLine, HeartPulse: HeartHandshake, Brain, Scissors: Syringe, BedDouble, ShieldCheck, HardHat, Microscope, Ambulance, Award, Clock, Users, Target, Eye, Sparkles };
  const Cmp = map[name || ''] || Stethoscope;
  return <Cmp className={className} />;
};

/**
 * SERVICE WIDGETS — WEBSITE MODULE REWIRE (Instruction 6)
 * All service-driven widgets render WebsiteService CMS entries (no pricing);
 * departments are kept only as a grouping/fallback when the CMS is empty.
 */
const findSvc = (data: WidgetProps['data'], slug: string) =>
  (data.websiteServices || []).find((s: any) => s.slug === slug);

/** Normalize WebsiteService entries (departments fallback) into a card shape */
function serviceCards(data: WidgetProps['data'], limit: number) {
  const ws = (data.websiteServices || []).slice(0, limit);
  if (ws.length) {
    return ws.map((s: any) => ({
      id: s.id, name: s.title, slug: s.slug, description: s.excerpt || '',
      iconKey: s.iconKey, color: s.department?.color || 'var(--mc-primary)',
      count: (s.subServices || []).length, featuredImage: s.featuredImage || '',
      href: `/services/${s.slug}`,
    }));
  }
  return (data.departments || []).slice(0, limit).map((d: any) => ({
    id: d.id, name: d.name, slug: d.slug, description: d.description || '',
    iconKey: d.iconKey, color: d.color || 'var(--mc-primary)',
    count: d._count?.services || 0, featuredImage: '', href: '/services',
  }));
}

// ═══ SERVICES_GRID — 3 variants (cards / icon tiles / image cards) — WebsiteService CMS ═══
export function ServicesGridWidget({ data, variant = 1, title, subtitle }: WidgetProps) {
  const cards = serviceCards(data, variant === 2 ? 12 : 9);
  const head = <SectionHead title={title || 'Our Services & Centres of Excellence'} subtitle={subtitle || 'Comprehensive care across every stage of life — from emergency response to lifelong chronic care.'} />;

  if (variant === 2) {
    return (
      <section className="mc-section">
        <div className="mc-container">
          {head}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {cards.map(c => (
              <Link key={c.id} href={c.href} className="group rounded-xl border border-[var(--mc-divider)] bg-white p-4 text-center hover:shadow-lg hover:border-[var(--mc-primary)] transition-all hover:-translate-y-0.5">
                <span className="mx-auto h-11 w-11 rounded-lg flex items-center justify-center text-white mb-2" style={{ background: c.color }}>
                  <IconFor name={c.iconKey} className="h-5 w-5" />
                </span>
                <p className="text-xs font-bold text-[var(--mc-text-primary)] leading-tight group-hover:text-[var(--mc-primary)]">{c.name}</p>
                <p className="text-[10px] text-[var(--mc-text-muted)] mt-1">{c.count} services</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (variant === 3) {
    return (
      <section className="mc-section bg-[var(--mc-bg-card)]">
        <div className="mc-container">
          {head}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c, i) => (
              <Link key={c.id} href={c.href} className="group relative rounded-2xl overflow-hidden h-64 shadow hover:shadow-xl transition-all">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.featuredImage || ['https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=700&q=60', 'https://images.unsplash.com/photo-1551601651-2a85554ed3ca?w=700&q=60', 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=700&q=60', 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=700&q=60', 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=700&q=60', 'https://images.unsplash.com/photo-1530026405186-ed1f13931350?w=700&q=60'][i % 6]} alt={c.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 p-5 text-white">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-secondary)] mb-1">{c.count} services</p>
                  <h3 className="font-extrabold text-lg leading-tight">{c.name}</h3>
                  <p className="text-xs text-white/70 line-clamp-2 mt-1">{c.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mc-section">
      <div className="mc-container">
        {head}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(c => (
            <Link key={c.id} href={c.href} className="group rounded-2xl border border-[var(--mc-divider)] bg-white p-6 hover:shadow-xl hover:border-[var(--mc-primary)] transition-all hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <span className="h-12 w-12 rounded-xl flex items-center justify-center text-white" style={{ background: c.color }}>
                  <IconFor name={c.iconKey} className="h-6 w-6" />
                </span>
                <ArrowRight className="h-5 w-5 text-[var(--mc-divider)] group-hover:text-[var(--mc-primary)] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-bold text-lg text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)]">{c.name}</h3>
              <p className="text-sm text-[var(--mc-text-secondary)] mt-2 line-clamp-2">{c.description}</p>
              <p className="text-xs font-bold text-[var(--mc-primary)] mt-3">{c.count} services available</p>
            </Link>
          ))}
        </div>
        <div className="text-center mt-8"><Link href="/services" className="inline-flex items-center gap-2 font-bold text-[var(--mc-primary)] hover:underline">Explore all services <ArrowRight className="h-4 w-4" /></Link></div>
      </div>
    </section>
  );
}

// ═══ DEPARTMENTS_MEGA — tabbed mega browser; departments group WebsiteServices ═══
export function DepartmentsMegaWidget({ data, variant, title, subtitle }: WidgetProps) {
  const depts = data.departments;
  const ws = data.websiteServices || [];
  const [tab, setTab] = React.useState(depts[0]?.id || '');
  const active = depts.find((d: any) => d.id === tab);

  // All website services that belong to the active department
  const deptServices: any[] = active ? ws.filter((s: any) => s.departmentId === active.id) : [];

  // Build the flat pill list:
  // For each WebsiteService in this department, spread its subServices as individual pills.
  // If a service has no subServices, fall back to showing the service title itself.
  const pills: Array<{ id: string; label: string; href: string }> = [];
  for (const svc of deptServices) {
    const subs: any[] = svc.subServices || [];
    if (subs.length > 0) {
      for (const sub of subs) {
        pills.push({ id: sub.id, label: sub.title, href: `/services/${svc.slug}` });
      }
    } else {
      // Service exists but has no sub-services — show the service itself as a pill
      pills.push({ id: svc.id, label: svc.title, href: `/services/${svc.slug}` });
    }
  }

  // If the department has no website services at all, show a generic placeholder
  const hasPills = pills.length > 0;
  const activeHref = deptServices[0]?.slug ? `/services/${deptServices[0].slug}` : '/services';

  return (
    <section className="mc-section bg-[var(--mc-bg-card)]">
      <div className="mc-container">
        <SectionHead title={title || 'Explore Our Departments'} subtitle={subtitle || 'Ten centres of excellence under one campus — tap a department to see its services.'} />

        {/* Department tab pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {depts.map((d: any) => (
            <button key={d.id} onClick={() => setTab(d.id)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${tab === d.id ? 'text-white shadow-lg' : 'bg-white border border-[var(--mc-divider)] text-[var(--mc-text-secondary)] hover:border-[var(--mc-primary)]'}`}
              style={tab === d.id ? { background: d.color } : {}}>
              {d.name}
            </button>
          ))}
        </div>

        {active && (
          <div className="rounded-2xl bg-white border border-[var(--mc-divider)] shadow-lg overflow-hidden grid md:grid-cols-3">
            {/* Left: department identity panel */}
            <div className="p-6" style={{ background: `linear-gradient(135deg, ${active.color}, ${active.color}cc)`, color: '#fff' }}>
              <IconFor name={active.iconKey} className="h-10 w-10 mb-3" />
              <h3 className="text-xl font-extrabold">{active.name}</h3>
              <p className="text-sm text-white/80 mt-2 leading-relaxed">{active.description}</p>
              <Link href={activeHref} className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold bg-white/20 hover:bg-white/30 rounded-full px-4 py-2">
                View services <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Right: full grid of all sub-service pills — no slice cap */}
            <div className="md:col-span-2 p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-text-muted)] mb-4">
                Popular services
                {hasPills && <span className="ml-2 text-[var(--mc-primary)] normal-case font-semibold">({pills.length})</span>}
              </p>

              {hasPills ? (
                <div className="flex flex-wrap gap-2">
                  {pills.map(p => (
                    <Link
                      key={p.id}
                      href={p.href}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] hover:border-[var(--mc-primary)] hover:bg-[var(--mc-primary-light)]/40 hover:text-[var(--mc-primary)] px-3.5 py-1.5 text-sm font-medium text-[var(--mc-text-primary)] transition-colors"
                    >
                      {p.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <p className="text-sm text-[var(--mc-text-muted)]">No services listed yet for this department.</p>
                  <Link href="/services" className="mt-3 text-sm font-bold text-[var(--mc-primary)] hover:underline">
                    Browse all services →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ═══ ABOUT_SPLIT ═══
export function AboutSplitWidget({ data, variant, title, subtitle }: WidgetProps) {
  const co = data.company.company_name || 'Boyani Health Dispensary';
  const about = data.webPages.find((p: any) => p.slug === 'about-us');
  return (
    <section className="mc-section">
      <div className="mc-container grid md:grid-cols-2 gap-10 items-center">
        <div className="relative">
          <div className="rounded-2xl overflow-hidden shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=900&q=70" alt={`${co} facility`} className="w-full h-80 object-cover" />
          </div>
          {variant === 2 && (
            <div className="absolute -bottom-6 -right-4 md:-right-6 rounded-2xl mc-gradient-primary text-white p-5 shadow-2xl max-w-[220px]">
              <p className="text-3xl font-extrabold">{data.stats.years}+</p>
              <p className="text-sm text-white/80">years serving Kenyan families</p>
            </div>
          )}
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] px-3 py-1 text-xs font-bold uppercase tracking-wide">About {data.company.company_name}</span>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-3 text-[var(--mc-text-primary)]">{title || (about?.excerpt) || 'A hospital built around families'}</h2>
          <p className="text-[var(--mc-text-secondary)] mt-4 leading-relaxed">{subtitle || (about && about.excerpt) || 'From a trusted pharmacy to a full-service clinic — our founding promise has never changed: modern care for modern health.'}</p>
          <ul className="mt-5 space-y-2.5">
            {['Doctor-led care at every hour', 'Transparent, published pricing', 'ISO-accredited laboratories', 'SHA & private insurance billing'].map(t => (
              <li key={t} className="flex items-center gap-2 text-sm text-[var(--mc-text-secondary)]"><CheckCircle2 className="h-4 w-4 text-[var(--mc-primary)] shrink-0" /> {t}</li>
            ))}
          </ul>
          <Link href="/about" className="mt-6 inline-flex items-center gap-2 rounded-full mc-gradient-primary text-white px-6 py-3 font-bold shadow hover:-translate-y-0.5 transition-transform">Our full story <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>
  );
}

// ═══ WHY_CHOOSE_US ═══
export function WhyChooseUsWidget({ data, variant, title, subtitle }: WidgetProps) {
  const co = data.company.company_name || 'Boyani Health Dispensary';
  const reasons = [
    { icon: Siren, title: '24/7 Doctor-Led Emergency', desc: 'A full trauma team — never a locum-only night shift. Average door-to-doctor time under 8 minutes.' },
    { icon: ShieldCheck, title: 'Transparent Pricing', desc: 'Every service and bed rate is published and honoured. No surprise line items on your bill.' },
    { icon: HeartHandshake, title: 'SHA & Insurance Handled', desc: 'We verify cover at registration and file claims for you — you only settle what your scheme excludes.' },
    { icon: Sparkles, title: 'One Campus, Every Specialty', desc: 'Labs, imaging, pharmacy, theatre and maternity under one roof — no referrals across town.' },
    { icon: Award, title: 'ISO 15189 Accredited Labs', desc: 'Inter-laboratory audited results your doctor can act on the same day.' },
    { icon: BedDouble, title: 'Ward For Every Budget', desc: 'From general wards to executive suites — dignified accommodation at every price point.' },
  ];
  return (
    <section className="mc-section bg-[var(--mc-bg-card)]">
      <div className="mc-container">
        <SectionHead title={title || `Why Choose ${co}`} subtitle={subtitle || 'Six reasons patients across Nairobi trust us with their health.'} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map(r => (
            <div key={r.title} className="rounded-2xl bg-white border border-[var(--mc-divider)] p-6 hover:shadow-lg transition-shadow">
              <span className="h-11 w-11 rounded-xl bg-[var(--mc-primary-light)] text-[var(--mc-primary)] flex items-center justify-center mb-4"><r.icon className="h-5 w-5" /></span>
              <h3 className="font-bold text-[var(--mc-text-primary)]">{r.title}</h3>
              <p className="text-sm text-[var(--mc-text-secondary)] mt-2 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══ MCH_HIGHLIGHT — Maternal & Child Health WebsiteService ═══
export function MchHighlightWidget({ data, variant, title, subtitle }: WidgetProps) {
  const mch = findSvc(data, 'maternal-child-health');
  const checklist = mch?.subServices?.length
    ? mch.subServices.slice(0, 6).map((s: any) => s.title)
    : ['ANC visits from 12 weeks', 'PMTCT counselling & prophylaxis', 'Normal & C-section delivery suites', 'Well-baby growth monitoring', 'Childhood immunisation (KEPI)', 'Family planning services'];
  const href = mch ? `/services/${mch.slug}` : '/services';
  return (
    <section className="mc-section">
      <div className="mc-container">
        <div className="rounded-3xl bg-gradient-to-br from-pink-50 to-rose-100 border border-rose-200 overflow-hidden grid md:grid-cols-2">
          <div className="p-8 md:p-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-wide"><Baby className="h-3.5 w-3.5" /> Maternal & Child Health</span>
            <h2 className="text-2xl md:text-3xl font-extrabold mt-4 text-[var(--mc-text-primary)]">{title || 'Safe beginnings, healthy futures'}</h2>
            <p className="text-[var(--mc-text-secondary)] mt-3">{subtitle || mch?.excerpt || 'Midwife-led antenatal clinics, modern labour suites, a Level-III NICU and free immunisation days — the full continuum of care for mother and child.'}</p>
            <ul className="mt-4 grid sm:grid-cols-2 gap-2 text-sm">
              {checklist.map(t => (
                <li key={t} className="flex items-center gap-2 text-[var(--mc-text-secondary)]"><CheckCircle2 className="h-4 w-4 text-rose-500 shrink-0" /> {t}</li>
              ))}
            </ul>
            <Link href={href} className="mt-6 inline-flex items-center gap-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 font-bold shadow">MCH Clinic Services <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="relative min-h-64">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mch?.featuredImage || 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=900&q=70'} alt="Mother and newborn care" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══ MATERNITY_SHOWCASE — sub-service listings, NO pricing (Instruction 6) ═══
export function MaternityShowcaseWidget({ data, variant, title, subtitle }: WidgetProps) {
  const mch = findSvc(data, 'maternal-child-health');
  const subs = mch?.subServices || [];
  const programmes = subs.length >= 4
    ? [
        { name: 'Antenatal & Pregnancy Care', items: subs.slice(0, Math.ceil(subs.length / 2)).map((s: any) => s.title) },
        { name: 'Delivery, Postnatal & Child Care', items: subs.slice(Math.ceil(subs.length / 2)).map((s: any) => s.title) },
      ]
    : [
        { name: 'Antenatal & Pregnancy Care', items: ['Antenatal clinic visits from 12 weeks', 'Ultrasound dating & growth scans', 'Laboratory profiles on site', 'Birth plan with our midwives'] },
        { name: 'Delivery, Postnatal & Child Care', items: ['Midwife-led normal deliveries', 'Caesarean section capability', 'Postnatal mother & baby reviews', 'Immunisation & well-child clinic'] },
      ];
  const href = mch ? `/services/${mch.slug}` : '/services';
  return (
    <section className="mc-section bg-rose-50">
      <div className="mc-container">
        <SectionHead title={title || 'Maternity Care Programmes'} subtitle={subtitle || mch?.excerpt || 'Structured, midwife-led programmes for the safest start — from first scan to well-child visits.'} />
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {programmes.map((p, i) => (
            <div key={p.name} className={`rounded-2xl bg-white border-2 p-7 ${i === 1 ? 'border-rose-500 shadow-xl relative' : 'border-rose-100'}`}>
              {i === 1 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full">Most booked</span>}
              <h3 className="font-extrabold text-lg text-[var(--mc-text-primary)]">{p.name}</h3>
              <ul className="mt-4 space-y-2">
                {p.items.map(t => <li key={t} className="flex items-center gap-2 text-sm text-[var(--mc-text-secondary)]"><CheckCircle2 className="h-4 w-4 text-rose-400 shrink-0" /> {t}</li>)}
              </ul>
              <Link href={href} className="mt-6 block text-center rounded-full bg-rose-600 hover:bg-rose-700 text-white py-3 font-bold">Explore Maternity Services</Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══ LAB_SHOWCASE — laboratory-diagnostics sub-services, NO pricing ═══
export function LabShowcaseWidget({ data, variant, title, subtitle }: WidgetProps) {
  const co = data.company.company_name || 'Boyani Health Dispensary';
  const lab = findSvc(data, 'laboratory-diagnostics');
  const labServices = lab?.subServices?.length
    ? lab.subServices.slice(0, 8).map((s: any) => ({ id: s.id, name: s.title, desc: s.description }))
    : ['Full blood counts & films', 'Blood sugar & lipid profiles', 'Liver, kidney & electrolytes', 'Cultures & sensitivity', 'Pap smears & biopsies', 'Rapid malaria & pregnancy tests'].map((n, i) => ({ id: `fb-${i}`, name: n, desc: '' }));
  const href = lab ? `/services/${lab.slug}` : '/services';
  return (
    <section className="mc-section">
      <div className="mc-container grid md:grid-cols-2 gap-10 items-center">
        <div className="order-2 md:order-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-100 text-cyan-800 px-3 py-1 text-xs font-bold uppercase tracking-wide"><Microscope className="h-3.5 w-3.5" /> Diagnostics</span>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-3 text-[var(--mc-text-primary)]">{title || 'Answers you can act on — same day'}</h2>
          <p className="text-[var(--mc-text-secondary)] mt-3">{subtitle || lab?.excerpt || 'ISO 15189-accredited laboratory and a modern imaging suite (X-ray, ultrasound, CT, MRI). Results reach your doctor the same day, every day.'}</p>
          <div className="mt-5 grid sm:grid-cols-2 gap-2">
            {labServices.map(s => (
              <Link key={s.id} href={href} className="group rounded-lg border border-[var(--mc-divider)] bg-white px-3 py-2.5 hover:border-[var(--mc-primary)] transition-colors" title={s.desc || s.name}>
                <span className="text-xs font-medium group-hover:text-[var(--mc-primary)] transition-colors">{s.name}</span>
              </Link>
            ))}
          </div>
          <Link href={href} className="mt-6 inline-flex items-center gap-2 font-bold text-[var(--mc-primary)] hover:underline">All diagnostic services <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="order-1 md:order-2 rounded-2xl overflow-hidden shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lab?.featuredImage || 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=900&q=70'} alt={`${co} laboratory`} className="w-full h-80 object-cover" />
        </div>
      </div>
    </section>
  );
}

// ═══ PHARMACY_SHOWCASE — pharmacy-services sub-services ═══
export function PharmacyShowcaseWidget({ data, variant, title, subtitle }: WidgetProps) {
  const pharm = findSvc(data, 'pharmacy-services');
  const icons = [Pill, ShieldCheck, HeartHandshake, Syringe];
  const highlights = pharm?.subServices?.length
    ? pharm.subServices.slice(0, 4).map((s: any, i: number) => ({ icon: icons[i % icons.length], title: s.title, desc: s.description || '' }))
    : [
      { icon: Pill, title: 'Prescription Dispensing', desc: 'New scripts and authorised refills, verified by our pharmacists.' },
      { icon: ShieldCheck, title: 'Genuine Medicine', desc: 'KEMSA-sourced stock with batch tracking and cold-chain storage.' },
      { icon: HeartHandshake, title: 'Free OTC Advice', desc: 'Professional guidance on allergies, pain relief and first aid.' },
      { icon: Syringe, title: 'Immunisations', desc: 'Travel and seasonal vaccines plus B12 and other maintenance injections.' },
    ];
  const href = pharm ? `/services/${pharm.slug}` : '/services';
  return (
    <section className="mc-section bg-emerald-50/50">
      <div className="mc-container">
        <SectionHead title={title || 'Pharmacy Services'} subtitle={subtitle || pharm?.excerpt || 'Open to everyone — walk in for genuine medicine and expert advice, 8am to 9pm daily.'} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map(h => (
            <div key={h.title} className="rounded-2xl bg-white border border-emerald-100 p-6 hover:shadow-lg transition-shadow">
              <span className="h-11 w-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4"><h.icon className="h-5 w-5" /></span>
              <h3 className="font-bold text-[var(--mc-text-primary)]">{h.title}</h3>
              <p className="text-sm text-[var(--mc-text-secondary)] mt-1.5">{h.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-center mt-6 text-sm text-[var(--mc-text-secondary)]">
          <Clock className="inline h-4 w-4 -mt-1 mr-1 text-emerald-600" /> <Link href={href} className="font-bold text-[var(--mc-primary)] hover:underline">Explore pharmacy services</Link> · Counter sales · Medication therapy reviews · Blood pressure & glucose screening
        </p>
      </div>
    </section>
  );
}

// ═══ ADMISSION_INFO — admission-inpatient-care sub-services, NO rates ═══
export function AdmissionInfoWidget({ data, variant, title, subtitle }: WidgetProps) {
  const adm = findSvc(data, 'admission-inpatient-care');
  const wardTypes = adm?.subServices?.length
    ? adm.subServices.slice(0, 6).map((s: any) => ({ name: s.title, desc: s.description }))
    : [
      { name: 'General Wards', desc: '4–8 bed shared rooms, curtain-separated, routine nursing supervision.' },
      { name: 'Private Rooms', desc: 'Single occupancy, en-suite bathroom, reduced cross-infection risk.' },
      { name: 'High Dependency Unit', desc: 'One-to-one monitoring for critical patients.' },
      { name: 'Intensive Care Unit', desc: 'Motorized beds, continuous monitors, ventilators and 1:1 nursing.' },
      { name: 'Neonatal Care', desc: 'NICU incubators with oxygen support for newborns who need extra care.' },
      { name: 'Isolation Rooms', desc: 'Negative-pressure isolation rooms for infection control.' },
    ];
  const href = adm ? `/services/${adm.slug}` : '/services';
  return (
    <section className="mc-section">
      <div className="mc-container">
        <SectionHead title={title || 'Admission & Inpatient Care'} subtitle={subtitle || adm?.excerpt || 'Comfortable wards and attentive nursing — accommodation options for every need.'} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wardTypes.map(w => (
            <div key={w.name} className="rounded-2xl border border-[var(--mc-divider)] bg-white p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <span className="h-10 w-10 rounded-lg bg-[var(--mc-primary-light)] text-[var(--mc-primary)] flex items-center justify-center"><BedDouble className="h-5 w-5" /></span>
                <ArrowRight className="h-4 w-4 text-[var(--mc-divider)]" />
              </div>
              <h3 className="font-bold mt-3 text-[var(--mc-text-primary)]">{w.name}</h3>
              <p className="text-xs text-[var(--mc-text-secondary)] mt-2 min-h-8">{w.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-8"><Link href={href} className="inline-flex items-center gap-2 font-bold text-[var(--mc-primary)] hover:underline">Admission & visiting details <ArrowRight className="h-4 w-4" /></Link></div>
      </div>
    </section>
  );
}

// ═══ VALUES_CARDS ═══
export function ValuesCardsWidget({ variant, title, subtitle }: WidgetProps) {
  const values = [
    { icon: ShieldCheck, name: 'Integrity', desc: 'We do the right thing when nobody is watching — clinically and financially.' },
    { icon: HeartHandshake, name: 'Compassion', desc: 'Every patient is somebody\'s parent, child or friend. We treat them accordingly.' },
    { icon: Award, name: 'Excellence', desc: 'Continuous audit, continuous training, continuous improvement.' },
    { icon: Users, name: 'Community', desc: 'A healthy community is the only outcome we invest for.' },
  ];
  return (
    <section className="mc-section bg-[var(--mc-bg-card)]">
      <div className="mc-container">
        <SectionHead title={title || 'Our Values'} subtitle={subtitle || 'The principles that guide every clinical and business decision.'} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map(v => (
            <div key={v.name} className="rounded-2xl bg-white border-t-4 border-[var(--mc-primary)] border border-[var(--mc-divider)] p-6 text-center hover:shadow-lg transition-shadow">
              <span className="mx-auto h-14 w-14 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary)] flex items-center justify-center mb-4"><v.icon className="h-7 w-7" /></span>
              <h3 className="font-extrabold text-[var(--mc-text-primary)]">{v.name}</h3>
              <p className="text-sm text-[var(--mc-text-secondary)] mt-2">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══ VISION_MISSION_SPLIT ═══
export function VisionMissionSplitWidget({ variant, title, subtitle }: WidgetProps) {
  return (
    <section className="mc-section">
      <div className="mc-container grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl mc-gradient-primary text-white p-8 md:p-10">
          <Eye className="h-9 w-9 mb-4" />
          <h2 className="text-2xl font-extrabold mb-3">Our Vision</h2>
          <p className="text-white/85 leading-relaxed">{subtitle || 'To be East Africa\'s most trusted family healthcare network — where quality care is never more than 30 minutes from home.'}</p>
        </div>
        <div className="rounded-2xl bg-[var(--mc-bg-sidebar)] text-white p-8 md:p-10">
          <Target className="h-9 w-9 mb-4 text-[var(--mc-secondary)]" />
          <h2 className="text-2xl font-extrabold mb-3">Our Mission</h2>
          <p className="text-white/80 leading-relaxed">To deliver affordable, evidence-based, compassionate care through skilled teams, modern facilities and honest pricing — while training the next generation of Kenyan clinicians.</p>
        </div>
      </div>
    </section>
  );
}

// ═══ TIMELINE_HISTORY ═══
export function TimelineHistoryWidget({ variant, title }: WidgetProps) {
  const co = 'Boyani Health Dispensary'; // static history copy (no data dep)
  const events = [
    ['Founded', `Founded as ${co} — Vihiga, Kakamega County`],
    ['2013', 'Expanded pharmacy dispensing unit'],
    ['2016', 'Launched outpatient clinic services'],
    ['2019', 'ISO laboratory accreditation'],
    ['2022', 'SHA-integrated billing across all departments'],
    ['2026', 'Full clinic & pharmacy management platform launched'],
  ];
  return (
    <section className="mc-section bg-[var(--mc-bg-card)]">
      <div className="mc-container max-w-3xl">
        <SectionHead title={title || 'Our Journey'} subtitle="Three decades of growing with Kenyan families." />
        <div className="relative border-l-2 border-[var(--mc-primary)] ml-4 space-y-8">
          {events.map(([year, text]) => (
            <div key={year} className="relative pl-8">
              <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-[var(--mc-primary)] border-4 border-[var(--mc-bg-card)]" />
              <p className="text-xs font-extrabold text-[var(--mc-primary)]">{year}</p>
              <p className="text-sm text-[var(--mc-text-secondary)] mt-0.5">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══ PRICING_TABLES → "SERVICE_LISTINGS" behaviour (Instruction 6) ═══
// Module key kept (all 41 widget keys must keep resolving in WidgetRouter), but
// the widget now lists WebsiteService sub-services / excerpts. NO prices are
// rendered — public pricing was removed from the website module.
export function PricingTablesWidget({ data, variant, title, subtitle }: WidgetProps) {
  const ws = (data.websiteServices || []).slice(0, 6);
  const [tab, setTab] = React.useState(ws[0]?.id || '');
  const active = ws.find((s: any) => s.id === tab) || ws[0];
  const items = active?.subServices?.length
    ? active.subServices.slice(0, 10).map((s: any) => ({ id: s.id, name: s.title, desc: s.description }))
    : active
      ? [{ id: `${active.id}-x`, name: active.title, desc: active.excerpt }]
      : (data.departments || []).slice(0, 6).map((d: any) => ({ id: d.id, name: d.name, desc: d.description || '' }));
  const href = active ? `/services/${active.slug}` : '/services';
  return (
    <section className="mc-section">
      <div className="mc-container max-w-4xl">
        <SectionHead title={title || 'Our Service Listings'} subtitle={subtitle || 'Browse what each service includes — full details on every service page.'} />
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {ws.map(s => (
            <button key={s.id} onClick={() => setTab(s.id)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${tab === s.id ? 'mc-gradient-primary text-white shadow' : 'bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] text-[var(--mc-text-secondary)] hover:border-[var(--mc-primary)]'}`}>
              {s.title}
            </button>
          ))}
        </div>
        {active && (
          <div className="rounded-2xl border border-[var(--mc-divider)] bg-white overflow-hidden">
            {items.map((it, i) => (
              <Link key={it.id} href={href} className={`flex items-center justify-between gap-4 px-6 py-3.5 hover:bg-[var(--mc-primary-light)]/40 transition-colors ${i !== items.length - 1 ? 'border-b border-[var(--mc-divider)]' : ''} ${i % 2 ? 'bg-[var(--mc-bg-card)]/50' : ''}`}>
                <span className="text-sm font-medium text-[var(--mc-text-primary)]">{it.name}</span>
                {it.desc && <span className="text-xs text-[var(--mc-text-secondary)] truncate max-w-md hidden sm:block">{it.desc}</span>}
              </Link>
            ))}
          </div>
        )}
        <p className="text-center text-xs text-[var(--mc-text-muted)] mt-3">Full service details, preparation guidance and FAQs live on each service page.</p>
      </div>
    </section>
  );
}

// ═══ HEALTH_TIPS ═══
export function HealthTipsWidget({ data, variant, title, subtitle }: WidgetProps) {
  const tips = (data.news || []).filter((n: any) => n.category === 'HEALTH_TIPS').slice(0, 3);
  const fallback = [
    { title: 'Managing hypertension at home', excerpt: 'Practical guide to blood-pressure control between clinic visits.' },
    { title: 'Hygiene season: preventing typhoid', excerpt: 'Safe water, food handling and when to seek care early.' },
    { title: 'Child nutrition in the first 1000 days', excerpt: 'Breastfeeding, weaning and balanced family meals.' },
  ];
  const list = tips.length ? tips : fallback;
  return (
    <section className="mc-section bg-[var(--mc-bg-card)]">
      <div className="mc-container">
        <SectionHead title={title || 'Health Tips from Our Clinicians'} subtitle={subtitle || 'Small changes, steady protection — advice you can use today.'} />
        <div className="grid gap-5 sm:grid-cols-3">
          {list.map((t: any, i: number) => (
            <Link key={t.title} href={`/news/${t.slug || ''}`} className="group rounded-2xl bg-white border border-[var(--mc-divider)] p-6 hover:shadow-lg transition-all hover:-translate-y-0.5">
              <span className="text-3xl">{['🩺', '💧', '🥗'][i % 3]}</span>
              <h3 className="font-bold mt-3 text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)] leading-snug">{t.title}</h3>
              <p className="text-sm text-[var(--mc-text-secondary)] mt-2 line-clamp-3">{t.excerpt}</p>
              <span className="text-xs font-bold text-[var(--mc-primary)] mt-3 inline-flex items-center gap-1">Read more <ArrowRight className="h-3 w-3" /></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
