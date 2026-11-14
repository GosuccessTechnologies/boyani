import type { Metadata } from 'next';
import { getSiteSetting, getCompanyConfig } from '@/lib/public-data';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import ContactForm from './ContactForm';
import { MapPin, Phone, Mail, Clock, Siren, Facebook, Twitter, Instagram, Youtube, MessageCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with Boyani Health Dispensary — phone, email, location map and opening hours.',
};

const SOCIALS: { key: string; label: string; icon: typeof Facebook }[] = [
  { key: 'company_facebook', label: 'Facebook', icon: Facebook },
  { key: 'company_twitter', label: 'X / Twitter', icon: Twitter },
  { key: 'company_instagram', label: 'Instagram', icon: Instagram },
  { key: 'company_youtube', label: 'YouTube', icon: Youtube },
  { key: 'company_whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

export default async function ContactPage() {
  const [setting, company] = await Promise.all([getSiteSetting(), getCompanyConfig()]);
  const lat = company.company_latitude || company.mapLatitude || '-1.2921';
  const lng = company.company_longitude || company.mapLongitude || '36.8219';

  return (
    <>
      <BreadcrumbHero
        title="Contact Us"
        subtitle="We are here to help — call, write or visit us."
        items={[{ label: 'Contact' }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      <section className="mc-section">
        <div className="mc-container grid lg:grid-cols-5 gap-10 items-start">
          {/* Left: contact form */}
          <div className="lg:col-span-3">
            <ContactForm />
          </div>

          {/* Right: company info cards */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-[var(--mc-divider)] bg-white p-6 shadow-sm">
              <h3 className="font-extrabold text-lg text-[var(--mc-text-primary)] mb-4">Visit / write to us</h3>
              <ul className="space-y-3.5 text-sm text-[var(--mc-text-secondary)]">
                <li className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-[var(--mc-primary)] shrink-0 mt-0.5" />
                  <span>{company.company_address}<br /><span className="text-xs text-[var(--mc-text-muted)]">{company.company_postal_address}</span></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-[var(--mc-primary)] shrink-0" />
                  <a href={`tel:${company.company_phone.replace(/\s+/g, '')}`} className="font-semibold hover:text-[var(--mc-primary)] hover:underline">{company.company_phone}</a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-[var(--mc-primary)] shrink-0" />
                  <a href={`mailto:${company.company_email}`} className="font-semibold hover:text-[var(--mc-primary)] hover:underline break-all">{company.company_email}</a>
                </li>
                <li className="flex items-start gap-2.5">
                  <Clock className="h-4 w-4 text-[var(--mc-primary)] shrink-0 mt-0.5" />
                  <span>{company.opening_hours}</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl bg-red-600 text-white p-6 shadow-lg">
              <div className="flex items-center gap-2.5 mb-2">
                <Siren className="h-6 w-6" />
                <h3 className="font-extrabold text-lg">Emergency line</h3>
              </div>
              <p className="text-white/85 text-sm">24/7 ambulance, trauma and acute care. Don&apos;t wait in an emergency — call now.</p>
              <a href={`tel:${company.emergency_phone.replace(/\s+/g, '')}`} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white text-red-700 px-5 py-2.5 font-extrabold shadow hover:-translate-y-0.5 transition-transform">
                <Phone className="h-4 w-4" /> {company.emergency_phone}
              </a>
            </div>

            <div className="rounded-2xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-6">
              <h3 className="font-extrabold text-[var(--mc-text-primary)] mb-3.5">Follow us</h3>
              <div className="flex flex-wrap gap-2.5">
                {SOCIALS.map(s => {
                  const href = company[s.key];
                  if (!href || href === '#') return null;
                  return (
                    <a key={s.key} href={href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-divider)] bg-white px-4 py-2 text-xs font-bold text-[var(--mc-text-secondary)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)] transition-colors">
                      <s.icon className="h-4 w-4" /> {s.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map (pattern from MapContactWidget) */}
      <section className="pb-16">
        <div className="mc-container">
          <div className="rounded-2xl overflow-hidden border border-[var(--mc-divider)] shadow-lg">
            <iframe
              title={`${company.company_name} location map`}
              width="100%"
              height="380"
              className="border-0 block"
              loading="lazy"
              src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
            />
          </div>
        </div>
      </section>
    </>
  );
}
