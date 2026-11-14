/**
 * THEME UTILITIES — shared between the client ThemeProvider and the
 * server-rendered pre-paint style injection (Instruction 5).
 * Must stay framework-agnostic (no 'use client', no DOM access).
 */

export function darken(hex: string, amount = 0.18): string {
  try {
    const c = hex.replace('#', '');
    const num = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
    const r = Math.max(0, Math.round(((num >> 16) & 255) * (1 - amount)));
    const g = Math.max(0, Math.round(((num >> 8) & 255) * (1 - amount)));
    const b = Math.max(0, Math.round((num & 255) * (1 - amount)));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch { return hex; }
}

export function lighten(hex: string, amount = 0.85): string {
  try {
    const c = hex.replace('#', '');
    const num = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
    const r = Math.round(255 - (255 - ((num >> 16) & 255)) * (1 - amount));
    const g = Math.round(255 - (255 - ((num >> 8) & 255)) * (1 - amount));
    const b = Math.round(255 - (255 - (num & 255)) * (1 - amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch { return hex; }
}

export interface ThemeLike {
  primary: string;
  secondary: string;
  tertiary: string;
  fontBody: string;
  fontHeading: string;
  headingFormat?: string | null;
  bgBody: string;
  bgCard: string;
  bgSidebar: string;
  bgHeader: string;
  bgFooter: string;
  bgCardHeader: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  dividerColor: string;
  scrollbarColor: string;
  scrollbarTrack: string;
  bodyFormat: string;
  cardRadius: string;
  sidebarStyle: string;
  customCss?: string | null;
}

/** Build the `--mc-*` variable declaration block for a theme. */
export function themeVarsDeclarations(theme: ThemeLike): string {
  const radius = theme.cardRadius?.includes('rounded') ? '0.75rem' : (theme.cardRadius || '0.75rem');
  const fmt = (theme.headingFormat || 'normal').toLowerCase();
  return [
    `--mc-primary:${theme.primary}`,
    `--mc-primary-dark:${darken(theme.primary)}`,
    `--mc-primary-light:${lighten(theme.primary, 0.85)}`,
    `--mc-secondary:${theme.secondary}`,
    `--mc-tertiary:${theme.tertiary}`,
    `--mc-bg-body:${theme.bgBody}`,
    `--mc-bg-card:${theme.bgCard}`,
    `--mc-bg-sidebar:${theme.bgSidebar}`,
    `--mc-bg-header:${theme.bgHeader}`,
    `--mc-bg-footer:${theme.bgFooter}`,
    `--mc-bg-card-header:${theme.bgCardHeader}`,
    `--mc-text-primary:${theme.textPrimary}`,
    `--mc-text-secondary:${theme.textSecondary}`,
    `--mc-text-muted:${theme.textMuted}`,
    `--mc-divider:${theme.dividerColor}`,
    `--mc-scrollbar:${theme.scrollbarColor}`,
    `--mc-scrollbar-track:${theme.scrollbarTrack}`,
    `--mc-font-body:"${theme.fontBody}", system-ui, sans-serif`,
    `--mc-font-heading:"${theme.fontHeading}", system-ui, sans-serif`,
    `--mc-radius:${radius}`,
    `--mc-card-radius:${radius}`,
    `--mc-heading-transform:${fmt === 'uppercase' ? 'uppercase' : 'none'}`,
    `--mc-heading-weight:${fmt === 'bold' ? '800' : '700'}`,
  ].join(';');
}
