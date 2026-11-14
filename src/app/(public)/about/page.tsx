import Link from 'next/link';
import {
  getSiteSetting, getCompanyConfig, getPublicWebPage, getPublicWebPages, getSiteStats,
} from '@/lib/public-data';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import {
  HeartPulse, Award, Users, CalendarCheck, ArrowRight, ShieldCheck, Target, BookHeart,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const KES = (n: number) => `KSh ${Number(n || 0).toLocaleString('en-KE')}`;

export default async function AboutPage() {
  const [setting, company, page, pages, stats] = await Promise.all([
    getSiteSetting(),
    getCompanyConfig(),
    getPublicWebPage('about-us'),
    getPublicWebPages(),
    getSiteStats(),
  ]);

  // Subpages shown under About (exclude the about-us page itself)
  const subPages = pages.filter(p => p.slug !== 'about-us');

  const statItems = [
    { icon: Users, label: 'Patients Served', value: Number(stats.patients).toLocaleString('en-KE') },
    { icon: CalendarCheck, label: 'Years of Care', value: `${stats.years}+` },
    { icon: HeartPulse, label: 'Clinical Departments', value: `${stats.departments}` },
    { icon: Award, label: 'Specialist Doctors', value: `${stats.doctors}` },
  ];

  const subPageIcons: Record<string, typeof ShieldCheck> = {
    WHY_CHOOSE_US: ShieldCheck,
    VALUES: BookHeart,
    VISION_MISSION: Target,
  };

  return (
    <>
      <BreadcrumbHero
        title={page?.title || 'About Us'}
        subtitle={page?.excerpt || `Who we are — ${company.company_name}, ${company.company_slogan}`}
        items={[{ label: 'About Us' }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      {/* Intro + rich text content (graceful fallback when page record is missing) */}
      <section className="mc-section">
        <div className="mc-container grid lg:grid-cols-3 gap-10 items-start">
          <div className="lg:col-span-2">
            {page?.content ? (
              <div className="mc-prose" dangerouslySetInnerHTML={{ __html: page.content }} />
            ) : (
              <div className="mc-prose">
                <h2>Modern Care for Modern Health</h2>
                <p>
                  {company.company_name} is a leading multidisciplinary hospital serving communities across Kenya.
                  From 24/7 emergency and trauma response to maternity, surgery, laboratory, imaging and pharmacy
                  services, we combine modern medical technology with deeply human care.
                </p>
                <h3>What we do</h3>
                <ul>
                  <li>24/7 emergency &amp; trauma care with rapid triage</li>
                  <li>Specialist outpatient clinics and inpatient treatment</li>
                  <li>Maternity, neonatal and child health services</li>
                  <li>Full-service laboratory, imaging and pharmacy</li>
                </ul>
                <h3>Our promise</h3>
                <p>
                  Every patient is treated with dignity, every diagnosis is explained in plain language, and every
                  shilling is billed transparently. That has been our way since day one.
                </p>
              </div>
            )}
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--mc-divider)] bg-white p-6 shadow-sm">
              <h3 className="font-extrabold text-lg text-[var(--mc-text-primary)] mb-1">At a Glance</h3>
              <p className="text-sm text-[var(--mc-text-secondary)]">{company.company_address}</p>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--mc-text-muted)]">Emergency</dt>
                  <dd className="font-semibold text-[var(--mc-text-primary)]">{company.emergency_phone}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--mc-text-muted)]">Reception</dt>
                  <dd className="font-semibold text-[var(--mc-text-primary)]">{company.company_phone}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--mc-text-muted)]">Email</dt>
                  <dd className="font-semibold text-[var(--mc-text-primary)] break-all">{company.company_email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--mc-text-muted)]">Hours</dt>
                  <dd className="font-semibold text-[var(--mc-text-primary)] text-right">{company.opening_hours}</dd>
                </div>
              </dl>
            </div>
            <Link
              href="/booking"
              className="flex items-center justify-center gap-2 rounded-full mc-gradient-primary text-white px-6 py-3.5 font-bold shadow hover:-translate-y-0.5 transition-transform"
            >
              <CalendarCheck className="h-4 w-4" /> Book an Appointment
            </Link>
          </aside>
        </div>
      </section>

      {/* Stats row */}
      <section className="py-10 bg-[var(--mc-bg-card)] border-y border-[var(--mc-divider)]">
        <div className="mc-container grid grid-cols-2 lg:grid-cols-4 gap-6">
          {statItems.map(s => (
            <div key={s.label} className="flex items-center gap-4">
              <span className="h-14 w-14 rounded-2xl mc-gradient-primary text-white flex items-center justify-center shrink-0 shadow">
                <s.icon className="h-7 w-7" />
              </span>
              <div>
                <p className="text-2xl md:text-3xl font-extrabold text-[var(--mc-text-primary)]">{s.value}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-text-muted)]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Links to subpages */}
      {subPages.length > 0 && (
        <section className="mc-section">
          <div className="mc-container">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--mc-text-primary)] text-center mb-10">
              Learn more about us
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {subPages.map(p => {
                const Icon = subPageIcons[p.moduleKey] || BookHeart;
                return (
                  <Link
                    key={p.id}
                    href={`/about/${p.slug}`}
                    className="group rounded-2xl border border-[var(--mc-divider)] bg-white p-7 hover:shadow-lg hover:border-[var(--mc-primary)] hover:-translate-y-1 transition-all"
                  >
                    <span className="h-12 w-12 rounded-xl bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className="font-extrabold text-lg text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)]">{p.title}</h3>
                    {p.excerpt && <p className="text-sm text-[var(--mc-text-secondary)] mt-2 line-clamp-3">{p.excerpt}</p>}
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--mc-primary)] mt-4">
                      Read more <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Fee note */}
      <section className="pb-14">
        <div className="mc-container">
          <div className="rounded-2xl mc-gradient-primary text-white p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-extrabold">Transparent pricing, SHA-friendly</h2>
              <p className="text-white/80 mt-1.5 max-w-xl">
                Consultations from {KES(1500)} · laboratory tests from {KES(300)} · SHA-covered services clearly marked on our full price list.
              </p>
            </div>
            <Link href="/services" className="inline-flex items-center gap-2 rounded-full bg-white text-[var(--mc-primary-dark)] px-6 py-3 font-bold shadow hover:-translate-y-0.5 transition-transform shrink-0">
              Explore Services <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
