import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getDateFilter, money } from '@/lib/api';

/**
 * PROFIT & LOSS API — adapted for Boyani Health Dispensary:
 *
 * BillItem rows (services/labs/beds/consultations)
 * + online OrderItems                 → + PharmacySaleItem rows (drug counter sales)
 * product/branch/cashier filters      → department/category/cashier/pharmacist filters
 * bestSelling/highestProfit           → topRevenueService & topRevenueDrug
 * payment breakdown                   → payment method mix incl. SHA insurance
 *
 * Instruction 18b fixes:
 *  (a) Clinical cost basis (was cost=0):
 *      - DRUG bill items: PharmacySaleItem unitCost snapshot via sourceRef (PharmacySale id)
 *        → else Drug.unitCost by name match → else estimated 55% of price (flagged 'ESTIMATED').
 *      - SERVICE/LAB/CONSULTATION/ADMISSION_BED items: cost = pl_service_cost_ratio × revenue
 *        (CompanyConfig key, default '0.45', upserted when missing — read at runtime).
 *  (b) Pharmacy revenue includes ALL sales with paymentStatus COMPLETED **and** BILLED
 *      (BILLED = 'pending collection', labelled in trends); sales already collected at the
 *      cashier (PAID-bill DRUG item carries sourceRef = sale id) are counted once via the
 *      clinical bill item instead, so collected billed sales are never double-counted.
 *  (c) Per-source summaries with costBasis flags + summary cost-basis / pending-collection
 *      exposure for the admin UI's estimated-basis notes.
 */

async function getAuthUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) return null;
  const session = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;
  return session.user;
}

type CostBasis = 'SNAPSHOT' | 'DRUG_CURRENT' | 'ESTIMATED' | 'RATIO' | 'NONE';

interface PLItem {
  itemName: string;
  category: string;
  department: string;
  quantity: number;
  unitPrice: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  margin: number;
  itemType: string;
  date: Date;
  cashierId: string | null;
  paymentMethod: string;
  source: 'CLINICAL' | 'PHARMACY';
  refNo: string;
  patientName: string;
  costBasis: CostBasis;
  pendingCollection: boolean;
}

const R2 = (n: number) => Math.round(n * 100) / 100;

/** Facility-configurable service cost ratio (Instruction 18b) — default 0.45, upserted when missing. */
async function getServiceCostRatio(): Promise<number> {
  const cfg = await db.companyConfig.findUnique({ where: { key: 'pl_service_cost_ratio' } });
  if (cfg) {
    const v = parseFloat(cfg.value);
    if (!isNaN(v) && v >= 0 && v <= 1) return v;
  }
  // Upsert the default so admins can discover & tune it (no seed change needed).
  await db.companyConfig.upsert({
    where: { key: 'pl_service_cost_ratio' },
    create: { key: 'pl_service_cost_ratio', value: '0.45' },
    update: {},
  }).catch(() => { /* non-fatal */ });
  return 0.45;
}

/** Bill-item name → unit cost lookup by drug name (prescription charges carry no sourceRef). */
function findDrugCost(billItemName: string, drugIndex: Array<{ name: string; unitCost: number }>): number | null {
  const norm = (s: string) => s.trim().toLowerCase();
  const raw = norm(billItemName);
  if (!raw) return null;
  const stripped = raw.replace(/\s*\(.*\)\s*$/, '').trim(); // drop "(dosage)" suffix
  let hit = drugIndex.find(d => norm(d.name) === stripped || norm(d.name) === raw);
  if (!hit) hit = drugIndex.find(d => stripped.startsWith(norm(d.name)) || norm(d.name).startsWith(stripped));
  return hit && hit.unitCost > 0 ? hit.unitCost : null;
}

