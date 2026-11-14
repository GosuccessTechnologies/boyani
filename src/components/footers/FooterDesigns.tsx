'use client';

/**
 * 10 PUBLIC FOOTER DESIGNS — all theme-aware, data-driven from company config & pages.
 */

import * as React from 'react';
import Link from 'next/link';
import { Phone, Mail, MapPin, Clock, Facebook, Twitter, Instagram, Youtube, Siren, Heart, ArrowRight, Ambulance } from 'lucide-react';

export interface FooterProps {
  company: Record<string, string>;
  pages: Array<{ slug: string; title: string }>;
  activeDesign: number;
}

const SocialLinks = ({ company, light }: { company: Record<string, string>; light?: boolean }) => {
  const socials = [
    { icon: Facebook, url: company.company_facebook, label: 'Facebook' },
    { icon: Twitter, url: company.company_twitter, label: 'X' },
    { icon: Instagram, url: company.company_instagram, label: 'Instagram' },
    { icon: Youtube, url: company.company_youtube, label: 'YouTube' },
  ].filter(s => s.url);
  if (!socials.length) return null;
  return (
    <div className="flex items-center gap-2">
      {socials.map(s => (
        <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label}
          className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${light ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-[var(--mc-primary-light)] hover:bg-[var(--mc-primary)] text-[var(--mc-primary)] hover:text-white'}`}>
          <s.icon className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
};

const ContactItems = ({ company, light }: { company: Record<string, string>; light?: boolean }) => (
  <div className="space-y-2.5 text-sm">
    <p className={`flex items-start gap-2.5 ${light ? 'text-white/75' : 'text-[var(--mc-text-secondary)]'}`}><MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[var(--mc-secondary)]" />{company.company_address}</p>
    <p className={`flex items-center gap-2.5 ${light ? 'text-white/75' : 'text-[var(--mc-text-secondary)]'}`}><Phone className="h-4 w-4 shrink-0 text-[var(--mc-secondary)]" />{company.company_phone}</p>
    <p className={`flex items-center gap-2.5 ${light ? 'text-white/75' : 'text-[var(--mc-text-secondary)]'}`}><Mail className="h-4 w-4 shrink-0 text-[var(--mc-secondary)]" />{company.company_email}</p>
    <p className={`flex items-start gap-2.5 ${light ? 'text-white/75' : 'text-[var(--mc-text-secondary)]'}`}><Clock className="h-4 w-4 mt-0.5 shrink-0 text-[var(--mc-secondary)]" />{company.opening_hours}</p>
  </div>
);

const BrandBlock = ({ company, light }: { company: Record<string, string>; light?: boolean }) => {
  const logoSrc = company.company_logo || company.logoUrl || '/logo.svg';
  const isRealLogo = logoSrc && logoSrc !== '/favicon.svg';
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-10 w-10 rounded-xl mc-gradient-primary flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
          {isRealLogo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logoSrc} alt={company.company_name || 'Logo'} className="h-full w-full object-cover" />
            : (company.company_name?.[0] || 'B')}
        </div>
        <div className="leading-tight">
          <span className={`block font-extrabold ${light ? 'text-white' : 'text-[var(--mc-text-primary)]'}`}>{company.company_name}</span>
          <span className={`block text-[11px] ${light ? 'text-white/60' : 'text-[var(--mc-text-muted)]'}`}>{company.company_slogan}</span>
        </div>
      </div>
      <p className={`text-sm ${light ? 'text-white/70' : 'text-[var(--mc-text-secondary)]'}`}>
        Comprehensive nursing and healthcare services for Vihiga families — Boyani Health Dispensary.
      </p>
    </div>
  );
};

const QuickLinks = ({ light }: { light?: boolean }) => (
  <div>
    <h4 className={`font-bold mb-3 text-sm uppercase tracking-wide ${light ? 'text-white' : 'text-[var(--mc-text-primary)]'}`}>Quick Links</h4>
    <ul className="space-y-2 text-sm">
      {[['Home', '/'], ['About Us', '/about'], ['Our Services', '/services'], ['FAQ', '/faq'], ['Book Appointment', '/booking'], ['News & Events', '/news'], ['Contact Us', '/contact']].map(([label, href]) => (
        <li key={href}>
          <Link href={href} className={`${light ? 'text-white/70 hover:text-white' : 'text-[var(--mc-text-secondary)] hover:text-[var(--mc-primary)]'} inline-flex items-center gap-1.5 transition-colors`}>
            <ArrowRight className="h-3 w-3" /> {label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

const ServicesLinks = ({ light }: { light?: boolean }) => (
  <div>
    <h4 className={`font-bold mb-3 text-sm uppercase tracking-wide ${light ? 'text-white' : 'text-[var(--mc-text-primary)]'}`}>Departments</h4>
    <ul className="space-y-2 text-sm">
      {/* WebsiteService CMS slugs (Instruction 5/6) — public service detail pages */}
      {[['Emergency & Trauma', '/services/emergency-care'], ['Maternity & Child Health', '/services/maternal-child-health'], ['Laboratory & Diagnostics', '/services/laboratory-diagnostics'], ['Pharmacy', '/services/pharmacy-services'], ['Diagnostic Imaging', '/services/diagnostic-imaging'], ['Admission & Inpatient', '/services/admission-inpatient-care']].map(([label, href]) => (
        <li key={href}>
          <Link href={href} className={`${light ? 'text-white/70 hover:text-white' : 'text-[var(--mc-text-secondary)] hover:text-[var(--mc-primary)]'} transition-colors`}>{label}</Link>
        </li>
      ))}
    </ul>
  </div>
);

const EmergencyStrip = ({ company }: { company: Record<string, string> }) => (
  <a href={`tel:${company.emergency_phone}`} className="flex items-center justify-between rounded-2xl bg-red-600 hover:bg-red-500 text-white p-4 transition-colors">
    <div className="flex items-center gap-3">
      <Ambulance className="h-8 w-8" />
      <div>
        <p className="font-extrabold leading-tight">24/7 Emergency</p>
        <p className="text-sm text-white/85">{company.emergency_phone}</p>
      </div>
    </div>
    <span className="text-sm font-bold bg-white/20 rounded-full px-3 py-1.5">Call Now</span>
  </a>
);

const Copyright = ({ company, light }: { company: Record<string, string>; light?: boolean }) => (
  <p className={`text-xs ${light ? 'text-white/50' : 'text-[var(--mc-text-muted)]'}`}>
    © {new Date().getFullYear()} {company.company_name}. All rights reserved. · Registered in Kenya · {company.company_postal_address}
  </p>
);

// ═══ DESIGN 1: Classic dark 4-column ═══
export function FooterDesign1({ company, pages }: FooterProps) {
  return (
    <footer className="bg-[var(--mc-bg-footer)] text-white mt-auto">
      <div className="mc-container py-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <BrandBlock company={company} light />
          <SocialLinks company={company} light />
        </div>
        <QuickLinks light />
        <ServicesLinks light />
        <div className="space-y-4">
          <h4 className="font-bold mb-3 text-sm uppercase tracking-wide">Contact</h4>
          <ContactItems company={company} light />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mc-container py-5 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
          <Copyright company={company} light />
          <div className="flex items-center gap-4 text-xs text-white/50">
            {pages.slice(0, 4).map(p => <Link key={p.slug} href={`/about/${p.slug}`} className="hover:text-white transition-colors">{p.title}</Link>)}
            <Link href="/login" className="hover:text-white transition-colors">Staff Login</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ═══ DESIGN 2: Light minimal ═══
export function FooterDesign2({ company, pages }: FooterProps) {
  return (
    <footer className="bg-[var(--mc-bg-card)] border-t border-[var(--mc-divider)] mt-auto">
      <div className="mc-container py-12 grid gap-8 md:grid-cols-3">
        <BrandBlock company={company} />
        <QuickLinks />
        <ContactItems company={company} />
      </div>
      <div className="border-t border-[var(--mc-divider)]">
        <div className="mc-container py-5 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
          <Copyright company={company} />
          <SocialLinks company={company} />
        </div>
      </div>
    </footer>
  );
}

// ═══ DESIGN 3: Gradient with emergency banner ═══
export function FooterDesign3({ company }: FooterProps) {
  return (
    <footer className="mt-auto">
      <div className="mc-container pt-10">
        <EmergencyStrip company={company} />
      </div>
      <div className="mc-gradient-primary text-white mt-8">
        <div className="mc-container py-12 grid gap-10 md:grid-cols-4">
          <div className="space-y-4 md:col-span-2">
            <BrandBlock company={company} light />
            <SocialLinks company={company} light />
          </div>
          <QuickLinks light />
          <ContactItems company={company} light />
        </div>
        <div className="border-t border-white/15">
          <div className="mc-container py-5 px-4 sm:px-6"><Copyright company={company} light /></div>
        </div>
      </div>
    </footer>
  );
}

// ═══ DESIGN 4: Mega footer — big brand + columns ═══
export function FooterDesign4({ company, pages }: FooterProps) {
  return (
    <footer className="bg-[var(--mc-bg-sidebar)] text-white mt-auto">
      <div className="mc-container py-14 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-5">
          <BrandBlock company={company} light />
          <ContactItems company={company} light />
        </div>
        <div className="lg:col-span-2"><QuickLinks light /></div>
        <div className="lg:col-span-2"><ServicesLinks light /></div>
        <div className="lg:col-span-3">
          <h4 className="font-bold mb-3 text-sm uppercase tracking-wide">Company</h4>
          <ul className="space-y-2 text-sm text-white/70">
            {[['Why Choose Us', '/about/why-choose-us'], ['Our Values', '/about/our-values'], ['Vision & Mission', '/about/vision-mission'], ['Careers', '/careers'], ['FAQ', '/faq'], ['Downloads', '/downloads']].map(([l, h]) => (
              <li key={h}><Link href={h} className="hover:text-white transition-colors">{l}</Link></li>
            ))}
          </ul>
          <div className="mt-6"><EmergencyStrip company={company} /></div>
        </div>
      </div>
      <div className="border-t border-white/10"><div className="mc-container py-5 px-4 sm:px-6"><Copyright company={company} light /></div></div>
    </footer>
  );
}

// ═══ DESIGN 5: Newsletter focus ═══
export function FooterDesign5({ company }: FooterProps) {
  const [email, setEmail] = React.useState('');
  return (
    <footer className="bg-[var(--mc-bg-footer)] text-white mt-auto">
      <div className="mc-container py-12">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 md:p-8 flex flex-col md:flex-row items-center gap-5">
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-bold">Stay informed on your family's health</h3>
            <p className="text-sm text-white/60 mt-1">Health tips, free screening announcements and hospital news — monthly, no spam.</p>
          </div>
          <form className="flex w-full md:w-auto gap-2" onSubmit={e => { e.preventDefault(); setEmail(''); }}>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email address"
              className="flex-1 md:w-72 rounded-full bg-white/10 border border-white/20 px-4 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:border-[var(--mc-secondary)]" />
            <button className="rounded-full bg-[var(--mc-secondary)] hover:opacity-90 px-5 py-2.5 text-sm font-bold whitespace-nowrap">Subscribe</button>
          </form>
        </div>
      </div>
      <div className="mc-container pb-12 grid gap-8 md:grid-cols-3">
        <div className="space-y-3"><BrandBlock company={company} light /><SocialLinks company={company} light /></div>
        <QuickLinks light />
        <ContactItems company={company} light />
      </div>
      <div className="border-t border-white/10"><div className="mc-container py-5 px-4 sm:px-6"><Copyright company={company} light /></div></div>
    </footer>
  );
}

// ═══ DESIGN 6: Sitemap dense ═══
export function FooterDesign6({ company, pages }: FooterProps) {
  const cols = [
    { title: 'Hospital', links: [['Home', '/'], ['About', '/about'], ['Why Choose Us', '/about/why-choose-us'], ['Our Values', '/about/our-values'], ['Vision & Mission', '/about/vision-mission']] },
    { title: 'Services', links: [['All Services', '/services'], ['Emergency', '/services/emergency-care'], ['Maternity', '/services/maternal-child-health'], ['Laboratory', '/services/laboratory-diagnostics'], ['Pharmacy', '/services/pharmacy-services'], ['Imaging', '/services/diagnostic-imaging']] },
    { title: 'Patients', links: [['Book Appointment', '/booking'], ['News', '/news'], ['Downloads', '/downloads'], ['FAQ', '/faq'], ['Gallery', '/gallery'], ['Contact', '/contact']] },
    { title: 'Careers', links: [['Job Openings', '/careers'], ['Staff Login', '/login']] },
  ];
  return (
    <footer className="bg-[var(--mc-bg-card)] border-t-4 border-[var(--mc-primary)] mt-auto">
      <div className="mc-container py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2 space-y-4">
          <BrandBlock company={company} />
          <ContactItems company={company} />
        </div>
        {cols.map(col => (
          <div key={col.title}>
            <h4 className="font-bold mb-3 text-sm uppercase tracking-wide">{col.title}</h4>
            <ul className="space-y-1.5 text-sm">
              {col.links.map(([l, h]) => <li key={h}><Link href={h} className="text-[var(--mc-text-secondary)] hover:text-[var(--mc-primary)] transition-colors">{l}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--mc-divider)]"><div className="mc-container py-5 px-4 sm:px-6 flex flex-wrap justify-between gap-3 items-center"><Copyright company={company} /><SocialLinks company={company} /></div></div>
    </footer>
  );
}

// ═══ DESIGN 7: Contact-heavy ═══
export function FooterDesign7({ company }: FooterProps) {
  return (
    <footer className="bg-[var(--mc-bg-footer)] text-white mt-auto">
      <div className="mc-container py-12 grid gap-10 lg:grid-cols-2">
        <div className="space-y-5">
          <BrandBlock company={company} light />
          <ContactItems company={company} light />
          <SocialLinks company={company} light />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <QuickLinks light />
          <ServicesLinks light />
        </div>
      </div>
      <div className="border-t border-white/10"><div className="mc-container py-5 px-4 sm:px-6 flex justify-between gap-3 flex-wrap"><Copyright company={company} light /><a href={`tel:${company.emergency_phone}`} className="text-xs text-red-400 font-bold flex items-center gap-1 hover:text-red-300 transition-colors"><Siren className="h-3 w-3" /> Emergency {company.emergency_phone}</a></div></div>
    </footer>
  );
}

// ═══ DESIGN 8: Social ribbon top ═══
export function FooterDesign8({ company }: FooterProps) {
  return (
    <footer className="mt-auto">
      <div className="bg-[var(--mc-primary)] text-white">
        <div className="mc-container py-4 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm font-semibold flex items-center gap-2"><Heart className="h-4 w-4" /> Care to share? Follow our health tips</p>
          <SocialLinks company={company} light />
        </div>
      </div>
      <div className="bg-[var(--mc-bg-header)]">
        <div className="mc-container py-12 grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2"><BrandBlock company={company} /></div>
          <QuickLinks />
          <ContactItems company={company} />
        </div>
        <div className="border-t border-[var(--mc-divider)]"><div className="mc-container py-5 px-4 sm:px-6"><Copyright company={company} /></div></div>
      </div>
    </footer>
  );
}

// ═══ DESIGN 9: Minimal centered ═══
export function FooterDesign9({ company }: FooterProps) {
  return (
    <footer className="bg-[var(--mc-bg-sidebar)] text-white mt-auto">
      <div className="mc-container py-12 text-center space-y-6 max-w-2xl mx-auto">
        <div className="flex justify-center"><BrandBlock company={company} light /></div>
        <p className="text-white/60 text-sm">{company.company_address} · {company.company_phone} · {company.company_email}</p>
        <div className="flex items-center justify-center gap-2"><SocialLinks company={company} light /></div>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-white/70">
          {[['About', '/about'], ['Services', '/services'], ['Booking', '/booking'], ['News', '/news'], ['Careers', '/careers'], ['Contact', '/contact']].map(([l, h]) => <Link key={h} href={h} className="hover:text-white transition-colors">{l}</Link>)}
        </div>
        <Copyright company={company} light />
      </div>
    </footer>
  );
}

// ═══ DESIGN 10: Split curve — emergency CTA card overlapping ═══
export function FooterDesign10({ company }: FooterProps) {
  return (
    <footer className="mt-auto relative">
      <div className="mc-container -mb-10 relative z-10">
        <EmergencyStrip company={company} />
      </div>
      <div className="bg-[var(--mc-bg-footer)] text-white pt-20">
        <div className="mc-container pb-12 grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2 space-y-4"><BrandBlock company={company} light /><SocialLinks company={company} light /></div>
          <QuickLinks light />
          <ContactItems company={company} light />
        </div>
        <div className="border-t border-white/10"><div className="mc-container py-5 px-4 sm:px-6 flex justify-between flex-wrap gap-3"><Copyright company={company} light /><Link href="/login" className="text-xs text-white/60 hover:text-white transition-colors">Staff Login →</Link></div></div>
      </div>
    </footer>
  );
}

export const FOOTER_DESIGNS = [FooterDesign1, FooterDesign2, FooterDesign3, FooterDesign4, FooterDesign5, FooterDesign6, FooterDesign7, FooterDesign8, FooterDesign9, FooterDesign10];

export function FooterRouter(props: FooterProps) {
  const idx = Math.min(Math.max(props.activeDesign || 1, 1), FOOTER_DESIGNS.length) - 1;
  const Component = FOOTER_DESIGNS[idx];
  return <Component {...props} />;
}
