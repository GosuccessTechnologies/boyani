import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSiteSetting, getPublicNews } from '@/lib/public-data';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import { CalendarDays, UserRound, Tag, ArrowLeft, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const fmtDate = (d: Date) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

const CATEGORY_LABELS: Record<string, string> = {
  ANNOUNCEMENTS: 'Announcements',
  EVENTS: 'Events',
  HEALTH_TIPS: 'Health Tips',
  RESEARCH: 'Research',
  NEWS: 'News',
};

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await db.newsPost.findFirst({
    where: { slug, isPublic: true, publishedAt: { not: null } },
  }).catch(() => null);
  if (!post) return { title: 'Article not found' };
  return {
    title: post.title,
    description: post.excerpt || undefined,
    openGraph: post.coverImageUrl ? { images: [post.coverImageUrl] } : undefined,
  };
}

export default async function NewsArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [setting, post] = await Promise.all([
    getSiteSetting(),
    db.newsPost.findFirst({ where: { slug, isPublic: true, publishedAt: { not: null } } }).catch(() => null),
  ]);
  if (!post) notFound();

  // Related: latest other public posts
  const related = (await getPublicNews(4)).filter(n => n.id !== post.id).slice(0, 3);
  const tags = post.tags ? post.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <>
      <BreadcrumbHero
        title={post.title}
        subtitle={post.excerpt || undefined}
        items={[{ label: 'News', href: '/news' }, { label: CATEGORY_LABELS[post.category] || post.category.replaceAll('_', ' ') }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      <section className="mc-section">
        <div className="mc-container max-w-3xl">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--mc-text-secondary)] mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] text-xs font-extrabold uppercase tracking-wide px-3 py-1.5">
              <Tag className="h-3 w-3" /> {CATEGORY_LABELS[post.category] || post.category.replaceAll('_', ' ')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-[var(--mc-primary)]" /> {post.publishedAt ? fmtDate(post.publishedAt) : ''}
            </span>
            {post.author && (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4 text-[var(--mc-primary)]" /> {post.author}
              </span>
            )}
          </div>

          {/* Hero image */}
          {post.coverImageUrl && (
            <img src={post.coverImageUrl} alt={post.title} className="w-full h-64 md:h-96 object-cover rounded-2xl shadow-lg mb-8" />
          )}

          {/* Rich text body */}
          {post.content ? (
            <article className="mc-prose" dangerouslySetInnerHTML={{ __html: post.content }} />
          ) : (
            <p className="text-[var(--mc-text-secondary)] italic">{post.excerpt}</p>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-8">
              {tags.map(t => (
                <span key={t} className="rounded-full border border-[var(--mc-divider)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--mc-text-secondary)]">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Back link */}
          <Link href="/news" className="mt-10 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--mc-primary)] hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to all news
          </Link>
        </div>
      </section>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="pb-16">
          <div className="mc-container max-w-5xl">
            <h2 className="text-xl font-extrabold text-[var(--mc-text-primary)] mb-6">More stories</h2>
            <div className="grid sm:grid-cols-3 gap-5">
              {related.map(n => (
                <Link
                  key={n.id}
                  href={`/news/${n.slug}`}
                  className="group rounded-2xl border border-[var(--mc-divider)] bg-white p-5 hover:shadow-lg hover:border-[var(--mc-primary)] transition-all"
                >
                  <p className="text-[11px] font-bold text-[var(--mc-primary)] uppercase tracking-wide">
                    {CATEGORY_LABELS[n.category] || n.category.replaceAll('_', ' ')}
                  </p>
                  <h3 className="font-bold text-[var(--mc-text-primary)] mt-1.5 group-hover:text-[var(--mc-primary)] leading-snug line-clamp-3">{n.title}</h3>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--mc-primary)] mt-3">
                    Read <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
