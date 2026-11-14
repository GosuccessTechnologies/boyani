'use client';

/**
 * DOCTOR PORTAL — header + footer layout via PortalShell.
 * ADMIN + DOCTOR. Nav covers the clinical workflow pages.
 */

import {
  LayoutDashboard, CalendarCheck, Stethoscope, FilePlus2, Users, FlaskConical,
} from 'lucide-react';
import { PortalShell, type PortalNavItem } from '@/components/layouts/PortalShell';

const nav: PortalNavItem[] = [
  { label: 'Dashboard', href: '/doctor', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Appointments', href: '/doctor/appointments', icon: <CalendarCheck className="h-4 w-4" /> },
  { label: 'Consultations', href: '/doctor/consultations', icon: <Stethoscope className="h-4 w-4" /> },
  { label: 'Lab Requests', href: '/doctor/lab-requests', icon: <FlaskConical className="h-4 w-4" /> },
  { label: 'Prescriptions', href: '/doctor/prescriptions', icon: <FilePlus2 className="h-4 w-4" /> },
  { label: 'Patients', href: '/doctor/patients', icon: <Users className="h-4 w-4" /> },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      layout="header-footer"
      title="Doctor Portal"
      icon={<Stethoscope className="h-5 w-5" />}
      nav={nav}
      allowedRoles={['ADMIN', 'DOCTOR']}
    >
      {children}
    </PortalShell>
  );
}
