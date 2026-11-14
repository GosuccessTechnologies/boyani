'use client';

/**
 * PORTAL SHELL v2 — renders portals in their mandated layouts
 * (sidebar+header | gradient-header+footer | full-screen POS).
 *
 * ── Sidebar layout imitates the Slack-style inspiration (white sidebar,
 *    260px, workspace header with facility name + chevron, section label,
 *    rounded active pills). Theme-driven: bgSidebar + sidebarStyle.
 * ── Header-footer layout imitates the blue-gradient dashboard inspiration
 *    (64px gradient sticky header, centered nav pills, avatar right).
 * ── Dynamic page header (Instruction 15): pages declare their title,
 *    description & submenu via PortalPageContext; the module header shows
 *    them with the logout button at the right end.
 */

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, Menu, X, ChevronRight, ChevronDown, ExternalLink, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { useCompany } from '@/hooks/use-company';
import { useTheme } from '@/components/themes/ThemeProvider';
import { PortalPageProvider, usePortalPage } from './PortalPageContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PortalNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface PortalShellProps {
  layout: 'sidebar' | 'header-footer' | 'pos';
  title: string;
  icon?: React.ReactNode;
  nav: PortalNavItem[];
  children: React.ReactNode;
  allowedRoles: string[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || 'B') + (parts[1]?.[0] || '')).toUpperCase();
}