// GET: Profit & Loss data with filters and pagination (ADMIN only)
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateFilter = getDateFilter(searchParams);
    const department = searchParams.get('department') || '';
    const category = searchParams.get('category') || '';
    const item = searchParams.get('item') || '';
    const cashierId = searchParams.get('cashier') || '';
    const pharmacistId = searchParams.get('pharmacist') || '';
    const itemType = searchParams.get('itemType') || '';
    const source = searchParams.get('source') || ''; // CLINICAL | PHARMACY
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('perPage') || '50');

    const serviceCostRatio = await getServiceCostRatio();

    // ─── Fetch clinical billing items (BillItem of PAID bills) ───
    const billWhere: Record<string, unknown> = { status: 'PAID' };
    if (Object.keys(dateFilter).length > 0) billWhere.createdAt = dateFilter;
    if (cashierId) billWhere.cashierId = cashierId;

    const billItemWhere: Record<string, unknown> = { bill: billWhere };
    if (itemType) billItemWhere.itemType = itemType;

    let billItems: Array<{
      itemType: string; itemName: string; quantity: number; unitPrice: number; totalPrice: number;
      department: string; sourceRef: string;
      service?: { name: string; category: string } | null;
      bill: { createdAt: Date; cashierId: string; paymentMode: string; billNo: string; patient?: { firstName: string; lastName: string } | null };
    }> = [];
    if (source !== 'PHARMACY') {
      billItems = await db.billItem.findMany({
        where: billItemWhere as never,
        include: {
          service: { select: { name: true, category: true } },
          bill: {
            select: {
              createdAt: true, cashierId: true, paymentMode: true, billNo: true,
              patient: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { bill: { createdAt: 'desc' } },
      }) as typeof billItems;
    }

    // (b) dedupe: DRUG bill items whose sourceRef is a collected PharmacySale are counted
    // here (clinical side); the pharmacy side then skips those sales.
    const drugRefs = [...new Set(
      billItems.filter(bi => bi.itemType === 'DRUG' && bi.sourceRef).map(bi => bi.sourceRef),
    )];
    const refSales = drugRefs.length
      ? await db.pharmacySale.findMany({ where: { id: { in: drugRefs } }, include: { items: true } })
      : [];
    const refSaleMap = new Map(refSales.map(s => [s.id, s]));
    const collectedSaleIds = new Set(refSales.map(s => s.id)); // skip these in the pharmacy section

    // Drug name → current unitCost index (fallback cost basis for prescription DRUG charges)
    const drugIndex = await db.drug.findMany({
      where: { isActive: true },
      select: { name: true, unitCost: true },
    });

    const DRUG_COST_ESTIMATE = 0.55; // last-resort estimate for unresolvable drug costs

    const clinicalPlItems: PLItem[] = billItems.map(bi => {
      const revenue = bi.totalPrice || 0;
      const quantity = bi.quantity || 1;
      let cost = 0;
      let costBasis: CostBasis = 'NONE';

      if (bi.itemType === 'DRUG') {
        const sale = bi.sourceRef ? refSaleMap.get(bi.sourceRef) : null;
        if (sale) {
          // (a) PharmacySaleItem unitCost snapshot via sourceRef (PharmacySale id)
          const snap = sale.items.find(si => si.drugName === bi.itemName) || sale.items[0];
          cost = (snap?.unitCost || 0) * quantity;
          costBasis = 'SNAPSHOT';
        } else {
          const drugCost = findDrugCost(bi.itemName, drugIndex);
          if (drugCost !== null) {
            cost = drugCost * quantity;
            costBasis = 'DRUG_CURRENT';
          } else {
            cost = revenue * DRUG_COST_ESTIMATE;
            costBasis = 'ESTIMATED';
          }
        }
      } else {
        // SERVICE / LAB / CONSULTATION / ADMISSION_BED → ratio × revenue
        cost = revenue * serviceCostRatio;
        costBasis = 'RATIO';
      }

      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return {
        itemName: bi.itemName || bi.service?.name || 'Item',
        category: bi.service?.category || (bi.itemType === 'DRUG' ? 'Pharmacy' : bi.itemType === 'ADMISSION_BED' ? 'Admission' : 'Clinical'),
        department: bi.department || 'Clinical',
        quantity,
        unitPrice: bi.unitPrice || 0,
        totalRevenue: R2(revenue),
        totalCost: R2(cost),
        profit: R2(profit),
        margin: R2(margin),
        itemType: bi.itemType,
        date: bi.bill.createdAt,
        cashierId: bi.bill.cashierId,
        paymentMethod: bi.bill.paymentMode,
        source: 'CLINICAL' as const,
        refNo: bi.bill.billNo,
        patientName: `${bi.bill.patient?.firstName || ''} ${bi.bill.patient?.lastName || ''}`.trim(),
        costBasis,
        pendingCollection: false,
      };
    });

    // ─── Fetch pharmacy counter sales (PharmacySaleItem) ───
    // (b) include COMPLETED **and** BILLED ("pending collection"); sales already collected
    // at the cashier (their DRUG bill item carries sourceRef = sale id) are skipped —
    // they are counted once via the clinical section above.
    const pharmWhere: Record<string, unknown> = { paymentStatus: { in: ['COMPLETED', 'BILLED'] } };
    if (Object.keys(dateFilter).length > 0) pharmWhere.createdAt = dateFilter;
    if (pharmacistId) pharmWhere.pharmacistId = pharmacistId;

    let pharmItems: Array<{
      drugName: string; quantity: number; unitPrice: number; unitCost: number; totalPrice: number;
      drug?: { name: string; category: string; unitCost: number } | null;
      sale: { id: string; createdAt: Date; pharmacistId: string; paymentMethod: string; paymentStatus: string; saleNo: string; patientName: string; billToVisit: boolean };
    }> = [];
    if (source !== 'CLINICAL') {
      pharmItems = await db.pharmacySaleItem.findMany({
        where: { sale: pharmWhere as never },
        include: {
          drug: { select: { name: true, category: true, unitCost: true } },
          sale: {
            select: {
              id: true, createdAt: true, pharmacistId: true, paymentMethod: true, paymentStatus: true,
              saleNo: true, patientName: true, billToVisit: true,
            },
          },
        },
        orderBy: { sale: { createdAt: 'desc' } },
      }) as typeof pharmItems;
    }

    const pharmacyPlItems: PLItem[] = pharmItems
      .filter(pi => !collectedSaleIds.has(pi.sale.id))
      .map(pi => {
        const quantity = pi.quantity || 1;
        const revenue = pi.totalPrice || 0;
        const snapshotCost = pi.unitCost || 0;
        const currentCost = pi.drug?.unitCost || 0;
        const cost = snapshotCost > 0
          ? snapshotCost * quantity
          : currentCost > 0 ? currentCost * quantity : 0;
        const costBasis: CostBasis = snapshotCost > 0 ? 'SNAPSHOT' : currentCost > 0 ? 'DRUG_CURRENT' : 'NONE';
        const profit = revenue - cost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return {
          itemName: pi.drugName || pi.drug?.name || 'Drug',
          category: pi.drug?.category || 'GENERAL',
          department: 'Pharmacy',
          quantity,
          unitPrice: pi.unitPrice || 0,
          totalRevenue: R2(revenue),
          totalCost: R2(cost),
          profit: R2(profit),
          margin: R2(margin),
          itemType: 'DRUG',
          date: pi.sale.createdAt,
          cashierId: null,
          paymentMethod: pi.sale.paymentMethod,
          source: 'PHARMACY' as const,
          refNo: pi.sale.saleNo,
          patientName: pi.sale.patientName || '',
          costBasis,
          pendingCollection: pi.sale.paymentStatus === 'BILLED',
        };
      });

    // Merge clinical + pharmacy items
    let allItems: PLItem[] = [...clinicalPlItems, ...pharmacyPlItems];

    // Apply department filter
    if (department) {
      allItems = allItems.filter(i => i.department === department);
    }
    // Apply category filter
    if (category) {
      allItems = allItems.filter(i => i.category === category);
    }
    // Apply item name search filter
    if (item) {
      const q = item.toLowerCase();
      allItems = allItems.filter(i => i.itemName.toLowerCase().includes(q));
    }

    // Sort by date descending
    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Summary (from ALL filtered items, not just page)
    const totalRevenue = allItems.reduce((s, i) => s + i.totalRevenue, 0);
    const totalCost = allItems.reduce((s, i) => s + i.totalCost, 0);
    const grossProfit = totalRevenue - totalCost;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Cost-basis exposure for the estimated-basis note on the stat hero
    const estimatedItems = allItems.filter(i => i.costBasis === 'ESTIMATED');
    const estimatedRevenue = estimatedItems.reduce((s, i) => s + i.totalRevenue, 0);
    const pendingCollectionRevenue = allItems.filter(i => i.pendingCollection).reduce((s, i) => s + i.totalRevenue, 0);
    const ratioRevenue = allItems.filter(i => i.costBasis === 'RATIO').reduce((s, i) => s + i.totalRevenue, 0);

    // (c) Per-source summaries with costBasis flags
    const bySource = (src: 'CLINICAL' | 'PHARMACY') => {
      const rows = allItems.filter(i => i.source === src);
      const rev = rows.reduce((s, i) => s + i.totalRevenue, 0);
      const cst = rows.reduce((s, i) => s + i.totalCost, 0);
      const basis: Record<string, number> = {};
      for (const r of rows) basis[r.costBasis] = (basis[r.costBasis] || 0) + 1;
      return {
        source: src,
        revenue: R2(rev),
        cost: R2(cst),
        profit: R2(rev - cst),
        margin: R2(rev > 0 ? ((rev - cst) / rev) * 100 : 0),
        items: rows.length,
        pendingCollectionRevenue: R2(rows.filter(i => i.pendingCollection).reduce((s, i) => s + i.totalRevenue, 0)),
        costBasis: basis,
      };
    };
    const sourceSummaries = [bySource('CLINICAL'), bySource('PHARMACY')];

    const itemQty: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};
    for (const it of allItems) {
      if (!itemQty[it.itemName]) itemQty[it.itemName] = { name: it.itemName, qty: 0, revenue: 0, profit: 0 };
      itemQty[it.itemName].qty += it.quantity;
      itemQty[it.itemName].revenue += it.totalRevenue;
      itemQty[it.itemName].profit += it.profit;
    }
    const bestSelling = Object.values(itemQty).sort((a, b) => b.qty - a.qty)[0] || null;
    const highestProfit = Object.values(itemQty).sort((a, b) => b.profit - a.profit)[0] || null;

    const deptRevenue: Record<string, number> = {};
    for (const it of allItems) deptRevenue[it.department] = (deptRevenue[it.department] || 0) + it.totalRevenue;
    const departmentBreakdown = Object.entries(deptRevenue)
      .map(([name, revenue]) => ({ name, revenue: R2(revenue) }))
      .sort((a, b) => b.revenue - a.revenue);

    const catRevenue: Record<string, number> = {};
    for (const it of allItems) catRevenue[it.category] = (catRevenue[it.category] || 0) + it.totalRevenue;
    const categoryBreakdown = Object.entries(catRevenue)
      .map(([name, revenue]) => ({ name, revenue: R2(revenue) }))
      .sort((a, b) => b.revenue - a.revenue);

    // Monthly trend (12 months) — pending = BILLED 'pending collection' revenue
    const monthlyTrend: { month: string; revenue: number; cost: number; profit: number; pending: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const monthItems = allItems.filter(it => {
        const itemDate = new Date(it.date);
        return itemDate.getFullYear() === d.getFullYear() && itemDate.getMonth() === d.getMonth();
      });
      const mRevenue = monthItems.reduce((s, it) => s + it.totalRevenue, 0);
      const mCost = monthItems.reduce((s, it) => s + it.totalCost, 0);
      monthlyTrend.push({
        month: monthLabel,
        revenue: R2(mRevenue),
        cost: R2(mCost),
        profit: R2(mRevenue - mCost),
        pending: R2(monthItems.filter(it => it.pendingCollection).reduce((s, it) => s + it.totalRevenue, 0)),
      });
    }

    // Top 10 by profit
    const topItems = Object.values(itemQty)
      .map(v => ({ name: v.name, qty: v.qty, revenue: R2(v.revenue), profit: R2(v.profit) }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    // Payment breakdown
    const paymentDist: Record<string, number> = {};
    for (const it of allItems) paymentDist[it.paymentMethod] = (paymentDist[it.paymentMethod] || 0) + it.totalRevenue;
    const paymentBreakdown = Object.entries(paymentDist).map(([method, amount]) => ({ method, amount: R2(amount) }));

    // Paginate items
    const total = allItems.length;
    const pagedItems = allItems.slice((page - 1) * perPage, page * perPage);

    return NextResponse.json({
      items: pagedItems,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      summary: {
        totalRevenue: R2(totalRevenue),
        totalCost: R2(totalCost),
        grossProfit: R2(grossProfit),
        grossMargin: R2(grossMargin),
        totalItems: allItems.reduce((s, i) => s + i.quantity, 0),
        bestSelling,
        highestProfit,
        serviceCostRatio,
        estimatedRevenue: R2(estimatedRevenue),
        estimatedCost: R2(estimatedItems.reduce((s, i) => s + i.totalCost, 0)),
        ratioRevenue: R2(ratioRevenue),
        pendingCollectionRevenue: R2(pendingCollectionRevenue),
      },
      sourceSummaries,
      departmentBreakdown,
      categoryBreakdown,
      monthlyTrend,
      topItems,
      paymentBreakdown,
    });
  } catch (error) {
    console.error('Profit-loss GET error:', error);
    return NextResponse.json({ error: 'Failed to compute profit & loss' }, { status: 500 });
  }
}
