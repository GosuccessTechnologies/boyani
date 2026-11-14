import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSiteSetting, getPublicJobs } from '@/lib/public-data';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import ApplyForm from './ApplyForm';
import { MapPin, Wallet, Users, CalendarDays, Briefcase, ArrowLeft, Building2, ListChecks } from 'lucide-react';

export const dynamic = 'force-dynamic';

const fmtDate = (d: Date) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  LOCUM: 'Locum',
  INTERNSHIP: 'Internship',
};

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const job = await db.jobPosting.findFirst({ where: { slug, isPublic: true } }).catch(() => null);
  if (!job) return { title: 'Job not found' };
  return { title: job.title, description: `Apply for ${job.title} at Boyani Health Dispensary${job.department ? ` — ${job.department}` : ''}.` };
}

export default async function JobDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [setting, job] = await Promise.all([
    getSiteSetting(),
    db.jobPosting.findFirst({ where: { slug, isPublic: true, status: 'OPEN' } }).catch(() => null),
  ]);
  if (!job) notFound();

  const otherJobs = (await getPublicJobs()).filter(j => j.id !== job.id).slice(0, 3);

  const detailRows = [
    { icon: Briefcase, label: 'Employment type', value: EMPLOYMENT_LABELS[job.employmentType] || job.employmentType.replaceAll('_', ' ') },
    { icon: MapPin, label: 'Location', value: job.location || 'On-site' },
    { icon: Building2, label: 'Department', value: job.department || 'General' },
    { icon: Wallet, label: 'Salary range', value: job.salaryRange || 'Competitive, commensurate with experience' },
    { icon: Users, label: 'Openings', value: `${job.openings} position${job.openings === 1 ? '' : 's'}` },
    { icon: CalendarDays, label: 'Application deadline', value: job.deadline ? fmtDate(job.deadline) : 'Rolling (open until filled)' },
  ];

  return (
    <>
      <BreadcrumbHero
        title={job.title}
        subtitle={[job.department, job.location].filter(Boolean).join(' · ') || undefined}
        items={[{ label: 'Careers', href: '/careers' }, { label: job.title }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      <section className="mc-section">
        <div className="mc-container max-w-6xl grid lg:grid-cols-3 gap-10 items-start">
          {/* Main column: description, requirements, application form */}
          <div className="lg:col-span-2 space-y-10">
            <div>
              <h2 className="text-xl font-extrabold text-[var(--mc-text-primary)] mb-4">Role description</h2>
              {job.description ? (
                <div className="mc-prose" dangerouslySetInnerHTML={{ __html: job.description }} />
              ) : (
                <p className="text-[var(--mc-text-secondary)] italic">Detailed description available at the HR office.</p>
              )}
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-[var(--mc-text-primary)] mb-4 flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-[var(--mc-primary)]" /> Requirements
              </h2>
              {job.requirements ? (
                <div className="mc-prose" dangerouslySetInnerHTML={{ __html: job.requirements }} />
              ) : (
                <p className="text-[var(--mc-text-secondary)] italic">Relevant professional qualification and registration required.</p>
              )}
            </div>

            <ApplyForm jobPostingId={job.id} jobTitle={job.title} />
          </div>

          {/* Sidebar: job details */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--mc-divider)] bg-white p-6 shadow-sm lg:sticky lg:top-6">
              <h3 className="font-extrabold text-lg text-[var(--mc-text-primary)] mb-4">Job details</h3>
              <dl className="space-y-4">
                {detailRows.map(r => (
                  <div key={r.label} className="flex items-start gap-3">
                    <span className="h-9 w-9 rounded-lg bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] flex items-center justify-center shrink-0">
                      <r.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--mc-text-muted)]">{r.label}</dt>
                      <dd className="text-sm font-semibold text-[var(--mc-text-primary)]">{r.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              <a href="#apply" className="mt-6 flex items-center justify-center gap-2 rounded-full mc-gradient-primary text-white px-5 py-3 font-bold text-sm shadow hover:-translate-y-0.5 transition-transform">
                Apply now
              </a>
            </div>

            <Link href="/careers" className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--mc-primary)] hover:underline">
              <ArrowLeft className="h-4 w-4" /> All open positions
            </Link>
          </aside>
        </div>
      </section>

      {/* Other openings */}
      {otherJobs.length > 0 && (
        <section className="pb-16">
          <div className="mc-container max-w-6xl">
            <h2 className="text-xl font-extrabold text-[var(--mc-text-primary)] mb-5">Other open positions</h2>
            <div className="grid sm:grid-cols-3 gap-5">
              {otherJobs.map(j => (
                <Link key={j.id} href={`/careers/${j.slug}`} className="group rounded-2xl border border-[var(--mc-divider)] bg-white p-5 hover:shadow-lg hover:border-[var(--mc-primary)] transition-all">
                  <span className="rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] text-[11px] font-extrabold px-2.5 py-1">
                    {EMPLOYMENT_LABELS[j.employmentType] || j.employmentType.replaceAll('_', ' ')}
                  </span>
                  <h3 className="font-bold text-[var(--mc-text-primary)] mt-2.5 group-hover:text-[var(--mc-primary)] leading-snug">{j.title}</h3>
                  <p className="text-xs text-[var(--mc-text-muted)] mt-1.5">{j.department || 'General'} · {j.location || 'On-site'}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
