import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * VITALS API — triage nurse / doctor vital signs records.
 * BMI is auto-computed from weight (kg) + height (cm) when not supplied.
 *
 * Instruction 23:
 *  - GET ?patientId= includes the recorder's name on every record ("by <name>").
 *  - GET ?mine=1&from=&to= — vitals recorded by the signed-in user in a period
 *    (powers My Assignments expansion).
 *  - GET ?care=1[&search=] — patients under the nurse's care: currently admitted
 *    inpatients + patients with recent vitals (powers "Patients Under My Care").
 */

const STAFF_ROLES = ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'CASHIER'];

/** Resolve recordedById → display names (VitalRecord has no User relation). */
async function recorderNames(recordedByIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(recordedByIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, username: true },
  });
  return new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`.trim() || u.username]));
}

// GET /api/vitals
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, STAFF_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId') || '';
    const visitId = searchParams.get('visitId') || '';
    const mine = searchParams.get('mine') === '1';
    const care = searchParams.get('care') === '1';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const search = searchParams.get('search') || '';

    // ── My vitals within a period (My Assignments expansion) ──
    if (mine) {
      const where: Record<string, unknown> = { recordedById: auth.user.id };
      if (from || to) {
        where.recordedAt = {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        };
      }
      if (patientId) where.patientId = patientId;

      const vitals = await db.vitalRecord.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        take: 300,
        include: {
          patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, gender: true, phone: true } },
        },
      });
      const nameMap = await recorderNames(vitals.map(v => v.recordedById));
      return NextResponse.json({
        vitals: vitals.map(v => ({ ...v, recordedByName: v.recordedById ? (nameMap.get(v.recordedById) || '') : '' })),
        total: vitals.length,
      });
    }

    // ── Patients under my care (admitted inpatients + recent vitals patients) ──
    if (care) {
      const since = new Date();
      since.setDate(since.getDate() - 14); // "recent" vitals window

      const [activeAdmissions, recentVitals] = await Promise.all([
        db.admission.findMany({
          where: { status: 'ACTIVE' },
          orderBy: { admissionDate: 'desc' },
          include: {
            patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, gender: true, phone: true, dateOfBirth: true } },
            bed: { include: { ward: { select: { name: true } } } },
          },
        }),
        db.vitalRecord.findMany({
          where: { recordedAt: { gte: since } },
          orderBy: { recordedAt: 'desc' },
          take: 400,
          include: { patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, gender: true, phone: true, dateOfBirth: true } } },
        }),
      ]);

      // Recorder names for the recent vitals shown on each card
      const careNameMap = await recorderNames(recentVitals.map(v => v.recordedById));
      const withRecorder = recentVitals.map(v => ({
        ...v,
        recordedByName: v.recordedById ? (careNameMap.get(v.recordedById) || '') : '',
      }));

      // Merge into one entry per patient (admissions take priority for ward info)
      interface CarePatient {
        id: string; patientNo: string; firstName: string; lastName: string; gender: string; phone: string;
        dateOfBirth: Date | null;
        admitted: boolean; admissionNo?: string; wardName?: string; bedNumber?: string; admissionDate?: Date;
        lastVitalsAt: Date | null; vitalsCount: number;
        lastVitals?: Record<string, unknown>;
      }
      const byId = new Map<string, CarePatient>();

      for (const adm of activeAdmissions) {
        const p = adm.patient;
        if (byId.has(p.id)) continue;
        byId.set(p.id, {
          id: p.id, patientNo: p.patientNo, firstName: p.firstName, lastName: p.lastName,
          gender: p.gender, phone: p.phone, dateOfBirth: p.dateOfBirth,
          admitted: true,
          admissionNo: adm.admissionNo,
          wardName: adm.bed?.ward?.name || '',
          bedNumber: adm.bed?.bedNumber || '',
          admissionDate: adm.admissionDate,
          lastVitalsAt: null,
          vitalsCount: 0,
        });
      }
      for (const v of withRecorder) {
        const p = v.patient;
        let entry = byId.get(p.id);
        if (!entry) {
          entry = {
            id: p.id, patientNo: p.patientNo, firstName: p.firstName, lastName: p.lastName,
            gender: p.gender, phone: p.phone, dateOfBirth: p.dateOfBirth,
            admitted: false, lastVitalsAt: null, vitalsCount: 0,
          };
          byId.set(p.id, entry);
        }
        if (!entry.lastVitalsAt) {
          entry.lastVitalsAt = v.recordedAt;
          entry.lastVitals = v as unknown as Record<string, unknown>;
        }
        entry.vitalsCount += 1;
      }

      let patients = [...byId.values()];
      if (search) {
        const q = search.toLowerCase();
        patients = patients.filter(p =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.patientNo.toLowerCase().includes(q) ||
          (p.phone || '').includes(q)
        );
      }
      // Admitted patients first, then most recent vitals
      patients.sort((a, b) => (Number(b.admitted) - Number(a.admitted)) || (new Date(b.lastVitalsAt || 0).getTime() - new Date(a.lastVitalsAt || 0).getTime()));

      return NextResponse.json({ patients, total: patients.length });
    }

    // ── Per-patient history (default) ──
    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { patientId };
    if (visitId) where.visitId = visitId;

    const [vitals, patient] = await Promise.all([
      db.vitalRecord.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        take: 50,
      }),
      db.patient.findUnique({
        where: { id: patientId },
        select: { patientNo: true, firstName: true, lastName: true, gender: true, dateOfBirth: true, bloodType: true, allergies: true },
      }),
    ]);

    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const nameMap = await recorderNames(vitals.map(v => v.recordedById));

    return NextResponse.json({
      vitals: vitals.map(v => ({ ...v, recordedByName: v.recordedById ? (nameMap.get(v.recordedById) || '') : '' })),
      items: vitals,
      patient,
    });
  } catch (error) {
    console.error('Vitals GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch vitals' }, { status: 500 });
  }
}

// POST /api/vitals — record vitals (auto-computes BMI from weight + height)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ['ADMIN', 'NURSE', 'DOCTOR']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      patientId, visitId, temperature, bloodPressureSystolic, bloodPressureDiastolic,
      pulse, respiratoryRate, weight, height, bmi, oxygenSaturation, bloodGlucose,
      painScore, notes,
    } = body;

    if (!patientId) return NextResponse.json({ error: 'patientId is required' }, { status: 400 });

    const patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const w = parseFloat(String(weight ?? 0)) || 0;
    const h = parseFloat(String(height ?? 0)) || 0;
    let computedBmi = parseFloat(String(bmi ?? 0)) || 0;
    if ((!computedBmi || computedBmi <= 0) && w > 0 && h > 0) {
      computedBmi = w / Math.pow(h / 100, 2);
    }

    const vital = await db.vitalRecord.create({
      data: {
        patientId,
        visitId: visitId || null,
        recordedById: auth.user.id,
        temperature: parseFloat(String(temperature ?? 0)) || 0,
        bloodPressureSystolic: parseInt(String(bloodPressureSystolic ?? 0), 10) || 0,
        bloodPressureDiastolic: parseInt(String(bloodPressureDiastolic ?? 0), 10) || 0,
        pulse: parseInt(String(pulse ?? 0), 10) || 0,
        respiratoryRate: parseInt(String(respiratoryRate ?? 0), 10) || 0,
        weight: w,
        height: h,
        bmi: Math.round(computedBmi * 100) / 100,
        oxygenSaturation: parseInt(String(oxygenSaturation ?? 0), 10) || 0,
        bloodGlucose: parseFloat(String(bloodGlucose ?? 0)) || 0,
        painScore: parseInt(String(painScore ?? 0), 10) || 0,
        notes: notes || '',
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id, action: 'VITALS_CREATE', entityName: 'VitalRecord', entityId: vital.id,
        details: `Vitals recorded for ${patient.patientNo}`,
        ipAddress: request.headers.get('x-forwarded-for') || '',
      },
    }).catch(() => {});

    return NextResponse.json({ vital, message: 'Vitals recorded' }, { status: 201 });
  } catch (error) {
    console.error('Vitals POST error:', error);
    return NextResponse.json({ error: 'Failed to record vitals' }, { status: 500 });
  }
}
