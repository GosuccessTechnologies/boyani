'use client';

/**
 * FACILITY SETTINGS — GET /api/company config form (identity, contacts,
 * localization, POS, social) + bulk PUT {settings:{…}} + toast.
 */

import * as React from 'react';
import {
  Settings, Building, AlignLeft, UploadCloud, Mail, Phone, PhoneCall, MapPin, Send,
  Banknote, Percent, ShieldCheck, Receipt, Printer, FileText, Globe, Facebook, Twitter,
  Instagram, Youtube, MessageCircle, Save,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileUploader } from '@/components/shared/FileUploader';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, PageHeading, McInput } from '../_lib';

type ConfigMap = Record<string, string>;

const PAPER_SIZES = ['A4', 'A5', '80mm', '58mm'];

const SOCIAL_FIELDS: Array<{ key: string; label: string; icon: React.ReactNode; placeholder: string }> = [
  { key: 'socialFacebook', label: 'Facebook', icon: <Facebook className="h-3.5 w-3.5" />, placeholder: 'https://facebook.com/boyanihealth' },
  { key: 'socialTwitter', label: 'X / Twitter', icon: <Twitter className="h-3.5 w-3.5" />, placeholder: 'https://x.com/boyanihealth' },
  { key: 'socialInstagram', label: 'Instagram', icon: <Instagram className="h-3.5 w-3.5" />, placeholder: 'https://instagram.com/boyanihealth' },
  { key: 'socialYouTube', label: 'YouTube', icon: <Youtube className="h-3.5 w-3.5" />, placeholder: 'https://youtube.com/@boyanihealth' },
  { key: 'socialWhatsApp', label: 'WhatsApp', icon: <MessageCircle className="h-3.5 w-3.5" />, placeholder: 'https://wa.me/254700000000' },
];