function BrandLogo({ company, facilityName, size = 'md' }: { company: { logoUrl: string }; facilityName: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-8 w-8 text-sm' : 'h-9 w-9';
  const logoSrc = company.logoUrl && company.logoUrl !== '/favicon.svg' ? company.logoUrl : '/logo.svg';
  return (
    <div className={cn('rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0 overflow-hidden font-bold', cls)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} alt={facilityName} className="h-full w-full object-cover" />
    </div>
  );
}

export function PortalShell(props: PortalShellProps) {
  // Provider wraps the shell AND page children so both share page meta.
  return (
    <PortalPageProvider>
      <PortalShellInner {...props} />
    </PortalPageProvider>
  );
}

function PortalShellInner({ layout, title, icon, nav, children, allowedRoles }: PortalShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token } = useAuthGuard(allowedRoles);
  const { clearAuth } = useAuthStore();
  const { company } = useCompany();
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { page } = usePortalPage();

  const logout = async () => {
    if (token) await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    clearAuth();
    router.replace('/login');
  };

  const lightSidebar = (theme?.sidebarStyle || 'light') === 'light';
  const facilityName = company.companyName || 'Boyani Health Dispensary';
  const displayName = user ? `${user.firstName || ''} ${user.lastName || user.username}`.trim() : '';
  const avatarText = initials(displayName || facilityName);

  /* ── Sidebar nav links (Slack-style pills) ── */
  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-0.5">
      {nav.map(item => {
        const active = pathname === item.href;
        return (
          <button
            key={item.href}
            onClick={() => { router.push(item.href); onNavigate?.(); }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left group',
              active
                ? 'bg-[var(--mc-primary)] text-white shadow-sm'
                : lightSidebar
                  ? 'text-[#3d3d3e] hover:bg-[var(--mc-primary-light)] hover:text-[var(--mc-primary-dark)]'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
            )}
          >
            <span className={cn('shrink-0 transition-transform group-hover:scale-105', active ? 'text-white' : lightSidebar ? 'text-[#616061]' : 'text-slate-400')}>
              {item.icon}
            </span>
            <span className="flex-1 truncate">{item.label}</span>
            {active && <ChevronRight className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}
    </nav>
  );

  /* ── Sidebar workspace header (facility brand) ── */
  const SidebarBrand = () => (
    <div className={cn('px-1 pb-3 border-b', lightSidebar ? 'border-[var(--mc-divider)]' : 'border-white/10')}>
      <button
        onClick={() => router.push('/launcher')}
        className={cn('w-full flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors text-left group', lightSidebar ? 'hover:bg-[var(--mc-primary-light)]' : 'hover:bg-white/10')}
        title="Back to launcher"
      >
        <BrandLogo company={company} facilityName={facilityName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-bold truncate leading-tight', lightSidebar ? 'text-[#1d1c1d]' : 'text-white')}>{facilityName}</p>
          <p className={cn('text-[10px] truncate', lightSidebar ? 'text-[#616061]' : 'text-slate-400')}>{title}</p>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0', lightSidebar ? 'text-[#616061]' : 'text-slate-400')} />
      </button>
    </div>
  );

  /* ── Submenu pills rendered under the header when a page declares them ── */
  const SubMenuPills = ({ darkBg }: { darkBg?: boolean }) => {
    if (!page.subMenu?.length) return null;
    return (
      <div className="no-print px-4 py-2 border-b border-[var(--mc-divider)] bg-[var(--mc-bg-card)] overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {page.subMenu.map(sm => {
            const active = pathname === sm.href;
            return (
              <button
                key={sm.href + sm.label}
                onClick={() => router.push(sm.href)}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  active
                    ? 'bg-[var(--mc-primary)] text-white shadow-sm'
                    : darkBg
                      ? 'bg-white/10 text-white/85 hover:bg-white/20'
                      : 'text-[var(--mc-text-secondary)] hover:bg-[var(--mc-primary-light)]'
                )}
              >
                {sm.icon}{sm.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── Dynamic module header (Instruction 15) ──
   * Left: page title + description. Right: launcher, website, avatar, logout. */
  const ModuleHeader = ({ variant }: { variant: 'white' | 'gradient' }) => {
    const gradient = variant === 'gradient';
    const pageTitle = page.title || title;
    const pageDesc = page.description || `${facilityName} · ${title}`;
    return (
      <header
        className={cn('sticky top-0 z-30 no-print border-b', gradient
          ? 'border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
          : 'border-[var(--mc-divider)] bg-[var(--mc-bg-header)]')}
        style={gradient ? { background: 'linear-gradient(135deg, var(--mc-primary) 0%, var(--mc-primary-dark) 100%)' } : undefined}
      >
        <div className="flex items-center gap-3 px-4 h-16">
          {layout === 'sidebar' && (
            <button className="lg:hidden p-2 -ml-1" onClick={() => setSidebarOpen(s => !s)}>
              {sidebarOpen
                ? <X className={cn('h-5 w-5', gradient ? 'text-white' : 'text-[var(--mc-text-primary)]')} />
                : <Menu className={cn('h-5 w-5', gradient ? 'text-white' : 'text-[var(--mc-text-primary)]')} />}
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className={cn('font-bold leading-tight truncate', gradient ? 'text-white' : 'text-[var(--mc-text-primary)]')}>{pageTitle}</h1>
            <p className={cn('text-[11px] truncate', gradient ? 'text-white/70' : 'text-muted-foreground')}>{pageDesc}</p>
          </div>
          <div className="flex-1 hidden md:block" />
          <button
            onClick={() => router.push('/launcher')}
            className={cn('hidden sm:flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors',
              gradient
                ? 'border-white/30 text-white hover:bg-white/15'
                : 'border-[var(--mc-divider)] text-muted-foreground hover:bg-[var(--mc-primary-light)]')}
            title="Module launcher"
          >
            <ArrowLeft className="h-3 w-3" /> Launcher
          </button>
          <a href="/" target="_blank" className={cn('hidden sm:flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors',
            gradient
              ? 'border-white/30 text-white hover:bg-white/15'
              : 'border-[var(--mc-divider)] text-muted-foreground hover:bg-[var(--mc-primary-light)]')}>
            <ExternalLink className="h-3 w-3" /> Website
          </a>
          {/* Avatar */}
          <div
            className={cn('h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border-2', gradient ? 'border-white/40 text-white' : 'border-[var(--mc-primary)] text-[var(--mc-primary-dark)] bg-[var(--mc-primary-light)]')}
            title={displayName}
          >
            {avatarText}
          </div>
          <Button
            size="sm"
            className="h-8 gap-1 bg-red-600 hover:bg-red-500 text-white border-transparent"
            onClick={logout}
          >
            <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
        <SubMenuPills darkBg={gradient} />
      </header>
    );
  };

  /* ── Full-screen POS layout (no chrome — pages draw their own nav) ── */
  if (layout === 'pos') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    );
  }

  /* ── Sidebar layout (Slack-style) ── */
  if (layout === 'sidebar') {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex flex-1">
          {/* Desktop sidebar */}
          <aside
            className={cn('hidden lg:flex flex-col w-[260px] shrink-0 sticky top-0 h-screen overflow-y-auto py-3 px-3 no-print border-r',
              lightSidebar ? 'bg-[var(--mc-bg-sidebar)] border-[var(--mc-divider)]' : 'bg-[var(--mc-bg-sidebar)] border-white/10')}
          >
            <SidebarBrand />
            <div className="pt-3 pb-1 px-2">
              <p className={cn('text-[11px] uppercase tracking-widest font-bold', lightSidebar ? 'text-[#616061]' : 'text-white/40')}>Menu</p>
            </div>
            <NavLinks />
            <div className={cn('mt-auto pt-3 border-t', lightSidebar ? 'border-[var(--mc-divider)]' : 'border-white/10')}>
              <button onClick={() => router.push('/launcher')} className={cn('w-full text-xs flex items-center gap-2 py-2 px-2 rounded-lg transition-colors', lightSidebar ? 'text-[#616061] hover:bg-[var(--mc-primary-light)] hover:text-[var(--mc-primary-dark)]' : 'text-white/60 hover:text-white hover:bg-white/10')}>
                <ArrowLeft className="h-3 w-3" /> Back to Launcher
              </button>
            </div>
          </aside>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
              <aside className={cn('absolute left-0 top-0 bottom-0 w-[260px] py-3 px-3 overflow-y-auto border-r', lightSidebar ? 'bg-[var(--mc-bg-sidebar)] border-[var(--mc-divider)]' : 'bg-[var(--mc-bg-sidebar)] border-white/10')}>
                <div className="flex items-start justify-between gap-2">
                  <SidebarBrand />
                  <button onClick={() => setSidebarOpen(false)} className="p-1 shrink-0"><X className={cn('h-4 w-4', lightSidebar ? 'text-[#616061]' : 'text-white/60')} /></button>
                </div>
                <NavLinks onNavigate={() => setSidebarOpen(false)} />
                <button onClick={() => router.push('/launcher')} className={cn('mt-3 w-full text-xs flex items-center gap-2 py-2 px-2 rounded-lg', lightSidebar ? 'text-[#616061] hover:bg-[var(--mc-primary-light)]' : 'text-white/60 hover:text-white hover:bg-white/10')}>
                  <ArrowLeft className="h-3 w-3" /> Back to Launcher
                </button>
              </aside>
            </div>
          )}

          <div className="flex-1 flex flex-col min-w-0">
            <ModuleHeader variant="white" />
            <main className="flex-1 p-4 md:p-6">{children}</main>
            <footer className="py-4 px-6 border-t border-[var(--mc-divider)] text-xs text-muted-foreground flex items-center justify-between no-print">
              <span>{facilityName} — {title}</span>
              <button onClick={() => router.push('/launcher')} className="hover:text-[var(--mc-primary)]">Launcher</button>
            </footer>
          </div>
        </div>
      </div>
    );
  }

  /* ── Gradient header + footer layout (clinical portals) ── */
  return (
    <div className="min-h-screen flex flex-col">
      <ModuleHeader variant="gradient" />
      {/* Secondary nav pills (module navigation) */}
      <div className="bg-[var(--mc-bg-card)] border-b border-[var(--mc-divider)] sticky top-[68px] z-20 no-print">
        <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto">
          {nav.map(item => {
            const active = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  active ? 'bg-[var(--mc-primary)] text-white shadow-sm' : 'text-[var(--mc-text-secondary)] hover:bg-[var(--mc-primary-light)]'
                )}
              >
                {item.icon}{item.label}
              </button>
            );
          })}
        </div>
      </div>
      <main className="flex-1 p-4 md:p-6">{children}</main>
      <footer className="mt-auto py-4 px-6 border-t border-[var(--mc-divider)] text-xs text-muted-foreground flex items-center justify-between no-print">
        <span>{facilityName} — {title}</span>
        <button onClick={() => router.push('/launcher')} className="hover:text-[var(--mc-primary)]">Back to Launcher</button>
      </footer>
    </div>
  );
}

/** Back-compat alias — PortalShell already wraps itself in the page provider. */
export const PortalShellWithPageContext = PortalShell;
