'use client';

/**
 * FACILITY MANAGEMENT → DOCUMENTS & LETTERHEADS (Instruction 19)
 * Configure backgrounds for ALL printable/PDF documents (except receipts):
 * upload image background, apply color background, apply watermark, choose
 * page size — plus select from 10 document header (letterhead) designs.
 */

import * as React from 'react';
import {
  FileSliders, Save, Palette, Droplets, Stamp, FileImage, Check, Printer, RotateCcw,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, PageHeading, SkeletonCards, McInput } from '../_lib';
import { FileUploader } from '@/components/shared/FileUploader';
import { printUniversalDocument, docSection, docTable, docRecordsTable } from '@/lib/document-print';

type Company = Record<string, unknown>;

const LETTERHEADS: Array<{ id: number; name: string; description: string }> = [
  { id: 1, name: 'Classic Centered', description: 'Double-rule centered crest with contacts below' },
  { id: 2, name: 'Side Banner', description: 'Gradient side banner with accent bar' },
  { id: 3, name: 'Full Color Band', description: 'Full-width gradient band header' },
  { id: 4, name: 'Minimal Rule', description: 'Clean two-column header over a rule' },
  { id: 5, name: 'Boxed Crest', description: 'Bordered crest box with accent frame' },
  { id: 6, name: 'Two-Tone Split', description: 'Split gradient underline, accent slogan' },
  { id: 7, name: 'Sidebar Accent', description: 'Vertical accent bar beside the crest' },
  { id: 8, name: 'Ghost Crest', description: 'Oversized ghost name behind the crest' },
  { id: 9, name: 'Modern Line', description: 'Fading gradient line under the brand' },
  { id: 10, name: 'Bold Block', description: 'Dark slate block with accent slogan' },
];

