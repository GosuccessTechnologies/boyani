'use client';

/**
 * FRONT DESK PORTAL — header + footer layout via PortalShell.
 * ADMIN + RECEPTIONIST. Communication hub: SMS & email, parcels, calls.
 * Instruction 27 — split menu next to the Registrar portal.
 */

import {
  LayoutDashboard, MessageSquareText, Package, PhoneCall,
} from 'lucide-react';
import { PortalShell, type PortalNavItem } from '@/components/layouts/PortalShell';

const nav: PortalNavItem[] = [
  { label: 'Dashboard', href: '/frontdesk', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Communication', href: '/frontdesk/communication', icon: <MessageSquareText className="h-4 w-4" /> },
  { label: 'Parcels', href: '/frontdesk/parcels', icon: <Package className="h-4 w-4" /> },
  { label: 'Calls', href: '/frontdesk/calls', icon: <PhoneCall className="h-4 w-4" /> },
];

export default function FrontDeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      layout="header-footer"
      title="Front Desk"
      icon={<PhoneCall className="h-5 w-5" />}
      nav={nav}
      allowedRoles={['ADMIN', 'RECEPTIONIST']}
    >
      {children}
    </PortalShell>
  );
}
