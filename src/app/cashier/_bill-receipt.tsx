'use client';

/**
 * CASHIER BILL RECEIPT MODAL — shared by the Collections POS (right after
 * checkout) and Collections History (view action). Print honours
 * /api/printer-settings paper size (A4/A5 portrait) + /api/company header.
 */

import * as React from 'react';
import { Printer, Receipt } from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { Button } from '@/components/ui/button';
import { kes, fmtDateTime, pname, MethodBadge, StatusBadge, DeptBadge, printReceipt } from '@/app/pos/_lib';

export interface BillItem {
  id: string;
  itemType: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  department: string;
  shaCovered: boolean;
}

export interface Bill {
  id: string;
  billNo: string;
  receiptNo: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentMode: string;
  status: string;
  notes?: string;
  createdAt: string;
  items: BillItem[];
  patient?: {
    patientNo: string; firstName: string; lastName: string; phone?: string;
    paymentMode?: string; shaNumber?: string;
  } | null;
}

export function BillReceiptModal({ bill, onOpenChange }: { bill: Bill | null; onOpenChange: (o: boolean) => void }) {
  const [printing, setPrinting] = React.useState(false);

  const doPrint = async () => {
    if (!bill) return;
    setPrinting(true);
    try {
      await printReceipt({
        title: 'PAYMENT RECEIPT',
        receiptNo: bill.receiptNo || bill.billNo,
        meta: [
          ['Bill No', bill.billNo],
          ['Patient', pname(bill.patient)],
          ['Patient No', bill.patient?.patientNo || ''],
          ['Served at', fmtDateTime(bill.createdAt)],
        ],
        lines: bill.items.map(i => ({
          name: i.itemName,
          qty: i.quantity,
          unitPrice: i.unitPrice,
          total: i.totalPrice,
          meta: [i.department, i.shaCovered ? 'SHA covered' : ''].filter(Boolean).join(' · ') || undefined,
        })),
        totals: [
          ['Subtotal', kes(bill.subtotal)],
          ...(bill.taxAmount > 0 ? [['Tax', kes(bill.taxAmount)] as [string, string]] : []),
          ...(bill.discountAmount > 0 ? [['Discount', `- ${kes(bill.discountAmount)}`] as [string, string]] : []),
          ['TOTAL PAID', kes(bill.totalAmount)],
        ],
        paymentNote: `PAID VIA ${bill.paymentMode}${bill.patient?.shaNumber ? ` · SHA No ${bill.patient.shaNumber}` : ''}`,
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <PremiumModal
      open={!!bill}
      onOpenChange={onOpenChange}
      size="md"
      title="Payment Receipt"
      icon={<Receipt className="h-5 w-5" />}
      description={bill ? `${bill.billNo} · ${pname(bill.patient)}` : ''}
      footerNote="Prints on the configured paper size (A4/A5 portrait) with the facility header"
      submitLabel={printing ? 'Preparing…' : 'Print Receipt'}
      submitIcon={<Printer className="h-3.5 w-3.5" />}
      onSubmit={doPrint}
      secondaryLabel="Close"
      submitting={printing}
    >
      {bill && (
        <div className="space-y-4">
          {/* meta */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div className="col-span-2 flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground text-xs">Receipt No:</span>
              <span className="font-bold">{bill.receiptNo || '—'}</span>
              <MethodBadge method={bill.paymentMode} />
              <StatusBadge status={bill.status} />
            </div>
            <div><span className="text-xs text-muted-foreground">Patient:</span> <b>{pname(bill.patient)}</b></div>
            <div><span className="text-xs text-muted-foreground">Patient No:</span> {bill.patient?.patientNo || '—'}</div>
            <div><span className="text-xs text-muted-foreground">Date:</span> {fmtDateTime(bill.createdAt)}</div>
            {bill.patient?.shaNumber && (
              <div><span className="text-xs text-muted-foreground">SHA No:</span> {bill.patient.shaNumber}</div>
            )}
          </div>

          {/* items with departments */}
          <div className="rounded-xl border overflow-hidden">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Department</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map(i => (
                  <tr key={i.id}>
                    <td className="font-medium">
                      {i.itemName}
                      {i.shaCovered && <p className="text-[10px] text-purple-600 font-semibold">SHA covered</p>}
                    </td>
                    <td><DeptBadge dept={i.department} /></td>
                    <td className="text-center">{i.quantity}</td>
                    <td className="text-right font-semibold">{kes(i.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* totals */}
          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{kes(bill.subtotal)}</span></div>
            {bill.taxAmount > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{kes(bill.taxAmount)}</span></div>
            )}
            {bill.discountAmount > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-red-600">- {kes(bill.discountAmount)}</span></div>
            )}
            <div className="flex justify-between pt-1 border-t border-[var(--mc-divider)]">
              <span className="font-extrabold text-base">TOTAL PAID</span>
              <span className="font-extrabold text-xl text-[var(--mc-primary)]">{kes(bill.totalAmount)}</span>
            </div>
          </div>

          {bill.notes && (
            <p className="text-[11px] text-muted-foreground border-t border-dashed border-[var(--mc-divider)] pt-2">
              Notes: {bill.notes}
            </p>
          )}
        </div>
      )}
    </PremiumModal>
  );
}
