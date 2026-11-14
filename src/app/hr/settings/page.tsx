'use client';

/**
 * HR SETTINGS — payroll configuration: key/value list from
 * /api/payroll-config (PAYE bands, NSSF cap, SHIF tiers, housing levy %)
 * with bulk save via PUT {settings}.
 */

import * as React from 'react';
import { Settings2, KeyRound, FileText, Save, Loader2, Banknote, Info } from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, PageHeading, McInput } from '@/app/ops/_lib';

interface PayrollConfig { key: string; value: string; description: string }
interface PayrollConfigResp { configs: PayrollConfig[] }

export default function HrSettingsPage() {
  const [configs, setConfigs] = React.useState<PayrollConfig[]>([]);
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<PayrollConfigResp>('/api/payroll-config');
      setConfigs(res.configs || []);
      setEdits({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load payroll settings');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const dirty = Object.keys(edits).length > 0;

  const save = async () => {
    if (!dirty) { toast.info('No changes to save'); return; }
    setSaving(true);
    try {
      const res = await apiPut<{ updated: number; message: string }>('/api/payroll-config', { settings: edits });
      toast.success(res.message || `Saved ${res.updated} setting(s)`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Settings2 className="h-5 w-5" />}
        title="Payroll Settings"
        subtitle="Kenyan statutory deduction configuration — PAYE bands, NSSF cap, SHIF tiers, housing levy"
        actions={<>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setAboutOpen(true)}><Info className="h-4 w-4" /> How it works</Button>
          <Button size="sm" className="gap-1" disabled={!dirty || saving} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings
          </Button>
        </>}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-[var(--mc-bg-card)] flex items-center gap-2">
            <Banknote className="h-4 w-4 text-[var(--mc-primary)]" />
            <p className="text-sm font-semibold text-[var(--mc-text-primary)]">Deduction Parameters</p>
            <span className="ml-auto text-xs text-muted-foreground">{configs.length} setting(s){dirty ? ` · ${Object.keys(edits).length} unsaved` : ''}</span>
          </div>
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No payroll settings found — defaults are used (25%/30% PAYE, 6% NSSF capped 1,080, tiered SHIF, 1.5% housing levy).</p>
          ) : (
            <div className="divide-y divide-[var(--mc-divider)]">
              {configs.map(c => (
                <div key={c.key} className="grid grid-cols-1 md:grid-cols-[1fr_240px_1fr] gap-2 md:gap-4 items-center px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--mc-text-primary)] flex items-center gap-1.5 truncate">
                      <KeyRound className="h-3.5 w-3.5 text-[var(--mc-primary)] shrink-0" /> {c.key}
                    </p>
                    {c.description && <p className="text-[11px] text-muted-foreground truncate">{c.description}</p>}
                  </div>
                  <McInput
                    value={edits[c.key] !== undefined ? edits[c.key] : c.value}
                    onChange={e => setEdits(prev => ({ ...prev, [c.key]: e.target.value }))}
                  />
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    {edits[c.key] !== undefined && edits[c.key] !== c.value && (
                      <span className="text-amber-600 font-semibold">changed</span>
                    )}
                    <span className="truncate">{edits[c.key] !== undefined ? `was: ${c.value}` : 'current value shown'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-3 border-t bg-[var(--mc-bg-card)] flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Values are stored as text and read by the payroll engine on each run.</p>
            <Button size="sm" className="gap-1" disabled={!dirty || saving} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save {dirty ? `(${Object.keys(edits).length})` : ''}
            </Button>
          </div>
        </div>
      )}

      <PremiumModal
        open={aboutOpen} onOpenChange={setAboutOpen}
        title="How Kenyan Payroll Is Computed"
        icon={<FileText className="h-5 w-5" />}
        description="Deduction engine applied to every generated payroll record"
        footerNote="Config changes apply to payroll generated AFTER saving"
        submitLabel="Got it" onSubmit={() => setAboutOpen(false)}
      >
        <div className="space-y-4 text-sm text-[var(--mc-text-secondary)]">
          <FormSection n={1} title="PAYE (Income Tax)">
            <p className="sm:col-span-2">Progressive bands with KSh 2,400 personal relief: taxed amount above KSh 24,000 at 25% (up to KSh 32,333) and 30% above that, minus relief.</p>
          </FormSection>
          <FormSection n={2} title="NSSF">
            <p className="sm:col-span-2">6% of basic salary capped at KSh 1,080 per month.</p>
          </FormSection>
          <FormSection n={3} title="SHIF (Social Health Insurance Fund)">
            <p className="sm:col-span-2">Tiered on gross pay: KSh 150 (≤5,999) · 300 (≤7,999) · 400 (≤11,999) · 500 (≤19,999) · 750 (≤49,999) · 1,700 (above).</p>
          </FormSection>
          <FormSection n={4} title="Housing Levy">
            <p className="sm:col-span-2">Affordable Housing Levy — 1.5% of gross pay.</p>
          </FormSection>
          <Field icon={<Banknote className="h-3.5 w-3.5" />} label="Net Pay">
            <p className="text-sm">Gross − PAYE − NSSF − SHIF − Housing Levy − Other Deductions.</p>
          </Field>
        </div>
      </PremiumModal>
    </div>
  );
}
