'use client';

/**
 * LOGIN DESIGNS — 6 switchable staff login interfaces (Instruction 2).
 * D1 Classic Split (original) · D2 Aurora Card · D3 Mint Medical ·
 * D4 Centered Classic · D5 Royal Image Split · D6 Floating Stats.
 * All consume CompanyConfig dynamically + theme CSS vars; no demo creds.
 */

import * as React from 'react';
import { Hospital, Loader2, Lock, User, HeartPulse, ShieldCheck, ArrowRight, Fingerprint, Phone, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface LoginBrand {
  companyName: string;
  slogan: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  bannerHeading: string;
  bannerSubheading: string;
  bannerImage: string;
  bannerShow: boolean;
  logoUrl: string;
}

export interface LoginDesignProps {
  brand: LoginBrand;
  onSubmit: (username: string, password: string) => Promise<void>;
  loading: boolean;
}

export const LOGIN_DESIGNS: Array<{ id: number; name: string; description: string; hasBanner: boolean }> = [
  { id: 1, name: 'Classic Split', description: 'Gradient brand panel beside a clean form — the original brand look.', hasBanner: true },
  { id: 2, name: 'Aurora Card', description: 'Soft aurora gradient hero card on a cool grey stage (login1 inspiration).', hasBanner: true },
  { id: 3, name: 'Mint Medical', description: 'Fresh mint palette with image hero and green form panel (login2 inspiration).', hasBanner: true },
  { id: 4, name: 'Centered Classic', description: 'Single centered card over a dotted blue pattern (login3 inspiration).', hasBanner: false },
  { id: 5, name: 'Royal Image Split', description: 'Photo-over-royal-blue split with accent bar (login4 inspiration).', hasBanner: true },
  { id: 6, name: 'Floating Stats', description: 'Rounded image container with floating stat badges (login5 inspiration).', hasBanner: true },
];

function BrandLogo({ brand, light }: { brand: LoginBrand; light?: boolean }) {
  const logoSrc = brand.logoUrl && brand.logoUrl !== '/favicon.svg' ? brand.logoUrl : '/logo.svg';
  return (
    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${light ? 'bg-white/20' : 'mc-gradient-primary shadow-md'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} alt={brand.companyName} className="h-full w-full object-cover" />
    </div>
  );
}

function FormFields({ onSubmit, loading, invert, heading, subheading }: {
  onSubmit: LoginDesignProps['onSubmit'];
  loading: boolean;
  invert?: boolean; // white text style for colored panels
  heading: string;
  subheading: string;
}) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  return (
    <form
      onSubmit={async (e) => { e.preventDefault(); await onSubmit(username, password); }}
      className="space-y-4"
    >
      <div>
        <h2 className={`text-2xl font-bold ${invert ? 'text-white' : 'text-[var(--mc-text-primary)]'}`}>{heading}</h2>
        <p className={`text-sm mt-1 ${invert ? 'text-white/70' : 'text-muted-foreground'}`}>{subheading}</p>
      </div>
      <div className="space-y-3">
        <div className="relative">
          <User className={`absolute left-3 top-3.5 h-4 w-4 ${invert ? 'text-white/60' : 'text-muted-foreground'}`} />
          <Input
            className={`h-12 pl-9 ${invert ? 'bg-white/15 border-white/30 text-white placeholder:text-white/50' : 'mc-input'}`}
            placeholder="Username or email"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="relative">
          <Lock className={`absolute left-3 top-3.5 h-4 w-4 ${invert ? 'text-white/60' : 'text-muted-foreground'}`} />
          <Input
            className={`h-12 pl-9 ${invert ? 'bg-white/15 border-white/30 text-white placeholder:text-white/50' : 'mc-input'}`}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
      </div>
      <Button
        type="submit"
        className={`w-full h-12 text-base font-semibold gap-2 ${invert ? 'bg-white text-[var(--mc-primary-dark)] hover:bg-white/90' : ''}`}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
      </Button>
      <p className={`text-center text-xs ${invert ? 'text-white/60' : 'text-muted-foreground'}`}>
        Looking for patient info? <a href="/" className={`font-semibold hover:underline ${invert ? 'text-white' : 'text-[var(--mc-primary)]'}`}>Visit our website →</a>
      </p>
    </form>
  );
}

