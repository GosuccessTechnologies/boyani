'use client';

/**
 * PHARMACY PRESCRIPTIONS QUEUE — pending prescriptions to dispense.
 * GET /api/pharmacy-pos?section=prescriptions → cards with prescriptionNo,
 * patient, items summary w/ dispensed status, prescriber, createdAt.
 * "Dispense" jumps to the POS with the cart pre-loaded (?prescription=<id>).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ReceiptText, RefreshCw, Pill, Loader2, User, CalendarClock, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiGet } from '@/lib/client-api';
import { kes, fmtDateTime, pname, PosNav, StatusBadge, BoolPill } from '@/app/pos/_lib';
import { PharmacyHeroHeader } from '../_hero-header';

interface RxItem {
  id: string; drugId?: string | null; drugName: string; dosage: string; frequency?: string;
  duration?: string; quantity: number; dispensedQty: number; unitPrice: number;
  drug?: { id: string; name: string; stock: number; unitPrice: number; code: string } | null;
}
interface Rx {
  id: string; prescriptionNo: string; patientId: string; doctorId: string; status: string;
  createdAt: string; notes?: string;
  patient?: { patientNo: string; firstName: string; lastName: string; phone: string } | null;
  items: RxItem[];
}

const NAV = [
  { label: 'Dispensing', href: '/pharmacy', icon: <Pill className="h-3.5 w-3.5" /> },
  { label: 'Prescriptions', href: '/pharmacy/prescriptions', icon: <ReceiptText className="h-3.5 w-3.5" /> },
  { label: 'Sales History', href: '/pharmacy/sales', icon: <Stethoscope className="h-3.5 w-3.5" /> },
];

export default function PharmacyPrescriptionsPage() {
  const router = useRouter();
  const [prescriptions, setPrescriptions] = React.useState<Rx[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await apiGet<{ prescriptions: Rx[] }>('/api/pharmacy-pos?section=prescriptions');
      setPrescriptions(res.prescriptions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load prescriptions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const remainingOf = (item: RxItem) => Math.max(0, (item.quantity || 0) - (item.dispensedQty || 0));
  const rxRemaining = (rx: Rx) => rx.items.reduce((s, i) => s + remainingOf(i), 0);
  const rxValue = (rx: Rx) => rx.items.reduce((s, i) => s + remainingOf(i) * (i.drug?.unitPrice ?? i.unitPrice ?? 0), 0);
  const prescriber = (rx: Rx) => (rx.doctorId ? `Dr. ref ${rx.doctorId.slice(-6).toUpperCase()}` : '—');

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* ── Shared pharmacy hero header ── */}
      <PharmacyHeroHeader
        icon={<ReceiptText className="h-5 w-5" />}
        title="Pending Prescriptions"
        description="Prescriptions written by doctors — dispense loads the POS cart with the remaining quantities"
      />

      <div className="p-3 lg:p-4 space-y-4 flex-1 overflow-auto">
      <div className="flex flex-wrap items-center gap-3">
        <PosNav items={NAV} />
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] animate-pulse" />
          ))}
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--mc-divider)] p-12 text-center">
          <ReceiptText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-[var(--mc-text-primary)]">No pending prescriptions</p>
          <p className="text-xs text-muted-foreground mt-1">Prescriptions written by doctors appear here until fully dispensed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {prescriptions.map(rx => {
            const remaining = rxRemaining(rx);
            return (
              <div key={rx.id} className="rounded-xl border border-[var(--mc-divider)] bg-white overflow-hidden flex flex-col">
                {/* card header */}
                <div className="mc-card-header px-3.5 py-2.5 flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-white shrink-0" />
                  <span className="text-white font-bold text-sm">{rx.prescriptionNo}</span>
                  <div className="flex-1" />
                  <StatusBadge status={rx.status} />
                </div>

                <div className="p-3.5 space-y-2.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <User className="h-3.5 w-3.5 text-[var(--mc-primary)]" />
                    <b className="text-[var(--mc-text-primary)]">{pname(rx.patient)}</b>
                    <span className="text-muted-foreground">{rx.patient?.patientNo}</span>
                  </div>
                  {rx.patient?.phone && (
                    <p className="text-[11px] text-muted-foreground">Tel: {rx.patient.phone}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Stethoscope className="h-3 w-3" />{prescriber(rx)}</span>
                    <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtDateTime(rx.createdAt)}</span>
                  </div>

                  {/* items summary */}
                  <div className="rounded-lg border border-[var(--mc-divider)] divide-y divide-[var(--mc-divider)]">
                    {rx.items.map(item => {
                      const rem = remainingOf(item);
                      const out = rem <= 0;
                      const lowStock = !out && item.drug && item.drug.stock < rem;
                      return (
                        <div key={item.id} className="px-2.5 py-2 flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-semibold leading-tight truncate ${out ? 'text-muted-foreground line-through' : 'text-[var(--mc-text-primary)]'}`}>
                              {item.drugName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-bold text-[var(--mc-text-secondary)]">
                              {item.dispensedQty}/{item.quantity}
                            </p>
                            {out ? (
                              <BoolPill value={false} trueLabel="" falseLabel="Dispensed" />
                            ) : lowStock ? (
                              <span className="text-[10px] text-red-600 font-semibold">stock {item.drug?.stock}</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">disp. {rem} left</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">To dispense</span>
                    <b className="text-[var(--mc-text-primary)]">{remaining} unit(s) · ≈ {kes(rxValue(rx))}</b>
                  </div>
                </div>

                {/* action footer */}
                <div className="p-3 pt-0">
                  <Button
                    className="w-full h-11 font-bold mc-gradient-primary text-white"
                    disabled={remaining <= 0}
                    onClick={() => router.push(`/pharmacy?prescription=${rx.id}`)}
                  >
                    <Pill className="h-4 w-4" /> Dispense
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
