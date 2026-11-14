import {
  getSiteSetting, getCompanyConfig, getActiveSliders, getActiveHomepage,
  getPublicDepartments, getPublicWebsiteServices, getPublicNews,
  getPublicTestimonials, getPublicFaqs, getPublicDownloads, getPublicGallery,
  getPublicWebPages, getSiteStats,
} from '@/lib/public-data';
import { WidgetRouter, WidgetConfig } from '@/components/homepage/WidgetRouter';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * PUBLIC HOMEPAGE — renders the ACTIVE homepage design (1..18) as a
 * composition of widgets (DEVELOPER-MANUAL §7.1). ?design=N previews another.
 * Header and footer are provided by the parent (public)/layout.tsx — not here.
 */
export default async function Home({ searchParams }: { searchParams: Promise<{ design?: string }> }) {
  const sp = await searchParams;
  const previewKey = sp.design ? parseInt(sp.design) : null;

  const [setting, company, pages, sliders] = await Promise.all([
    getSiteSetting(),
    getCompanyConfig(),
    getPublicWebPages(),
    getActiveSliders(),
  ]);

  const { design, widgets } = await getActiveHomepage();
  // Preview override: read widgets of the previewed design
  let activeWidgets = widgets;
  if (previewKey && (!design || design.designKey !== previewKey)) {
    const previewDesign = await db.homepageDesign.findFirst({ where: { designKey: previewKey } }).catch(() => null);
    if (previewDesign) {
      activeWidgets = await db.homepageWidget.findMany({
        where: { designId: previewDesign.id, isActive: true },
        orderBy: { displayOrder: 'asc' },
      }).catch(() => []);
    }
  }

  // Load widget data in parallel. NOTE (Instruction 6): facility `services`
  // (pricing) and `doctors`/`jobs` payloads are NOT shipped to the public
  // homepage — service widgets render the WebsiteService CMS (no pricing),
  // doctors sections are removed, and jobs live on /careers.
  const [departments, websiteServices, news, testimonials, faqs, downloads, galleryAlbums, stats] = await Promise.all([
    getPublicDepartments(),
    getPublicWebsiteServices(), // WebsiteService CMS — drives all service widgets
    getPublicNews(9),
    getPublicTestimonials(8),
    getPublicFaqs(8),
    getPublicDownloads(8),
    getPublicGallery(),
    getSiteStats(),
  ]);

  const widgetData = {
    slides: sliders.map(s => ({ ...s, designId: s.designId || 1 })),
    departments, websiteServices, news, testimonials, faqs, downloads,
    galleryAlbums, webPages: pages, stats, company,
  };

  return (
    <>
      {previewKey && (
        <div className="bg-amber-500 text-white text-center text-xs font-bold py-1.5 no-print sticky top-0 z-50">
          Preview: homepage design #{previewKey} — <a href="/" className="underline">exit preview</a>
        </div>
      )}
      {activeWidgets.length === 0 ? (
        <div className="mc-section text-center">
          <h1 className="text-3xl font-extrabold text-[var(--mc-text-primary)]">{company.company_name}</h1>
          <p className="text-[var(--mc-text-secondary)] mt-2">{company.company_slogan}</p>
        </div>
      ) : (
        activeWidgets.map((w, i) => (
          <WidgetRouter
            key={`${w.id}-${i}`}
            widget={{ moduleKey: w.moduleKey, variantId: w.variantId, sectionTitle: w.sectionTitle, sectionSubtitle: w.sectionSubtitle } as WidgetConfig}
            data={widgetData}
          />
        ))
      )}
    </>
  );
}
