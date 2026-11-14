'use client';

/**
 * LABORATORY PORTAL — header + footer layout via PortalShell.
 * ADMIN + LAB_TECH. Worklist, result entry and test catalog.
 */

import {
  LayoutDashboard, FlaskConical, ClipboardList, BookOpen,
} from 'lucide-react';
import { PortalShell, type PortalNavItem } from '@/components/layouts/PortalShell';

const nav: PortalNavItem[] = [
  { label: 'Dashboard', href: '/lab', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Orders & Results', href: '/lab/orders', icon: <ClipboardList className="h-4 w-4" /> },
  { label: 'Test Catalog', href: '/lab/tests', icon: <BookOpen className="h-4 w-4" /> },
];

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      layout="header-footer"
      title="Laboratory Portal"
      icon={<FlaskConical className="h-5 w-5" />}
      nav={nav}
      allowedRoles={['ADMIN', 'LAB_TECH']}
    >
      {children}
    </PortalShell>
  );
}
