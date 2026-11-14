'use client';

/**
 * DRUG CATALOG — pricing & feeding drugs is ADMIN-only (per requirements).
 * DataTable of /api/pharmacy + KPI StatCards + PremiumModal form + CSV bulk import.
 */

import * as React from 'react';
import {
  Pill, Package, AlertTriangle, CalendarClock, Banknote, Boxes, Pencil, Trash2, Plus,
  FileText, Scan, Tag, DollarSign, Box, Layers, Truck, Repeat, Barcode, MapPin, Lock, AlignLeft,
  Eye, ShieldCheck, Timer, Wallet, Percent,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, fmtDate, Field, FormSection, ConfirmModal, CsvImportControls, BoolPill, StatusBadge, PageHeading, SkeletonCards, McInput, McTextarea, isoDate, ViewSection, ViewField } from '../_lib';

interface Drug {
  id: string; code: string; name: string; genericName: string; category: string;
  dosageForm: string; strength: string; stock: number; unitCost: number; unitPrice: number;
  expiryDate: string | null; supplier: string; reorderLevel: number; batchNumber: string;
  rackLocation: string; counterShelf: string; isControlled: boolean; isActive: boolean; notes: string;
}
interface PharmacyResp {
  items: Drug[]; total: number; page: number; perPage: number; totalPages: number;
  kpis: { totalDrugs: number; lowStock: number; expiringSoon: number; totalStockUnits: number; totalValue: number };
}

