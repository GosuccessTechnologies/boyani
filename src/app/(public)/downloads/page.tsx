import type { Metadata } from 'next';
import { getSiteSetting, getPublicDownloads } from '@/lib/public-data';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import DownloadBrowser from './DownloadBrowser';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Downloads & Resources',
  description: 'Forms, price lists, policies, brochures and tender documents — free to download.',
};

export default async function DownloadsPage() {
  const [setting, downloads] = await Promise.all([
    getSiteSetting(),
    getPublicDownloads(100),
  ]);

  return (
    <>
      <BreadcrumbHero
        title="Downloads & Resources"
        subtitle="Forms, price lists and policy documents — free to download."
        items={[{ label: 'Downloads' }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      <section className="mc-section">
        <div className="mc-container">
          <DownloadBrowser
            downloads={downloads.map(d => ({
              id: d.id,
              title: d.title,
              description: d.description,
              fileUrl: d.fileUrl,
              fileExt: d.fileExt,
              fileSize: d.fileSize,
              category: d.category,
              downloadCount: d.downloadCount,
            }))}
          />
        </div>
      </section>
    </>
  );
}
