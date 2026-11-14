'use client';

/**
 * PUBLIC CONTACT FORM — POST /api/contact with inline success/error states.
 */

import * as React from 'react';
import { Send, AlertCircle, CheckCircle2 } from 'lucide-react';

const DEPARTMENTS = [
  'GENERAL', 'APPOINTMENTS', 'BILLING', 'LABORATORY', 'PHARMACY', 'MATERNITY', 'HR / CAREERS',
];

export default function ContactForm() {
  const [form, setForm] = React.useState({
    name: '', email: '', phone: '', subject: '', department: 'GENERAL', message: '',
  });
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send message');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message — please try again');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-8 md:p-10 text-center h-full flex flex-col items-center justify-center min-h-96">
        <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-extrabold text-green-800">Message sent!</h2>
        <p className="text-green-700 mt-2 max-w-md">
          Thank you {form.name.split(' ')[0]} — our team will get back to you shortly
          {form.email ? ` at ${form.email}` : ' by phone'}.
        </p>
        <button
          onClick={() => { setDone(false); setForm(f => ({ ...f, subject: '', message: '' })); }}
          className="mt-5 text-sm font-bold text-green-700 underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[var(--mc-divider)] bg-white p-6 md:p-8 space-y-4 shadow-lg">
      <h2 className="text-xl font-extrabold text-[var(--mc-text-primary)]">Send us a message</h2>
      <p className="text-sm text-[var(--mc-text-secondary)] -mt-2">We reply to all genuine inquiries within one working day.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ct-name" className="text-sm font-semibold block mb-1.5">Full name *</label>
          <input id="ct-name" required className="mc-input w-full h-11 px-3" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Jane Wanjiku" />
        </div>
        <div>
          <label htmlFor="ct-phone" className="text-sm font-semibold block mb-1.5">Phone</label>
          <input id="ct-phone" className="mc-input w-full h-11 px-3" value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254 7xx xxx xxx" />
        </div>
      </div>
      <div>
        <label htmlFor="ct-email" className="text-sm font-semibold block mb-1.5">Email *</label>
        <input id="ct-email" type="email" required className="mc-input w-full h-11 px-3" value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ct-subject" className="text-sm font-semibold block mb-1.5">Subject</label>
          <input id="ct-subject" className="mc-input w-full h-11 px-3" value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Appointment question" />
        </div>
        <div>
          <label htmlFor="ct-dept" className="text-sm font-semibold block mb-1.5">Department</label>
          <select id="ct-dept" className="mc-input w-full h-11 px-3 bg-white" value={form.department}
            onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="ct-msg" className="text-sm font-semibold block mb-1.5">Message *</label>
        <textarea id="ct-msg" required className="mc-input w-full px-3 py-2.5 min-h-32" value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="How can we help you?" />
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <button type="submit" disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-full mc-gradient-primary text-white h-12 px-8 font-bold shadow-lg hover:-translate-y-0.5 transition-transform disabled:opacity-60">
        <Send className="h-4 w-4" /> {loading ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}