const CATEGORIES = ['ANALGESIC', 'ANTIBIOTIC', 'ANTIMALARIAL', 'ANTIVIRAL', 'ANTIFUNGAL', 'CARDIOVASCULAR', 'DERMATOLOGICAL', 'GASTROINTESTINAL', 'RESPIRATORY', 'VITAMINS', 'GENERAL'];
const DOSAGE_FORMS = ['TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'INFUSION', 'CREAM', 'OINTMENT', 'DROPS', 'INHALER', 'SUPPOSITORY', 'SACHET'];
const CSV_HEADERS = ['name', 'genericName', 'category', 'dosageForm', 'strength', 'stock', 'unitCost', 'unitPrice', 'expiryDate', 'supplier'];

const emptyForm = {
  name: '', genericName: '', category: 'GENERAL', dosageForm: 'TABLET', strength: '',
  stock: '0', unitCost: '0', unitPrice: '0', expiryDate: '', supplier: '',
  reorderLevel: '20', batchNumber: '', rackLocation: '', counterShelf: '', isControlled: false, notes: '',
};

/** Expiry countdown: "in 128 days" / "expired 12 days ago" (amber when critical). */
function expiryCountdown(expiryDate: string | null): { text: string; tone: 'ok' | 'warn' | 'danger' } {
  if (!expiryDate) return { text: '—', tone: 'ok' };
  const days = Math.round((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: `expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`, tone: 'danger' };
  const label = `in ${days} day${days === 1 ? '' : 's'}`;
  if (days <= 90) return { text: label, tone: 'warn' };
  return { text: label, tone: 'ok' };
}

export default function DrugsPage() {
  const [drugs, setDrugs] = React.useState<Drug[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [kpis, setKpis] = React.useState<PharmacyResp['kpis'] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [stockFilter, setStockFilter] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Drug | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Drug | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [viewing, setViewing] = React.useState<Drug | null>(null);

  const [csvOpen, setCsvOpen] = React.useState(false);
  const [csvBusy, setCsvBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), perPage: '20' });
      if (search.trim()) params.set('search', search.trim());
      if (stockFilter) params.set('stockFilter', stockFilter);
      const res = await apiGet<PharmacyResp>(`/api/pharmacy?${params.toString()}`);
      setDrugs(res.items || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
      setKpis(res.kpis || null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load drug catalog');
    } finally {
      setLoading(false);
    }
  }, [search, stockFilter]);

  React.useEffect(() => { load(1); }, [stockFilter]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setModalOpen(true); };
  const openEdit = (d: Drug) => {
    setEditing(d);
    setForm({
      name: d.name, genericName: d.genericName || '', category: d.category || 'GENERAL',
      dosageForm: d.dosageForm || 'TABLET', strength: d.strength || '',
      stock: String(d.stock ?? 0), unitCost: String(d.unitCost ?? 0), unitPrice: String(d.unitPrice ?? 0),
      expiryDate: isoDate(d.expiryDate), supplier: d.supplier || '',
      reorderLevel: String(d.reorderLevel ?? 20), batchNumber: d.batchNumber || '',
      rackLocation: d.rackLocation || '', counterShelf: d.counterShelf || '',
      isControlled: !!d.isControlled, notes: d.notes || '',
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Drug name is required'); return; }
    if (isNaN(Number(form.unitPrice)) || isNaN(Number(form.unitCost))) { toast.error('Enter valid prices'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(), genericName: form.genericName, category: form.category,
        dosageForm: form.dosageForm, strength: form.strength,
        stock: Number(form.stock) || 0, unitCost: Number(form.unitCost) || 0,
        unitPrice: Number(form.unitPrice) || 0,
        expiryDate: form.expiryDate || null, supplier: form.supplier,
        reorderLevel: Number(form.reorderLevel) || 20, batchNumber: form.batchNumber,
        rackLocation: form.rackLocation, counterShelf: form.counterShelf,
        isControlled: form.isControlled, notes: form.notes,
      };
      const res = await apiPost<{ success: boolean }>('/api/pharmacy', payload);
      toast.success(editing ? 'Drug updated' : 'Drug added to catalog');
      void res;
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save drug');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ softDeleted?: boolean }>(`/api/pharmacy?id=${deleting.id}`);
      toast.success(res.softDeleted ? 'Drug deactivated (has sales history)' : 'Drug deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const importCsv = async (rows: Array<Record<string, string>>) => {
    setCsvBusy(true);
    try {
      const bulkItems = rows.map(r => ({
        name: r.name, genericName: r.genericName, category: r.category,
        dosageForm: r.dosageForm, strength: r.strength, stock: r.stock,
        unitCost: r.unitCost, unitPrice: r.unitPrice, expiryDate: r.expiryDate, supplier: r.supplier,
      }));
      const res = await apiPost<{ imported: number }>('/api/pharmacy', { bulkItems });
      toast.success(`Imported ${res.imported} drug(s)`);
      setCsvOpen(false);
      load(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'CSV import failed');
    } finally {
      setCsvBusy(false);
    }
  };

  const columns: Column<Drug>[] = [
    { key: 'name', header: 'Drug', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">
        {r.name}{r.strength ? <span className="text-muted-foreground font-normal"> · {r.strength}</span> : null}
      </span>
    ) },
    { key: 'category', header: 'Category', defaultVisible: true, render: r => <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]">{r.category}</span> },
    { key: 'unitPrice', header: 'Unit Price', defaultVisible: true, align: 'right', render: r => <span className="font-semibold">{kes(r.unitPrice)}</span>, csvValue: r => r.unitPrice },
    { key: 'stock', header: 'Stock', defaultVisible: true, align: 'right', render: r => (
      <span className={r.stock <= (r.reorderLevel || 0) ? 'font-bold text-red-600' : r.stock <= 10 ? 'font-bold text-amber-600' : 'font-semibold'}>
        {r.stock}
      </span>
    ), csvValue: r => r.stock },
    { key: 'code', header: 'Code' },
    { key: 'genericName', header: 'Generic Name' },
    { key: 'dosageForm', header: 'Form' },
    { key: 'unitCost', header: 'Unit Cost', align: 'right', render: r => kes(r.unitCost), csvValue: r => r.unitCost },
    { key: 'expiryDate', header: 'Expiry', render: r => fmtDate(r.expiryDate), csvValue: r => (r.expiryDate ? r.expiryDate.slice(0, 10) : '') },
    { key: 'supplier', header: 'Supplier' },
    { key: 'reorderLevel', header: 'Reorder At', align: 'right', csvValue: r => r.reorderLevel },
    { key: 'batchNumber', header: 'Batch No.' },
    { key: 'rackLocation', header: 'Rack' },
    { key: 'counterShelf', header: 'Counter Shelf', defaultVisible: true, render: r => r.counterShelf ? <span className="text-xs font-semibold text-[var(--mc-primary-dark)]">{r.counterShelf}</span> : <span className="text-muted-foreground">—</span> },
    { key: 'isControlled', header: 'Controlled', render: r => <BoolPill value={r.isControlled} />, csvValue: r => (r.isControlled ? 'true' : 'false') },
    { key: 'isActive', header: 'Status', render: r => <BoolPill value={r.isActive} trueLabel="Active" falseLabel="Retired" />, csvValue: r => (r.isActive ? 'ACTIVE' : 'INACTIVE') },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View drug', variant: 'view', onClick: r => setViewing(r) },
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit drug', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete drug', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Pill className="h-5 w-5" />}
        title="Drug Catalog"
        subtitle="Pharmacy inventory master — pricing & catalog controlled by ADMIN"
        actions={<>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setCsvOpen(true)}><FileText className="h-4 w-4" /> CSV Import</Button>
          <Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Drug</Button>
        </>}
      />

      {loading && !kpis ? <SkeletonCards count={5} /> : kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard label="Total Drugs" value={kpis.totalDrugs} icon={<Pill className="h-5 w-5" />} accent="primary" hint="active catalog" />
          <StatCard label="Low Stock" value={kpis.lowStock} icon={<AlertTriangle className="h-5 w-5" />} accent="danger" hint="≤ 10 units" />
          <StatCard label="Expiring Soon" value={kpis.expiringSoon} icon={<CalendarClock className="h-5 w-5" />} accent="warning" hint="within 90 days" />
          <StatCard label="Stock Value" value={kes(Number(kpis.totalValue))} icon={<Banknote className="h-5 w-5" />} accent="success" hint="retail value" />
          <StatCard label="Stock Units" value={kpis.totalStockUnits.toLocaleString('en-KE')} icon={<Boxes className="h-5 w-5" />} accent="tertiary" hint="units on shelf" />
        </div>
      ) : null}

      <DataTable
        data={drugs} columns={columns} actions={actions}
        rowKey={r => r.id} title="Drug Catalog" moduleLabel="Drug Catalog"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
        toolbarExtra={<div className="flex items-center gap-2">
          <McInput
            placeholder="Search name / generic / code…" value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') load(1); }}
            className="w-56"
          />
          <Select value={stockFilter || 'all'} onValueChange={v => setStockFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="mc-input h-9 w-40"><SelectValue placeholder="All stock" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="LOW">Low stock</SelectItem>
              <SelectItem value="EXPIRING">Expiring soon</SelectItem>
              <SelectItem value="OUT">Out of stock</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-9" onClick={() => load(1)}>Apply</Button>
        </div>}
      />

      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="lg"
        title={editing ? 'Edit Drug' : 'New Drug'}
        icon={<Pill className="h-5 w-5" />}
        description={editing ? `${editing.code} — stock edits create movement ledger entries` : 'Add a drug to the pharmacy catalog'}
        footerNote="Pricing & catalog feeding is restricted to administrators"
        submitLabel={editing ? 'Update Drug' : 'Add Drug'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Drug Identity">
            <Field icon={<Scan className="h-3.5 w-3.5" />} label="Brand Name">
              <McInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Panadol" />
            </Field>
            <Field icon={<Tag className="h-3.5 w-3.5" />} label="Generic Name">
              <McInput value={form.genericName} onChange={e => setForm(f => ({ ...f, genericName: e.target.value }))} placeholder="Paracetamol" />
            </Field>
            <Field icon={<Layers className="h-3.5 w-3.5" />} label="Category">
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field icon={<Box className="h-3.5 w-3.5" />} label="Dosage Form">
              <Select value={form.dosageForm} onValueChange={v => setForm(f => ({ ...f, dosageForm: v }))}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{DOSAGE_FORMS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field icon={<DollarSign className="h-3.5 w-3.5" />} label="Strength">
              <McInput value={form.strength} onChange={e => setForm(f => ({ ...f, strength: e.target.value }))} placeholder="500mg" />
            </Field>
            <Field icon={<Lock className="h-3.5 w-3.5" />} label="Controlled Substance">
              <div className="flex items-center gap-2 h-9">
                <Switch checked={form.isControlled} onCheckedChange={v => setForm(f => ({ ...f, isControlled: v }))} />
                <span className="text-xs text-muted-foreground">{form.isControlled ? 'Requires special handling' : 'Regular'}</span>
              </div>
            </Field>
          </FormSection>

          <FormSection n={2} title="Stock & Pricing">
            <Field icon={<Package className="h-3.5 w-3.5" />} label="Stock Quantity">
              <McInput type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
            </Field>
            <Field icon={<Repeat className="h-3.5 w-3.5" />} label="Reorder Level">
              <McInput type="number" min="0" value={form.reorderLevel} onChange={e => setForm(f => ({ ...f, reorderLevel: e.target.value }))} />
            </Field>
            <Field icon={<Banknote className="h-3.5 w-3.5" />} label="Unit Cost (KSh)">
              <McInput type="number" min="0" step="0.01" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} />
            </Field>
            <Field icon={<DollarSign className="h-3.5 w-3.5" />} label="Unit Price (KSh)">
              <McInput type="number" min="0" step="0.01" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} />
            </Field>
            <Field icon={<CalendarClock className="h-3.5 w-3.5" />} label="Expiry Date">
              <McInput type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
            </Field>
          </FormSection>

          <FormSection n={3} title="Batch, Location & Supplier">
            <Field icon={<Barcode className="h-3.5 w-3.5" />} label="Batch Number">
              <McInput value={form.batchNumber} onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))} />
            </Field>
            <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Rack Location">
              <McInput value={form.rackLocation} onChange={e => setForm(f => ({ ...f, rackLocation: e.target.value }))} placeholder="Rack B-12" />
            </Field>
            <Field icon={<Boxes className="h-3.5 w-3.5" />} label="Counter Shelf" hint="shelf/name at the dispensing counter for POS retrieval">
              <McInput value={form.counterShelf} onChange={e => setForm(f => ({ ...f, counterShelf: e.target.value }))} placeholder="CS-01" />
            </Field>
            <Field icon={<Truck className="h-3.5 w-3.5" />} label="Supplier">
              <McInput value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="e.g. Kemsa" />
            </Field>
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Notes" className="sm:col-span-2">
              <McTextarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
          </FormSection>
        </div>
      </PremiumModal>

      <PremiumModal
        open={csvOpen} onOpenChange={setCsvOpen}
        title="Bulk Import Drugs"
        icon={<FileText className="h-5 w-5" />}
        description="Download the CSV template, fill one drug per row, then import"
        footerNote="Existing codes are re-stocked/updated; rows missing a name are skipped"
        submitLabel="Close" onSubmit={() => setCsvOpen(false)}
      >
        <CsvImportControls templateName="drugs-template.csv" headers={CSV_HEADERS} onParsed={importCsv} note={`Columns: ${CSV_HEADERS.join(', ')} — expiryDate as YYYY-MM-DD`} />
        {csvBusy && <p className="text-xs text-muted-foreground mt-3">Importing…</p>}
      </PremiumModal>

      {/* ── View drug modal (Instruction 18c/11) ── */}
      <PremiumModal
        open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }} size="lg"
        title={viewing ? `Drug Profile — ${viewing.name}` : 'Drug Profile'}
        icon={<Pill className="h-5 w-5" />}
        description={viewing ? `${viewing.code} · ${viewing.dosageForm} · ${viewing.category}` : ''}
        footerNote={viewing ? (viewing.isActive ? 'Active catalog item' : 'Retired from catalog (has sales history)') : ''}
        submitLabel="Close" onSubmit={() => setViewing(null)}
      >
        {viewing && (() => {
          const expiry = expiryCountdown(viewing.expiryDate);
          const expiryTone = expiry.tone === 'danger' ? 'text-red-600' : expiry.tone === 'warn' ? 'text-amber-600' : 'text-muted-foreground';
          const marginPct = viewing.unitPrice > 0 ? ((viewing.unitPrice - viewing.unitCost) / viewing.unitPrice) * 100 : 0;
          return (
            <div className="space-y-5">
              <ViewSection icon={<Scan className="h-3.5 w-3.5" />} title="Identity">
                <ViewField icon={<Pill className="h-3.5 w-3.5" />} label="Brand Name" value={viewing.name} />
                <ViewField icon={<Tag className="h-3.5 w-3.5" />} label="Generic Name" value={viewing.genericName} />
                <ViewField icon={<Barcode className="h-3.5 w-3.5" />} label="Code" value={viewing.code} />
                <ViewField icon={<Layers className="h-3.5 w-3.5" />} label="Category" value={<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]">{viewing.category}</span>} />
                <ViewField icon={<Box className="h-3.5 w-3.5" />} label="Dosage Form" value={viewing.dosageForm} />
                <ViewField icon={<DollarSign className="h-3.5 w-3.5" />} label="Strength" value={viewing.strength} />
                <ViewField icon={<Lock className="h-3.5 w-3.5" />} label="Controlled Substance" value={<BoolPill value={viewing.isControlled} trueLabel="Controlled" falseLabel="Regular" />} />
                <ViewField icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Status" value={<BoolPill value={viewing.isActive} trueLabel="Active" falseLabel="Retired" />} />
              </ViewSection>

              <ViewSection icon={<Banknote className="h-3.5 w-3.5" />} title="Pricing (ADMIN only)">
                <ViewField icon={<DollarSign className="h-3.5 w-3.5" />} label="Unit Price (selling)" value={kes(viewing.unitPrice)} />
                <ViewField icon={<Wallet className="h-3.5 w-3.5" />} label="Unit Cost (buying)" value={kes(viewing.unitCost)} />
                <ViewField icon={<Percent className="h-3.5 w-3.5" />} label="Margin per Unit" value={viewing.unitPrice > 0 ? `${kes(viewing.unitPrice - viewing.unitCost)} · ${marginPct.toFixed(0)}%` : '—'} />
                <ViewField icon={<Boxes className="h-3.5 w-3.5" />} label="Retail Stock Value" value={kes(viewing.stock * viewing.unitPrice)} />
              </ViewSection>

              <ViewSection icon={<Package className="h-3.5 w-3.5" />} title="Stock">
                <ViewField icon={<Boxes className="h-3.5 w-3.5" />} label="Stock Quantity" value={
                  <span className={viewing.stock <= (viewing.reorderLevel || 0) ? 'font-bold text-red-600' : viewing.stock <= 10 ? 'font-bold text-amber-600' : 'font-semibold'}>
                    {viewing.stock} units
                  </span>
                } />
                <ViewField icon={<Repeat className="h-3.5 w-3.5" />} label="Reorder Level" value={`${viewing.reorderLevel} units`} />
                <ViewField icon={<Barcode className="h-3.5 w-3.5" />} label="Batch Number" value={viewing.batchNumber} />
                <ViewField icon={<Timer className="h-3.5 w-3.5" />} label="Expiry" value={
                  viewing.expiryDate ? (
                    <span>
                      {fmtDate(viewing.expiryDate)}
                      <span className={`ml-1.5 text-xs font-semibold ${expiryTone}`}>({expiry.text})</span>
                    </span>
                  ) : '—'
                } />
              </ViewSection>

              <ViewSection icon={<MapPin className="h-3.5 w-3.5" />} title="Location">
                <ViewField icon={<MapPin className="h-3.5 w-3.5" />} label="Rack Location" value={viewing.rackLocation} />
                <ViewField icon={<Boxes className="h-3.5 w-3.5" />} label="Counter Shelf" value={viewing.counterShelf} />
              </ViewSection>

              <ViewSection icon={<Truck className="h-3.5 w-3.5" />} title="Supplier & Notes">
                <ViewField icon={<Truck className="h-3.5 w-3.5" />} label="Supplier" value={viewing.supplier} />
                <ViewField icon={<AlignLeft className="h-3.5 w-3.5" />} label="Notes" value={viewing.notes} className="sm:col-span-2" />
              </ViewSection>
            </div>
          );
        })()}
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Drug"
        message={deleting ? `Delete "${deleting.name}"? Drugs with sales history are deactivated instead.` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
