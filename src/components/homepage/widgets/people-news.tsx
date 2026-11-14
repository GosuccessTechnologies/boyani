'use client';

/**
 * HOMEPAGE WIDGETS — PEOPLE, NEWS & MEDIA BATCH (15 modules)
 * DOCTORS_CAROUSEL, DOCTORS_GRID, TEAM_LEADERSHIP, TESTIMONIALS_CAROUSEL,
 * NEWS_GRID, NEWS_LIST, BLOG_MAGAZINE, VIDEO_STORY, GALLERY_MASONRY,
 * GALLERY_CAROUSEL, FAQ_ACCORDION, DOWNLOADS_LIST, APPOINTMENT_FORM_INLINE,
 * MAP_CONTACT, FOOTER_NEWSLETTER
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarCheck, ChevronLeft, ChevronRight, Star, Quote, Download, FileText, Phone, MapPin, Mail, Clock, Play, Send, Search, Plus, Minus, BadgeCheck } from 'lucide-react';
import { WidgetProps, SectionHead } from './core';

const kes = (n: number) => `KSh ${Number(n || 0).toLocaleString('en-KE')}`;
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });

const initials = (name: string) => name.replace('Dr. ', '').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

/**
 * [Instruction 6] Doctors/specialists sections were removed from ALL public
 * homepages. The three widgets below (DOCTORS_CAROUSEL, DOCTORS_GRID,
 * TEAM_LEADERSHIP) must render nothing. Their implementations are retained
 * (module keys must keep resolving in the WidgetRouter) but are disabled —
 * flip this flag to restore them.
 */
const DOCTORS_SECTIONS_DISABLED = true;