/* ── D1: Classic Split (original) ── */
function Design1({ brand, onSubmit, loading }: LoginDesignProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, var(--mc-primary) 0%, var(--mc-primary-dark) 55%, #0f172a 100%)' }}>
      <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl bg-white">
        <div className="hidden md:flex flex-col justify-between p-10 text-white" style={{ background: 'linear-gradient(160deg, var(--mc-primary) 0%, var(--mc-primary-dark) 100%)' }}>
          <div className="flex items-center gap-3">
            <BrandLogo brand={brand} light />
            <div>
              <h1 className="text-xl font-bold">{brand.companyName}</h1>
              <p className="text-white/70 text-sm">{brand.slogan}</p>
            </div>
          </div>
          {brand.bannerShow && (
            <div className="space-y-4">
              {brand.bannerImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.bannerImage} alt="" className="rounded-2xl h-40 w-full object-cover shadow-lg" />
              )}
              <h2 className="text-2xl font-extrabold leading-snug">{brand.bannerHeading}</h2>
              <p className="text-sm text-white/80">{brand.bannerSubheading}</p>
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center gap-3"><HeartPulse className="h-5 w-5" /><p className="text-sm text-white/85">11 staff portals — facility, pharmacy, doctors, labs, cashier & more</p></div>
                <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" /><p className="text-sm text-white/85">Role-based access with full audit trails</p></div>
              </div>
            </div>
          )}
          <p className="text-xs text-white/60">{brand.city}, {brand.address} · {brand.phone}</p>
        </div>
        <div className="p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="md:hidden flex items-center gap-2 mb-6">
            <BrandLogo brand={brand} />
            <h1 className="text-lg font-bold">{brand.companyName}</h1>
          </div>
          <FormFields onSubmit={onSubmit} loading={loading} heading="Staff Sign In" subheading="Access your portal dashboard" />
        </div>
      </div>
    </div>
  );
}

/* ── D2: Aurora Card (login1 inspiration) ── */
function Design2({ brand, onSubmit, loading }: LoginDesignProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#E2E8F0]">
      <div className="w-full max-w-5xl grid md:grid-cols-2 rounded-[28px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.12)] bg-[#F8FAFC]">
        {/* Aurora hero */}
        <div className="hidden md:block relative p-12 text-white overflow-hidden" style={{ background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35), transparent 45%), radial-gradient(circle at 80% 80%, var(--mc-tertiary), transparent 60%), radial-gradient(circle at 55% 45%, var(--mc-primary), var(--mc-primary-dark))' }}>
          <span aria-hidden className="absolute -top-16 -left-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
          <span aria-hidden className="absolute bottom-10 -right-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col h-full justify-between">
            <div className="flex items-center gap-3">
              <BrandLogo brand={brand} light />
              <div>
                <h1 className="text-xl font-extrabold tracking-tight">{brand.companyName}</h1>
                <p className="text-white/70 text-xs">{brand.slogan}</p>
              </div>
            </div>
            {brand.bannerShow && (
              <div>
                <h2 className="text-4xl font-extrabold leading-tight">{brand.bannerHeading}</h2>
                <p className="mt-3 text-white/85 max-w-sm">{brand.bannerSubheading}</p>
                {brand.bannerImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.bannerImage} alt="" className="mt-6 rounded-2xl h-36 w-full object-cover shadow-xl" />
                )}
              </div>
            )}
            <div className="flex gap-5 text-xs text-white/75">
              <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{brand.phone}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{brand.city}</span>
            </div>
          </div>
        </div>
        <div className="p-8 md:p-12 flex flex-col justify-center">
          <div className="md:hidden flex items-center gap-2 mb-6">
            <BrandLogo brand={brand} />
            <h1 className="text-lg font-bold">{brand.companyName}</h1>
          </div>
          <FormFields onSubmit={onSubmit} loading={loading} heading="Staff Sign In" subheading={`Welcome to ${brand.companyName}`} />
        </div>
      </div>
    </div>
  );
}

