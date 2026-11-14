'use client';

/**
 * NEWS LISTING BROWSER — featured post + category filter chips + grid.
 */

import * as React from 'react';
import Link from 'next/link';
import { CalendarDays, ArrowRight, Newspaper } from 'lucide-react';

export interface PublicNewsPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverImageUrl: string;
  author: string;
  isFeatured: boolean;
  publishedAt: string; // ISO
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

const CATEGORY_LABELS: Record<string, string> = {
  ANNOUNCEMENTS: 'Announcements',
  EVENTS: 'Events',
  HEALTH_TIPS: 'Health Tips',
  RESEARCH: 'Research',
  NEWS: 'News',
};

export default function NewsBrowser({ posts }: { posts: PublicNewsPost[] }) {
  const [category, setCategory] = React.useState('');

  const categories = React.useMemo(
    () => [...new Set(posts.map(p => p.category))],
    [posts],
  );

  // Featured = first isFeatured post, else the latest
  const featured = posts.find(p => p.isFeatured) || posts[0] || null;
  const rest = posts.filter(p => p.id !== featured?.id);
  const filtered = category ? rest.filter(p => p.category === category) : rest;

  if (!posts.length) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--mc-divider)] bg-white p-12 text-center text-[var(--mc-text-secondary)]">
        No news published yet — check back soon.
      </p>
    );
  }

  return (
    <div>
      {/* Featured post */}
      {featured && (
        <Link
          href={`/news/${featured.slug}`}
          className="group grid lg:grid-cols-2 rounded-2xl overflow-hidden border border-[var(--mc-divider)] bg-white shadow-lg mb-10 hover:shadow-xl hover:border-[var(--mc-primary)] transition-all"
        >
          <div className="relative min-h-64 bg-[var(--mc-bg-card)]">
            {featured.coverImageUrl ? (
              <img src={featured.coverImageUrl} alt={featured.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <span className="absolute inset-0 mc-gradient-primary text-white/20 flex items-center justify-center">
                <Newspaper className="h-20 w-20" />
              </span>
            )}
            <span className="absolute top-4 left-4 rounded-full bg-[var(--mc-secondary)] text-white text-[11px] font-extrabold uppercase tracking-wide px-3 py-1.5 shadow">
              Featured
            </span>
          </div>
          <div className="p-7 md:p-9 flex flex-col justify-center">
            <p className="text-xs font-bold text-[var(--mc-primary)] uppercase tracking-wide">
              {CATEGORY_LABELS[featured.category] || featured.category.replaceAll('_', ' ')}
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--mc-text-primary)] mt-2 group-hover:text-[var(--mc-primary)] leading-snug">
              {featured.title}
            </h2>
            <p className="text-[var(--mc-text-secondary)] mt-3 line-clamp-3">{featured.excerpt}</p>
            <p className="flex items-center gap-2 text-xs text-[var(--mc-text-muted)] mt-5">
              <CalendarDays className="h-3.5 w-3.5" /> {fmtDate(featured.publishedAt)}
              {featured.author && <> · By {featured.author}</>}
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--mc-primary)] mt-4">
              Read the full story <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </div>
        </Link>
      )}

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setCategory('')}
          className={`rounded-full px-4 py-2 text-xs font-bold border transition-colors ${!category ? 'mc-gradient-primary text-white border-transparent shadow' : 'border-[var(--mc-divider)] bg-white text-[var(--mc-text-secondary)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)]'}`}
        >
          All ({rest.length})
        </button>
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(category === c ? '' : c)}
            className={`rounded-full px-4 py-2 text-xs font-bold border transition-colors ${category === c ? 'mc-gradient-primary text-white border-transparent shadow' : 'border-[var(--mc-divider)] bg-white text-[var(--mc-text-secondary)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)]'}`}
          >
            {CATEGORY_LABELS[c] || c.replaceAll('_', ' ')} ({rest.filter(p => p.category === c).length})
          </button>
        ))}
      </div>

      {/* Grid of remaining */}
      {filtered.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(post => (
            <Link
              key={post.id}
              href={`/news/${post.slug}`}
              className="group rounded-2xl overflow-hidden border border-[var(--mc-divider)] bg-white hover:shadow-lg hover:border-[var(--mc-primary)] hover:-translate-y-1 transition-all"
            >
              <div className="relative h-44 bg-[var(--mc-bg-card)]">
                {post.coverImageUrl ? (
                  <img src={post.coverImageUrl} alt={post.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <span className="absolute inset-0 mc-gradient-primary text-white/20 flex items-center justify-center">
                    <Newspaper className="h-12 w-12" />
                  </span>
                )}
              </div>
              <div className="p-5">
                <p className="text-[11px] font-bold text-[var(--mc-primary)] uppercase tracking-wide">
                  {CATEGORY_LABELS[post.category] || post.category.replaceAll('_', ' ')}
                </p>
                <h3 className="font-extrabold text-[var(--mc-text-primary)] mt-1.5 group-hover:text-[var(--mc-primary)] leading-snug line-clamp-2">{post.title}</h3>
                <p className="text-sm text-[var(--mc-text-secondary)] mt-2 line-clamp-2">{post.excerpt}</p>
                <p className="flex items-center gap-2 text-xs text-[var(--mc-text-muted)] mt-4">
                  <CalendarDays className="h-3.5 w-3.5" /> {fmtDate(post.publishedAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--mc-divider)] bg-white p-10 text-center text-[var(--mc-text-secondary)]">
          No posts in this category yet.
        </p>
      )}
    </div>
  );
}
