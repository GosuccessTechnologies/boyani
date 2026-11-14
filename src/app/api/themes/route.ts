import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * THEMES API — pattern adapted from politicsmigori platform.
 * GET public=1 works without auth (public website needs active theme).
 * 10 presets seeded via prisma/seed.ts. Applying a theme updates SiteSetting
 * and cascades CSS variables across dashboards AND the public website.
 */

const THEME_FIELDS = [
  'primary', 'secondary', 'tertiary', 'fontBody', 'fontHeading', 'headingFormat',
  'bgBody', 'bgCard', 'bgSidebar', 'bgHeader', 'bgFooter', 'bgCardHeader',
  'textPrimary', 'textSecondary', 'textMuted', 'dividerColor',
  'scrollbarColor', 'scrollbarTrack', 'bodyFormat', 'cardRadius', 'sidebarStyle',
] as const;

/** Original preset defaults (mirrors prisma/seed.ts) — powers theme reset. */
const THEME_PRESETS: Array<Record<string, string>> = [
  { name: 'Medical Teal', primary: '#0d9488', secondary: '#f59e0b', tertiary: '#0891b2', bgBody: '#FFFFFF', bgCard: '#F8FAFC', bgSidebar: '#FFFFFF', sidebarStyle: 'light', fontBody: 'Inter', fontHeading: 'Inter', headingFormat: 'normal', customCss: '' },
  { name: 'Ocean Blue', primary: '#0284c7', secondary: '#f59e0b', tertiary: '#0ea5e9', bgBody: '#FFFFFF', bgCard: '#F8FAFC', bgSidebar: '#F8FAFC', sidebarStyle: 'light', fontBody: 'Inter', fontHeading: 'Inter', headingFormat: 'normal', customCss: '' },
  { name: 'Nairobi Green', primary: '#16a34a', secondary: '#eab308', tertiary: '#059669', bgBody: '#FFFFFF', bgCard: '#F8FAFC', bgSidebar: '#F7FDF9', sidebarStyle: 'light', fontBody: 'Inter', fontHeading: 'Inter', headingFormat: 'normal', customCss: '' },
  { name: 'Sunset Orange', primary: '#ea580c', secondary: '#0891b2', tertiary: '#f97316', bgBody: '#FFFFFF', bgCard: '#F8FAFC', bgSidebar: '#FFF8F3', sidebarStyle: 'light', fontBody: 'Inter', fontHeading: 'Inter', headingFormat: 'normal', customCss: '' },
  { name: 'Royal Purple', primary: '#7c3aed', secondary: '#f59e0b', tertiary: '#a855f7', bgBody: '#FFFFFF', bgCard: '#F8FAFC', bgSidebar: '#FAF8FF', sidebarStyle: 'light', fontBody: 'Inter', fontHeading: 'Inter', headingFormat: 'normal', customCss: '' },
  { name: 'Rose Care', primary: '#e11d48', secondary: '#f59e0b', tertiary: '#fb7185', bgBody: '#FFFFFF', bgCard: '#F8FAFC', bgSidebar: '#FFF7F9', sidebarStyle: 'light', fontBody: 'Inter', fontHeading: 'Inter', headingFormat: 'normal', customCss: '' },
  { name: 'Dark Clinical', primary: '#14b8a6', secondary: '#f59e0b', tertiary: '#38bdf8', bgBody: '#0f172a', bgCard: '#1e293b', bgSidebar: '#0b1120', bgHeader: '#0f172a', bgFooter: '#0b1120', bgCardHeader: '#134e4a', textPrimary: '#e2e8f0', textSecondary: '#94a3b8', textMuted: '#64748b', dividerColor: '#263449', scrollbarColor: '#334155', scrollbarTrack: '#0f172a', bodyFormat: 'full-width', cardRadius: 'rounded-xl', sidebarStyle: 'dark', fontBody: 'Inter', fontHeading: 'Inter', headingFormat: 'normal', customCss: '' },
  { name: 'Warm Neutral', primary: '#0f766e', secondary: '#d97706', tertiary: '#5f7470', bgBody: '#FFFFFF', bgCard: '#faf6f0', bgSidebar: '#3d3833', bgHeader: '#FFFFFF', bgFooter: '#3d3833', bgCardHeader: '#5f5648', textPrimary: '#0f172a', textSecondary: '#475569', textMuted: '#94a3b8', dividerColor: '#e7ded2', scrollbarColor: '#CBD5E1', scrollbarTrack: '#F1F5F9', bodyFormat: 'full-width', cardRadius: 'rounded-xl', sidebarStyle: 'dark', fontBody: 'Inter', fontHeading: 'Inter', headingFormat: 'normal', customCss: '' },
  { name: 'High Contrast', primary: '#000000', secondary: '#dc2626', tertiary: '#1f2937', bgBody: '#FFFFFF', bgCard: '#F8FAFC', bgSidebar: '#000000', bgHeader: '#FFFFFF', bgFooter: '#000000', bgCardHeader: '#111827', textPrimary: '#0f172a', textSecondary: '#475569', textMuted: '#94a3b8', dividerColor: '#E2E8F0', scrollbarColor: '#CBD5E1', scrollbarTrack: '#F1F5F9', bodyFormat: 'full-width', cardRadius: 'rounded-xl', sidebarStyle: 'dark', fontBody: 'Inter', fontHeading: 'Inter', headingFormat: 'normal', customCss: '' },
  { name: 'Pediatric Playful', primary: '#2563eb', secondary: '#ec4899', tertiary: '#22c55e', bgBody: '#FFFFFF', bgCard: '#f0f9ff', bgSidebar: '#1e3a8a', bgHeader: '#FFFFFF', bgFooter: '#1e3a8a', bgCardHeader: '#1d4ed8', textPrimary: '#0f172a', textSecondary: '#475569', textMuted: '#94a3b8', dividerColor: '#E2E8F0', scrollbarColor: '#CBD5E1', scrollbarTrack: '#F1F5F9', bodyFormat: 'full-width', cardRadius: 'rounded-xl', sidebarStyle: 'dark', fontBody: 'Inter', fontHeading: 'Inter', headingFormat: 'normal', customCss: '' },
];

