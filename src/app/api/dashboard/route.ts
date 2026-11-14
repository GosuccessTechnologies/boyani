import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * DASHBOARD API — aggregate stats per portal role.
 * ?portal=facility|pharmacy|doctor|registrar|cashier|nursing|lab|hr|inventory|website
 */

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const portal = searchParams.get('portal') || 'facility';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

    if (portal === 'facility' && auth.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // ── FACILITY (admin) ──
    if (portal === 'facility') {
      const [
        totalPatients, todayVisits, activeAdmissions, todayRevenue,
        pendingAppointments, lowStockDrugs, unpaidBills, totalStaff,
        newApplications, unresolvedInquiries,
      ] = await Promise.all([
        db.patient.count({ where: { isActive: true } }),
        db.visit.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
        db.admission.count({ where: { status: 'ACTIVE' } }),
        db.bill.aggregate({ where: { createdAt: { gte: today, lt: tomorrow }, status: 'PAID' }, _sum: { totalAmount: true } }),
        db.appointment.count({ where: { status: 'PENDING' } }),
        db.drug.count({ where: { stock: { lte: 10 } } }),
        db.bill.aggregate({ where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, _sum: { totalAmount: true } }),
        db.employee.count({ where: { isActive: true } }),
        db.jobApplication.count({ where: { status: 'RECEIVED' } }),
        db.contactMessage.count({ where: { status: 'NEW' } }),
      ]);

      const weekRevenue = await db.bill.aggregate({ where: { createdAt: { gte: weekAgo }, status: 'PAID' }, _sum: { totalAmount: true } });

      // Revenue trend last 7 days
      const revenueTrend: Array<{ day: string; revenue: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        const agg = await db.bill.aggregate({ where: { createdAt: { gte: d, lt: next }, status: 'PAID' }, _sum: { totalAmount: true } });
        revenueTrend.push({ day: d.toLocaleDateString('en-US', { weekday: 'short' }), revenue: agg._sum.totalAmount || 0 });
      }

      // Department revenue breakdown (last 30 days)
      const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1);
      const billItems = await db.billItem.findMany({
        where: { bill: { createdAt: { gte: monthAgo }, status: 'PAID' } },
        select: { department: true, totalPrice: true },
      });
      const deptRevenue: Record<string, number> = {};
      for (const bi of billItems) {
        const dept = bi.department || 'Clinical';
        deptRevenue[dept] = (deptRevenue[dept] || 0) + bi.totalPrice;
      }
      const departmentBreakdown = Object.entries(deptRevenue).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

      return NextResponse.json({
        kpis: {
          totalPatients, todayVisits, activeAdmissions,
          todayRevenue: todayRevenue._sum.totalAmount || 0,
          weekRevenue: weekRevenue._sum.totalAmount || 0,
          pendingAppointments, lowStockDrugs,
          unpaidBillsAmount: unpaidBills._sum.totalAmount || 0,
          totalStaff, newApplications, unresolvedInquiries,
        },
        revenueTrend, departmentBreakdown,
      });
    }

    // ── PHARMACY ──
    if (portal === 'pharmacy') {
      const isAdmin = auth.user.role === 'ADMIN';
      const saleWhere: Record<string, unknown> = { createdAt: { gte: today, lt: tomorrow } };
      if (!isAdmin) saleWhere.pharmacistId = auth.user.id;
      const [todaySales, totalDrugs, lowStock, expiringSoon, pendingPrescriptions, stockValue] = await Promise.all([
        db.pharmacySale.findMany({ where: saleWhere, include: { items: true } }),
        db.drug.count({ where: { isActive: true } }),
        db.drug.count({ where: { stock: { lte: 10 } } }),
        db.drug.count({ where: { expiryDate: { lte: new Date(Date.now() + 90 * 864e5), gte: new Date() } } }),
        db.prescription.count({ where: { status: { in: ['PRESCRIBED', 'PARTIALLY_DISPENSED'] } } }),
        db.drug.findMany({ where: { isActive: true }, select: { stock: true, unitPrice: true } }),
      ]);
      return NextResponse.json({
        kpis: {
          todaySalesCount: todaySales.length,
          todayRevenue: todaySales.reduce((s, x) => s + x.totalAmount, 0),
          todayItems: todaySales.reduce((s, x) => s + x.items.reduce((is, i) => is + i.quantity, 0), 0),
          totalDrugs, lowStock, expiringSoon, pendingPrescriptions,
          stockValue: stockValue.reduce((s, d) => s + d.stock * d.unitPrice, 0),
          scope: isAdmin ? 'FACILITY' : 'PERSONAL',
        },
      });
    }

    // ── DOCTOR ──
    if (portal === 'doctor') {
      const [todayAppointments, pendingAppointments, activeConsultations, myPatients, pendingLabForMe] = await Promise.all([
        db.appointment.count({ where: { doctorId: auth.user.id, appointmentDate: { gte: today, lt: tomorrow }, status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] } } }),
        db.appointment.count({ where: { doctorId: auth.user.id, status: 'PENDING' } }),
        db.consultation.count({ where: { doctorId: auth.user.id, status: 'IN_PROGRESS' } }),
        db.consultation.count({ where: { doctorId: auth.user.id } }),
        db.labOrder.count({ where: { orderedById: auth.user.id, status: { in: ['PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS'] } } }),
      ]);
      const upcoming = await db.appointment.findMany({
        where: { doctorId: auth.user.id, appointmentDate: { gte: today }, status: { in: ['PENDING', 'CONFIRMED'] } },
        orderBy: { appointmentDate: 'asc' }, take: 8,
      });
      return NextResponse.json({ kpis: { todayAppointments, pendingAppointments, activeConsultations, myPatients, pendingLabForMe }, upcoming });
    }

    // ── REGISTRAR ──
    if (portal === 'registrar') {
      const [todayRegistrations, todayVisits, totalPatients, activeVisits, pendingBills] = await Promise.all([
        db.patient.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
        db.visit.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
        db.patient.count({ where: { isActive: true } }),
        db.visit.count({ where: { status: { in: ['ACTIVE', 'WAITING_LAB', 'WAITING_DOCTOR', 'WAITING_PHARMACY'] } } }),
        db.bill.count({ where: { status: 'UNPAID' } }),
      ]);
      return NextResponse.json({ kpis: { todayRegistrations, todayVisits, totalPatients, activeVisits, pendingBills } });
    }

    // ── CASHIER ──
    if (portal === 'cashier') {
      const payWhere: Record<string, unknown> = { createdAt: { gte: today, lt: tomorrow }, receivedById: auth.user.role === 'ADMIN' ? undefined : auth.user.id };
      if (auth.user.role !== 'ADMIN') payWhere.receivedById = auth.user.id; else delete payWhere.receivedById;
      const [todayPayments, pendingBills, unpaidAmount] = await Promise.all([
        db.payment.findMany({ where: payWhere }),
        db.bill.count({ where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } } }),
        db.bill.aggregate({ where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, _sum: { totalAmount: true } }),
      ]);
      const readyVisits = await db.visit.count({ where: { status: 'READY_FOR_PAYMENT' } });
      return NextResponse.json({
        kpis: {
          todayCollections: todayPayments.length,
          todayCash: todayPayments.filter(p => p.method === 'CASH').reduce((s, p) => s + p.amount, 0),
          todaySha: todayPayments.filter(p => p.method === 'SHA').reduce((s, p) => s + p.amount, 0),
          todayMpesa: todayPayments.filter(p => p.method === 'MPESA').reduce((s, p) => s + p.amount, 0),
          pendingBills, unpaidAmount: unpaidAmount._sum.totalAmount || 0, readyVisits,
        },
      });
    }

    // ── NURSING ──
    if (portal === 'nursing') {
      const [activeAdmissions, availableBeds, occupiedBeds, todayVitals, activeVisits] = await Promise.all([
        db.admission.count({ where: { status: 'ACTIVE' } }),
        db.bed.count({ where: { status: 'AVAILABLE' } }),
        db.bed.count({ where: { status: 'OCCUPIED' } }),
        db.vitalRecord.count({ where: { recordedAt: { gte: today, lt: tomorrow } } }),
        db.visit.count({ where: { status: 'ACTIVE' } }),
      ]);
      const wardBoard = await db.ward.findMany({ include: { beds: true, _count: { select: { beds: true } } } });
      return NextResponse.json({
        kpis: { activeAdmissions, availableBeds, occupiedBeds, todayVitals, activeVisits },
        wards: wardBoard.map(w => ({
          name: w.name, wardType: w.wardType, total: w.beds.length,
          occupied: w.beds.filter(b => b.status === 'OCCUPIED').length,
          available: w.beds.filter(b => b.status === 'AVAILABLE').length,
        })),
      });
    }

    // ── LAB ──
    if (portal === 'lab') {
      const [pendingOrders, inProgress, completedToday, totalTests, urgentQueue] = await Promise.all([
        db.labOrder.count({ where: { status: { in: ['PENDING', 'SAMPLE_COLLECTED'] } } }),
        db.labOrder.count({ where: { status: 'IN_PROGRESS' } }),
        db.labOrder.count({ where: { status: { in: ['COMPLETED', 'VERIFIED'] }, updatedAt: { gte: today, lt: tomorrow } } }),
        db.labTest.count({ where: { isActive: true } }),
        db.labOrder.count({ where: { priority: { in: ['URGENT', 'STAT'] }, status: { in: ['PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS'] } } }),
      ]);
      const queue = await db.labOrder.findMany({
        where: { status: { in: ['PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS'] } },
        include: { patient: { select: { patientNo: true, firstName: true, lastName: true } }, items: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }], take: 10,
      });
      return NextResponse.json({ kpis: { pendingOrders, inProgress, completedToday, totalTests, urgentQueue }, queue });
    }

    // ── HR ──
    if (portal === 'hr') {
      const [totalEmployees, activeEmployees, openPositions, applications, pendingPayrolls, onLeaveToday] = await Promise.all([
        db.employee.count(),
        db.employee.count({ where: { isActive: true } }),
        db.jobPosting.count({ where: { status: 'OPEN', isPublic: true } }),
        db.jobApplication.count({ where: { status: { in: ['RECEIVED', 'UNDER_REVIEW', 'SHORTLISTED'] } } }),
        db.payrollRecord.count({ where: { status: 'DRAFT' } }),
        db.attendanceRecord.count({ where: { date: today, status: 'ON_LEAVE' } }),
      ]);
      return NextResponse.json({ kpis: { totalEmployees, activeEmployees, openPositions, applications, pendingPayrolls, onLeaveToday } });
    }

    // ── INVENTORY ──
    if (portal === 'inventory') {
      const [totalItems, lowStock, assignedItems, totalValue, categories] = await Promise.all([
        db.inventoryItem.count({ where: { isActive: true } }),
        db.inventoryItem.count({ where: { isActive: true } }).then(async () => {
          const items = await db.inventoryItem.findMany({ where: { isActive: true }, select: { quantity: true, reorderLevel: true } });
          return items.filter(i => i.quantity <= i.reorderLevel).length;
        }),
        db.inventoryItem.count({ where: { isActive: true, assignedTo: { not: '' } } }),
        db.inventoryItem.aggregate({ where: { isActive: true }, _sum: { unitCost: true } }),
        db.inventoryItem.groupBy({ by: ['category'], where: { isActive: true }, _count: true }),
      ]);
      return NextResponse.json({
        kpis: {
          totalItems, lowStock, assignedItems,
          totalValue: totalValue._sum.unitCost || 0,
          categories: categories.map(c => ({ name: c.category, count: c._count })),
        },
      });
    }

    // ── WEBSITE ──
    if (portal === 'website') {
      const [publishedPages, newsCount, downloads, inquiries, newInquiries, activeSlider, appointmentsToday] = await Promise.all([
        db.webPage.count({ where: { isPublic: true } }),
        db.newsPost.count({ where: { isPublic: true } }),
        db.download.count({ where: { isPublic: true } }),
        db.contactMessage.count(),
        db.contactMessage.count({ where: { status: 'NEW' } }),
        db.slider.count({ where: { isActive: true } }),
        db.appointment.count({ where: { createdAt: { gte: today, lt: tomorrow }, source: 'WEBSITE' } }),
      ]);
      return NextResponse.json({ kpis: { publishedPages, newsCount, downloads, inquiries, newInquiries, activeSlider, appointmentsToday } });
    }

    return NextResponse.json({ error: 'Unknown portal' }, { status: 400 });
  } catch (error) {
    console.error('Dashboard GET error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
