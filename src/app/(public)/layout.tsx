import { headers } from 'next/headers';
import { HeaderRouter } from '@/components/headers/HeaderDesigns';
import { FooterRouter } from '@/components/footers/FooterDesigns';
import { getSiteSetting, getCompanyConfig, getActiveMenu, getPublicWebPages, getActiveTheme } from '@/lib/public-data';
import { themeVarsDeclarations } from '@/lib/theme-utils';
import type { PublicMenuItem } from '@/components/headers/HeaderDesigns';

export const dynamic = 'force-dynamic';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Detect homepage so HeaderDesign4 (transparent-over-hero) works correctly.
  // Next.js sets x-pathname (or x-invoke-path) on every request; fall back to
  // x-forwarded-uri. If none available we default to non-home (safe fallback).
  const headersList = await headers();
  const pathname =
    headersList.get('x-pathname') ||
    headersList.get('x-invoke-path') ||
    headersList.get('x-forwarded-uri') ||
    '';
  const isHome = pathname === '/' || pathname === '';

  const [setting, company, menu, pages, activeTheme] = await Promise.all([
    getSiteSetting(),
    getCompanyConfig(),
    getActiveMenu('HEADER'),
    getPublicWebPages(),
    getActiveTheme(),
  ]);

  // SSR pre-paint theme vars (Instruction 5): the first server-rendered paint
  // already carries the ACTIVE theme colours — no teal flash before the client
  // ThemeProvider mounts. The client provider keeps them in sync afterwards.
  const ssrThemeCss = activeTheme
    ? `:root{${themeVarsDeclarations(activeTheme)}}${activeTheme.bodyFormat === 'boxed' ? 'body{max-width:1280px;margin:0 auto;box-shadow:0 0 40px rgba(0,0,0,0.08)}' : ''}${activeTheme.customCss || ''}`
    : '';

  const menuItems: PublicMenuItem[] = (menu?.items || []).map(item => ({
    id: item.id,
    label: item.label,
    url: item.url,
    moduleKey: item.moduleKey ?? null,
    isMega: item.isMega ?? false,
    children: (item.children || []).map(child => ({
      id: child.id,
      label: child.label,
      url: child.url,
    })),
  }));

  return (
    <div className="min-h-screen flex flex-col bg-[var(--mc-bg-body)]">
      {ssrThemeCss && <style id="mc-ssr-theme" dangerouslySetInnerHTML={{ __html: ssrThemeCss }} />}
      <HeaderRouter
        company={company}
        menu={menuItems}
        activeDesign={setting?.activeHeaderDesign || 1}
        isHome={isHome}
      />
      <main className="flex-1">{children}</main>
      <FooterRouter
        company={company}
        pages={pages.map(p => ({ slug: p.slug, title: p.title }))}
        activeDesign={setting?.activeFooterDesign || 1}
      />
    </div>
  );
}
