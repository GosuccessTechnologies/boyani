'use client';

/**
 * JOB APPLICATION FORM — POST /api/applications (public, no auth) with inline
 * success/error states.
 */

import * as React from 'react';
import { Send, AlertCircle, CheckCircle2, Link2 } from 'lucide-react';

export default function ApplyForm({ jobPostingId, jobTitle }: { jobPostingId: string; jobTitle: string }) {
  const [form, setForm] = React.useState({
    applicantName: '',
    email: '',
    phone: '',
    resumeUrl: '',
    coverLetter: '',
  });
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, jobPostingId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit application');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application — please try again');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-8 text-center">
        <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-extrabold text-green-800">Application received!</h2>
        <p className="text-green-700 mt-2">
          Thank you {form.applicantName.split(' ')[0]} — your application for <strong>{jobTitle}</strong> is in.
          We will contact you if shortlisted.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} id="apply" className="rounded-2xl border border-[var(--mc-divider)] bg-white p-6 md:p-8 space-y-4 shadow-lg">
      <h2 className="text-xl font-extrabold text-[var(--mc-text-primary)]">Apply for this position</h2>
      <p className="text-sm text-[var(--mc-text-secondary)] -mt-2">Shortlisting happens after the application deadline.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ap-name" className="text-sm font-semibold block mb-1.5">Full name *</label>
          <input id="ap-name" required className="mc-input w-full h-11 px-3" value={form.applicantName}
            onChange={e => setForm(f => ({ ...f, applicantName: e.target.value }))} placeholder="e.g. Amina Hassan" />
        </div>
        <div>
          <label htmlFor="ap-phone" className="text-sm font-semibold block mb-1.5">Phone *</label>
          <input id="ap-phone" required className="mc-input w-full h-11 px-3" value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254 7xx xxx xxx" />
        </div>
      </div>
      <div>
        <label htmlFor="ap-email" className="text-sm font-semibold block mb-1.5">Email *</label>
        <input id="ap-email" type="email" required className="mc-input w-full h-11 px-3" value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
      </div>
      <div>
        <label htmlFor="ap-cv" className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
          <Link2 className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> CV / resume link (Google Drive, Dropbox…)
        </label>
        <input id="ap-cv" type="url" className="mc-input w-full h-11 px-3" value={form.resumeUrl}
          onChange={e => setForm(f => ({ ...f, resumeUrl: e.target.value }))} placeholder="https://drive.google.com/…" />
      </div>
      <div>
        <label htmlFor="ap-cover" className="text-sm font-semibold block mb-1.5">Cover letter *</label>
        <textarea id="ap-cover" required className="mc-input w-full px-3 py-2.5 min-h-32" value={form.coverLetter}
          onChange={e => setForm(f => ({ ...f, coverLetter: e.target.value }))}
          placeholder="Tell us why you are the right fit for this role…" />
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <button type="submit" disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-full mc-gradient-primary text-white h-12 px-8 font-bold shadow-lg hover:-translate-y-0.5 transition-transform disabled:opacity-60">
        <Send className="h-4 w-4" /> {loading ? 'Submitting…' : 'Submit Application'}
      </button>
    </form>
  );
}
