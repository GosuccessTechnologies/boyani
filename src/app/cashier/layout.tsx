'use client';

/**
 * CASHIER PORTAL — full-screen POS layout via PortalShell (DEVELOPER-MANUAL §3).
 * ADMIN + CASHIER. Nav: Collections · History.
 * (PortalShell "pos" layout renders no nav strip — each page renders its own
 * PosNav pills from pos/_lib.)
 */

import { Calculator, History, Coins } from 'lucide-react';
import { PortalShell, type PortalNavItem } from '@/components/layouts/PortalShell';

const nav: PortalNavItem[] = [
  { label: 'Collections', href: '/cashier', icon: <Coins className="h-4 w-4" /> },
  { label: 'History', href: '/cashier/history', icon: <History className="h-4 w-4" /> },
];

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      layout="pos"
      title="Cashier POS"
      icon={<Calculator className="h-5 w-5" />}
      nav={nav}
      allowedRoles={['ADMIN', 'CASHIER']}
    >
      {children}
    </PortalShell>
  );
}
