import { db } from '../src/lib/db';

/**
 * POS SMOKE TEST CLEANUP — removes all data created by scripts/pos-smoke*.sh:
 *  - 'Smoke CashierPOS' patients (+ their visits, quick-test bills, checkout
 *    bills & payments)
 *  - 'Smoke Walk-in' pharmacy sale (+ stock restore + stock movements)
 *  - today's admin attendance record (check-in/check-out smoke)
 * Leaves audit logs (append-only system trail) untouched.
 */
async function main() {
  // ── 1. smoke patients ──
  const patients = await db.patient.findMany({ where: { firstName: 'Smoke', lastName: 'CashierPOS' } });
  for (const p of patients) {
    const bills = await db.bill.findMany({ where: { patientId: p.id }, select: { id: true, billNo: true } });
    for (const b of bills) {
      await db.payment.deleteMany({ where: { billId: b.id } });
      await db.bill.delete({ where: { id: b.id } }); // items cascade
      console.log(`deleted bill ${b.billNo}`);
    }
    const visits = await db.visit.findMany({ where: { patientId: p.id }, select: { id: true, visitNo: true } });
    for (const v of visits) {
      await db.visit.delete({ where: { id: v.id } });
      console.log(`deleted visit ${v.visitNo}`);
    }
    await db.patient.delete({ where: { id: p.id } });
    console.log(`deleted patient ${p.patientNo}`);
  }

  // ── 2. smoke pharmacy sale (restore stock + movements) ──
  const sales = await db.pharmacySale.findMany({ where: { patientName: 'Smoke Walk-in' }, include: { items: true } });
  for (const s of sales) {
    for (const item of s.items) {
      if (item.drugId) {
        await db.drug.update({ where: { id: item.drugId }, data: { stock: { increment: item.quantity } } });
        console.log(`restored ${item.quantity} unit(s) of drug ${item.drugId}`);
      }
    }
    await db.drugStockMovement.deleteMany({ where: { reference: s.saleNo } });
    await db.pharmacySale.delete({ where: { id: s.id } }); // items cascade
    console.log(`deleted pharmacy sale ${s.saleNo}`);
  }

  // ── 3. today's admin attendance record ──
  const admin = await db.user.findUnique({ where: { username: 'admin' } });
  if (admin) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const rec = await db.attendanceRecord.findUnique({ where: { userId_date: { userId: admin.id, date: today } } });
    if (rec) {
      await db.attendanceRecord.delete({ where: { id: rec.id } });
      console.log('deleted admin attendance record for today');
    }
  }

  // ── sanity ──
  const leftoverPatients = await db.patient.count({ where: { firstName: 'Smoke' } });
  const leftoverSales = await db.pharmacySale.count({ where: { patientName: 'Smoke Walk-in' } });
  console.log(`leftover smoke patients: ${leftoverPatients}, smoke sales: ${leftoverSales}`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
