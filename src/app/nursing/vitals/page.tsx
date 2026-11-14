'use client';

/**
 * NURSING VITALS — triage recording (Instruction 23).
 * "Patients Under My Care" board (GET /api/vitals?care=1) — admitted inpatients
 * + patients with recent vitals, with a quick vitals action. Patient search
 * select + full vitals form with live BMI computation (weight kg + height cm).
 * POST /api/vitals. Vitals history per patient (GET /api/vitals?patientId=)
 * shows the recorder's name on every record; multiple records per day supported.
 */

import * as React from 'react';
import {
  Activity, Search, Thermometer, HeartPulse, Wind, Weight, Ruler, Gauge, Droplets, BatteryWarning, StickyNote, Save, User, History, BedDouble, Zap, Loader2,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost } from '@/lib/client-api';
import { toast } from 'sonner';
import {
  fmtDate, fmtDateTime, age, PageHeading, Field, FormSection, McInput, McTextarea, McSelect, SkeletonCards,
} from '@/app/clinical/_lib';

interface PatientLite {
  id: string;
  patientNo: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender?: string;
}

interface VitalsRow {
  id: string;
  recordedAt: string;
  temperature: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  pulse: number;
  respiratoryRate: number;
  weight: number;
  height: number;
  bmi: number;
  oxygenSaturation: number;
  bloodGlucose: number;
  painScore: number;
  notes: string;
  recordedByName: string;
}

interface CareVitals {
  temperature: number; bloodPressureSystolic: number; bloodPressureDiastolic: number; pulse: number;
  recordedByName: string;
}

interface CarePatient {
  id: string;
  patientNo: string;
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  dateOfBirth: string | null;
  admitted: boolean;
  admissionNo?: string;
  wardName?: string;
  bedNumber?: string;
  admissionDate?: string;
  lastVitalsAt: string | null;
  vitalsCount: number;
  lastVitals?: CareVitals;
}

const emptyForm = {
  temperature: '',
  bloodPressureSystolic: '',
  bloodPressureDiastolic: '',
  pulse: '',
  respiratoryRate: '',
  weight: '',
  height: '',
  oxygenSaturation: '',
  bloodGlucose: '',
  painScore: '',
  notes: '',
};

