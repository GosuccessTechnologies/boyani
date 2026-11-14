'use client';

/**
 * PRINTER SETTINGS — receipt printer configuration.
 * GET /api/printer-settings → form (type, paper, network/serial params,
 * toggles). POST action=save. "Test Print" → POST action=test → open
 * returned HTML in a new window & print. Add/remove printer (simulated).
 */

import * as React from 'react';
import {
  Printer, Cpu, Ruler, Binary, Wifi, Network, Plug, Hash, Scissors, FileText,
  Copy, Image as ImageIcon, Building2, QrCode, Save, PlayCircle, PlusCircle, MinusCircle, CheckCircle2,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, PageHeading, BoolPill } from '../_lib';

interface PrinterConfig {
  printerType: string; paperWidth: string; encoding: string; ipAddress: string;
  port: string; baudRate: string; charPerLine: number; autoCut: boolean;
  paperSize: string; copies: number; showLogo: boolean; showCompanyInfo: boolean;
  showQRCode: boolean; footerMessage: string; connectedPrinters: string[];
}

const PRINTER_TYPES = ['USB', 'NETWORK', 'BLUETOOTH'];
const PAPER_WIDTHS = ['58mm', '80mm', 'A4', 'A5'];
const ENCODINGS = ['UTF-8', 'ASCII', 'CP437', 'CP850', 'ISO-8859-1'];
const PAPER_SIZES = ['A4', 'A5', '80mm', '58mm'];

