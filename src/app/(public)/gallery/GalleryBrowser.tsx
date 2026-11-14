'use client';

/**
 * GALLERY BROWSER — album selection + photo grid with hover captions +
 * simple fixed lightbox overlay (click any photo to enlarge).
 */

import * as React from 'react';
import { Images, X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface PublicPhoto {
  id: string;
  title: string;
  imageUrl: string;
  caption: string;
}
export interface PublicAlbum {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImageUrl: string;
  photos: PublicPhoto[];
}

export default function GalleryBrowser({ albums }: { albums: PublicAlbum[] }) {
  const [activeSlug, setActiveSlug] = React.useState('');
  const [lightbox, setLightbox] = React.useState<{ albumIdx: number; photoIdx: number } | null>(null);

  const activeAlbums = activeSlug ? albums.filter(a => a.slug === activeSlug) : albums;

  const nextPhoto = () => setLightbox(l => {
    if (!l) return l;
    const photos = albums[l.albumIdx].photos;
    return { ...l, photoIdx: (l.photoIdx + 1) % photos.length };
  });
  const prevPhoto = () => setLightbox(l => {
    if (!l) return l;
    const photos = albums[l.albumIdx].photos;
    return { ...l, photoIdx: (l.photoIdx - 1 + photos.length) % photos.length };
  });

  if (!albums.length) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--mc-divider)] bg-white p-12 text-center text-[var(--mc-text-secondary)]">
        No photo albums published yet — check back soon.
      </p>
    );
  }

  return (
    <div>
      {/* Album filter chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setActiveSlug('')}
          className={`rounded-full px-4 py-2 text-xs font-bold border transition-colors ${!activeSlug ? 'mc-gradient-primary text-white border-transparent shadow' : 'border-[var(--mc-divider)] bg-white text-[var(--mc-text-secondary)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)]'}`}
        >
          All albums ({albums.reduce((n, a) => n + a.photos.length, 0)} photos)
        </button>
        {albums.map(a => (
          <button
            key={a.slug}
            onClick={() => setActiveSlug(activeSlug === a.slug ? '' : a.slug)}
            className={`rounded-full px-4 py-2 text-xs font-bold border transition-colors ${activeSlug === a.slug ? 'mc-gradient-primary text-white border-transparent shadow' : 'border-[var(--mc-divider)] bg-white text-[var(--mc-text-secondary)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)]'}`}
          >
            {a.title} ({a.photos.length})
          </button>
        ))}
      </div>

      {/* Album sections with photo grids */}
      {activeAlbums.map(album => {
        const albumIdx = albums.findIndex(a => a.id === album.id);
        return (
          <section key={album.id} className="mb-12">
            <div className="flex items-baseline justify-between gap-4 mb-5 flex-wrap">
              <div>
                <h2 className="text-xl font-extrabold text-[var(--mc-text-primary)]">{album.title}</h2>
                {album.description && <p className="text-sm text-[var(--mc-text-secondary)] mt-1">{album.description}</p>}
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--mc-text-muted)]">
                <Images className="h-3.5 w-3.5" /> {album.photos.length} photos
              </span>
            </div>
            {album.photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {album.photos.map((photo, photoIdx) => (
                  <button
                    key={photo.id}
                    onClick={() => setLightbox({ albumIdx, photoIdx })}
                    className="group relative rounded-xl overflow-hidden aspect-square bg-[var(--mc-bg-card)] border border-[var(--mc-divider)]"
                    aria-label={`Open ${photo.title || 'photo'} in lightbox`}
                  >
                    <img
                      src={photo.imageUrl}
                      alt={photo.title || photo.caption || album.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {(photo.title || photo.caption) && (
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent text-white text-left text-xs font-semibold px-3 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {photo.title || photo.caption}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--mc-divider)] bg-white p-8 text-center text-sm text-[var(--mc-text-secondary)]">
                Photos coming soon for this album.
              </p>
            )}
          </section>
        );
      })}

      {/* Simple fixed lightbox overlay */}
      {lightbox && albums[lightbox.albumIdx]?.photos[lightbox.photoIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close viewer"
            className="absolute top-4 right-4 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <X className="h-6 w-6" />
          </button>
          {albums[lightbox.albumIdx].photos.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); prevPhoto(); }}
                aria-label="Previous photo"
                className="absolute left-3 md:left-6 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); nextPhoto(); }}
                aria-label="Next photo"
                className="absolute right-3 md:right-6 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <figure className="max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
            <img
              src={albums[lightbox.albumIdx].photos[lightbox.photoIdx].imageUrl}
              alt={albums[lightbox.albumIdx].photos[lightbox.photoIdx].title || albums[lightbox.albumIdx].title}
              className="max-h-[78vh] max-w-full object-contain rounded-lg mx-auto"
            />
            <figcaption className="text-center text-white/85 text-sm mt-4 font-semibold">
              {albums[lightbox.albumIdx].photos[lightbox.photoIdx].title || albums[lightbox.albumIdx].title}
              {albums[lightbox.albumIdx].photos[lightbox.photoIdx].caption && (
                <span className="block font-normal text-white/60 text-xs mt-1">
                  {albums[lightbox.albumIdx].photos[lightbox.photoIdx].caption}
                </span>
              )}
              <span className="block text-white/40 text-xs mt-1.5">
                {albums[lightbox.albumIdx].title} · {lightbox.photoIdx + 1} / {albums[lightbox.albumIdx].photos.length}
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
