import type { Metadata } from 'next';
import { getSiteSetting, getPublicFaqs } from '@/lib/public-data';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import FaqBrowser from './FaqBrowser';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description: 'Quick answers on bookings, billing, insurance, pharmacy and visiting hours at Boyani Health Dispensary.',
};

export default async function FaqPage() {
  const [setting, faqs] = await Promise.all([
    getSiteSetting(),
    getPublicFaqs(100),
  ]);

  return (
    <>
      <BreadcrumbHero
        title="Frequently Asked Questions"
        subtitle="Quick answers on bookings, insurance and visiting."
        items={[{ label: 'FAQ' }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      <section className="mc-section">
        <div className="mc-container max-w-3xl">
          <FaqBrowser
            faqs={faqs.map(f => ({
              id: f.id,
              question: f.question,
              answer: f.answer,
              category: f.category,
            }))}
          />
        </div>
      </section>
    </>
  );
}