/* ── D3: Mint Medical (login2 inspiration) ── */
function Design3({ brand, onSubmit, loading }: LoginDesignProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'color-mix(in srgb, var(--mc-primary) 22%, #ffffff)' }}>
      <div className="w-full max-w-5xl grid md:grid-cols-2 rounded-[24px] overflow-hidden shadow-2xl">
        {/* Left: image + brand copy on white */}
        <div className="hidden md:flex flex-col bg-white">
          {brand.bannerShow && (
            brand.bannerImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.bannerImage} alt="" className="h-64 w-full object-cover" />
            ) : (
              <div className="h-64 w-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--mc-primary) 0%, var(--mc-primary-dark) 100%)' }}>
                <Hospital className="h-20 w-20 text-white/90" strokeWidth={1.2} />
              </div>
            )
          )}
          <div className="flex-1 p-10 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <BrandLogo brand={brand} />
                <h1 className="text-lg font-extrabold">{brand.companyName}</h1>
              </div>
              <h2 className="text-3xl font-extrabold leading-tight text-[var(--mc-text-primary)]">
                {brand.bannerHeading}
              </h2>
              <p className="text-sm text-[var(--mc-text-secondary)] mt-3 leading-relaxed">{brand.bannerSubheading}</p>
            </div>
            <div className="space-y-1.5 text-xs text-[var(--mc-text-secondary)]">
              <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {brand.address}, {brand.city}</p>
              <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {brand.phone}</p>
              <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Mon–Sat · 08:00–21:00</p>
            </div>
          </div>
        </div>
        {/* Right: primary form panel, white text */}
        <div className="p-8 md:p-12 flex flex-col justify-center text-white" style={{ background: 'linear-gradient(150deg, var(--mc-primary) 0%, var(--mc-primary-dark) 100%)' }}>
          <div className="md:hidden flex items-center gap-2 mb-6">
            <BrandLogo brand={brand} light />
            <h1 className="text-lg font-bold">{brand.companyName}</h1>
          </div>
          <FormFields onSubmit={onSubmit} loading={loading} invert heading="Login Now!" subheading="Enter your staff credentials to continue" />
          <p className="text-[11px] text-white/50 mt-6 text-center">Authorized personnel only · All activity is audited</p>
        </div>
      </div>
    </div>
  );
}

/* ── D4: Centered Classic (login3 inspiration) ── */
function Design4({ brand, onSubmit, loading }: LoginDesignProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ background: 'var(--mc-primary-dark)' }}
    >
      {/* dotted pattern */}
      <span
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1.5px, transparent 1.5px)', backgroundSize: '22px 22px' }}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-[#F1F5F9] shadow-2xl overflow-hidden">
        {brand.bannerShow && brand.bannerImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.bannerImage} alt="" className="h-32 w-full object-cover" />
        )}
        <div className="p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <BrandLogo brand={brand} />
            <h1 className="mt-3 text-xl font-extrabold text-[var(--mc-text-primary)]">{brand.companyName}</h1>
            <p className="text-xs text-[var(--mc-text-secondary)]">{brand.slogan}</p>
          </div>
          <FormFields onSubmit={onSubmit} loading={loading} heading="Staff Login" subheading={brand.bannerSubheading} />
          <div className="mt-5 pt-4 border-t border-[var(--mc-divider)] grid grid-cols-2 gap-2 text-[11px] text-[var(--mc-text-secondary)]">
            <span className="flex items-center gap-1.5 justify-center"><Phone className="h-3 w-3" /> {brand.phone}</span>
            <span className="flex items-center gap-1.5 justify-center"><MapPin className="h-3 w-3" /> {brand.city}, {brand.address}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── D5: Royal Image Split (login4 inspiration) ── */
function Design5({ brand, onSubmit, loading }: LoginDesignProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#DDE4EB]">
      <div className="w-full max-w-5xl grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.18)] bg-white">
        {/* Left: photo top + blue block bottom */}
        <div className="hidden md:flex flex-col">
          {brand.bannerShow && (
            brand.bannerImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.bannerImage} alt="" className="h-56 w-full object-cover" />
            ) : (
              <div className="h-56 w-full" style={{ background: 'linear-gradient(120deg, var(--mc-tertiary), var(--mc-primary))' }} />
            )
          )}
          <div className="flex-1 p-10 flex flex-col justify-between text-white" style={{ background: 'linear-gradient(160deg, var(--mc-primary) 0%, var(--mc-primary-dark) 100%)' }}>
            <div className="flex items-center gap-2.5">
              <BrandLogo brand={brand} light />
              <span className="font-bold text-lg">{brand.companyName}</span>
            </div>
            <div className="flex gap-4">
              <span aria-hidden className="w-1 rounded-full bg-white/80 shrink-0" />
              <div>
                <p className="text-lg font-semibold leading-snug">Welcome to {brand.companyName}</p>
                <p className="text-sm text-white/75 leading-relaxed mt-1">
                  {brand.bannerHeading} — {brand.bannerSubheading}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-white/50">{brand.city}, {brand.address} · {brand.phone}</p>
          </div>
        </div>
        <div className="p-8 md:p-12 flex flex-col justify-center">
          <div className="md:hidden flex items-center gap-2 mb-6">
            <BrandLogo brand={brand} />
            <h1 className="text-lg font-bold">{brand.companyName}</h1>
          </div>
          <FormFields onSubmit={onSubmit} loading={loading} heading="Staff Sign In" subheading="Cloud-based clinic & pharmacy management platform" />
        </div>
      </div>
    </div>
  );
}

