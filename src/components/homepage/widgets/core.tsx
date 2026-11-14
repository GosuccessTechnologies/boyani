'use client';

/**
 * HOMEPAGE WIDGETS — CORE BATCH (12 modules)
 * HERO_SLIDER, EMERGENCY_STRIP, QUICK_ACTIONS, STATS_COUNTERS, APPOINTMENT_CTA,
 * CTA_GRADIENT, CONTACT_BANNER, PARTNERS_STRIP, INSURANCE_STRIP, APP_DOWNLOAD,
 * OPENING_HOURS, TRUST_BADGES
 */

import * as React from 'react';
import Link from 'next/link';
import { Siren, CalendarCheck, FlaskConical, Pill, ShieldCheck, Phone, MapPin, Clock, Mail, Ambulance, Download, Smartphone, Award, Users, BedDouble, Stethoscope, HeartPulse, BadgeCheck } from 'lucide-react';
import { SliderRouter, SlideData } from '@/components/sliders/SliderDesigns';

export interface WidgetData {
  slides: SlideData[];
  departments: any[];
  /** Legacy facility services — no longer shipped to the client (pricing lives
   *  in the internal modules only); kept optional for type compatibility. */
  services?: any[];
  /** WebsiteService CMS entries (Instruction 6) — drives all service widgets, no pricing */
  websiteServices: any[];
  /** Doctor profiles — sections removed from homepages (Instruction 6); the
   *  disabled widgets below still reference it, so it stays optional. */
  doctors?: any[];
  news: any[];
  testimonials: any[];
  faqs: any[];
  downloads: any[];
  galleryAlbums: any[];
  webPages: any[];
  jobs?: any[];
  stats: { doctors: number; patients: number; beds: number; departments: number; years: number };
  company: Record<string, string>;
}

export interface WidgetProps {
  variant: number;
  title?: string | null;
  subtitle?: string | null;
  data: WidgetData;
}

export function SectionHead({ title, subtitle, center = true, light = false }: { title?: string | null; subtitle?: string | null; center?: boolean; light?: boolean }) {
  if (!title && !subtitle) return null;
  return (
    <div className={`mb-8 ${center ? 'text-center' : ''}`}>
      {title && (
        <>
          <h2 className={`text-2xl md:text-3xl font-extrabold ${light ? 'text-white' : 'text-[var(--mc-text-primary)]'}`}>{title}</h2>
          <div className={`h-1 w-16 rounded-full mt-2 ${center ? 'mx-auto' : ''} bg-[var(--mc-primary)]`} />
        </>
      )}
      {subtitle && <p className={`mt-3 max-w-2xl ${center ? 'mx-auto' : ''} text-sm md:text-base ${light ? 'text-white/75' : 'text-[var(--mc-text-secondary)]'}`}>{subtitle}</p>}
    </div>
  );
}

// ═══ HERO_SLIDER — delegates to the 14-design SliderRouter ═══
// Design resolution priority:
//   1. The HERO_SLIDER widget's variantId (set per-homepage-design in the DB) — always wins.
//   2. Falls back to 1 if no valid variantId is stored.
// The per-slide designId field is intentionally ignored here — it was previously
// used to let admins override via the slider manager, but that caused every
// homepage sharing the same slides to display the same hero design regardless
// of which homepage was active. The widget variantId is now the single source
// of truth for which SliderDesign (1-14) to render.
export function HeroSliderWidget({ data, variant = 1 }: WidgetProps) {
  const designId = Math.min(Math.max(variant || 1, 1), 14);
  return <SliderRouter slides={data.slides} designId={designId} />;
}

// ═══ EMERGENCY_STRIP ═══
export function EmergencyStripWidget({ data, variant }: WidgetProps) {
  const phone = data.company.emergency_phone || data.company.company_phone;
  if (variant === 2) {
    return (
      <div className="bg-[var(--mc-bg-sidebar)] text-white">
        <div className="mc-container flex items-center justify-between py-2.5 gap-3 flex-wrap">
          <p className="flex items-center gap-2 text-sm font-semibold"><Siren className="h-4 w-4 text-red-400" /> 24/7 Emergency & Trauma Centre — always open</p>
          <a href={`tel:${phone}`} className="flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-500 px-4 py-1.5 text-sm font-bold transition-colors"><Phone className="h-3.5 w-3.5" /> {phone}</a>
        </div>
      </div>
    );
  }
  return (
    <a href={`tel:${phone}`} className="block bg-red-600 hover:bg-red-500 text-white transition-colors">
      <div className="mc-container flex items-center justify-center gap-3 py-3 flex-wrap">
        <Ambulance className="h-6 w-6 animate-pulse" />
        <p className="font-bold text-sm md:text-base">Emergency? We are open 24/7 — call {phone} or walk in immediately</p>
        <span className="hidden md:inline-flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-xs font-bold">No appointment needed</span>
      </div>
    </a>
  );
}