export default function DocumentsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [cfg, setCfg] = React.useState({
    enabled: false,
    type: 'color' as 'color' | 'image' | 'watermark',
    color: '#FFFFFF',
    image: '',
    watermarkText: 'Boyani Health Dispensary',
    watermarkOpacity: 0.06,
    pageSize: 'A4' as 'A4' | 'A5' | 'LETTER',
    letterheadDesign: 1,
    letterheadColor: '#0d9488',
  });
  const [facilityName, setFacilityName] = React.useState('Boyani Health Dispensary');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ company: Company }>('/api/company');
      const c = res.company || {};
      const g = (k: string, d: string) => (typeof c[k] === 'string' && c[k] !== '' ? c[k] : d);
      setCfg({
        enabled: g('doc_bg_enabled', 'false') === 'true',
        type: (g('doc_bg_type', 'color') as 'color' | 'image' | 'watermark'),
        color: g('doc_bg_color', '#FFFFFF'),
        image: g('doc_bg_image', ''),
        watermarkText: g('doc_bg_watermark_text', 'Boyani Health Dispensary'),
        watermarkOpacity: Number(g('doc_bg_watermark_opacity', '0.06')),
        pageSize: (g('doc_bg_page_size', 'A4') as 'A4' | 'A5' | 'LETTER'),
        letterheadDesign: Number(g('doc_letterhead_design', '1')) || 1,
        letterheadColor: g('doc_letterhead_color', '#0d9488'),
      });
      setFacilityName(g('companyName', 'Boyani Health Dispensary'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await apiPut('/api/company', {
        settings: {
          doc_bg_enabled: cfg.enabled ? 'true' : 'false',
          doc_bg_type: cfg.type,
          doc_bg_color: cfg.color,
          doc_bg_image: cfg.image,
          doc_bg_watermark_text: cfg.watermarkText,
          doc_bg_watermark_opacity: String(cfg.watermarkOpacity),
          doc_bg_page_size: cfg.pageSize,
          doc_letterhead_design: String(cfg.letterheadDesign),
          doc_letterhead_color: cfg.letterheadColor,
        },
      });
      toast.success('Document settings saved — applied to all PDFs & prints (receipts keep their own style)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const testPrint = () => {
    printUniversalDocument({
      title: 'Document Style Preview',
      docId: 'DOC-PREVIEW-001',
      bodyHtml: [
        docSection('Sample Patient Details'),
        docTable([['Patient Name', 'Jane Wanjiku'], ['Patient No', 'PAT-2026-0009'], ['Age / Gender', '35 / Female']]),
        docSection('Sample Records'),
        docRecordsTable(['Date', 'Service', 'Status'], [
          ['2026-09-01', 'Full Blood Count (CBC)', 'Completed'],
          ['2026-09-01', 'General Consultation', 'Completed'],
        ]),
        `<p>This preview shows the selected letterhead design and document background. Every printable PDF in the system (lab requests, lab results, prescriptions, consultations, admissions, discharge letters and reports) will follow this style.</p>`,
      ].join(''),
    });
  };

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<FileSliders className="h-5 w-5" />}
        title="Documents & Letterheads"
        subtitle="Backgrounds and letterhead styles for every printable PDF across all modules — receipts excluded"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={testPrint}><Printer className="h-4 w-4" /> Test Preview</Button>
            <Button size="sm" className="gap-1" onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Settings'}</Button>
          </div>
        }
      />

      {loading ? <SkeletonCards count={3} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Backgrounds" value={cfg.enabled ? 'Enabled' : 'Disabled'} icon={cfg.enabled ? <Check className="h-5 w-5" /> : <Droplets className="h-5 w-5" />} accent={cfg.enabled ? 'success' : 'warning'} hint={cfg.enabled ? cfg.type : 'plain white pages'} />
          <StatCard label="Page Size" value={cfg.pageSize} icon={<FileImage className="h-5 w-5" />} accent="primary" hint="for all documents" />
          <StatCard label="Letterhead" value={LETTERHEADS.find(l => l.id === cfg.letterheadDesign)?.name || `#${cfg.letterheadDesign}`} icon={<Palette className="h-5 w-5" />} accent="tertiary" hint={`${cfg.letterheadDesign} of 10`} />
          <StatCard label="Facility" value={facilityName} icon={<Stamp className="h-5 w-5" />} accent="secondary" hint="brand on letterhead" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Backgrounds config */}
        <div className="rounded-xl border border-[var(--mc-divider)] bg-white p-5 space-y-4">
          <h3 className="font-bold text-[var(--mc-text-primary)] flex items-center gap-2"><Droplets className="h-4 w-4 text-[var(--mc-primary)]" /> Document Background</h3>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={cfg.enabled} onChange={e => setCfg(c => ({ ...c, enabled: e.target.checked }))} className="h-4 w-4 accent-[var(--mc-primary)]" />
            Apply backgrounds to printable documents
          </label>

          <div className="grid grid-cols-3 gap-2">
            {([['color', 'Color', Palette], ['image', 'Image', FileImage], ['watermark', 'Watermark', Stamp]] as const).map(([type, label, Icon]) => (
              <button
                key={type}
                onClick={() => setCfg(c => ({ ...c, type }))}
                className={`rounded-xl border-2 p-3 text-center transition-all ${cfg.type === type ? 'border-[var(--mc-primary)] bg-[var(--mc-primary-light)]' : 'border-[var(--mc-divider)] hover:border-[var(--mc-tertiary)]'}`}
              >
                <Icon className="h-5 w-5 mx-auto mb-1 text-[var(--mc-primary)]" />
                <span className="text-xs font-bold">{label}</span>
              </button>
            ))}
          </div>

          {cfg.type === 'color' && (
            <Field icon={<Palette className="h-3.5 w-3.5" />} label="Background Color">
              <div className="flex items-center gap-2">
                <input type="color" value={cfg.color} onChange={e => setCfg(c => ({ ...c, color: e.target.value }))} className="h-10 w-14 rounded-lg border border-[var(--mc-divider)] bg-white cursor-pointer p-1" />
                <McInput value={cfg.color} onChange={e => setCfg(c => ({ ...c, color: e.target.value }))} className="flex-1" />
              </div>
            </Field>
          )}

          {cfg.type === 'image' && (
            <Field icon={<FileImage className="h-3.5 w-3.5" />} label="Background Image (page-size aware, auto-tinted)">
              <FileUploader value={cfg.image} onChange={url => setCfg(c => ({ ...c, image: url }))} module="DOC-BG" accept="image/*" />
              <p className="text-[11px] text-muted-foreground mt-1">Choose the page size first; the image prints at ~10% opacity behind content.</p>
            </Field>
          )}

          {cfg.type === 'watermark' && (
            <>
              <Field icon={<Stamp className="h-3.5 w-3.5" />} label="Watermark Text">
                <McInput value={cfg.watermarkText} onChange={e => setCfg(c => ({ ...c, watermarkText: e.target.value }))} placeholder="Boyani Health Dispensary" />
              </Field>
              <Field icon={<Droplets className="h-3.5 w-3.5" />} label={`Opacity (${Math.round(cfg.watermarkOpacity * 100)}%)`}>
                <input type="range" min={0.02} max={0.25} step={0.01} value={cfg.watermarkOpacity} onChange={e => setCfg(c => ({ ...c, watermarkOpacity: Number(e.target.value) }))} className="w-full accent-[var(--mc-primary)]" />
              </Field>
            </>
          )}

          <Field icon={<FileImage className="h-3.5 w-3.5" />} label="Page Size">
            <div className="grid grid-cols-3 gap-2">
              {(['A4', 'A5', 'LETTER'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => setCfg(c => ({ ...c, pageSize: size }))}
                  className={`rounded-lg border-2 py-2 text-sm font-bold transition-all ${cfg.pageSize === size ? 'border-[var(--mc-primary)] bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]' : 'border-[var(--mc-divider)]'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Letterhead designs */}
        <div className="rounded-xl border border-[var(--mc-divider)] bg-white p-5 space-y-4">
          <h3 className="font-bold text-[var(--mc-text-primary)] flex items-center gap-2"><Palette className="h-4 w-4 text-[var(--mc-primary)]" /> Letterhead Design (10 styles)</h3>
          <div className="grid sm:grid-cols-2 gap-2.5 max-h-[430px] overflow-y-auto pr-1">
            {LETTERHEADS.map(l => (
              <button
                key={l.id}
                onClick={() => setCfg(c => ({ ...c, letterheadDesign: l.id }))}
                className={`text-left rounded-xl border-2 p-3 transition-all ${cfg.letterheadDesign === l.id ? 'border-[var(--mc-primary)] bg-[var(--mc-primary-light)]' : 'border-[var(--mc-divider)] hover:border-[var(--mc-tertiary)]'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--mc-text-primary)]">{l.id}. {l.name}</span>
                  {cfg.letterheadDesign === l.id && <Check className="h-4 w-4 text-[var(--mc-primary)]" />}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{l.description}</p>
                {/* mini preview */}
                <div className="mt-2 rounded-md bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] p-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded" style={{ background: cfg.letterheadColor }} />
                    <span className="h-1.5 w-14 rounded bg-slate-300" />
                  </div>
                  {l.id === 1 && <div className="mt-1.5 border-t-2" style={{ borderColor: cfg.letterheadColor }} />}
                  {l.id === 3 && <div className="mt-1.5 h-2.5 rounded" style={{ background: cfg.letterheadColor }} />}
                  {l.id === 6 && <div className="mt-1.5 h-1 rounded" style={{ background: `linear-gradient(90deg, ${cfg.letterheadColor} 45%, #e2e8f0 45%)` }} />}
                  {l.id === 7 && <div className="mt-1.5 flex gap-1"><div className="w-1 h-3 rounded-sm" style={{ background: cfg.letterheadColor }} /><div className="flex-1 h-3 rounded-sm bg-slate-200" /></div>}
                  {l.id === 10 && <div className="mt-1.5 h-4 rounded bg-slate-800" />}
                  {(l.id === 2 || l.id === 4 || l.id === 5 || l.id === 8 || l.id === 9) && <div className="mt-1.5 border-t border-slate-200" />}
                </div>
              </button>
            ))}
          </div>
          <Field icon={<Palette className="h-3.5 w-3.5" />} label="Letterhead Accent Color">
            <div className="flex items-center gap-2">
              <input type="color" value={cfg.letterheadColor} onChange={e => setCfg(c => ({ ...c, letterheadColor: e.target.value }))} className="h-10 w-14 rounded-lg border border-[var(--mc-divider)] bg-white cursor-pointer p-1" />
              <McInput value={cfg.letterheadColor} onChange={e => setCfg(c => ({ ...c, letterheadColor: e.target.value }))} className="flex-1" />
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}
