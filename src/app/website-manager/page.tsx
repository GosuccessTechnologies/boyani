'use client';

/**
 * WEBSITE MANAGER DASHBOARD — KPIs from /api/dashboard?portal=website
 * + quick links to every publishing module.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, FileText, Newspaper, Download, Inbox, Images, CalendarCheck2,
  ArrowRight, Home, Menu as MenuIcon, Quote, HelpCircle, Stethoscope, FolderOpen, Settings2, Globe,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/client-api';
import { PageHeading } from '@/app/ops/_lib';

interface WebsiteKpis {
  publishedPages: number;
  newsCount: number;
  downloads: number;
  inquiries: number;
  newInquiries: number;
  activeSlider: number;
  appointmentsToday: number;
}

const QUICK_LINKS = [
  { href: '/website-manager/homepage', label: 'Homepage Designs', icon: <Home className="h-4 w-4" />, hint: '18 switchable designs' },
  { href: '/website-manager/sliders', label: 'Hero Sliders', icon: <Images className="h-4 w-4" />, hint: 'Slides & animations' },
  { href: '/website-manager/menus', label: 'Menus & Mega Menus', icon: <MenuIcon className="h-4 w-4" />, hint: 'Navigation tree' },
  { href: '/website-manager/pages', label: 'CMS Pages', icon: <FileText className="h-4 w-4" />, hint: 'About, values, contact…' },
  { href: '/website-manager/news', label: 'News & Events', icon: <Newspaper className="h-4 w-4" />, hint: 'Announcements' },
  { href: '/website-manager/downloads', label: 'Downloads Centre', icon: <Download className="h-4 w-4" />, hint: 'Forms & reports' },
  { href: '/website-manager/gallery', label: 'Gallery Albums', icon: <Images className="h-4 w-4" />, hint: 'Photo stories' },
  { href: '/website-manager/testimonials', label: 'Testimonials', icon: <Quote className="h-4 w-4" />, hint: 'Patient voices' },
  { href: '/website-manager/faqs', label: 'FAQs', icon: <HelpCircle className="h-4 w-4" />, hint: 'Answers hub' },
  { href: '/website-manager/doctors', label: 'Doctors Directory', icon: <Stethoscope className="h-4 w-4" />, hint: 'Find a doctor' },
  { href: '/website-manager/inquiries', label: 'Inquiries Inbox', icon: <Inbox className="h-4 w-4" />, hint: 'Contact messages' },
  { href: '/website-manager/files', label: 'File Manager', icon: <FolderOpen className="h-4 w-4" />, hint: 'Uploaded media' },
];

export default function WebsiteDashboardPage() {
  const router = useRouter();
  const [kpis, setKpis] = React.useState<WebsiteKpis | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiGet<{ kpis: WebsiteKpis }>('/api/dashboard?portal=website');
        if (alive) setKpis(res.kpis);
      } catch {
        if (alive) setKpis({ publishedPages: 0, newsCount: 0, downloads: 0, inquiries: 0, newInquiries: 0, activeSlider: 0, appointmentsToday: 0 });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<LayoutDashboard className="h-5 w-5" />}
        title="Website Manager"
        subtitle="Publish, activate and customize the public website"
        actions={<Button size="sm" variant="outline" className="gap-1" onClick={() => window.open('/', '_blank')}><Globe className="h-4 w-4" /> View Website</Button>}
      />

      {loading || !kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <StatCard label="Published Pages" value={kpis.publishedPages} icon={<FileText className="h-5 w-5" />} accent="primary" onClick={() => router.push('/website-manager/pages')} />
          <StatCard label="News Posts" value={kpis.newsCount} icon={<Newspaper className="h-5 w-5" />} accent="tertiary" onClick={() => router.push('/website-manager/news')} />
          <StatCard label="Downloads" value={kpis.downloads} icon={<Download className="h-5 w-5" />} accent="secondary" onClick={() => router.push('/website-manager/downloads')} />
          <StatCard label="Inquiries" value={kpis.inquiries} icon={<Inbox className="h-5 w-5" />} accent="warning" hint="all time" onClick={() => router.push('/website-manager/inquiries')} />
          <StatCard label="New Inquiries" value={kpis.newInquiries} icon={<Inbox className="h-5 w-5" />} accent="danger" hint="unread" onClick={() => router.push('/website-manager/inquiries')} />
          <StatCard label="Active Slides" value={kpis.activeSlider} icon={<Images className="h-5 w-5" />} accent="success" onClick={() => router.push('/website-manager/sliders')} />
          <StatCard label="Website Bookings" value={kpis.appointmentsToday} icon={<CalendarCheck2 className="h-5 w-5" />} accent="primary" hint="today" />
        </div>
      )}

      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-bold text-[var(--mc-text-primary)] mb-3">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {QUICK_LINKS.map(q => (
            <button
              key={q.href}
              onClick={() => router.push(q.href)}
              className="flex items-center gap-3 rounded-lg border border-[var(--mc-divider)] px-3 py-2.5 text-left hover:bg-[var(--mc-primary-light)] transition-colors"
            >
              <span className="h-8 w-8 rounded-lg mc-gradient-primary text-white flex items-center justify-center shrink-0">{q.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--mc-text-primary)] truncate">{q.label}</span>
                <span className="block text-[11px] text-muted-foreground truncate">{q.hint}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => router.push('/website-manager/settings')}><Settings2 className="h-4 w-4" /> Global Site Settings</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => router.push('/website-manager/homepage')}><Home className="h-4 w-4" /> Switch Homepage Design</Button>
        </div>
      </div>
    </div>
  );
}
