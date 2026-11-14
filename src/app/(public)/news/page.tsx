import type { Metadata } from 'next';
import { getSiteSetting, getPublicNews } from '@/lib/public-data';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import NewsBrowser from './NewsBrowser';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'News & Stories',
  description: 'Announcements, events, health tips and updates from Boyani Health Dispensary.',
};

export default async function NewsPage() {
  const [setting, news] = await Promise.all([
    getSiteSetting(),
    getPublicNews(60),
  ]);

  return (
    <>
      <BreadcrumbHero
        title="News & Stories"
        subtitle="Announcements, health tips, events and research from our wards and labs."
        items={[{ label: 'News' }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      <section className="mc-section">
        <div className="mc-container">
          <NewsBrowser
            posts={news.map(n => ({
              id: n.id,
              slug: n.slug,
              title: n.title,
              excerpt: n.excerpt,
              category: n.category,
              coverImageUrl: n.coverImageUrl,
              author: n.author,
              isFeatured: n.isFeatured,
              publishedAt: (n.publishedAt || n.createdAt).toISOString(),
            }))}
          />
        </div>
      </section>
    </>
  );
}
