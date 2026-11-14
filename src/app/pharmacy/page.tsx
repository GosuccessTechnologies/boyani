'use client';

/**
 * PHARMACY DISPENSING POS — Instruction 17 premium overhaul.
 *
 *  Ming-blue band : protruded royal-blue gradient band under the portal POS
 *                   header — live clock, date + search hint (white text).
 *  Left/main pane : drug catalog browser (search + category chips + premium
 *                   card grid with alternating light tints; click card adds to
 *                   cart, Eye opens the full drug detail modal).
 *  Right pane     : sticky cart (~380px) — walk-in vs registered patient
 *                   (bill-to-visit toggle), "Load Prescriptions" panel for the
 *                   selected patient, cart lines w/ qty steppers, discount,
 *                   totals, cash change calculator, Complete Sale /
 *                   Complete Dispense (billToVisit → invoice at cashier).
 *  Top strip      : today's KPIs (PERSONAL for pharmacist, FACILITY for admin)
 *                   + POS nav pills.
 *
 * Supports ?prescription=<id> — arrives from the Prescriptions queue with the
 * cart pre-loaded (qty = quantity - dispensedQty) and the patient pre-selected.
 */

import * as React from 'react';
import {
  Search, Pill, Plus, Minus, Trash2, ShoppingCart, UserRound, UserRoundSearch, Phone,
  BadgePercent, Banknote, ReceiptText, Loader2, X, Stethoscope, Eye, Info, Package,
  MapPin, Building2, ShieldAlert, ClipboardList, AlertTriangle, CreditCard, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/client-api';
import { useAuthStore } from '@/stores/auth-store';
import {
  kes, fmtDate, pname, PosNav, StatusBadge, StockBadge, MethodBadge, McInput, McSelect,
} from '@/app/pos/_lib';
import { SaleReceiptModal, type Sale } from './_sale-receipt';
import { PharmacyHeroHeader } from './_hero-header';

// ── API shapes (src/app/api/pharmacy-pos/route.ts) ──
interface Drug {
  id: string; code: string; name: string; genericName: string; category: string;
  dosageForm: string; strength: string; unit: string; stock: number; reorderLevel: number;
  unitPrice: number; unitCost: number; expiryDate: string | null; batchNumber: string;
  supplier: string; rackLocation: string; counterShelf: string;
  isControlled: boolean; notes: string;
}
interface TodayKpis { totalRevenue: number; totalSales: number; totalItems: number; scope: 'PERSONAL' | 'FACILITY'; }
interface PatientLite {
  id: string; patientNo: string; firstName: string; lastName: string; phone: string;
  paymentMode?: string;
}
interface RxItem {
  id: string; drugId?: string | null; drugName: string; dosage: string; frequency?: string;
  duration?: string; quantity: number; dispensedQty: number; unitPrice: number;
  drug?: { id: string; name: string; stock: number; unitPrice: number; code: string } | null;
}
interface Rx {
  id: string; prescriptionNo: string; patientId: string; doctorId: string; status: string;
  createdAt: string; visitId?: string | null;
  patient?: { patientNo: string; firstName: string; lastName: string; phone: string } | null;
  items: RxItem[];
}
interface ActiveVisit { id: string; visitNo: string; status: string; visitDate: string; visitType: string }
interface CartLine {
  drugId: string; name: string; strength: string; unitPrice: number; qty: number;
  stock: number; dosageInstruction?: string;
}

const NAV = [
  { label: 'Dispensing', href: '/pharmacy', icon: <Pill className="h-3.5 w-3.5" /> },
  { label: 'Prescriptions', href: '/pharmacy/prescriptions', icon: <ReceiptText className="h-3.5 w-3.5" /> },
  { label: 'Sales History', href: '/pharmacy/sales', icon: <Stethoscope className="h-3.5 w-3.5" /> },
];

/** Alternating light card tints for the premium drug grid (Instruction 17). */
const CARD_TINTS = ['#EFF6FF', '#FFFBEB', '#F0FDF4', '#FEF2F2', '#F5F3FF'];

function KpiChip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mc-divider)] bg-white px-2.5 py-1 text-[11px] whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>
      <b className="text-[var(--mc-text-primary)]">{value}</b>
    </span>
  );
}

/** Small label/value row used inside the drug detail modal. */
function DetailRow({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 border-b border-dashed border-[var(--mc-divider)] last:border-0">
      <span className="text-[11px] font-semibold text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right text-[12px] ${strong ? 'font-bold text-[var(--mc-text-primary)]' : 'font-medium text-[var(--mc-text-primary)]'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

/** Titled section card used inside the drug detail modal. */
function DetailSection({ icon, title, children, tint }: { icon: React.ReactNode; title: string; children: React.ReactNode; tint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--mc-divider)] overflow-hidden" style={tint ? { backgroundColor: tint } : undefined}>
      <div className="px-3 py-2 border-b border-[var(--mc-divider)] bg-white/60 flex items-center gap-1.5">
        <span className="text-[var(--mc-primary)]">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--mc-text-secondary)]">{title}</span>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

