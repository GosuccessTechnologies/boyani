'use client';

/**
 * QUOTATIONS MANAGER — DataTable + dynamic items builder modal
 * (SERVICE / DRUG / PACKAGE lines) + discount + validUntil + status
 * badges + print quotation view (facility hero header + items table).
 */

import * as React from 'react';
import {
  ReceiptText, User, Phone, Mail, CalendarDays, Percent, AlignLeft, Pencil, Trash2, Plus,
  Printer, Stethoscope, Pill, Package, Banknote, Hash, Layers, RotateCcw, Eye,
} from 'lucide-react';
import { DataTable, type Column, type ActionBtn } from '@/components/shared/DataTable';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { kes, fmtDate, isoDate, fmtDateTime, Field, FormSection, ConfirmModal, StatusBadge, PageHeading, SkeletonCards, McInput, McTextarea, ViewSection, ViewField } from '../_lib';

interface QuotationItem {
  id?: string; itemType: string; referenceId: string; serviceId: string | null;
  itemName: string; quantity: number; unitPrice: number; totalPrice: number; notes: string;
}
interface Quotation {
  id: string; quotationNo: string; customerName: string; customerPhone: string; customerEmail: string;
  subtotal: number; taxAmount: number; discountAmount: number; totalAmount: number;
  status: string; validUntil: string | null; notes: string; createdAt: string;
  items: QuotationItem[];
  createdBy?: { username: string; firstName: string; lastName: string } | null;
}
interface Service { id: string; name: string; price: number; category: string }
interface DrugItem { id: string; name: string; strength: string; unitPrice: number; stock: number }
interface CompanyConfig { [k: string]: string }

interface DraftItem {
  itemType: string; serviceId: string; drugId: string; itemName: string;
  quantity: string; unitPrice: string; notes: string;
}

const STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED_TO_BILL'];
const ITEM_TYPES = ['SERVICE', 'DRUG', 'PACKAGE'];

const emptyDraft = (): DraftItem => ({ itemType: 'SERVICE', serviceId: '', drugId: '', itemName: '', quantity: '1', unitPrice: '', notes: '' });

