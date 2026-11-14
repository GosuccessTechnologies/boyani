import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSiteSetting } from '@/lib/public-data';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import GalleryBrowser from './GalleryBrowser';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Photo Gallery',
  description: 'Take a look inside our hospital — facilities, teams and care in action.',
};

export default async function GalleryPage() {
  const [setting, albums] = await Promise.all([
    getSiteSetting(),
    // All photos per album for the full gallery page (widget loader caps at 8)
    db.galleryAlbum.findMany({
      where: { isPublic: true },
      orderBy: { displayOrder: 'asc' },
      include: { photos: { orderBy: { displayOrder: 'asc' } } },
    }).catch(() => []),
  ]);

  return (
    <>
      <BreadcrumbHero
        title="Photo Gallery"
        subtitle="Take a look inside — our facilities, our teams, and care in action."
        items={[{ label: 'Gallery' }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      <section className="mc-section">
        <div className="mc-container">
          <GalleryBrowser
            albums={albums.map(a => ({
              id: a.id,
              slug: a.slug,
              title: a.title,
              description: a.description,
              coverImageUrl: a.coverImageUrl,
              photos: a.photos.map(p => ({
                id: p.id,
                title: p.title,
                imageUrl: p.imageUrl,
                caption: p.caption,
              })),
            }))}
          />
        </div>
      </section>
    </>
  );
}
