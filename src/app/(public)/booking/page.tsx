import Link from 'next/link';
import type { Metadata } from 'next';
import { getSiteSetting, getCompanyConfig, getPublicDepartments, getPublicDoctors } from '@/lib/public-data';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import BookingForm from './BookingForm';
import { MapPin, Phone, Mail, Clock, Siren, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Book an Appointment',
  description: 'Book a hospital appointment online — pick a department, doctor, date and time. Confirmation within one working hour.',
};

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  const sp = await searchParams;
  const [setting, company, departments, doctors] = await Promise.all([
    getSiteSetting(),
    getCompanyConfig(),
    getPublicDepartments(),
    getPublicDoctors(100),
  ]);

  const initialDepartmentId = departments.find(d => d.id === sp.department)?.id || '';

  return (
    <>
      <BreadcrumbHero
        title="Book an Appointment"
        subtitle="Pick a department, doctor, date and time — our front office confirms within one working hour."
        items={[{ label: 'Booking' }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      <section className="mc-section">
        <div className="mc-container grid lg:grid-cols-3 gap-10 items-start">
          {/* Form */}
          <div className="lg:col-span-2">
            <BookingForm
              departments={departments.map(d => ({ id: d.id, name: d.name }))}
              doctors={doctors.map(d => ({ id: d.id, employeeId: d.employeeId, name: d.name, specialization: d.specialization, department: d.department }))}
              initialDepartmentId={initialDepartmentId}
            />
            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              {[
                { icon: CheckCircle2, text: 'No booking fee — pay at the facility' },
                { icon: ShieldCheck, text: 'SHA / insurance patients welcome' },
                { icon: Clock, text: 'SMS confirmation within the hour' },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-xl bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] p-3.5 text-xs font-semibold text-[var(--mc-text-secondary)]">
                  <f.icon className="h-4 w-4 text-[var(--mc-primary)] shrink-0 mt-0.5" />
                  {f.text}
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar: contact info + emergency + hours */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--mc-divider)] bg-white p-6 shadow-sm">
              <h3 className="font-extrabold text-lg text-[var(--mc-text-primary)] mb-4">Reach us directly</h3>
              <ul className="space-y-3.5 text-sm text-[var(--mc-text-secondary)]">
                <li className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-[var(--mc-primary)] shrink-0 mt-0.5" />
                  <span>{company.company_address}<br /><span className="text-xs text-[var(--mc-text-muted)]">{company.company_postal_address}</span></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-[var(--mc-primary)] shrink-0" />
                  <a href={`tel:${company.company_phone.replace(/\s+/g, '')}`} className="hover:text-[var(--mc-primary)] hover:underline font-semibold">{company.company_phone}</a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-[var(--mc-primary)] shrink-0" />
                  <a href={`mailto:${company.company_email}`} className="hover:text-[var(--mc-primary)] hover:underline font-semibold break-all">{company.company_email}</a>
                </li>
                <li className="flex items-start gap-2.5">
                  <Clock className="h-4 w-4 text-[var(--mc-primary)] shrink-0 mt-0.5" />
                  <span>{company.opening_hours}</span>
                </li>
              </ul>
              <Link href="/contact" className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-[var(--mc-primary)] text-[var(--mc-primary)] px-5 py-2.5 font-bold text-sm hover:bg-[var(--mc-primary)] hover:text-white transition-colors">
                Send a message instead
              </Link>
            </div>

            <div className="rounded-2xl bg-red-600 text-white p-6 shadow-lg">
              <div className="flex items-center gap-2.5 mb-2">
                <Siren className="h-6 w-6" />
                <h3 className="font-extrabold text-lg">Emergency? Don&apos;t book — call</h3>
              </div>
              <p className="text-white/85 text-sm">24/7 ambulance and trauma line. In an emergency, call us directly or come straight in.</p>
              <a href={`tel:${company.emergency_phone.replace(/\s+/g, '')}`} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white text-red-700 px-5 py-2.5 font-extrabold shadow hover:-translate-y-0.5 transition-transform">
                <Phone className="h-4 w-4" /> {company.emergency_phone}
              </a>
            </div>

            <div className="rounded-2xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-6">
              <h3 className="font-extrabold text-[var(--mc-text-primary)] mb-2">Clinic hours</h3>
              <dl className="text-sm space-y-1.5 text-[var(--mc-text-secondary)]">
                <div className="flex justify-between gap-3"><dt>Mon – Fri</dt><dd className="font-semibold">06:30 – 20:00</dd></div>
                <div className="flex justify-between gap-3"><dt>Saturday</dt><dd className="font-semibold">06:30 – 17:00</dd></div>
                <div className="flex justify-between gap-3"><dt>Sunday</dt><dd className="font-semibold">Emergencies only</dd></div>
                <div className="flex justify-between gap-3"><dt>Emergency unit</dt><dd className="font-semibold text-[var(--mc-primary)]">24 / 7</dd></div>
              </dl>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
