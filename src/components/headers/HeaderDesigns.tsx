'use client';

/**
 * 10 PUBLIC HEADER DESIGNS — each a distinct layout, all theme-aware.
 * Data: company config map + menu (with children) — never hardcoded.
 */

import * as React from 'react';
import Link from 'next/link';
import { Phone, Mail, Clock, Menu, X, CalendarCheck, Siren, Search, MapPin, ChevronDown, Ambulance, Globe } from 'lucide-react';

export interface PublicMenuItem {
  id: string;
  label: string;
  url: string | null;
  moduleKey: string | null;
  isMega: boolean;
  children: Array<{ id: string; label: string; url: string | null }>;
}

export interface HeaderProps {
  company: Record<string, string>;
  menu: PublicMenuItem[] | null;
  activeDesign: number;
  isHome: boolean;
}

const Logo = ({ company, light }: { company: Record<string, string>; light?: boolean }) => {
  const logoSrc = company.company_logo || company.logoUrl || '/logo.svg';
  const isRealLogo = logoSrc && logoSrc !== '/favicon.svg';
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      <div className={`h-10 w-10 rounded-xl mc-gradient-primary flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden ${light ? '' : 'shadow'}`}>
        {isRealLogo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logoSrc} alt={company.company_name || 'Logo'} className="h-full w-full object-cover" />
          : (company.company_name?.[0] || 'B')}
      </div>
      <div className="leading-tight">
        <span className={`block font-extrabold text-lg ${light ? 'text-white' : 'text-[var(--mc-text-primary)]'}`}>{company.company_name || 'Boyani Health Dispensary'}</span>
        <span className={`block text-[11px] ${light ? 'text-white/70' : 'text-[var(--mc-text-secondary)]'}`}>{company.company_slogan || 'Quality Care, Compassionate Service'}</span>
      </div>
    </Link>
  );
};

