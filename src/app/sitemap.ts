import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';

/**
 * PUBLIC SITEMAP — static public routes + dynamic department service pages,
 * news articles and about web pages. Data-fresh (force-dynamic semantics).
 */

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/about/why-choose-us`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/about/our-values`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/about/vision-mission`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/services`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/booking`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/doctors`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/news`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/downloads`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${base}/gallery`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/careers`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
  ];

  const [departments, newsPosts, webPages, jobs] = await Promise.all([
    db.department.findMany({
      where: { isPublic: true },
      select: { slug: true, updatedAt: true },
    }).catch(() => []),
    db.newsPost.findMany({
      where: { isPublic: true, publishedAt: { not: null } },
      select: { slug: true, publishedAt: true, updatedAt: true },
    }).catch(() => []),
    db.webPage.findMany({
      where: { isPublic: true },
      select: { slug: true, updatedAt: true },
    }).catch(() => []),
    db.jobPosting.findMany({
      where: { isPublic: true, status: 'OPEN' },
      select: { slug: true, updatedAt: true },
    }).catch(() => []),
  ]);

  const departmentRoutes: MetadataRoute.Sitemap = departments.map((d): MetadataRoute.Sitemap[number] => ({
    url: `${base}/services/${d.slug}`,
    lastModified: d.updatedAt || now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const newsRoutes: MetadataRoute.Sitemap = newsPosts.map((n): MetadataRoute.Sitemap[number] => ({
    url: `${base}/news/${n.slug}`,
    lastModified: n.publishedAt || n.updatedAt || now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  // About sub-pages (exclude the about-us root handled by /about)
  const webPageRoutes: MetadataRoute.Sitemap = webPages
    .filter(p => p.slug !== 'about-us')
    .map((p): MetadataRoute.Sitemap[number] => ({
      url: `${base}/about/${p.slug}`,
      lastModified: p.updatedAt || now,
      changeFrequency: 'yearly',
      priority: 0.5,
    }));

  const jobRoutes: MetadataRoute.Sitemap = jobs.map((j): MetadataRoute.Sitemap[number] => ({
    url: `${base}/careers/${j.slug}`,
    lastModified: j.updatedAt || now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...departmentRoutes,
    ...newsRoutes,
    ...webPageRoutes,
    ...jobRoutes,
  ];
}
