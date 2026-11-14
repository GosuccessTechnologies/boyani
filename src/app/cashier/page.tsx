'use client';

/**
 * CASHIER POS — THE COLLECTIONS HEART. (Instruction 22 premium overhaul)
 *
 * Retrieves ALL services offered to patients from ALL departments (visit
 * charges: clinical services + consultation + laboratory + pharmacy — both
 * pending prescriptions AND BILLED pharmacy sales — + admission beds) and
 * collects payment (CASH / MPESA / CARD / SHA / MIXED).
 *
 *  Cards     : premium payment-collection cards (gradient-tinted avatar +
 *              left border, item-type chips, SHA vs cash split, bold total,
 *              gradient Collect button + Eye charge-detail modal).
 *              Responsive: 3 columns xl / 2 md / 1 mobile.
 *  Collect   : full charge table (checkbox per line, pre-checked), live
 *              subtotal, discount, payment-mode tabs (MIXED → cash + SHA
 *              split + claim ref), notes → POST /api/pos checkout.
 *  Receipt   : bill receipt modal (billNo, receiptNo, items with departments,
 *              totals) + printable (A4/A5 per printer settings).
 *  Top strip : KPIs from /api/dashboard?portal=cashier.
 */

import * as React from 'react';
import {
  Search, Loader2, RefreshCw, Coins, History, Calculator, Phone, CalendarClock,
  FileText, BadgePercent, StickyNote, CheckCircle2, User, Eye,
  Smartphone, Send, CreditCard, ExternalLink,
} from 'lucide-react';
import { CashierHeroHeader } from './_hero-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/client-api';
import {
  kes, fmtDateTime, fmtDate, pname, PosNav, StatusBadge, MethodBadge, DeptBadge, McInput, BoolPill,
} from '@/app/pos/_lib';
import { BillReceiptModal, type Bill } from './_bill-receipt';

// ── API shapes (src/app/api/pos/route.ts + /api/dashboard?portal=cashier) ──
interface Charge {
  name: string;
  price: number;         // for multi-qty lines (pharmacy) this is the LINE total
  department: string;
  shaCovered: boolean;
  quantity?: number;
  serviceId?: string;
  sourceRef?: string;
  itemType?: string;     // LAB / DRUG / SERVICE / ADMISSION_BED / CONSULTATION
  saleNo?: string;       // PharmacySale No for BILLED pharmacy lines
}
interface PendingVisit {
  visitId: string;
  visitNo: string;
  visitStatus: string;
  visitDate: string;
  patient: {
    id: string;
    patientNo: string; firstName: string; lastName: string; phone: string;
    paymentMode: string; shaNumber: string; nationalId: string;
  };
  billId: string | null;
  charges: Charge[];
  totalCharges: number;
  shaTotal: number;
  cashTotal: number;
}
interface CashierKpis {
  todayCollections: number; todayCash: number; todayMpesa: number; todaySha: number;
  pendingBills: number; unpaidAmount: number; readyVisits: number;
}

const NAV = [
  { label: 'Collections', href: '/cashier', icon: <Coins className="h-3.5 w-3.5" /> },
  { label: 'History', href: '/cashier/history', icon: <History className="h-3.5 w-3.5" /> },
];

const PAY_MODES = ['CASH', 'MPESA', 'CARD', 'SHA', 'MIXED'] as const;
type PayMode = typeof PAY_MODES[number];

/** itemType for the checkout POST, derived from the charge department */
const itemTypeOf = (dept: string) => {
  switch (dept) {
    case 'Pharmacy': return 'DRUG';
    case 'Laboratory': return 'LAB';
    case 'Admission': return 'ADMISSION_BED';
    default: return 'SERVICE';
  }
};

/** Effective item type of a charge — API-provided first, department fallback */
const effectiveType = (c: Charge) => c.itemType || itemTypeOf(c.department);

