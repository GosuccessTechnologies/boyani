'use client';

/**
 * NURSING PORTAL — header + footer layout via PortalShell.
 * ADMIN + NURSE. Vitals, admissions & bed board, duty assignments.
 */

import {
  LayoutDashboard, Activity, BedDouble, CalendarClock,
} from 'lucide-react';
import { PortalShell, type PortalNavItem } from '@/components/layouts/PortalShell';

const nav: PortalNavItem[] = [
  { label: 'Dashboard', href: '/nursing', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Record Vitals', href: '/nursing/vitals', icon: <Activity className="h-4 w-4" /> },
  { label: 'Admissions & Beds', href: '/nursing/admissions', icon: <BedDouble className="h-4 w-4" /> },
  { label: 'My Assignments', href: '/nursing/assignments', icon: <CalendarClock className="h-4 w-4" /> },
];

export default function NursingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      layout="header-footer"
      title="Nursing Portal"
      icon={<Activity className="h-5 w-5" />}
      nav={nav}
      allowedRoles={['ADMIN', 'NURSE']}
    >
      {children}
    </PortalShell>
  );
}