// ═══ DOCTORS_CAROUSEL — DISABLED (Instruction 6: doctors sections removed) ═══
export function DoctorsCarouselWidget({ data, variant, title, subtitle }: WidgetProps) {
  if (DOCTORS_SECTIONS_DISABLED) return null;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const doctors = data.doctors || [];
  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  return (
    <section className="mc-section">
      <div className="mc-container">
        <div className="flex items-end justify-between gap-4">
          <SectionHead center={false} title={title || 'Meet Our Doctors'} subtitle={subtitle || 'Specialists who know your name, not just your file number.'} />
          <div className="hidden md:flex gap-2 shrink-0">
            <button onClick={() => scroll(-1)} aria-label="Scroll doctors left" className="h-10 w-10 rounded-full border border-[var(--mc-divider)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)] flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => scroll(1)} aria-label="Scroll doctors right" className="h-10 w-10 rounded-full border border-[var(--mc-divider)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)] flex items-center justify-center"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
        <div ref={scrollRef} className="flex gap-5 overflow-x-auto pb-4 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
          {doctors.map(doc => (
            <Link key={doc.id} href="/doctors" className="group w-64 shrink-0 rounded-2xl border border-[var(--mc-divider)] bg-white p-5 text-center hover:shadow-xl hover:-translate-y-1 transition-all">
              {doc.photoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={doc.photoUrl} alt={doc.name} className="w-20 h-20 rounded-full mx-auto object-cover mb-3" />
                : <div className="w-20 h-20 rounded-full mc-gradient-primary text-white flex items-center justify-center mx-auto mb-3 text-xl font-extrabold">{initials(doc.name)}</div>}
              <h3 className="font-bold text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)]">{doc.name}</h3>
              <p className="text-xs text-[var(--mc-primary)] font-semibold mt-0.5">{doc.specialization}</p>
              <p className="text-[11px] text-[var(--mc-text-muted)] mt-1.5 line-clamp-2">{doc.qualifications}</p>
              <p className="text-xs font-bold text-[var(--mc-text-secondary)] mt-2">{doc.experienceYears} yrs · {kes(doc.consultationFee)}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══ DOCTORS_GRID — DISABLED (Instruction 6: doctors sections removed) ═══
export function DoctorsGridWidget({ data, variant, title, subtitle }: WidgetProps) {
  if (DOCTORS_SECTIONS_DISABLED) return null;
  const doctors = (data.doctors || []).slice(0, 8);
  return (
    <section className="mc-section bg-[var(--mc-bg-card)]">
      <div className="mc-container">
        <SectionHead title={title || 'Our Specialist Team'} subtitle={subtitle || 'Book directly with the right specialist — no gatekeeping queues.'} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {doctors.map(doc => (
            <div key={doc.id} className="rounded-2xl bg-white border border-[var(--mc-divider)] overflow-hidden group hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="h-44 relative overflow-hidden">
                {doc.photoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={doc.photoUrl} alt={doc.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full mc-gradient-primary flex items-center justify-center"><span className="text-4xl font-extrabold text-white">{initials(doc.name)}</span></div>}
                {doc.isAcceptingPatients && <span className="absolute top-3 left-3 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Accepting patients</span>}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-[var(--mc-text-primary)]">{doc.name}</h3>
                <p className="text-xs text-[var(--mc-primary)] font-semibold mt-0.5">{doc.specialization}</p>
                <p className="text-[11px] text-[var(--mc-text-muted)] mt-1">{doc.availableDays} · {doc.availableHours}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm font-extrabold text-[var(--mc-text-primary)]">{kes(doc.consultationFee)}</span>
                  <Link href="/booking" className="text-xs font-bold bg-[var(--mc-primary-light)] text-[var(--mc-primary)] rounded-full px-3 py-1.5 hover:bg-[var(--mc-primary)] hover:text-white transition-colors">Book</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══ TEAM_LEADERSHIP — DISABLED (Instruction 6: doctors sections removed) ═══
export function TeamLeadershipWidget({ data, variant, title, subtitle }: WidgetProps) {
  if (DOCTORS_SECTIONS_DISABLED) return null;
  const leaders = (data.doctors || []).slice(0, 4);
  return (
    <section className="mc-section">
      <div className="mc-container">
        <SectionHead title={title || 'Leadership'} subtitle={subtitle || 'The clinicians and administrators who set our standards.'} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {leaders.map((doc, i) => (
            <div key={doc.id} className="flex gap-4 items-start">
              {doc.photoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={doc.photoUrl} alt={doc.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                : <div className="w-16 h-16 rounded-xl mc-gradient-primary text-white flex items-center justify-center font-extrabold shrink-0">{initials(doc.name)}</div>}
              <div>
                <p className="text-xs font-bold text-[var(--mc-secondary)] uppercase tracking-wide">{['Chief Medical Officer', 'Medical Director', 'Head of Clinical Services', 'Chief Operations'][i % 4]}</p>
                <h3 className="font-bold text-[var(--mc-text-primary)] leading-tight mt-0.5">{doc.name}</h3>
                <p className="text-xs text-[var(--mc-text-muted)] mt-1">{doc.specialization}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══ TESTIMONIALS_CAROUSEL ═══
export function TestimonialsCarouselWidget({ data, variant, title, subtitle }: WidgetProps) {
  const [index, setIndex] = React.useState(0);
  const co = data.company.company_name || 'Boyani Health Dispensary';
  const items = data.testimonials.length ? data.testimonials : [{ patientName: 'Wanjala S.', patientTitle: 'Father of two', quote: `The ${co} team had our son treated and comfortable within the hour.`, rating: 5 }];
  const current = items[index % items.length];
  return (
    <section className="mc-section bg-[var(--mc-bg-sidebar)] text-white">
      <div className="mc-container max-w-3xl text-center">
        <SectionHead light title={title || 'Patient Stories'} subtitle={subtitle || 'Real families, real care — in their own words.'} />
        <Quote className="h-10 w-10 mx-auto text-[var(--mc-secondary)] mb-4" />
        <blockquote className="text-lg md:text-xl leading-relaxed text-white/90 min-h-[5.5rem]">“{current.quote}”</blockquote>
        <div className="flex justify-center gap-1 mt-4">
          {Array.from({ length: current.rating || 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-[var(--mc-secondary)] text-[var(--mc-secondary)]" />)}
        </div>
        <p className="font-bold mt-3">{current.patientName}</p>
        <p className="text-sm text-white/60">{current.patientTitle}{current.department ? ` · ${current.department}` : ''}</p>
        {items.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button onClick={() => setIndex(i => (i - 1 + items.length) % items.length)} aria-label="Previous testimonial" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><ChevronLeft className="h-4 w-4" /></button>
            {items.map((t: any, i: number) => <button key={t.id || i} onClick={() => setIndex(i)} aria-label={`Testimonial ${i + 1}`} className={`h-2 rounded-full transition-all ${i === index ? 'w-7 bg-[var(--mc-primary)]' : 'w-2 bg-white/30'}`} />)}
            <button onClick={() => setIndex(i => (i + 1) % items.length)} aria-label="Next testimonial" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </section>
  );
}

// ═══ NEWS_GRID ═══
export function NewsGridWidget({ data, variant, title, subtitle }: WidgetProps) {
  const co = data.company.company_name || 'Boyani Health Dispensary';
  const news = data.news.slice(0, 6);
  if (!news.length) return null;
  return (
    <section className="mc-section">
      <div className="mc-container">
        <SectionHead title={title || 'News & Health Updates'} subtitle={subtitle || 'Announcements, free screening days and practical health advice.'} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {news.map(n => (
            <Link key={n.id} href={`/news/${n.slug}`} className="group rounded-2xl border border-[var(--mc-divider)] bg-white overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="h-44 overflow-hidden relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {n.coverImageUrl ? <img src={n.coverImageUrl} alt={n.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="w-full h-full mc-gradient-primary flex items-center justify-center"><span className="text-4xl">🏥</span></div>}
                <span className="absolute top-3 left-3 bg-white/90 text-[10px] font-bold text-[var(--mc-primary)] px-2 py-0.5 rounded-full uppercase">{n.category}</span>
              </div>
              <div className="p-5">
                <p className="text-xs text-[var(--mc-text-muted)]">{n.publishedAt ? fmtDate(n.publishedAt) : ''} {n.author && `· ${n.author}`}</p>
                <h3 className="font-bold mt-1.5 text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)] leading-snug">{n.title}</h3>
                <p className="text-sm text-[var(--mc-text-secondary)] mt-2 line-clamp-2">{n.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="text-center mt-8"><Link href="/news" className="inline-flex items-center gap-2 font-bold text-[var(--mc-primary)] hover:underline">All news & events <ArrowRight className="h-4 w-4" /></Link></div>
      </div>
    </section>
  );
}

// ═══ NEWS_LIST — featured + list ═══
export function NewsListWidget({ data, variant, title, subtitle }: WidgetProps) {
  const co = data.company.company_name || 'Boyani Health Dispensary';
  const news = data.news.slice(0, 5);
  if (!news.length) return null;
  const [featured, ...rest] = news;
  return (
    <section className="mc-section bg-[var(--mc-bg-card)]">
      <div className="mc-container">
        <SectionHead title={title || 'Newsroom'} subtitle={subtitle || `What's happening at ${co}.`} />
        <div className="grid md:grid-cols-2 gap-8">
          <Link href={`/news/${featured.slug}`} className="group rounded-2xl overflow-hidden bg-white border border-[var(--mc-divider)] shadow-sm hover:shadow-xl transition-all">
            <div className="h-60 relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {featured.coverImageUrl && <img src={featured.coverImageUrl} alt={featured.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}
              {featured.isFeatured && <span className="absolute top-3 left-3 bg-[var(--mc-secondary)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Featured</span>}
            </div>
            <div className="p-6">
              <p className="text-xs text-[var(--mc-text-muted)]">{featured.category} · {featured.publishedAt ? fmtDate(featured.publishedAt) : ''}</p>
              <h3 className="text-xl font-extrabold mt-1.5 text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)]">{featured.title}</h3>
              <p className="text-sm text-[var(--mc-text-secondary)] mt-2 line-clamp-3">{featured.excerpt}</p>
            </div>
          </Link>
          <div className="space-y-4">
            {rest.map(n => (
              <Link key={n.id} href={`/news/${n.slug}`} className="group flex gap-4 rounded-xl bg-white border border-[var(--mc-divider)] p-4 hover:shadow-md transition-all">
                <div className="w-24 h-20 rounded-lg overflow-hidden shrink-0 bg-[var(--mc-bg-card)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {n.coverImageUrl && <img src={n.coverImageUrl} alt={n.title} className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-[var(--mc-text-muted)]">{n.category} · {n.publishedAt ? fmtDate(n.publishedAt) : ''}</p>
                  <h4 className="font-bold text-sm text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)] leading-snug line-clamp-2">{n.title}</h4>
                  <p className="text-xs text-[var(--mc-text-secondary)] mt-1 line-clamp-2">{n.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══ BLOG_MAGAZINE ═══
export function BlogMagazineWidget({ data, variant, title, subtitle }: WidgetProps) {
  const co = data.company.company_name || 'Boyani Health Dispensary';
  const news = data.news.slice(0, 4);
  if (!news.length) return null;
  const cats = [...new Set(news.map((n: any) => n.category))];
  return (
    <section className="mc-section">
      <div className="mc-container">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-7">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--mc-text-primary)]">{title || `The ${co} Journal`}</h2>
            <div className="h-1 w-16 rounded-full mt-2 bg-[var(--mc-primary)]" />
          </div>
          <div className="flex gap-2">
            {cats.map(c => <span key={c} className="text-xs font-bold border border-[var(--mc-divider)] rounded-full px-3 py-1 text-[var(--mc-text-secondary)]">{c}</span>)}
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-8">
          {news.slice(0, 2).map((n, i) => (
            <Link key={n.id} href={`/news/${n.slug}`} className={`group ${i === 0 ? 'lg:row-span-2' : ''} rounded-2xl overflow-hidden relative h-72 lg:h-full min-h-64 shadow-lg`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {n.coverImageUrl && <img src={n.coverImageUrl} alt={n.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              <div className="absolute bottom-0 p-6 text-white">
                <p className="text-xs font-bold text-[var(--mc-secondary)] uppercase">{n.category}</p>
                <h3 className="text-xl font-extrabold mt-1 leading-snug">{n.title}</h3>
                <p className="text-sm text-white/75 mt-1.5 line-clamp-2">{n.excerpt}</p>
              </div>
            </Link>
          ))}
          <div className="grid sm:grid-cols-2 gap-4">
            {news.slice(2).map(n => (
              <Link key={n.id} href={`/news/${n.slug}`} className="group rounded-2xl border border-[var(--mc-divider)] p-5 hover:border-[var(--mc-primary)] hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-bold text-[var(--mc-primary)] uppercase">{n.category}</p>
                  <h4 className="font-bold mt-1 leading-snug text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)]">{n.title}</h4>
                </div>
                <p className="text-xs text-[var(--mc-text-muted)] mt-3">{n.publishedAt ? fmtDate(n.publishedAt) : ''} →</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══ VIDEO_STORY ═══
export function VideoStoryWidget({ data, variant, title, subtitle }: WidgetProps) {
  const co = data.company.company_name || 'Boyani Health Dispensary';
  return (
    <section className="mc-section bg-black">
      <div className="mc-container">
        <div className="relative rounded-2xl overflow-hidden aspect-video max-w-4xl mx-auto group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.unsplash.com/photo-1516549655169-df83a0774514?w=1400&q=70" alt={`${co} patient story video`} className="w-full h-full object-cover opacity-70 group-hover:opacity-60 transition-opacity" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6">
            <button aria-label="Play video" className="h-20 w-20 rounded-full bg-[var(--mc-primary)] hover:scale-110 transition-transform flex items-center justify-center shadow-2xl mb-5">
              <Play className="h-9 w-9 fill-white ml-1" />
            </button>
            <h2 className="text-2xl md:text-3xl font-extrabold">{title || 'A day in our Emergency Centre'}</h2>
            <p className="text-white/75 max-w-lg mt-2">{subtitle || 'Follow Dr. Mutua\'s team through a typical 24 hours — from triage to theatre.'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══ GALLERY_MASONRY ═══
export function GalleryMasonryWidget({ data, variant, title, subtitle }: WidgetProps) {
  const co = data.company.company_name || 'Boyani Health Dispensary';
  const photos = data.galleryAlbums.flatMap((a: any) => a.photos).slice(0, 8);
  const heights = ['h-52', 'h-64', 'h-44', 'h-56', 'h-64', 'h-44', 'h-52', 'h-60'];
  if (!photos.length) return null;
  return (
    <section className="mc-section">
      <div className="mc-container">
        <SectionHead title={title || `Inside ${co}`} subtitle={subtitle || 'A look at our facilities and diagnostics.'} />
        <div className="columns-2 md:columns-4 gap-4 space-y-4">
          {photos.map((p: any, i: number) => (
            <div key={p.id} className={`relative rounded-xl overflow-hidden group ${heights[i % heights.length]}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt={p.caption || p.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end p-3">
                <p className="text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">{p.caption || p.title}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-8"><Link href="/gallery" className="inline-flex items-center gap-2 font-bold text-[var(--mc-primary)] hover:underline">Full gallery <ArrowRight className="h-4 w-4" /></Link></div>
      </div>
    </section>
  );
}

// ═══ GALLERY_CAROUSEL ═══
export function GalleryCarouselWidget({ data, variant, title }: WidgetProps) {
  const photos = data.galleryAlbums.flatMap((a: any) => a.photos).slice(0, 10);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  if (!photos.length) return null;
  return (
    <section className="py-10 bg-[var(--mc-bg-card)] overflow-hidden">
      <div className="mc-container mb-6"><SectionHead title={title || 'Moments of Care'} /></div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto px-4 pb-4">
        {photos.map((p: any) => (
          <div key={p.id} className="w-72 shrink-0 rounded-xl overflow-hidden shadow-sm relative h-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imageUrl} alt={p.caption || p.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══ FAQ_ACCORDION — premium redesign (Instruction 6) ═══
// Variant 1: centered header + clean accordion (plus/minus icons, rounded-2xl cards, hover tint).
// Variant 2: split layout — questions left, booking card right (links to /booking).
export function FaqAccordionWidget({ data, variant, title, subtitle }: WidgetProps) {
  const faqs = data.faqs.slice(0, 6);
  const [open, setOpen] = React.useState<string | null>(faqs[0]?.id || null);
  if (!faqs.length) return null;

  const AccordionList = ({ light = false }: { light?: boolean }) => (
    <div className="space-y-3">
      {faqs.map(f => {
        const isOpen = open === f.id;
        return (
          <div key={f.id} className={`rounded-2xl border overflow-hidden transition-colors ${light ? 'border-white/15 bg-white/5' : 'border-[var(--mc-divider)] bg-white hover:border-[var(--mc-primary)]/50'} ${isOpen ? (light ? 'bg-white/10' : 'bg-[var(--mc-primary-light)]/30') : ''}`}>
            <button onClick={() => setOpen(o => o === f.id ? null : f.id)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left font-semibold text-[var(--mc-text-primary)] hover:bg-[var(--mc-primary-light)]/40 transition-colors">
              {f.question}
              <span className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-[var(--mc-primary)] text-white rotate-180' : 'bg-[var(--mc-primary-light)] text-[var(--mc-primary)]'}`}>
                {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </span>
            </button>
            <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="px-5 pb-4 text-sm text-[var(--mc-text-secondary)] leading-relaxed">{f.answer}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (variant === 2) {
    return (
      <section className="mc-section">
        <div className="mc-container">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--mc-text-primary)]">{title || 'Frequently Asked Questions'}</h2>
            <div className="h-1 w-16 rounded-full mt-2 mx-auto bg-[var(--mc-primary)]" />
            <p className="mt-3 text-sm md:text-base text-[var(--mc-text-secondary)]">{subtitle || 'Quick answers on bookings, insurance and visiting — plus a fast track to book.'}</p>
          </div>
          <div className="grid lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-3"><AccordionList /></div>
            <div className="lg:col-span-2 lg:sticky lg:top-24">
              {/* Booking card — links to the full /booking flow */}
              <div className="relative overflow-hidden rounded-3xl mc-gradient-primary text-white p-7 shadow-xl">
                <div className="absolute -top-14 -right-14 h-40 w-40 rounded-full bg-white/10 pointer-events-none" aria-hidden="true" />
                <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full border-[10px] border-white/10 pointer-events-none" aria-hidden="true" />
                <div className="relative">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide">Fast track</span>
                  <h3 className="text-2xl font-extrabold mt-3 leading-snug">Still have questions?</h3>
                  <p className="text-white/80 text-sm mt-2">Book an appointment and our front office will answer everything — confirmation within one working hour.</p>
                  <ul className="mt-4 space-y-2 text-sm text-white/85">
                    <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 shrink-0" /> Confirmed within the hour</li>
                    <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 shrink-0" /> Pick your service & time</li>
                    <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 shrink-0" /> Walk-ins also welcome</li>
                  </ul>
                  <Link href="/booking" className="mt-6 flex items-center justify-center gap-2 rounded-full bg-white text-[var(--mc-primary)] px-6 py-3.5 font-bold shadow-lg hover:-translate-y-0.5 transition-transform">
                    <CalendarCheck className="h-5 w-5" /> Book Appointment
                  </Link>
                  <a href={`tel:${data.company.company_phone}`} className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-white/90 hover:text-white transition-colors">
                    <Phone className="h-4 w-4" /> or call {data.company.company_phone}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="mc-section">
      <div className="mc-container max-w-3xl">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--mc-text-primary)]">{title || 'Frequently Asked Questions'}</h2>
          <div className="h-1 w-16 rounded-full mt-2 mx-auto bg-[var(--mc-primary)]" />
          <p className="mt-3 max-w-xl mx-auto text-sm md:text-base text-[var(--mc-text-secondary)]">{subtitle || 'Everything you need to know before your visit — quick answers from our team.'}</p>
        </div>
        <AccordionList />
        <p className="text-center text-sm text-[var(--mc-text-secondary)] mt-8">
          Can&apos;t find your answer? <Link href="/contact" className="font-bold text-[var(--mc-primary)] hover:underline">Send us a message</Link> — we reply within one working day.
        </p>
      </div>
    </section>
  );
}

// ═══ DOWNLOADS_LIST ═══
export function DownloadsListWidget({ data, variant, title, subtitle }: WidgetProps) {
  const downloads = data.downloads.slice(0, 6);
  if (!downloads.length) return null;
  return (
    <section className="mc-section bg-[var(--mc-bg-card)]">
      <div className="mc-container max-w-4xl">
        <SectionHead title={title || 'Downloads & Resources'} subtitle={subtitle || 'Forms, price lists and policy documents — free to download.'} />
        <div className="grid sm:grid-cols-2 gap-4">
          {downloads.map(d => (
            <a key={d.id} href={d.fileUrl} className="group flex items-center gap-4 rounded-xl bg-white border border-[var(--mc-divider)] p-4 hover:shadow-md hover:border-[var(--mc-primary)] transition-all">
              <span className="h-12 w-12 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0"><FileText className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-[var(--mc-text-primary)] group-hover:text-[var(--mc-primary)] truncate">{d.title}</p>
                <p className="text-xs text-[var(--mc-text-muted)]">{d.category} · PDF {d.fileSize ? `· ${Math.round(d.fileSize / 1024)}KB` : ''}</p>
              </div>
              <Download className="h-5 w-5 text-[var(--mc-text-muted)] group-hover:text-[var(--mc-primary)] shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══ APPOINTMENT_FORM_INLINE — public booking form widget ═══
export function AppointmentFormInlineWidget({ data, variant, title, subtitle }: WidgetProps) {
  const [form, setForm] = React.useState({ patientName: '', patientPhone: '', patientEmail: '', departmentId: '', appointmentDate: '', timeSlot: '', reason: '' });
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const slots = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00'];
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, source: 'WEBSITE' }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Booking failed');
      setDone(json.appointmentNo);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Booking failed');
    } finally { setLoading(false); }
  };
  if (done) {
    return (
      <section className="mc-section">
        <div className="mc-container max-w-xl text-center rounded-2xl border-2 border-green-200 bg-green-50 p-10">
          <CalendarCheck className="h-14 w-14 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-extrabold text-green-800">Booking received!</h2>
          <p className="text-green-700 mt-2">Your reference is <strong>{done}</strong>. Our front office will confirm within one working hour.</p>
          <button onClick={() => setDone(null)} className="mt-5 text-sm font-bold text-green-700 underline">Book another appointment</button>
        </div>
      </section>
    );
  }
  return (
    <section className="mc-section">
      <div className="mc-container max-w-2xl">
        <SectionHead title={title || 'Book an Appointment'} subtitle={subtitle || 'Pick a department, date and time — we confirm within the hour.'} />
        <form onSubmit={submit} className="rounded-2xl border border-[var(--mc-divider)] bg-white p-6 md:p-8 space-y-4 shadow-lg">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold flex items-center gap-1.5 mb-1.5"><CalendarCheck className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> Full name *</label>
              <input required className="mc-input w-full h-11 px-3" value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} placeholder="e.g. Jane Wanjiku" />
            </div>
            <div>
              <label className="text-sm font-semibold flex items-center gap-1.5 mb-1.5"><Phone className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> Phone *</label>
              <input required className="mc-input w-full h-11 px-3" value={form.patientPhone} onChange={e => setForm(f => ({ ...f, patientPhone: e.target.value }))} placeholder="+254 7xx xxx xxx" />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold flex items-center gap-1.5 mb-1.5"><Mail className="h-3.5 w-3.5 text-[var(--mc-primary)]" /> Email (optional)</label>
            <input type="email" className="mc-input w-full h-11 px-3" value={form.patientEmail} onChange={e => setForm(f => ({ ...f, patientEmail: e.target.value }))} placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Department / Service *</label>
            <select required className="mc-input w-full h-11 px-3 bg-white" value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
              <option value="">Select department…</option>
              {data.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Preferred date *</label>
              <input required type="date" min={new Date().toISOString().slice(0, 10)} className="mc-input w-full h-11 px-3" value={form.appointmentDate} onChange={e => setForm(f => ({ ...f, appointmentDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Preferred time</label>
              <select className="mc-input w-full h-11 px-3 bg-white" value={form.timeSlot} onChange={e => setForm(f => ({ ...f, timeSlot: e.target.value }))}>
                <option value="">Any time</option>
                {slots.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Reason for visit</label>
            <textarea className="mc-input w-full px-3 py-2 min-h-20" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Briefly tell us how we can help…" />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-full mc-gradient-primary text-white h-12 font-bold text-base shadow-lg hover:-translate-y-0.5 transition-transform disabled:opacity-60">
            {loading ? 'Submitting…' : 'Request Appointment'}
          </button>
          <p className="text-[11px] text-[var(--mc-text-muted)] text-center">By booking you agree to our patient terms. Emergencies: call {data.company.emergency_phone} directly.</p>
        </form>
      </div>
    </section>
  );
}

// ═══ MAP_CONTACT ═══
export function MapContactWidget({ data, variant, title }: WidgetProps) {
  const lat = data.company.company_latitude || data.company.mapLatitude || '-1.2921';
  const lng = data.company.company_longitude || data.company.mapLongitude || '36.8219';
  return (
    <section className="mc-section">
      <div className="mc-container">
        <SectionHead title={title || 'Find Us'} />
        <div className="grid md:grid-cols-3 gap-6 rounded-2xl overflow-hidden border border-[var(--mc-divider)] shadow-lg">
          <div className="p-7 space-y-4">
            <h3 className="font-extrabold text-lg text-[var(--mc-text-primary)]">{data.company.company_name}</h3>
            <p className="flex items-start gap-2.5 text-sm text-[var(--mc-text-secondary)]"><MapPin className="h-4 w-4 mt-0.5 text-[var(--mc-primary)] shrink-0" /> {data.company.company_address}<br />{data.company.company_postal_address}</p>
            <p className="flex items-center gap-2.5 text-sm text-[var(--mc-text-secondary)]"><Phone className="h-4 w-4 text-[var(--mc-primary)] shrink-0" /> {data.company.company_phone}</p>
            <p className="flex items-center gap-2.5 text-sm text-[var(--mc-text-secondary)]"><Mail className="h-4 w-4 text-[var(--mc-primary)] shrink-0" /> {data.company.company_email}</p>
            <p className="flex items-start gap-2.5 text-sm text-[var(--mc-text-secondary)]"><Clock className="h-4 w-4 mt-0.5 text-[var(--mc-primary)] shrink-0" /> {data.company.opening_hours}</p>
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-full mc-gradient-primary text-white px-5 py-2.5 font-bold text-sm">Send us a message <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="md:col-span-2 min-h-72 bg-[var(--mc-bg-card)] relative">
            <iframe title="Map" width="100%" height="100%" className="absolute inset-0 border-0" loading="lazy"
              src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══ FOOTER_NEWSLETTER ═══
export function FooterNewsletterWidget({ data, variant, title }: WidgetProps) {
  const [email, setEmail] = React.useState('');
  return (
    <section className="py-10 bg-[var(--mc-bg-card)] border-t border-[var(--mc-divider)]">
      <div className="mc-container flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="text-center md:text-left">
          <h3 className="font-extrabold text-lg text-[var(--mc-text-primary)]">{title || 'Health tips, straight to your inbox'}</h3>
          <p className="text-sm text-[var(--mc-text-secondary)] mt-1">Monthly notes from our clinicians — no spam, ever.</p>
        </div>
        <form className="flex w-full md:w-auto gap-2" onSubmit={e => { e.preventDefault(); setEmail(''); }}>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email address" className="mc-input flex-1 md:w-72 h-11 px-4" />
          <button className="rounded-full mc-gradient-primary text-white px-6 h-11 font-bold flex items-center gap-1.5"><Send className="h-4 w-4" /> Subscribe</button>
        </form>
      </div>
    </section>
  );
}