// ── Item-type chips (distinct colours per Instruction 22) ──
const TYPE_TONES: Record<string, { label: string; cls: string }> = {
  LAB: { label: 'LAB', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  DRUG: { label: 'DRUG', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  SERVICE: { label: 'SERVICE', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ADMISSION_BED: { label: 'ADMISSION', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  CONSULTATION: { label: 'CONSULTATION', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};

function TypeChip({ type, count }: { type: string; count?: number }) {
  const tone = TYPE_TONES[type] || { label: (type || '—').replaceAll('_', ' '), cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap ${tone.cls}`}>
      {tone.label}
      {typeof count === 'number' && count > 1 && <span className="opacity-70">× {count}</span>}
    </span>
  );
}

/** Gradient tint for the card avatar / left border, by payment mode */
const avatarGradientOf = (paymentMode: string) => {
  if (paymentMode === 'SHA') return 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)';
  if (paymentMode === 'CASH') return 'linear-gradient(135deg, #10b981 0%, #047857 100%)';
  if (paymentMode === 'INSURANCE') return 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)';
  return 'linear-gradient(135deg, var(--mc-primary) 0%, var(--mc-tertiary) 100%)';
};

const initialsOf = (p: { firstName?: string; lastName?: string }) =>
  `${(p.firstName || '').charAt(0)}${(p.lastName || '').charAt(0)}`.toUpperCase() || '?';

function KpiChip({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mc-divider)] bg-white px-2.5 py-1 text-[11px] whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>
      <b className={tone || 'text-[var(--mc-text-primary)]'}>{value}</b>
    </span>
  );
}

export default function CashierPosPage() {
  // ── data ──
  const [kpis, setKpis] = React.useState<CashierKpis | null>(null);
  const [pending, setPending] = React.useState<PendingVisit[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');

  // ── collect modal ──
  const [collect, setCollect] = React.useState<PendingVisit | null>(null);
  const [patientId, setPatientId] = React.useState<string | null>(null);
  const [resolvingPatient, setResolvingPatient] = React.useState(false);
  const [checked, setChecked] = React.useState<Set<number>>(new Set());
  const [discount, setDiscount] = React.useState('');
  const [payMode, setPayMode] = React.useState<PayMode>('CASH');
  const [cashAmount, setCashAmount] = React.useState('');
  const [shaAmount, setShaAmount] = React.useState('');
  const [shaClaimRef, setShaClaimRef] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // ── charge detail modal (Eye — complete transparency before payment) ──
  const [detail, setDetail] = React.useState<PendingVisit | null>(null);

  // ── receipt ──
  const [receiptBill, setReceiptBill] = React.useState<Bill | null>(null);

  // ── active POS payment methods (Instruction 28 — payments-integration) ──
  const [payMethods, setPayMethods] = React.useState<{ cash: boolean; mpesa: boolean; pesapal: boolean; activeMethod: string } | null>(null);
  // M-Pesa Daraja STK push flow
  const [mpesaPhone, setMpesaPhone] = React.useState('');
  const [stkPushing, setStkPushing] = React.useState(false);
  const [stkPending, setStkPending] = React.useState<{ checkoutRequestId: string; customerMessage: string } | null>(null);
  const [stkChecking, setStkChecking] = React.useState(false);
  const [mpesaConfirmed, setMpesaConfirmed] = React.useState(false);
  // PesaPal card checkout flow
  const [cardStarting, setCardStarting] = React.useState(false);
  const [cardAwaiting, setCardAwaiting] = React.useState<{ orderRef: string } | null>(null);

  React.useEffect(() => {
    apiGet<{ cash: boolean; mpesa: boolean; pesapal: boolean; activeMethod: string }>('/api/payments-integration?status=public')
      .then(res => setPayMethods({ cash: res.cash, mpesa: res.mpesa, pesapal: res.pesapal, activeMethod: res.activeMethod }))
      .catch(() => { /* integrations unavailable — stays cash-only */ });
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadPending = React.useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const params = new URLSearchParams({ tab: 'pending-bills' });
      if (search) params.set('search', search);
      const res = await apiGet<{ pending: PendingVisit[] }>(`/api/pos?${params}`);
      setPending(res.pending);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load pending bills');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  const loadKpis = React.useCallback(async () => {
    try {
      const res = await apiGet<{ kpis: CashierKpis }>('/api/dashboard?portal=cashier');
      setKpis(res.kpis);
    } catch { /* non-critical strip */ }
  }, []);

  React.useEffect(() => { loadPending(); }, [loadPending]);
  React.useEffect(() => { loadKpis(); }, [loadKpis]);

  // ── method visibility per POS activation (Instruction 28) ──
  const cashAvailable = payMethods ? payMethods.cash : true;
  const mpesaAvailable = payMethods ? payMethods.mpesa : false;
  const pesapalAvailable = payMethods ? payMethods.pesapal : false;
  // manual CARD tab stays only where card isn't handled by the PesaPal integration
  const manualCardAvailable = payMethods ? (!payMethods.pesapal && payMethods.activeMethod === 'BOTH') : true;
  const visibleModes = React.useMemo(() => PAY_MODES.filter(m =>
    (m === 'CASH' && cashAvailable) ||
    (m === 'MPESA' && mpesaAvailable) ||
    (m === 'CARD' && manualCardAvailable) ||
    m === 'SHA' || m === 'MIXED' // insurance billing flows always available
  ), [cashAvailable, mpesaAvailable, manualCardAvailable]);

  React.useEffect(() => {
    if (!payMethods) return;
    if (visibleModes.length && !visibleModes.includes(payMode)) setPayMode(visibleModes[0]);
  }, [payMethods, payMode, visibleModes]);

  const defaultPayMode = (): PayMode => {
    if (!payMethods || payMethods.cash) return 'CASH';
    if (payMethods.mpesa) return 'MPESA';
    return 'SHA';
  };

  // ── collect flow ──
  const openCollect = async (v: PendingVisit) => {
    setCollect(v);
    setChecked(new Set(v.charges.map((_, i) => i))); // pre-check all lines
    setDiscount(''); setPayMode(defaultPayMode()); setCashAmount(''); setShaAmount('');
    setShaClaimRef(''); setNotes(''); setPatientId(null);
    // reset payment-integration flows (Instruction 28)
    setMpesaPhone(v.patient?.phone || '');
    setStkPending(null); setMpesaConfirmed(false);
    setCardAwaiting(null);
    if (v.patient?.id) {
      // pending-bills now returns the patient record id directly
      setPatientId(v.patient.id);
      return;
    }
    // legacy fallback: resolve patient record id via search
    setResolvingPatient(true);
    try {
      const res = await apiGet<{ patients: Array<{ id: string; patientNo: string }> }>(
        `/api/patients?search=${encodeURIComponent(v.patient.patientNo)}&perPage=10`
      );
      const match = res.patients.find(p => p.patientNo === v.patient.patientNo) || res.patients[0];
      if (match) setPatientId(match.id);
      else toast.error('Could not resolve the patient record — try again');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not resolve the patient record');
    } finally {
      setResolvingPatient(false);
    }
  };

  const toggleLine = (i: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const selectedCharges = collect ? collect.charges.filter((_, i) => checked.has(i)) : [];
  const subtotal = selectedCharges.reduce((s, c) => {
    const qty = c.quantity && c.quantity > 0 ? c.quantity : 1;
    return s + (c.quantity && c.quantity > 1 ? c.price / c.quantity * qty : c.price);
  }, 0);
  const discountNum = Math.min(Math.max(parseFloat(discount) || 0, 0), subtotal);
  const total = Math.max(0, subtotal - discountNum);
  const mixedCash = parseFloat(cashAmount) || 0;
  const mixedSha = parseFloat(shaAmount) || 0;
  const mixedSum = mixedCash + mixedSha;
  const mixedValid = Math.abs(mixedSum - total) < 1; // within KSh 1 tolerance

  const canSubmit = !!collect
    && selectedCharges.length > 0
    && total > 0
    && !!patientId
    && (payMode !== 'MIXED' || mixedValid)
    && (payMode !== 'MPESA' || (mpesaConfirmed && !!stkPending))
    && !submitting;

  const submitCheckout = async (modeOverride?: PayMode, refNote?: string) => {
    if (!collect || !patientId) return;
    setSubmitting(true);
    try {
      const finalNotes = [notes.trim(), refNote].filter(Boolean).join(' · ');
      const res = await apiPost<{ bill: Bill; receiptNo: string; message: string }>('/api/pos', {
        visitId: collect.visitId,
        patientId,
        paymentMode: modeOverride || payMode,
        discountAmount: discountNum,
        ...(payMode === 'MIXED' ? { cashAmount: mixedCash, shaAmount: mixedSha, shaClaimRef: shaClaimRef.trim() } : {}),
        ...(payMode === 'SHA' && shaClaimRef.trim() ? { shaClaimRef: shaClaimRef.trim() } : {}),
        notes: finalNotes,
        charges: selectedCharges.map(c => {
          const qty = c.quantity && c.quantity > 0 ? c.quantity : 1;
          const unit = c.quantity && c.quantity > 1 ? c.price / c.quantity : c.price;
          return {
            name: c.name,
            price: Math.round(unit * 100) / 100,
            quantity: qty,
            department: c.department,
            shaCovered: c.shaCovered,
            itemType: effectiveType(c),
            ...(c.serviceId ? { serviceId: c.serviceId } : {}),
            ...(c.sourceRef ? { sourceRef: c.sourceRef } : {}),
          };
        }),
      });
      toast.success(`${res.message} — ${kes(res.bill.totalAmount)} via ${modeOverride || payMode}`);
      // attach patient (POST response includes items only) for the receipt modal
      setReceiptBill({ ...res.bill, patient: collect.patient });
      setCollect(null);
      await Promise.all([loadPending(true), loadKpis()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── M-Pesa Daraja STK push (Instruction 28) ──
  const mpesaPhoneValid = /^(?:\+?254|0)?[17]\d{8}$/.test(mpesaPhone.replace(/[\s\-]/g, ''));

  const sendStkPush = async () => {
    if (!collect || total <= 0 || !mpesaPhoneValid) return;
    setStkPushing(true);
    try {
      const res = await apiPost<{ CheckoutRequestID: string; CustomerMessage: string }>('/api/payments-integration', {
        action: 'mpesa-stk-push',
        amount: Math.round(total),
        phone: mpesaPhone,
        accountReference: collect.visitNo.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || collect.patient.patientNo.slice(0, 12),
        description: `Visit ${collect.visitNo} charges`,
      });
      setStkPending({ checkoutRequestId: res.CheckoutRequestID, customerMessage: res.CustomerMessage });
      toast.success('STK push sent — ask the customer to check their phone');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'STK push failed');
    } finally {
      setStkPushing(false);
    }
  };

  const checkStkStatus = async () => {
    if (!stkPending) return;
    setStkChecking(true);
    try {
      const res = await apiPost<{ paid: boolean; ResultDesc: string }>('/api/payments-integration', {
        action: 'mpesa-stk-status',
        checkoutRequestId: stkPending.checkoutRequestId,
      });
      if (res.paid) {
        setMpesaConfirmed(true);
        toast.success('M-PESA payment confirmed — complete the checkout');
      } else {
        toast.info(res.ResultDesc || 'Payment not completed yet — ask the customer to enter their M-Pesa PIN');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Status check failed');
    } finally {
      setStkChecking(false);
    }
  };

  // ── PesaPal card checkout (Instruction 28) ──
  const startCardCheckout = async () => {
    if (!collect || total <= 0) return;
    setCardStarting(true);
    try {
      const res = await apiPost<{ orderRef: string; redirectUrl: string }>('/api/payments-integration', {
        action: 'pesapal-submit-order',
        amount: Math.round(total * 100) / 100,
        phone: collect.patient.phone || mpesaPhone,
        description: `Visit ${collect.visitNo} charges — ${pname(collect.patient)}`,
        callbackUrl: `${window.location.origin}/cashier`,
      });
      window.open(res.redirectUrl, '_blank', 'noopener');
      setCardAwaiting({ orderRef: res.orderRef });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Card checkout failed to start');
    } finally {
      setCardStarting(false);
    }
  };

  return (
    <div className="lg:h-full lg:flex lg:flex-col min-h-0">
      {/* ── Full-width flat hero header — mirrors the Pharmacy POS header pattern ── */}
      <CashierHeroHeader
        icon={<Calculator className="h-5 w-5" />}
        title="Cashier POS"
        description="Collect payments for all departmental charges — clinical, lab, pharmacy, admission"
      />

      {/* ── top strip: nav + cashier KPIs ── */}
      <div className="shrink-0 border-b border-[var(--mc-divider)] bg-[var(--mc-bg-card)] px-3 py-2 no-print">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PosNav items={NAV} />
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-1.5">
            {kpis ? (
              <>
                <KpiChip label="Collections today" value={kpis.todayCollections} />
                <KpiChip label="Cash" value={kes(kpis.todayCash)} tone="text-emerald-700" />
                <KpiChip label="M-PESA" value={kes(kpis.todayMpesa)} tone="text-red-600" />
                <KpiChip label="SHA" value={kes(kpis.todaySha)} tone="text-purple-700" />
                <KpiChip label="Pending bills" value={kpis.pendingBills} />
                <KpiChip label="Unpaid" value={kes(kpis.unpaidAmount)} tone="text-amber-700" />
                <KpiChip label="Ready visits" value={kpis.readyVisits} tone="text-sky-700" />
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground">Loading cashier KPIs…</span>
            )}
          </div>
        </div>
      </div>

      {/* ── pending bills pane ── */}
      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <McInput
              className="pl-8"
              placeholder="Search pending bills by patient name, patient No, phone or visit No…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1" onClick={() => { loadPending(true); loadKpis(); }} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] animate-pulse" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--mc-divider)] p-12 text-center">
            <Calculator className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-[var(--mc-text-primary)]">No pending visit bills</p>
            <p className="text-xs text-muted-foreground mt-1">
              Visit charges from all departments (clinical, laboratory, pharmacy, admission) appear here for collection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {pending.map(v => {
              const avatarGradient = avatarGradientOf(v.patient.paymentMode);
              // group charges by item type for the summary chips
              const typeCounts = new Map<string, number>();
              for (const c of v.charges) {
                const t = effectiveType(c);
                typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
              }
              return (
                <div
                  key={v.visitId}
                  className="rounded-2xl border border-[var(--mc-divider)] bg-white overflow-hidden flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex">
                    {/* gradient-tinted left border */}
                    <div className="w-1.5 shrink-0" style={{ background: avatarGradient }} aria-hidden />
                    <div className="p-3 flex-1 min-w-0 space-y-2.5 flex flex-col">
                      {/* patient header */}
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-inner"
                            style={{ background: avatarGradient }}
                          >
                            {initialsOf(v.patient)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[var(--mc-text-primary)] truncate">{pname(v.patient)}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {v.patient.patientNo}{v.patient.phone ? ` · ${v.patient.phone}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <MethodBadge method={v.patient.paymentMode} />
                          <StatusBadge status={v.visitStatus} />
                        </div>
                      </div>

                      {/* visit meta */}
                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                        <span className="font-semibold text-[var(--mc-text-secondary)]">Visit {v.visitNo}</span>
                        <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtDate(v.visitDate)}</span>
                      </div>

                      {/* item-type chips */}
                      {v.charges.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {[...typeCounts.entries()].map(([type, n]) => (
                            <TypeChip key={type} type={type} count={n} />
                          ))}
                        </div>
                      )}

                      {/* charges summary + SHA/cash split */}
                      <div className="rounded-xl bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] p-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            {v.charges.length} charge line{v.charges.length === 1 ? '' : 's'}
                          </span>
                          <b className="text-lg font-extrabold text-[var(--mc-text-primary)] leading-none">{kes(v.totalCharges)}</b>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="rounded-lg bg-purple-50 border border-purple-100 px-2 py-1.5">
                            <p className="text-[9px] font-extrabold text-purple-600 uppercase tracking-wide">SHA covered</p>
                            <p className="text-[13px] font-extrabold text-purple-800 leading-tight">{kes(v.shaTotal)}</p>
                          </div>
                          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-2 py-1.5">
                            <p className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wide">Cash portion</p>
                            <p className="text-[13px] font-extrabold text-emerald-800 leading-tight">{kes(v.cashTotal)}</p>
                          </div>
                        </div>
                      </div>

                      {/* actions */}
                      <div className="flex items-center gap-2 mt-auto">
                        <Button
                          className="flex-1 h-11 font-extrabold mc-gradient-primary text-white"
                          disabled={v.charges.length === 0}
                          onClick={() => openCollect(v)}
                        >
                          <Coins className="h-4 w-4" /> Collect Payment
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 shrink-0"
                          title="View charge details"
                          aria-label={`View charge details for ${pname(v.patient)}`}
                          onClick={() => setDetail(v)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── charge detail modal — complete transparency before payment ── */}
      <PremiumModal
        open={!!detail}
        onOpenChange={o => { if (!o) setDetail(null); }}
        size="lg"
        title="Charge Details"
        icon={<Eye className="h-5 w-5" />}
        description={detail ? `${pname(detail.patient)} · ${detail.patient.patientNo} · Visit ${detail.visitNo}` : ''}
        footerNote="Complete transparency before payment — every chargeable item on this visit"
        secondaryLabel="Close"
      >
        {detail && (
          <div className="space-y-3">
            {/* patient summary strip */}
            <div className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
                <b className="text-[var(--mc-text-primary)]">{pname(detail.patient)}</b>
              </span>
              <span className="text-muted-foreground">{detail.patient.patientNo}</span>
              {detail.patient.phone && (
                <span className="inline-flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{detail.patient.phone}</span>
              )}
              <MethodBadge method={detail.patient.paymentMode} />
              {detail.patient.shaNumber && <span className="text-[11px] text-purple-700 font-semibold">SHA No {detail.patient.shaNumber}</span>}
              <div className="flex-1" />
              <StatusBadge status={detail.visitStatus} />
            </div>

            {/* all chargeable items */}
            <div className="rounded-xl border overflow-x-auto">
              <table className="mc-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Department</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.charges.map((c, i) => {
                    const qty = c.quantity && c.quantity > 0 ? c.quantity : 1;
                    const unit = c.quantity && c.quantity > 1 ? c.price / c.quantity : c.price;
                    return (
                      <tr key={i}>
                        <td className="font-medium">
                          {c.name}
                          {c.saleNo && <p className="text-[10px] text-muted-foreground">Pharmacy sale {c.saleNo}</p>}
                        </td>
                        <td><TypeChip type={effectiveType(c)} /></td>
                        <td><DeptBadge dept={c.department} /></td>
                        <td className="text-center">{qty}</td>
                        <td className="text-right">{kes(unit)}</td>
                        <td className="text-right font-semibold">{kes(c.price)}</td>
                      </tr>
                    );
                  })}
                  {detail.charges.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-6">No chargeable items on this visit yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* totals + SHA split */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-xl bg-purple-50 border border-purple-100 px-3 py-2.5">
                <p className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wide">SHA covered</p>
                <p className="text-lg font-extrabold text-purple-800 leading-tight">{kes(detail.shaTotal)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                <p className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wide">Cash portion</p>
                <p className="text-lg font-extrabold text-emerald-800 leading-tight">{kes(detail.cashTotal)}</p>
              </div>
              <div className="rounded-xl bg-[var(--mc-primary-light)] border border-[var(--mc-primary)] px-3 py-2.5">
                <p className="text-[10px] font-extrabold text-[var(--mc-primary-dark)] uppercase tracking-wide">Total charges</p>
                <p className="text-lg font-extrabold text-[var(--mc-text-primary)] leading-tight">{kes(detail.totalCharges)}</p>
              </div>
            </div>
          </div>
        )}
      </PremiumModal>

      {/* ── collect payment modal ── */}
      <PremiumModal
        open={!!collect}
        onOpenChange={o => { if (!o && !submitting) setCollect(null); }}
        size="xl"
        title="Collect Payment"
        icon={<Coins className="h-5 w-5" />}
        description={collect ? `${pname(collect.patient)} · ${collect.patient.patientNo} · Visit ${collect.visitNo}` : ''}
        footerNote="Checkout consolidates the selected charges into a bill + payment and prints a receipt"
        submitLabel={submitting ? 'Processing…' : `Receive ${kes(total)}`}
        onSubmit={() => submitCheckout()}
        secondaryLabel="Cancel"
        submitDisabled={!canSubmit}
        submitting={submitting}
      >
        {collect && (
          <div className="space-y-4">
            {/* patient summary */}
            <div className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
                <b className="text-[var(--mc-text-primary)]">{pname(collect.patient)}</b>
              </span>
              <span className="text-muted-foreground">{collect.patient.patientNo}</span>
              {collect.patient.phone && (
                <span className="inline-flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{collect.patient.phone}</span>
              )}
              <MethodBadge method={collect.patient.paymentMode} />
              {collect.patient.shaNumber && <span className="text-[11px] text-purple-700 font-semibold">SHA No {collect.patient.shaNumber}</span>}
              <div className="flex-1" />
              {resolvingPatient
                ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> resolving patient…</span>
                : patientId
                  ? <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> record linked</span>
                  : <span className="text-red-600 font-semibold">patient record unresolved</span>}
            </div>

            {/* charges table */}
            <div className="rounded-xl border overflow-x-auto">
              <table className="mc-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>✓</th>
                    <th>Charge</th>
                    <th>Department</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-center">SHA</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {collect.charges.map((c, i) => {
                    const qty = c.quantity && c.quantity > 0 ? c.quantity : 1;
                    const unit = c.quantity && c.quantity > 1 ? c.price / c.quantity : c.price;
                    const lineTotal = unit * qty;
                    const isOn = checked.has(i);
                    return (
                      <tr key={i} className={isOn ? '' : 'opacity-45'}>
                        <td><Checkbox checked={isOn} onCheckedChange={() => toggleLine(i)} /></td>
                        <td className="font-medium">
                          {c.name}
                          {c.saleNo && <p className="text-[10px] text-muted-foreground">Pharmacy sale {c.saleNo}</p>}
                        </td>
                        <td><DeptBadge dept={c.department} /></td>
                        <td className="text-center">{qty}</td>
                        <td className="text-right">{kes(unit)}</td>
                        <td className="text-center">{c.shaCovered ? <BoolPill value trueLabel="Covered" falseLabel="" /> : <span className="text-muted-foreground text-[11px]">—</span>}</td>
                        <td className="text-right font-semibold">{kes(lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* discount + payment mode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2.5">
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
                <div className="relative">
                  <StickyNote className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <textarea
                    className="mc-input w-full min-h-[64px] pl-8 pt-2 text-sm"
                    placeholder="Notes (optional)"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                {/* payment mode tabs (POS-activated methods only — Instruction 28) */}
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(visibleModes.length, 1)}, minmax(0, 1fr))` }}>
                  {visibleModes.map(m => (
                    <button
                      key={m}
                      type="button"
                      className={`px-1 py-2 rounded-lg border text-[11px] font-bold transition-colors ${
                        payMode === m
                          ? 'bg-[var(--mc-primary)] text-white border-transparent shadow'
                          : 'bg-white border-[var(--mc-divider)] text-[var(--mc-text-secondary)] hover:bg-[var(--mc-primary-light)]'
                      }`}
                      onClick={() => {
                        setPayMode(m);
                        if (m === 'MIXED') {
                          setCashAmount(total > 0 ? String(Math.round(total * 100) / 100) : '');
                          setShaAmount('0');
                        }
                      }}
                    >
                      {m === 'MPESA' ? 'M-PESA' : m}
                    </button>
                  ))}
                </div>

                {/* M-Pesa Daraja STK push flow */}
                {payMode === 'MPESA' && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-2.5 space-y-2">
                    {!stkPending ? (
                      <>
                        <label className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                          <Smartphone className="h-3.5 w-3.5" /> Customer M-Pesa phone
                        </label>
                        <McInput
                          type="tel" inputMode="tel"
                          placeholder="e.g. 0712 345 678"
                          value={mpesaPhone}
                          onChange={e => setMpesaPhone(e.target.value)}
                        />
                        <Button
                          type="button"
                          className="w-full h-10 gap-1.5 font-extrabold"
                          style={{ background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', color: '#fff' }}
                          disabled={stkPushing || !mpesaPhoneValid || total <= 0}
                          onClick={sendStkPush}
                        >
                          {stkPushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          {stkPushing ? 'Sending push…' : `Send STK Push — ${kes(total)}`}
                        </Button>
                        <p className="text-[11px] text-emerald-800/80">
                          Sends the M-Pesa PIN prompt directly to the customer&apos;s phone (Daraja STK push).
                        </p>
                      </>
                    ) : !mpesaConfirmed ? (
                      <>
                        <p className="text-[12px] font-bold text-emerald-900 flex items-center gap-1.5">
                          <Smartphone className="h-4 w-4 animate-pulse" /> Check your phone — enter Mpesa PIN
                        </p>
                        <p className="text-[11px] text-emerald-800/80 break-all">
                          {stkPending.customerMessage} · ref <b>{stkPending.checkoutRequestId}</b>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Button type="button" variant="outline" className="h-9 gap-1.5" disabled={stkChecking} onClick={checkStkStatus}>
                            {stkChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            {stkChecking ? 'Checking…' : 'Check Payment Status'}
                          </Button>
                          <Button
                            type="button" variant="outline"
                            className="h-9 gap-1.5 border-emerald-400 text-emerald-800 hover:bg-emerald-100"
                            onClick={() => { setMpesaConfirmed(true); toast.success('Marked as received — complete the checkout'); }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Payment Received
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-[12px] font-bold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Payment confirmed — ref {stkPending.checkoutRequestId}
                      </p>
                    )}
                  </div>
                )}

                {/* PesaPal card checkout */}
                {pesapalAvailable && (
                  <div className="space-y-1.5">
                    <Button
                      type="button" variant="outline"
                      className="w-full h-10 gap-1.5 border-indigo-300 text-indigo-800 hover:bg-indigo-50"
                      disabled={cardStarting || total <= 0}
                      onClick={startCardCheckout}
                    >
                      {cardStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      {cardStarting ? 'Opening card page…' : 'Pay by Card (PesaPal)'}
                      {!cardStarting && <ExternalLink className="h-3 w-3 opacity-60" />}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Opens the secure PesaPal card page in a new window — for any card (Visa / Mastercard).
                    </p>
                  </div>
                )}

                {/* MIXED split */}
                {payMode === 'MIXED' && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-amber-800">Cash amount</label>
                        <McInput type="number" min={0} step="0.01" value={cashAmount} onChange={e => setCashAmount(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-amber-800">SHA amount</label>
                        <McInput type="number" min={0} step="0.01" value={shaAmount} onChange={e => setShaAmount(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-amber-800">SHA claim reference</label>
                      <McInput placeholder="e.g. SHA-2025-00123" value={shaClaimRef} onChange={e => setShaClaimRef(e.target.value)} />
                    </div>
                    <p className={`text-[11px] font-semibold ${mixedValid ? 'text-emerald-700' : 'text-red-600'}`}>
                      {mixedValid
                        ? `Split adds up to the total (${kes(total)})`
                        : `Cash + SHA = ${kes(mixedSum)} — must equal the total ${kes(total)}`}
                    </p>
                  </div>
                )}

                {payMode === 'SHA' && (
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">SHA claim reference (optional)</label>
                    <McInput placeholder="e.g. SHA-2025-00123" value={shaClaimRef} onChange={e => setShaClaimRef(e.target.value)} />
                  </div>
                )}

                {/* live totals */}
                <div className="rounded-xl bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] p-2.5 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Selected lines</span>
                    <span className="text-xs font-semibold">{selectedCharges.length} of {collect.charges.length}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{kes(subtotal)}</span></div>
                  {discountNum > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-600">- {kes(discountNum)}</span></div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-[var(--mc-divider)]">
                    <span className="font-extrabold text-base">TOTAL</span>
                    <span className="font-extrabold text-xl text-[var(--mc-primary)]">{kes(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {fmtDateTime(collect.visitDate)} · checkout marks the visit COMPLETED and issues the receipt immediately.
            </p>
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
          submitCheckout('CARD', `PesaPal card — ref ${ref}`);
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
            Once the terminal / page confirms success, click <b>Payment Completed</b> — the sale is
            recorded as <b>CARD</b> with the PesaPal reference.
          </p>
        </div>
      </PremiumModal>

      {/* receipt modal */}
      <BillReceiptModal bill={receiptBill} onOpenChange={o => !o && setReceiptBill(null)} />
    </div>
  );
}
