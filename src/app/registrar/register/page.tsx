'use client';

/**
 * REGISTRAR — PATIENT REGISTRATION (the core front-desk form). Instruction 21b.
 * 0 Duplicate check — debounced search by name / phone / national ID; picking a
 *   match autofills every section and switches the flow to "editing existing
 *   patient" (POST /api/patients { existingPatientId } updates + opens a visit).
 * 1 Personal · 2 Contact & Residence (Kenyan demographics) · 3 Next of Kin ·
 * 4 Payment (CASH/SHA/INSURANCE) · 5 Initial quick tests split in two groups:
 *   "Done at Registration Desk" (CLINICAL BSC-* services — billed immediately)
 *   and "Include in Lab Order" (LABORATORY services — billed AND placed on a
 *   PENDING lab order the lab tech sees). CSV bulk import (bulkItems) kept.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  UserPlus, User, CalendarDays, IdCard, HeartHandshake, Droplets, AlertTriangle, Phone, Mail, MapPin,
  Home, Users2, HandHeart, ShieldCheck, Building2, CreditCard, FlaskConical, CheckCircle2, StickyNote, Banknote,
  Search, ClipboardCheck, UserCheck, RotateCcw, Loader2, FileSearch,
} from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost } from '@/lib/client-api';
import { toast } from 'sonner';
import {
  kes, fmtDate, isoDate, PageHeading, Field, FormSection, McInput, McTextarea, McSelect, CsvImportControls,
} from '@/app/clinical/_lib';

interface QuickService {
  id: string;
  code: string;
  name: string;
  price: number;
  shaCovered: boolean;
  isActive?: boolean;
}

interface DupPatient {
  id: string;
  patientNo: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string | null;
  nationalId: string;
  phone: string;
  email: string;
  bloodType: string;
  allergies: string;
  maritalStatus: string;
  county: string;
  subCounty: string;
  location: string;
  subLocation: string;
  village: string;
  address: string;
  kinName: string;
  kinRelationship: string;
  kinPhone: string;
  paymentMode: string;
  shaNumber: string;
  insuranceProvider: string;
  insuranceNo: string;
  visits?: Array<{ visitNo: string; createdAt: string }>;
}

const COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo',
  'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui',
  'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa',
  'Murang\'a', 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu',
  'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu',
  'Vihiga', 'Wajir', 'West Pokot',
];
const GENDERS = ['MALE', 'FEMALE'];
const MARITAL = ['SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const KIN_RELATIONS = ['SPOUSE', 'PARENT', 'SIBLING', 'CHILD', 'GUARDIAN', 'OTHER RELATIVE', 'FRIEND', 'EMPLOYER'];
const VISIT_TYPES = ['OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'MATERNITY', 'WALKIN_PHARMACY'];
const INSURANCE_PROVIDERS = ['AAR Insurance', 'Britam', 'CIC Insurance', 'Jubilee Insurance', 'Madison Insurance', 'Old Mutual', 'UAP Old Mutual', 'Aon Kenya', 'Other'];

const CSV_HEADERS = ['firstName', 'lastName', 'gender', 'dateOfBirth', 'nationalId', 'phone', 'email', 'county', 'subCounty', 'location', 'village', 'kinName', 'kinPhone', 'paymentMode'];

const emptyForm = {
  firstName: '',
  lastName: '',
  gender: 'MALE',
  dateOfBirth: '',
  nationalId: '',
  maritalStatus: 'SINGLE',
  bloodType: '',
  allergies: '',
  phone: '',
  email: '',
  county: 'Nairobi',
  subCounty: '',
  location: '',
  subLocation: '',
  village: '',
  address: '',
  kinName: '',
  kinRelationship: 'SPOUSE',
  kinPhone: '',
  paymentMode: 'CASH',
  shaNumber: '',
  insuranceProvider: '',
  insuranceNo: '',
  visitType: 'OUTPATIENT',
  registrationNotes: '',
};

export default function RegistrarRegisterPage() {
  const router = useRouter();
  const [form, setForm] = React.useState({ ...emptyForm });
  const [deskTests, setDeskTests] = React.useState<QuickService[]>([]);
  const [labTests, setLabTests] = React.useState<QuickService[]>([]);
  const [deskSelected, setDeskSelected] = React.useState<string[]>([]);
  const [labSelected, setLabSelected] = React.useState<string[]>([]);
  const [testsLoading, setTestsLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  // Duplicate patient search (Instruction 21b)
  const [dupQuery, setDupQuery] = React.useState('');
  const [dupResults, setDupResults] = React.useState<DupPatient[]>([]);
  const [dupSearching, setDupSearching] = React.useState(false);
  const [dupSearched, setDupSearched] = React.useState(false);
  const [dupConfirm, setDupConfirm] = React.useState<DupPatient | null>(null);
  const [existingPatient, setExistingPatient] = React.useState<DupPatient | null>(null);

  // Bulk import + success modal
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkRows, setBulkRows] = React.useState<Array<Record<string, string>>>([]);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [success, setSuccess] = React.useState<{
    patientNo: string; visitNo?: string; charges: number; name: string;
    existing?: boolean; labOrderNo?: string;
  } | null>(null);

  const set = (patch: Partial<typeof emptyForm>) => setForm(f => ({ ...f, ...patch }));

  React.useEffect(() => {
    (async () => {
      try {
        const [clinicalRes, labRes] = await Promise.all([
          apiGet<{ services: QuickService[] }>('/api/services?category=CLINICAL&perPage=200'),
          apiGet<{ services: QuickService[] }>('/api/services?category=LABORATORY&perPage=200'),
        ]);
        // Desk tests = basic bedside checks priced under CLINICAL with the BSC- code prefix
        setDeskTests((clinicalRes.services || []).filter(s => s.isActive !== false && /^BSC-/i.test(s.code || '')));
        setLabTests((labRes.services || []).filter(s => s.isActive !== false));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load quick-test services');
      } finally {
        setTestsLoading(false);
      }
    })();
  }, []);

  // ── Debounced duplicate search (name / phone / national ID) ──
  React.useEffect(() => {
    const q = dupQuery.trim();
    if (q.length < 2) {
      setDupResults([]);
      setDupSearching(false);
      setDupSearched(false);
      return;
    }
    setDupSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiGet<{ patients: DupPatient[] }>(
          `/api/patients?perPage=8&search=${encodeURIComponent(q)}`,
        );
        setDupResults(res.patients || []);
        setDupSearched(true);
      } catch {
        setDupResults([]);
      } finally {
        setDupSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [dupQuery]);

  const useExisting = (p: DupPatient) => {
    // Autofill every registration section from the existing record
    setForm({
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      gender: p.gender === 'MALE' || p.gender === 'FEMALE' ? p.gender : 'MALE',
      dateOfBirth: isoDate(p.dateOfBirth),
      nationalId: p.nationalId || '',
      maritalStatus: p.maritalStatus || 'SINGLE',
      bloodType: p.bloodType || '',
      allergies: p.allergies || '',
      phone: p.phone || '',
      email: p.email || '',
      county: p.county || 'Nairobi',
      subCounty: p.subCounty || '',
      location: p.location || '',
      subLocation: p.subLocation || '',
      village: p.village || '',
      address: p.address || '',
      kinName: p.kinName || '',
      kinRelationship: p.kinRelationship || 'SPOUSE',
      kinPhone: p.kinPhone || '',
      paymentMode: p.paymentMode || 'CASH',
      shaNumber: p.shaNumber || '',
      insuranceProvider: p.insuranceProvider || '',
      insuranceNo: p.insuranceNo || '',
      visitType: 'OUTPATIENT',
      registrationNotes: '',
    });
    setExistingPatient(p);
    setDupConfirm(null);
    setDupQuery('');
    setDupResults([]);
    toast.success(`Editing existing patient flow — ${p.firstName} ${p.lastName} (${p.patientNo})`);
  };

  const clearExisting = () => {
    setExistingPatient(null);
    setForm({ ...emptyForm });
    setDeskSelected([]);
    setLabSelected([]);
  };

  const toggleDesk = (id: string) =>
    setDeskSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleLab = (id: string) =>
    setLabSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const deskTotal = deskTests.filter(t => deskSelected.includes(t.id)).reduce((s, t) => s + t.price, 0);
  const labTotal = labTests.filter(t => labSelected.includes(t.id)).reduce((s, t) => s + t.price, 0);

  const submit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First name and last name are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{
        patient: { patientNo: string; firstName: string; lastName: string };
        visit: { visitNo: string } | null;
        initialCharges: Array<{ totalPrice: number }> | Array<Record<string, unknown>>;
        labOrder?: { orderNo: string } | null;
        message: string;
      }>('/api/patients', {
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        openVisit: true,
        ...(existingPatient ? { existingPatientId: existingPatient.id } : {}),
        initialTests: [
          ...deskSelected.map(id => ({ serviceId: id, atDesk: true })),
          ...labSelected.map(id => ({ serviceId: id, atDesk: false })),
        ],
      });
      const charges = Array.isArray(res.initialCharges)
        ? res.initialCharges.reduce((s, i) => s + (Number((i as { totalPrice?: number }).totalPrice) || 0), 0)
        : 0;
      toast.success(res.message || `Patient registered — ${res.patient.patientNo}`);
      setSuccess({
        patientNo: res.patient.patientNo,
        visitNo: res.visit?.visitNo,
        charges,
        name: `${res.patient.firstName} ${res.patient.lastName}`,
        existing: !!existingPatient,
        labOrderNo: res.labOrder?.orderNo,
      });
      clearExisting();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to register patient');
    } finally {
      setSubmitting(false);
    }
  };

  const doBulkImport = async () => {
    if (!bulkRows.length) return;
    setBulkBusy(true);
    try {
      const res = await apiPost<{ imported: number }>('/api/patients', { bulkItems: bulkRows });
      toast.success(`Imported ${res.imported} patient(s) from CSV`);
      setBulkOpen(false);
      setBulkRows([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk import failed');
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <PageHeading
        icon={<UserPlus className="h-5 w-5" />}
        title="Register New Patient"
        subtitle="Search for duplicates first — registration auto-generates the patient number and opens a visit"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => router.push('/registrar/patients')}>Registry</Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setBulkOpen(true)}>
              <Users2 className="h-4 w-4" /> Bulk Import
            </Button>
          </>
        }
      />

      {/* 0 — Duplicate patient search */}
      <section className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-4 md:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-[var(--mc-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">0</span>
          <h3 className="text-sm font-bold text-[var(--mc-text-primary)]">Search Existing Patient</h3>
          <div className="flex-1 h-px bg-[var(--mc-divider)]" />
          <span className="text-[11px] text-muted-foreground">name · phone · national ID</span>
        </div>
        <div className="relative">
          <McInput
            value={dupQuery}
            onChange={e => setDupQuery(e.target.value)}
            placeholder="Start typing a name, phone number or national ID to check for an existing record…"
            className="pl-9"
          />
          {dupSearching
            ? <Loader2 className="absolute left-3 top-2.5 h-4 w-4 text-[var(--mc-primary)] animate-spin" />
            : <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />}
        </div>

        {dupQuery.trim().length >= 2 && (
          dupSearching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : dupResults.length === 0 ? (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> No existing patient matches “{dupQuery}” — safe to register a new record below.
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> {dupResults.length} matching record(s) found — click one to continue with the existing patient.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dupResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDupConfirm(p)}
                    className="rounded-xl border border-[var(--mc-divider)] bg-white p-3 text-left hover:border-[var(--mc-primary)] hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-8 w-8 rounded-full mc-gradient-primary flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                        {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--mc-text-primary)] truncate">{p.firstName} {p.lastName}</p>
                        <p className="text-[11px] text-muted-foreground">{p.patientNo} · {p.gender ? p.gender.toLowerCase() : '—'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-[var(--mc-text-secondary)]">
                      <span className="flex items-center gap-1 truncate"><Phone className="h-3 w-3 text-[var(--mc-primary)]" />{p.phone || '—'}</span>
                      <span className="flex items-center gap-1 truncate"><IdCard className="h-3 w-3 text-[var(--mc-primary)]" />{p.nationalId || '—'}</span>
                      <span className="col-span-2 flex items-center gap-1 truncate">
                        <CalendarDays className="h-3 w-3 text-[var(--mc-primary)]" />
                        Last visit: {p.visits?.[0] ? `${fmtDate(p.visits[0].createdAt)} (${p.visits[0].visitNo})` : 'no visits yet'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        )}
      </section>

      {/* Existing-patient banner */}
      {existingPatient && (
        <div className="rounded-xl border-2 border-[var(--mc-primary)] bg-[var(--mc-primary-light)] p-4 flex flex-wrap items-center gap-3">
          <div className="h-10 w-10 rounded-full mc-gradient-primary flex items-center justify-center text-white shrink-0">
            <UserCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--mc-primary-dark)]">
              Editing existing patient flow: {existingPatient.firstName} {existingPatient.lastName}
            </p>
            <p className="text-xs text-[var(--mc-text-secondary)]">
              {existingPatient.patientNo} — submitting updates this record and opens a NEW visit (no duplicate patient is created).
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1" onClick={clearExisting}>
            <RotateCcw className="h-4 w-4" /> Start Fresh Registration
          </Button>
        </div>
      )}

      <div className="rounded-xl border bg-white p-4 md:p-6 space-y-6">
        {/* 1 — Personal */}
        <FormSection n={1} title="Personal Details">
          <Field icon={<User className="h-3.5 w-3.5" />} label="First Name *">
            <McInput value={form.firstName} onChange={e => set({ firstName: e.target.value })} placeholder="e.g. Wanjiku" />
          </Field>
          <Field icon={<User className="h-3.5 w-3.5" />} label="Last Name *">
            <McInput value={form.lastName} onChange={e => set({ lastName: e.target.value })} placeholder="e.g. Kamau" />
          </Field>
          <Field icon={<User className="h-3.5 w-3.5" />} label="Gender">
            <McSelect value={form.gender} onValueChange={v => set({ gender: v })} options={GENDERS.map(g => ({ value: g, label: g }))} />
          </Field>
          <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Date of Birth">
            <McInput type="date" value={form.dateOfBirth} onChange={e => set({ dateOfBirth: e.target.value })} />
          </Field>
          <Field icon={<IdCard className="h-3.5 w-3.5" />} label="National ID">
            <McInput value={form.nationalId} onChange={e => set({ nationalId: e.target.value })} placeholder="e.g. 12345678" />
          </Field>
          <Field icon={<HeartHandshake className="h-3.5 w-3.5" />} label="Marital Status">
            <McSelect value={form.maritalStatus} onValueChange={v => set({ maritalStatus: v })} options={MARITAL.map(m => ({ value: m, label: m }))} />
          </Field>
          <Field icon={<Droplets className="h-3.5 w-3.5" />} label="Blood Type">
            <McSelect
              value={form.bloodType || '__none__'}
              onValueChange={v => set({ bloodType: v === '__none__' ? '' : v })}
              options={[{ value: '__none__', label: 'Unknown' }, ...BLOOD_TYPES.map(b => ({ value: b, label: b }))]}
            />
          </Field>
          <Field icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Allergies" hint="comma-separated — shown on clinical records">
            <McInput value={form.allergies} onChange={e => set({ allergies: e.target.value })} placeholder="e.g. Penicillin, Sulfa drugs" />
          </Field>
        </FormSection>

        {/* 2 — Contact & Residence */}
        <FormSection n={2} title="Contact & Residence">
          <Field icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
            <McInput value={form.phone} onChange={e => set({ phone: e.target.value })} placeholder="e.g. 0722 123 456" />
          </Field>
          <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email">
            <McInput type="email" value={form.email} onChange={e => set({ email: e.target.value })} placeholder="e.g. wanjiku@example.com" />
          </Field>
          <Field icon={<MapPin className="h-3.5 w-3.5" />} label="County">
            <McSelect value={form.county} onValueChange={v => set({ county: v })} options={COUNTIES.map(c => ({ value: c, label: c }))} />
          </Field>
          <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Sub-County">
            <McInput value={form.subCounty} onChange={e => set({ subCounty: e.target.value })} placeholder="e.g. Dagoretti North" />
          </Field>
          <Field icon={<Home className="h-3.5 w-3.5" />} label="Location">
            <McInput value={form.location} onChange={e => set({ location: e.target.value })} placeholder="e.g. Kawangware" />
          </Field>
          <Field icon={<Home className="h-3.5 w-3.5" />} label="Sub-Location">
            <McInput value={form.subLocation} onChange={e => set({ subLocation: e.target.value })} placeholder="e.g. Mutuini" />
          </Field>
          <Field icon={<Home className="h-3.5 w-3.5" />} label="Village / Estate">
            <McInput value={form.village} onChange={e => set({ village: e.target.value })} placeholder="e.g. Satellite" />
          </Field>
          <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Physical Address">
            <McInput value={form.address} onChange={e => set({ address: e.target.value })} placeholder="e.g. Plot 42, Ngong Road" />
          </Field>
        </FormSection>

        {/* 3 — Next of Kin */}
        <FormSection n={3} title="Next of Kin">
          <Field icon={<Users2 className="h-3.5 w-3.5" />} label="Kin Name">
            <McInput value={form.kinName} onChange={e => set({ kinName: e.target.value })} placeholder="e.g. Mary Kamau" />
          </Field>
          <Field icon={<HandHeart className="h-3.5 w-3.5" />} label="Relationship">
            <McSelect value={form.kinRelationship} onValueChange={v => set({ kinRelationship: v })} options={KIN_RELATIONS.map(r => ({ value: r, label: r }))} />
          </Field>
          <Field icon={<Phone className="h-3.5 w-3.5" />} label="Kin Phone">
            <McInput value={form.kinPhone} onChange={e => set({ kinPhone: e.target.value })} placeholder="e.g. 0733 456 789" />
          </Field>
        </FormSection>

        {/* 4 — Payment */}
        <FormSection n={4} title="Payment Mode">
          <div className="sm:col-span-2">
            <div className="grid grid-cols-3 gap-2">
              {(['CASH', 'SHA', 'INSURANCE'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set({ paymentMode: mode })}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 cursor-pointer transition-colors ${
                    form.paymentMode === mode
                      ? 'border-[var(--mc-primary)] bg-[var(--mc-primary-light)]'
                      : 'border-[var(--mc-divider)] bg-white hover:border-[var(--mc-primary)]'
                  }`}
                >
                  {mode === 'CASH' && <CreditCard className="h-4 w-4 text-[var(--mc-primary)]" />}
                  {mode === 'SHA' && <ShieldCheck className="h-4 w-4 text-[var(--mc-primary)]" />}
                  {mode === 'INSURANCE' && <Building2 className="h-4 w-4 text-[var(--mc-primary)]" />}
                  <span className="text-sm font-semibold text-[var(--mc-text-primary)]">
                    {mode === 'SHA' ? 'SHA' : mode === 'INSURANCE' ? 'Insurance' : 'Cash'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {form.paymentMode === 'SHA' && (
            <Field icon={<ShieldCheck className="h-3.5 w-3.5" />} label="SHA Number" hint="Social Health Authority member number">
              <McInput value={form.shaNumber} onChange={e => set({ shaNumber: e.target.value })} placeholder="e.g. SHA-0001234567" />
            </Field>
          )}
          {form.paymentMode === 'INSURANCE' && (
            <>
              <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Insurance Provider">
                <McSelect
                  value={form.insuranceProvider || '__none__'}
                  onValueChange={v => set({ insuranceProvider: v === '__none__' ? '' : v })}
                  options={[{ value: '__none__', label: 'No provider' }, ...INSURANCE_PROVIDERS.map(p => ({ value: p, label: p }))]}
                />
              </Field>
              <Field icon={<CreditCard className="h-3.5 w-3.5" />} label="Insurance / Policy Number">
                <McInput value={form.insuranceNo} onChange={e => set({ insuranceNo: e.target.value })} placeholder="e.g. POL-778899" />
              </Field>
            </>
          )}
          <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Visit Type" hint="opened automatically on registration">
            <McSelect value={form.visitType} onValueChange={v => set({ visitType: v })} options={VISIT_TYPES.map(t => ({ value: t, label: t.replaceAll('_', ' ') }))} />
          </Field>
        </FormSection>

        {/* 5 — Initial quick tests: desk vs lab order */}
        <FormSection n={5} title="Initial Quick Tests (optional)">
          <div className="sm:col-span-2 space-y-3">
            {testsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Desk group */}
                <div className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <ClipboardCheck className="h-4 w-4 text-[var(--mc-primary)]" />
                    <p className="text-xs font-bold text-[var(--mc-text-primary)]">Done at Registration Desk</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold">billed immediately</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Basic bedside checks (BP, temperature, weight, height, BMI, bedside glucose) — performed here and billed to the visit.</p>
                  {deskTests.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-1">No desk services configured (BSC-*).</p>
                  ) : (
                    <div className="space-y-1.5">
                      {deskTests.map(t => (
                        <label
                          key={t.id}
                          className={`flex items-center gap-2.5 rounded-lg border p-2 cursor-pointer transition-colors ${
                            deskSelected.includes(t.id)
                              ? 'border-[var(--mc-primary)] bg-[var(--mc-primary-light)]'
                              : 'border-[var(--mc-divider)] bg-white hover:border-[var(--mc-primary)]'
                          }`}
                        >
                          <Checkbox checked={deskSelected.includes(t.id)} onCheckedChange={() => toggleDesk(t.id)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[var(--mc-text-primary)] truncate">{t.name}</p>
                            <p className="text-[10px] text-muted-foreground">{kes(t.price)}{t.shaCovered && ' · SHA covered'}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-0.5 border-t border-dashed border-[var(--mc-divider)]">
                    <span className="text-[10px] text-muted-foreground">{deskSelected.length} desk test(s)</span>
                    <span className="text-xs font-bold text-[var(--mc-primary)]">{kes(deskTotal)}</span>
                  </div>
                </div>

                {/* Lab group */}
                <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <FlaskConical className="h-4 w-4 text-violet-600" />
                    <p className="text-xs font-bold text-[var(--mc-text-primary)]">Include in Lab Order</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">sent to the lab</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Laboratory tests — billed to the visit AND placed on a PENDING lab order the lab technician works from.</p>
                  {labTests.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-1">No laboratory services configured.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                      {labTests.map(t => (
                        <label
                          key={t.id}
                          className={`flex items-center gap-2.5 rounded-lg border p-2 cursor-pointer transition-colors ${
                            labSelected.includes(t.id)
                              ? 'border-violet-400 bg-violet-100/70'
                              : 'border-[var(--mc-divider)] bg-white hover:border-violet-400'
                          }`}
                        >
                          <Checkbox checked={labSelected.includes(t.id)} onCheckedChange={() => toggleLab(t.id)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[var(--mc-text-primary)] truncate">{t.name}</p>
                            <p className="text-[10px] text-muted-foreground">{kes(t.price)}{t.shaCovered && ' · SHA covered'}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-0.5 border-t border-dashed border-violet-200">
                    <span className="text-[10px] text-muted-foreground">{labSelected.length} lab test(s)</span>
                    <span className="text-xs font-bold text-violet-700">{kes(labTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--mc-divider)] bg-white px-3 py-2">
              <span className="text-xs text-muted-foreground">{deskSelected.length + labSelected.length} test(s) selected</span>
              <span className="text-sm font-bold text-[var(--mc-primary)] flex items-center gap-1">
                <Banknote className="h-4 w-4" /> {kes(deskTotal + labTotal)} to bill
              </span>
            </div>
          </div>
          <Field icon={<StickyNote className="h-3.5 w-3.5" />} label="Registration Notes" className="sm:col-span-2">
            <McTextarea value={form.registrationNotes} onChange={e => set({ registrationNotes: e.target.value })} placeholder="Reason for visit, triage notes…" />
          </Field>
        </FormSection>

        {/* Submit */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--mc-divider)] pt-4">
          <Button variant="outline" onClick={clearExisting}>Clear Form</Button>
          <Button className="gap-1" onClick={submit} disabled={submitting}>
            {existingPatient ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {submitting ? 'Saving…' : existingPatient ? 'Update Patient & Open Visit' : 'Register Patient & Open Visit'}
          </Button>
        </div>
      </div>

      {/* Duplicate confirm modal */}
      <PremiumModal
        open={!!dupConfirm} onOpenChange={o => { if (!o) setDupConfirm(null); }}
        size="sm"
        title="Patient exists"
        icon={<FileSearch className="h-5 w-5" />}
        description="A matching record is already registered"
        footerNote="Continuing keeps one patient file — a new visit opens for today's encounter"
        submitLabel="Continue with Existing Record"
        onSubmit={() => { if (dupConfirm) useExisting(dupConfirm); }}
        secondaryLabel="Register as New Patient" onSecondary={() => setDupConfirm(null)}
      >
        {dupConfirm && (
          <div className="space-y-2 text-sm">
            <div className="rounded-xl border border-[var(--mc-primary)] bg-[var(--mc-primary-light)] p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Existing record</p>
              <p className="text-lg font-bold text-[var(--mc-primary)]">{dupConfirm.firstName} {dupConfirm.lastName}</p>
              <p className="text-xs text-[var(--mc-text-secondary)] mt-1">
                {dupConfirm.patientNo} · {dupConfirm.phone || 'no phone'} · ID {dupConfirm.nationalId || '—'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Last visit: {dupConfirm.visits?.[0] ? fmtDate(dupConfirm.visits[0].createdAt) : 'no visits yet'}
              </p>
            </div>
            <p className="text-xs text-[var(--mc-text-secondary)]">
              Continuing autofills the form with this patient's details — submitting updates the record
              and opens a new visit instead of creating a duplicate.
            </p>
          </div>
        )}
      </PremiumModal>

      {/* Bulk import modal */}
      <PremiumModal
        open={bulkOpen} onOpenChange={setBulkOpen}
        title="Bulk Patient Import"
        icon={<Users2 className="h-5 w-5" />}
        description="Download the CSV template, fill one patient per row, then upload"
        footerNote="Bulk-imported patients do not auto-open visits"
        submitLabel={`Import ${bulkRows.length || ''} Row(s)`.trim()}
        onSubmit={doBulkImport}
        submitting={bulkBusy}
        secondaryLabel="Cancel"
        submitDisabled={bulkRows.length === 0}
      >
        <div className="space-y-3">
          <CsvImportControls
            templateName="patients-template.csv"
            headers={CSV_HEADERS}
            onParsed={rows => setBulkRows(rows)}
            note="Required columns: firstName, lastName — others optional"
          />
          {bulkRows.length > 0 && (
            <div className="rounded-xl border p-3 max-h-56 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-2">{bulkRows.length} row(s) ready:</p>
              {bulkRows.map((r, i) => (
                <p key={i} className="text-xs text-[var(--mc-text-secondary)]">
                  {i + 1}. {r.firstName} {r.lastName} · {r.gender || '—'} · {r.phone || 'no phone'} · {r.county || '—'}
                </p>
              ))}
            </div>
          )}
        </div>
      </PremiumModal>

      {/* Registration success modal */}
      <PremiumModal
        open={!!success} onOpenChange={o => { if (!o) setSuccess(null); }}
        size="sm"
        title={success?.existing ? 'Visit Opened' : 'Patient Registered'}
        icon={<CheckCircle2 className="h-5 w-5" />}
        description={success?.existing ? 'Existing record updated — visit opened' : 'Registration complete — visit opened'}
        footerNote="Direct the patient to the laboratory or doctor; payment happens at the cashier"
        submitLabel="Register Another" onSubmit={() => setSuccess(null)}
        secondaryLabel="Go to Registry" onSecondary={() => { setSuccess(null); router.push('/registrar/patients'); }}
      >
        {success && (
          <div className="space-y-2 text-sm">
            <div className="rounded-xl border border-[var(--mc-primary)] bg-[var(--mc-primary-light)] p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Patient Number</p>
              <p className="text-xl font-bold text-[var(--mc-primary)]">{success.patientNo}</p>
              <p className="text-xs text-[var(--mc-text-secondary)] mt-1">{success.name}</p>
            </div>
            <div className="flex items-center justify-between border-b border-dashed border-[var(--mc-divider)] pb-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Visit</span>
              <span className="font-semibold">{success.visitNo || 'No visit opened'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-dashed border-[var(--mc-divider)] pb-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Initial charges billed</span>
              <span className="font-semibold">{kes(success.charges)}</span>
            </div>
            {success.labOrderNo && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Lab order created</span>
                <span className="font-semibold text-violet-700">{success.labOrderNo} · PENDING</span>
              </div>
            )}
          </div>
        )}
      </PremiumModal>
    </div>
  );
}
