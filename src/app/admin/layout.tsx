'use client';

/**
 * FACILITY MANAGEMENT (admin) PORTAL — sidebar layout via PortalShell.
 * ADMIN-only. Nav covers every module page of the portal.
 */

import {
  LayoutDashboard, Stethoscope, Building2, Pill, Users, BedDouble,
  CalendarClock, IdCard, ReceiptText, TrendingUp, Palette, Settings, Printer, FileSliders, CreditCard,
} from 'lucide-react';
import { PortalShell, type PortalNavItem } from '@/components/layouts/PortalShell';

const nav: PortalNavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Services & Pricing', href: '/admin/services', icon: <Stethoscope className="h-4 w-4" /> },
  { label: 'Departments', href: '/admin/departments', icon: <Building2 className="h-4 w-4" /> },
  { label: 'Drug Catalog', href: '/admin/drugs', icon: <Pill className="h-4 w-4" /> },
  { label: 'Users & Roles', href: '/admin/users', icon: <Users className="h-4 w-4" /> },
  { label: 'Wards & Beds', href: '/admin/wards', icon: <BedDouble className="h-4 w-4" /> },
  { label: 'Staff Shifts', href: '/admin/shifts', icon: <CalendarClock className="h-4 w-4" /> },
  { label: 'Employees', href: '/admin/employees', icon: <IdCard className="h-4 w-4" /> },
  { label: 'Quotations', href: '/admin/quotations', icon: <ReceiptText className="h-4 w-4" /> },
  { label: 'Profit & Loss', href: '/admin/profit-loss', icon: <TrendingUp className="h-4 w-4" /> },
  { label: 'Documents & Letterheads', href: '/admin/documents', icon: <FileSliders className="h-4 w-4" /> },
  { label: 'Payment Integrations', href: '/admin/integrations', icon: <CreditCard className="h-4 w-4" /> },
  { label: 'Theme Manager', href: '/admin/themes', icon: <Palette className="h-4 w-4" /> },
  { label: 'Facility Settings', href: '/admin/company', icon: <Settings className="h-4 w-4" /> },
  { label: 'Printer Setup', href: '/admin/printer', icon: <Printer className="h-4 w-4" /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      layout="sidebar"
      title="Facility Management"
      icon={<span className="font-bold text-sm">FM</span>}
      nav={nav}
      allowedRoles={['ADMIN']}
    >
      {children}
    </PortalShell>
  );
}
