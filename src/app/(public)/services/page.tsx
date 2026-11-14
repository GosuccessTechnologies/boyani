import Link from 'next/link';
import { getSiteSetting } from '@/lib/public-data';
import { db } from '@/lib/db';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import { ArrowRight, CalendarCheck, Stethoscope, Activity, Pill, Microscope, Baby, BedDouble, ScanLine, Brain, Syringe, ShieldCheck, HeartPulse, Scissors, HardHat, Layers } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * PUBLIC SERVICES — powered by the WEBSITE MODULE (WebsiteService CMS),
 * NOT the facility pricing module. NO pricing is displayed publicly
 * (Instruction 5). Shows cards with excerpts; detail via /services/[slug].
 */

const SERVICE_ICONS: { match: RegExp; icon: typeof Stethoscope }[] = [
  { match: /emergency|trauma/i, icon: Activity },
  { match: /maternal|mch|neonatal|child/i, icon: Baby },
  { match: /surger|procedure/i, icon: Syringe },
  { match: /imag|radio|scan|mri|diagnostic/i, icon: ScanLine },
  { match: /lab|patholog|diagnost/i, icon: Microscope },
  { match: /pharmac/i, icon: Pill },
  { match: /admis|inpatient|ward/i, icon: BedDouble },
  { match: /mental|psych|counsel/i, icon: Brain },
  { match: /chronic|disease/i, icon: HeartPulse },
  { match: /wellness|screen|occupational/i, icon: HardHat },
];
const serviceIcon = (slug: string) => (SERVICE_ICONS.find(d => d.match.test(slug))?.icon) || Stethoscope;

export default async function ServicesPage() {
  const [setting, services] = await Promise.all([
    getSiteSetting(),
    db.websiteService.findMany({
      where: { isActive: true },
      orderBy: [{ isFeatured: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, slug: true, title: true, excerpt: true, featuredImage: true,
        iconKey: true, isFeatured: true,
        department: { select: { name: true, slug: true, color: true } },
        subServices: { where: { isActive: true }, select: { id: true }, orderBy: { displayOrder: 'asc' } },
      },
    }).catch(() => []), // graceful degradation instead of a hard error page (Instruction 3)
  ]);

  return (
    <>
      <BreadcrumbHero
        title="Our Services"
        subtitle="Comprehensive care under one roof — explore what we offer and book your visit."
        items={[{ label: 'Services' }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      {/* Services grid — premium cards with excerpts */}
      <section className="mc-section">
        <div className="mc-container">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--mc-text-primary)]">What We Offer</h2>
            <p className="text-[var(--mc-text-secondary)] mt-2">
              From everyday consultations to specialized programmes — every service is delivered by qualified teams who take time to listen, examine and explain.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map(s => {
              const Icon = serviceIcon(s.slug);
              return (
                <Link
                  key={s.id}
                  href={`/services/${s.slug}`}
                  className="group rounded-2xl border border-[var(--mc-divider)] bg-white overflow-hidden hover:shadow-xl hover:border-[var(--mc-primary)] hover:-translate-y-1 transition-all"
                >
                  {/* Card hero image or icon band */}
                  <div className="h-40 relative overflow-hidden" style={{ background: s.department?.color ? `color-mix(in srgb, ${s.department.color} 12%, #ffffff)` : 'var(--mc-primary-light)' }}>
                    {s.featuredImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.featuredImage} alt={s.title} className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span
                          className="h-16 w-16 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform"
                          style={{ background: s.department?.color || 'var(--mc-primary)' }}
                        >
                          <Icon className="h-8 w-8" strokeWidth={1.6} />
                        </span>
                      </div>
                    )}
                    {s.isFeatured && (
                      <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--mc-primary-dark)] shadow">
                        <ShieldCheck className="h-3 w-3" /> Featured
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-extrabold text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)]">{s.title}</h3>
                    <p className="text-sm text-[var(--mc-text-secondary)] mt-2 line-clamp-3">{s.excerpt}</p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs font-semibold text-[var(--mc-text-muted)] inline-flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> {s.subServices.length} service{s.subServices.length !== 1 ? 's' : ''}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--mc-primary)]">
                        Learn more <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {!services.length && (
            <div className="text-center py-16 border-2 border-dashed border-[var(--mc-divider)] rounded-2xl">
              <Stethoscope className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-semibold">Services are being updated</p>
              <p className="text-sm text-muted-foreground mt-1">Please check back shortly or contact us directly.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-14">
        <div className="mc-container">
          <div className="rounded-2xl mc-gradient-primary text-white p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-extrabold">Not sure which service you need?</h2>
              <p className="text-white/80 mt-1.5 max-w-xl">Book a general consultation and our clinicians will guide you to the right care — or call us and our front office will assist.</p>
            </div>
            <Link href="/booking" className="inline-flex items-center gap-2 rounded-full bg-white text-[var(--mc-primary-dark)] px-6 py-3 font-bold shadow hover:-translate-y-0.5 transition-transform shrink-0">
              <CalendarCheck className="h-4 w-4" /> Book Appointment
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
