/**
 * BOYANI HEALTH DISPENSARY SEED — Vihiga dispensary & clinic sample data.
 * Run: npx tsx prisma/seed.ts
 *
 * Uses the SAME absolute-path DB resolver as the app runtime
 * (src/lib/db-path.ts) so seeding and the Next.js server always target the
 * identical database file (Instruction 3 fix).
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { resolveDatabaseUrl, databaseFilePath } from '../src/lib/db-path';

const db = new PrismaClient({ datasourceUrl: resolveDatabaseUrl() });
const hash = (p: string) => createHash('sha256').update(p).digest('hex');

async function main() {
  console.log('🌱 Seeding Boyani Health Dispensary…');

  // ═══ CLEAN ═══
  const tables = [
    'auditLog', 'session', 'payment', 'billItem', 'bill', 'quotationItem', 'quotation',
    'pharmacySaleItem', 'pharmacySale', 'drugStockMovement', 'prescriptionItem', 'prescription',
    'labOrderItem', 'labOrder', 'labTest', 'vitalRecord', 'admission', 'bed', 'ward',
    'deliveryRecord', 'vaccinationRecord', 'aNCRegistration', 'consultation', 'appointment',
    'visit', 'patient', 'attendanceRecord', 'payrollRecord', 'jobApplication', 'jobPosting',
    'staffAssignment', 'employee', 'inventoryMovement', 'inventoryItem', 'fileRecord',
    'homepageWidget', 'homepageDesign', 'menuItem', 'menu', 'slider', 'contactMessage',
    'galleryPhoto', 'galleryAlbum', 'testimonial', 'faq', 'newsPost', 'download', 'webPage',
    'doctorProfile', 'service', 'department', 'branch', 'companyConfig', 'attendanceConfig',
    'payrollConfig', 'siteSetting', 'theme', 'user',
    'websiteSubService', 'websiteService', 'userLoginHistory',
    'smsMessage', 'emailMessage', 'parcelRecord', 'callRecord',
  ];
  for (const t of tables) {
    await (db as unknown as Record<string, { deleteMany: () => Promise<unknown> }>)[t].deleteMany().catch(() => {});
  }

  // ═══ THEMES (10 presets) ═══
  const themes = [
    { name: 'Medical Teal', description: 'Calm clinical teal — default Boyani Health Dispensary identity', primary: '#0d9488', secondary: '#f59e0b', tertiary: '#0891b2', bgSidebar: '#FFFFFF', bgFooter: '#0f172a', bgCardHeader: '#134e4a', sidebarStyle: 'light', fontBody: 'Inter', fontHeading: 'Inter' },
    { name: 'Ocean Blue', description: 'Trust-inspiring deep ocean blue', primary: '#0284c7', secondary: '#f59e0b', tertiary: '#0ea5e9', bgSidebar: '#F8FAFC', bgFooter: '#0c1b33', bgCardHeader: '#0c4a6e', sidebarStyle: 'light', fontBody: 'Inter', fontHeading: 'Inter' },
    { name: 'Nairobi Green', description: 'Fresh healing green', primary: '#16a34a', secondary: '#eab308', tertiary: '#059669', bgSidebar: '#F7FDF9', bgFooter: '#12291a', bgCardHeader: '#14532d', sidebarStyle: 'light', fontBody: 'Inter', fontHeading: 'Inter' },
    { name: 'Sunset Orange', description: 'Warm energetic care', primary: '#ea580c', secondary: '#0891b2', tertiary: '#f97316', bgSidebar: '#FFF8F3', bgFooter: '#2a1608', bgCardHeader: '#9a3412', sidebarStyle: 'light', fontBody: 'Inter', fontHeading: 'Inter' },
    { name: 'Royal Purple', description: 'Premium specialist feel', primary: '#7c3aed', secondary: '#f59e0b', tertiary: '#a855f7', bgSidebar: '#FAF8FF', bgFooter: '#1e1035', bgCardHeader: '#4c1d95', sidebarStyle: 'light', fontBody: 'Inter', fontHeading: 'Inter' },
    { name: 'Rose Care', description: 'Gentle maternal & child tone', primary: '#e11d48', secondary: '#f59e0b', tertiary: '#fb7185', bgSidebar: '#FFF7F9', bgFooter: '#2b0d18', bgCardHeader: '#881337', sidebarStyle: 'light', fontBody: 'Inter', fontHeading: 'Inter' },
    { name: 'Dark Clinical', description: 'Dark-mode dashboard-forward', primary: '#14b8a6', secondary: '#f59e0b', tertiary: '#38bdf8', bgBody: '#0f172a', bgCard: '#1e293b', bgSidebar: '#0b1120', bgHeader: '#0f172a', bgFooter: '#0b1120', bgCardHeader: '#134e4a', textPrimary: '#e2e8f0', textSecondary: '#94a3b8', textMuted: '#64748b', dividerColor: '#263449', scrollbarColor: '#334155', scrollbarTrack: '#0f172a', sidebarStyle: 'dark', fontBody: 'Inter', fontHeading: 'Inter' },
    { name: 'Warm Neutral', description: 'Soft sand tones for wellness clinics', primary: '#0f766e', secondary: '#d97706', tertiary: '#5f7470', bgCard: '#faf6f0', bgSidebar: '#3d3833', bgFooter: '#3d3833', bgCardHeader: '#5f5648', dividerColor: '#e7ded2', fontBody: 'Inter', fontHeading: 'Inter' },
    { name: 'High Contrast', description: 'Accessibility-first sharp contrast', primary: '#000000', secondary: '#dc2626', tertiary: '#1f2937', bgSidebar: '#000000', bgFooter: '#000000', bgCardHeader: '#111827', fontBody: 'Inter', fontHeading: 'Inter' },
    { name: 'Pediatric Playful', description: 'Friendly palette for child-focused wings', primary: '#2563eb', secondary: '#ec4899', tertiary: '#22c55e', bgCard: '#f0f9ff', bgSidebar: '#F5F9FF', bgFooter: '#1e3a8a', bgCardHeader: '#1d4ed8', sidebarStyle: 'light', fontBody: 'Quicksand', fontHeading: 'Quicksand' },
  ];
  for (const t of themes) {
    await db.theme.create({ data: { ...t, isPreset: true } });
  }
  console.log('✓ 10 themes');

  // ═══ SITE SETTING ═══
  await db.siteSetting.create({
    data: { id: 'main', activeThemeId: 1, activeHomepageDesign: 1, activeHeaderDesign: 1, activeFooterDesign: 1, activeMenuDesign: 1, defaultSeoTitle: 'Boyani Health Dispensary — Quality Care, Compassionate Service', defaultSeoDescription: 'Comprehensive dispensary and healthcare services in Vihiga, Kenya. Book appointments online.' },
  });

  // ═══ COMPANY CONFIG ═══
  const config: Record<string, string> = {
    company_name: 'Boyani Health Dispensary',
    company_slogan: 'Quality Care, Compassionate Service',
    company_email: 'info@africandivinechurch.org',
    company_phone: '0750239057',
    emergency_phone: '0750239057',
    company_address: 'Boyani, Vihiga County',
    company_postal_address: 'Vihiga, Kenya',
    company_website: 'https://www.boyanihealth.africandivinechurch.org',
    currency: 'KES', currency_symbol: 'KSh',
    tax_rate: '16', enable_tax: 'false', pos_tax_enabled: 'false', pos_tax_rate: '16',
    pos_receipt_prefix: 'BHD', kra_pin: '',
    receipt_paper_size: 'A4', receipt_copies: '1',
    printer_footer_message: 'Thank you for choosing Boyani Health Dispensary. Get well soon!',
    printer_type: 'USB', printer_paper_width: '80mm', printer_chars_per_line: '48', printer_auto_cut: 'true',
    opening_hours: 'Mon–Sat 08:00–20:00',
    company_latitude: '0.0659', company_longitude: '34.7180',
    company_facebook: 'https://facebook.com/boyanihealth', company_twitter: 'https://x.com/boyanihealth',
    company_instagram: 'https://instagram.com/boyanihealth', company_youtube: 'https://youtube.com/@boyanihealth',
    company_whatsapp: '0750239057',
  };
  for (const [key, value] of Object.entries(config)) {
    await db.companyConfig.create({ data: { key, value } });
  }

  // ═══ BRANCH ═══
  await db.branch.create({
    data: { branchCode: 'BR-0001', name: 'Boyani Health Dispensary — Vihiga', county: 'Kakamega', town: 'Vihiga', address: 'Boyani, Vihiga County', phone: '0750239057', email: 'info@africandivinechurch.org', latitude: 0.0659, longitude: 34.7180, isMain: true },
  });
  await db.branch.create({
    data: { branchCode: 'BR-0002', name: 'Boyani Health Dispensary — Outreach Clinic', county: 'Kakamega', town: 'Vihiga', address: 'Vihiga Town, Vihiga County', phone: '0750239057', email: 'info@africandivinechurch.org', latitude: 0.0672, longitude: 34.7210 },
  });

  // ═══ USERS ═══
  const users = [
    { username: 'admin', email: 'admin@boyanihealth.africandivinechurch.org', firstName: 'Amina', lastName: 'Wanjiru', role: 'ADMIN', password: 'Admin123!', phone: '+254700000001' },
    { username: 'doctor', email: 'doctor@boyanihealth.africandivinechurch.org', firstName: 'James', lastName: 'Mutua', role: 'DOCTOR', password: 'Doctor123!', phone: '+254700000002' },
    { username: 'doctor2', email: 'doctor2@boyanihealth.africandivinechurch.org', firstName: 'Grace', lastName: 'Achieng', role: 'DOCTOR', password: 'Doctor123!', phone: '+254700000003' },
    { username: 'nurse', email: 'nurse@boyanihealth.africandivinechurch.org', firstName: 'Faith', lastName: 'Njeri', role: 'NURSE', password: 'Nurse123!', phone: '+254700000004' },
    { username: 'pharmacist', email: 'pharmacy@boyanihealth.africandivinechurch.org', firstName: 'Peter', lastName: 'Odhiambo', role: 'PHARMACIST', password: 'Pharma123!', phone: '+254700000005' },
    { username: 'labtech', email: 'lab@boyanihealth.africandivinechurch.org', firstName: 'Samuel', lastName: 'Kiptoo', role: 'LAB_TECH', password: 'Lab123!', phone: '+254700000006' },
    { username: 'cashier', email: 'cashier@boyanihealth.africandivinechurch.org', firstName: 'Lucy', lastName: 'Wambui', role: 'CASHIER', password: 'Cashier123!', phone: '+254700000007' },
    { username: 'registrar', email: 'reception@boyanihealth.africandivinechurch.org', firstName: 'Mary', lastName: 'Atieno', role: 'RECEPTIONIST', password: 'Reception123!', phone: '+254700000008' },
    { username: 'hr', email: 'hr@boyanihealth.africandivinechurch.org', firstName: 'Daniel', lastName: 'Kariuki', role: 'HR', password: 'Hr123!', phone: '+254700000009' },
    { username: 'inventory', email: 'stores@boyanihealth.africandivinechurch.org', firstName: 'Collins', lastName: 'Barasa', role: 'INVENTORY', password: 'Stores123!', phone: '+254700000010' },
    { username: 'doctor3', email: 'doctor3@boyanihealth.africandivinechurch.org', firstName: 'Peter', lastName: 'Kimani', role: 'DOCTOR', password: 'Doctor123!', phone: '+254700000011' },
    { username: 'doctor4', email: 'doctor4@boyanihealth.africandivinechurch.org', firstName: 'Sarah', lastName: 'Njoki', role: 'DOCTOR', password: 'Doctor123!', phone: '+254700000012' },
    { username: 'nurse2', email: 'nurse2@boyanihealth.africandivinechurch.org', firstName: 'Esther', lastName: 'Muthoni', role: 'NURSE', password: 'Nurse123!', phone: '+254700000013' },
  ];
  for (const u of users) {
    await db.user.create({ data: { username: u.username, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, passwordHash: hash(u.password), phone: u.phone } });
  }
  const adminUser = await db.user.findUnique({ where: { username: 'admin' } });
  const doctorUser = await db.user.findUnique({ where: { username: 'doctor' } });
  const doctor2User = await db.user.findUnique({ where: { username: 'doctor2' } });
  const nurseUser = await db.user.findUnique({ where: { username: 'nurse' } });
  const pharmaUser = await db.user.findUnique({ where: { username: 'pharmacist' } });
  const labUser = await db.user.findUnique({ where: { username: 'labtech' } });
  const cashierUser = await db.user.findUnique({ where: { username: 'cashier' } });
  const regUser = await db.user.findUnique({ where: { username: 'registrar' } });
  console.log('✓ users');

  // ═══ DEPARTMENTS & SERVICES ═══
  const departments = [
    { name: 'Emergency & Trauma', iconKey: 'Siren', color: '#dc2626', description: '24/7 trauma care, life support, and stabilization for acute injuries or sudden illnesses.' },
    { name: 'General Medicine', iconKey: 'Stethoscope', color: '#0d9488', description: 'Primary care, annual physicals and management of everyday illnesses.' },
    { name: 'Maternity & Neonatal Care', iconKey: 'Baby', color: '#e11d48', description: 'Antenatal care, labour & delivery suites, postnatal wards and NICU.' },
    { name: 'Surgery', iconKey: 'Scissors', color: '#7c3aed', description: 'Major and minor surgical procedures across orthopedic, cardiac and general specialties.' },
    { name: 'Diagnostic Imaging', iconKey: 'ScanLine', color: '#0891b2', description: 'X-rays, MRI, CT scans, ultrasounds and echocardiograms.' },
    { name: 'Laboratory & Pathology', iconKey: 'FlaskConical', color: '#0284c7', description: 'Comprehensive blood work, biopsies, microbiology cultures and tissue analysis.' },
    { name: 'Pediatrics', iconKey: 'Baby', color: '#f59e0b', description: 'Child welfare clinics, immunization and pediatric inpatient units.' },
    { name: 'Pharmacy', iconKey: 'Pill', color: '#16a34a', description: 'Prescription dispensing, medication therapy management and immunizations.' },
    { name: 'ICU & Critical Care', iconKey: 'HeartPulse', color: '#be123c', description: 'Intensive care units, coronary care and high-dependency beds.' },
    { name: 'Mental Health', iconKey: 'Brain', color: '#6d28d9', description: 'Outpatient counseling, psychiatry and therapy sessions.' },
  ];
  const deptMap: Record<string, string> = {};
  for (let i = 0; i < departments.length; i++) {
    const d = departments[i];
    const created = await db.department.create({
      data: { name: d.name, slug: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: d.description, iconKey: d.iconKey, color: d.color, displayOrder: i },
    });
    deptMap[d.name] = created.id;
  }

  const services: Array<[string, string, string, number, boolean]> = [
    ['CONS-GEN', 'General Consultation', 'CONSULTATION', 1500, false],
    ['CONS-SPEC', 'Specialist Consultation', 'CONSULTATION', 3500, false],
    ['CONS-FUP', 'Follow-up Consultation', 'CONSULTATION', 800, false],
    ['CONS-TEL', 'Teleconsultation', 'CONSULTATION', 1000, false],
    // ── Basic nursing / vitals services ──
    ['BSC-BP', 'Blood Pressure Check', 'CLINICAL', 200, true],
    ['BSC-TEMP', 'Temperature Reading', 'CLINICAL', 100, true],
    ['BSC-HT', 'Height Measurement', 'CLINICAL', 100, true],
    ['BSC-WT', 'Weight Measurement', 'CLINICAL', 100, true],
    ['BSC-BMI', 'BMI Assessment', 'CLINICAL', 200, true],
    ['BSC-BG', 'Bedside Blood Glucose', 'CLINICAL', 300, true],
    ['BSC-PULSE', 'Pulse & Respiration Check', 'CLINICAL', 100, true],
    ['BSC-SPO2', 'Oxygen Saturation (SpO2)', 'CLINICAL', 200, true],
    ['BSC-VITALS', 'Full Vital Signs Panel', 'CLINICAL', 500, true],
    ['BSC-INJ', 'Intramuscular Injection', 'CLINICAL', 300, true],
    ['BSC-IV', 'Intravenous Cannulation', 'CLINICAL', 800, true],
    ['BSC-DRESS', 'Wound Dressing (Small)', 'CLINICAL', 700, true],
    ['BSC-DRESSL', 'Wound Dressing (Large)', 'CLINICAL', 1500, true],
    ['BSC-NEB', 'Nebulization Session', 'CLINICAL', 900, true],
    ['BSC-EKG', 'ECG (Resting)', 'CLINICAL', 2500, true],
    ['BSC-CATH', 'Urinary Catheterization', 'CLINICAL', 2500, true],
    ['BSC-STITCH', 'Suturing (Simple Laceration)', 'CLINICAL', 3000, true],
    ['BSC-EAR', 'Ear Syringing', 'CLINICAL', 1200, true],
    ['BSC-ENEMA', 'Enema Administration', 'CLINICAL', 1000, true],
    ['BSC-FER', 'Ferrous Injection', 'CLINICAL', 500, true],
    // ── Laboratory: haematology ──
    ['LAB-CBC', 'Full Blood Count (CBC)', 'LABORATORY', 900, true],
    ['LAB-ESR', 'Erythrocyte Sedimentation Rate', 'LABORATORY', 600, true],
    ['LAB-RET', 'Reticulocyte Count', 'LABORATORY', 900, true],
    ['LAB-BF', 'Peripheral Blood Film', 'LABORATORY', 800, true],
    ['LAB-LEAD', 'Blood Lead Level', 'LABORATORY', 3500, true],
    ['LAB-COAG', 'Coagulation Profile', 'LABORATORY', 1800, true],
    // ── Laboratory: chemistry ──
    ['LAB-BS', 'Blood Sugar (Random)', 'LABORATORY', 300, true],
    ['LAB-FBS', 'Fasting Blood Sugar', 'LABORATORY', 350, true],
    ['LAB-OGTT', 'Oral Glucose Tolerance Test', 'LABORATORY', 1500, true],
    ['LAB-HBA', 'HbA1c', 'LABORATORY', 1600, true],
    ['LAB-LIP', 'Lipid Profile', 'LABORATORY', 1800, true],
    ['LAB-LFT', 'Liver Function Tests', 'LABORATORY', 2200, true],
    ['LAB-RFT', 'Renal Function Tests', 'LABORATORY', 2000, true],
    ['LAB-ELEC', 'Electrolytes (Na/K/Cl)', 'LABORATORY', 1500, true],
    ['LAB-URIC', 'Uric Acid', 'LABORATORY', 800, true],
    ['LAB-CA', 'Calcium & Phosphate', 'LABORATORY', 1200, true],
    ['LAB-AMY', 'Serum Amylase', 'LABORATORY', 1300, true],
    ['LAB-CRP', 'C-Reactive Protein', 'LABORATORY', 1200, true],
    ['LAB-CK', 'Creatine Kinase', 'LABORATORY', 1600, true],
    ['LAB-TROP', 'Troponin I', 'LABORATORY', 3500, true],
    ['LAB-DIMER', 'D-Dimer', 'LABORATORY', 3800, true],
    ['LAB-BLDCULT', 'Blood Culture', 'LABORATORY', 4500, true],
    // ── Laboratory: endocrinology / hormones ──
    ['LAB-THY', 'Thyroid Function (TSH)', 'LABORATORY', 2500, true],
    ['LAB-TFT', 'Full Thyroid Panel', 'LABORATORY', 4200, true],
    ['LAB-PSA', 'PSA (Prostate)', 'LABORATORY', 2600, true],
    ['LAB-CORT', 'Serum Cortisol', 'LABORATORY', 3200, true],
    ['LAB-PROL', 'Prolactin', 'LABORATORY', 2800, true],
    ['LAB-TEST', 'Testosterone', 'LABORATORY', 2900, true],
    ['LAB-FSH', 'LH / FSH', 'LABORATORY', 3000, true],
    ['LAB-INS', 'Fasting Insulin', 'LABORATORY', 3100, true],
    // ── Laboratory: serology / immunology ──
    ['LAB-BP', 'Blood Grouping', 'LABORATORY', 400, true],
    ['LAB-RH', 'Rhesus Typing', 'LABORATORY', 350, true],
    ['LAB-COOMB', 'Coombs Test', 'LABORATORY', 1600, true],
    ['LAB-MAL', 'Malaria Rapid Test', 'LABORATORY', 500, true],
    ['LAB-MALPBS', 'Malaria Parasites (Blood Smear)', 'LABORATORY', 600, true],
    ['LAB-TYPH', 'Typhoid (Widal) Test', 'LABORATORY', 700, true],
    ['LAB-BRUC', 'Brucella Test', 'LABORATORY', 1400, true],
    ['LAB-HIV', 'HIV Screening', 'LABORATORY', 500, true],
    ['LAB-HIVVL', 'HIV Viral Load', 'LABORATORY', 8500, true],
    ['LAB-CD4', 'CD4 Count', 'LABORATORY', 3200, true],
    ['LAB-HBSAG', 'Hepatitis B Surface Antigen', 'LABORATORY', 900, true],
    ['LAB-HCV', 'Hepatitis C Antibody', 'LABORATORY', 1600, true],
    ['LAB-SYPH', 'Syphilis (RPR/VDRL)', 'LABORATORY', 800, true],
    ['LAB-RHEUM', 'Rheumatoid Factor', 'LABORATORY', 1300, true],
    ['LAB-ANA', 'ANA Profile', 'LABORATORY', 4800, true],
    ['LAB-DENGUE', 'Dengue NS1/IgM', 'LABORATORY', 1800, true],
    ['LAB-RSV', 'RSV & Influenza Panel', 'LABORATORY', 2600, true],
    ['LAB-TB', 'GeneXpert TB Assay', 'LABORATORY', 4500, true],
    ['LAB-TBSM', 'Sputum AFB Microscopy', 'LABORATORY', 900, true],
    // ── Laboratory: urinalysis & stool ──
    ['LAB-UR', 'Urinalysis', 'LABORATORY', 600, true],
    ['LAB-URC', 'Urine Culture & Sensitivity', 'LABORATORY', 2800, true],
    ['LAB-24HR', '24-Hour Urine Protein', 'LABORATORY', 1700, true],
    ['LAB-ACR', 'Urine Albumin/Creatinine', 'LABORATORY', 1900, true],
    ['LAB-STOOL', 'Stool Analysis', 'LABORATORY', 700, true],
    ['LAB-STCULT', 'Stool Culture', 'LABORATORY', 2600, true],
    ['LAB-OVA', 'Stool Ova & Parasites', 'LABORATORY', 800, true],
    ['LAB-OCCULT', 'Faecal Occult Blood', 'LABORATORY', 900, true],
    ['LAB-HPYL', 'H. Pylori Antigen', 'LABORATORY', 1500, true],
    ['LAB-HPAB', 'H. Pylori Antibodies', 'LABORATORY', 1800, true],
    // ── Laboratory: special chemistry / markers ──
    ['LAB-PREG', 'Pregnancy Test', 'LABORATORY', 350, true],
    ['LAB-BHCG', 'Beta hCG (Quantitative)', 'LABORATORY', 2200, true],
    ['LAB-FERR', 'Serum Ferritin', 'LABORATORY', 2300, true],
    ['LAB-B12', 'Vitamin B12', 'LABORATORY', 2600, true],
    ['LAB-VD', 'Vitamin D (25-OH)', 'LABORATORY', 3900, true],
    ['LAB-FOL', 'Folate (Folic Acid)', 'LABORATORY', 2200, true],
    ['LAB-IRON', 'Serum Iron & TIBC', 'LABORATORY', 2100, true],
    ['LAB-APT', 'APTT', 'LABORATORY', 1400, true],
    ['LAB-CULT', 'Culture & Sensitivity', 'LABORATORY', 2800, true],
    ['LAB-CSF', 'CSF Analysis', 'LABORATORY', 2400, true],
    ['LAB-PT', 'PT/INR Coagulation', 'LABORATORY', 1500, true],
    ['LAB-SE', 'Semen Analysis', 'LABORATORY', 2000, true],
    ['LAB-FOB', 'Faecal Fat', 'LABORATORY', 1600, true],
    // ── Laboratory: histopathology ──
    ['LAB-PAP', 'Pap Smear', 'LABORATORY', 2000, true],
    ['LAB-HPV', 'HPV DNA Test', 'LABORATORY', 5500, true],
    ['LAB-BIOPSY', 'Biopsy (Histology)', 'LABORATORY', 7500, true],
    ['LAB-FNA', 'Fine Needle Aspiration', 'LABORATORY', 3800, true],
    ['LAB-GP', 'Glycated Protein', 'LABORATORY', 1700, true],
    // ── Imaging ──
    ['IMG-XR', 'X-Ray (Plain Film)', 'IMAGING', 2500, true],
    ['IMG-XRC', 'X-Ray (Contrast Study)', 'IMAGING', 6500, true],
    ['IMG-US', 'Ultrasound Scan', 'IMAGING', 3500, true],
    ['IMG-USOB', 'Obstetric Ultrasound', 'IMAGING', 3800, true],
    ['IMG-CT', 'CT Scan', 'IMAGING', 18000, true],
    ['IMG-MRI', 'MRI Scan', 'IMAGING', 28000, true],
    ['IMG-ECHO', 'Echocardiogram', 'IMAGING', 8000, true],
    ['IMG-DOP', 'Doppler Study', 'IMAGING', 6000, true],
    ['IMG-MAMO', 'Mammography', 'IMAGING', 7500, true],
    ['IMG-DEXA', 'DEXA Bone Density', 'IMAGING', 6800, true],
    ['IMG-HSG', 'Hysterosalpingography', 'IMAGING', 7200, true],
    // ── Admission ──
    ['ADM-GEN', 'General Ward Bed (per day)', 'ADMISSION', 3000, true],
    ['ADM-PRV', 'Private Room (per day)', 'ADMISSION', 9000, true],
    ['ADM-ICU', 'ICU Bed (per day)', 'ADMISSION', 18000, true],
    ['ADM-EXEC', 'Executive Suite (per day)', 'ADMISSION', 15000, false],
    ['ADM-HDU', 'HDU Bed (per day)', 'ADMISSION', 14000, true],
    ['ADM-NURSE', 'Nursing Care Fee (per day)', 'ADMISSION', 1500, true],
    ['ADM-OXY', 'Oxygen Therapy (per day)', 'ADMISSION', 3500, true],
    ['ADM-MONI', 'Cardiac Monitoring (per day)', 'ADMISSION', 4000, true],
    // ── Surgical & procedures ──
    ['SUR-MIN', 'Minor Surgery (list price)', 'CLINICAL', 15000, false],
    ['SUR-MAJ', 'Major Surgery (list price)', 'CLINICAL', 85000, false],
    ['SUR-CIRC', 'Male Circumcision', 'CLINICAL', 6500, true],
    ['SUR-INC', 'Incision & Drainage (Abscess)', 'CLINICAL', 4500, true],
    ['SUR-BIOP', 'Skin Biopsy', 'CLINICAL', 5500, true],
    ['SUR-RED', 'Fracture Reduction', 'CLINICAL', 12000, true],
    ['SUR-CAST', 'Plaster of Paris Cast', 'CLINICAL', 4000, true],
    ['SUR-LAV', 'Wound Lavage', 'CLINICAL', 2500, true],
    ['SUR-FIST', 'Fistula Repair', 'CLINICAL', 45000, true],
    ['SUR-HERN', 'Hernia Repair', 'CLINICAL', 55000, true],
    ['SUR-CIRCUM', 'Circumcision (Adult)', 'CLINICAL', 9000, true],
    ['SUR-ENDO', 'Endoscopy', 'CLINICAL', 22000, true],
    ['SUR-COL', 'Colonoscopy', 'CLINICAL', 26000, true],
    ['SUR-CYS', 'Cystoscopy', 'CLINICAL', 24000, true],
    // ── MCH ──
    ['MCH-ANC', 'Antenatal Clinic Visit', 'MCH', 1200, true],
    ['MCH-ANCP', 'ANC Profile (Lab Bundle)', 'MCH', 4800, true],
    ['MCH-DEL-N', 'Normal Delivery Package', 'MCH', 28000, true],
    ['MCH-DEL-C', 'Caesarean Section Package', 'MCH', 75000, true],
    ['MCH-IMM', 'Child Immunization', 'MCH', 800, true],
    ['MCH-IMMB', 'Birth Dose Immunization Bundle', 'MCH', 2500, true],
    ['MCH-FP', 'Family Planning Consultation', 'MCH', 900, true],
    ['MCH-FPI', 'Family Planning Insertion (IUD/Implant)', 'MCH', 4500, true],
    ['MCH-PNC', 'Postnatal Clinic Visit', 'MCH', 1000, true],
    ['MCH-US', 'Growth Monitoring Visit', 'MCH', 600, true],
    ['MCH-VIT', 'Vitamin A Supplementation', 'MCH', 300, true],
    ['MCH-WCV', 'Well-Child Visit', 'MCH', 1200, true],
    // ── Emergency, mental health, paediatrics, misc ──
    ['PHAR-DISP', 'Prescription Dispensing Fee', 'PHARMACY', 200, true],
    ['ER-TRIAGE', 'Emergency Triage', 'CLINICAL', 1000, false],
    ['ER-ATT', 'Emergency Attendance Fee', 'CLINICAL', 2500, false],
    ['ER-AMB', 'Ambulance Service (within Vihiga/Kakamega)', 'CLINICAL', 5000, false],
    ['ER-RESUS', 'Resuscitation Fee', 'CLINICAL', 8000, false],
    ['MENT-SESS', 'Counseling Session', 'CLINICAL', 3000, false],
    ['MENT-PSY', 'Psychiatric Consultation', 'CLINICAL', 4500, false],
    ['PED-ATT', 'Pediatric Attendance', 'CLINICAL', 2000, true],
    ['PED-NEB', 'Pediatric Nebulization', 'CLINICAL', 1000, true],
    ['DERM-CONS', 'Dermatology Consultation', 'CLINICAL', 2800, true],
    ['OPT-EXAM', 'Eye Examination', 'CLINICAL', 1500, true],
    ['DENT-EXT', 'Dental Extraction', 'CLINICAL', 2500, true],
    ['DENT-FIL', 'Dental Filling', 'CLINICAL', 4000, true],
    ['DENT-SCAL', 'Dental Scaling & Polishing', 'CLINICAL', 5000, true],
    ['PHY-CERT', 'Medical Examination Certificate', 'CLINICAL', 2000, false],
    ['PHY-INSUR', 'Insurance Medical Exam', 'CLINICAL', 3500, false],
    ['PHY-DRI', 'Driving Licence Medical', 'CLINICAL', 1500, false],
    ['PHY-PREEMP', 'Pre-employment Medical', 'CLINICAL', 3000, false],
    ['OCC-VAX', 'Occupational Vaccination', 'CLINICAL', 1800, true],
  ];
  const serviceMap: Record<string, string> = {};
  for (const [code, name, category, price, shaCovered] of services) {
    const dept = category === 'LABORATORY' ? 'Laboratory & Pathology'
      : category === 'IMAGING' ? 'Diagnostic Imaging'
      : category === 'ADMISSION' ? 'ICU & Critical Care'
      : category === 'MCH' ? 'Maternity & Neonatal Care'
      : category === 'PHARMACY' ? 'Pharmacy'
      : 'General Medicine';
    const s = await db.service.create({
      data: { code, name, category, price, shaCovered, departmentId: deptMap[dept], description: `${name} — ${dept}` },
    });
    serviceMap[code] = s.id;
  }
  console.log('✓ departments & services');

  // ═══ DRUGS (Kenyan pharmacy essentials) ═══
  const drugs: Array<[string, string, string, string, string, number, number, number]> = [
    ['Paracetamol 500mg', 'Paracetamol', 'ANALGESICS', 'TABLET', '500mg', 500, 8, 15],
    ['Ibuprofen 400mg', 'Ibuprofen', 'ANALGESICS', 'TABLET', '400mg', 300, 12, 25],
    ['Diclofenac 50mg', 'Diclofenac Sodium', 'ANALGESICS', 'TABLET', '50mg', 250, 15, 30],
    ['Coartem 20/120mg', 'Artemether/Lumefantrine', 'ANTIMALARIALS', 'TABLET', '20/120mg', 180, 90, 180],
    ['Doxycycline 100mg', 'Doxycycline', 'ANTIBIOTICS', 'CAPSULE', '100mg', 200, 25, 55],
    ['Amoxicillin 500mg', 'Amoxicillin', 'ANTIBIOTICS', 'CAPSULE', '500mg', 300, 20, 42],
    ['Amoxil Clav 625mg', 'Amoxicillin/Clavulanate', 'ANTIBIOTICS', 'TABLET', '625mg', 140, 130, 260],
    ['Azithromycin 500mg', 'Azithromycin', 'ANTIBIOTICS', 'TABLET', '500mg', 90, 150, 290],
    ['Ciprofloxacin 500mg', 'Ciprofloxacin', 'ANTIBIOTICS', 'TABLET', '500mg', 160, 45, 95],
    ['Metronidazole 400mg', 'Metronidazole', 'ANTIBIOTICS', 'TABLET', '400mg', 300, 10, 22],
    ['Ceftriaxone 1g Injection', 'Ceftriaxone', 'ANTIBIOTICS', 'INJECTION', '1g', 60, 180, 360],
    ['Gentamicin 80mg Injection', 'Gentamicin', 'ANTIBIOTICS', 'INJECTION', '80mg', 50, 60, 120],
    ['Amlodipine 5mg', 'Amlodipine', 'CHRONIC_CARE', 'TABLET', '5mg', 400, 8, 18],
    ['Losartan 50mg', 'Losartan Potassium', 'CHRONIC_CARE', 'TABLET', '50mg', 300, 30, 65],
    ['Atenolol 50mg', 'Atenolol', 'CHRONIC_CARE', 'TABLET', '50mg', 280, 12, 28],
    ['Metformin 500mg', 'Metformin HCl', 'CHRONIC_CARE', 'TABLET', '500mg', 500, 10, 22],
    ['Glibenclamide 5mg', 'Glibenclamide', 'CHRONIC_CARE', 'TABLET', '5mg', 200, 14, 30],
    ['Insulin Mixtard 30 10ml', 'Insulin Human', 'CHRONIC_CARE', 'INJECTION', '100IU/ml', 40, 850, 1400],
    ['Atorvastatin 20mg', 'Atorvastatin', 'CHRONIC_CARE', 'TABLET', '20mg', 250, 35, 70],
    ['Salbutamol Inhaler', 'Salbutamol', 'CHRONIC_CARE', 'INHALER', '100mcg', 70, 350, 620],
    ['ORS Sachet', 'Oral Rehydration Salts', 'GENERAL', 'POWDER', '20.5g', 400, 12, 25],
    ['Ferrous Sulphate + Folic', 'Ferrous/Folic Acid', 'SUPPLEMENTS', 'TABLET', '200/0.4mg', 500, 15, 30],
    ['Folic Acid 5mg', 'Folic Acid', 'SUPPLEMENTS', 'TABLET', '5mg', 300, 6, 14],
    ['Vitamin B Complex', 'Vitamin B Complex', 'SUPPLEMENTS', 'TABLET', 'B1+B2+B6', 280, 18, 38],
    ['Calpol Syrup 100ml', 'Paracetamol Syrup', 'PEDIATRIC', 'SYRUP', '120mg/5ml', 150, 55, 110],
    ['Augmentin Syrup 100ml', 'Amoxicillin/Clav Syrup', 'PEDIATRIC', 'SYRUP', '228mg/5ml', 60, 210, 420],
    ['Zinc Syrup 100ml', 'Zinc Sulphate', 'PEDIATRIC', 'SYRUP', '10mg/5ml', 120, 70, 140],
    ['Mebendazole 500mg', 'Mebendazole', 'GENERAL', 'TABLET', '500mg', 200, 18, 36],
    ['Albendazole 400mg', 'Albendazole', 'GENERAL', 'TABLET', '400mg', 220, 20, 40],
    ['Cetirizine 10mg', 'Cetirizine', 'OTC', 'TABLET', '10mg', 300, 5, 12],
    ['Loratadine 10mg', 'Loratadine', 'OTC', 'TABLET', '10mg', 260, 7, 16],
    ['Omeprazole 20mg', 'Omeprazole', 'OTC', 'CAPSULE', '20mg', 280, 18, 38],
    ['Normal Saline 500ml', 'Sodium Chloride 0.9%', 'IV_FLUIDS', 'IV_FLUID', '500ml', 150, 70, 140],
    ['RL 500ml', 'Ringers Lactate', 'IV_FLUIDS', 'IV_FLUID', '500ml', 130, 80, 160],
    ['Hartmann 1L', 'Compound Sodium Lactate', 'IV_FLUIDS', 'IV_FLUID', '1000ml', 90, 120, 240],
    ['Tetanus Toxoid', 'Tetanus Toxoid', 'VACCINES', 'INJECTION', '0.5ml', 80, 90, 180],
    ['BCG Vaccine', 'Bacillus Calmette-Guérin', 'VACCINES', 'INJECTION', '0.1ml', 50, 120, 240],
    ['Depo Provera', 'Medroxyprogesterone', 'CHRONIC_CARE', 'INJECTION', '150mg', 60, 260, 480],
    ['Hydrocortisone Cream 15g', 'Hydrocortisone', 'TOPICAL', 'CREAM', '1%', 180, 60, 125],
    ['Povidone Iodine 100ml', 'Povidone Iodine', 'TOPICAL', 'SOLUTION', '10%', 100, 90, 180],
    ['Chlorpheniramine 4mg', 'Chlorpheniramine', 'OTC', 'TABLET', '4mg', 300, 5, 11],
    ['Magnesium Trisilicate Mix', 'Magnesium Trisilicate', 'OTC', 'MIXTURE', '200ml', 140, 65, 130],
    ['Sodium Valproate 200mg', 'Sodium Valproate', 'CHRONIC_CARE', 'TABLET', '200mg', 150, 60, 120],
    ['Carbamazepine 200mg', 'Carbamazepine', 'CHRONIC_CARE', 'TABLET', '200mg', 180, 55, 110],
    ['Fluconazole 150mg', 'Fluconazole', 'ANTIBIOTICS', 'CAPSULE', '150mg', 130, 55, 110],
    ['Nystatin Pessaries', 'Nystatin', 'ANTIBIOTICS', 'SUPPOSITORY', '100000IU', 70, 140, 280],
    ['Misoprostol 200mcg', 'Misoprostol', 'MATERNITY', 'TABLET', '200mcg', 60, 160, 320],
    ['Oxytocin 10IU Injection', 'Oxytocin', 'MATERNITY', 'INJECTION', '10IU', 80, 110, 220],
  ];
  const drugMap: Record<string, string> = {};
  for (const [name, generic, category, dosageForm, strength, stock, unitCost, unitPrice] of drugs) {
    const idx = Object.keys(drugMap).length;
    const d = await db.drug.create({
      data: {
        code: `DRG-${Date.now().toString(36).toUpperCase()}-${idx}`,
        name, genericName: generic, category, dosageForm, strength,
        stock, unitCost, unitPrice,
        reorderLevel: Math.max(20, Math.round(stock / 5)),
        expiryDate: new Date(Date.now() + 365 * 864e5),
        supplier: ['KEMSA', 'Mission Pharma', 'Hurlingham Pharmacy Ltd', 'GSK Kenya'][idx % 4],
        rackLocation: `Rack ${String.fromCharCode(65 + (idx % 8))}${(idx % 12) + 1}`,
        counterShelf: `Shelf ${String.fromCharCode(67 + (idx % 6))}-${String((idx % 18) + 1).padStart(2, '0')}`,
      },
    });
    drugMap[name] = d.id;
  }
  console.log('✓ drugs');

  // ═══ WARDS & BEDS ═══
  const wards: Array<[string, string, string, number]> = [
    ['General Ward A — Male', 'GENERAL', 'MALE', 3000],
    ['General Ward B — Female', 'GENERAL', 'FEMALE', 3000],
    ['Maternity Ward', 'MATERNITY', 'FEMALE', 5000],
    ['Pediatric Ward', 'PEDIATRIC', 'MIXED', 4000],
    ['Private Rooms Wing', 'PRIVATE', 'MIXED', 9000],
    ['Intensive Care Unit', 'ICU', 'MIXED', 18000],
    ['High Dependency Unit', 'HDU', 'MIXED', 14000],
    ['Isolation Unit', 'ISOLATION', 'MIXED', 7000],
    ['Neonatal Unit (NICU)', 'NEONATAL', 'MIXED', 16000],
    ['Executive Suites', 'EXECUTIVE', 'MIXED', 15000],
  ];
  const wardMap: Record<string, string> = {};
  for (const [name, type, gender, rate] of wards) {
    const w = await db.ward.create({
      data: { name, code: `WRD-${Date.now().toString(36).toUpperCase()}-${Object.keys(wardMap).length}`, wardType: type, gender, dailyRate: rate, floor: `${(Object.keys(wardMap).length % 4) + 1}` },
    });
    wardMap[name] = w.id;
    const bedCount = type === 'ICU' || type === 'HDU' ? 6 : type === 'EXECUTIVE' || type === 'PRIVATE' ? 4 : 10;
    const prefix = `${type.slice(0, 3)}${Object.keys(wardMap).length}`;
    for (let b = 1; b <= bedCount; b++) {
      await db.bed.create({
        data: { bedNumber: `${prefix}-${String(b).padStart(2, '0')}`, wardId: w.id, status: 'AVAILABLE' },
      });
    }
  }
  console.log('✓ wards & beds');

  // ═══ EMPLOYEES ═══
  const employees: Array<[string, string, string, string, number, string | null]> = [
    ['James', 'Mutua', 'DOCTOR', 'Internal Medicine', 210000, 'doctor'],
    ['Grace', 'Achieng', 'DOCTOR', 'Pediatrics', 200000, 'doctor2'],
    ['Peter', 'Kimani', 'DOCTOR', 'Obstetrics & Gynecology', 220000, 'doctor3'],
    ['Sarah', 'Njoki', 'DOCTOR', 'General Surgery', 260000, 'doctor4'],
    ['Faith', 'Njeri', 'NURSE', 'Ward Nursing', 65000, 'nurse'],
    ['Esther', 'Muthoni', 'NURSE', 'ICU Nursing', 78000, 'nurse2'],
    ['Peter', 'Odhiambo', 'PHARMACIST', 'Pharmacy', 95000, 'pharmacist'],
    ['Samuel', 'Kiptoo', 'LAB_TECH', 'Laboratory', 70000, 'labtech'],
    ['Lucy', 'Wambui', 'CASHIER', 'Cash Office', 48000, 'cashier'],
    ['Mary', 'Atieno', 'RECEPTIONIST', 'Front Office', 45000, 'registrar'],
    ['Daniel', 'Kariuki', 'HR', 'Human Resources', 85000, 'hr'],
    ['Collins', 'Barasa', 'INVENTORY', 'Stores', 52000, 'inventory'],
    ['Amina', 'Wanjiru', 'ADMIN', 'Administration', 180000, 'admin'],
  ];
  const empMap: Record<string, string> = {};
  // Employees link to system accounts via userId — store the USER id (not the
  // username) so attendance name resolution, PWA check-in linking and the
  // self-service payroll tab (Employee(userId)) all match correctly.
  const userRows = await db.user.findMany({ select: { id: true, username: true } });
  const userIdByUsername = new Map(userRows.map(u => [u.username, u.id]));
  for (const [firstName, lastName, profession, position, salary, userId] of employees) {
    const e = await db.employee.create({
      data: {
        employeeNo: `EMP-${String(Object.keys(empMap).length + 1).padStart(4, '0')}`,
        firstName, lastName, profession, position,
        department: profession === 'DOCTOR' ? 'Medical' : profession,
        phone: `+254712000${String(Object.keys(empMap).length + 100).slice(-3)}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@boyanihealth.africandivinechurch.org`,
        nationalId: `${30000000 + Object.keys(empMap).length}`,
        kraPin: `A00${Object.keys(empMap).length}4567${firstName[0]}`,
        salary, userId: (userId && userIdByUsername.get(userId)) || null,
        startDate: new Date(Date.now() - (200 + Object.keys(empMap).length * 90) * 864e5),
      },
    });
    empMap[`${firstName} ${lastName}`] = e.id;
  }
  // Shifts
  for (const empName of ['Faith Njeri', 'Esther Muthoni', 'Mary Atieno', 'Lucy Wambui']) {
    for (let day = 0; day < 5; day++) {
      const shiftDate = new Date(); shiftDate.setDate(shiftDate.getDate() + day);
      await db.staffAssignment.create({
        data: {
          employeeId: empMap[empName], assignmentType: 'SHIFT',
          shiftDate, shiftStart: day % 2 ? '14:00' : '07:00', shiftEnd: day % 2 ? '22:00' : '15:00',
          shiftType: day % 2 ? 'EVENING' : 'DAY',
          departmentId: deptMap['General Medicine'],
        },
      });
    }
  }
  console.log('✓ employees & shifts');

  // ═══ PATIENTS & VISITS ═══
  const patientsData: Array<[string, string, string, string, string, string, string, string]> = [
    ['John', 'Kamau', 'MALE', 'Nairobi', 'Dagoretti', 'Kawangware', 'CASH', '1985-03-12'],
    ['Jane', 'Wanjiku', 'FEMALE', 'Kiambu', 'Kikuyu', 'Githunguri', 'SHA', '1990-07-22'],
    ['Ali', 'Hassan', 'MALE', 'Mombasa', 'Mvita', 'Majengo', 'CASH', '1978-11-05'],
    ['Rose', 'Achieng', 'FEMALE', 'Kisumu', 'Winam', 'Nyalenda', 'SHA', '1995-01-30'],
    ['David', 'Ochieng', 'MALE', 'Siaya', 'Ugunja', 'Umbala', 'CASH', '1982-09-18'],
    ['Mercy', 'Wairimu', 'FEMALE', 'Nyeri', 'Mathira', 'Karatina', 'INSURANCE', '1988-04-14'],
    ['Brian', 'Otieno', 'MALE', 'Homa Bay', 'Kabondo', 'Riany', 'SHA', '1993-12-01'],
    ['Sarah', 'Chebet', 'FEMALE', 'Uasin Gishu', 'Ainabkoi', 'Kapsoya', 'CASH', '1991-06-25'],
    ['Michael', 'Mutiso', 'MALE', 'Machakos', 'Mlolongo', 'Mavoko', 'SHA', '1975-02-08'],
    ['Elizabeth', 'Mumbi', 'FEMALE', 'Nakuru', 'Nakuru Town', 'Milimani', 'CASH', '1983-08-19'],
    ['Kevin', 'Wafula', 'MALE', 'Bungoma', 'Kanduyi', 'Khalaba', 'CASH', '1996-05-27'],
    ['Fatuma', 'Abdi', 'FEMALE', 'Garissa', 'Garissa Township', 'Bulla', 'SHA', '1994-10-11'],
    ['Peter', 'Mwangi', 'MALE', 'Muranga', 'Kiharu', 'Mukuyu', 'INSURANCE', '1970-01-17'],
    ['Cynthia', 'Naliaka', 'FEMALE', 'Kakamega', 'Lurambi', 'Shirere', 'CASH', '1998-03-03'],
    ['Samuel', 'Barasa', 'MALE', 'Trans Nzoia', 'Cherangany', 'Sibanga', 'CASH', '1987-07-07'],
  ];
  const patMap: Record<string, string> = {};
  for (let i = 0; i < patientsData.length; i++) {
    const [firstName, lastName, gender, county, subCounty, location, paymentMode, dob] = patientsData[i];
    const p = await db.patient.create({
      data: {
        patientNo: `PAT-2026-${String(i + 1).padStart(4, '0')}`,
        firstName, lastName, gender,
        dateOfBirth: new Date(dob),
        nationalId: `${31 + i}${String(100000 + i * 7331).slice(0, 6)}`,
        phone: `+25471${String(2000000 + i * 11111).slice(0, 7)}`,
        county, subCounty, location, subLocation: `${location} Sub-location`, village: `${location} Village`,
        paymentMode,
        shaNumber: paymentMode === 'SHA' ? `SHA-${String(70000 + i * 137)}` : '',
        insuranceProvider: paymentMode === 'INSURANCE' ? ['AAR Insurance', 'Jubilee Health', 'Britam'][i % 3] : '',
        insuranceNo: paymentMode === 'INSURANCE' ? `INS-${45000 + i * 211}` : '',
        kinName: `${['Mary', 'Joseph', 'Esther', 'Paul'][i % 4]} ${lastName}`,
        kinRelationship: i % 2 ? 'Spouse' : 'Sibling',
        kinPhone: `+25472${String(3000000 + i * 12121).slice(0, 7)}`,
        bloodType: ['O+', 'A+', 'B+', 'AB+', 'O-'][i % 5],
      },
    });
    patMap[`${firstName} ${lastName}`] = p.id;
  }
  // Visits for first 8 patients
  const statuses = ['COMPLETED', 'ACTIVE', 'WAITING_DOCTOR', 'WAITING_LAB', 'WAITING_PHARMACY', 'READY_FOR_PAYMENT', 'COMPLETED', 'ACTIVE'];
  for (let i = 0; i < 8; i++) {
    const name = `${patientsData[i][0]} ${patientsData[i][1]}`;
    await db.visit.create({
      data: {
        visitNo: `VIS-${String(i + 1).padStart(4, '0')}`,
        patientId: patMap[name],
        visitType: i % 3 === 0 ? 'OUTPATIENT' : i % 3 === 1 ? 'MATERNITY' : 'EMERGENCY',
        status: statuses[i],
        doctorId: i % 2 ? doctorUser!.id : doctor2User!.id,
        createdAt: new Date(Date.now() - (8 - i) * 3600e3),
      },
    });
  }
  console.log('✓ patients & visits');

  // ═══ APPOINTMENTS ═══
  const apptTimes = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30'];
  for (let i = 0; i < 12; i++) {
    const date = new Date(); date.setDate(date.getDate() + (i % 5)); date.setHours(0, 0, 0, 0);
    await db.appointment.create({
      data: {
        appointmentNo: `APT-${String(i + 1).padStart(4, '0')}`,
        patientId: i < 8 ? patMap[`${patientsData[i % 8][0]} ${patientsData[i % 8][1]}`] : null,
        patientName: i < 8 ? `${patientsData[i % 8][0]} ${patientsData[i % 8][1]}` : `Walk-in Patient ${i - 7}`,
        patientPhone: `+254733000${String(100 + i)}`,
        doctorId: i % 2 ? doctorUser!.id : doctor2User!.id,
        appointmentDate: date,
        timeSlot: apptTimes[i % apptTimes.length],
        reason: ['General check-up', 'Antenatal visit', 'Follow-up — hypertension', 'Child immunization', 'Back pain', 'Malaria symptoms', 'Diabetes review', 'Skin rash'][i % 8],
        status: ['PENDING', 'CONFIRMED', 'PENDING', 'CONFIRMED', 'COMPLETED', 'PENDING', 'CONFIRMED', 'CHECKED_IN'][i % 8],
        source: 'WEBSITE',
      },
    });
  }

  // ═══ LAB TESTS ═══
  const labTestDefs: Array<[string, string, string, string, string]> = [
    ['LAB-CBC', 'Full Blood Count (CBC)', 'HEMATOLOGY', 'Blood', '12.0-15.5 g/dL'],
    ['LAB-BS', 'Blood Sugar (Random)', 'CHEMISTRY', 'Blood', '3.9-7.8 mmol/L'],
    ['LAB-FBS', 'Fasting Blood Sugar', 'CHEMISTRY', 'Blood', '3.9-5.6 mmol/L'],
    ['LAB-HBA', 'HbA1c', 'CHEMISTRY', 'Blood', '< 5.7%'],
    ['LAB-LIP', 'Lipid Profile', 'CHEMISTRY', 'Blood', 'Total <5.2 mmol/L'],
    ['LAB-LFT', 'Liver Function Tests', 'CHEMISTRY', 'Blood', 'ALT 7-56 U/L'],
    ['LAB-RFT', 'Renal Function Tests', 'CHEMISTRY', 'Blood', 'Creat 62-106 µmol/L'],
    ['LAB-THY', 'Thyroid Function (TSH)', 'CHEMISTRY', 'Blood', '0.4-4.0 mIU/L'],
    ['LAB-UR', 'Urinalysis', 'URINALYSIS', 'Urine', '—'],
    ['LAB-CULT', 'Culture & Sensitivity', 'MICROBIOLOGY', 'Swab/Urine', '—'],
    ['LAB-MAL', 'Malaria Rapid Test', 'PARASITOLOGY', 'Blood', 'Negative'],
    ['LAB-HIV', 'HIV Screening', 'SEROLOGY', 'Blood', 'Non-reactive'],
    ['LAB-BP', 'Blood Grouping', 'HEMATOLOGY', 'Blood', '—'],
    ['LAB-PT', 'PT/INR Coagulation', 'HEMATOLOGY', 'Blood', 'INR 0.8-1.2'],
    ['LAB-PREG', 'Pregnancy Test', 'POCT', 'Urine', '—'],
  ];
  for (const [code, name, category, specimenType, referenceRange] of labTestDefs) {
    await db.labTest.create({
      data: { code, name, category, specimenType, referenceRange, serviceId: serviceMap[code], turnaroundHours: category === 'POCT' ? 1 : 24 },
    });
  }
  // Lab orders with results for first 3 patients
  const labPatients = [patMap['John Kamau'], patMap['Jane Wanjiku'], patMap['Ali Hassan']];
  for (let i = 0; i < 3; i++) {
    const order = await db.labOrder.create({
      data: {
        orderNo: `LAB-${String(i + 1).padStart(4, '0')}`,
        patientId: labPatients[i], orderedById: doctorUser!.id,
        status: i === 0 ? 'COMPLETED' : i === 1 ? 'IN_PROGRESS' : 'PENDING',
        priority: i === 0 ? 'ROUTINE' : 'URGENT',
        createdAt: new Date(Date.now() - (3 - i) * 7200e3),
      },
    });
    const testCodes = i === 0 ? ['LAB-CBC', 'LAB-BS', 'LAB-MAL'] : i === 1 ? ['LAB-LIP', 'LAB-LFT'] : ['LAB-UR', 'LAB-HIV'];
    for (const code of testCodes) {
      await db.labOrderItem.create({
        data: {
          orderId: order.id, labTestId: (await db.labTest.findUnique({ where: { code } }))!.id,
          testName: labTestDefs.find(t => t[0] === code)![1],
          status: i === 0 ? 'COMPLETED' : 'PENDING',
          result: i === 0 ? 'Within normal limits' : '',
          resultValue: i === 0 ? (code === 'LAB-CBC' ? '13.2' : code === 'LAB-BS' ? '5.4' : 'Negative') : '',
          unit: i === 0 ? (code === 'LAB-CBC' ? 'g/dL' : code === 'LAB-BS' ? 'mmol/L' : '') : '',
          flag: i === 0 ? 'NORMAL' : '',
          completedAt: i === 0 ? new Date() : null,
        },
      });
    }
  }

  // ═══ PRESCRIPTIONS ═══
  const presPatient = patMap['John Kamau'];
  const pres = await db.prescription.create({
    data: {
      prescriptionNo: 'PRS-0001', patientId: presPatient, doctorId: doctorUser!.id,
      status: 'PRESCRIBED', notes: 'Complete full course. Return if symptoms persist.',
    },
  });
  for (const [drugName, dosage, frequency, duration, quantity] of [
    ['Coartem 20/120mg', '4 tablets', 'Twice daily', '3 days', 24],
    ['Paracetamol 500mg', '1 tablet', 'Thrice daily', '5 days', 15],
    ['ORS Sachet', '1 sachet', 'After every loose stool', '3 days', 6],
  ] as Array<[string, string, string, string, number]>) {
    const drug = await db.drug.findFirst({ where: { name: drugName } });
    await db.prescriptionItem.create({
      data: {
        prescriptionId: pres.id, drugId: drug!.id, drugName,
        dosage, frequency, duration, quantity,
        unitPrice: drug!.unitPrice, totalPrice: drug!.unitPrice * quantity,
        instructions: `${dosage} ${frequency} for ${duration}`,
      },
    });
  }

  // ═══ VITALS ═══
  for (const name of ['John Kamau', 'Jane Wanjiku', 'Rose Achieng']) {
    await db.vitalRecord.create({
      data: {
        patientId: patMap[name], recordedById: nurseUser!.id,
        temperature: 36.5 + Math.random(), bloodPressureSystolic: 110 + Math.round(Math.random() * 20),
        bloodPressureDiastolic: 70 + Math.round(Math.random() * 12), pulse: 68 + Math.round(Math.random() * 12),
        respiratoryRate: 16 + Math.round(Math.random() * 4), weight: 55 + Math.round(Math.random() * 25),
        height: 155 + Math.round(Math.random() * 25), oxygenSaturation: 96 + Math.round(Math.random() * 3),
        bloodGlucose: 4.5 + Math.random() * 2, painScore: Math.round(Math.random() * 4),
      },
    });
  }

  // ═══ ADMISSION ═══
  const privWard = await db.ward.findFirst({ where: { wardType: 'PRIVATE' } });
  const genWard = await db.ward.findFirst({ where: { wardType: 'GENERAL', gender: 'FEMALE' } });
  const beds = privWard ? await db.bed.findMany({ where: { wardId: privWard.id } }) : [];
  if (beds.length) {
    await db.admission.create({
      data: {
        admissionNo: 'ADM-0001', patientId: patMap['Rose Achieng'], bedId: beds[0].id,
        admissionType: 'ELECTIVE', admittedById: nurseUser!.id, doctorId: doctorUser!.id,
        admittingDiagnosis: 'Severe anemia — for transfusion', status: 'ACTIVE',
      },
    });
    await db.bed.update({ where: { id: beds[0].id }, data: { status: 'OCCUPIED' } });
  }
  if (genWard) {
    const gBeds = await db.bed.findMany({ where: { wardId: genWard.id } });
    if (gBeds.length) {
      await db.admission.create({
        data: {
          admissionNo: 'ADM-0002', patientId: patMap['Jane Wanjiku'], bedId: gBeds[0].id,
          admissionType: 'MATERNITY', admittedById: nurseUser!.id, doctorId: doctor2User!.id,
          admittingDiagnosis: 'ANC — awaiting delivery', status: 'ACTIVE',
        },
      });
      await db.bed.update({ where: { id: gBeds[0].id }, data: { status: 'OCCUPIED' } });
    }
  }

  // ═══ ANC & VACCINATIONS ═══
  await db.aNCRegistration.create({
    data: {
      ancNo: 'ANC-0001', patientId: patMap['Jane Wanjiku'], lmpDate: new Date(Date.now() - 196 * 864e5),
      eddDate: new Date(Date.now() + 84 * 864e5), gravida: 2, para: 1,
      gestationWeeks: 28, bloodGroup: 'O+', rhFactor: 'Positive',
      supplements: 'Iron + Folic acid', pmtctEnrolled: true, registeredById: nurseUser!.id,
    },
  });
  for (const [name, vaccine] of [['Jane Wanjiku', 'Tetanus Toxoid (TT2)'], ['Rose Achieng', 'Influenza']]) {
    await db.vaccinationRecord.create({
      data: { patientId: patMap[name], vaccineName: vaccine, doseNumber: 1, dateGiven: new Date(Date.now() - 14 * 864e5), nextDueDate: new Date(Date.now() + 76 * 864e5), administeredBy: 'Faith Njeri' },
    });
  }

  // ═══ BILLS & PAYMENTS (history for cashier + profit-loss) ═══
  for (let i = 0; i < 12; i++) {
    const patientName = `${patientsData[i % 15][0]} ${patientsData[i % 15][1]}`;
    const billItems = [
      { itemType: 'CONSULTATION', serviceId: serviceMap['CONS-GEN'], itemName: 'General Consultation', quantity: 1, unitPrice: 1500, totalPrice: 1500, department: 'General Medicine', shaCovered: false, sourceRef: '' },
      { itemType: 'LAB', serviceId: serviceMap['LAB-CBC'], itemName: 'Full Blood Count (CBC)', quantity: 1, unitPrice: 900, totalPrice: 900, department: 'Laboratory', shaCovered: true, sourceRef: '' },
      { itemType: 'LAB', serviceId: serviceMap['LAB-MAL'], itemName: 'Malaria Rapid Test', quantity: 1, unitPrice: 500, totalPrice: 500, department: 'Laboratory', shaCovered: true, sourceRef: '' },
    ];
    const subtotal = billItems.reduce((s, b) => s + b.totalPrice, 0);
    const bill = await db.bill.create({
      data: {
        billNo: `BIL-${String(i + 1).padStart(4, '0')}`,
        receiptNo: `BHD-R-${String(10250 + i)}`,
        patientId: patMap[patientName], cashierId: cashierUser!.id,
        subtotal, totalAmount: subtotal,
        paidAmount: i < 9 ? subtotal : 0,
        paymentMode: i % 3 === 0 ? 'SHA' : i % 3 === 1 ? 'CASH' : 'MPESA',
        status: i < 9 ? 'PAID' : 'UNPAID',
        createdAt: new Date(Date.now() - (11 - i) * 864e5),
        items: { create: billItems },
      },
    });
    if (i < 9) {
      await db.payment.create({
        data: {
          paymentNo: `PAY-${String(i + 1).padStart(4, '0')}`, billId: bill.id, patientId: bill.patientId,
          amount: subtotal, method: bill.paymentMode,
          receivedById: cashierUser!.id, status: 'COMPLETED',
          createdAt: new Date(Date.now() - (11 - i) * 864e5),
        },
      });
    }
  }
  console.log('✓ clinical history & billing');

  // ═══ PHARMACY SALES (history) ═══
  for (let i = 0; i < 10; i++) {
    const drug = await db.drug.findFirst({ where: { name: drugs[i % drugs.length][0] } });
    if (!drug) continue;
    const qty = 1 + (i % 3);
    const sale = await db.pharmacySale.create({
      data: {
        saleNo: `SAL-${String(i + 1).padStart(4, '0')}`,
        receiptNo: `RXN-${String(20450 + i)}`,
        pharmacistId: pharmaUser!.id,
        patientName: i % 2 ? `${patientsData[i % 15][0]} ${patientsData[i % 15][1]}` : 'Walk-in Customer',
        patientId: i % 2 ? patMap[`${patientsData[i % 15][0]} ${patientsData[i % 15][1]}`] : null,
        subtotal: drug.unitPrice * qty, totalAmount: drug.unitPrice * qty,
        totalCost: drug.unitCost * qty,
        paymentMethod: i % 3 === 0 ? 'MPESA' : 'CASH',
        paymentStatus: 'COMPLETED',
        createdAt: new Date(Date.now() - (9 - i) * 864e5),
        items: { create: [{ drugId: drug.id, drugName: drug.name, quantity: qty, unitPrice: drug.unitPrice, unitCost: drug.unitCost, totalPrice: drug.unitPrice * qty }] },
      },
    });
    void sale;
  }

  // ═══ QUOTATION ═══
  const quotation = await db.quotation.create({
    data: {
      quotationNo: 'QTN-0001', customerName: 'Kilimani Junior School',
      customerPhone: '+254722000111', customerEmail: 'admin@kilimanijunior.ac.ke',
      subtotal: 187500, discountAmount: 12500, totalAmount: 175000,
      status: 'SENT', validUntil: new Date(Date.now() + 21 * 864e5),
      notes: 'Term 2 medical camp — 500 pupils screening package',
      createdById: adminUser!.id,
      items: {
        create: [
          { itemType: 'SERVICE', serviceId: serviceMap['LAB-CBC'], itemName: 'Full Blood Count (CBC) × 500 pupils', quantity: 500, unitPrice: 150, totalPrice: 75000 },
          { itemType: 'SERVICE', serviceId: serviceMap['LAB-MAL'], itemName: 'Malaria Rapid Test × 500', quantity: 500, unitPrice: 200, totalPrice: 100000 },
          { itemType: 'SERVICE', serviceId: serviceMap['CONS-GEN'], itemName: 'Consultation sessions (5 doctors)', quantity: 5, unitPrice: 2500, totalPrice: 12500 },
        ],
      },
    },
  });
  void quotation;

  // ═══ HR: JOBS & APPLICATIONS & PAYROLL ═══
  const jobs: Array<[string, string, string, number]> = [
    ['Registered Nurse — ICU', 'ICU & Critical Care', 'Vihiga', 1],
    ['Clinical Officer', 'General Medicine', 'Vihiga', 2],
    ['Pharmaceutical Technologist', 'Pharmacy', 'Vihiga', 1],
    ['Lab Technologist', 'Laboratory', 'Vihiga', 1],
    ['Radiographer', 'Diagnostic Imaging', 'Vihiga', 1],
  ];
  const jobMap: Record<string, string> = {};
  for (const [title, department, location, openings] of jobs) {
    const j = await db.jobPosting.create({
      data: {
        title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        department, location, employmentType: 'FULL_TIME',
        description: `<p>Boyani Health Dispensary is seeking a qualified <strong>${title}</strong> to join our ${department} team. We offer a supportive environment, continuous professional development and competitive remuneration.</p>`,
        requirements: '<ul><li>Diploma or Degree in relevant field from a recognized institution</li><li>Valid practicing license</li><li>Minimum 2 years experience</li><li>Strong interpersonal skills</li></ul>',
        salaryRange: 'KSh 45,000 – 95,000', openings, isPublic: true, status: 'OPEN',
        deadline: new Date(Date.now() + 30 * 864e5), createdBy: 'admin',
      },
    });
    jobMap[title] = j.id;
  }
  for (const [name, jobTitle, status] of [
    ['Ann Nduta', 'Registered Nurse — ICU', 'UNDER_REVIEW'],
    ['Victor Ouma', 'Clinical Officer', 'RECEIVED'],
    ['Halima Yusuf', 'Pharmaceutical Technologist', 'SHORTLISTED'],
    ['Dennis Kipkorir', 'Lab Technologist', 'RECEIVED'],
  ] as Array<[string, string, string]>) {
    await db.jobApplication.create({
      data: {
        jobPostingId: jobMap[jobTitle], applicantName: name,
        email: `${name.split(' ')[0].toLowerCase()}@gmail.com`, phone: '+254712444555',
        coverLetter: 'I am passionate about delivering quality care and would love to grow with Boyani Health Dispensary.',
        status,
      },
    });
  }
  // Payroll for current month
  const now = new Date();
  for (const [empName, , , , salary] of employees.map(e => [`${e[0]} ${e[1]}`, e[2], e[3], e[4], e[5]] as [string, string, string, number, string])) {
    const emp = await db.employee.findFirst({ where: { id: empMap[empName] } });
    if (!emp) continue;
    const basic = emp.salary;
    const allowances = Math.round(basic * 0.15);
    const gross = basic + allowances;
    const taxable = gross;
    const paye = taxable <= 24000 ? 0 : Math.max(0, (Math.min(taxable, 32333) - 24000) * 0.25 + Math.max(0, taxable - 32333) * 0.30 - 2400);
    const nssf = Math.min(1080, basic * 0.06);
    const shif = gross <= 5999 ? 150 : gross <= 7999 ? 300 : gross <= 11999 ? 400 : gross <= 19999 ? 500 : gross <= 49999 ? 750 : 1700;
    const housing = gross * 0.015;
    const net = gross - paye - nssf - shif - housing;
    await db.payrollRecord.create({
      data: {
        payrollNo: `PRD-${String(Object.keys(empMap).indexOf(empName) + 1).padStart(4, '0')}`,
        employeeId: emp.id, periodMonth: now.getMonth() + 1, periodYear: now.getFullYear(),
        basicSalary: basic, allowances, grossPay: gross,
        paye: Math.round(paye), nssfDeduction: Math.round(nssf), shifDeduction: shif,
        housingLevy: Math.round(housing), netPay: Math.round(net), status: 'DRAFT',
      },
    });
  }

  // ═══ PAYROLL CONFIG ═══ (editable at HR → Settings; the payroll engine in
  // /api/payroll reads these on every run — unknown/missing keys fall back to
  // the hard-coded defaults, which equal the values below)
  await db.payrollConfig.createMany({
    data: [
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
    ],
  });
  console.log('✓ payroll config');

  // ═══ ATTENDANCE ═══
  await db.attendanceConfig.createMany({
    data: [
      { key: 'facility_ip', value: '196.201.214.200' },
      { key: 'allowed_latitude', value: '0.0659' },
      { key: 'allowed_longitude', value: '34.7180' },
      { key: 'radius_meters', value: '250' },
    ],
  });
  for (let d = 1; d <= 5; d++) {
    const date = new Date(); date.setDate(date.getDate() - d); date.setHours(0, 0, 0, 0);
    for (const [username] of [['admin'], ['doctor'], ['nurse'], ['pharmacist'], ['cashier'], ['registrar']]) {
      const u = await db.user.findUnique({ where: { username } });
      if (!u) continue;
      // Link the attendance row to the Employee record so HR tables show
      // real employee names (fixes the old "User cmtzjyi6" bug).
      const emp = await db.employee.findFirst({ where: { userId: u.id } });
      const checkIn = new Date(date); checkIn.setHours(7 + Math.floor(Math.random() * 2), Math.round(Math.random() * 59));
      const checkOut = new Date(date); checkOut.setHours(16 + Math.floor(Math.random() * 3), Math.round(Math.random() * 59));
      await db.attendanceRecord.create({
        data: {
          userId: u.id, employeeId: emp?.id || null, date, checkIn, checkOut,
          checkInLat: 0.0659 + (Math.random() - 0.5) * 0.001, checkInLng: 34.7180 + (Math.random() - 0.5) * 0.001,
          status: checkIn.getHours() >= 9 ? 'LATE' : 'PRESENT',
          workHours: Math.round(((checkOut.getTime() - checkIn.getTime()) / 3600e3) * 100) / 100,
        },
      });
    }
  }

  // Sample login history so /admin/users → Login History is populated
  for (const [username] of [['admin'], ['doctor'], ['registrar'], ['cashier']]) {
    const u = await db.user.findUnique({ where: { username } });
    if (!u) continue;
    for (let d = 1; d <= 4; d++) {
      const inAt = new Date(); inAt.setDate(inAt.getDate() - d); inAt.setHours(7 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 59));
      const outAt = new Date(inAt); outAt.setHours(16 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 59));
      await db.userLoginHistory.create({
        data: {
          userId: u.id, action: 'LOGIN', ipAddress: '196.201.214.200',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128',
          loggedInAt: inAt, loggedOutAt: outAt,
          durationMinutes: Math.round((outAt.getTime() - inAt.getTime()) / 60000),
        },
      });
    }
  }

  // ═══ INVENTORY ═══
  const invItems: Array<[string, string, number, number, string]> = [
    ['Wheelchair (Standard)', 'EQUIPMENT', 12, 18500, ''],
    ['Hospital Bed (Manual)', 'EQUIPMENT', 35, 85000, ''],
    ['Oxygen Cylinder (10L)', 'EQUIPMENT', 18, 22000, ''],
    ['Suction Machine', 'EQUIPMENT', 6, 45000, ''],
    ['ECG Machine', 'EQUIPMENT', 3, 320000, ''],
    ['Surgical Gloves (Box)', 'CONSUMABLES', 220, 850, ''],
    ['Syringes 5ml (Pack 100)', 'CONSUMABLES', 140, 1200, ''],
    ['Cotton Wool 500g', 'CONSUMABLES', 90, 380, ''],
    ['Bandages (Roll)', 'CONSUMABLES', 300, 120, ''],
    ['Face Masks (Box 50)', 'CONSUMABLES', 160, 450, ''],
    ['Bed Linen Sets', 'LINEN', 180, 1500, ''],
    ['Patient Gowns', 'LINEN', 240, 900, ''],
    ['Office Desktop Computer', 'IT', 14, 55000, ''],
    ['Printer (Multifunction)', 'IT', 5, 28000, ''],
    ['Waiting Bench (3-seater)', 'FURNITURE', 22, 12500, ''],
    ['Filing Cabinet', 'FURNITURE', 9, 18500, ''],
    ['Detergent (20L)', 'CLEANING', 45, 1800, ''],
    ['Disinfectant (5L)', 'CLEANING', 60, 950, ''],
    ['A4 Paper (Ream)', 'STATIONERY', 120, 650, ''],
    ['Thermometer (Digital)', 'EQUIPMENT', 40, 1200, ''],
  ];
  for (const [name, category, quantity, unitCost, assignedTo] of invItems) {
    await db.inventoryItem.create({
      data: {
        code: `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6)}`,
        name, category, quantity, unitCost, unitPrice: unitCost,
        reorderLevel: Math.max(5, Math.round(quantity / 6)),
        assignedTo, location: 'Main Store',
      },
    });
  }

  console.log('✓ HR, attendance, inventory');

  // ═══ WEBSITE: SLIDERS ═══
  const sliders = [
    { title: 'Modern Care, Every Day', subtitle: 'Boyani Health Dispensary — Vihiga, Kenya', description: 'From consultations and diagnostics to prescription dispensing — our teams deliver quality care with dignity.', imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1600&q=80', ctaPrimaryText: 'Book an Appointment', ctaPrimaryUrl: '/booking', ctaSecondaryText: 'Our Services', ctaSecondaryUrl: '/services', designId: 1, displayOrder: 0 },
    { title: 'Trusted Dispensary & Pharmacy Services', subtitle: 'Genuine medicine, expert nursing care', description: 'Prescription dispensing, medication therapy reviews, immunisations and walk-in consultations — open Mon–Sat.', imageUrl: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1600&q=80', ctaPrimaryText: 'Pharmacy Services', ctaPrimaryUrl: '/services/pharmacy-services', designId: 2, displayOrder: 1 },
    { title: 'Contact Us Anytime', subtitle: 'We are here to help', description: 'Call or WhatsApp us on 0750239057 for appointments, emergencies and enquiries.', imageUrl: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1600&q=80', ctaPrimaryText: 'Call Now', ctaPrimaryUrl: 'tel:0750239057', designId: 3, displayOrder: 2 },
    { title: 'Laboratory & Diagnostics', subtitle: 'Fast, accurate results', description: 'ISO-certified labs and same-day results delivered to your doctor.', imageUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=1600&q=80', ctaPrimaryText: 'Explore Diagnostics', ctaPrimaryUrl: '/services/laboratory-diagnostics', designId: 4, displayOrder: 3 },
    { title: 'Affordable Healthcare', subtitle: 'SHA & insurance accepted', description: 'We are fully integrated with SHA and major private insurers. Transparent pricing on all services.', imageUrl: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=1600&q=80', ctaPrimaryText: 'Our Services', ctaPrimaryUrl: '/services', designId: 5, displayOrder: 4 },
  ];
  for (const s of sliders) {
    await db.slider.create({ data: { ...s, overlayColor: '#0f172a', overlayOpacity: 0.45, autoRotate: true, rotateDelayMs: 6000 } });
  }

  // ═══ WEBSITE: DOCTOR PROFILES ═══
  const doctorsPub: Array<[string, string, string, number]> = [
    ['Dr. James Mutua', 'Internal Medicine', 'MBChB (Nairobi), MMed Internal Medicine', 12],
    ['Dr. Grace Achieng', 'Pediatrics', 'MBChB (Moi), MMed Pediatrics', 9],
    ['Dr. Peter Kimani', 'Obstetrics & Gynecology', 'MBChB (Nairobi), MMed Obs/Gyn', 14],
    ['Dr. Sarah Njoki', 'General Surgery', 'MBChB (UON), MMed Surgery, FCS-ECSA', 11],
    ['Dr. Emily Kariuki', 'Cardiology', 'MBChB, MMed, Fellowship Cardiology (SA)', 10],
    ['Dr. Brian Odhiambo', 'Orthopedics', 'MBChB (Nairobi), MMed Ortho', 8],
    ['Dr. Naomi Wanjala', 'Dermatology', 'MBChB, MMed Dermatology', 6],
    ['Dr. Felix Omondi', 'Mental Health', 'MBChB, MMed Psychiatry', 7],
  ];
  for (const [name, specialization, qualifications, years] of doctorsPub) {
    await db.doctorProfile.create({
      data: {
        employeeId: '', name, title: 'Dr.', specialization, department: specialization,
        qualifications, experienceYears: years, consultationFee: specialization.includes('Cardiolog') || specialization.includes('Surgery') ? 3500 : 2000,
        bio: `${name} has ${years} years of experience serving patients across Kenya with a focus on ${specialization.toLowerCase()}.`,
        photoUrl: '', availableDays: 'Mon–Fri', availableHours: '08:00–17:00', isAcceptingPatients: true, displayOrder: doctorsPub.findIndex(d => d[0] === name),
      },
    });
  }

  // ═══ WEBSITE: WEB PAGES ═══
  const webPages = [
    {
      slug: 'about-us', title: 'About Us', moduleKey: 'ABOUT',
      excerpt: 'Serving Vihiga and surrounding communities with quality, affordable dispensary and healthcare services.',
      content: `<h2>Who We Are</h2><p>Boyani Health Dispensary has been a trusted community health facility serving Vihiga town and the wider Vihiga County region. Today we are a full-service dispensary and clinic with multiple departments, modern diagnostic capabilities, and a strong commitment to our founding promise: <strong>quality care, compassionate service</strong>.</p><h3>Our Milestones</h3><ul><li>Founded as Boyani Health Dispensary, Vihiga</li><li>Expanded dispensing and consultation unit</li><li>Launched outpatient clinic services</li><li>ISO laboratory accreditation</li><li>SHA-integrated billing across all departments</li><li>Full digital clinic &amp; dispensary management platform launched</li></ul><h3>Leadership</h3><p>Our team blends experienced clinicians, pharmacists and administrators committed to community health.</p>`,
    },
    {
      slug: 'why-choose-us', title: 'Why Choose Us', moduleKey: 'WHY_CHOOSE_US',
      excerpt: 'Six reasons patients in Vihiga trust Boyani Health Dispensary with their health.',
      content: `<h2>Why Patients Choose Boyani Health Dispensary</h2><p>Choosing a healthcare facility is choosing a partner for your health. Here is what makes Boyani Health Dispensary different:</p><ul><li><strong>Qualified clinical team</strong> — experienced doctors and nurses on every shift.</li><li><strong>Transparent pricing</strong> — every service published and honoured.</li><li><strong>SHA &amp; insurance ready</strong> — we handle the paperwork.</li><li><strong>Nursing, pharmacy &amp; clinic under one roof</strong> — labs, consultations and dispensing in one visit.</li><li><strong>Fast turnaround</strong> — minimal waiting, efficient service delivery.</li><li><strong>Community-focused</strong> — free screening and health education drives regularly.</li></ul>`,
    },
    {
      slug: 'our-values', title: 'Our Values', moduleKey: 'VALUES',
      excerpt: 'Integrity · Compassion · Excellence · Community.',
      content: `<h2>The Values That Guide Every Decision</h2><p><strong>Integrity:</strong> We do the right thing when nobody is watching — clinically and financially.</p><p><strong>Compassion:</strong> Every patient is somebody's parent, child or friend. We treat them accordingly.</p><p><strong>Excellence:</strong> Continuous audit, continuous training, continuous improvement.</p><p><strong>Community:</strong> A healthy community is our shareholders' only exit strategy — we invest in it.</p>`,
    },
    {
      slug: 'vision-mission', title: 'Vision & Mission', moduleKey: 'VISION_MISSION',
      excerpt: 'Our vision: a healthy community where geography and income never decide outcomes.',
      content: `<h2>Our Vision</h2><p>To be Vihiga's most trusted dispensary and clinic — where quality care is accessible to every family in the region and beyond.</p><h2>Our Mission</h2><p>To deliver affordable, evidence-based, compassionate care through skilled teams, modern facilities and honest pricing — while serving and uplifting our community.</p>`,
    },
  ];
  for (const p of webPages) {
    await db.webPage.create({
      data: { ...p, heroDesignId: 1, breadcrumbDesignId: 1, isPublic: true, publishedAt: new Date(), displayOrder: webPages.findIndex(w => w.slug === p.slug) },
    });
  }

  // ═══ WEBSITE: NEWS ═══
  const news: Array<[string, string, string, boolean]> = [
    ['Boyani Health Dispensary expands consultation wing', 'Announcement of our extended consultation and dispensing space in Vihiga.', 'ANNOUNCEMENTS', true],
    ['Free breast cancer screening month', 'Every October, clinical breast exams are free at Boyani Health Dispensary.', 'EVENTS', true],
    ['Managing hypertension at home', 'Our clinical team shares a practical guide to blood-pressure control between visits.', 'HEALTH_TIPS', false],
    ['Boyani Health Dispensary lab achieves ISO accreditation', 'Accreditation granted after rigorous quality audit.', 'RESEARCH', false],
    ['New diagnostic equipment improves turnaround', 'Results now available within 24 hours for most tests.', 'ANNOUNCEMENTS', true],
    ['Community health drive: school screening', 'How our teams reached pupils across Vihiga last term.', 'EVENTS', false],
  ];
  for (let i = 0; i < news.length; i++) {
    const [title, excerpt, category, isFeatured] = news[i];
    await db.newsPost.create({
      data: {
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        title, excerpt, category, isFeatured,
        content: `<p>${excerpt}</p><p>Boyani Health Dispensary continues to invest in the people, equipment and systems that keep Vihiga families healthy. Follow our newsroom for announcements, health tips and community stories.</p>`,
        coverImageUrl: ['https://images.unsplash.com/photo-1516549655169-df83a0774514?w=1200&q=80', 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&q=80'][i % 2],
        author: 'Boyani Health Dispensary Communications', isPublic: true,
        publishedAt: new Date(Date.now() - (i * 6 + 2) * 864e5),
      },
    });
  }

  // ═══ WEBSITE: DOWNLOADS ═══
  const downloads = [
    ['Patient Registration Form', 'FORMS', '/downloads/patient-registration-form.pdf'],
    ['SHA Insurance Claim Guide', 'FORMS', '/downloads/sha-claim-guide.pdf'],
    ['Boyani Health Dispensary Service Price List 2026', 'REPORTS', '/downloads/service-price-list-2026.pdf'],
    ['Visiting Hours Policy', 'POLICIES', '/downloads/visiting-hours-policy.pdf'],
    ['Patient Rights & Responsibilities', 'POLICIES', '/downloads/patient-rights.pdf'],
    ['Annual Health Report 2025', 'REPORTS', '/downloads/annual-report-2025.pdf'],
    ['Nursing Home Brochure', 'BROCHURES', '/downloads/boyani-health-dispensary-brochure.pdf'],
    ['Careers — Application Form', 'FORMS', '/downloads/job-application-form.pdf'],
  ];
  for (let i = 0; i < downloads.length; i++) {
    const [title, category, fileUrl] = downloads[i];
    await db.download.create({
      data: { title, description: `${title} — downloadable PDF from Boyani Health Dispensary.`, fileUrl, fileExt: 'pdf', category, fileSize: 250000 + i * 40000, isPublic: true, displayOrder: i },
    });
  }

  // ═══ WEBSITE: GALLERY ═══
  const galleryImgs = [
    'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&q=80',
    'https://images.unsplash.com/photo-1551190822-a424d8e2d1c1?w=800&q=80',
    'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800&q=80',
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80',
    'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800&q=80',
    'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80',
  ];
  const albums: Array<[string, string, number[]]> = [
    ['Our Facilities', 'A look inside Boyani Health Dispensary — nursing wards, clinic and diagnostics.', [0, 1, 2]],
    ['Care in Action', 'Our teams at work across departments.', [3, 4, 5]],
  ];
  for (const [title, description, idxs] of albums) {
    const album = await db.galleryAlbum.create({
      data: { title, slug: title.toLowerCase().replace(/\s+/g, '-'), description, coverImageUrl: galleryImgs[idxs[0]], isPublic: true, displayOrder: albums.findIndex(a => a[0] === title) },
    });
    for (const idx of idxs) {
      await db.galleryPhoto.create({
        data: { albumId: album.id, imageUrl: galleryImgs[idx], title, caption: `${title} — Boyani Health Dispensary`, displayOrder: idx },
      });
    }
  }

  // ═══ WEBSITE: TESTIMONIALS & FAQ ═══
  const testimonials: Array<[string, string, string, string, number]> = [
    ['Wanjala S.', 'Father of two', 'When our son needed urgent care, the Boyani Health Dispensary team attended to him and had him comfortable within the hour. We cannot thank them enough.', 'Emergency Care', 5],
    ['Mrs. Aoko', 'New mother', 'The team was professional and caring throughout my care journey. This facility is a blessing.', 'Maternity', 5],
    ['Eng. Kamau', 'Hypertension patient', 'Same-day labs, results in my doctor’s hands by noon, and my SHA claim filed without me lifting a finger. Efficient!', 'Chronic Care', 5],
    ['Halima Y.', 'Pharmacy customer', 'The pharmacist explained my mother’s diabetes medication clearly — in Swahili — and checked for interactions. Wonderful service.', 'Pharmacy', 4],
  ];
  for (const [patientName, patientTitle, quote, department, rating] of testimonials) {
    await db.testimonial.create({
      data: { patientName, patientTitle, quote, department, rating, isPublic: true, isFeatured: true, displayOrder: testimonials.findIndex(t => t[0] === patientName) },
    });
  }
  const faqs: Array<[string, string, string]> = [
    ['How do I book an appointment?', 'Use the online booking form on this website (choose your doctor and preferred time), call 0750239057, or walk in to our reception desk. Website bookings are confirmed by our front office within one working hour.', 'APPOINTMENTS'],
    ['Which insurance do you accept?', 'We are fully integrated with SHA (Social Health Authority) and accept major private insurers including AAR, Jubilee Health, Britam, CIC and Old Mutual. Bring your membership card to registration.', 'INSURANCE'],
    ['What are your visiting hours?', 'General wards: 10:00–12:00 and 16:00–19:00 daily. ICU: strictly 16:00–17:00, one visitor at a time. Maternity: 12:00–14:00 for partners only.', 'VISITING'],
    ['Do I pay at the laboratory or pharmacy?', 'No. Laboratory, pharmacy (for registered patients) and ward charges are consolidated to your visit bill which is settled once at the cashier. Walk-in pharmacy customers pay at the pharmacy counter.', 'BILLING'],
    ['Can I collect my lab results online?', 'Yes — results are delivered to your doctor automatically. Printed copies are available at the records office 24 hours after testing with valid ID.', 'GENERAL'],
    ['Is the pharmacy open to non-patients?', 'Yes. Our pharmacy serves walk-in customers with genuine, KEMSA-sourced medicine and free professional advice, open 08:00–21:00 daily including Sundays.', 'PHARMACY'],
  ];
  for (let i = 0; i < faqs.length; i++) {
    await db.faq.create({
      data: { question: faqs[i][0], answer: faqs[i][1], category: faqs[i][2], displayOrder: i, isPublic: true },
    });
  }

  // ═══ WEBSITE: MENUS ═══
  const menu = await db.menu.create({ data: { name: 'Main Navigation', slug: 'main', location: 'HEADER', designId: 1 } });
  const footerMenu = await db.menu.create({ data: { name: 'Footer Menu', slug: 'footer', location: 'FOOTER', designId: 1 } });
  const mainItems: Array<[string, string, string, boolean]> = [
    ['Home', '/', '', false],
    ['About Us', '/about', 'ABOUT', true],
    ['Our Services', '/services', 'SERVICES', true],
    ['News', '/news', 'NEWS', false],
    ['Downloads', '/downloads', 'DOWNLOADS', false],
    ['Contact Us', '/contact', 'CONTACT', false],
  ];
  for (let i = 0; i < mainItems.length; i++) {
    const [label, url, moduleKey, isMega] = mainItems[i];
    await db.menuItem.create({
      data: {
        menuId: menu.id, label, url, moduleKey: moduleKey || null, isMega,
        megaColumns: 4, megaDescription: 'Explore Boyani Health Dispensary departments and services',
        displayOrder: i, iconKey: '',
      },
    });
  }
  for (const [label, url] of [['About Us', '/about'], ['Why Choose Us', '/about/why-choose-us'], ['Our Values', '/about/our-values'], ['Vision & Mission', '/about/vision-mission'], ['Our Services', '/services'], ['Careers', '/careers'], ['FAQ', '/faq']]) {
    await db.menuItem.create({
      data: { menuId: footerMenu.id, label, url, displayOrder: footerMenu ? 0 : 0, iconKey: '' },
    });
  }

  // ═══ CONTACT MESSAGE ═══
  await db.contactMessage.create({
    data: { name: 'Joseph Mwangi', email: 'jmwangi@gmail.com', phone: '+254722111222', subject: 'Corporate screening enquiry', message: 'Our company (85 staff) would like a quote for annual medical screening. Please advise.', department: 'GENERAL', status: 'NEW' },
  });

  console.log('✓ website content');

  // ═══ HOMEPAGE DESIGNS (18) & WIDGETS (40 modules) ═══
  // 40 widget module keys (reused across designs with variants)
  const WIDGET_KEYS = [
    'HERO_SLIDER', 'EMERGENCY_STRIP', 'QUICK_ACTIONS', 'SERVICES_GRID', 'DEPARTMENTS_MEGA',
    'STATS_COUNTERS', 'ABOUT_SPLIT', 'WHY_CHOOSE_US', 'DOCTORS_CAROUSEL', 'DOCTORS_GRID',
    'MCH_HIGHLIGHT', 'MATERNITY_SHOWCASE', 'LAB_SHOWCASE', 'PHARMACY_SHOWCASE', 'ADMISSION_INFO',
    'TESTIMONIALS_CAROUSEL', 'NEWS_GRID', 'NEWS_LIST', 'APPOINTMENT_CTA', 'APPOINTMENT_FORM_INLINE',
    'CONTACT_BANNER', 'DOWNLOADS_LIST', 'GALLERY_MASONRY', 'GALLERY_CAROUSEL', 'FAQ_ACCORDION',
    'PARTNERS_STRIP', 'INSURANCE_STRIP', 'BLOG_MAGAZINE', 'VIDEO_STORY', 'TIMELINE_HISTORY',
    'VALUES_CARDS', 'VISION_MISSION_SPLIT', 'TEAM_LEADERSHIP', 'PRICING_TABLES', 'HEALTH_TIPS',
    'CTA_GRADIENT', 'APP_DOWNLOAD', 'MAP_CONTACT', 'FOOTER_NEWSLETTER',
  ];

  // 18 homepage designs — each imitates an inspirational direction
  const designs = [
    { name: 'Nairobi Hospital Classic', description: 'Classic hospital elegance — topbar + slider + services grid + doctors + news (inspired by thenairobihosp.org)', widgets: ['HERO_SLIDER', 'EMERGENCY_STRIP', 'QUICK_ACTIONS', 'SERVICES_GRID', 'ABOUT_SPLIT', 'DOCTORS_GRID', 'NEWS_GRID', 'APPOINTMENT_CTA'] },
    { name: 'Avenue Modern Care', description: 'Modern patient-centric layout with rounded cards and warm imagery (avenuehealthcare.com)', widgets: ['HERO_SLIDER', 'STATS_COUNTERS', 'SERVICES_GRID', 'WHY_CHOOSE_US', 'DOCTORS_CAROUSEL', 'TESTIMONIALS_CAROUSEL', 'APPOINTMENT_FORM_INLINE', 'FOOTER_NEWSLETTER'] },
    { name: 'Karen Centres of Excellence', description: 'Centres-of-excellence showcase layout (karenhospital.org)', widgets: ['HERO_SLIDER', 'DEPARTMENTS_MEGA', 'MCH_HIGHLIGHT', 'LAB_SHOWCASE', 'DOCTORS_GRID', 'NEWS_LIST', 'CONTACT_BANNER'] },
    { name: 'KNH Institutional', description: 'Government-referral institutional layout — dense, accessible (knh.or.ke)', widgets: ['HERO_SLIDER', 'EMERGENCY_STRIP', 'QUICK_ACTIONS', 'SERVICES_GRID', 'NEWS_LIST', 'DOWNLOADS_LIST', 'PARTNERS_STRIP', 'FAQ_ACCORDION'] },
    { name: 'Editorial Split', description: 'Homepage1 inspiration — two-tier header, card-overlay hero, 70/30 split content + sidebar', widgets: ['HERO_SLIDER', 'NEWS_LIST', 'SERVICES_GRID', 'STATS_COUNTERS', 'INSURANCE_STRIP'] },
    { name: 'Bold Health Banner', description: 'Homepage2 direction — full-bleed banner hero, oversized type, gradient CTAs', widgets: ['HERO_SLIDER', 'QUICK_ACTIONS', 'STATS_COUNTERS', 'SERVICES_GRID', 'CTA_GRADIENT'] },
    { name: 'Magazine Health', description: 'Homepage3 direction — magazine grid, featured stories, category chips', widgets: ['HERO_SLIDER', 'NEWS_GRID', 'BLOG_MAGAZINE', 'HEALTH_TIPS', 'GALLERY_MASONRY'] },
    { name: 'Clinical Clarity', description: 'Homepage5 direction — airy clinical minimal, generous whitespace, icon-led', widgets: ['HERO_SLIDER', 'SERVICES_GRID', 'WHY_CHOOSE_US', 'DOCTORS_CAROUSEL', 'FAQ_ACCORDION'] },
    { name: 'Warm Community', description: 'Homepage6 direction — community photo story, warm tones, timeline history', widgets: ['HERO_SLIDER', 'ABOUT_SPLIT', 'TIMELINE_HISTORY', 'VALUES_CARDS', 'TESTIMONIALS_CAROUSEL'] },
    { name: 'Mega Department', description: 'Homepage7 direction — mega department browser with tabs and icons', widgets: ['HERO_SLIDER', 'DEPARTMENTS_MEGA', 'ADMISSION_INFO', 'DOCTORS_GRID', 'NEWS_LIST'] },
    { name: 'App-first Care', description: 'Homepage8 direction — app-download focus with device mockups', widgets: ['HERO_SLIDER', 'QUICK_ACTIONS', 'APP_DOWNLOAD', 'DOCTORS_CAROUSEL', 'STATS_COUNTERS'] },
    { name: 'Video Story', description: 'Homepage9 direction — cinematic video hero with story blocks', widgets: ['HERO_SLIDER', 'VIDEO_STORY', 'ABOUT_SPLIT', 'GALLERY_CAROUSEL', 'APPOINTMENT_CTA'] },
    { name: 'Insurance & Trust', description: 'Homepage10 direction — insurance-focused with partner strips and trust badges', widgets: ['HERO_SLIDER', 'INSURANCE_STRIP', 'PARTNERS_STRIP', 'SERVICES_GRID', 'TESTIMONIALS_CAROUSEL'] },
    { name: 'Maternal Focus', description: 'Homepage11 direction — maternity-first storytelling with soft palette', widgets: ['HERO_SLIDER', 'MATERNITY_SHOWCASE', 'MCH_HIGHLIGHT', 'DOCTORS_CAROUSEL', 'FAQ_ACCORDION'] },
    { name: 'Diagnostics Lab', description: 'Homepage12 direction — laboratory & imaging showcase, data-rich', widgets: ['HERO_SLIDER', 'LAB_SHOWCASE', 'PRICING_TABLES', 'NEWS_LIST', 'DOWNLOADS_LIST'] },
    { name: 'Pharmacy Retail', description: 'Homepage13 direction — pharmacy retail front with product-style cards', widgets: ['HERO_SLIDER', 'PHARMACY_SHOWCASE', 'HEALTH_TIPS', 'FAQ_ACCORDION', 'MAP_CONTACT'] },
    { name: 'Leadership Trust', description: 'Homepage14 direction — leadership/team showcase with heavy typography', widgets: ['HERO_SLIDER', 'TEAM_LEADERSHIP', 'VISION_MISSION_SPLIT', 'VALUES_CARDS', 'NEWS_GRID'] },
    { name: 'Booking-first', description: 'Homepage15 direction — booking wizard hero, minimal chrome', widgets: ['HERO_SLIDER', 'APPOINTMENT_FORM_INLINE', 'SERVICES_GRID', 'DOCTORS_CAROUSEL', 'TESTIMONIALS_CAROUSEL'] },
  ];

  // Each homepage design gets a distinct hero slider design (1-14) distributed
  // evenly across the four visual types A/B/C/D defined in SliderDesigns.tsx:
  //   Type A (frosted box + zoom):      1, 2, 3, 10
  //   Type B (opaque bottom band):      4, 5, 11, 14
  //   Type C (hero bg + framed image):  6, 7
  //   Type D (diagonal split):          8, 9, 13
  //   Special (carousel cards):         12
  const HERO_VARIANT: Record<number, number> = {
    1:  1,  // Nairobi Hospital Classic  → Type A: fade + zoom + frosted box
    2:  4,  // Avenue Modern Care        → Type B: LTR + opaque bottom band
    3:  6,  // Karen Centres             → Type C: hero bg + framed image right
    4:  8,  // KNH Institutional         → Type D: diagonal + typewriter left
    5:  2,  // Editorial Split           → Type A: LTR slide + zoom + frosted box
    6:  5,  // Bold Health Banner        → Type B: split-text + opaque bottom band
    7:  7,  // Magazine Health           → Type C: parallax + framed image right
    8:  9,  // Clinical Clarity          → Type D: diagonal + flip image right
    9:  3,  // Warm Community            → Type A: ken-burns zoom-in/out + frosted box
    10: 11, // Mega Department           → Type B: gradient opaque bottom band
    11: 13, // App-first                 → Type D: diagonal teal split
    12:  6, // Video Story               → Type C: hero bg + framed image right
    13: 10, // Insurance & Trust         → Type A: blur + zoom + frosted box
    14: 14, // Maternal Focus            → Type B: full-bleed + opaque bottom band
    15:  7, // Diagnostics Lab           → Type C: parallax + framed image right
    16: 12, // Pharmacy Retail           → carousel cards (premium)
    17:  8, // Leadership Trust          → Type D: diagonal + typewriter left
    18:  4, // Booking-first             → Type B: LTR + opaque bottom band
  };

  for (let di = 0; di < designs.length; di++) {
    const d = designs[di];
    const designKey = di + 1;
    const design = await db.homepageDesign.create({
      data: { name: d.name, description: d.description, designKey, isActive: di === 0 },
    });
    for (let wi = 0; wi < d.widgets.length; wi++) {
      const moduleKey = d.widgets[wi];
      // HERO_SLIDER gets its own dedicated design variant; all other widgets default to 1
      const variantId = moduleKey === 'HERO_SLIDER' ? (HERO_VARIANT[designKey] ?? 1) : 1;
      await db.homepageWidget.create({
        data: {
          designId: design.id, moduleKey, variantId,
          displayOrder: wi,
          sectionTitle: null, sectionSubtitle: null,
        },
      });
    }
  }
  console.log(`✓ ${designs.length} homepage designs · ${WIDGET_KEYS.length} widget modules`);

  // ═══ WEBSITE SERVICES (public-facing CMS — separate from facility pricing) ═══
  const wsDefs: Array<{
    slug: string; title: string; excerpt: string; dept?: string; icon: string; style: string; featured?: boolean;
    content: string;
    subs: Array<[string, string]>;
  }> = [
    {
      slug: 'general-consultations', title: 'General Consultations', icon: 'Stethoscope', style: 'cards', featured: true, dept: 'General Medicine',
      excerpt: 'Comprehensive primary care consultations — same-day appointments, thorough examination and clear treatment plans.',
      content: `<h2>Primary Care That Puts You First</h2><p>Our general consultation service is the front door to Boyani Health Dispensary. Whether you are managing a long-term condition or coming in with a new concern, our clinicians take the time to listen, examine and explain. Every consultation ends with a clear, written plan you can follow.</p><h3>What to Expect</h3><p>Registrations take minutes. Your vitals — blood pressure, temperature, pulse, weight and height — are recorded at the front desk before you see the clinician. Consultations cover history taking, physical examination, diagnosis and treatment, with prescriptions routed electronically to our pharmacy.</p><h3>Walk-ins Welcome</h3><p>We reserve slots every day for walk-in patients. For planned visits, book online in under a minute and choose your preferred clinician and time.</p>`,
      subs: [
        ['Adult General Consultation', 'Full history, examination, diagnosis and treatment planning for adults.'],
        ['Paediatric Consultation', 'Gentle, child-friendly assessment for infants through adolescence.'],
        ['Geriatric Assessment', 'Multi-system review and medication review for older patients.'],
        ['Teleconsultation', 'Speak to a clinician by phone or video and collect medication at the pharmacy.'],
        ['Follow-up Reviews', 'Structured progress reviews for ongoing treatment and chronic disease.'],
        ['Medical Certificates', 'Fit-for-work, school and insurance medical examinations.'],
      ],
    },
    {
      slug: 'laboratory-diagnostics', title: 'Laboratory & Diagnostics', icon: 'FlaskConical', style: 'table', featured: true, dept: 'Laboratory & Pathology',
      excerpt: 'Modern on-site laboratory — haematology, chemistry, serology, microbiology and histopathology with same-day results.',
      content: `<h2>Accurate Answers, Fast</h2><p>Our on-site laboratory processes hundreds of tests daily under strict quality controls. From routine blood work to specialized assays, results are delivered directly to your clinician — most within the same day.</p><h3>Quality You Can Trust</h3><p>The laboratory runs daily internal quality controls and participates in external quality assurance schemes. Every result is verified by a senior technologist before release.</p><h3>How It Works</h3><p>Your clinician recommends the tests, the laboratory team collects samples, and results are released to your doctor — who will explain them during your review. Printed copies are available at the records office.</p>`,
      subs: [
        ['Haematology', 'Full blood counts, blood films, coagulation studies and ESR.'],
        ['Clinical Chemistry', 'Blood sugar, lipids, liver, kidney, electrolytes and cardiac markers.'],
        ['Serology & Immunology', 'HIV, hepatitis, typhoid, brucella, syphilis and rheumatology screens.'],
        ['Microbiology', 'Cultures and sensitivity for urine, stool, blood and swabs.'],
        ['Histopathology', 'Pap smears, biopsies and fine-needle aspirations.'],
        ['Molecular Diagnostics', 'GeneXpert TB, HPV DNA and viral load testing.'],
        ['Point-of-Care Testing', 'Rapid malaria, pregnancy, glucose and H. pylori tests.'],
      ],
    },
    {
      slug: 'pharmacy-services', title: 'Pharmacy Services', icon: 'Pill', style: 'cards', featured: true, dept: 'Pharmacy',
      excerpt: 'Fully stocked dispensing pharmacy with genuine medicines, pharmacist counselling and chronic care refill programmes.',
      content: `<h2>Genuine Medicine, Expert Advice</h2><p>The Boyani Health Dispensary pharmacy dispenses genuine, traceable medicines sourced through authorized channels. Our pharmacists review every prescription for safety, interactions and correct dosing before dispensing.</p><h3>More Than Dispensing</h3><p>We offer medication therapy reviews, chronic disease refill reminders, blood pressure and blood sugar checks at the counter, and clear counselling — in English or Kiswahili — on how to take your medicine.</p><h3>Walk-in Service</h3><p>The pharmacy serves walk-in customers daily. Registered clinic patients have prescriptions routed directly from the consulting rooms.</p>`,
      subs: [
        ['Prescription Dispensing', 'Fast, verified dispensing with pharmacist counselling.'],
        ['Medication Therapy Review', 'A pharmacist reviews all your medicines for safety and interactions.'],
        ['Chronic Care Refills', 'Scheduled refills with reminders for diabetes, hypertension and more.'],
        ['Over-the-Counter Advisory', 'Professional advice on self-care products and supplements.'],
        ['Blood Pressure & Sugar Checks', 'Quick checks at the pharmacy counter.'],
        ['Health & Wellness Products', 'Vitamins, supplements and personal care essentials.'],
      ],
    },
    {
      slug: 'maternal-child-health', title: 'Maternal & Child Health', icon: 'Baby', style: 'cards', featured: true, dept: 'Maternity & Neonatal Care',
      excerpt: 'Complete mother-and-child journey — antenatal clinics, safe deliveries, immunization and well-child visits.',
      content: `<h2>Care for Every Step of the Journey</h2><p>From the first positive test to your child's school-readiness check, our maternal and child health team walks with you. Our maternity wing combines experienced midwives and obstetricians with modern, well-equipped delivery suites.</p><h3>Antenatal Care</h3><p>Structured ANC visits follow Ministry of Health guidelines, with laboratory profiles and ultrasound scans available on site.</p><h3>Safe Deliveries</h3><p>Normal deliveries and caesarean sections are handled around the clock by a dedicated on-call team, with a neonatal unit for babies who need extra care.</p>`,
      subs: [
        ['Antenatal Clinic', 'Scheduled ANC visits with laboratory and ultrasound services.'],
        ['Ultrasound in Pregnancy', 'Dating, growth and wellbeing scans.'],
        ['Normal Delivery', 'Midwife-led delivery in modern suites.'],
        ['Caesarean Section', 'Planned and emergency surgical deliveries.'],
        ['Postnatal Care', 'Mother and baby reviews after delivery.'],
        ['Child Immunization', 'Full KEPI schedule immunization.'],
        ['Well-Child Clinic', 'Growth monitoring, nutrition and development checks.'],
        ['Family Planning', 'Counselling and provision of modern methods.'],
      ],
    },
    {
      slug: 'diagnostic-imaging', title: 'Diagnostic Imaging', icon: 'ScanLine', style: 'table', dept: 'Diagnostic Imaging',
      excerpt: 'Digital X-ray, ultrasound, CT, MRI and echocardiography — clear images with fast, expert reporting.',
      content: `<h2>Seeing Clearly</h2><p>Our imaging department is equipped with digital radiography, modern ultrasound machines and partnerships for advanced cross-sectional imaging. Images are read by experienced radiologists with reports returned promptly to your clinician.</p><h3>Preparation & Comfort</h3><p>Most imaging needs no preparation. Where fasting or a full bladder is needed, our booking team will tell you in advance. Gowns and changing facilities are provided.</p>`,
      subs: [
        ['Digital X-Ray', 'Plain-film radiography for chest, limbs, spine and more.'],
        ['Ultrasound Scanning', 'Abdominal, pelvic, obstetric and vascular ultrasound.'],
        ['CT Scanning', 'Detailed cross-sectional imaging by referral.'],
        ['MRI Scanning', 'High-resolution soft-tissue imaging by referral.'],
        ['Echocardiography', 'Heart structure and function studies.'],
        ['Doppler Studies', 'Blood-flow studies for veins and arteries.'],
      ],
    },
    {
      slug: 'minor-procedures', title: 'Minor Procedures & Dressing Clinic', icon: 'Scissors', style: 'pills', dept: 'Surgery',
      excerpt: 'Suturing, wound care, incision & drainage, casts and other minor procedures — quick, safe and gentle.',
      content: `<h2>Small Procedures, Skilled Hands</h2><p>Our treatment room handles minor surgical procedures under local anaesthesia — no overnight stay required. From cleaning and closing cuts to draining abscesses and applying casts, our clinical team keeps you comfortable throughout.</p><h3>After-Care That Follows Up</h3><p>Every procedure includes a dressing plan, review appointments and clear instructions on warning signs. Our nursing team is a phone call away if you have concerns during healing.</p>`,
      subs: [
        ['Wound Dressing', 'Cleaning, dressing and monitoring of wounds.'],
        ['Suturing', 'Closing cuts and lacerations with care for cosmetic results.'],
        ['Incision & Drainage', 'Safe drainage of abscesses and collections.'],
        ['Plaster Casts', 'Application and removal of casts for fractures.'],
        ['Nebulization', 'Relief therapy for asthma and chest conditions.'],
        ['Injections & Cannulation', 'IM/IV injections and IV line placement.'],
      ],
    },
    {
      slug: 'chronic-disease-management', title: 'Chronic Disease Management', icon: 'HeartPulse', style: 'cards', dept: 'General Medicine',
      excerpt: 'Structured long-term care for diabetes, hypertension, asthma, HIV and other chronic conditions.',
      content: `<h2>Living Well with Long-Term Conditions</h2><p>Chronic diseases need more than a prescription — they need a plan. Our chronic care programme combines regular reviews, laboratory monitoring, medication optimization and lifestyle coaching to keep you stable and living fully.</p><h3>Our Clinics</h3><p>Dedicated clinic days for diabetes, hypertension and respiratory conditions mean shorter waits and focused attention. Each visit includes vitals, relevant tests, medication review and one-on-one health education.</p>`,
      subs: [
        ['Diabetes Clinic', 'Sugar monitoring, HbA1c reviews and complication screening.'],
        ['Hypertension Clinic', 'Blood pressure control and organ-protection planning.'],
        ['Asthma & COPD Clinic', 'Inhaler training and lung-function review.'],
        ['HIV Care', 'Compassionate, confidential testing and treatment.'],
        ['Medication Refill Programme', 'Scheduled refills so you never run out.'],
      ],
    },
    {
      slug: 'emergency-care', title: 'Emergency & Trauma Care', icon: 'Siren', style: 'pills', dept: 'Emergency & Trauma',
      excerpt: 'Rapid-response triage, resuscitation and stabilization for acute illness and injury — 24 hours a day.',
      content: `<h2>Ready When Every Minute Counts</h2><p>Our emergency team is equipped for rapid triage and stabilization of acute conditions — injuries, severe infections, breathing difficulty and more. An ambulance service operates within Vihiga and the wider Vihiga County for safe transfer.</p><h3>What to Bring</h3><p>Come as you are — we will handle registration during care. If time allows, identification and any medication you take help us treat you faster.</p>`,
      subs: [
        ['Triage & Stabilization', 'Immediate assessment and life-support measures.'],
        ['Trauma Care', 'Treatment of injuries from accidents and falls.'],
        ['Ambulance Service', 'Equipped transfer within Vihiga town and the wider Vihiga County.'],
        ['Observation Care', 'Short-stay monitoring before discharge or admission.'],
      ],
    },
    {
      slug: 'wellness-screening', title: 'Wellness & Screening Packages', icon: 'ShieldCheck', style: 'cards', dept: 'General Medicine',
      excerpt: 'Executive check-ups, pre-employment medicals and themed screening packages tailored to your needs.',
      content: `<h2>Prevention Is Better</h2><p>Our screening packages bundle consultations, laboratory tests and imaging into one structured visit — with results explained in a single review. Choose a standard package or let us tailor one for your age, lifestyle and family history.</p><h3>Popular Packages</h3><p>Basic wellness, executive check-up, pre-employment, pre-travel and annual family screens. Corporate packages for teams are available with on-site days.</p>`,
      subs: [
        ['Basic Wellness Screen', 'Vitals, blood sugar, lipids and consultation.'],
        ['Executive Check-Up', 'Extended laboratory, ECG and imaging review.'],
        ['Pre-Employment Medical', 'Employment-required examinations with same-day certificates.'],
        ['Pre-Travel Medical', 'Vaccination and travel health advice.'],
        ['Corporate Screening Days', 'On-site team screening events.'],
      ],
    },
    {
      slug: 'admission-inpatient-care', title: 'Admission & Inpatient Care', icon: 'BedDouble', style: 'table', dept: 'ICU & Critical Care',
      excerpt: 'Comfortable wards, private rooms and critical care units with round-the-clock nursing attention.',
      content: `<h2>Rest, Recover, Heal</h2><p>When a condition needs more than a day visit, our inpatient services offer clean, comfortable wards and attentive nursing. High-dependency and intensive care beds serve patients needing closer monitoring, with visiting hours designed around rest and recovery.</p><h3>Your Stay</h3><p>Admission includes a dedicated care team, daily doctor reviews, meals tailored to your condition and clear discharge planning. Your family is kept informed at every step.</p>`,
      subs: [
        ['General Wards', 'Clean, comfortable male and female general wards.'],
        ['Private Rooms', 'En-suite private rooms for extra comfort.'],
        ['High Dependency Unit', 'One-to-one monitoring for critical patients.'],
        ['Intensive Care Unit', 'Full critical care support.'],
        ['Neonatal Care', 'Specialized care for newborns.'],
      ],
    },
    {
      slug: 'mental-health-support', title: 'Mental Health & Counselling', icon: 'Brain', style: 'pills', dept: 'Mental Health',
      excerpt: 'Confidential counselling, psychiatric consultation and support for stress, anxiety, depression and more.',
      content: `<h2>Mind Matters</h2><p>Mental health is health. Our confidential counselling and psychiatry service offers a safe space to talk through stress, anxiety, depression, grief and relationship challenges — with treatment plans built around your goals.</p><h3>Confidential by Design</h3><p>Appointments, records and billing are handled with strict confidentiality. Walk in or book online — either way, your privacy comes first.</p>`,
      subs: [
        ['Individual Counselling', 'One-on-one therapy with trained counsellors.'],
        ['Psychiatric Consultation', 'Assessment and treatment by a psychiatrist.'],
        ['Stress & Anxiety Management', 'Practical, evidence-based coping programmes.'],
        ['Family & Couples Therapy', 'Structured sessions for relationships.'],
      ],
    },
    {
      slug: 'occupational-health', title: 'Occupational Health', icon: 'HardHat', style: 'cards', dept: 'General Medicine',
      excerpt: 'Workplace medicals, injury care, vaccinations and compliance screening for organizations of all sizes.',
      content: `<h2>Healthier Workplaces</h2><p>We partner with employers to keep teams healthy and compliant — from pre-employment medicals and annual screens to injury care and workplace vaccination days.</p><h3>Employer-Friendly</h3><p>Corporate accounts, consolidated reporting and on-site screening days make occupational health simple. Contact our front office to design a programme for your team.</p>`,
      subs: [
        ['Pre-Employment Medicals', 'Fast, compliant onboarding examinations.'],
        ['Annual Staff Screening', 'Periodic health checks for teams.'],
        ['Workplace Injury Care', 'Prompt treatment and reporting.'],
        ['Occupational Vaccinations', 'Flu, typhoid, hepatitis and travel vaccines.'],
      ],
    },
  ];
  for (let i = 0; i < wsDefs.length; i++) {
    const w = wsDefs[i];
    const deptId = w.dept ? deptMap[w.dept] : null;
    const created = await db.websiteService.create({
      data: {
        slug: w.slug, title: w.title, excerpt: w.excerpt, content: w.content,
        featuredImage: '', bannerImage: '',
        departmentId: deptId, iconKey: w.icon, displayStyle: w.style,
        displayOrder: i, isFeatured: !!w.featured, isActive: true,
      },
    });
    for (let s = 0; s < w.subs.length; s++) {
      await db.websiteSubService.create({
        data: {
          serviceId: created.id, title: w.subs[s][0], description: w.subs[s][1],
          displayOrder: s, isActive: true,
        },
      });
    }
  }
  console.log(`✓ ${wsDefs.length} website services with sub-services`);

  // ═══ COMPANY CONFIG: LOGIN BANNERS / PAYMENTS / DOCUMENT BACKGROUNDS / LETTERHEADS ═══
  const extraConfig: Array<[string, string]> = [
    ['login_banner_heading', 'Modern Care for Modern Health'],
    ['login_banner_subheading', 'Sign in to access your staff portal'],
    ['login_banner_image', ''],
    ['login_banner_show', 'true'],
    // Payment integrations — credentials entered in admin when ready
    ['mpesa_enabled', 'false'],
    ['mpesa_environment', 'sandbox'],
    ['mpesa_consumer_key', ''],
    ['mpesa_consumer_secret', ''],
    ['mpesa_shortcode', ''],
    ['mpesa_passkey', ''],
    ['mpesa_callback_url', ''],
    ['pesapal_enabled', 'false'],
    ['pesapal_environment', 'sandbox'],
    ['pesapal_consumer_key', ''],
    ['pesapal_consumer_secret', ''],
    ['pesapal_ipn_url', ''],
    ['pos_payment_active_method', 'BOTH'], // CASH_ONLY | MPESA_ONLY | PESAPAL_ONLY | BOTH
    // Document backgrounds & letterheads
    ['doc_bg_enabled', 'false'],
    ['doc_bg_type', 'color'],            // color | image | watermark
    ['doc_bg_color', '#FFFFFF'],
    ['doc_bg_image', ''],
    ['doc_bg_watermark_text', 'Boyani Health Dispensary'],
    ['doc_bg_watermark_opacity', '0.06'],
    ['doc_bg_page_size', 'A4'],          // A4 | A5 | LETTER
    ['doc_letterhead_design', '1'],       // 1..10
    ['doc_letterhead_color', '#0d9488'],
    // SMTP / SMS integration placeholders (awaiting credentials)
    ['smtp_host', ''], ['smtp_port', '587'], ['smtp_secure', 'true'],
    ['smtp_username', ''], ['smtp_password', ''], ['smtp_from_email', 'info@africandivinechurch.org'], ['smtp_from_name', 'Boyani Health Dispensary'],
    ['sms_provider', 'africastalking'], ['sms_api_key', ''], ['sms_username', ''], ['sms_sender_id', 'BOYANI'], ['sms_environment', 'sandbox'],
  ];
  for (const [key, value] of extraConfig) {
    await db.companyConfig.create({ data: { key, value } });
  }
  console.log(`✓ +${extraConfig.length} config keys (login banner, payments, doc backgrounds, integrations)`);

  console.log('🎉 SEED COMPLETE — Boyani Health Dispensary ready.');
  console.log('   Login: admin/Admin123! · doctor/Doctor123! · pharmacist/Pharma123! · cashier/Cashier123! · registrar/Reception123! · nurse/Nurse123! · labtech/Lab123! · hr/Hr123! · inventory/Stores123!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
