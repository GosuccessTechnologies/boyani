'use client';

/**
 * PHARMACY PORTAL — full-screen POS layout via PortalShell (DEVELOPER-MANUAL §3).
 * ADMIN + PHARMACIST. Nav: Dispensing · Prescriptions · Sales History.
 * (PortalShell "pos" layout renders no nav strip — each page renders its own
 * PosNav pills from pos/_lib.)
 */

import { Pill, ScrollText, History } from 'lucide-react';
import { PortalShell, type PortalNavItem } from '@/components/layouts/PortalShell';

const nav: PortalNavItem[] = [
  { label: 'Dispensing', href: '/pharmacy', icon: <Pill className="h-4 w-4" /> },
  { label: 'Prescriptions', href: '/pharmacy/prescriptions', icon: <ScrollText className="h-4 w-4" /> },
  { label: 'Sales History', href: '/pharmacy/sales', icon: <History className="h-4 w-4" /> },
];

export default function PharmacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      layout="pos"
      title="Pharmacy POS"
      icon={<Pill className="h-5 w-5" />}
      nav={nav}
      allowedRoles={['ADMIN', 'PHARMACIST']}
    >
      {children}
    </PortalShell>
  );
}
