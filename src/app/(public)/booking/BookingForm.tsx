'use client';

/**
 * PUBLIC BOOKING FORM — richer version of the homepage APPOINTMENT_FORM_INLINE
 * widget: adds an optional doctor select (filtered by chosen department) and
 * inline success/error states (no sonner dependency in the public layout).
 */

import * as React from 'react';
import { CalendarCheck, Mail, Phone, Stethoscope, AlertCircle } from 'lucide-react';

export interface BookingDepartment { id: string; name: string }
export interface BookingDoctor { id: string; employeeId: string; name: string; specialization: string; department: string }

const SLOTS = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00'];

export default function BookingForm({
  departments,
  doctors,
  initialDepartmentId = '',
}: {
  departments: BookingDepartment[];
  doctors: BookingDoctor[];
  initialDepartmentId?: string;
}) {
  const [form, setForm] = React.useState({
    patientName: '',
    patientPhone: '',
    patientEmail: '',
    departmentId: initialDepartmentId,
    doctorId: '',
    appointmentDate: '',
    timeSlot: '',
    reason: '',
  });
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Doctors relevant to the selected department (name-fragment match on profile.department)
  const selectedDept = departments.find(d => d.id === form.departmentId);
  const deptKey = selectedDept ? selectedDept.name.split(/[&,]/)[0].trim().toLowerCase() : '';
  const relevantDoctors = form.departmentId && deptKey
    ? doctors.filter(d => `${d.department} ${d.specialization}`.toLowerCase().includes(deptKey))
    : doctors;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const doctor = doctors.find(d => d.id === form.doctorId);
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: form.patientName,
          patientPhone: form.patientPhone,
          patientEmail: form.patientEmail,
          departmentId: form.departmentId || null,
          doctorId: doctor ? (doctor.employeeId || doctor.id) : '',
          appointmentDate: form.appointmentDate,
          timeSlot: form.timeSlot,
          reason: doctor ? `${form.reason}${form.reason ? ' — ' : ''}Preferred doctor: ${doctor.name}` : form.reason,
          source: 'WEBSITE',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Booking failed');
      setDone(json.appointmentNo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed — please try again');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-8 md:p-10 text-center">
        <CalendarCheck className="h-14 w-14 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-extrabold text-green-800">Booking received!</h2>
        <p className="text-green-700 mt-2">
          Your reference is <strong className="font-extrabold">{done}</strong>. Our front office will confirm within one working hour.
        </p>
        <p className="text-sm text-green-700/80 mt-1.5">Please keep your reference number and arrive 15 minutes early with an ID.</p>
        <button
          onClick={() => { setDone(null); setForm(f => ({ ...f, patientName: '', patientPhone: '', patientEmail: '', doctorId: '', appointmentDate: '', timeSlot: '', reason: '' })); }}
          className="mt-5 text-sm font-bold text-green-700 underline"
        >
          Book another appointment
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[var(--mc-divider)] bg-white p-6 md:p-8 space-y-4 shadow-lg">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="bk-name" className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
            <CalendarCheck className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> Full name *
          </label>
          <input id="bk-name" required className="mc-input w-full h-11 px-3" value={form.patientName}
            onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} placeholder="e.g. Jane Wanjiku" />
        </div>
        <div>
          <label htmlFor="bk-phone" className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
            <Phone className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> Phone *
          </label>
          <input id="bk-phone" required className="mc-input w-full h-11 px-3" value={form.patientPhone}
            onChange={e => setForm(f => ({ ...f, patientPhone: e.target.value }))} placeholder="+254 7xx xxx xxx" />
        </div>
      </div>
      <div>
        <label htmlFor="bk-email" className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
          <Mail className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> Email (optional)
        </label>
        <input id="bk-email" type="email" className="mc-input w-full h-11 px-3" value={form.patientEmail}
          onChange={e => setForm(f => ({ ...f, patientEmail: e.target.value }))} placeholder="you@example.com" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="bk-dept" className="text-sm font-semibold block mb-1.5">Department / Service *</label>
          <select id="bk-dept" required className="mc-input w-full h-11 px-3 bg-white" value={form.departmentId}
            onChange={e => setForm(f => ({ ...f, departmentId: e.target.value, doctorId: '' }))}>
            <option value="">Select department…</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="bk-doc" className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
            <Stethoscope className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> Preferred doctor (optional)
          </label>
          <select id="bk-doc" className="mc-input w-full h-11 px-3 bg-white" value={form.doctorId}
            onChange={e => setForm(f => ({ ...f, doctorId: e.target.value }))}>
            <option value="">No preference</option>
            {relevantDoctors.map(d => (
              <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="bk-date" className="text-sm font-semibold block mb-1.5">Preferred date *</label>
          <input id="bk-date" required type="date" min={new Date().toISOString().slice(0, 10)} className="mc-input w-full h-11 px-3"
            value={form.appointmentDate} onChange={e => setForm(f => ({ ...f, appointmentDate: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="bk-slot" className="text-sm font-semibold block mb-1.5">Preferred time</label>
          <select id="bk-slot" className="mc-input w-full h-11 px-3 bg-white" value={form.timeSlot}
            onChange={e => setForm(f => ({ ...f, timeSlot: e.target.value }))}>
            <option value="">Any time</option>
            {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="bk-reason" className="text-sm font-semibold block mb-1.5">Reason for visit</label>
        <textarea id="bk-reason" className="mc-input w-full px-3 py-2 min-h-20" value={form.reason}
          onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Briefly tell us how we can help…" />
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <button type="submit" disabled={loading}
        className="w-full rounded-full mc-gradient-primary text-white h-12 font-bold text-base shadow-lg hover:-translate-y-0.5 transition-transform disabled:opacity-60">
        {loading ? 'Submitting…' : 'Request Appointment'}
      </button>
    </form>
  );
}