// GET /api/themes — list all themes (public) or admin view
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === '1';

    const themes = await db.theme.findMany({ orderBy: { id: 'asc' } });
    const siteSetting = await db.siteSetting.findUnique({ where: { id: 'main' } });
    const activeThemeId = siteSetting?.activeThemeId || 1;
    const activeTheme = themes.find(t => t.id === activeThemeId) || themes[0] || null;

    if (isPublic) {
      return NextResponse.json({ activeTheme });
    }
    return NextResponse.json({ themes, activeThemeId, siteSetting });
  } catch (error) {
    console.error('Themes GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch themes' }, { status: 500 });
  }
}

// POST /api/themes — create custom theme (ADMIN)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error: 'Theme name required' }, { status: 400 });

    const data: Record<string, string> = {};
    for (const f of THEME_FIELDS) if (body[f] !== undefined) data[f] = String(body[f]);
    if (body.customCss) data.customCss = String(body.customCss);

    const theme = await db.theme.create({
      data: { name: body.name, description: body.description || '', isPreset: false, ...data },
    });
    return NextResponse.json({ theme, message: 'Theme created' }, { status: 201 });
  } catch (error) {
    console.error('Themes POST error:', error);
    return NextResponse.json({ error: 'Failed to create theme' }, { status: 500 });
  }
}

// PUT /api/themes — update theme OR apply theme {action:'apply', themeId}
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    // Apply theme — affects entire system + public website
    if (body.action === 'apply' && body.themeId) {
      const theme = await db.theme.findUnique({ where: { id: parseInt(body.themeId) } });
      if (!theme) return NextResponse.json({ error: 'Theme not found' }, { status: 404 });

      await db.siteSetting.upsert({
        where: { id: 'main' },
        create: { id: 'main', activeThemeId: theme.id },
        update: { activeThemeId: theme.id, updatedAt: new Date() },
      });
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'THEME_APPLY', entityName: 'Theme', entityId: String(theme.id),
          details: `Applied theme "${theme.name}" system-wide`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ message: `Theme "${theme.name}" applied successfully`, activeThemeId: theme.id });
    }

    // Reset a theme to its original preset defaults (seed values)
    if (body.action === 'reset' && body.themeId) {
      const id = parseInt(body.themeId);
      const theme = await db.theme.findUnique({ where: { id } });
      if (!theme) return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
      const preset = THEME_PRESETS.find(p => p.name === theme.name);
      if (!preset) return NextResponse.json({ error: 'No preset defaults exist for this theme' }, { status: 400 });
      const { name, ...defaults } = preset;
      const reset = await db.theme.update({ where: { id }, data: { ...defaults } });
      await db.auditLog.create({
        data: {
          userId: auth.user.id, action: 'THEME_RESET', entityName: 'Theme', entityId: String(id),
          details: `Reset theme "${theme.name}" to preset defaults`,
          ipAddress: request.headers.get('x-forwarded-for') || '',
        },
      }).catch(() => {});
      return NextResponse.json({ theme: reset, message: `Theme "${name}" reset to its initial settings` });
    }

    // Duplicate a theme as a custom copy (handy for "edit then apply" workflows)
    if (body.action === 'duplicate' && body.themeId) {
      const src = await db.theme.findUnique({ where: { id: parseInt(body.themeId) } });
      if (!src) return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
      const { id: _id, ...copy } = src;
      const dup = await db.theme.create({
        data: { ...copy, name: `${src.name} (Copy)`, isPreset: false },
      });
      return NextResponse.json({ theme: dup, message: `Duplicated "${src.name}" — edit the copy freely` }, { status: 201 });
    }

    // Update theme fields
    if (!body.id) return NextResponse.json({ error: 'Theme id required' }, { status: 400 });
    const data: Record<string, string> = {};
    for (const f of THEME_FIELDS) if (body[f] !== undefined) data[f] = String(body[f]);
    if (body.name) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.customCss !== undefined) data.customCss = body.customCss;

    const theme = await db.theme.update({ where: { id: parseInt(body.id) }, data });
    return NextResponse.json({ theme, message: 'Theme updated' });
  } catch (error) {
    console.error('Themes PUT error:', error);
    return NextResponse.json({ error: 'Failed to update theme' }, { status: 500 });
  }
}

// DELETE /api/themes — delete custom (non-preset) theme
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const id = parseInt(new URL(request.url).searchParams.get('id') || '0');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const theme = await db.theme.findUnique({ where: { id } });
    if (!theme) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (theme.isPreset) return NextResponse.json({ error: 'Cannot delete a preset theme' }, { status: 400 });

    const siteSetting = await db.siteSetting.findUnique({ where: { id: 'main' } });
    if (siteSetting?.activeThemeId === id) {
      return NextResponse.json({ error: 'Cannot delete the active theme' }, { status: 400 });
    }
    await db.theme.delete({ where: { id } });
    return NextResponse.json({ message: 'Theme deleted' });
  } catch (error) {
    console.error('Themes DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete theme' }, { status: 500 });
  }
}