export default function PharmacyPosPage() {
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'ADMIN';

  // ── catalog ──
  const [drugs, setDrugs] = React.useState<Drug[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [loadingDrugs, setLoadingDrugs] = React.useState(true);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [viewDrug, setViewDrug] = React.useState<Drug | null>(null);

  // ── today KPIs ──
  const [kpis, setKpis] = React.useState<TodayKpis | null>(null);

  // ── cart & customer ──
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [customerMode, setCustomerMode] = React.useState<'walkin' | 'registered'>('walkin');
  const [walkinName, setWalkinName] = React.useState('');
  const [walkinPhone, setWalkinPhone] = React.useState('');
  const [patientQuery, setPatientQuery] = React.useState('');
  const [patients, setPatients] = React.useState<PatientLite[]>([]);
  const [searchingPatients, setSearchingPatients] = React.useState(false);
  const [patient, setPatient] = React.useState<PatientLite | null>(null);
  const [billToVisit, setBillToVisit] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState('CASH');
  const [discount, setDiscount] = React.useState('');
  const [tendered, setTendered] = React.useState('');
  const [prescription, setPrescription] = React.useState<Rx | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // ── active POS payment methods (Instruction 28 — payments-integration) ──
  const [payMethods, setPayMethods] = React.useState<{ cash: boolean; mpesa: boolean; pesapal: boolean; activeMethod: string } | null>(null);
  // PesaPal card checkout flow (walk-in card payment)
  const [cardStarting, setCardStarting] = React.useState(false);
  const [cardAwaiting, setCardAwaiting] = React.useState<{ orderRef: string } | null>(null);

  // ── registered patient context: pending prescriptions + active visit ──
  const [patientRxs, setPatientRxs] = React.useState<Rx[]>([]);
  const [loadingRxs, setLoadingRxs] = React.useState(false);
  const [activeVisit, setActiveVisit] = React.useState<ActiveVisit | null>(null);

  // ── receipt (invoice mode when billed to visit) ──
  const [receipt, setReceipt] = React.useState<Sale | null>(null);
  const [receiptInvoice, setReceiptInvoice] = React.useState(false);
  const [receiptTender, setReceiptTender] = React.useState<{ tendered?: number; change?: number }>({});

  // ── debounced catalog search ──
  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadDrugs = React.useCallback(async () => {
    setLoadingDrugs(true);
    try {
      const params = new URLSearchParams({ section: 'drugs' });
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      const res = await apiGet<{ drugs: Drug[]; categories: string[] }>(`/api/pharmacy-pos?${params}`);
      setDrugs(res.drugs);
      setCategories(res.categories);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load drug catalog');
    } finally {
      setLoadingDrugs(false);
    }
  }, [search, category]);

  const loadKpis = React.useCallback(async () => {
    try {
      setKpis(await apiGet<TodayKpis>('/api/pharmacy-pos?section=today-sales'));
    } catch { /* silent — KPI strip is non-critical */ }
  }, []);

  React.useEffect(() => { loadDrugs(); }, [loadDrugs]);
  React.useEffect(() => { loadKpis(); }, [loadKpis]);

  // ── POS-activated payment methods (Instruction 28) ──
  React.useEffect(() => {
    apiGet<{ cash: boolean; mpesa: boolean; pesapal: boolean; activeMethod: string }>('/api/payments-integration?status=public')
      .then(res => setPayMethods({ cash: res.cash, mpesa: res.mpesa, pesapal: res.pesapal, activeMethod: res.activeMethod }))
      .catch(() => { /* integrations unavailable — stays cash-only */ });
  }, []);
  const methodOptions = React.useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    if (!payMethods || payMethods.cash) opts.push({ value: 'CASH', label: 'Cash' });
    if (payMethods?.mpesa) opts.push({ value: 'MPESA', label: 'M-PESA' });
    // manual Card option only where card isn't handled by the PesaPal integration
    if (!payMethods || (!payMethods.pesapal && payMethods.activeMethod === 'BOTH')) opts.push({ value: 'CARD', label: 'Card' });
    return opts;
  }, [payMethods]);
  const pesapalAvailable = !!payMethods?.pesapal;

  React.useEffect(() => {
    if (!payMethods) return;
    if (methodOptions.length && !methodOptions.some(o => o.value === paymentMethod)) {
      setPaymentMethod(methodOptions[0].value);
    }
  }, [payMethods, methodOptions, paymentMethod]);

  // ── patient search (debounced, registered mode) ──
  React.useEffect(() => {
    if (customerMode !== 'registered' || patient) return;
    const q = patientQuery.trim();
    if (q.length < 2) { setPatients([]); return; }
    setSearchingPatients(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiGet<{ patients: PatientLite[] }>(`/api/patients?search=${encodeURIComponent(q)}&perPage=10`);
        setPatients(res.patients);
      } catch {
        setPatients([]);
      } finally {
        setSearchingPatients(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [patientQuery, customerMode, patient]);

  // ── registered patient context: pending prescriptions + active visit ──
  React.useEffect(() => {
    if (customerMode !== 'registered' || !patient) {
      setPatientRxs([]);
      setActiveVisit(null);
      return;
    }
    let cancelled = false;
    setLoadingRxs(true);
    (async () => {
      try {
        const res = await apiGet<{ prescriptions: Rx[] }>(
          `/api/pharmacy-pos?section=prescriptions&patientId=${encodeURIComponent(patient.id)}`
        );
        if (!cancelled) setPatientRxs(res.prescriptions);
      } catch {
        if (!cancelled) setPatientRxs([]);
      } finally {
        if (!cancelled) setLoadingRxs(false);
      }
    })();
    (async () => {
      try {
        const res = await apiGet<{ visit: ActiveVisit | null }>(
          `/api/pharmacy-pos?section=patient-visit&patientId=${encodeURIComponent(patient.id)}`
        );
        if (!cancelled) setActiveVisit(res.visit || null);
      } catch {
        if (!cancelled) setActiveVisit(null);
      }
    })();
    return () => { cancelled = true; };
  }, [customerMode, patient]);

  // ── load a prescription's remaining quantities into the cart ──
  const loadRxIntoCart = (rx: Rx) => {
    const lines: CartLine[] = [];
    for (const item of rx.items) {
      const remaining = Math.max(0, (item.quantity || 0) - (item.dispensedQty || 0));
      if (remaining <= 0) continue;
      const price = item.drug?.unitPrice ?? item.unitPrice ?? 0;
      lines.push({
        drugId: item.drugId || item.drug?.id || '',
        name: item.drugName || item.drug?.name || 'Drug',
        strength: item.dosage || '',
        unitPrice: price,
        qty: remaining,
        stock: item.drug?.stock ?? remaining,
        dosageInstruction: [item.dosage, item.frequency, item.duration].filter(Boolean).join(' · '),
      });
    }
    setPrescription(rx);
    setBillToVisit(true); // registered patient default: pay at cashier
    if (!lines.length) {
      setCart([]);
      toast.info('All items on this prescription are already dispensed');
      return;
    }
    setCart(lines);
    toast.success(`Prescription ${rx.prescriptionNo} loaded — ${lines.length} item(s) to dispense`);
  };

  // ── prescription pre-load (?prescription=<id> from the queue page) ──
  React.useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get('prescription');
    if (!pid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ prescriptions: Rx[] }>('/api/pharmacy-pos?section=prescriptions');
        const rx = res.prescriptions.find(x => x.id === pid);
        if (cancelled) return;
        if (!rx) { toast.error('Prescription not found or already dispensed'); return; }
        setCustomerMode('registered');
        setPatient(rx.patientId && rx.patient ? {
          id: rx.patientId,
          patientNo: rx.patient.patientNo,
          firstName: rx.patient.firstName,
          lastName: rx.patient.lastName,
          phone: rx.patient.phone,
        } : null);
        loadRxIntoCart(rx);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load prescription');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── cart operations ──
  const addToCart = (drug: Drug) => {
    setCart(prev => {
      const existing = prev.find(l => l.drugId === drug.id);
      if (existing) {
        if (existing.qty >= drug.stock) {
          toast.error(`Only ${drug.stock} unit(s) of ${drug.name} in stock`);
          return prev;
        }
        return prev.map(l => l.drugId === drug.id ? { ...l, qty: l.qty + 1 } : l);
      }
      if (drug.stock <= 0) { toast.error(`${drug.name} is out of stock`); return prev; }
      return [...prev, {
        drugId: drug.id, name: drug.name, strength: drug.strength || '',
        unitPrice: drug.unitPrice, qty: 1, stock: drug.stock,
      }];
    });
  };

  const changeQty = (drugId: string, delta: number) => {
    setCart(prev => prev.map(l => {
      if (l.drugId !== drugId) return l;
      const next = l.qty + delta;
      if (next < 1) return l;
      if (next > l.stock) { toast.error(`Only ${l.stock} unit(s) in stock`); return l; }
      return { ...l, qty: next };
    }));
  };

  const removeLine = (drugId: string) => setCart(prev => prev.filter(l => l.drugId !== drugId));

  const clearCart = () => {
    setCart([]);
    setDiscount('');
    setTendered('');
    setPrescription(null);
    if (window.history.replaceState) window.history.replaceState({}, '', '/pharmacy');
  };

  // ── PesaPal card checkout (Instruction 28 — walk-in card payment) ──
  const startCardCheckout = async () => {
    if (!cart.length || total <= 0) return;
    setCardStarting(true);
    try {
      const name = customerMode === 'registered' && patient
        ? pname(patient)
        : (walkinName.trim() || 'Walk-in Customer');
      const phone = customerMode === 'registered' && patient
        ? (patient.phone || '')
        : walkinPhone.trim();
      const nameParts = name.split(/\s+/);
      const res = await apiPost<{ orderRef: string; redirectUrl: string }>('/api/payments-integration', {
        action: 'pesapal-submit-order',
        amount: Math.round(total * 100) / 100,
        phone,
        description: `Pharmacy sale — ${cart.slice(0, 3).map(l => l.name).join(', ')}${cart.length > 3 ? ` +${cart.length - 3} more` : ''}`,
        callbackUrl: `${window.location.origin}/pharmacy`,
        firstName: nameParts[0] || 'Walk-in',
        lastName: nameParts.slice(1).join(' ') || 'Customer',
      });
      window.open(res.redirectUrl, '_blank', 'noopener');
      setCardAwaiting({ orderRef: res.orderRef });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Card checkout failed to start');
    } finally {
      setCardStarting(false);
    }
  };

  // ── totals ──
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discountNum = Math.min(Math.max(parseFloat(discount) || 0, 0), subtotal);
  const total = Math.max(0, subtotal - discountNum);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  // ── cash change calculator (walk-in / pay-at-counter, CASH) ──
  const isBilled = billToVisit && customerMode === 'registered' && !!patient;
  const tenderedNum = parseFloat(tendered) || 0;
  const showCalc = !isBilled && paymentMethod === 'CASH';
  const changeDue = tenderedNum - total;
  const insufficient = showCalc && tendered.trim() !== '' && changeDue < 0;

  const clearCustomer = () => {
    setPatient(null); setPatientQuery(''); setPatients([]); setBillToVisit(false);
    setPatientRxs([]); setActiveVisit(null);
  };

  // ── complete sale / complete dispense ──
  const completeSale = async (methodOverride?: string, notesExtra?: string) => {
    if (!cart.length) { toast.error('Cart is empty — click drug cards to add items'); return; }
    if (cart.some(l => l.qty > l.stock)) { toast.error('Some lines exceed available stock — adjust quantities'); return; }
    if (customerMode === 'registered' && !patient) { toast.error('Search and select the patient first'); return; }
    if (total <= 0) { toast.error('Total amount must be greater than 0'); return; }
    if (insufficient) { toast.error(`Amount tendered is short by ${kes(-changeDue)}`); return; }

    setSubmitting(true);
    try {
      const res = await apiPost<{ success: boolean; sale: Sale }>('/api/pharmacy-pos', {
        items: cart.map(l => ({
          drugId: l.drugId, drugName: l.name, quantity: l.qty,
          dosageInstruction: l.dosageInstruction || '',
        })),
        patientId: customerMode === 'registered' && patient ? patient.id : undefined,
        patientName: customerMode === 'registered' && patient
          ? pname(patient)
          : (walkinName.trim() || 'Walk-in Customer'),
        patientPhone: customerMode === 'registered' && patient
          ? patient.phone || ''
          : walkinPhone.trim(),
        paymentMethod: isBilled ? 'BILLED_TO_VISIT' : (methodOverride || paymentMethod),
        discount: discountNum,
        billToVisit: isBilled,
        // link the sale to the patient's active visit for cashier collection
        visitId: isBilled ? (prescription?.visitId || activeVisit?.id || '') : undefined,
        prescriptionId: prescription?.id || undefined,
        // payment-integration reference (e.g. PesaPal order ref — Instruction 28)
        notes: notesExtra || undefined,
      });
      if (isBilled) {
        toast.success(`Dispense ${res.sale.saleNo} recorded — ${kes(res.sale.totalAmount)} billed to the visit for cashier collection`);
      } else {
        toast.success(`Sale ${res.sale.saleNo} completed — ${kes(res.sale.totalAmount)}`);
      }
      setReceipt(res.sale);
      setReceiptInvoice(isBilled);
      setReceiptTender(
        !isBilled && paymentMethod === 'CASH' && tendered.trim() !== ''
          ? { tendered: tenderedNum, change: changeDue }
          : {}
      );
      setCart([]); setDiscount(''); setTendered(''); setPrescription(null);
      clearCustomer();
      setCustomerMode('walkin'); setWalkinName(''); setWalkinPhone('');
      setPaymentMethod(methodOptions[0]?.value || 'CASH');
      if (window.history.replaceState) window.history.replaceState({}, '', '/pharmacy');
      await Promise.all([loadDrugs(), loadKpis()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to complete sale');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lg:h-full lg:flex lg:flex-col min-h-0">
      {/* ── Full-width flat hero header — replaces topbar + old rounded band ── */}
      <PharmacyHeroHeader
        icon={<Pill className="h-5 w-5" />}
        title="Pharmacy POS"
        description="Search drugs by name, generic or code — click a card to add it to the dispensing cart"
      />

      {/* ── Top strip: nav + today's KPIs ── */}
      <div className="shrink-0 border-b border-[var(--mc-divider)] bg-[var(--mc-bg-card)] px-3 pt-2 pb-2 no-print">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PosNav items={NAV} />
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-1.5">
            {kpis ? (
              <>
                <KpiChip label="Today" value={kes(kpis.totalRevenue)} />
                <KpiChip label="Sales" value={kpis.totalSales} />
                <KpiChip label="Items" value={kpis.totalItems} />
                <StatusBadge status={kpis.scope} />
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground">Loading today&apos;s takings…</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body: catalog + cart split ── */}
      <div className="lg:flex-1 lg:min-h-0 flex flex-col lg:flex-row">
        {/* Catalog pane */}
        <section className="flex-1 min-w-0 p-3 space-y-3 lg:overflow-y-auto">
          {/* prescription banner */}
          {prescription && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 flex items-start gap-2.5">
              <ReceiptText className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1 text-xs text-amber-800">
                <b>Dispensing prescription {prescription.prescriptionNo}</b> for {pname(prescription.patient)} —
                completing this sale marks the prescription dispensed.
                <button
                  className="ml-2 underline font-semibold hover:text-amber-900"
                  onClick={() => { setPrescription(null); if (window.history.replaceState) window.history.replaceState({}, '', '/pharmacy'); }}
                >
                  clear
                </button>
              </div>
              <X className="h-4 w-4 text-amber-600 shrink-0 cursor-pointer" onClick={() => setPrescription(null)} />
            </div>
          )}

          {/* search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <McInput
              className="pl-8"
              placeholder="Search drugs by name, generic or code…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
            {loadingDrugs && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-[var(--mc-primary)]" />}
          </div>

          {/* category chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
                !category ? 'bg-[var(--mc-primary)] text-white border-transparent' : 'bg-white text-[var(--mc-text-secondary)] hover:bg-[var(--mc-primary-light)]'
              }`}
              onClick={() => setCategory('')}
            >
              All categories
            </button>
            {categories.map(c => (
              <button
                key={c}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  category === c ? 'bg-[var(--mc-primary)] text-white border-transparent' : 'bg-white text-[var(--mc-text-secondary)] hover:bg-[var(--mc-primary-light)]'
                }`}
                onClick={() => setCategory(category === c ? '' : c)}
              >
                {c}
              </button>
            ))}
          </div>

          {/* drug grid — premium cards with alternating light tints */}
          {loadingDrugs ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-36 rounded-2xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] animate-pulse" />
              ))}
            </div>
          ) : drugs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--mc-divider)] p-10 text-center text-sm text-muted-foreground">
              No drugs match the current search / category filter.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {drugs.map((d, i) => {
                const expired = d.expiryDate ? new Date(d.expiryDate).getTime() < Date.now() : false;
                const expiringSoon = !expired && d.expiryDate
                  ? new Date(d.expiryDate).getTime() < Date.now() + 90 * 864e5
                  : false;
                return (
                  <div
                    key={d.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => addToCart(d)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addToCart(d); } }}
                    className="group text-left rounded-2xl border border-[var(--mc-divider)] p-3 flex flex-col gap-1.5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-10px_rgba(2,6,23,0.3)] hover:border-[var(--mc-primary)]"
                    style={{ backgroundColor: CARD_TINTS[i % CARD_TINTS.length] }}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="text-[13px] font-bold leading-tight text-slate-900">
                        {d.name}
                        {d.strength && <span className="font-semibold text-slate-600"> {d.strength}</span>}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title="View drug details"
                          aria-label={`View details for ${d.name}`}
                          className="h-6 w-6 rounded-full bg-white/80 border border-[var(--mc-divider)] text-slate-500 hover:text-[var(--mc-primary)] hover:border-[var(--mc-primary)] flex items-center justify-center transition-colors"
                          onClick={e => { e.stopPropagation(); setViewDrug(d); }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <span className="h-6 w-6 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] flex items-center justify-center group-hover:bg-[var(--mc-primary)] group-hover:text-white transition-colors">
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate">
                      {d.dosageForm}{d.genericName ? ` · ${d.genericName}` : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/70 border border-slate-200 text-[10px] font-semibold text-slate-600">
                        {d.category}
                      </span>
                      {d.isControlled && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-100 border border-red-200 text-[10px] font-bold text-red-700">
                          <ShieldAlert className="h-3 w-3" /> Controlled
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1.5 mt-auto pt-0.5">
                      <StockBadge stock={d.stock} />
                      <span className="text-[14px] font-extrabold text-slate-900 whitespace-nowrap">{kes(d.unitPrice)}</span>
                    </div>
                    {expired && (
                      <p className="text-[10px] font-bold text-red-700 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> EXPIRED {fmtDate(d.expiryDate)}
                      </p>
                    )}
                    {!expired && expiringSoon && (
                      <p className="text-[10px] font-semibold text-red-600">Expires {fmtDate(d.expiryDate)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Cart pane */}
        <aside className="lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--mc-divider)] bg-white flex flex-col lg:min-h-0 no-print">
          <div className="p-3 border-b border-[var(--mc-divider)] flex items-center gap-2 shrink-0">
            <ShoppingCart className="h-4 w-4 text-[var(--mc-primary)]" />
            <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Dispensing Cart</h2>
            <span className="text-[11px] rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] px-2 py-0.5 font-bold">
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </span>
            <div className="flex-1" />
            {cart.length > 0 && (
              <button className="text-[11px] text-red-600 hover:underline font-semibold" onClick={clearCart}>
                Clear
              </button>
            )}
          </div>

          <div className="p-3 space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
            {/* ── patient section ── */}
            <div className="rounded-xl border border-[var(--mc-divider)] overflow-hidden">
              <div className="grid grid-cols-2 text-[11px] font-bold">
                <button
                  className={`py-1.5 flex items-center justify-center gap-1 transition-colors ${
                    customerMode === 'walkin' ? 'bg-[var(--mc-primary)] text-white' : 'bg-[var(--mc-bg-card)] text-[var(--mc-text-secondary)]'
                  }`}
                  onClick={() => { setCustomerMode('walkin'); clearCustomer(); }}
                >
                  <UserRound className="h-3.5 w-3.5" /> Walk-in Customer
                </button>
                <button
                  className={`py-1.5 flex items-center justify-center gap-1 transition-colors ${
                    customerMode === 'registered' ? 'bg-[var(--mc-primary)] text-white' : 'bg-[var(--mc-bg-card)] text-[var(--mc-text-secondary)]'
                  }`}
                  onClick={() => { setCustomerMode('registered'); setWalkinName(''); setWalkinPhone(''); }}
                >
                  <UserRoundSearch className="h-3.5 w-3.5" /> Registered Patient
                </button>
              </div>

              <div className="p-2.5 space-y-2">
                {customerMode === 'walkin' ? (
                  <>
                    <div className="relative">
                    <UserRound className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <McInput className="pl-8" placeholder="Customer name (optional)" value={walkinName} onChange={e => setWalkinName(e.target.value)} />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <McInput className="pl-8" placeholder="Phone (optional)" value={walkinPhone} onChange={e => setWalkinPhone(e.target.value)} />
                    </div>
                  </>
                ) : patient ? (
                  <div className="rounded-lg border border-[var(--mc-primary)] bg-[var(--mc-primary-light)] p-2.5 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="text-sm text-[var(--mc-text-primary)]">{pname(patient)}</b>
                      <span className="text-[11px] text-muted-foreground">{patient.patientNo}</span>
                      {patient.paymentMode && <MethodBadge method={patient.paymentMode} />}
                    </div>
                    {patient.phone && <p className="text-[11px] text-muted-foreground">Tel: {patient.phone}</p>}
                    {activeVisit && (
                      <p className="text-[11px] text-[var(--mc-text-secondary)]">
                        Active visit <b>{activeVisit.visitNo}</b> · <StatusBadge status={activeVisit.status} />
                      </p>
                    )}
                    <button
                      className="text-[11px] text-[var(--mc-primary)] hover:underline font-semibold"
                      onClick={clearCustomer}
                    >
                      Change patient
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <UserRoundSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <McInput
                        className="pl-8"
                        placeholder="Search by name / patient No / phone…"
                        value={patientQuery}
                        onChange={e => setPatientQuery(e.target.value)}
                      />
                      {searchingPatients && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-[var(--mc-primary)]" />}
                    </div>
                    {patients.length > 0 && (
                      <div className="rounded-lg border border-[var(--mc-divider)] divide-y divide-[var(--mc-divider)] max-h-44 overflow-y-auto">
                        {patients.map(p => (
                          <button
                            key={p.id}
                            className="w-full text-left px-2.5 py-2 hover:bg-[var(--mc-primary-light)] transition-colors"
                            onClick={() => { setPatient(p); setPatients([]); setPatientQuery(''); setBillToVisit(true); }}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <b className="text-xs text-[var(--mc-text-primary)]">{pname(p)}</b>
                              <span className="text-[10px] text-muted-foreground">{p.patientNo}</span>
                              {p.paymentMode && <MethodBadge method={p.paymentMode} />}
                            </div>
                            {p.phone && <p className="text-[10px] text-muted-foreground">{p.phone}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                    {patientQuery.trim().length >= 2 && !searchingPatients && patients.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">No matching patients.</p>
                    )}
                  </>
                )}

                {/* bill-to-visit toggle (registered patient only) */}
                {customerMode === 'registered' && patient && (
                  <div className="grid grid-cols-2 gap-1 text-[11px] font-semibold">
                    <button
                      className={`px-2 py-1.5 rounded-lg border transition-colors ${
                        !billToVisit ? 'bg-[var(--mc-primary)] text-white border-transparent' : 'bg-white border-[var(--mc-divider)] text-[var(--mc-text-secondary)]'
                      }`}
                      onClick={() => setBillToVisit(false)}
                    >
                      Pay at counter
                    </button>
                    <button
                      className={`px-2 py-1.5 rounded-lg border transition-colors ${
                        billToVisit ? 'bg-[var(--mc-primary)] text-white border-transparent' : 'bg-white border-[var(--mc-divider)] text-[var(--mc-text-secondary)]'
                      }`}
                      onClick={() => setBillToVisit(true)}
                    >
                      Bill to visit
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── load prescriptions panel (registered patient) ── */}
            {customerMode === 'registered' && patient && (
              <div className="rounded-xl border border-[var(--mc-divider)] overflow-hidden">
                <div className="px-2.5 py-2 bg-[var(--mc-bg-card)] border-b border-[var(--mc-divider)] flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
                  <span className="text-[11px] font-bold text-[var(--mc-text-primary)]">Load Prescriptions</span>
                  {loadingRxs && <Loader2 className="h-3 w-3 animate-spin text-[var(--mc-primary)]" />}
                  <div className="flex-1" />
                  <span className="text-[10px] text-muted-foreground">
                    {patientRxs.length} pending
                  </span>
                </div>
                {patientRxs.length === 0 ? (
                  <p className="px-2.5 py-2.5 text-[11px] text-muted-foreground">
                    {loadingRxs ? 'Loading prescriptions…' : 'No pending prescriptions for this patient.'}
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--mc-divider)] max-h-56 overflow-y-auto">
                    {patientRxs.map(rx => {
                      const remainingUnits = rx.items.reduce((s, i) => s + Math.max(0, (i.quantity || 0) - (i.dispensedQty || 0)), 0);
                      return (
                        <button
                          key={rx.id}
                          className="w-full text-left px-2.5 py-2 hover:bg-[var(--mc-primary-light)] transition-colors"
                          onClick={() => loadRxIntoCart(rx)}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <b className="text-[11px] text-[var(--mc-text-primary)]">{rx.prescriptionNo}</b>
                            <StatusBadge status={rx.status} />
                            <span className="text-[10px] text-muted-foreground">{fmtDate(rx.createdAt)}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {rx.items.length} item(s) · {remainingUnits} unit(s) remaining — click to load into cart
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── cart lines ── */}
            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--mc-divider)] p-6 text-center text-xs text-muted-foreground">
                Cart is empty — click a drug card to add it.
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(l => (
                  <div key={l.drugId} className="rounded-xl border border-[var(--mc-divider)] p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[var(--mc-text-primary)] leading-tight truncate">
                          {l.name}{l.strength ? ` ${l.strength}` : ''}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{kes(l.unitPrice)} each</p>
                        {l.dosageInstruction && <p className="text-[10px] text-[var(--mc-text-secondary)]">{l.dosageInstruction}</p>}
                        {l.qty > l.stock && <p className="text-[10px] text-red-600 font-semibold">Exceeds stock ({l.stock})</p>}
                      </div>
                      <button
                        className="text-red-500 hover:text-red-600 p-1 shrink-0"
                        title="Remove line"
                        onClick={() => removeLine(l.drugId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          className="h-7 w-7 rounded-lg border border-[var(--mc-divider)] flex items-center justify-center hover:bg-[var(--mc-primary-light)] disabled:opacity-40"
                          disabled={l.qty <= 1}
                          onClick={() => changeQty(l.drugId, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-10 text-center text-sm font-bold">{l.qty}</span>
                        <button
                          className="h-7 w-7 rounded-lg border border-[var(--mc-divider)] flex items-center justify-center hover:bg-[var(--mc-primary-light)] disabled:opacity-40"
                          disabled={l.qty >= l.stock}
                          onClick={() => changeQty(l.drugId, +1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-extrabold text-[var(--mc-text-primary)]">{kes(l.unitPrice * l.qty)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── discount + totals ── */}
            <div className="space-y-2">
              <div className="relative">
                <BadgePercent className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <McInput
                  className="pl-8"
                  type="number" min={0} step="0.01"
                  placeholder="Discount (KSh)"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                />
              </div>
              <div className="rounded-xl bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{kes(subtotal)}</span></div>
                {discountNum > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-600">- {kes(discountNum)}</span></div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-[var(--mc-divider)]">
                  <span className="font-extrabold text-base">TOTAL</span>
                  <span className="font-extrabold text-xl text-[var(--mc-primary)]">{kes(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── payment + submit (sticky footer of the pane) ── */}
          <div className="p-3 border-t border-[var(--mc-divider)] space-y-2.5 shrink-0 bg-white">
            {!isBilled && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-[var(--mc-primary)] shrink-0" />
                  <McSelect
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                    options={methodOptions}
                    placeholder="Payment method"
                  />
                </div>
                {/* PesaPal card checkout (Instruction 28) */}
                {pesapalAvailable && (
                  <div className="space-y-1.5">
                    <Button
                      type="button" variant="outline"
                      className="w-full h-10 gap-1.5 border-indigo-300 text-indigo-800 hover:bg-indigo-50"
                      disabled={cardStarting || !cart.length || total <= 0}
                      onClick={startCardCheckout}
                    >
                      {cardStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      {cardStarting ? 'Opening card page…' : 'Pay by Card (PesaPal)'}
                      {!cardStarting && <ExternalLink className="h-3 w-3 opacity-60" />}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Opens the secure PesaPal card page in a new window — Visa / Mastercard.
                    </p>
                  </div>
                )}
                {/* cash change calculator */}
                {showCalc && (
                  <div className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-2.5 space-y-2">
                    <label className="text-[11px] font-bold text-[var(--mc-text-secondary)] flex items-center gap-1.5">
                      <Banknote className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> Amount Tendered (KSh)
                    </label>
                    <McInput
                      type="number" min={0} step="0.01"
                      placeholder="Cash received from the customer…"
                      value={tendered}
                      onChange={e => setTendered(e.target.value)}
                    />
                    {tendered.trim() !== '' && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-dashed border-[var(--mc-divider)]">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {insufficient ? 'Change (insufficient!)' : 'Change due'}
                        </span>
                        {insufficient ? (
                          <b className="text-lg font-extrabold text-red-600">-{kes(-changeDue)}</b>
                        ) : (
                          <b className="text-lg font-extrabold text-emerald-700">{kes(changeDue)}</b>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {isBilled && (
              <p className="text-[11px] text-[var(--mc-text-secondary)] bg-[var(--mc-primary-light)] rounded-lg px-2.5 py-1.5">
                Billed to {activeVisit ? `visit ${activeVisit.visitNo}` : 'patient visit'} — the patient pays at the cashier desk.
              </p>
            )}
            <Button
              className="w-full h-12 text-base font-extrabold mc-gradient-primary text-white"
              disabled={!cart.length || submitting}
              onClick={() => completeSale()}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ReceiptText className="h-5 w-5" />}
              {submitting ? 'Processing…' : isBilled ? 'Complete Dispense' : 'Complete Sale'}
            </Button>
          </div>
        </aside>
      </div>

      {/* ── drug detail modal (Eye on card) ── */}
      <PremiumModal
        open={!!viewDrug}
        onOpenChange={o => !o && setViewDrug(null)}
        size="lg"
        title="Drug Details"
        icon={<Pill className="h-5 w-5" />}
        description={viewDrug ? `${viewDrug.name}${viewDrug.strength ? ` ${viewDrug.strength}` : ''} · ${viewDrug.code}` : ''}
        footerNote="Full inventory record — stock levels update live"
      >
        {viewDrug && (
          <div className="space-y-3">
            {/* identity */}
            <DetailSection icon={<Info className="h-4 w-4" />} title="Identity">
              <DetailRow label="Brand name" value={viewDrug.name} strong />
              <DetailRow label="Generic name" value={viewDrug.genericName} />
              <DetailRow label="Code" value={viewDrug.code} />
              <DetailRow label="Category" value={viewDrug.category} />
              <DetailRow label="Dosage form" value={viewDrug.dosageForm} />
              <DetailRow label="Strength" value={viewDrug.strength} />
              <DetailRow label="Unit" value={viewDrug.unit} />
            </DetailSection>

            {/* pricing */}
            <DetailSection icon={<Banknote className="h-4 w-4" />} title="Pricing" tint="#EFF6FF">
              <DetailRow label="Unit price (selling)" value={kes(viewDrug.unitPrice)} strong />
              <DetailRow
                label="Unit cost (buying)"
                value={isAdmin ? kes(viewDrug.unitCost) : 'Restricted — ADMIN only'}
              />
            </DetailSection>

            {/* stock */}
            <DetailSection icon={<Package className="h-4 w-4" />} title="Stock" tint={viewDrug.stock <= viewDrug.reorderLevel ? '#FEF2F2' : '#F0FDF4'}>
              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] font-semibold text-muted-foreground">On hand</span>
                <StockBadge stock={viewDrug.stock} />
              </div>
              <DetailRow label="Reorder level" value={`${viewDrug.reorderLevel} unit(s)`} />
              <DetailRow label="Batch number" value={viewDrug.batchNumber} />
              <DetailRow
                label="Expiry date"
                value={
                  viewDrug.expiryDate
                    ? <span className={new Date(viewDrug.expiryDate).getTime() < Date.now() ? 'text-red-600 font-bold' : ''}>
                        {fmtDate(viewDrug.expiryDate)}
                      </span>
                    : '—'
                }
              />
            </DetailSection>

            {/* location — counterShelf prominent */}
            <DetailSection icon={<MapPin className="h-4 w-4" />} title="Location">
              <div className="rounded-xl border-2 border-dashed border-[var(--mc-primary)] bg-[var(--mc-primary-light)] p-3 text-center mb-2">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--mc-primary-dark)]">Counter Shelf</p>
                <p className="text-xl font-extrabold text-[var(--mc-text-primary)] leading-tight">
                  {viewDrug.counterShelf || '—'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">retrieve from the dispensing counter</p>
              </div>
              <DetailRow label="Rack location (store)" value={viewDrug.rackLocation} />
            </DetailSection>

            {/* supplier + flags */}
            <DetailSection icon={<Building2 className="h-4 w-4" />} title="Supplier & Notes">
              <DetailRow label="Supplier" value={viewDrug.supplier} />
              <DetailRow
                label="Controlled substance"
                value={viewDrug.isControlled
                  ? <span className="text-red-600 font-bold">⚠ Yes — extra care when dispensing</span>
                  : 'No'}
              />
              <DetailRow label="Notes" value={viewDrug.notes} />
            </DetailSection>
          </div>
        )}
      </PremiumModal>

      {/* ── awaiting card payment modal (PesaPal — Instruction 28) ── */}
      <PremiumModal
        open={!!cardAwaiting}
        onOpenChange={o => { if (!o && !submitting) setCardAwaiting(null); }}
        size="sm"
        title="Awaiting card payment…"
        icon={<CreditCard className="h-5 w-5" />}
        description={cardAwaiting ? `PesaPal order ${cardAwaiting.orderRef}` : ''}
        submitLabel={submitting ? 'Processing…' : 'Payment Completed'}
        onSubmit={() => {
          const ref = cardAwaiting?.orderRef || '';
          setCardAwaiting(null);
          completeSale('CARD', `PesaPal card — ref ${ref}`);
        }}
        secondaryLabel="Cancel"
        submitting={submitting}
        footerNote="The secure card page opened in a new window — click Payment Completed once the customer finishes"
      >
        <div className="space-y-3 text-center py-2">
          <Loader2 className="h-10 w-10 mx-auto text-indigo-600 animate-spin" />
          <p className="text-sm font-bold text-[var(--mc-text-primary)]">Waiting for the card payment…</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The customer completes the card details on the PesaPal page that opened in a new window.
            Once it confirms success, click <b>Payment Completed</b> — the sale is recorded as{' '}
            <b>CARD</b> with the PesaPal reference.
          </p>
        </div>
      </PremiumModal>

      {/* receipt / invoice modal */}
      <SaleReceiptModal
        sale={receipt}
        onOpenChange={o => !o && setReceipt(null)}
        mode={receiptInvoice ? 'invoice' : 'receipt'}
        tendered={receiptTender.tendered}
        change={receiptTender.change}
      />
    </div>
  );
}
