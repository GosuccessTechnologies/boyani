'use client';

/**
 * SITE SETTINGS — global site state form: activeHomepageDesign (1-18),
 * activeHeaderDesign (1-10), activeFooterDesign (1-10), activeMenuDesign
 * (1-20), activeBreadcrumbDesign (1-8), pageLayout (full-width/boxed radio),
 * defaultSeoTitle, defaultSeoDescription → PUT /api/site-settings.
 */

import * as React from 'react';
import {
  Settings2, Home, PanelTop, PanelBottom, Menu as MenuIcon, Layers, LayoutTemplate,
  Search, Save, Loader2, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, PageHeading, McInput, McSelect } from '@/app/ops/_lib';

interface SiteSetting {
  id: string;
  activeHomepageDesign: number;
  activeHeaderDesign: number;
  activeFooterDesign: number;
  activeMenuDesign: number;
  activeBreadcrumbDesign: number;
  activeHeroDesign: number;
  pageLayout: string;
  defaultSeoTitle: string;
  defaultSeoDescription: string;
}

const opts = (label: string, n: number) => Array.from({ length: n }, (_, i) => ({ value: String(i + 1), label: `${label} ${i + 1}` }));
const HOMEPAGE_DESIGNS = opts('Homepage', 18);
const HEADER_DESIGNS = opts('Header', 10);
const FOOTER_DESIGNS = opts('Footer', 10);
const MENU_DESIGNS = opts('Menu', 20);
const BREADCRUMB_DESIGNS = opts('Breadcrumb', 8);

const emptyForm = {
  activeHomepageDesign: '1', activeHeaderDesign: '1', activeFooterDesign: '1',
  activeMenuDesign: '1', activeBreadcrumbDesign: '1',
  pageLayout: 'full-width', defaultSeoTitle: '', defaultSeoDescription: '',
};

export default function SiteSettingsPage() {
  const [form, setForm] = React.useState({ ...emptyForm });
  const [initial, setInitial] = React.useState({ ...emptyForm });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ setting: SiteSetting }>('/api/site-settings');
      const s = res.setting;
      const next = {
        activeHomepageDesign: String(s?.activeHomepageDesign ?? 1),
        activeHeaderDesign: String(s?.activeHeaderDesign ?? 1),
        activeFooterDesign: String(s?.activeFooterDesign ?? 1),
        activeMenuDesign: String(s?.activeMenuDesign ?? 1),
        activeBreadcrumbDesign: String(s?.activeBreadcrumbDesign ?? 1),
        pageLayout: s?.pageLayout === 'boxed' ? 'boxed' : 'full-width',
        defaultSeoTitle: s?.defaultSeoTitle || '',
        defaultSeoDescription: s?.defaultSeoDescription || '',
      };
      setForm(next);
      setInitial(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load site settings');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiPut<{ message: string }>('/api/site-settings', {
        activeHomepageDesign: form.activeHomepageDesign,
        activeHeaderDesign: form.activeHeaderDesign,
        activeFooterDesign: form.activeFooterDesign,
        activeMenuDesign: form.activeMenuDesign,
        activeBreadcrumbDesign: form.activeBreadcrumbDesign,
        pageLayout: form.pageLayout,
        defaultSeoTitle: form.defaultSeoTitle,
        defaultSeoDescription: form.defaultSeoDescription,
      });
      toast.success(res.message || 'Site settings updated — reload the website to see changes');
      setInitial({ ...form });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save site settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Settings2 className="h-5 w-5" />}
        title="Site Settings"
        subtitle="Global site state — active designs, page layout & SEO defaults"
        actions={<>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open('/', '_blank')}><Globe className="h-4 w-4" /> View Website</Button>
          <Button size="sm" className="gap-1" disabled={!dirty || saving} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings
          </Button>
        </>}
      />

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : (
        <div className="rounded-xl border bg-white p-4 space-y-5">
          <FormSection n={1} title="Active Designs">
            <Field icon={<Home className="h-3.5 w-3.5" />} label="Homepage Design (1-18)" hint="switches the entire homepage composition">
              <McSelect value={form.activeHomepageDesign} onValueChange={v => setForm(f => ({ ...f, activeHomepageDesign: v }))} options={HOMEPAGE_DESIGNS} />
            </Field>
            <Field icon={<PanelTop className="h-3.5 w-3.5" />} label="Header Design (1-10)">
              <McSelect value={form.activeHeaderDesign} onValueChange={v => setForm(f => ({ ...f, activeHeaderDesign: v }))} options={HEADER_DESIGNS} />
            </Field>
            <Field icon={<PanelBottom className="h-3.5 w-3.5" />} label="Footer Design (1-10)">
              <McSelect value={form.activeFooterDesign} onValueChange={v => setForm(f => ({ ...f, activeFooterDesign: v }))} options={FOOTER_DESIGNS} />
            </Field>
            <Field icon={<MenuIcon className="h-3.5 w-3.5" />} label="Menu Design (1-20)">
              <McSelect value={form.activeMenuDesign} onValueChange={v => setForm(f => ({ ...f, activeMenuDesign: v }))} options={MENU_DESIGNS} />
            </Field>
            <Field icon={<Layers className="h-3.5 w-3.5" />} label="Breadcrumb Design (1-8)">
              <McSelect value={form.activeBreadcrumbDesign} onValueChange={v => setForm(f => ({ ...f, activeBreadcrumbDesign: v }))} options={BREADCRUMB_DESIGNS} />
            </Field>
          </FormSection>

          <FormSection n={2} title="Page Layout">
            <Field icon={<LayoutTemplate className="h-3.5 w-3.5" />} label="Site-wide Layout" className="sm:col-span-2" hint="boxed adds margins & a max width to every public page">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'full-width', label: 'Full Width', hint: 'Edge-to-edge sections' },
                  { value: 'boxed', label: 'Boxed', hint: 'Centered with margins' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-3 cursor-pointer transition-colors ${
                      form.pageLayout === opt.value
                        ? 'border-[var(--mc-primary)] bg-[var(--mc-primary-light)]'
                        : 'border-[var(--mc-divider)] bg-[var(--mc-bg-card)] hover:border-[var(--mc-primary)]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pageLayout"
                      className="mt-0.5 accent-[var(--mc-primary)]"
                      checked={form.pageLayout === opt.value}
                      onChange={() => setForm(f => ({ ...f, pageLayout: opt.value }))}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[var(--mc-text-primary)]">{opt.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </Field>
          </FormSection>

          <FormSection n={3} title="Default SEO">
            <Field icon={<Search className="h-3.5 w-3.5" />} label="Default SEO Title">
              <McInput value={form.defaultSeoTitle} onChange={e => setForm(f => ({ ...f, defaultSeoTitle: e.target.value }))} placeholder="Boyani Health Dispensary" />
            </Field>
            <Field icon={<Search className="h-3.5 w-3.5" />} label="Default SEO Description">
              <McInput value={form.defaultSeoDescription} onChange={e => setForm(f => ({ ...f, defaultSeoDescription: e.target.value }))} placeholder="Modern Care for Modern Health." />
            </Field>
          </FormSection>

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {dirty ? 'Unsaved changes — Save to apply.' : 'All settings saved.'}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={() => setForm({ ...initial })}>Reset</Button>
              <Button size="sm" className="gap-1" disabled={!dirty || saving} onClick={save}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
