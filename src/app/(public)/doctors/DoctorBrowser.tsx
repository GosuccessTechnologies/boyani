'use client';

/**
 * DOCTORS DIRECTORY BROWSER — client filter bar (specialization + name search)
 * + responsive doctors grid. Receives the full serialized doctors array as prop.
 */

import * as React from 'react';
import Link from 'next/link';
import { Search, CalendarCheck, BadgeCheck, Clock, Award } from 'lucide-react';

export interface PublicDoctor {
  id: string;
  name: string;
  title: string;
  specialization: string;
  department: string;
  qualifications: string;
  experienceYears: number;
  consultationFee: number;
  availableDays: string;
  availableHours: string;
  isAcceptingPatients: boolean;
  photoUrl: string;
}

const KES = (n: number) => `KSh ${Number(n || 0).toLocaleString('en-KE')}`;

const initials = (name: string) => name.replace('Dr. ', '').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

export default function DoctorBrowser({ doctors }: { doctors: PublicDoctor[] }) {
  const [query, setQuery] = React.useState('');
  const [specialization, setSpecialization] = React.useState('');

  const specializations = React.useMemo(
    () => [...new Set(doctors.map(d => d.specialization))].sort(),
    [doctors],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return doctors.filter(d => {
      if (specialization && d.specialization !== specialization) return false;
      if (q && !`${d.name} ${d.specialization} ${d.department}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [doctors, query, specialization]);

  return (
    <div>
      {/* Filter bar */}
      <div className="rounded-2xl border border-[var(--mc-divider)] bg-white p-4 md:p-5 mb-8 shadow-sm">
        <div className="grid md:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--mc-text-muted)]" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search doctors by name, specialty or department…"
              aria-label="Search doctors"
              className="mc-input w-full h-11 pl-10 pr-3"
            />
          </div>
          <select
            value={specialization}
            onChange={e => setSpecialization(e.target.value)}
            aria-label="Filter by specialization"
            className="mc-input h-11 px-3 bg-white md:w-64"
          >
            <option value="">All specializations</option>
            {specializations.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <p className="text-xs font-semibold text-[var(--mc-text-muted)] mt-3">
          Showing {filtered.length} of {doctors.length} doctors
        </p>
      </div>

      {/* Doctors grid */}
      {filtered.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map(doc => (
            <article key={doc.id} className="group rounded-2xl border border-[var(--mc-divider)] bg-white p-6 text-center hover:shadow-lg hover:border-[var(--mc-primary)] hover:-translate-y-1 transition-all">
              <div className="relative mx-auto mb-4 w-fit">
                {doc.photoUrl ? (
                  <img src={doc.photoUrl} alt={`${doc.title} ${doc.name}`} className="h-24 w-24 rounded-full object-cover shadow" />
                ) : (
                  <span className="h-24 w-24 rounded-full mc-gradient-primary text-white flex items-center justify-center text-2xl font-extrabold shadow">
                    {initials(doc.name)}
                  </span>
                )}
                {doc.isAcceptingPatients && (
                  <span className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-green-500 text-white border-2 border-white flex items-center justify-center" title="Accepting new patients">
                    <BadgeCheck className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              <h2 className="font-extrabold text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)]">{doc.title} {doc.name.replace(/^Dr\.\s*/, '')}</h2>
              <p className="text-xs font-bold text-[var(--mc-primary)] uppercase tracking-wide mt-0.5">{doc.specialization}</p>
              {doc.qualifications && <p className="text-xs text-[var(--mc-text-muted)] mt-1.5">{doc.qualifications}</p>}
              <div className="mt-4 pt-4 border-t border-[var(--mc-divider)] grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-center gap-1.5 text-[var(--mc-text-secondary)] font-semibold">
                  <Award className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> {doc.experienceYears} yrs
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[var(--mc-text-secondary)] font-semibold">
                  <Clock className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> {doc.availableDays}
                </div>
              </div>
              <p className="mt-3 text-sm font-extrabold text-[var(--mc-text-primary)]">{KES(doc.consultationFee)} <span className="text-xs font-medium text-[var(--mc-text-muted)]">/ consultation</span></p>
              <Link
                href={`/booking?doctor=${doc.id}`}
                className="mt-4 inline-flex items-center gap-2 rounded-full mc-gradient-primary text-white px-5 py-2.5 text-sm font-bold shadow hover:-translate-y-0.5 transition-transform"
              >
                <CalendarCheck className="h-4 w-4" /> Book
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--mc-divider)] bg-white p-12 text-center">
          <p className="font-bold text-[var(--mc-text-primary)]">No doctors match your filters</p>
          <p className="text-sm text-[var(--mc-text-secondary)] mt-1.5">Try clearing the search or choosing another specialization.</p>
          <button
            onClick={() => { setQuery(''); setSpecialization(''); }}
            className="mt-4 rounded-full border-2 border-[var(--mc-primary)] text-[var(--mc-primary)] px-5 py-2 text-sm font-bold hover:bg-[var(--mc-primary)] hover:text-white transition-colors"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
