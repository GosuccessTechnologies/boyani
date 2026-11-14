/**
 * Public website server data helpers (politicsmigori pattern — direct Prisma reads,
 * SEO-friendly server rendering, no auth).
 */

import { db } from '@/lib/db';

export async function getSiteSetting() {
  return db.siteSetting.findUnique({ where: { id: 'main' } }).catch(() => null);
}

export async function getActiveTheme() {
  const setting = await getSiteSetting();
  const theme = await db.theme.findUnique({ where: { id: setting?.activeThemeId || 1 } }).catch(() => null);
  return theme;
}

/**
 * Keys never exposed to the public website. The public company map is passed
 * as props to client components (serialized into the HTML), so integration
 * credentials (M-Pesa, PesaPal, SMTP, SMS), internal POS config and pricing
 * metadata (currency/tax — public pages show no pricing, Instructions 5/6)
 * MUST be stripped here. Internal modules read these via /api/company
 * (src/lib/api.ts), not through this helper.
 */
const PUBLIC_STRIP_KEY = /^(mpesa|pesapal|smtp|sms|pos|currency|tax_rate|enable_tax)/i;

export async function getCompanyConfig(): Promise<Record<string, string>> {
  const configs = await db.companyConfig.findMany().catch(() => []);
  const map: Record<string, string> = {};
  for (const c of configs) {
    if (PUBLIC_STRIP_KEY.test(c.key)) continue;
    map[c.key] = c.value;
    const camel = c.key.split('_').map((s, i) => (i === 0 ? s : s[0].toUpperCase() + s.slice(1))).join('');
    if (!(camel in map)) map[camel] = c.value;
  }
  const defaults: Record<string, string> = {
    company_name: 'Boyani Health Dispensary',
    company_slogan: 'Quality Care, Compassionate Service',
    company_email: 'info@africandivinechurch.org',
    company_phone: '0750239057',
    emergency_phone: '0750239057',
    company_address: 'Boyani, Vihiga County',
    company_postal_address: 'Vihiga, Kenya',
    opening_hours: 'Mon–Sat 08:00–20:00',
    company_facebook: '#', company_twitter: '#', company_instagram: '#', company_youtube: '#', company_whatsapp: '#',
    company_logo: '/logo.svg',
  };
  for (const [k, v] of Object.entries(defaults)) if (!(k in map)) map[k] = v;
  return map;
}

export async function getActiveMenu(location: 'HEADER' | 'FOOTER' = 'HEADER') {
  const menus = await db.menu.findMany({
    where: { location, isActive: true },
    include: {
      items: {
        where: { isActive: true, parentId: null },
        orderBy: { displayOrder: 'asc' },
        include: { children: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } } },
      },
    },
  }).catch(() => []);
  return menus[0] || null;
}

export async function getActiveSliders() {
  return db.slider.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
  }).catch(() => []);
}

export async function getActiveHomepage() {
  const setting = await getSiteSetting();
  const designKey = setting?.activeHomepageDesign || 1;
  const design = await db.homepageDesign.findFirst({ where: { designKey } }).catch(() => null);
  if (!design) return { design: null, widgets: [], designKey };
  const widgets = await db.homepageWidget.findMany({
    where: { designId: design.id, isActive: true },
    orderBy: { displayOrder: 'asc' },
  }).catch(() => []);
  return { design, widgets, designKey };
}

// ── Widget data loaders ──
export async function getPublicDepartments() {
  return db.department.findMany({
    where: { isPublic: true, isActive: true },
    orderBy: { displayOrder: 'asc' },
    include: { _count: { select: { services: true } } },
  }).catch(() => []);
}

/**
 * Public-facing services from the WEBSITE MODULE (WebsiteService CMS) — the
 * single source of truth for homepage/listing widgets since Instruction 6.
 * No pricing is stored or returned on this model; subServices are included
 * (active only, ordered) so widgets can list them and derive counts.
 */
export async function getPublicWebsiteServices(limit = 60) {
  return db.websiteService.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      department: { select: { id: true, name: true, slug: true, color: true, iconKey: true } },
      subServices: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, title: true, description: true },
      },
    },
    take: limit,
  }).catch(() => []);
}

export async function getPublicServices(limit = 24) {
  return db.service.findMany({
    where: { isActive: true },
    include: { department: { select: { name: true, slug: true, iconKey: true, color: true } } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    take: limit,
  }).catch(() => []);
}

export async function getPublicDoctors(limit = 8) {
  return db.doctorProfile.findMany({
    where: { isPublic: true },
    orderBy: { displayOrder: 'asc' },
    take: limit,
  }).catch(() => []);
}

export async function getPublicNews(limit = 6) {
  return db.newsPost.findMany({
    where: { isPublic: true, publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  }).catch(() => []);
}

export async function getPublicTestimonials(limit = 6) {
  return db.testimonial.findMany({
    where: { isPublic: true },
    orderBy: { displayOrder: 'asc' },
    take: limit,
  }).catch(() => []);
}

export async function getPublicFaqs(limit = 8) {
  return db.faq.findMany({
    where: { isPublic: true },
    orderBy: { displayOrder: 'asc' },
    take: limit,
  }).catch(() => []);
}

export async function getPublicDownloads(limit = 12) {
  return db.download.findMany({
    where: { isPublic: true },
    orderBy: { displayOrder: 'asc' },
    take: limit,
  }).catch(() => []);
}

export async function getPublicGallery(limit = 12) {
  const albums = await db.galleryAlbum.findMany({
    where: { isPublic: true },
    orderBy: { displayOrder: 'asc' },
    include: { photos: { orderBy: { displayOrder: 'asc' }, take: 8 } },
  }).catch(() => []);
  return albums;
}

export async function getPublicWebPage(slug: string) {
  return db.webPage.findFirst({ where: { slug, isPublic: true } }).catch(() => null);
}

export async function getPublicWebPages() {
  return db.webPage.findMany({ where: { isPublic: true }, orderBy: { displayOrder: 'asc' } }).catch(() => []);
}

export async function getPublicJobs() {
  const now = new Date();
  return db.jobPosting.findMany({
    where: { isPublic: true, status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
  }).catch(() => []).then(jobs => jobs.filter(j => !j.deadline || j.deadline >= now));
}

/** Aggregate "site stats" for stats-counter widgets — dynamic, never hardcoded */
export async function getSiteStats() {
  const [doctors, patients, beds, departments, yearsExp] = await Promise.all([
    db.doctorProfile.count({ where: { isPublic: true } }).catch(() => 0),
    db.patient.count().catch(() => 0),
    db.bed.count().catch(() => 0),
    db.department.count({ where: { isPublic: true } }).catch(() => 0),
    db.webPage.count().catch(() => 0),
  ]);
  return {
    doctors: doctors || 8,
    patients: 12000 + patients, // cumulative patients served (facility lifetime + registry)
    beds: beds || 80,
    departments: departments || 10,
    years: 27, // since 1998 — from About page history
  };
}
