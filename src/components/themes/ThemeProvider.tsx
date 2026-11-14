'use client';

/**
 * THEME PROVIDER — reads the ACTIVE Theme from /api/themes and injects
 * --mc-* CSS variables on <html>. Affects the ENTIRE system (dashboards +
 * public website).
 *
 * Instruction 5 FIX: the /api/themes list response is
 * `{ themes, activeThemeId, siteSetting }` (it never contained `activeTheme`),
 * so the previous `data.activeTheme || data.themes[0]` ALWAYS fell back to
 * theme #1 — changing the theme in /admin/themes appeared to do nothing.
 * We now resolve the active theme from `activeThemeId` and fall back to the
 * `?public=1` shape (`{ activeTheme }`) or the first theme.
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { googleFontsUrl } from '@/lib/google-fonts';
import { darken, lighten, ThemeLike } from '@/lib/theme-utils';

export type ThemeData = ThemeLike & {
  id: number;
  name: string;
  description?: string | null;
};

interface ThemeContextType {
  theme: ThemeData | null;
  themes: ThemeData[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({ theme: null, themes: [], loading: true, refresh: async () => {} });

export function applyThemeVars(theme: ThemeData) {
  const root = document.documentElement;
  root.style.setProperty('--mc-primary', theme.primary);
  root.style.setProperty('--mc-primary-dark', darken(theme.primary));
  root.style.setProperty('--mc-primary-light', lighten(theme.primary, 0.85));
  root.style.setProperty('--mc-secondary', theme.secondary);
  root.style.setProperty('--mc-tertiary', theme.tertiary);
  root.style.setProperty('--mc-bg-body', theme.bgBody);
  root.style.setProperty('--mc-bg-card', theme.bgCard);
  root.style.setProperty('--mc-bg-sidebar', theme.bgSidebar);
  root.style.setProperty('--mc-bg-header', theme.bgHeader);
  root.style.setProperty('--mc-bg-footer', theme.bgFooter);
  root.style.setProperty('--mc-bg-card-header', theme.bgCardHeader);
  root.style.setProperty('--mc-text-primary', theme.textPrimary);
  root.style.setProperty('--mc-text-secondary', theme.textSecondary);
  root.style.setProperty('--mc-text-muted', theme.textMuted);
  root.style.setProperty('--mc-divider', theme.dividerColor);
  root.style.setProperty('--mc-scrollbar', theme.scrollbarColor);
  root.style.setProperty('--mc-scrollbar-track', theme.scrollbarTrack);
  root.style.setProperty('--mc-font-body', `"${theme.fontBody}", system-ui, sans-serif`);
  root.style.setProperty('--mc-font-heading', `"${theme.fontHeading}", system-ui, sans-serif`);
  root.style.setProperty('--mc-radius', theme.cardRadius?.includes('rounded') ? '0.75rem' : (theme.cardRadius || '0.75rem'));
  root.style.setProperty('--mc-card-radius', theme.cardRadius?.includes('rounded') ? '0.75rem' : (theme.cardRadius || '0.75rem'));

  // Heading format (Instruction 5): normal | uppercase | bold
  const fmt = (theme.headingFormat || 'normal').toLowerCase();
  root.style.setProperty('--mc-heading-transform', fmt === 'uppercase' ? 'uppercase' : 'none');
  root.style.setProperty('--mc-heading-weight', fmt === 'bold' ? '800' : '700');

  // ── Load Google Fonts for the theme's chosen typography ──
  loadGoogleFontsForTheme(theme.fontBody, theme.fontHeading);

  // body format class
  const body = document.body;
  if (theme.bodyFormat === 'boxed') body.classList.add('mc-boxed');
  else body.classList.remove('mc-boxed');

  // custom CSS
  let styleEl = document.getElementById('mc-custom-css') as HTMLStyleElement | null;
  if (theme.customCss) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'mc-custom-css';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = theme.customCss;
  } else if (styleEl) {
    styleEl.textContent = '';
  }
}

/** Dynamically inject Google Fonts <link> for the theme fonts (idempotent). */
export function loadGoogleFontsForTheme(...families: string[]) {
  if (typeof document === 'undefined') return;
  const valid = families.filter(Boolean);
  if (!valid.length) return;
  const id = `mc-google-fonts-${valid.map(f => f.toLowerCase().replace(/\s+/g, '-')).join('--')}`;
  if (document.getElementById(id)) return; // already loaded
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = googleFontsUrl(valid);
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeData | null>(null);
  const [themes, setThemes] = useState<ThemeData[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/themes');
      const data = await res.json();
      const list: ThemeData[] = data.themes || [];
      if (list.length) setThemes(list);
      // Resolve the ACTIVE theme — never blindly fall back to themes[0].
      const active =
        (data.activeThemeId != null && list.find(t => t.id === data.activeThemeId)) ||
        data.activeTheme ||
        list[0] ||
        null;
      if (active) {
        setTheme(active);
        applyThemeVars(active);
      }
    } catch { /* defaults in CSS */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <ThemeContext.Provider value={{ theme, themes, loading, refresh }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
