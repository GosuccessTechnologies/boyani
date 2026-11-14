'use client';

/**
 * ATTENDANCE PWA HEADER — logo + user name + logout (mobile top bar).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useCompany } from '@/hooks/use-company';

export function AttendanceHeader() {
  const router = useRouter();
  const { user, token, clearAuth } = useAuthStore();
  const { company } = useCompany();
  const facilityName = company.companyName || 'Boyani Health Dispensary';

  const logout = async () => {
    if (token) {
      await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    clearAuth();
    router.replace('/login');
  };

  return (
    <header className="sticky top-0 z-30 bg-[var(--mc-bg-header)] border-b border-[var(--mc-divider)]">
      <div className="max-w-md mx-auto flex items-center gap-2.5 px-4 h-14 pb-[env(safe-area-inset-top)]">
        <img src={company.logoUrl && company.logoUrl !== '/favicon.svg' ? company.logoUrl : '/logo.svg'} alt={`${facilityName} logo`} className="h-8 w-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold leading-tight text-[var(--mc-text-primary)]">{facilityName} Attendance</h1>
          <p className="text-[11px] text-muted-foreground truncate">
            {user ? `${user.firstName || ''} ${user.lastName || user.username}`.trim() : 'Staff'}{user ? ` · ${user.role}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="h-11 px-3 rounded-xl border border-[var(--mc-divider)] flex items-center gap-1.5 text-xs font-semibold text-[var(--mc-text-secondary)] hover:bg-[var(--mc-primary-light)] transition-colors"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden xs:inline sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