export default function PrinterPage() {
  const [config, setConfig] = React.useState<PrinterConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<{ config: PrinterConfig }>('/api/printer-settings');
        setConfig(res.config || null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load printer settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const upd = <K extends keyof PrinterConfig>(key: K, value: PrinterConfig[K]) => {
    setConfig(c => (c ? { ...c, [key]: value } : c));
    setDirty(true);
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await apiPost<{ message: string }>('/api/printer-settings', {
        action: 'save',
        printerType: config.printerType,
        paperWidth: config.paperWidth,
        encoding: config.encoding,
        ipAddress: config.ipAddress,
        port: config.port,
        baudRate: config.baudRate,
        charPerLine: Number(config.charPerLine) || 48,
        autoCut: config.autoCut,
        paperSize: config.paperSize,
        copies: Number(config.copies) || 1,
        showLogo: config.showLogo,
        showCompanyInfo: config.showCompanyInfo,
        showQRCode: config.showQRCode,
      });
      toast.success(res.message || 'Printer settings saved');
      setDirty(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save printer settings');
    } finally {
      setSaving(false);
    }
  };

  const testPrint = async () => {
    setTesting(true);
    try {
      const res = await apiPost<{ message: string; details: { content: string; html: string } }>('/api/printer-settings', { action: 'test' });
      const html = res.details?.html;
      if (!html) { toast.info(res.message || 'Test print generated'); return; }
      const win = window.open('', '_blank', 'width=700,height=700');
      if (!win) { toast.error('Popup blocked — allow popups to see the test print'); return; }
      win.document.write(`<!DOCTYPE html><html><head><title>Printer Test</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          @media print { .hint { display: none; } }
          .hint { background: #f0fdfa; border: 1px solid #ccfbf1; color: #0f766e; padding: 8px 12px; border-radius: 8px; font-size: 12px; margin-bottom: 16px; }
        </style></head><body>
        <div class="hint">Use your browser print dialog (Ctrl/Cmd + P) to send this test receipt to the configured printer.</div>
        ${html}
        <script>window.onload = () => setTimeout(() => window.print(), 400)</script>
        </body></html>`);
      win.document.close();
      toast.success(res.message || 'Test print generated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Test print failed');
    } finally {
      setTesting(false);
    }
  };

  const addPrinter = async () => {
    try {
      const res = await apiPost<{ message: string }>('/api/printer-settings', { action: 'add-printer' });
      toast.success(res.message || 'Printer added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const removePrinter = async () => {
    try {
      const res = await apiPost<{ message: string }>('/api/printer-settings', { action: 'remove-printer' });
      toast.success(res.message || 'Printer removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!config) {
    return <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">Printer settings unavailable.</div>;
  }

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Printer className="h-5 w-5" />}
        title="Printer Setup"
        subtitle="Receipt printer hardware configuration & test printing"
        actions={<>
          <Button size="sm" variant="outline" className="gap-1" onClick={testPrint} disabled={testing}>
            <PlayCircle className="h-4 w-4" /> {testing ? 'Printing…' : 'Test Print'}
          </Button>
          <Button size="sm" className="gap-1" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Printer Type" value={config.printerType} icon={<Cpu className="h-5 w-5" />} accent="primary" />
        <StatCard label="Paper Size" value={config.paperSize} icon={<Ruler className="h-5 w-5" />} accent="secondary" hint={`width ${config.paperWidth}`} />
        <StatCard label="Characters / Line" value={config.charPerLine} icon={<Hash className="h-5 w-5" />} accent="tertiary" hint={`encoding ${config.encoding}`} />
        <StatCard label="Receipt Copies" value={config.copies} icon={<Copy className="h-5 w-5" />} accent="success" hint={config.autoCut ? 'auto-cut on' : 'auto-cut off'} />
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-6">
        {/* 1 — Hardware */}
        <FormSection n={1} title="Printer Hardware">
          <Field icon={<Cpu className="h-3.5 w-3.5" />} label="Connection Type">
            <Select value={config.printerType} onValueChange={v => upd('printerType', v)}>
              <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{PRINTER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field icon={<Ruler className="h-3.5 w-3.5" />} label="Paper Width">
            <Select value={config.paperWidth} onValueChange={v => upd('paperWidth', v)}>
              <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{PAPER_WIDTHS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field icon={<FileText className="h-3.5 w-3.5" />} label="Paper Size (receipt layout)">
            <Select value={config.paperSize} onValueChange={v => upd('paperSize', v)}>
              <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{PAPER_SIZES.map(t => <SelectItem key={t} value={t}>{t === 'A4' || t === 'A5' ? `${t} portrait` : `${t} roll`}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field icon={<Binary className="h-3.5 w-3.5" />} label="Encoding">
            <Select value={config.encoding} onValueChange={v => upd('encoding', v)}>
              <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ENCODINGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field icon={<Hash className="h-3.5 w-3.5" />} label="Characters Per Line">
            <input className="mc-input h-9 w-full px-3 text-sm" type="number" min={20} max={96}
              value={config.charPerLine} onChange={e => upd('charPerLine', Number(e.target.value))} />
          </Field>
          <Field icon={<Copy className="h-3.5 w-3.5" />} label="Receipt Copies">
            <input className="mc-input h-9 w-full px-3 text-sm" type="number" min={1} max={5}
              value={config.copies} onChange={e => upd('copies', Number(e.target.value))} />
          </Field>
        </FormSection>

        {/* 2 — Connection */}
        <FormSection n={2} title={`Connection — ${config.printerType}`}>
          {config.printerType === 'NETWORK' && (
            <>
              <Field icon={<Wifi className="h-3.5 w-3.5" />} label="IP Address">
                <input className="mc-input h-9 w-full px-3 text-sm" value={config.ipAddress}
                  onChange={e => upd('ipAddress', e.target.value)} placeholder="192.168.1.87" />
              </Field>
              <Field icon={<Network className="h-3.5 w-3.5" />} label="Port">
                <input className="mc-input h-9 w-full px-3 text-sm" value={config.port}
                  onChange={e => upd('port', e.target.value)} placeholder="9100" />
              </Field>
            </>
          )}
          {config.printerType === 'BLUETOOTH' && (
            <>
              <Field icon={<Plug className="h-3.5 w-3.5" />} label="Baud Rate">
                <input className="mc-input h-9 w-full px-3 text-sm" value={config.baudRate}
                  onChange={e => upd('baudRate', e.target.value)} placeholder="9600" />
              </Field>
              <Field icon={<Plug className="h-3.5 w-3.5" />} label="Port">
                <input className="mc-input h-9 w-full px-3 text-sm" value={config.port}
                  onChange={e => upd('port', e.target.value)} placeholder="COM3 / /dev/ttyUSB0" />
              </Field>
            </>
          )}
          {config.printerType === 'USB' && (
            <div className="sm:col-span-2 rounded-xl border border-dashed border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-3 text-xs text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--mc-primary)]" />
              USB printers are auto-detected by the browser print dialog — no address configuration needed.
            </div>
          )}
          <Field icon={<Scissors className="h-3.5 w-3.5" />} label="Auto Cut">
            <div className="flex items-center gap-2 h-9">
              <Switch checked={config.autoCut} onCheckedChange={v => upd('autoCut', v)} />
              <span className="text-xs text-muted-foreground">{config.autoCut ? 'Cut after each receipt' : 'Manual tear-off'}</span>
            </div>
          </Field>
        </FormSection>

        {/* 3 — Receipt appearance */}
        <FormSection n={3} title="Receipt Appearance">
          <Field icon={<ImageIcon className="h-3.5 w-3.5" />} label="Show Logo">
            <div className="flex items-center gap-2 h-9">
              <Switch checked={config.showLogo} onCheckedChange={v => upd('showLogo', v)} />
              <BoolPill value={config.showLogo} trueLabel="On" falseLabel="Off" />
            </div>
          </Field>
          <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Show Facility Info">
            <div className="flex items-center gap-2 h-9">
              <Switch checked={config.showCompanyInfo} onCheckedChange={v => upd('showCompanyInfo', v)} />
              <BoolPill value={config.showCompanyInfo} trueLabel="On" falseLabel="Off" />
            </div>
          </Field>
          <Field icon={<QrCode className="h-3.5 w-3.5" />} label="Show QR Code">
            <div className="flex items-center gap-2 h-9">
              <Switch checked={config.showQRCode} onCheckedChange={v => upd('showQRCode', v)} />
              <BoolPill value={config.showQRCode} trueLabel="On" falseLabel="Off" />
            </div>
          </Field>
        </FormSection>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[var(--mc-divider)]">
          <span className="text-xs text-muted-foreground mr-auto">{dirty ? 'Unsaved changes' : 'Settings in sync'}</span>
          <Button variant="outline" size="sm" className="gap-1" onClick={addPrinter}>
            <PlusCircle className="h-3.5 w-3.5" /> Add Printer
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={removePrinter}>
            <MinusCircle className="h-3.5 w-3.5" /> Remove Printer
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={testPrint} disabled={testing}>
            <PlayCircle className="h-3.5 w-3.5" /> Test Print
          </Button>
          <Button size="sm" className="gap-1" onClick={save} disabled={saving}>
            <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