function NavLinks({ items, light, onNavigate }: { items: PublicMenuItem[]; light?: boolean; onNavigate?: () => void }) {
  if (!items?.length) return null;
  return (
    <>
      {items.map(item => {
        const href = item.url || '#';
        const hasChildren = item.children?.length > 0;
        return (
          <div key={item.id} className="relative group">
            <Link href={href} onClick={onNavigate}
              className={`flex items-center gap-1 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${light ? 'text-white/85 hover:text-white hover:bg-white/10' : 'text-[var(--mc-text-secondary)] hover:text-[var(--mc-primary)] hover:bg-[var(--mc-primary-light)]'}`}>
              <span className="relative">
                {item.label}
                {/* animated hover underline */}
                <span className={`absolute left-0 -bottom-0.5 h-0.5 w-0 rounded-full transition-all duration-300 group-hover:w-full ${light ? 'bg-white' : 'bg-[var(--mc-primary)]'}`} aria-hidden="true" />
              </span>
              {hasChildren && <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />}
            </Link>
            {hasChildren && (
              /* Invisible bridge fills the gap between link bottom and panel top
                 so group-hover stays active as the mouse travels downward. */
              <div className="absolute left-0 top-full w-full h-2 hidden group-hover:block" aria-hidden="true" />
            )}
            {hasChildren && (
              <div className="absolute left-0 top-[calc(100%+0.5rem)] hidden group-hover:block z-50">
                <div className="min-w-52 rounded-xl border border-[var(--mc-divider)] bg-white shadow-xl py-2 overflow-hidden">
                  {item.children.map(child => (
                    <Link key={child.id} href={child.url || '#'} onClick={onNavigate}
                      className="block px-4 py-2 text-sm text-[var(--mc-text-secondary)] hover:bg-[var(--mc-primary-light)] hover:text-[var(--mc-primary-dark)]">
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function MobileMenu({ items, company, onClose }: { items: PublicMenuItem[] | null; company: Record<string, string>; onClose: () => void }) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <Logo company={company} />
          <button onClick={onClose} aria-label="Close menu"><X className="h-6 w-6" /></button>
        </div>
        <nav className="p-4 space-y-1">
          {items?.map(item => (
            <div key={item.id}>
              <div className="flex items-center">
                <Link href={item.url || '#'} onClick={onClose} className="flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold text-[var(--mc-text-primary)] hover:bg-[var(--mc-primary-light)]">
                  {item.label}
                </Link>
                {item.children?.length > 0 && (
                  <button onClick={() => setExpanded(e => e === item.id ? null : item.id)} className="p-2" aria-label="expand">
                    <ChevronDown className={`h-4 w-4 transition-transform ${expanded === item.id ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
              {expanded === item.id && item.children.map(child => (
                <Link key={child.id} href={child.url || '#'} onClick={onClose}
                  className="block pl-8 pr-3 py-2 text-sm text-[var(--mc-text-secondary)] hover:text-[var(--mc-primary)]">
                  {child.label}
                </Link>
              ))}
            </div>
          ))}
          <Link href="/booking" onClick={onClose} className="block mt-4 rounded-xl mc-gradient-primary text-white text-center font-bold py-3">
            Book Appointment
          </Link>
          <a href={`tel:${company.emergency_phone || company.company_phone}`} className="flex items-center justify-center gap-2 mt-2 text-sm font-semibold text-red-600 py-2">
            <Siren className="h-4 w-4" /> Emergency: {company.emergency_phone || company.company_phone}
          </a>
        </nav>
      </div>
    </div>
  );
}

function BookingCta({ light, label = 'Book Appointment' }: { light?: boolean; label?: string }) {
  return (
    <Link href="/booking" className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-transform hover:-translate-y-0.5 ${light ? 'bg-white text-[var(--mc-primary)]' : 'mc-gradient-primary text-white shadow'}`}>
      <CalendarCheck className="h-4 w-4" /> {label}
    </Link>
  );
}

/** Mobile hamburger shared */
function Hamburger({ onClick, light }: { onClick: () => void; light?: boolean }) {
  return (
    <button className="lg:hidden p-2" onClick={onClick} aria-label="Open menu">
      <Menu className={`h-6 w-6 ${light ? 'text-white' : ''}`} />
    </button>
  );
}

// ═══ DESIGN 1: Classic 3-tier (topbar + midbar + nav) — Nairobi Hospital style ═══
export function HeaderDesign1({ company, menu }: HeaderProps) {
  const [mobile, setMobile] = React.useState(false);
  return (
    <header className="relative z-40">
      <div className="bg-black text-white text-xs">
        <div className="mc-container flex items-center justify-between py-2.5 gap-2">
          <div className="flex items-center gap-4 min-w-0">
            <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-[var(--mc-secondary)]" /><span className="truncate">{company.company_phone}</span></span>
            <span className="hidden md:flex items-center gap-1.5"><Mail className="h-3 w-3 text-[var(--mc-secondary)]" /><span className="truncate">{company.company_email}</span></span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5"><Clock className="h-3 w-3 text-[var(--mc-secondary)]" /><span className="truncate">{company.opening_hours}</span></span>
            <a href={`tel:${company.emergency_phone}`} className="flex items-center gap-1.5 font-bold text-red-400 hover:text-red-300 shrink-0">
              <Siren className="h-3.5 w-3.5" /> Emergency {company.emergency_phone}
            </a>
          </div>
        </div>
      </div>
      <div className="bg-[var(--mc-bg-header)] border-b border-[var(--mc-divider)]">
        <div className="mc-container flex items-center justify-between py-4 gap-4">
          <Logo company={company} />
          <div className="hidden lg:flex items-center gap-1"><NavLinks items={menu || []} /></div>
          <div className="flex items-center gap-3">
            <BookingCta />
            <Hamburger onClick={() => setMobile(true)} />
          </div>
        </div>
      </div>
      {mobile && <MobileMenu items={menu} company={company} onClose={() => setMobile(false)} />}
    </header>
  );
}

// ═══ DESIGN 2: Split layout — logo left, nav center-right split by vertical divider + CTA ═══
export function HeaderDesign2({ company, menu }: HeaderProps) {
  const [mobile, setMobile] = React.useState(false);
  return (
    <header className="sticky top-0 z-40 bg-[var(--mc-bg-header)]/95 backdrop-blur border-b border-[var(--mc-divider)] shadow-sm">
      <div className="mc-container flex items-center gap-6 py-4">
        <Logo company={company} />
        <div className="hidden lg:flex items-center flex-1 justify-end gap-1">
          <NavLinks items={menu?.slice(0, 3) || []} />
          <div className="w-px h-8 bg-[var(--mc-divider)] mx-3" />
          <NavLinks items={menu?.slice(3) || []} />
        </div>
        <div className="flex items-center gap-3 ml-auto lg:ml-0">
          <BookingCta />
          <Hamburger onClick={() => setMobile(true)} />
        </div>
      </div>
      {mobile && <MobileMenu items={menu} company={company} onClose={() => setMobile(false)} />}
    </header>
  );
}

// ═══ DESIGN 3: Centered logo — nav left & right of center mark ═══
export function HeaderDesign3({ company, menu }: HeaderProps) {
  const [mobile, setMobile] = React.useState(false);
  const items = menu || [];
  const left = items.slice(0, Math.ceil(items.length / 2));
  const right = items.slice(Math.ceil(items.length / 2));
  return (
    <header className="sticky top-0 z-40 bg-[var(--mc-bg-header)] border-b-2 border-[var(--mc-primary)] shadow-sm">
      <div className="mc-container flex items-center justify-between py-4 gap-4">
        <div className="hidden lg:flex items-center gap-1 flex-1"><NavLinks items={left} /></div>
        <Logo company={company} />
        <div className="hidden lg:flex items-center gap-1 flex-1 justify-end"><NavLinks items={right} /></div>
        <div className="lg:hidden ml-auto flex items-center gap-2">
          <BookingCta label="Book" />
          <Hamburger onClick={() => setMobile(true)} />
        </div>
      </div>
      {mobile && <MobileMenu items={menu} company={company} onClose={() => setMobile(false)} />}
    </header>
  );
}

// ═══ DESIGN 4: Transparent over hero (light text on imagery) ═══
export function HeaderDesign4({ company, menu, isHome }: HeaderProps) {
  const [mobile, setMobile] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const transparent = isHome && !scrolled;
  return (
    <header className={`fixed top-0 inset-x-0 z-40 transition-colors ${transparent ? 'bg-transparent' : 'bg-[var(--mc-bg-header)] shadow-lg'}`}>
      <div className="mc-container flex items-center justify-between py-5 gap-4">
        <Logo company={company} light={transparent} />
        <div className="hidden lg:flex items-center gap-1"><NavLinks items={menu || []} light={transparent} /></div>
        <div className="flex items-center gap-3">
          {transparent ? (
            <a href={`tel:${company.emergency_phone}`} className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white px-4 py-2 text-sm font-bold">
              <Ambulance className="h-4 w-4" /> Emergency
            </a>
          ) : <BookingCta />}
          <Hamburger onClick={() => setMobile(true)} light={transparent} />
        </div>
      </div>
      {mobile && <MobileMenu items={menu} company={company} onClose={() => setMobile(false)} />}
    </header>
  );
}

// ═══ DESIGN 5: Gradient CTA bar — slim header with gradient bottom accent ═══
export function HeaderDesign5({ company, menu }: HeaderProps) {
  const [mobile, setMobile] = React.useState(false);
  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="mc-container flex items-center justify-between py-4 gap-4">
        <Logo company={company} />
        <div className="hidden lg:flex items-center gap-1"><NavLinks items={menu || []} /></div>
        <div className="flex items-center gap-2">
          <a href={`tel:${company.company_phone}`} className="hidden xl:flex items-center gap-2 text-sm text-[var(--mc-text-secondary)] hover:text-[var(--mc-primary)]">
            <span className="h-9 w-9 rounded-full bg-[var(--mc-primary-light)] flex items-center justify-center"><Phone className="h-4 w-4 text-[var(--mc-primary)]" /></span>
            <span className="leading-tight"><span className="block text-[10px] text-[var(--mc-text-muted)]">Call us now</span><span className="font-bold">{company.company_phone}</span></span>
          </a>
          <BookingCta />
          <Hamburger onClick={() => setMobile(true)} />
        </div>
      </div>
      <div className="h-1 mc-gradient-primary" />
      {mobile && <MobileMenu items={menu} company={company} onClose={() => setMobile(false)} />}
    </header>
  );
}

// ═══ DESIGN 6: Mega menu emphasis — thick nav band under slim brand row ═══
export function HeaderDesign6({ company, menu }: HeaderProps) {
  const [mobile, setMobile] = React.useState(false);
  const [megaOpen, setMegaOpen] = React.useState<string | null>(null);
  const items = menu || [];
  return (
    <header className="sticky top-0 z-40 bg-[var(--mc-bg-header)] shadow-sm" onMouseLeave={() => setMegaOpen(null)}>
      <div className="mc-container flex items-center justify-between py-3.5">
        <Logo company={company} />
        <div className="flex items-center gap-3">
          <button aria-label="Search" className="hidden sm:flex h-9 w-9 rounded-lg border border-[var(--mc-divider)] items-center justify-center text-[var(--mc-text-secondary)] hover:text-[var(--mc-primary)]"><Search className="h-4 w-4" /></button>
          <BookingCta />
          <Hamburger onClick={() => setMobile(true)} />
        </div>
      </div>
      <nav className="hidden lg:block bg-[var(--mc-bg-sidebar)]">
        <div className="mc-container flex items-center gap-1">
          {items.map(item => {
            const mega = item.isMega && item.children?.length > 0;
            return (
              <div key={item.id} className="relative" onMouseEnter={() => setMegaOpen(mega ? item.id : null)}>
                <Link href={item.url || '#'} className={`group flex items-center gap-1 px-4 py-3.5 text-sm font-semibold text-white/85 hover:text-white hover:bg-white/10 ${megaOpen === item.id ? 'bg-white/10 text-white' : ''}`}>
                  <span className="relative">
                    {item.label}
                    <span className="absolute left-0 -bottom-0.5 h-0.5 w-0 rounded-full bg-[var(--mc-secondary)] transition-all duration-300 group-hover:w-full" aria-hidden="true" />
                  </span>
                </Link>
                {mega && megaOpen === item.id && (
                  <div className="absolute left-0 top-full z-50 w-screen max-w-4xl -translate-x-1/3">
                    <div className="rounded-b-2xl bg-white shadow-2xl border border-[var(--mc-divider)] p-6 grid grid-cols-3 gap-6">
                      {item.children.map(child => (
                        <Link key={child.id} href={child.url || '#'} className="group block p-3 rounded-xl hover:bg-[var(--mc-primary-light)]">
                          <span className="block font-bold text-sm text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary-dark)]">{child.label}</span>
                          <span className="block text-xs text-[var(--mc-text-muted)] mt-1">Explore our {child.label.toLowerCase()} services & teams</span>
                        </Link>
                      ))}
                      <div className="col-span-3 rounded-xl mc-gradient-primary text-white p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold">Not sure which service you need?</p>
                          <p className="text-sm text-white/80">Our front desk will guide you — call {company.company_phone}</p>
                        </div>
                        <BookingCta light label="Book Now" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
      {mobile && <MobileMenu items={menu} company={company} onClose={() => setMobile(false)} />}
    </header>
  );
}

// ═══ DESIGN 7: Compact utility — single slim bar ═══
export function HeaderDesign7({ company, menu }: HeaderProps) {
  const [mobile, setMobile] = React.useState(false);
  return (
    <header className="sticky top-0 z-40 bg-[var(--mc-primary)] text-white shadow-md">
      <div className="mc-container flex items-center justify-between py-3 gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center font-bold">{(company.company_name?.[0] || 'B').toUpperCase()}</div>
          <span className="font-extrabold">{company.company_name}</span>
        </Link>
        <div className="hidden lg:flex items-center gap-0.5">
          {menu?.map(item => (
            <Link key={item.id} href={item.url || '#'} className="group px-3 py-2 text-sm text-white/90 hover:bg-white/15 rounded-md font-medium">
              <span className="relative">
                {item.label}
                <span className="absolute left-0 -bottom-0.5 h-0.5 w-0 rounded-full bg-white transition-all duration-300 group-hover:w-full" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a href={`tel:${company.emergency_phone}`} className="hidden sm:flex items-center gap-1 text-sm font-bold bg-red-600 rounded-full px-3 py-1.5"><Siren className="h-3.5 w-3.5" /> 999</a>
          <Link href="/booking" className="hidden sm:inline-flex items-center gap-1 bg-white text-[var(--mc-primary)] rounded-full px-4 py-1.5 text-sm font-bold"><CalendarCheck className="h-4 w-4" /> Book</Link>
          <button className="lg:hidden p-1.5" onClick={() => setMobile(true)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
        </div>
      </div>
      {mobile && <MobileMenu items={menu} company={company} onClose={() => setMobile(false)} />}
    </header>
  );
}

// ═══ DESIGN 8: Two-tone stacked — dark info band + light nav band ═══
export function HeaderDesign8({ company, menu }: HeaderProps) {
  const [mobile, setMobile] = React.useState(false);
  return (
    <header className="sticky top-0 z-40">
      <div className="mc-gradient-primary text-white">
        <div className="mc-container flex items-center justify-between py-2.5 text-xs gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /><span className="truncate">{company.company_address}</span></span>
          </div>
          <div className="flex items-center gap-3">
            <a href={`tel:${company.company_phone}`} className="flex items-center gap-1.5 font-semibold"><Phone className="h-3 w-3" /> {company.company_phone}</a>
            <Link href="/booking" className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 font-bold hover:bg-white/30"><CalendarCheck className="h-3 w-3" /> Book</Link>
          </div>
        </div>
      </div>
      <div className="bg-[var(--mc-bg-header)] border-b border-[var(--mc-divider)] shadow-sm">
        <div className="mc-container flex items-center justify-between py-3.5 gap-4">
          <Logo company={company} />
          <div className="hidden lg:flex items-center gap-1"><NavLinks items={menu || []} /></div>
          <Hamburger onClick={() => setMobile(true)} />
        </div>
      </div>
      {mobile && <MobileMenu items={menu} company={company} onClose={() => setMobile(false)} />}
    </header>
  );
}

// ═══ DESIGN 9: Drawer style — hamburger-forward, slides from left ═══
export function HeaderDesign9({ company, menu }: HeaderProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-40 bg-[var(--mc-bg-header)] border-b border-[var(--mc-divider)] shadow-sm">
      <div className="mc-container flex items-center justify-between py-4">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[var(--mc-divider)] hover:border-[var(--mc-primary)]" aria-label="Open menu">
          <Menu className="h-5 w-5 text-[var(--mc-primary)]" />
          <span className="hidden sm:block text-sm font-bold text-[var(--mc-text-secondary)]">Menu</span>
        </button>
        <Logo company={company} />
        <BookingCta />
      </div>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <Logo company={company} />
              <button onClick={() => setOpen(false)} aria-label="Close"><X className="h-6 w-6" /></button>
            </div>
            <nav className="p-4">
              {(menu || []).map(item => (
                <Link key={item.id} href={item.url || '#'} onClick={() => setOpen(false)}
                  className="block px-3 py-3 rounded-xl text-sm font-semibold text-[var(--mc-text-primary)] hover:bg-[var(--mc-primary-light)] border-b border-[var(--mc-divider)] last:border-0">
                  {item.label}
                  {item.children?.length > 0 && <span className="block text-xs font-normal text-[var(--mc-text-muted)] mt-0.5">{item.children.map(c => c.label).join(' · ')}</span>}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

// ═══ DESIGN 10: Floating pill — rounded floating nav over hero ═══
export function HeaderDesign10({ company, menu }: HeaderProps) {
  const [mobile, setMobile] = React.useState(false);
  return (
    <header className="sticky top-3 z-40 px-4">
      <div className="mc-container rounded-2xl bg-[var(--mc-bg-header)]/95 backdrop-blur shadow-xl border border-[var(--mc-divider)] px-4 py-3.5 flex items-center justify-between gap-4">
        <Logo company={company} />
        <div className="hidden lg:flex items-center gap-1"><NavLinks items={menu || []} /></div>
        <div className="flex items-center gap-2">
          <a href={`tel:${company.emergency_phone}`} className="hidden md:flex items-center gap-1 text-sm font-bold text-red-600"><Siren className="h-4 w-4" /> Emergency</a>
          <BookingCta />
          <Hamburger onClick={() => setMobile(true)} />
        </div>
      </div>
      {mobile && <MobileMenu items={menu} company={company} onClose={() => setMobile(false)} />}
    </header>
  );
}

export const HEADER_DESIGNS = [HeaderDesign1, HeaderDesign2, HeaderDesign3, HeaderDesign4, HeaderDesign5, HeaderDesign6, HeaderDesign7, HeaderDesign8, HeaderDesign9, HeaderDesign10];

export function HeaderRouter(props: HeaderProps) {
  const idx = Math.min(Math.max(props.activeDesign || 1, 1), HEADER_DESIGNS.length) - 1;
  const Component = HEADER_DESIGNS[idx];
  return <Component {...props} />;
}