// ═══ QUICK_ACTIONS ═══
// Public URLs only (Instruction 6) — no dashboard/internal routes exposed.
export function QuickActionsWidget({ data, variant }: WidgetProps) {
  const actions = [
    { icon: CalendarCheck, label: 'Book Appointment', desc: 'Choose your service & time', href: '/booking', color: 'var(--mc-primary)' },
    { icon: FlaskConical, label: 'Lab Results', desc: 'Same-day diagnostics', href: '/services/laboratory-diagnostics', color: 'var(--mc-tertiary)' },
    { icon: Pill, label: 'Pharmacy', desc: 'Genuine medicine & advice', href: '/services/pharmacy-services', color: 'var(--mc-secondary)' },
    { icon: ShieldCheck, label: 'Insurance / SHA', desc: 'We handle the paperwork', href: '/faq#INSURANCE', color: '#7c3aed' },
  ];
  if (variant === 2) {
    return (
      <section className="mc-container -mt-10 relative z-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(a => (
            <Link key={a.label} href={a.href} className="group flex items-center gap-4 rounded-2xl bg-white shadow-xl border border-[var(--mc-divider)] p-4 hover:-translate-y-1 hover:shadow-2xl transition-all">
              <span className="h-12 w-12 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: a.color }}><a.icon className="h-6 w-6" /></span>
              <span><span className="block font-bold text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)]">{a.label}</span><span className="block text-xs text-[var(--mc-text-muted)]">{a.desc}</span></span>
            </Link>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="mc-section bg-[var(--mc-bg-card)]">
      <div className="mc-container">
        <SectionHead title={data.company.company_slogan} subtitle="Everything you need, one campus — get started with any of these" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(a => (
            <Link key={a.label} href={a.href} className="group rounded-2xl border border-[var(--mc-divider)] bg-white p-6 text-center hover:shadow-xl hover:border-[var(--mc-primary)] transition-all hover:-translate-y-1">
              <span className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center text-white mb-4" style={{ background: a.color }}><a.icon className="h-7 w-7" /></span>
              <h3 className="font-bold text-[var(--mc-text-primary)]">{a.label}</h3>
              <p className="text-sm text-[var(--mc-text-muted)] mt-1">{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══ STATS_COUNTERS (animated) ═══
export function StatsCountersWidget({ data, variant }: WidgetProps) {
  const stats = data.stats;
  const counters = [
    { icon: Stethoscope, value: stats.doctors, suffix: '+', label: 'Specialist Doctors' },
    { icon: Users, value: stats.patients, suffix: '+', label: 'Patients Served' },
    { icon: BedDouble, value: stats.beds, suffix: '', label: 'Inpatient Beds' },
    { icon: HeartPulse, value: stats.years, suffix: '', label: 'Years of Care' },
  ];
  const Animated = ({ value, suffix }: { value: number; suffix: string }) => {
    const [display, setDisplay] = React.useState(0);
    React.useEffect(() => {
      const duration = 1600;
      const start = performance.now();
      let raf = 0;
      const step = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }, [value]);
    return <>{display.toLocaleString()}{suffix}</>;
  };
  if (variant === 2) {
    return (
      <section className="relative py-12 overflow-hidden" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1600&q=60)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-[var(--mc-bg-sidebar)]/85" />
        <div className="relative mc-container grid grid-cols-2 lg:grid-cols-4 gap-6 text-center text-white">
          {counters.map(c => (
            <div key={c.label}>
              <c.icon className="h-8 w-8 mx-auto text-[var(--mc-secondary)] mb-2" />
              <p className="text-3xl md:text-4xl font-extrabold"><Animated value={c.value} suffix={c.suffix} /></p>
              <p className="text-sm text-white/70 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="mc-gradient-primary text-white py-12">
      <div className="mc-container grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
        {counters.map(c => (
          <div key={c.label} className="rounded-2xl bg-white/10 border border-white/15 p-5">
            <c.icon className="h-7 w-7 mx-auto text-white/80 mb-2" />
            <p className="text-3xl font-extrabold"><Animated value={c.value} suffix={c.suffix} /></p>
            <p className="text-sm text-white/75 mt-1">{c.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══ APPOINTMENT_CTA — premium modern (Instruction 6): gradient + decorative
// circles, bold headline, subtext, dual CTAs and trust chips ═══
const TrustChips = ({ light = false }: { light?: boolean }) => (
  <div className="flex flex-wrap justify-center gap-2.5">
    {['SHA Accepted', 'Same-day Labs', 'Open Mon–Sat', 'Walk-ins Welcome'].map(chip => (
      <span key={chip} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold backdrop-blur ${light ? 'bg-white/10 text-white border border-white/15' : 'bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] border border-[var(--mc-divider)]'}`}>
        <BadgeCheck className="h-3.5 w-3.5" /> {chip}
      </span>
    ))}
  </div>
);

export function AppointmentCtaWidget({ data, variant }: WidgetProps) {
  if (variant === 2) {
    return (
      <section className="mc-section">
        <div className="mc-container">
          <div className="relative rounded-3xl bg-[var(--mc-bg-sidebar)] text-white overflow-hidden">
            {/* decorative circles */}
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[var(--mc-primary)]/40 blur-2xl pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[var(--mc-secondary)]/30 blur-2xl pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&q=60)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div className="relative grid md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--mc-secondary)]">Book in under 2 minutes</span>
                <h2 className="text-2xl md:text-4xl font-extrabold mt-4 leading-tight">Your health can&apos;t wait — neither should your appointment</h2>
                <p className="text-white/70 mt-3">Same-week specialist slots, same-day labs, and instant confirmation from our front office.</p>
                <div className="mt-5"><TrustChips light /></div>
              </div>
              <div className="flex flex-col gap-3">
                <Link href="/booking" className="rounded-full bg-white text-[var(--mc-bg-sidebar)] hover:-translate-y-0.5 px-7 py-3.5 font-bold text-center shadow-lg transition-transform">Book Online Now</Link>
                <a href={`tel:${data.company.company_phone}`} className="rounded-full border-2 border-white/40 hover:bg-white hover:text-[var(--mc-bg-sidebar)] px-7 py-3.5 font-bold text-center transition-colors flex items-center justify-center gap-2"><Phone className="h-4 w-4" /> Call {data.company.company_phone}</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="mc-section">
      <div className="mc-container">
        <div className="relative rounded-3xl overflow-hidden mc-gradient-primary text-white px-6 py-12 md:py-16 text-center">
          {/* decorative circles */}
          <div className="absolute top-8 left-10 h-28 w-28 rounded-full border-[10px] border-white/10 pointer-events-none" aria-hidden="true" />
          <div className="absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-xl pointer-events-none" aria-hidden="true" />
          <div className="absolute top-1/2 right-1/4 h-3 w-3 rounded-full bg-white/40 pointer-events-none hidden md:block" aria-hidden="true" />
          <div className="relative max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">Ready to see a clinician?</h2>
            <p className="text-white/85 mt-3">Booking takes less than two minutes — pick a service, choose a time, and we confirm within the hour.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/booking" className="rounded-full bg-white text-[var(--mc-primary)] px-8 py-3.5 font-bold shadow-lg hover:-translate-y-0.5 transition-transform inline-flex items-center gap-2"><CalendarCheck className="h-5 w-5" /> Book Appointment</Link>
              <a href={`tel:${data.company.company_phone}`} className="rounded-full border-2 border-white/60 text-white hover:bg-white hover:text-[var(--mc-primary)] px-8 py-3.5 font-bold transition-colors inline-flex items-center gap-2"><Phone className="h-4 w-4" /> {data.company.company_phone}</a>
            </div>
            <div className="mt-7"><TrustChips light /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══ CTA_GRADIENT — premium modern (Instruction 6): gradient + decorative
// circles, bold headline, dual CTAs (white primary + outline secondary), trust chips ═══
export function CtaGradientWidget({ data, variant, title, subtitle }: WidgetProps) {
  return (
    <section className="relative overflow-hidden mc-gradient-primary text-white py-16">
      {/* decorative circles */}
      <div className="absolute -top-24 left-1/4 h-64 w-64 rounded-full border-[14px] border-white/10 pointer-events-none" aria-hidden="true" />
      <div className="absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-white/10 blur-2xl pointer-events-none" aria-hidden="true" />
      <div className="absolute top-10 right-1/3 h-3.5 w-3.5 rounded-full bg-white/50 pointer-events-none hidden md:block" aria-hidden="true" />
      <div className="relative mc-container text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold mb-3 max-w-2xl mx-auto leading-tight">{title || 'Compassionate care is a call away'}</h2>
        <p className="text-white/85 max-w-xl mx-auto mb-8">{subtitle || `Join families across Nairobi who trust ${data.company.company_name} with their health.`}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/booking" className="rounded-full bg-white text-[var(--mc-primary)] px-8 py-3.5 font-bold shadow-lg hover:-translate-y-0.5 transition-transform">Book an Appointment</Link>
          <a href={`tel:${data.company.emergency_phone}`} className="rounded-full border-2 border-white/60 text-white hover:bg-white hover:text-[var(--mc-primary)] px-8 py-3.5 font-bold transition-colors inline-flex items-center gap-2"><Siren className="h-4 w-4" /> Emergency {data.company.emergency_phone}</a>
        </div>
        <div className="mt-8"><TrustChips light /></div>
      </div>
    </section>
  );
}

// ═══ CONTACT_BANNER ═══
export function ContactBannerWidget({ data, variant, title }: WidgetProps) {
  const items = [
    { icon: Phone, label: 'Call Us', value: data.company.company_phone, href: `tel:${data.company.company_phone}` },
    { icon: Mail, label: 'Email', value: data.company.company_email, href: `mailto:${data.company.company_email}` },
    { icon: MapPin, label: 'Visit Us', value: data.company.company_address, href: '/contact' },
    { icon: Clock, label: 'Open Hours', value: data.company.opening_hours, href: '/contact' },
  ];
  return (
    <section className="mc-section bg-[var(--mc-bg-card)]">
      <div className="mc-container">
        <SectionHead title={title || 'We are here for you'} subtitle="Reach us any way you prefer — phone, email or in person" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(item => {
            const Inner = (
              <>
                <span className="h-12 w-12 rounded-xl bg-[var(--mc-primary-light)] text-[var(--mc-primary)] flex items-center justify-center mb-3"><item.icon className="h-6 w-6" /></span>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-text-muted)]">{item.label}</p>
                <p className="font-semibold text-[var(--mc-text-primary)] mt-1 text-sm">{item.value}</p>
              </>
            );
            return item.href?.startsWith('tel:') || item.href?.startsWith('mailto:')
              ? <a key={item.label} href={item.href} className="rounded-2xl border border-[var(--mc-divider)] bg-white p-6 text-center hover:shadow-lg hover:border-[var(--mc-primary)] transition-all">{Inner}</a>
              : <Link key={item.label} href={item.href || '/contact'} className="rounded-2xl border border-[var(--mc-divider)] bg-white p-6 text-center hover:shadow-lg hover:border-[var(--mc-primary)] transition-all">{Inner}</Link>;
          })}
        </div>
      </div>
    </section>
  );
}

// ═══ PARTNERS_STRIP ═══
export function PartnersStripWidget({ variant }: WidgetProps) {
  const partners = ['SHA — Social Health Authority', 'AAR Insurance', 'Jubilee Health', 'Britam', 'CIC Insurance', 'Old Mutual'];
  return (
    <section className="py-8 border-y border-[var(--mc-divider)] bg-white">
      <div className="mc-container">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-[var(--mc-text-muted)] mb-5">Proudly working with Kenya's leading insurers</p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {partners.map(p => (
            <span key={p} className="flex items-center gap-2 text-sm font-bold text-[var(--mc-text-secondary)]/70 hover:text-[var(--mc-primary)] transition-colors"><BadgeCheck className="h-4 w-4" /> {p}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══ INSURANCE_STRIP ═══
export function InsuranceStripWidget({ variant }: WidgetProps) {
  const co = 'Boyani Health Dispensary'; // static SHA copy (no data dep)
  return (
    <section className="mc-section">
      <div className="mc-container grid md:grid-cols-2 gap-8 items-center">
        <div className="rounded-2xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.unsplash.com/photo-1563986768609-322da13575f3?w=900&q=70" alt={`Insurance and SHA billing support at ${co}`} className="w-full h-72 object-cover" />
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] px-3 py-1 text-xs font-bold uppercase tracking-wide">SHA Ready</span>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-3 text-[var(--mc-text-primary)]">We handle your insurance, you focus on healing</h2>
          <p className="text-[var(--mc-text-secondary)] mt-3">{co} is fully integrated with the Social Health Authority (SHA) and all major private insurers. Our billing office verifies your cover at registration and files claims on your behalf — no queues, no paperwork surprises.</p>
          <ul className="mt-4 space-y-2 text-sm text-[var(--mc-text-secondary)]">
            {['SHA verified at registration', 'Direct billing — you only pay what your cover excludes', 'Dedicated insurance helpdesk on every campus'].map(t => (
              <li key={t} className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 mt-0.5 text-[var(--mc-primary)] shrink-0" /> {t}</li>
            ))}
          </ul>
          <Link href="/faq" className="mt-5 inline-flex items-center gap-2 font-bold text-[var(--mc-primary)] hover:underline">See insurance FAQs →</Link>
        </div>
      </div>
    </section>
  );
}

// ═══ APP_DOWNLOAD ═══
export function AppDownloadWidget({ data, variant }: WidgetProps) {
  const co = data.company.company_name || 'Boyani Health Dispensary';
  return (
    <section className="mc-section bg-[var(--mc-bg-sidebar)] text-white">
      <div className="mc-container grid md:grid-cols-2 gap-10 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--mc-secondary)]">{co} Mobile</span>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-3">Your hospital, in your pocket</h2>
          <p className="text-white/70 mt-3">Book appointments, receive lab results, order repeat prescriptions and reach the emergency line instantly. The staff attendance companion app keeps our teams on time too.</p>
          <div className="flex flex-wrap gap-3 mt-6">
            <button className="flex items-center gap-3 rounded-xl bg-white text-[var(--mc-bg-sidebar)] px-5 py-3 font-bold"><Download className="h-5 w-5" /> Android App</button>
            <button className="flex items-center gap-3 rounded-xl border border-white/30 hover:bg-white/10 px-5 py-3 font-bold"><Smartphone className="h-5 w-5" /> iOS — coming soon</button>
          </div>
        </div>
        <div className="relative mx-auto">
          <div className="w-56 h-96 rounded-[2.5rem] border-8 border-white/20 bg-white/5 overflow-hidden shadow-2xl">
            <div className="mc-gradient-primary h-40 flex flex-col items-center justify-center text-center p-4">
              <HeartPulse className="h-10 w-10 mb-2" />
              <p className="font-bold text-sm">{data.company.company_name}</p>
              <p className="text-[10px] text-white/70">Patient Companion</p>
            </div>
            <div className="p-3 space-y-2">
              {['Book appointment', 'Lab results ready', 'Prescription refill', 'Emergency call'].map(t => (
                <div key={t} className="rounded-lg bg-white/10 px-3 py-2.5 text-xs flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--mc-secondary)]" /> {t}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══ OPENING_HOURS ═══
export function OpeningHoursWidget({ data, variant, title }: WidgetProps) {
  const rows: Array<[string, string, boolean]> = [
    ['Emergency & Trauma', '24 hours — every day', true],
    ['Clinics (OPD)', 'Mon–Sat · 06:30 – 20:00', false],
    ['Pharmacy', 'Mon–Sun · 08:00 – 21:00', false],
    ['Laboratory', 'Mon–Sat · 07:00 – 19:00 · Sun on-call', false],
    ['Visiting hours', '10:00–12:00 & 16:00–19:00 daily', false],
  ];
  return (
    <section className="mc-section bg-[var(--mc-bg-card)]">
      <div className="mc-container max-w-3xl">
        <SectionHead title={title || 'Opening Hours'} subtitle={data.company.opening_hours} />
        <div className="rounded-2xl border border-[var(--mc-divider)] bg-white overflow-hidden">
          {rows.map(([label, time, always], i) => (
            <div key={label} className={`flex items-center justify-between px-6 py-4 ${i !== rows.length - 1 ? 'border-b border-[var(--mc-divider)]' : ''} ${always ? 'bg-red-50' : ''}`}>
              <span className="font-semibold text-[var(--mc-text-primary)] flex items-center gap-2">
                {always ? <Siren className="h-4 w-4 text-red-600" /> : <Clock className="h-4 w-4 text-[var(--mc-primary)]" />} {label}
              </span>
              <span className={`text-sm font-medium ${always ? 'text-red-600' : 'text-[var(--mc-text-secondary)]'}`}>{time}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══ TRUST_BADGES ═══
export function TrustBadgesWidget({ variant }: WidgetProps) {
  const badges = [
    { icon: Award, title: 'ISO 15189 Labs', desc: 'Internationally accredited laboratory' },
    { icon: ShieldCheck, title: 'SHA Integrated', desc: 'Direct insurance billing' },
    { icon: Users, title: '130+ Staff', desc: 'Across 10 departments' },
    { icon: HeartPulse, title: '24/7 Doctor Cover', desc: 'Never a locum-only night' },
  ];
  return (
    <section className="py-10 bg-white border-y border-[var(--mc-divider)]">
      <div className="mc-container grid grid-cols-2 lg:grid-cols-4 gap-6">
        {badges.map(b => (
          <div key={b.title} className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary)] flex items-center justify-center shrink-0"><b.icon className="h-5 w-5" /></span>
            <div><p className="font-bold text-sm text-[var(--mc-text-primary)]">{b.title}</p><p className="text-xs text-[var(--mc-text-muted)]">{b.desc}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}
