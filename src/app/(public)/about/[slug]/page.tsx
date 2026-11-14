import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSiteSetting, getPublicWebPage } from '@/lib/public-data';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import { ArrowRight, CalendarCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicWebPage(slug);
  if (!page) return { title: 'Page not found' };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.excerpt || undefined,
  };
}

export default async function AboutSubPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [setting, page] = await Promise.all([getSiteSetting(), getPublicWebPage(slug)]);
  if (!page) notFound();

  return (
    <>
      <BreadcrumbHero
        title={page.title}
        subtitle={page.excerpt || undefined}
        items={[{ label: 'About Us', href: '/about' }, { label: page.title }]}
        designId={page.breadcrumbDesignId || setting?.activeBreadcrumbDesign || 1}
      />

      <section className="mc-section">
        <div className="mc-container max-w-3xl">
          {page.content ? (
            <div className="mc-prose" dangerouslySetInnerHTML={{ __html: page.content }} />
          ) : (
            <p className="text-[var(--mc-text-secondary)] italic">Content for this page is coming soon.</p>
          )}

          <div className="mt-12 rounded-2xl mc-gradient-primary text-white p-8 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div>
              <h2 className="text-xl font-extrabold">Experience the difference yourself</h2>
              <p className="text-white/80 text-sm mt-1">Book a visit — we confirm within one working hour.</p>
            </div>
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 rounded-full bg-white text-[var(--mc-primary-dark)] px-6 py-3 font-bold shadow hover:-translate-y-0.5 transition-transform shrink-0"
            >
              <CalendarCheck className="h-4 w-4" /> Book Appointment
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <Link href="/about" className="inline-flex items-center gap-1.5 font-bold text-[var(--mc-primary)] hover:underline">
              ← Back to About Us
            </Link>
            <span className="text-[var(--mc-divider)]">|</span>
            <Link href="/services" className="inline-flex items-center gap-1.5 font-bold text-[var(--mc-primary)] hover:underline">
              Explore our services <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
