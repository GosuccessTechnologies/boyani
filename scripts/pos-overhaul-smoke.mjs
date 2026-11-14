/**
 * POS OVERHAUL E2E SMOKE — Instruction 17 (Pharmacy POS) + 22 (Cashier POS).
 * Full chain: PRESCRIBED rx → partial dispense (billToVisit → paymentStatus
 * BILLED, visitId stored, dispensedQty incremented) → cashier pending-bills
 * DRUG charge with sourceRef=saleId → checkout → sale flipped COMPLETED.
 * Creates isolated fixtures, verifies, cleans everything up.
 *
 * Run: node scripts/pos-overhaul-smoke.mjs   (dev server must be on :3000)
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const BASE = 'http://127.0.0.1:3000';
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${extra ? '  [' + extra + ']' : ''}`);
  cond ? pass++ : fail++;
};

async function login(username, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error(`login ${username} → HTTP ${r.status}`);
  return (await r.json()).token;
}
const api = async (tok, path) => {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw new Error(`GET ${path} → HTTP ${r.status}`);
  return r.json();
};
const post = async (tok, path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`POST ${path} → HTTP ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  return d;
};

let patient, visit, rx, drug1, drug2, sale, sale2, billOut;
try {
  // ── fixtures ──
  drug1 = await db.drug.findFirst({ where: { isActive: true, stock: { gt: 50 } } });
  drug2 = await db.drug.findFirst({ where: { isActive: true, stock: { gt: 50 }, id: { not: drug1.id } } });
  patient = await db.patient.create({ data: { patientNo: 'PAT-E2E99', firstName: 'E2E', lastName: 'Smoke', phone: '0700999001', paymentMode: 'CASH', gender: 'MALE', dateOfBirth: new Date('1990-01-01') } });
  visit = await db.visit.create({ data: { visitNo: 'VIS-E2E99', patientId: patient.id, status: 'WAITING_PHARMACY', visitType: 'WALK_IN', visitDate: new Date() } });
  rx = await db.prescription.create({
    data: {
      prescriptionNo: 'PRS-E2E99', patientId: patient.id, visitId: visit.id, status: 'PRESCRIBED',
      items: {
        create: [
          { drugId: drug1.id, drugName: drug1.name, dosage: '500mg', frequency: '2x daily', duration: '3 days', quantity: 10, unitPrice: drug1.unitPrice, totalPrice: drug1.unitPrice * 10 },
          { drugId: drug2.id, drugName: drug2.name, dosage: '250mg', frequency: '1x daily', duration: '5 days', quantity: 5, unitPrice: drug2.unitPrice, totalPrice: drug2.unitPrice * 5 },
        ],
      },
    },
    include: { items: true },
  });
  const stock1Before = drug1.stock, stock2Before = drug2.stock;
  console.log(`fixtures: drug1=${drug1.name} (${drug1.code}) · drug2=${drug2.name} (${drug2.code})`);

  // ── pharmacist ──
  const phTok = await login('pharmacist', 'Pharma123!');

  // PH-8: drugs GET carries counterShelf + rackLocation
  const drugsRes = await api(phTok, `/api/pharmacy-pos?section=drugs&search=${encodeURIComponent(drug1.name)}`);
  const d1 = drugsRes.drugs.find(d => d.id === drug1.id);
  check('PH-8 GET drugs includes counterShelf', !!d1 && 'counterShelf' in d1, `counterShelf="${d1?.counterShelf}"`);
  check('PH-8 GET drugs includes rackLocation', !!d1 && 'rackLocation' in d1, `rackLocation="${d1?.rackLocation}"`);

  // PH-4: prescriptions?patientId filter
  const rxA = await api(phTok, `/api/pharmacy-pos?section=prescriptions&patientId=${patient.id}`);
  check('PH-4 prescriptions?patientId filters to this patient', rxA.prescriptions.length === 1 && rxA.prescriptions[0].id === rx.id);
  const rxB = await api(phTok, '/api/pharmacy-pos?section=prescriptions');
  check('PH-4 prescriptions (unfiltered) still lists the rx', rxB.prescriptions.some(x => x.id === rx.id));
  const rxLoad = rxA.prescriptions[0];
  check('PH-4 rx items carry dispensedQty (remaining-qty loader)', rxLoad.items.every(i => typeof i.dispensedQty === 'number'));

  // patient-visit resolves the active visit (billToVisit linkage)
  const pv = await api(phTok, `/api/pharmacy-pos?section=patient-visit&patientId=${patient.id}`);
  check('PH patient-visit resolves the WAITING_PHARMACY visit', pv.visit?.id === visit.id, pv.visit?.visitNo);

  // PH-5/6: POST sale — partial dispense (4 of 10) billed to visit
  sale = (await post(phTok, '/api/pharmacy-pos', {
    items: [{ drugId: drug1.id, drugName: drug1.name, quantity: 4, dosageInstruction: '500mg · 2x daily · 3 days' }],
    patientId: patient.id, patientName: 'E2E Smoke', patientPhone: '0700999001',
    billToVisit: true, visitId: visit.id, prescriptionId: rx.id, discount: 0,
  })).sale;
  check('PH-6 Complete Dispense → paymentStatus BILLED', sale.paymentStatus === 'BILLED');
  check('PH-5 visitId stored on PharmacySale', sale.visitId === visit.id);
  check('PH-6 paymentMethod BILLED_TO_VISIT + no receiptNo yet', sale.paymentMethod === 'BILLED_TO_VISIT' && sale.receiptNo === '');

  const rxAfter = await db.prescription.findUnique({ where: { id: rx.id }, include: { items: true } });
  const item1After = rxAfter.items.find(i => i.drugId === drug1.id);
  const item2After = rxAfter.items.find(i => i.drugId === drug2.id);
  check('PH-5 dispensedQty incremented 0 → 4 (prescriptionId+drugId match)', item1After.dispensedQty === 4);
  check('PH-5 other rx lines untouched', item2After.dispensedQty === 0);
  check('PH-5 rx status → PARTIALLY_DISPENSED', rxAfter.status === 'PARTIALLY_DISPENSED');
  const stock1After = (await db.drug.findUnique({ where: { id: drug1.id } })).stock;
  check('stock decremented by 4 inside the sale transaction', stock1After === stock1Before - 4, `${stock1Before} → ${stock1After}`);

  // walk-in Complete Sale path (cash at counter, no visit)
  sale2 = (await post(phTok, '/api/pharmacy-pos', {
    items: [{ drugId: drug2.id, drugName: drug2.name, quantity: 1 }],
    patientName: 'Walk-in Smoke', paymentMethod: 'CASH', billToVisit: false, discount: 0,
  })).sale;
  check('PH-6 walk-in Complete Sale → COMPLETED + RXN receipt', sale2.paymentStatus === 'COMPLETED' && sale2.receiptNo.startsWith('RXN-'));

  // ── cashier ──
  const caTok = await login('cashier', 'Cashier123!');
  const pb = await api(caTok, '/api/pos?tab=pending-bills');
  const card = pb.pending.find(v => v.visitId === visit.id);
  check('CA-2 pending-bills shows the visit card', !!card);
  const drugCharge = card?.charges.find(c => c.sourceRef === sale.id);
  check('CA-2 BILLED sale appears as DRUG charge with sourceRef=saleId', !!drugCharge && drugCharge.itemType === 'DRUG');
  check('CA-2 sale line carries its saleNo', !!drugCharge?.saleNo && drugCharge.saleNo === sale.saleNo);
  const rxRemaining = card?.charges.find(c => !c.sourceRef && c.itemType === 'DRUG' && c.name.includes(drug1.name));
  check('CA-2 remaining rx qty (6 of 10) also chargeable', !!rxRemaining && rxRemaining.quantity === 6);
  check('CA-1 card totals numeric (bold total + SHA/cash split fields)', card && typeof card.totalCharges === 'number' && typeof card.shaTotal === 'number' && typeof card.cashTotal === 'number');

  // checkout collecting ONLY the billed pharmacy-sale charge
  billOut = await post(caTok, '/api/pos', {
    visitId: visit.id, patientId: patient.id, paymentMode: 'CASH',
    charges: [drugCharge], notes: 'E2E smoke checkout',
  });
  check('CA-2 checkout creates the bill', !!billOut.bill?.billNo, billOut.bill?.billNo);
  const billItem = billOut.bill.items[0];
  check('CA-2 bill item keeps itemType DRUG + sourceRef', billItem.itemType === 'DRUG' && billItem.sourceRef === sale.id);

  const saleAfter = await db.pharmacySale.findUnique({ where: { id: sale.id } });
  check('CA-2 collected sale flipped to COMPLETED (method recorded)', saleAfter.paymentStatus === 'COMPLETED' && saleAfter.paymentMethod === 'CASH');
  const visitAfter = await db.visit.findUnique({ where: { id: visit.id } });
  check('visit marked COMPLETED by checkout', visitAfter.status === 'COMPLETED');
  // sale-linked DRUG charges carry no drugId → no double stock deduction at cashier
  const stock1Final = (await db.drug.findUnique({ where: { id: drug1.id } })).stock;
  check('no double stock deduction for the sale-linked charge', stock1Final === stock1Before - 4, `${stock1Final} vs ${stock1Before - 4}`);
  const stock2Final = (await db.drug.findUnique({ where: { id: drug2.id } })).stock;
  check('walk-in sale stock deducted once', stock2Final === stock2Before - 1, `${stock2Before} → ${stock2Final}`);
} catch (e) {
  console.error('E2E ERROR:', e.message);
  fail++;
} finally {
  // ── cleanup (children → parents, scoped to fixtures only) ──
  try {
    const refs = [sale?.saleNo, sale2?.saleNo, billOut?.bill?.billNo].filter(Boolean);
    const ids = [sale?.id, sale2?.id, billOut?.bill?.id].filter(Boolean);
    if (billOut?.bill?.id) {
      await db.payment.deleteMany({ where: { billId: billOut.bill.id } });
      await db.bill.deleteMany({ where: { id: billOut.bill.id } });
    }
    if (sale?.id) await db.pharmacySale.deleteMany({ where: { id: sale.id } });
    if (sale2?.id) await db.pharmacySale.deleteMany({ where: { id: sale2.id } });
    if (refs.length) await db.drugStockMovement.deleteMany({ where: { reference: { in: refs } } });
    if (rx?.id) await db.prescription.deleteMany({ where: { id: rx.id } });
    if (visit?.id) await db.visit.deleteMany({ where: { id: visit.id } });
    if (patient?.id) await db.patient.deleteMany({ where: { id: patient.id } });
    if (drug1?.id) await db.drug.update({ where: { id: drug1.id }, data: { stock: drug1.stock } });
    if (drug2?.id) await db.drug.update({ where: { id: drug2.id }, data: { stock: drug2.stock } });
    if (ids.length) await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    console.log('cleanup done (fixtures removed, stock restored)');
  } catch (e) {
    console.error('CLEANUP ERROR:', e.message);
  }
  await db.$disconnect();
}
console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
