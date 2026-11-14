import type { MetadataRoute } from 'next';

/**
 * robots.txt — allow all public pages, keep staff/admin areas and APIs
 * out of search indexes.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/login', '/launcher', '/api'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
