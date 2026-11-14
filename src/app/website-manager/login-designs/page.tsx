'use client';

/**
 * WEBSITE MANAGER → LOGIN DESIGNS (Instruction 2)
 * Admin switches the staff login page design (1..6) and manages the
 * login banner (heading, subheading, image, show/hide) stored in
 * CompanyConfig — all dynamically consumed by /login.
 */

import * as React from 'react';
import { KeyRound, Check, ImageIcon, Type, Heading1, Eye, EyeOff, Save } from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, PageHeading, SkeletonCards, McInput } from '../../admin/_lib';
import { LOGIN_DESIGNS } from '@/components/auth/LoginDesigns';
import { FileUploader } from '@/components/shared/FileUploader';

interface SiteSetting { activeLoginDesign: number }
type Company = Record<string, unknown>;

export default function LoginDesignsPage() {
  const [activeDesign, setActiveDesign] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [applying, setApplying] = React.useState<number | null>(null);

  const [bannerOpen, setBannerOpen] = React.useState(false);
  const [savingBanner, setSavingBanner] = React.useState(false);
  const [banner, setBanner] = React.useState({
    heading: '', subheading: '', image: '', show: true,
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [settings, companyRes] = await Promise.all([
        apiGet<{ setting: SiteSetting }>('/api/site-settings'),
        apiGet<{ company: Company }>('/api/company'),
      ]);
      setActiveDesign(Math.min(Math.max(Number(settings.setting?.activeLoginDesign) || 1, 1), 6));
      const c = companyRes.company || {};
      setBanner({
        heading: String(c.login_banner_heading || ''),
        subheading: String(c.login_banner_subheading || ''),
        image: String(c.login_banner_image || ''),
        show: String(c.login_banner_show ?? 'true') !== 'false',
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const applyDesign = async (id: number) => {
    setApplying(id);
    try {
      await apiPut('/api/site-settings', { activeLoginDesign: id });
      setActiveDesign(id);
      toast.success(`Login design ${id} applied — visit /login to see it`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to apply design');
    } finally {
      setApplying(null);
    }
  };

  const saveBanner = async () => {
    setSavingBanner(true);
    try {
      await apiPut('/api/company', {
        settings: {
          login_banner_heading: banner.heading,
          login_banner_subheading: banner.subheading,
          login_banner_image: banner.image,
          login_banner_show: banner.show ? 'true' : 'false',
        },
      });
      toast.success('Login banner saved');
      setBannerOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save banner');
    } finally {
      setSavingBanner(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<KeyRound className="h-5 w-5" />}
        title="Login Page Designs"
        subtitle="Switch the staff login interface and manage its banner — applied instantly, fully themed"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setBannerOpen(true)}>
              <ImageIcon className="h-4 w-4" /> Login Banner
            </Button>
            <a href="/login" target="_blank" rel="noreferrer">
              <Button size="sm" className="gap-1"><Eye className="h-4 w-4" /> Preview Login</Button>
            </a>
          </div>
        }
      />

      {loading ? <SkeletonCards count={3} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Designs Available" value={LOGIN_DESIGNS.length} icon={<KeyRound className="h-5 w-5" />} accent="primary" />
          <StatCard label="Active Design" value={LOGIN_DESIGNS.find(d => d.id === activeDesign)?.name || `#${activeDesign}`} icon={<Check className="h-5 w-5" />} accent="success" hint="applied at /login" />
          <StatCard label="Banner" value={banner.show ? 'Visible' : 'Hidden'} icon={banner.show ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />} accent={banner.show ? 'tertiary' : 'warning'} hint={banner.heading ? 'text set' : 'not set'} />
          <StatCard label="Banner Image" value={banner.image ? 'Uploaded' : 'None'} icon={<ImageIcon className="h-5 w-5" />} accent="secondary" />
        </div>
      )}

      {/* Design cards */}
      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {LOGIN_DESIGNS.map(d => {
            const active = d.id === activeDesign;
            return (
              <div
                key={d.id}
                className={`rounded-xl border-2 bg-white p-4 transition-all ${active ? 'border-[var(--mc-primary)] shadow-lg' : 'border-[var(--mc-divider)] hover:border-[var(--mc-tertiary)] hover:shadow-md'}`}
              >
                {/* Mini preview swatch */}
                <div className="rounded-lg overflow-hidden border border-[var(--mc-divider)] h-28 mb-3 flex bg-slate-100">
                  {d.id === 1 && (
                    <>
                      <div className="w-1/2" style={{ background: 'linear-gradient(160deg, var(--mc-primary), var(--mc-primary-dark))' }} />
                      <div className="w-1/2 bg-white p-2 flex flex-col gap-1.5 justify-center">
                        <span className="h-2 w-3/4 rounded bg-slate-200" /><span className="h-5 rounded bg-slate-100 border" /><span className="h-5 rounded bg-slate-100 border" /><span className="h-5 rounded" style={{ background: 'var(--mc-primary)' }} />
                      </div>
                    </>
                  )}
                  {d.id === 2 && (
                    <>
                      <div className="w-1/2" style={{ background: 'radial-gradient(circle at 30% 30%, var(--mc-primary), var(--mc-primary-dark))' }} />
                      <div className="w-1/2 bg-[#F8FAFC] p-2 flex flex-col gap-1.5 justify-center">
                        <span className="h-2 w-3/4 rounded bg-slate-200" /><span className="h-5 rounded bg-white border" /><span className="h-5 rounded bg-white border" /><span className="h-5 rounded" style={{ background: 'var(--mc-primary)' }} />
                      </div>
                    </>
                  )}
                  {d.id === 3 && (
                    <>
                      <div className="w-1/2 bg-white flex flex-col">
                        <div className="h-1/2" style={{ background: 'var(--mc-primary-light)' }} />
                        <div className="flex-1 p-2 space-y-1"><span className="block h-1.5 w-3/4 rounded bg-slate-200" /><span className="block h-1.5 w-1/2 rounded bg-slate-200" /></div>
                      </div>
                      <div className="w-1/2 p-2 flex flex-col gap-1.5 justify-center" style={{ background: 'linear-gradient(150deg, var(--mc-primary), var(--mc-primary-dark))' }}>
                        <span className="h-2 w-3/4 rounded bg-white/50" /><span className="h-5 rounded bg-white/25 border border-white/40" /><span className="h-5 rounded bg-white/25 border border-white/40" /><span className="h-5 rounded bg-white" />
                      </div>
                    </>
                  )}
                  {d.id === 4 && (
                    <div className="flex-1 relative flex items-center justify-center" style={{ background: 'var(--mc-primary-dark)' }}>
                      <span className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
                      <div className="relative w-1/2 bg-[#F1F5F9] rounded p-2 space-y-1.5">
                        <span className="block h-2 w-3/4 rounded bg-slate-200 mx-auto" /><span className="block h-4 rounded bg-white border" /><span className="block h-4 rounded" style={{ background: 'var(--mc-primary)' }} />
                      </div>
                    </div>
                  )}
                  {d.id === 5 && (
                    <div className="w-1/2 flex flex-col">
                      <div className="h-2/5" style={{ background: 'linear-gradient(120deg, var(--mc-tertiary), var(--mc-primary))' }} />
                      <div className="flex-1 p-2" style={{ background: 'var(--mc-primary-dark)' }}><span className="block h-1.5 w-3/4 rounded bg-white/40" /><span className="block mt-1.5 h-1.5 w-1/2 rounded bg-white/25" /></div>
                    </div>
                  )}
                  {d.id === 6 && (
                    <>
                      <div className="w-[55%] bg-[#F3F9FE] p-2 flex flex-col gap-2">
                        <span className="block h-2 w-3/4 rounded bg-slate-200" />
                        <div className="flex-1 rounded-xl relative overflow-hidden" style={{ background: 'var(--mc-primary)' }}>
                          <span className="absolute top-1.5 left-1.5 h-2.5 w-10 rounded bg-white shadow" />
                          <span className="absolute bottom-1.5 left-2 h-2.5 w-12 rounded bg-white shadow" />
                        </div>
                      </div>
                      <div className="w-[45%] bg-white p-2 flex flex-col gap-1.5 justify-center border-l border-slate-100">
                        <span className="h-2 w-3/4 rounded bg-slate-200" /><span className="h-5 rounded bg-slate-50 border" /><span className="h-5 rounded bg-slate-50 border" /><span className="h-5 rounded" style={{ background: 'var(--mc-primary)' }} />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-[var(--mc-text-primary)] flex items-center gap-1.5">
                      {active && <span className="h-5 w-5 rounded-full bg-[var(--mc-primary)] text-white flex items-center justify-center shrink-0"><Check className="h-3 w-3" /></span>}
                      {d.id}. {d.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                    <p className="text-[10px] mt-1 text-muted-foreground">{d.hasBanner ? 'Supports banner' : 'No banner zone'}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">/login</span>
                  {active ? (
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled><Check className="h-3.5 w-3.5" /> Active</Button>
                  ) : (
                    <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => applyDesign(d.id)} disabled={applying !== null}>
                      {applying === d.id ? 'Applying…' : 'Apply Design'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Banner manager modal */}
      <PremiumModal
        open={bannerOpen} onOpenChange={setBannerOpen} size="lg"
        title="Login Page Banner"
        icon={<ImageIcon className="h-5 w-5" />}
        description="Banner content shows on the marketing side of supported login designs"
        footerNote="Hidden banners remove marketing copy but keep the login form clean"
        submitLabel="Save Banner" onSubmit={saveBanner} submitting={savingBanner} secondaryLabel="Cancel"
        submitIcon={<Save className="h-4 w-4" />}
      >
        <div className="space-y-5">
          <FormSection n={1} title="Banner Text">
            <Field icon={<Heading1 className="h-3.5 w-3.5" />} label="Banner Heading">
              <McInput value={banner.heading} onChange={e => setBanner(b => ({ ...b, heading: e.target.value }))} placeholder="Modern Care for Modern Health" />
            </Field>
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Banner Subheading">
              <McInput value={banner.subheading} onChange={e => setBanner(b => ({ ...b, subheading: e.target.value }))} placeholder="Sign in to access your staff portal" />
            </Field>
            <Field icon={<Eye className="h-3.5 w-3.5" />} label="Show Banner">
              <label className="flex items-center gap-2 text-sm py-1.5 cursor-pointer">
                <input type="checkbox" checked={banner.show} onChange={e => setBanner(b => ({ ...b, show: e.target.checked }))} className="h-4 w-4 accent-[var(--mc-primary)]" />
                {banner.show ? 'Banner visible on login designs' : 'Banner hidden — minimal login'}
              </label>
            </Field>
          </FormSection>
          <FormSection n={2} title="Banner Image">
            <Field icon={<ImageIcon className="h-3.5 w-3.5" />} label="Upload Image (drag & drop, compressed, progress %)">
              <FileUploader
                value={banner.image}
                onChange={url => setBanner(b => ({ ...b, image: url }))}
                module="LOGIN-BANNER"
                accept="image/*"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Recommended: 1200×800px. Used by designs 1, 2, 3, 4 (top strip), 5 &amp; 6.</p>
            </Field>
          </FormSection>
        </div>
      </PremiumModal>
    </div>
  );
}
