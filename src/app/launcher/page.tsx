'use client';

/**
 * LAUNCHER v2 — module cards per role.
 * Instruction 3: doubled header height, red logout, blue protruded welcome
 * band with white text, premium cards with title in hero + icon + label,
 * animated folded-diagonal gradient at bottom-right, doubled icon size.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Pill, Stethoscope, ClipboardList, Calculator, HeartPulse, FlaskConical,
  CalendarCheck, Boxes, Users, Globe, LogOut, Loader2, ChevronRight, Clock, PhoneCall,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { useCompany } from '@/hooks/use-company';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ModuleCard {
  slug: string;
  title: string;
  description: string;
  href: string;
  icon: typeof Globe;
  gradient: string;
  glow: string;
  tag: string;
}

const ALL_MODULES: ModuleCard[] = [
  {
    slug: 'facility', title: 'Facility Management',
    description: 'Complete admin control — services & pricing, drugs catalog, users, departments, wards, themes, printer & company settings.',
    href: '/admin', icon: Building2, gradient: 'linear-gradient(135deg, #0f766e 0%, #0d9488 60%, #14b8a6 100%)', glow: 'rgba(13,148,136,0.35)', tag: 'Admin',
  },
  {
    slug: 'pharmacy', title: 'Pharmacy',
    description: 'Pharmaceutical POS — dispense drugs, walk-in counter sales, pending prescriptions, own daily takings.',
    href: '/pharmacy', icon: Pill, gradient: 'linear-gradient(135deg, #92400e 0%, #f59e0b 60%, #fbbf24 100%)', glow: 'rgba(245,158,11,0.35)', tag: 'POS',
  },
  {
    slug: 'doctor', title: 'Doctor Portal',
    description: 'Consultations, diagnoses, prescriptions, lab requests, appointments & patient history.',
    href: '/doctor', icon: Stethoscope, gradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 60%, #60a5fa 100%)', glow: 'rgba(59,130,246,0.35)', tag: 'Clinical',
  },
  {
    slug: 'registrar', title: 'Registrar Portal',
    description: 'Patient registration, visit management, patient search & history, quick lab tests.',
    href: '/registrar', icon: ClipboardList, gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0891b2 60%, #22d3ee 100%)', glow: 'rgba(8,145,178,0.35)', tag: 'Front Office',
  },
  {
    slug: 'frontdesk', title: 'Front Desk',
    description: 'Communication hub — SMS & email, parcels receiving/dispatch, call logging.',
    href: '/frontdesk', icon: PhoneCall, gradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 60%, #818cf8 100%)', glow: 'rgba(79,70,229,0.35)', tag: 'Front Office',
  },
  {
    slug: 'cashier', title: 'Cashier Portal',
    description: 'Cashier POS — import all departmental charges, receive cash/MPESA/SHA payments, print A4/A5 receipts.',
    href: '/cashier', icon: Calculator, gradient: 'linear-gradient(135deg, #14532d 0%, #16a34a 60%, #4ade80 100%)', glow: 'rgba(22,163,74,0.35)', tag: 'POS',
  },
  {
    slug: 'nursing', title: 'Nursing Portal',
    description: 'Vitals recording, patient admissions, ward & bed management, doctor assignments.',
    href: '/nursing', icon: HeartPulse, gradient: 'linear-gradient(135deg, #9f1239 0%, #e11d48 60%, #fb7185 100%)', glow: 'rgba(225,29,72,0.35)', tag: 'Wards',
  },
  {
    slug: 'lab', title: 'Laboratory Portal',
    description: 'Lab orders queue, specimen tracking, result entry & verification, test catalog.',
    href: '/lab', icon: FlaskConical, gradient: 'linear-gradient(135deg, #5b21b6 0%, #8b5cf6 60%, #a78bfa 100%)', glow: 'rgba(139,92,246,0.35)', tag: 'Diagnostics',
  },
  {
    slug: 'attendance', title: 'Attendance PWA',
    description: 'GPS-checked check-in & check-out — installable on phone for daily use.',
    href: '/attendance', icon: CalendarCheck, gradient: 'linear-gradient(135deg, #075985 0%, #0284c7 60%, #38bdf8 100%)', glow: 'rgba(2,132,199,0.35)', tag: 'PWA',
  },
  {
    slug: 'inventory', title: 'Inventory',
    description: 'Equipment, consumables & assets — movements, assignments, restock levels.',
    href: '/inventory', icon: Boxes, gradient: 'linear-gradient(135deg, #78350f 0%, #d97706 60%, #fbbf24 100%)', glow: 'rgba(217,119,6,0.35)', tag: 'Assets',
  },
  {
    slug: 'hr', title: 'Human Resources',
    description: 'Employees, shifts & assignments, job postings, applications review, payroll with Kenyan deductions.',
    href: '/hr', icon: Users, gradient: 'linear-gradient(135deg, #334155 0%, #64748b 60%, #94a3b8 100%)', glow: 'rgba(100,116,139,0.35)', tag: 'People',
  },
  {
    slug: 'website-manager', title: 'Website Manager',
    description: 'Publish & customize the public website — 18 homepage designs, sliders, menus, themes, pages, news, downloads.',
    href: '/website-manager', icon: Globe, gradient: 'linear-gradient(135deg, #134e4a 0%, #14b8a6 60%, #5eead4 100%)', glow: 'rgba(20,184,166,0.35)', tag: 'Public Site',
  },
];

export default function LauncherPage() {
  const router = useRouter();
  const { user } = useAuthGuard();
  const { token, clearAuth } = useAuthStore();
  const { company } = useCompany();
  const [accessible, setAccessible] = useState<string[]>([]);
  const [clock, setClock] = useState('');
  const [loading, setLoading] = useState(true);

  const facilityName = company.companyName || 'Boyani Health Dispensary';
  const slogan = company.companySlogan || 'Quality Care, Compassionate Service';

  useEffect(() => {
    if (!token) return; // guard handles redirect
    fetch('/api/auth/module-access', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setAccessible(data.modules || ['attendance']))
      .catch(() => setAccessible(['attendance']))
      .finally(() => setLoading(false));
  }, [token, router]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }));
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  const logout = async () => {
    if (token) {
      await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    clearAuth();
    toast.success('Signed out');
    router.replace('/login');
  };

  const modules = ALL_MODULES.filter(m => accessible.includes(m.slug));

  return (
    <div className="min-h-screen bg-[var(--mc-bg-body)] flex flex-col">
      {/* Header — same gradient as the welcome band so they read as one hero zone */}
      <header className="text-white shadow-lg no-print" style={{ background: 'linear-gradient(120deg, var(--mc-primary) 0%, var(--mc-primary-dark) 100%)' }}>
        <div className="mc-container flex items-center justify-between py-8">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl mc-gradient-primary flex items-center justify-center font-bold text-xl shadow-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={company.logoUrl && company.logoUrl !== '/favicon.svg' ? company.logoUrl : '/logo.svg'}
                alt={facilityName}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h1 className="font-extrabold text-2xl leading-tight tracking-tight">{facilityName}</h1>
              <p className="text-sm text-white/60 mt-0.5">{slogan} · Launcher — Module Portals</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs text-white/70 bg-white/10 px-3 py-2 rounded-full">
              <Clock className="h-3.5 w-3.5" /> {clock}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold">{user?.firstName || ''} {user?.lastName || user?.username}</p>
              <p className="text-xs text-white/60">{user?.role}</p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-red-600 hover:bg-red-500 text-white border-transparent shadow-md h-10 px-4"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Module grid */}
      <main className="mc-container flex-1 w-full pt-6 pb-14">
        {loading ? (
          <div className="flex items-center justify-center py-28">
            <Loader2 className="h-10 w-10 animate-spin text-[var(--mc-primary)]" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-6">
            {modules.map(m => (
              <button
                key={m.slug}
                onClick={() => router.push(m.href)}
                className="group relative overflow-hidden rounded-2xl bg-white border border-[var(--mc-divider)] shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 text-left"
                style={{ ['--card-glow' as string]: m.glow }}
              >
                {/* Hero section — icon + title fused together, tag badge top-right */}
                <div className="relative h-36 p-5 flex flex-col justify-between" style={{ background: m.gradient }}>
                  {/* Top row: icon left, tag badge right */}
                  <div className="flex items-start justify-between">
                    <m.icon className="h-12 w-12 text-white/95 drop-shadow-lg transition-transform duration-300 group-hover:scale-110" strokeWidth={1.6} />
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-white/25 text-white px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/20">{m.tag}</span>
                  </div>
                  {/* Title fused with icon area — sits at the bottom of the hero */}
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-white leading-tight drop-shadow">
                      {m.title}
                    </h3>
                    <ChevronRight className="h-4 w-4 text-white/70 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0" />
                  </div>
                  {/* folded diagonal animated gradient at bottom-right */}
                  <span
                    aria-hidden
                    className="launcher-fold absolute bottom-0 right-0 h-20 w-20"
                    style={{
                      background: 'linear-gradient(315deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 55%, transparent 55.5%)',
                      clipPath: 'polygon(100% 0, 0% 100%, 100% 100%)',
                    }}
                  />
                  <span
                    aria-hidden
                    className="launcher-fold-line absolute bottom-0 right-0 h-14 w-14"
                    style={{
                      background: 'linear-gradient(315deg, rgba(255,255,255,0.6), rgba(255,255,255,0.15))',
                      clipPath: 'polygon(100% 0, 0% 100%, 100% 100%)',
                      animation: 'launcherGlow 3.2s ease-in-out infinite',
                    }}
                  />
                </div>
                {/* Body — description only */}
                <div className="p-5 relative">
                  <p className="text-sm text-[var(--mc-text-secondary)] line-clamp-3 leading-relaxed">{m.description}</p>
                </div>
                {/* hover glow */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4), 0 12px 40px -12px var(--card-glow)' }}
                />
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-auto py-6 text-center text-xs text-muted-foreground no-print">
        {facilityName} Management System · <a href="/" className="text-[var(--mc-primary)] hover:underline">Public website →</a>
      </footer>

      <style jsx global>{`
        @keyframes launcherGlow {
          0%, 100% { opacity: 0.45; transform: translate(2px, 2px) scale(1); }
          50% { opacity: 0.9; transform: translate(0, 0) scale(1.06); }
        }
      `}</style>
    </div>
  );
}
