'use client';

/**
 * PHARMACY SALE RECEIPT MODAL — shared by the Dispensing POS (right after a
 * sale) and Sales History (view action). Print button renders the content-only
 * printable receipt (facility header from /api/company).
 *
 * mode='invoice' (Instruction 17 — "Complete Dispense" flow): billed-to-visit
 * sales show as a PHARMACY INVOICE with "Print Invoice" + "Done" actions; the
 * patient settles at the cashier. Cash receipts can carry tendered/change.
 */

import * as React from 'react';
import { Receipt, Printer } from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { Button } from '@/components/ui/button';
import { kes, fmtDateTime, MethodBadge, StatusBadge, BoolPill, printReceipt } from '@/app/pos/_lib';

export interface SaleItem {
  id: string;
  drugName: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  dosageInstruction?: string;
  totalPrice: number;
}

export interface Sale {
  id: string;
  saleNo: string;
  receiptNo: string;
  patientName: string;
  patientPhone: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  billToVisit: boolean;
  prescriptionId?: string;
  createdAt: string;
  items: SaleItem[];
}

export function SaleReceiptModal({ sale, onOpenChange, mode = 'receipt', tendered, change }: {
  sale: Sale | null;
  onOpenChange: (o: boolean) => void;
  /** 'invoice' → billed-to-visit dispense (Print Invoice + Done); 'receipt' → paid sale */
  mode?: 'receipt' | 'invoice';
  /** Cash change calculator — printed as "Tendered / Change" when provided */
  tendered?: number;
  change?: number;
}) {
  const [printing, setPrinting] = React.useState(false);
  const invoice = mode === 'invoice';

  const doPrint = async () => {
    if (!sale) return;
    setPrinting(true);
    try {
      await printReceipt({
        title: sale.billToVisit || invoice ? 'PHARMACY INVOICE' : 'PHARMACY SALE RECEIPT',
        receiptNo: sale.receiptNo || sale.saleNo,
        meta: [
          ['Sale No', sale.saleNo],
          ['Patient', sale.patientName],
          ['Phone', sale.patientPhone],
          ['Served at', fmtDateTime(sale.createdAt)],
          ...(sale.prescriptionId ? [['Prescription', sale.prescriptionId] as [string, string]] : []),
        ],
        lines: sale.items.map(i => ({
          name: i.drugName,
          qty: i.quantity,
          unitPrice: i.unitPrice,
          total: i.totalPrice,
          meta: i.dosageInstruction || undefined,
        })),
        totals: [
          ['Subtotal', kes(sale.subtotal)],
          ...(sale.discountAmount > 0 ? [['Discount', `- ${kes(sale.discountAmount)}`] as [string, string]] : []),
          [invoice ? 'TOTAL DUE' : 'TOTAL', kes(sale.totalAmount)],
        ],
        ...(tendered !== undefined && change !== undefined ? { tendered, change } : {}),
        paymentNote: sale.billToVisit || invoice
          ? 'BILLED TO PATIENT VISIT — PAY AT CASHIER'
          : `PAID VIA ${sale.paymentMethod}`,
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <PremiumModal
      open={!!sale}
      onOpenChange={onOpenChange}
      size="md"
      title={sale?.billToVisit || invoice ? 'Pharmacy Invoice' : 'Sale Receipt'}
      icon={<Receipt className="h-5 w-5" />}
      description={sale ? `${sale.saleNo} · ${sale.patientName}` : ''}
      footerNote="Receipt prints on the configured paper size with the facility header"
      submitLabel={printing ? 'Preparing…' : invoice ? 'Print Invoice' : 'Print Receipt'}
      submitIcon={<Printer className="h-3.5 w-3.5" />}
      onSubmit={doPrint}
      secondaryLabel={invoice ? 'Done' : 'Close'}
      submitting={printing}
    >
      {sale && (
        <div className="space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div className="col-span-2 flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground text-xs">Receipt No:</span>
              <span className="font-bold">{sale.receiptNo || '— (billed to visit)'}</span>
              <MethodBadge method={sale.paymentMethod} />
              <StatusBadge status={sale.paymentStatus} />
              <BoolPill value={sale.billToVisit} trueLabel="Bill to visit" falseLabel="Counter sale" />
            </div>
            <div><span className="text-xs text-muted-foreground">Patient:</span> <b>{sale.patientName}</b></div>
            <div><span className="text-xs text-muted-foreground">Phone:</span> {sale.patientPhone || '—'}</div>
            <div className="col-span-2"><span className="text-xs text-muted-foreground">Date:</span> {fmtDateTime(sale.createdAt)}</div>
          </div>

          {/* Items */}
          <div className="rounded-xl border overflow-hidden">
            <table className="mc-table">
              <thead>
                <tr><th>Drug</th><th className="text-center">Qty</th><th className="text-right">Unit</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {sale.items.map(i => (
                  <tr key={i.id}>
                    <td>
                      <span className="font-medium">{i.drugName}</span>
                      {i.dosageInstruction && <p className="text-[11px] text-muted-foreground">{i.dosageInstruction}</p>}
                    </td>
                    <td className="text-center">{i.quantity}</td>
                    <td className="text-right">{kes(i.unitPrice)}</td>
                    <td className="text-right font-semibold">{kes(i.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{kes(sale.subtotal)}</span></div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>- {kes(sale.discountAmount)}</span></div>
            )}
            <div className="flex justify-between pt-1 border-t border-[var(--mc-divider)]">
              <span className="font-extrabold text-base">{invoice ? 'TOTAL DUE' : 'TOTAL'}</span>
              <span className="font-extrabold text-base text-[var(--mc-primary)]">{kes(sale.totalAmount)}</span>
            </div>
            {tendered !== undefined && change !== undefined && (
              <>
                <div className="flex justify-between pt-1 border-t border-dashed border-[var(--mc-divider)]">
                  <span className="text-muted-foreground">Tendered</span><span className="font-semibold">{kes(tendered)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">Change</span>
                  <span className={`font-extrabold ${change < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{kes(change)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PremiumModal>
  );
}
