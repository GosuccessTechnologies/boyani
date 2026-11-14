/**
 * Instruction 26 data fix (one-off, idempotent — safe to re-run):
 *
 *  1. The original seed wrote the account USERNAME into Employee.userId
 *     instead of the user id, which silently broke every employee↔user
 *     linkage (attendance display names + backfill, PWA check-in linking,
 *     self-service payroll). This script rewrites those rows to user ids.
 *  2. Backfills AttendanceRecord.employeeId for records that have a null
 *     employeeId but a matching Employee(userId) — the /api/attendance GET
 *     also does this lazily; the script just fixes existing rows up front.
 *  3. Seeds the PayrollConfig rate rows (PAYE bands, NSSF, SHIF tiers,
 *     housing levy) so HR → Settings has the keys and /api/payroll reads
 *     the configured rates.
 *
 * Usage: node scripts/hr-instr26-data-fix.mjs
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const PAYROLL_CONFIG_ROWS = [
  { key: 'paye_threshold', value: '24000', description: 'PAYE tax-free band start (KES)' },
  { key: 'paye_band_limit', value: '32333', description: 'PAYE upper boundary of the lower band (KES)' },
  { key: 'paye_lower_rate', value: '0.25', description: 'PAYE rate between threshold and band limit (decimal, e.g. 0.25)' },
  { key: 'paye_upper_rate', value: '0.30', description: 'PAYE rate above the band limit (decimal, e.g. 0.30)' },
  { key: 'paye_relief', value: '2400', description: 'PAYE personal relief (KES)' },
  { key: 'nssf_rate', value: '0.06', description: 'NSSF rate of basic salary (decimal, e.g. 0.06)' },
  { key: 'nssf_cap', value: '1080', description: 'NSSF maximum monthly deduction (KES)' },
  { key: 'shif_tier1_limit', value: '5999', description: 'SHIF tier 1 gross-pay limit (KES)' },
  { key: 'shif_tier1_amount', value: '150', description: 'SHIF tier 1 deduction (KES)' },
  { key: 'shif_tier2_limit', value: '7999', description: 'SHIF tier 2 gross-pay limit (KES)' },
  { key: 'shif_tier2_amount', value: '300', description: 'SHIF tier 2 deduction (KES)' },
  { key: 'shif_tier3_limit', value: '11999', description: 'SHIF tier 3 gross-pay limit (KES)' },
  { key: 'shif_tier3_amount', value: '400', description: 'SHIF tier 3 deduction (KES)' },
  { key: 'shif_tier4_limit', value: '19999', description: 'SHIF tier 4 gross-pay limit (KES)' },
  { key: 'shif_tier4_amount', value: '500', description: 'SHIF tier 4 deduction (KES)' },
  { key: 'shif_tier5_limit', value: '49999', description: 'SHIF tier 5 gross-pay limit (KES)' },
  { key: 'shif_tier5_amount', value: '750', description: 'SHIF tier 5 deduction (KES)' },
  { key: 'shif_tier6_amount', value: '1700', description: 'SHIF deduction above the tier-5 limit (KES)' },
  { key: 'housing_levy_rate', value: '0.015', description: 'Affordable Housing Levy rate of gross pay (decimal, e.g. 0.015)' },
];

async function main() {
  // ── 1. Employee.userId: username → user id ──
  const users = await db.user.findMany({ select: { id: true, username: true } });
  const idByUsername = new Map(users.map(u => [u.username, u.id]));
  const employees = await db.employee.findMany({ select: { id: true, userId: true, firstName: true, lastName: true } });
  let fixed = 0;
  for (const e of employees) {
    const userId = e.userId && idByUsername.get(e.userId);
    if (userId) {
      await db.employee.update({ where: { id: e.id }, data: { userId } });
      fixed++;
    }
  }
  console.log(`employee.userId rewritten (username → user id): ${fixed}`);

  // ── 2. Attendance backfill ──
  const linked = await db.employee.findMany({ select: { id: true, userId: true } });
  const employeeIdByUserId = new Map(linked.filter(e => e.userId).map(e => [e.userId, e.id]));
  const orphans = await db.attendanceRecord.findMany({ where: { employeeId: null }, select: { id: true, userId: true } });
  let backfilled = 0;
  for (const r of orphans) {
    const employeeId = employeeIdByUserId.get(r.userId);
    if (employeeId) {
      await db.attendanceRecord.update({ where: { id: r.id }, data: { employeeId } }).catch(() => {});
      backfilled++;
    }
  }
  console.log(`attendance records backfilled with employeeId: ${backfilled} of ${orphans.length} orphans`);

  // ── 3. PayrollConfig seeding (upsert, keeps admin-edited values) ──
  for (const row of PAYROLL_CONFIG_ROWS) {
    await db.payrollConfig.upsert({
      where: { key: row.key },
      create: row,
      update: { description: row.description }, // keep existing values, refresh descriptions
    });
  }
  const total = await db.payrollConfig.count();
  console.log(`payroll config rows present: ${total}`);
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