export default function QuotationsPage() {
  const [quotations, setQuotations] = React.useState<Quotation[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('');

  const [services, setServices] = React.useState<Service[]>([]);
  const [drugs, setDrugs] = React.useState<DrugItem[]>([]);
  const [company, setCompany] = React.useState<CompanyConfig>({});

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Quotation | null>(null);
  const [form, setForm] = React.useState({ customerName: '', customerPhone: '', customerEmail: '', validUntil: '', discountAmount: '', notes: '', status: 'DRAFT' });
  const [draftItems, setDraftItems] = React.useState<DraftItem[]>([emptyDraft()]);
  const [submitting, setSubmitting] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Quotation | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [printing, setPrinting] = React.useState(false);

  const [viewing, setViewing] = React.useState<Quotation | null>(null);
  const [viewLoading, setViewLoading] = React.useState(false);

  const load = React.useCallback(async (p = 1, status = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), perPage: '20' });
      if (status) params.set('status', status);
      const res = await apiGet<{ quotations: Quotation[]; pagination: { page: number; total: number; totalPages: number } }>(`/api/quotations?${params.toString()}`);
      setQuotations(res.quotations || []);
      setTotal(res.pagination?.total || 0);
      setPage(res.pagination?.page || 1);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    load(1);
    apiGet<{ services: Service[] }>('/api/services?perPage=200')
      .then(r => setServices(r.services || []))
      .catch(() => {});
    apiGet<{ drugs: DrugItem[] }>('/api/pharmacy-pos?section=drugs')
      .then(r => setDrugs(r.drugs || []))
      .catch(() => {});
    apiGet<{ config: CompanyConfig }>('/api/company')
      .then(r => setCompany(r.config || {}))
      .catch(() => {});
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ customerName: '', customerPhone: '', customerEmail: '', validUntil: '', discountAmount: '', notes: '', status: 'DRAFT' });
    setDraftItems([emptyDraft()]);
    setModalOpen(true);
  };

  const openEdit = (q: Quotation) => {
    setEditing(q);
    setForm({
      customerName: q.customerName, customerPhone: q.customerPhone, customerEmail: q.customerEmail,
      validUntil: isoDate(q.validUntil), discountAmount: String(q.discountAmount ?? ''),
      notes: q.notes || '', status: q.status,
    });
    setDraftItems((q.items || []).map(it => ({
      itemType: it.itemType || 'SERVICE',
      serviceId: it.serviceId || '',
      drugId: it.itemType === 'DRUG' ? it.referenceId : '',
      itemName: it.itemName || '',
      quantity: String(it.quantity ?? 1),
      unitPrice: String(it.unitPrice ?? ''),
      notes: it.notes || '',
    })));
    setModalOpen(true);
  };

  const draftSubtotal = draftItems.reduce((s, d) => s + (Number(d.unitPrice) || 0) * (Number(d.quantity) || 0), 0);
  const draftTotal = Math.max(0, draftSubtotal - (Number(form.discountAmount) || 0));

  const setItem = (idx: number, patch: Partial<DraftItem>) => {
    setDraftItems(items => items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const onServicePick = (idx: number, serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    setItem(idx, { serviceId, drugId: '', unitPrice: svc ? String(svc.price) : '' });
  };
  const onDrugPick = (idx: number, drugId: string) => {
    const drug = drugs.find(d => d.id === drugId);
    setItem(idx, { drugId, serviceId: '', unitPrice: drug ? String(drug.unitPrice) : '' });
  };
  const onTypeChange = (idx: number, itemType: string) => {
    setItem(idx, { itemType, serviceId: '', drugId: '', unitPrice: '', itemName: '' });
  };

  const submit = async () => {
    if (!form.customerName.trim()) { toast.error('Customer name is required'); return; }
    const items = draftItems
      .filter(d => (d.itemType === 'DRUG' ? !!d.drugId : d.itemType === 'SERVICE' ? !!d.serviceId : !!d.itemName.trim()))
      .map(d => ({
        itemType: d.itemType,
        ...(d.itemType === 'DRUG' ? { referenceId: d.drugId } : {}),
        ...(d.itemType === 'SERVICE' ? { serviceId: d.serviceId } : {}),
        ...(d.itemType === 'PACKAGE' ? { itemName: d.itemName.trim() } : {}),
        quantity: Number(d.quantity) || 1,
        unitPrice: Number(d.unitPrice) || 0,
        notes: d.notes,
      }));
    if (!items.length) { toast.error('Add at least one complete item line'); return; }
    setSubmitting(true);
    try {
      const payload = {
        customerName: form.customerName.trim(), customerPhone: form.customerPhone,
        customerEmail: form.customerEmail, items,
        discountAmount: Number(form.discountAmount) || 0,
        notes: form.notes, validUntil: form.validUntil || null,
        ...(editing ? { id: editing.id, status: form.status } : {}),
      };
      const res = editing
        ? await apiPut<{ message: string }>('/api/quotations', payload)
        : await apiPost<{ message: string }>('/api/quotations', payload);
      toast.success(res.message || (editing ? 'Quotation updated' : 'Quotation created'));
      setModalOpen(false);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save quotation');
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/quotations?id=${deleting.id}`);
      toast.success(res.message || 'Quotation deleted');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  // ── View quotation — full details incl. line items (lazy-fetch when the list
  // row arrived without them) ──
  const viewQuotation = async (q: Quotation) => {
    setViewing(q);
    if (!q.items?.length) {
      setViewLoading(true);
      try {
        const res = await apiGet<{ quotation: Quotation }>(`/api/quotations/${q.id}`);
        if (res.quotation) setViewing(res.quotation);
      } catch {
        /* keep the summary row */
      } finally {
        setViewLoading(false);
      }
    }
  };

  // ── Print quotation — facility hero header + items table (DataTable pattern) ──
  const printQuotation = async (q: Quotation) => {
    setPrinting(true);
    try {
      let full: Quotation = q;
      if (!q.items?.length) {
        const res = await apiGet<{ quotation: Quotation }>(`/api/quotations/${q.id}`);
        full = res.quotation || q;
      }
      const facility = company.companyName || 'Boyani Health Dispensary';
      const address = company.companyAddress || '';
      const phone = company.companyPhone || '';
      const email = company.companyEmail || '';
      const rows = (full.items || []).map((it, i) => `<tr>
          <td>${i + 1}</td>
          <td>${it.itemName}</td>
          <td>${it.itemType}</td>
          <td style="text-align:center">${it.quantity}</td>
          <td style="text-align:right">${kes(it.unitPrice)}</td>
          <td style="text-align:right">${kes(it.totalPrice)}</td>
        </tr>`).join('');
      const win = window.open('', '_blank', 'width=900,height=650');
      if (!win) { toast.error('Popup blocked — allow popups to print'); return; }
      win.document.write(`<!DOCTYPE html><html><head><title>Quotation ${full.quotationNo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          .hero { text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 12px; margin-bottom: 16px; }
          .hero h1 { margin: 0; font-size: 22px; color: #0d9488; }
          .hero p { margin: 4px 0; font-size: 12px; color: #64748b; }
          .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 14px; }
          .meta b { display: block; font-size: 13px; margin-bottom: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #134e4a; color: #fff; padding: 8px; text-align: left; }
          td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) td { background: #f0fdfa; }
          .totals { margin-top: 14px; margin-left: auto; width: 280px; font-size: 12px; }
          .totals div { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #cbd5e1; }
          .totals .grand { font-weight: bold; font-size: 14px; color: #0d9488; border-bottom: none; }
          .status { display: inline-block; padding: 2px 10px; border-radius: 999px; background: #134e4a; color: #fff; font-size: 11px; }
          .foot { margin-top: 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px dashed #999; padding-top: 10px; }
        </style></head><body>
        <div class="hero">
          <h1>${facility}</h1>
          <p>${address}${phone ? ' · ' + phone : ''}${email ? ' · ' + email : ''}</p>
          <p style="font-size:14px; font-weight:bold; margin-top:6px;">QUOTATION — ${full.quotationNo}</p>
        </div>
        <div class="meta">
          <div><b>Prepared for</b>${full.customerName || '—'}<br/>${full.customerPhone || ''}${full.customerEmail ? '<br/>' + full.customerEmail : ''}</div>
          <div style="text-align:right"><b>Date & Validity</b>${new Date(full.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}<br/>${full.validUntil ? 'Valid until ' + new Date(full.validUntil).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div>
        </div>
        <table><thead><tr><th>#</th><th>Item</th><th>Type</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="totals">
          <div><span>Subtotal</span><span>${kes(full.subtotal)}</span></div>
          ${full.discountAmount ? `<div><span>Discount</span><span>- ${kes(full.discountAmount)}</span></div>` : ''}
          ${full.taxAmount ? `<div><span>Tax</span><span>${kes(full.taxAmount)}</span></div>` : ''}
          <div class="grand"><span>Total Amount</span><span>${kes(full.totalAmount)}</span></div>
        </div>
        ${full.notes ? `<p style="font-size:12px; margin-top:16px;"><b>Notes:</b> ${full.notes}</p>` : ''}
        <div class="foot">Status: <span class="status">${full.status}</span> — Generated ${new Date().toLocaleString('en-KE')}<br/>${company.receiptFooter || 'Thank you for choosing us.'}</div>
        <script>window.onload = () => setTimeout(() => window.print(), 300)</script>
        </body></html>`);
      win.document.close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to prepare print view');
    } finally {
      setPrinting(false);
    }
  };

  const columns: Column<Quotation>[] = [
    { key: 'quotationNo', header: 'Quotation No.', defaultVisible: true, render: r => <span className="font-semibold text-[var(--mc-primary-dark)]">{r.quotationNo}</span> },
    { key: 'customerName', header: 'Customer', defaultVisible: true, render: r => (
      <span className="font-semibold text-[var(--mc-text-primary)]">{r.customerName || '—'}</span>
    ) },
    { key: 'totalAmount', header: 'Total', defaultVisible: true, align: 'right', render: r => <span className="font-semibold">{kes(r.totalAmount)}</span>, csvValue: r => r.totalAmount },
    { key: 'status', header: 'Status', defaultVisible: true, render: r => <StatusBadge status={r.status} /> },
    { key: 'customerPhone', header: 'Phone' },
    { key: 'items', header: 'Items', align: 'right', csvValue: r => (r.items || []).length, render: r => (r.items || []).length },
    { key: 'createdAt', header: 'Created', render: r => fmtDate(r.createdAt), csvValue: r => (r.createdAt ? r.createdAt.slice(0, 10) : '') },
    { key: 'validUntil', header: 'Valid Until', render: r => fmtDate(r.validUntil), csvValue: r => (r.validUntil ? r.validUntil.slice(0, 10) : '') },
    { key: 'discountAmount', header: 'Discount', align: 'right', render: r => kes(r.discountAmount), csvValue: r => r.discountAmount },
    { key: 'customerEmail', header: 'Email' },
  ];

  const actions: ActionBtn[] = [
    { icon: <Eye className="h-4 w-4" />, title: 'View quotation', variant: 'view', onClick: r => viewQuotation(r) },
    { icon: <Printer className="h-4 w-4" />, title: 'Print quotation', variant: 'print', onClick: printQuotation },
    { icon: <Pencil className="h-4 w-4" />, title: 'Edit quotation', variant: 'edit', onClick: openEdit },
    { icon: <Trash2 className="h-4 w-4" />, title: 'Delete quotation', variant: 'delete', onClick: r => { setDeleting(r); setConfirmOpen(true); } },
  ];

  const draftCount = quotations.filter(q => q.status === 'DRAFT').length;
  const acceptedValue = quotations.filter(q => q.status === 'ACCEPTED').reduce((s, q) => s + q.totalAmount, 0);
  const totalValue = quotations.reduce((s, q) => s + q.totalAmount, 0);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<ReceiptText className="h-5 w-5" />}
        title="Quotations"
        subtitle="Medical service & drug quotations for walk-in customers and corporates"
        actions={<Button size="sm" className="gap-1" onClick={openCreate}><Plus className="h-4 w-4" /> New Quotation</Button>}
      />

      {loading ? <SkeletonCards count={4} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Quotations" value={total} icon={<ReceiptText className="h-5 w-5" />} accent="primary" />
          <StatCard label="Drafts" value={draftCount} icon={<Pencil className="h-5 w-5" />} accent="secondary" hint="this page" />
          <StatCard label="Quoted Value" value={kes(totalValue)} icon={<Banknote className="h-5 w-5" />} accent="tertiary" hint="this page" />
          <StatCard label="Accepted Value" value={kes(acceptedValue)} icon={<Percent className="h-5 w-5" />} accent="success" hint="this page" />
        </div>
      )}

      <DataTable
        data={quotations} columns={columns} actions={actions}
        rowKey={r => r.id} title="Quotations" moduleLabel="Quotations"
        loading={loading} page={page} perPage={20} total={total}
        onPageChange={p => load(p)}
        toolbarExtra={<div className="flex items-center gap-2">
          <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="mc-input h-9 w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replaceAll('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          {printing && <span className="text-xs text-muted-foreground">Preparing print…</span>}
        </div>}
      />

      {/* ── Quotation builder modal ── */}
      <PremiumModal
        open={modalOpen} onOpenChange={setModalOpen} size="xl"
        title={editing ? `Edit Quotation — ${editing.quotationNo}` : 'New Quotation'}
        icon={<ReceiptText className="h-5 w-5" />}
        description={editing ? (editing.status === 'CONVERTED_TO_BILL' ? 'Read-only — converted to bill' : 'Adjust items, discount, validity or status') : 'Build a quotation from services, drugs and packages'}
        footerNote={editing ? `Subtotal ${kes(editing.subtotal)} · Total ${kes(editing.totalAmount)}` : `Live total: ${kes(draftTotal)}`}
        submitLabel={editing ? 'Update Quotation' : 'Create Quotation'}
        onSubmit={submit} submitting={submitting} secondaryLabel="Cancel"
        submitDisabled={!!editing && editing.status === 'CONVERTED_TO_BILL'}
      >
        <div className="space-y-5">
          <FormSection n={1} title="Customer & Validity">
            <Field icon={<User className="h-3.5 w-3.5" />} label="Customer Name">
              <McInput value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="e.g. Aisha Trading Ltd" />
            </Field>
            <Field icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
              <McInput value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="+254 7XX XXX XXX" />
            </Field>
            <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email">
              <McInput type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} />
            </Field>
            <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Valid Until">
              <McInput type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
            </Field>
            <Field icon={<Percent className="h-3.5 w-3.5" />} label="Discount (KSh)">
              <McInput type="number" min="0" step="0.01" value={form.discountAmount} onChange={e => setForm(f => ({ ...f, discountAmount: e.target.value }))} />
            </Field>
            {editing && (
              <Field icon={<Layers className="h-3.5 w-3.5" />} label="Status">
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} disabled={editing.status === 'CONVERTED_TO_BILL'}>
                  <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.replaceAll('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            )}
          </FormSection>

          {/* Dynamic items builder */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-[var(--mc-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <h3 className="text-sm font-bold text-[var(--mc-text-primary)]">Quotation Items</h3>
              <div className="flex-1 h-px bg-[var(--mc-divider)]" />
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs"
                onClick={() => setDraftItems(items => [...items, emptyDraft()])}>
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {draftItems.map((d, idx) => (
                <div key={idx} className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--mc-text-secondary)] mb-1">
                      {d.itemType === 'DRUG' ? <Pill className="h-3 w-3" /> : d.itemType === 'PACKAGE' ? <Package className="h-3 w-3" /> : <Stethoscope className="h-3 w-3" />} Type
                    </label>
                    <Select value={d.itemType} onValueChange={v => onTypeChange(idx, v)}>
                      <SelectTrigger className="mc-input h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {d.itemType === 'SERVICE' && (
                    <div className="md:col-span-4">
                      <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--mc-text-secondary)] mb-1"><Stethoscope className="h-3 w-3" /> Service</label>
                      <Select value={d.serviceId} onValueChange={v => onServicePick(idx, v)}>
                        <SelectTrigger className="mc-input h-8 w-full text-xs"><SelectValue placeholder="Select service…" /></SelectTrigger>
                        <SelectContent>
                          {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — {kes(s.price)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {d.itemType === 'DRUG' && (
                    <div className="md:col-span-4">
                      <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--mc-text-secondary)] mb-1"><Pill className="h-3 w-3" /> Drug</label>
                      <Select value={d.drugId} onValueChange={v => onDrugPick(idx, v)}>
                        <SelectTrigger className="mc-input h-8 w-full text-xs"><SelectValue placeholder="Select drug…" /></SelectTrigger>
                        <SelectContent>
                          {drugs.map(dr => <SelectItem key={dr.id} value={dr.id}>{dr.name}{dr.strength ? ` ${dr.strength}` : ''} — {kes(dr.unitPrice)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {d.itemType === 'PACKAGE' && (
                    <div className="md:col-span-4">
                      <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--mc-text-secondary)] mb-1"><Package className="h-3 w-3" /> Package Name</label>
                      <Input className="mc-input h-8 text-xs" value={d.itemName} onChange={e => setItem(idx, { itemName: e.target.value })} placeholder="e.g. Antenatal Bundle" />
                    </div>
                  )}

                  <div className="md:col-span-1">
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--mc-text-secondary)] mb-1"><Hash className="h-3 w-3" /> Qty</label>
                    <Input className="mc-input h-8 text-xs" type="number" min="1" value={d.quantity} onChange={e => setItem(idx, { quantity: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--mc-text-secondary)] mb-1"><Banknote className="h-3 w-3" /> Unit Price</label>
                    <Input className="mc-input h-8 text-xs" type="number" min="0" step="0.01" value={d.unitPrice} onChange={e => setItem(idx, { unitPrice: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--mc-text-secondary)] mb-1"><AlignLeft className="h-3 w-3" /> Notes</label>
                    <Input className="mc-input h-8 text-xs" value={d.notes} onChange={e => setItem(idx, { notes: e.target.value })} placeholder="optional" />
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button" title="Remove line"
                      className="mc-action-btn mc-action-delete"
                      onClick={() => setDraftItems(items => (items.length > 1 ? items.filter((_, i) => i !== idx) : items))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Live totals */}
            <div className="flex justify-end">
              <div className="w-64 rounded-xl border bg-white p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-semibold">{kes(draftSubtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-semibold text-red-600">- {kes(Number(form.discountAmount) || 0)}</span></div>
                <div className="flex justify-between border-t pt-1"><span className="font-bold">Total</span><span className="font-bold text-[var(--mc-primary-dark)]">{kes(draftTotal)}</span></div>
              </div>
            </div>
          </section>

          <FormSection n={3} title="Notes">
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Quotation Notes" className="sm:col-span-2">
              <McTextarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Terms, validity conditions…" />
            </Field>
          </FormSection>

          {editing && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <RotateCcw className="h-3 w-3" /> Created {fmtDateTime(editing.createdAt)} by {editing.createdBy ? `${editing.createdBy.firstName} ${editing.createdBy.lastName}` : '—'}
            </p>
          )}
        </div>
      </PremiumModal>

      {/* ── View quotation modal (Instruction 11 — shows line items) ── */}
      <PremiumModal
        open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }} size="lg"
        title={viewing ? `Quotation — ${viewing.quotationNo}` : 'Quotation'}
        icon={<ReceiptText className="h-5 w-5" />}
        description={viewing ? `${viewing.customerName || 'Customer'} · ${kes(viewing.totalAmount)}` : ''}
        footerNote={viewing ? `Status: ${viewing.status}${viewing.validUntil ? ` · valid until ${fmtDate(viewing.validUntil)}` : ''}` : ''}
        submitLabel="Close" onSubmit={() => setViewing(null)}
      >
        {viewing && (
          <div className="space-y-5">
            <ViewSection icon={<User className="h-3.5 w-3.5" />} title="Customer & Validity">
              <ViewField icon={<User className="h-3.5 w-3.5" />} label="Customer" value={viewing.customerName} />
              <ViewField icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={viewing.customerPhone} />
              <ViewField icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={viewing.customerEmail} />
              <ViewField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Valid Until" value={viewing.validUntil ? fmtDate(viewing.validUntil) : '—'} />
              <ViewField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Created" value={fmtDateTime(viewing.createdAt)} />
              <ViewField icon={<RotateCcw className="h-3.5 w-3.5" />} label="Created By" value={viewing.createdBy ? `${viewing.createdBy.firstName} ${viewing.createdBy.lastName}`.trim() || viewing.createdBy.username : '—'} />
              <ViewField icon={<Layers className="h-3.5 w-3.5" />} label="Status" value={<StatusBadge status={viewing.status} />} />
              <ViewField icon={<Percent className="h-3.5 w-3.5" />} label="Line Items" value={`${(viewing.items || []).length} line(s)`} />
            </ViewSection>

            {/* Line items table */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-lg bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] flex items-center justify-center shrink-0">
                  <Package className="h-3.5 w-3.5" />
                </span>
                <h3 className="text-sm font-bold text-[var(--mc-text-primary)]">Line Items</h3>
                <div className="flex-1 h-px bg-[var(--mc-divider)]" />
              </div>
              {viewLoading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Loading line items…</p>
              ) : (viewing.items || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No line items on this quotation.</p>
              ) : (
                <div className="rounded-xl border overflow-x-auto bg-white">
                  <table className="mc-table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>#</th>
                        <th>Item</th>
                        <th>Type</th>
                        <th style={{ textAlign: 'center' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Unit Price</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewing.items.map((it, i) => (
                        <tr key={it.id || i}>
                          <td className="text-muted-foreground">{i + 1}</td>
                          <td className="font-semibold text-[var(--mc-text-primary)]">{it.itemName}</td>
                          <td><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]">{it.itemType}</span></td>
                          <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                          <td style={{ textAlign: 'right' }}>{kes(it.unitPrice)}</td>
                          <td style={{ textAlign: 'right' }} className="font-semibold">{kes(it.totalPrice)}</td>
                          <td className="text-xs text-muted-foreground">{it.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 rounded-xl border bg-white p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-semibold">{kes(viewing.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-semibold text-red-600">- {kes(viewing.discountAmount)}</span></div>
                {viewing.taxAmount > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-semibold">{kes(viewing.taxAmount)}</span></div>
                )}
                <div className="flex justify-between border-t pt-1"><span className="font-bold">Total</span><span className="font-bold text-[var(--mc-primary-dark)]">{kes(viewing.totalAmount)}</span></div>
              </div>
            </div>

            {viewing.notes && (
              <ViewSection icon={<AlignLeft className="h-3.5 w-3.5" />} title="Notes">
                <ViewField icon={<AlignLeft className="h-3.5 w-3.5" />} label="Quotation Notes" value={viewing.notes} className="sm:col-span-2" />
              </ViewSection>
            )}
          </div>
        )}
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete Quotation"
        message={deleting ? `Delete quotation ${deleting.quotationNo} (${kes(deleting.totalAmount)})? Converted quotations cannot be deleted.` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
