import Link from 'next/link';
import type { Metadata } from 'next';
import { getSiteSetting, getCompanyConfig, getPublicJobs } from '@/lib/public-data';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import { MapPin, Clock, Users, Wallet, CalendarDays, Briefcase, ArrowRight, FileText, Mail, Phone } from 'lucide-react';

export const dynamic = 'force-dynamic';

const fmtDate = (d: Date) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  LOCUM: 'Locum',
  INTERNSHIP: 'Internship',
};
const EMPLOYMENT_STYLES: Record<string, string> = {
  FULL_TIME: 'bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]',
  PART_TIME: 'bg-amber-100 text-amber-700',
  CONTRACT: 'bg-blue-100 text-blue-700',
  LOCUM: 'bg-purple-100 text-purple-700',
  INTERNSHIP: 'bg-pink-100 text-pink-700',
};

export const metadata: Metadata = {
  title: 'Careers',
  description: 'Join the Boyani Health Dispensary team — open positions for clinicians, technologists and support staff.',
};

export default async function CareersPage() {
  const [setting, company, jobs] = await Promise.all([
    getSiteSetting(),
    getCompanyConfig(),
    getPublicJobs(),
  ]);

  return (
    <>
      <BreadcrumbHero
        title="Careers at Boyani Health Dispensary"
        subtitle="Build your career where compassion meets clinical excellence."
        items={[{ label: 'Careers' }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      {/* Intro */}
      <section className="mc-section pb-0">
        <div className="mc-container max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] text-xs font-extrabold uppercase tracking-wide px-4 py-1.5">
            <Briefcase className="h-3.5 w-3.5" /> We&apos;re hiring
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--mc-text-primary)] mt-4">
            Join a team that treats people, not just patients
          </h2>
          <p className="text-[var(--mc-text-secondary)] mt-3">
            {company.company_name} offers structured mentorship, fair pay and modern facilities.
            We recruit on merit and we invest in growth — {jobs.length} position{jobs.length === 1 ? '' : 's'} currently open.
          </p>
        </div>
      </section>

      {/* Open positions */}
      <section className="mc-section">
        <div className="mc-container max-w-4xl">
          <h2 className="text-xl font-extrabold text-[var(--mc-text-primary)] mb-6">Open positions</h2>
          {jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map(job => (
                <Link
                  key={job.id}
                  href={`/careers/${job.slug}`}
                  className="group block rounded-2xl border border-[var(--mc-divider)] bg-white p-6 hover:shadow-lg hover:border-[var(--mc-primary)] transition-all"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-extrabold text-lg text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)]">{job.title}</h3>
                        <span className={`rounded-full text-[11px] font-extrabold px-2.5 py-1 ${EMPLOYMENT_STYLES[job.employmentType] || 'bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)]'}`}>
                          {EMPLOYMENT_LABELS[job.employmentType] || job.employmentType.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--mc-text-secondary)] mt-1.5">
                        {job.department && <>{job.department} · </>}
                        {job.location || 'On-site'}
                      </p>
                      {job.salaryRange && (
                        <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--mc-text-primary)] mt-2">
                          <Wallet className="h-4 w-4 text-[var(--mc-primary)]" /> {job.salaryRange}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 text-xs text-[var(--mc-text-muted)] font-semibold shrink-0">
                      <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {job.openings} opening{job.openings === 1 ? '' : 's'}</span>
                      {job.deadline && (
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Apply by {fmtDate(job.deadline)}</span>
                      )}
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full mc-gradient-primary text-white px-4 py-2 text-xs font-bold shadow group-hover:-translate-y-0.5 transition-transform">
                        View &amp; apply <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--mc-divider)] bg-white p-12 text-center text-[var(--mc-text-secondary)]">
              No open positions right now — but we keep promising CVs on file. Send yours any time via the contacts below.
            </p>
          )}
        </div>
      </section>

      {/* How to apply — ApplicationForm teaser */}
      <section className="pb-16">
        <div className="mc-container">
          <div className="rounded-2xl mc-gradient-primary text-white p-8 md:p-10 grid md:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <h2 className="text-2xl font-extrabold flex items-center gap-2.5"><FileText className="h-6 w-6" /> How to apply</h2>
              <ol className="mt-4 space-y-2 text-sm text-white/85 list-decimal list-inside">
                <li>Open a position above and read the role description and requirements.</li>
                <li>Fill the online application form on the job page — cover letter + CV link.</li>
                <li>Shortlisted candidates are invited for interview within 2 weeks of the deadline.</li>
              </ol>
              <p className="text-white/70 text-xs mt-4">
                Prefer email? Send your CV and cover letter to <span className="font-bold">{company.company_email}</span> quoting the job title.
              </p>
            </div>
            <div className="space-y-3 shrink-0">
              <a href={`mailto:${company.company_email}`} className="flex items-center gap-2.5 rounded-full bg-white text-[var(--mc-primary-dark)] px-5 py-3 font-bold text-sm shadow hover:-translate-y-0.5 transition-transform">
                <Mail className="h-4 w-4" /> Email your CV
              </a>
              <a href={`tel:${company.company_phone.replace(/\s+/g, '')}`} className="flex items-center gap-2.5 rounded-full border border-white/40 text-white px-5 py-3 font-bold text-sm hover:bg-white/10 transition-colors">
                <Phone className="h-4 w-4" /> {company.company_phone}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