export default function CompanyPage() {
  const [config, setConfig] = React.useState<ConfigMap | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<{ config: ConfigMap }>('/api/company');
        setConfig(res.config || {});
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load facility settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (key: string, value: string) => {
    setConfig(c => (c ? { ...c, [key]: value } : c));
    setDirty(true);
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const settings: Record<string, string> = {
        companyName: config.companyName || '',
        companyTagline: config.companyTagline || '',
        logoUrl: config.logoUrl || '',
        companyEmail: config.companyEmail || '',
        companyPhone: config.companyPhone || '',
        emergencyPhone: config.emergencyPhone || '',
        companyAddress: config.companyAddress || '',
        companyPostalAddress: config.companyPostalAddress || '',
        currency: config.currency || 'KES',
        enableTax: config.enableTax === 'true' ? 'true' : 'false',
        taxRate: config.taxRate || '16',
        posReceiptPrefix: config.posReceiptPrefix || '',
        receiptPaperSize: config.receiptPaperSize || 'A4',
        receiptCopies: config.receiptCopies || '1',
        receiptFooter: config.receiptFooter || '',
        socialFacebook: config.socialFacebook || '',
        socialTwitter: config.socialTwitter || '',
        socialInstagram: config.socialInstagram || '',
        socialYouTube: config.socialYouTube || '',
        socialWhatsApp: config.socialWhatsApp || '',
      };
      const res = await apiPut<{ success: boolean; updated: number }>('/api/company', { settings });
      toast.success(`Facility settings saved (${res.updated ?? Object.keys(settings).length} keys)`);
      setDirty(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72 rounded-xl" />
        <SkeletonCardsLike />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!config) {
    return <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">Facility settings unavailable.</div>;
  }

  const socialCount = SOCIAL_FIELDS.filter(f => (config[f.key] || '').trim()).length;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Settings className="h-5 w-5" />}
        title="Facility Settings"
        subtitle="Identity, contacts, currency & tax, POS receipts and social links — used across every module"
        actions={
          <Button size="sm" className="gap-1" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Save Settings'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Facility" value={config.companyName || '—'} icon={<Building className="h-5 w-5" />} accent="primary" hint={config.currency ? `currency ${config.currency}` : undefined} />
        <StatCard label="Tax" value={config.enableTax === 'true' ? `${config.taxRate || 16}%` : 'Off'} icon={<Percent className="h-5 w-5" />} accent="secondary" hint="billing & POS" />
        <StatCard label="Receipt Paper" value={config.receiptPaperSize || 'A4'} icon={<Printer className="h-5 w-5" />} accent="tertiary" hint={`${config.receiptCopies || 1} cop(ies)`} />
        <StatCard label="Social Links" value={`${socialCount} / ${SOCIAL_FIELDS.length}`} icon={<Globe className="h-5 w-5" />} accent="success" />
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-6">
        {/* 1 — Identity */}
        <FormSection n={1} title="Facility Identity">
          <Field icon={<Building className="h-3.5 w-3.5" />} label="Facility Name">
            <McInput value={config.companyName || ''} onChange={e => set('companyName', e.target.value)} placeholder="Boyani Health Dispensary" />
          </Field>
          <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Slogan / Tagline">
            <McInput value={config.companyTagline || ''} onChange={e => set('companyTagline', e.target.value)} placeholder="Compassionate healthcare…" />
          </Field>
          <div className="sm:col-span-2">
            <Field icon={<UploadCloud className="h-3.5 w-3.5" />} label="Logo">
              <FileUploader value={config.logoUrl || ''} onChange={v => set('logoUrl', v)} module="COMPANY" label="Upload facility logo" />
            </Field>
          </div>
        </FormSection>

        {/* 2 — Contacts */}
        <FormSection n={2} title="Contacts">
          <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email">
            <McInput value={config.companyEmail || ''} onChange={e => set('companyEmail', e.target.value)} placeholder="info@africandivinechurch.org" />
          </Field>
          <Field icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
            <McInput value={config.companyPhone || ''} onChange={e => set('companyPhone', e.target.value)} placeholder="+254 700 000 000" />
          </Field>
          <Field icon={<PhoneCall className="h-3.5 w-3.5" />} label="Emergency Hotline">
            <McInput value={config.emergencyPhone || ''} onChange={e => set('emergencyPhone', e.target.value)} placeholder="+254 700 999 999" />
          </Field>
          <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Physical Address">
            <McInput value={config.companyAddress || ''} onChange={e => set('companyAddress', e.target.value)} placeholder="Hospital Road, Nairobi" />
          </Field>
          <Field icon={<Send className="h-3.5 w-3.5" />} label="Postal Address" className="sm:col-span-2">
            <McInput value={config.companyPostalAddress || ''} onChange={e => set('companyPostalAddress', e.target.value)} placeholder="P.O. Box 12345-00100, Nairobi" />
          </Field>
        </FormSection>

        {/* 3 — Localization & tax */}
        <FormSection n={3} title="Localization & Tax">
          <Field icon={<Banknote className="h-3.5 w-3.5" />} label="Currency">
            <McInput value={config.currency || ''} onChange={e => set('currency', e.target.value)} placeholder="KES" />
          </Field>
          <Field icon={<Percent className="h-3.5 w-3.5" />} label="Tax Rate (%)">
            <McInput value={config.taxRate || ''} onChange={e => set('taxRate', e.target.value)} placeholder="16" />
          </Field>
          <Field icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Enable Tax">
            <div className="flex items-center gap-2 h-9">
              <Switch
                checked={config.enableTax === 'true'}
                onCheckedChange={v => set('enableTax', v ? 'true' : 'false')}
              />
              <span className="text-xs text-muted-foreground">{config.enableTax === 'true' ? 'Tax applied on quotations/POS' : 'Tax disabled'}</span>
            </div>
          </Field>
        </FormSection>

        {/* 4 — POS & receipts */}
        <FormSection n={4} title="POS & Receipts">
          <Field icon={<Receipt className="h-3.5 w-3.5" />} label="Receipt Prefix">
            <McInput value={config.posReceiptPrefix || ''} onChange={e => set('posReceiptPrefix', e.target.value)} placeholder="MCH" />
          </Field>
          <Field icon={<Printer className="h-3.5 w-3.5" />} label="Receipt Paper Size">
            <Select value={config.receiptPaperSize || 'A4'} onValueChange={v => set('receiptPaperSize', v)}>
              <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{PAPER_SIZES.map(p => <SelectItem key={p} value={p}>{p === 'A4' || p === 'A5' ? `${p} portrait` : `${p} roll`}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field icon={<FileText className="h-3.5 w-3.5" />} label="Receipt Copies">
            <McInput value={config.receiptCopies || '1'} onChange={e => set('receiptCopies', e.target.value)} placeholder="1" />
          </Field>
          <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Receipt Footer Message">
            <McInput value={config.receiptFooter || ''} onChange={e => set('receiptFooter', e.target.value)} placeholder="Thank you for choosing Boyani Health Dispensary…" />
          </Field>
        </FormSection>

        {/* 5 — Social */}
        <FormSection n={5} title="Social Links">
          {SOCIAL_FIELDS.map(f => (
            <Field key={f.key} icon={f.icon} label={f.label}>
              <McInput value={config[f.key] || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
            </Field>
          ))}
        </FormSection>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--mc-divider)]">
          <span className="text-xs text-muted-foreground mr-auto">{dirty ? 'You have unsaved changes' : 'All changes saved'}</span>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} disabled={saving}>Discard</Button>
          <Button size="sm" className="gap-1" onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Settings'}</Button>
        </div>
      </div>
    </div>
  );
}

function SkeletonCardsLike() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );
}
