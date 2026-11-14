import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSiteSetting } from '@/lib/public-data';
import { db } from '@/lib/db';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import { ArrowRight, CalendarCheck, Phone, CheckCircle2, ListTree } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * PUBLIC SERVICE DETAIL — WebsiteService CMS content (rich paragraphs,
 * featured image, sub-services listed as cards/pills/table — NO pricing),
 * with a Book Appointment call-to-action. Falls back to checking legacy
 * slugs (departments/categories) for old links.
 */

interface Props { params: Promise<{ slug: string }> }

async function getService(slug: string) {
  const service = await db.websiteService.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true, slug: true, title: true, excerpt: true, content: true,
      featuredImage: true, bannerImage: true, displayStyle: true,
      department: { select: { name: true, slug: true, color: true } },
      subServices: { where: { isActive: true }, orderBy: { displayOrder: 'asc' }, select: { id: true, title: true, description: true } },
    },
  }).catch(() => null); // graceful degradation (Instruction 3)
  return service;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await getService(slug);
  if (!service) return { title: 'Service not found' };
  return { title: `${service.title} — Services`, description: service.excerpt || undefined };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const [setting, service] = await Promise.all([getServiceSettingSafe(), getService(slug)]);
  if (!service) notFound();

  const [company] = await Promise.all([
    db.companyConfig.findMany({ where: { key: { in: ['company_phone', 'company_name'] } } }).catch(() => []),
  ]);
  const phone = company.find(c => c.key === 'company_phone')?.value || '';
  const accent = service.department?.color || 'var(--mc-primary)';

  const otherServices = await db.websiteService.findMany({
    where: { isActive: true, NOT: { id: service.id } },
    orderBy: { displayOrder: 'asc' },
    take: 4,
    select: { slug: true, title: true, excerpt: true },
  }).catch(() => []);

  return (
    <>
      <BreadcrumbHero
        title={service.title}
        subtitle={service.excerpt}
        items={[{ label: 'Services', href: '/services' }, { label: service.title }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      <section className="mc-section">
        <div className="mc-container grid lg:grid-cols-3 gap-10">
          {/* Main column: banner + rich content + sub-services */}
          <div className="lg:col-span-2 space-y-10">
            {(service.bannerImage || service.featuredImage) && (
              <div className="rounded-2xl overflow-hidden shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={service.bannerImage || service.featuredImage || ''} alt={service.title} className="w-full h-64 md:h-80 object-cover" />
              </div>
            )}

            <article
              className="mc-prose max-w-none"
              dangerouslySetInnerHTML={{ __html: service.content || `<p>${service.excerpt}</p>` }}
            />

            {/* Sub-services listing */}
            {service.subServices.length > 0 && (
              <div>
                <h2 className="text-2xl font-extrabold text-[var(--mc-text-primary)] flex items-center gap-2.5 mb-6">
                  <span className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: accent }}>
                    <ListTree className="h-5 w-5" />
                  </span>
                  What&apos;s included
                </h2>

                {service.displayStyle === 'pills' && (
                  <div className="flex flex-wrap gap-2.5">
                    {service.subServices.map(sub => (
                      <div key={sub.id} className="group rounded-full border border-[var(--mc-divider)] bg-white px-4 py-2.5 hover:border-[var(--mc-primary)] hover:shadow-md transition-all">
                        <p className="text-sm font-bold text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)]">{sub.title}</p>
                        {sub.description && <p className="text-xs text-[var(--mc-text-secondary)] mt-0.5 max-w-xs">{sub.description}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {service.displayStyle === 'table' && (
                  <div className="rounded-2xl border border-[var(--mc-divider)] bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="mc-table">
                        <thead>
                          <tr><th>Service</th><th>Description</th></tr>
                        </thead>
                        <tbody>
                          {service.subServices.map(sub => (
                            <tr key={sub.id}>
                              <td className="font-semibold text-[var(--mc-text-primary)] whitespace-nowrap">
                                <span className="inline-flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: accent }} />
                                  {sub.title}
                                </span>
                              </td>
                              <td className="text-[var(--mc-text-secondary)]">{sub.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(service.displayStyle === 'cards' || !['pills', 'table', 'cards'].includes(service.displayStyle)) && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {service.subServices.map(sub => (
                      <div key={sub.id} className="rounded-2xl border border-[var(--mc-divider)] bg-white p-5 hover:shadow-md hover:border-[var(--mc-primary)] transition-all">
                        <span className="h-9 w-9 rounded-lg flex items-center justify-center text-white mb-3" style={{ background: accent }}>
                          <CheckCircle2 className="h-5 w-5" />
                        </span>
                        <h3 className="font-bold text-[var(--mc-text-primary)]">{sub.title}</h3>
                        {sub.description && <p className="text-sm text-[var(--mc-text-secondary)] mt-1.5">{sub.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar: CTA + department + other services */}
          <aside className="space-y-6">
            <div className="rounded-2xl p-6 text-white shadow-lg" style={{ background: `linear-gradient(150deg, ${accent}, color-mix(in srgb, ${accent} 70%, black))` }}>
              <h3 className="font-extrabold text-lg">Book this service</h3>
              <p className="text-white/80 text-sm mt-1.5">Schedule your visit online — our front office confirms within one working hour.</p>
              <Link
                href={`/booking${service.department ? `?department=${encodeURIComponent(service.department.slug)}` : ''}`}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold shadow hover:-translate-y-0.5 transition-transform"
                style={{ color: accent }}
              >
                <CalendarCheck className="h-4 w-4" /> Book Appointment
              </Link>
              {phone && (
                <a href={`tel:${phone}`} className="mt-2.5 flex items-center gap-2 text-sm text-white/85 hover:text-white">
                  <Phone className="h-4 w-4" /> {phone}
                </a>
              )}
            </div>

            {service.department && (
              <div className="rounded-2xl border border-[var(--mc-divider)] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-text-muted)]">Clinical Department</p>
                <p className="font-bold text-[var(--mc-text-primary)] mt-1">{service.department.name}</p>
              </div>
            )}

            {otherServices.length > 0 && (
              <div className="rounded-2xl border border-[var(--mc-divider)] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--mc-text-muted)] mb-3">Explore more services</p>
                <div className="space-y-3">
                  {otherServices.map(o => (
                    <Link key={o.slug} href={`/services/${o.slug}`} className="group block">
                      <p className="text-sm font-bold text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)] inline-flex items-center gap-1">
                        {o.title} <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <p className="text-xs text-[var(--mc-text-secondary)] line-clamp-1 mt-0.5">{o.excerpt}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}

async function getServiceSettingSafe() {
  try {
    const { getSiteSetting } = await import('@/lib/public-data');
    return await getSiteSetting();
  } catch { return null; }
}
