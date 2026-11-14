'use client';

/**
 * INVENTORY PORTAL — sidebar layout via PortalShell. ADMIN + INVENTORY
 * manage everything; STAFF members see only their assigned items (API-scoped).
 * The Movements journal is ADMIN/INVENTORY-only (API guards it) so the nav
 * item is hidden for other roles.
 */

import * as React from 'react';
import { LayoutDashboard, Boxes, ArrowLeftRight, ClipboardList } from 'lucide-react';
import { PortalShell, type PortalNavItem } from '@/components/layouts/PortalShell';
import { useAuthStore } from '@/stores/auth-store';

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const canManage = user?.role === 'ADMIN' || user?.role === 'INVENTORY';

  const nav: PortalNavItem[] = [
    { label: 'Dashboard', href: '/inventory', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Items', href: '/inventory/items', icon: <Boxes className="h-4 w-4" /> },
    ...(canManage
      ? [{ label: 'Movements', href: '/inventory/movements', icon: <ArrowLeftRight className="h-4 w-4" /> }]
      : []),
    { label: 'Assignments', href: '/inventory/assignments', icon: <ClipboardList className="h-4 w-4" /> },
  ];

  return (
    <PortalShell
      layout="sidebar"
      title="Inventory"
      icon={<span className="font-bold text-sm">INV</span>}
      nav={nav}
      allowedRoles={['ADMIN', 'INVENTORY', 'STAFF']}
    >
      {children}
    </PortalShell>
  );
}
