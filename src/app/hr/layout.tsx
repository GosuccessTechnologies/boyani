'use client';

/**
 * HR PORTAL — sidebar layout via PortalShell.
 *
 * ADMIN + HR see the full module nav (including the My Payroll
 * self-service view). Every OTHER authenticated staff member gets the
 * self-service view only: the nav collapses to "My Payroll" and the
 * layout redirects them away from the admin pages — the APIs enforce
 * HR_ROLES server-side as well, so the admin pages stay ADMIN/HR only.
 */

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, IdCard, CalendarClock, BriefcaseBusiness, FileStack,
  Banknote, CalendarCheck2, Settings2, Wallet,
} from 'lucide-react';
import { PortalShell, type PortalNavItem } from '@/components/layouts/PortalShell';
import { useAuthStore } from '@/stores/auth-store';

const HR_ROLES = ['ADMIN', 'HR'];
const SELF_SERVICE_HREF = '/hr/my-payroll';

const ADMIN_NAV: PortalNavItem[] = [
  { label: 'Dashboard', href: '/hr', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Employees', href: '/hr/employees', icon: <IdCard className="h-4 w-4" /> },
  { label: 'Shifts', href: '/hr/shifts', icon: <CalendarClock className="h-4 w-4" /> },
  { label: 'Job Postings', href: '/hr/jobs', icon: <BriefcaseBusiness className="h-4 w-4" /> },
  { label: 'Applications', href: '/hr/applications', icon: <FileStack className="h-4 w-4" /> },
  { label: 'Payroll', href: '/hr/payroll', icon: <Banknote className="h-4 w-4" /> },
  { label: 'My Payroll', href: SELF_SERVICE_HREF, icon: <Wallet className="h-4 w-4" /> },
  { label: 'Attendance', href: '/hr/attendance', icon: <CalendarCheck2 className="h-4 w-4" /> },
  { label: 'Settings', href: '/hr/settings', icon: <Settings2 className="h-4 w-4" /> },
];

const SELF_NAV: PortalNavItem[] = [
  { label: 'My Payroll', href: SELF_SERVICE_HREF, icon: <Wallet className="h-4 w-4" /> },
];

export default function HrLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  const pathname = usePathname();
  const router = useRouter();
  const isHR = !!user && HR_ROLES.includes(user.role);

  // Non-ADMIN/HR staff may only open the self-service page
  React.useEffect(() => {
    if (user && !isHR && pathname !== SELF_SERVICE_HREF) {
      router.replace(SELF_SERVICE_HREF);
    }
  }, [user, isHR, pathname, router]);

  return (
    <PortalShell
      layout="sidebar"
      title="Human Resources"
      icon={<span className="font-bold text-sm">HR</span>}
      nav={isHR ? ADMIN_NAV : SELF_NAV}
      allowedRoles={[]}
    >
      {children}
    </PortalShell>
  );
}