/* ── D6: Floating Stats (login5 inspiration) ── */
function Design6({ brand, onSubmit, loading }: LoginDesignProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--mc-tertiary) 25%, #ffffff) 0%, #F1F9FE 100%)' }}>
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.15fr_1fr] rounded-[28px] overflow-hidden shadow-2xl bg-white">
        {/* Left: marketing + framed image with floating badges */}
        <div className="hidden lg:flex flex-col p-12 gap-8 relative" style={{ background: 'linear-gradient(180deg, #FBFDFF 0%, #F3F9FE 100%)' }}>
          <span aria-hidden className="absolute top-10 left-10 h-24 w-24 pointer-events-none opacity-30" style={{ backgroundImage: 'radial-gradient(circle, var(--mc-tertiary) 1.5px, transparent 1.5px)', backgroundSize: '16px 16px' }} />
          <div className="flex items-center gap-3">
            <BrandLogo brand={brand} />
            <div>
              <h1 className="text-lg font-extrabold">{brand.companyName}</h1>
              <p className="text-xs text-[var(--mc-text-secondary)]">{brand.slogan}</p>
            </div>
          </div>
          <div className="relative">
            <h2 className="text-3xl font-extrabold leading-tight text-[var(--mc-text-primary)] max-w-md">
              {brand.bannerHeading}
            </h2>
            <p className="text-sm text-[var(--mc-text-secondary)] mt-3 max-w-md leading-relaxed">{brand.bannerSubheading}</p>
          </div>
          <div className="relative rounded-[32px] overflow-hidden flex-1 min-h-[240px]" style={{ background: 'linear-gradient(150deg, var(--mc-primary) 0%, var(--mc-primary-dark) 100%)' }}>
            {brand.bannerShow && brand.bannerImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.bannerImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
            ) : (
              <Hospital className="absolute bottom-4 right-6 h-28 w-28 text-white/25" strokeWidth={1} />
            )}
            {/* Floating stat badges */}
            <span className="absolute top-5 left-5 bg-white rounded-2xl shadow-xl px-4 py-2.5 flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-[var(--mc-primary)]" />
              <span className="text-xs font-bold text-[var(--mc-text-primary)]">Secure Staff Access</span>
            </span>
            <span className="absolute bottom-5 left-8 bg-white rounded-2xl shadow-xl px-4 py-2.5 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-[var(--mc-text-primary)]">Role-based Portals</span>
            </span>
          </div>
          <div className="flex gap-5 text-xs text-[var(--mc-text-secondary)]">
            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{brand.phone}</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{brand.city}, {brand.address}</span>
          </div>
        </div>
        <div className="p-8 lg:p-12 flex flex-col justify-center border-l border-[var(--mc-divider)]">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <BrandLogo brand={brand} />
            <h1 className="text-lg font-bold">{brand.companyName}</h1>
          </div>
          <FormFields onSubmit={onSubmit} loading={loading} heading="Staff Sign In" subheading="Access your portal dashboard" />
        </div>
      </div>
    </div>
  );
}

const DESIGNS: Record<number, (p: LoginDesignProps) => React.ReactElement> = {
  1: Design1, 2: Design2, 3: Design3, 4: Design4, 5: Design5, 6: Design6,
};

export function LoginRouter({ design, ...props }: LoginDesignProps & { design: number }) {
  const Comp = DESIGNS[Math.min(Math.max(design, 1), 6)] || Design1;
  return <Comp {...props} />;
}
