'use client';

/**
 * WEBSITE MANAGER PORTAL — sidebar layout via PortalShell. ADMIN-only.
 * Publish / activate / customize the public website.
 */

import {
  LayoutDashboard, Home, Images, Menu as MenuIcon, FileText, Newspaper,
  Download, Image as ImageIcon, Quote, HelpCircle, Stethoscope, Inbox,
  FolderOpen, Settings2, KeyRound, BriefcaseMedical,
} from 'lucide-react';
import { PortalShell, type PortalNavItem } from '@/components/layouts/PortalShell';

const nav: PortalNavItem[] = [
  { label: 'Dashboard', href: '/website-manager', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Homepage Designs', href: '/website-manager/homepage', icon: <Home className="h-4 w-4" /> },
  { label: 'Sliders', href: '/website-manager/sliders', icon: <Images className="h-4 w-4" /> },
  { label: 'Menus', href: '/website-manager/menus', icon: <MenuIcon className="h-4 w-4" /> },
  { label: 'Pages', href: '/website-manager/pages', icon: <FileText className="h-4 w-4" /> },
  { label: 'Services', href: '/website-manager/services', icon: <BriefcaseMedical className="h-4 w-4" /> },
  { label: 'News', href: '/website-manager/news', icon: <Newspaper className="h-4 w-4" /> },
  { label: 'Downloads', href: '/website-manager/downloads', icon: <Download className="h-4 w-4" /> },
  { label: 'Gallery', href: '/website-manager/gallery', icon: <ImageIcon className="h-4 w-4" /> },
  { label: 'Testimonials', href: '/website-manager/testimonials', icon: <Quote className="h-4 w-4" /> },
  { label: 'FAQs', href: '/website-manager/faqs', icon: <HelpCircle className="h-4 w-4" /> },
  { label: 'Doctors', href: '/website-manager/doctors', icon: <Stethoscope className="h-4 w-4" /> },
  { label: 'Inquiries', href: '/website-manager/inquiries', icon: <Inbox className="h-4 w-4" /> },
  { label: 'Files', href: '/website-manager/files', icon: <FolderOpen className="h-4 w-4" /> },
  { label: 'Login Designs', href: '/website-manager/login-designs', icon: <KeyRound className="h-4 w-4" /> },
  { label: 'Site Settings', href: '/website-manager/settings', icon: <Settings2 className="h-4 w-4" /> },
];

export default function WebsiteManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      layout="sidebar"
      title="Website Manager"
      icon={<span className="font-bold text-sm">WM</span>}
      nav={nav}
      allowedRoles={['ADMIN']}
    >
      {children}
    </PortalShell>
  );
}