export default function NursingVitalsPage() {
  const [patientId, setPatientId] = React.useState('');
  const [patients, setPatients] = React.useState<PatientLite[]>([]);
  const [patientSearch, setPatientSearch] = React.useState('');
  const [patientsLoading, setPatientsLoading] = React.useState(false);

  const [form, setForm] = React.useState({ ...emptyForm });
  const [submitting, setSubmitting] = React.useState(false);

  const [recent, setRecent] = React.useState<VitalsRow[]>([]);
  const [recentLoading, setRecentLoading] = React.useState(false);

  // Patients under my care (Instruction 23)
  const [care, setCare] = React.useState<CarePatient[]>([]);
  const [careLoading, setCareLoading] = React.useState(true);
  const [careSearch, setCareSearch] = React.useState('');
  const formRef = React.useRef<HTMLDivElement>(null);

  const selected = patients.find(p => p.id === patientId);

  const searchPatients = React.useCallback(async (q: string) => {
    setPatientsLoading(true);
    try {
      const res = await apiGet<{ patients: PatientLite[] }>(
        `/api/patients?perPage=100${q ? `&search=${encodeURIComponent(q)}` : ''}`,
      );
      setPatients(res.patients || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to search patients');
    } finally {
      setPatientsLoading(false);
    }
  }, []);

  const loadCare = React.useCallback(async (q: string) => {
    setCareLoading(true);
    try {
      const res = await apiGet<{ patients: CarePatient[] }>(
        `/api/vitals?care=1${q ? `&search=${encodeURIComponent(q)}` : ''}`,
      );
      setCare(res.patients || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load patients under care');
    } finally {
      setCareLoading(false);
    }
  }, []);

  React.useEffect(() => { searchPatients(''); }, [searchPatients]);
  React.useEffect(() => { loadCare(''); }, [loadCare]);

  // Debounced care search
  React.useEffect(() => {
    const q = careSearch.trim();
    const t = setTimeout(() => loadCare(q), 350);
    return () => clearTimeout(t);
  }, [careSearch, loadCare]);

  const loadRecent = React.useCallback(async (id: string) => {
    setRecentLoading(true);
    try {
      const res = await apiGet<{ vitals: VitalsRow[] }>(`/api/vitals?patientId=${id}`);
      setRecent(res.vitals || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load vitals history');
    } finally {
      setRecentLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (patientId) loadRecent(patientId);
    else setRecent([]);
  }, [patientId, loadRecent]);

  // Quick action — start recording vitals for a cared-for patient
  const quickVitals = (p: CarePatient) => {
    setPatientId(p.id);
    setPatients(prev => prev.some(x => x.id === p.id)
      ? prev
      : [...prev, { id: p.id, patientNo: p.patientNo, firstName: p.firstName, lastName: p.lastName, phone: p.phone, gender: p.gender }]);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast.info(`Recording vitals for ${p.firstName} ${p.lastName}`);
  };

  // Live BMI (kg / (m)²) as the user types
  const w = parseFloat(form.weight) || 0;
  const h = parseFloat(form.height) || 0;
  const bmi = w > 0 && h > 0 ? Math.round((w / Math.pow(h / 100, 2)) * 100) / 100 : 0;
  const bmiTone = bmi === 0 ? 'text-muted-foreground' : bmi < 18.5 ? 'text-amber-600' : bmi < 25 ? 'text-emerald-600' : bmi < 30 ? 'text-amber-600' : 'text-red-600';
  const bmiLabel = bmi === 0 ? '—' : bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';

  const set = (patch: Partial<typeof emptyForm>) => setForm(f => ({ ...f, ...patch }));

  const submit = async () => {
    if (!patientId) { toast.error('Select a patient first'); return; }
    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string }>('/api/vitals', {
        patientId,
        temperature: form.temperature || 0,
        bloodPressureSystolic: form.bloodPressureSystolic || 0,
        bloodPressureDiastolic: form.bloodPressureDiastolic || 0,
        pulse: form.pulse || 0,
        respiratoryRate: form.respiratoryRate || 0,
        weight: form.weight || 0,
        height: form.height || 0,
        bmi: bmi || undefined,
        oxygenSaturation: form.oxygenSaturation || 0,
        bloodGlucose: form.bloodGlucose || 0,
        painScore: form.painScore || 0,
        notes: form.notes,
      });
      toast.success(res.message || 'Vitals recorded');
      setForm({ ...emptyForm });
      loadRecent(patientId);
      loadCare(careSearch.trim());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record vitals');
    } finally {
      setSubmitting(false);
    }
  };

  const patientOptions = patients.map(p => ({
    value: p.id,
    label: `${p.firstName} ${p.lastName} · ${p.patientNo}`,
  }));

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<Activity className="h-5 w-5" />}
        title="Record Vitals"
        subtitle="Triage vital signs — BMI computes automatically from weight and height"
      />

      {/* ── Patients Under My Care ── */}
      <section className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-[var(--mc-divider)]">
          <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
            <HeartPulse className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Patients Under My Care</h2>
            <p className="text-[11px] text-muted-foreground">Admitted inpatients and patients with recent vitals — quick vitals action ready</p>
          </div>
          <div className="relative w-full sm:w-64">
            <McInput
              value={careSearch}
              onChange={e => setCareSearch(e.target.value)}
              placeholder="Search my patients…"
              className="pl-8 h-9"
            />
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {careLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : care.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No patients under care right now — admissions and recent vitals patients appear here.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
            {care.map(p => (
              <div key={p.id} className={`rounded-xl border bg-white p-3 space-y-2 ${p.admitted ? 'border-rose-200' : 'border-[var(--mc-divider)]'}`}>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full mc-gradient-primary flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                    {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--mc-text-primary)] truncate">{p.firstName} {p.lastName}</p>
                    <p className="text-[11px] text-muted-foreground">{p.patientNo} · {age(p.dateOfBirth)} yrs</p>
                  </div>
                  {p.admitted ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-semibold flex items-center gap-1">
                      <BedDouble className="h-3 w-3" /> Inpatient
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200 font-semibold">
                      Recent vitals
                    </span>
                  )}
                </div>
                {p.admitted ? (
                  <p className="text-[11px] text-[var(--mc-text-secondary)] flex items-center gap-1">
                    <BedDouble className="h-3 w-3 text-[var(--mc-primary)]" />
                    {p.wardName || 'Ward'} · Bed {p.bedNumber || '—'} · admitted {fmtDate(p.admissionDate)}
                  </p>
                ) : null}
                {p.lastVitals ? (
                  <p className="text-[11px] text-muted-foreground">
                    Last vitals {fmtDateTime(p.lastVitalsAt)}: {p.lastVitals.temperature || '—'}°C · {p.lastVitals.bloodPressureSystolic || '—'}/{p.lastVitals.bloodPressureDiastolic || '—'} · {p.lastVitals.pulse || '—'} bpm
                    {p.lastVitals.recordedByName ? ` (by ${p.lastVitals.recordedByName})` : ''}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No vitals recorded in the last 2 weeks.</p>
                )}
                <div className="flex items-center justify-between pt-0.5 border-t border-dashed border-[var(--mc-divider)]">
                  <span className="text-[10px] text-muted-foreground">{p.vitalsCount} recent record(s)</span>
                  <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => quickVitals(p)}>
                    <Zap className="h-3 w-3" /> Record Vitals
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div ref={formRef} />

      {recentLoading && !patientId ? <SkeletonCards count={3} /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Selected Patient" value={selected ? `${selected.firstName} ${selected.lastName}` : '—'} icon={<User className="h-5 w-5" />} accent="primary" hint={selected?.patientNo} />
          <StatCard label="Records on File" value={recent.length} icon={<History className="h-5 w-5" />} accent="secondary" hint="latest 50 shown" />
          <StatCard label="Live BMI" value={bmi || '—'} icon={<Gauge className="h-5 w-5" />} accent={bmi === 0 ? 'primary' : bmi < 18.5 || bmi >= 25 ? 'warning' : 'success'} hint={bmiLabel} />
          <StatCard label="Last Recorded" value={recent[0] ? fmtDateTime(recent[0].recordedAt) : '—'} icon={<Activity className="h-5 w-5" />} accent="tertiary" hint={recent[0]?.recordedByName ? `by ${recent[0].recordedByName}` : undefined} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* Form */}
        <div className="lg:col-span-3 rounded-xl border border-[var(--mc-divider)] bg-white p-4 md:p-6 space-y-6">
          <FormSection n={1} title="Patient">
            <Field icon={<Search className="h-3.5 w-3.5" />} label="Search Patients">
              <div className="flex gap-2">
                <McInput
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Name, patient No., phone…"
                  onKeyDown={e => { if (e.key === 'Enter') searchPatients(patientSearch); }}
                />
                <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={() => searchPatients(patientSearch)}>
                  {patientsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
                </Button>
              </div>
            </Field>
            <Field icon={<User className="h-3.5 w-3.5" />} label="Patient *" hint={patientsLoading ? 'Loading…' : `${patients.length} patient(s)`}>
              <McSelect value={patientId} onValueChange={setPatientId} options={patientOptions} placeholder="Select patient…" />
            </Field>
          </FormSection>

          <FormSection n={2} title="Vital Signs">
            <Field icon={<Thermometer className="h-3.5 w-3.5" />} label="Temperature (°C)">
              <McInput type="number" step="0.1" value={form.temperature} onChange={e => set({ temperature: e.target.value })} placeholder="36.8" />
            </Field>
            <Field icon={<HeartPulse className="h-3.5 w-3.5" />} label="Blood Pressure — Systolic">
              <McInput type="number" value={form.bloodPressureSystolic} onChange={e => set({ bloodPressureSystolic: e.target.value })} placeholder="120" />
            </Field>
            <Field icon={<HeartPulse className="h-3.5 w-3.5" />} label="Blood Pressure — Diastolic">
              <McInput type="number" value={form.bloodPressureDiastolic} onChange={e => set({ bloodPressureDiastolic: e.target.value })} placeholder="80" />
            </Field>
            <Field icon={<HeartPulse className="h-3.5 w-3.5" />} label="Pulse (bpm)">
              <McInput type="number" value={form.pulse} onChange={e => set({ pulse: e.target.value })} placeholder="72" />
            </Field>
            <Field icon={<Wind className="h-3.5 w-3.5" />} label="Respiratory Rate (/min)">
              <McInput type="number" value={form.respiratoryRate} onChange={e => set({ respiratoryRate: e.target.value })} placeholder="16" />
            </Field>
            <Field icon={<Gauge className="h-3.5 w-3.5" />} label="Oxygen Saturation (%)">
              <McInput type="number" value={form.oxygenSaturation} onChange={e => set({ oxygenSaturation: e.target.value })} placeholder="98" />
            </Field>
          </FormSection>

          <FormSection n={3} title="Measurements">
            <Field icon={<Weight className="h-3.5 w-3.5" />} label="Weight (kg)">
              <McInput type="number" step="0.1" value={form.weight} onChange={e => set({ weight: e.target.value })} placeholder="65" />
            </Field>
            <Field icon={<Ruler className="h-3.5 w-3.5" />} label="Height (cm)">
              <McInput type="number" step="0.1" value={form.height} onChange={e => set({ height: e.target.value })} placeholder="170" />
            </Field>
            <Field icon={<Gauge className="h-3.5 w-3.5" />} label="BMI (auto)" hint="computed live from weight & height">
              <div className="h-9 px-3 rounded-lg border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] flex items-center justify-between">
                <span className={`text-sm font-bold ${bmiTone}`}>{bmi || '—'}</span>
                <span className={`text-[11px] ${bmiTone}`}>{bmiLabel}</span>
              </div>
            </Field>
            <Field icon={<Droplets className="h-3.5 w-3.5" />} label="Blood Glucose (mmol/L)">
              <McInput type="number" step="0.1" value={form.bloodGlucose} onChange={e => set({ bloodGlucose: e.target.value })} placeholder="5.4" />
            </Field>
            <Field icon={<BatteryWarning className="h-3.5 w-3.5" />} label="Pain Score (0–10)">
              <McInput type="number" min="0" max="10" value={form.painScore} onChange={e => set({ painScore: e.target.value })} placeholder="0" />
            </Field>
            <Field icon={<StickyNote className="h-3.5 w-3.5" />} label="Notes" className="sm:col-span-2">
              <McTextarea value={form.notes} onChange={e => set({ notes: e.target.value })} placeholder="Observations at triage…" />
            </Field>
          </FormSection>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--mc-divider)] pt-4">
            <Button variant="outline" onClick={() => setForm({ ...emptyForm })}>Clear</Button>
            <Button className="gap-1" onClick={submit} disabled={submitting || !patientId}>
              <Save className="h-4 w-4" /> {submitting ? 'Saving…' : 'Record Vitals'}
            </Button>
          </div>
        </div>

        {/* Recent vitals for selected patient — recorder name on every record */}
        <div className="lg:col-span-2 rounded-xl border border-[var(--mc-divider)] bg-white overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-[var(--mc-divider)]">
            <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
              <History className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Vitals History</h2>
              <p className="text-[11px] text-muted-foreground truncate">
                {selected ? `${selected.firstName} ${selected.lastName} · ${selected.patientNo}` : 'Select a patient above'}
              </p>
            </div>
          </div>
          {!patientId ? (
            <p className="text-sm text-muted-foreground text-center py-10">No patient selected.</p>
          ) : recentLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No vitals recorded for this patient yet.</p>
          ) : (
            <div className="divide-y divide-[var(--mc-divider)] max-h-[620px] overflow-y-auto">
              {recent.map(v => (
                <div key={v.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1.5">
                    <p className="text-[11px] font-semibold text-[var(--mc-text-secondary)]">{fmtDateTime(v.recordedAt)}</p>
                    {v.recordedByName && (
                      <span className="text-[10px] text-[var(--mc-primary-dark)] bg-[var(--mc-primary-light)] rounded-full px-1.5 py-0.5 font-semibold">
                        by {v.recordedByName}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                    <span><Thermometer className="inline h-3 w-3 mr-1 text-[var(--mc-primary)]" />{v.temperature || '—'} °C</span>
                    <span className="font-semibold">{v.bloodPressureSystolic || '—'}/{v.bloodPressureDiastolic || '—'}</span>
                    <span>{v.pulse || '—'} bpm</span>
                    <span>{v.weight || '—'} kg</span>
                    <span>{v.height || '—'} cm</span>
                    <span className="font-semibold">BMI {v.bmi || '—'}</span>
                    <span>{v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—'}</span>
                    <span>{v.bloodGlucose || '—'} mmol/L</span>
                    <span>Pain {v.painScore || '—'}</span>
                  </div>
                  {v.notes && <p className="text-[11px] text-muted-foreground mt-1.5 italic">{v.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
