'use client';

/**
 * REGISTRAR PORTAL — header + footer layout via PortalShell.
 * ADMIN + RECEPTIONIST. Patient registration, visits & registry.
 */

import {
  LayoutDashboard, UserPlus, CalendarClock, Users,
} from 'lucide-react';
import { PortalShell, type PortalNavItem } from '@/components/layouts/PortalShell';

const nav: PortalNavItem[] = [
  { label: 'Dashboard', href: '/registrar', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Register Patient', href: '/registrar/register', icon: <UserPlus className="h-4 w-4" /> },
  { label: 'Visits', href: '/registrar/visits', icon: <CalendarClock className="h-4 w-4" /> },
  { label: 'Patient Registry', href: '/registrar/patients', icon: <Users className="h-4 w-4" /> },
];

export default function RegistrarLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      layout="header-footer"
      title="Registrar Portal"
      icon={<UserPlus className="h-5 w-5" />}
      nav={nav}
      allowedRoles={['ADMIN', 'RECEPTIONIST']}
    >
      {children}
    </PortalShell>
  );
}
