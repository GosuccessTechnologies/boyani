'use client';

/**
 * PHARMACY HERO HEADER — shared across Dispensing POS, Prescriptions, and
 * Sales History. Full-width, flat border, touches left-to-right edges.
 * Contains: icon + title + description (left) · user name + role (centre) ·
 * live clock + date (right) · red logout button (far right).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Clock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { Button } from '@/components/ui/button';

interface PharmacyHeroHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function PharmacyHeroHeader({ icon, title, description }: PharmacyHeroHeaderProps) {
  const router = useRouter();
  const { user, token } = useAuthGuard(['ADMIN', 'PHARMACIST']);
  const { clearAuth } = useAuthStore();
  const [now, setNow] = React.useState<Date | null>(null);

  // Hydration-safe clock — only starts ticking on the client
  React.useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const logout = async () => {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    clearAuth();
    router.replace('/login');
  };

  const displayName = user
    ? `${user.firstName || ''} ${user.lastName || user.username || ''}`.trim()
    : '';

  return (
    <header
      className="no-print w-full shrink-0 border-b border-white/15"
      style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
    >
      <div className="flex items-center gap-4 px-4 py-3">

        {/* ── Left: icon + title + description ── */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 border border-white/25">
            {icon}
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-white text-base md:text-lg leading-tight tracking-tight truncate">
              {title}
            </h1>
            <p className="text-white/70 text-[11px] md:text-xs truncate mt-0.5">{description}</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* ── Centre-right: user name + role ── */}
        {displayName && (
          <div className="hidden sm:block text-right shrink-0">
            <p className="text-white font-semibold text-sm leading-tight">{displayName}</p>
            <p className="text-white/60 text-[11px] uppercase tracking-wide">{user?.role}</p>
          </div>
        )}

        {/* ── Right: live clock + date ── */}
        <div className="hidden md:block text-right shrink-0">
          <p className="text-white font-extrabold text-sm leading-none tabular-nums flex items-center gap-1.5 justify-end">
            <Clock className="h-3.5 w-3.5 text-white/70" />
            {now
              ? now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : '—'}
          </p>
          <p className="text-white/65 text-[11px] mt-0.5">
            {now
              ? now.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
              : ''}
          </p>
        </div>

        {/* ── Far right: logout ── */}
        <Button
          size="sm"
          className="h-9 gap-1.5 bg-red-600 hover:bg-red-500 text-white border-transparent shadow-md shrink-0"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
