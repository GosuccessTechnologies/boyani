'use client';

/**
 * 14 HOMEPAGE SLIDER / HERO DESIGNS — four distinct visual patterns.
 *
 * ── TYPE A (Designs 1, 2, 3, 10): Transparent frosted box + zoom-in/out animation
 *    Content sits inside a light semi-transparent, flat-bordered backdrop so the
 *    slider image is fully visible behind it. Background zooms in and out on each slide.
 *
 * ── TYPE B (Designs 4, 5, 11, 14): Opaque bottom-fused caption band
 *    Content sits in a solid opaque panel anchored at the centre-bottom that
 *    visually merges with the first homepage section below it. Image plays left→right.
 *
 * ── TYPE C (Designs 6, 7): Hero background + framed image right
 *    Full hero background gradient panel left (title, description, CTA) + the
 *    slider image displayed on the right inside a premium decorative frame.
 *
 * ── TYPE D (Designs 8, 9, 13): Diagonal split
 *    Hero divided diagonally (clip-path). Left half: deep concentrated gradient +
 *    content. Right half: full slider image. Diagonal line is the separator.
 */

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CalendarCheck, ArrowRight } from 'lucide-react';

export interface SlideData {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  backgroundUrl?: string | null;
  overlayColor?: string | null;
  overlayOpacity?: number | null;
  ctaPrimaryText?: string | null;
  ctaPrimaryUrl?: string | null;
  ctaSecondaryText?: string | null;
  ctaSecondaryUrl?: string | null;
  designId?: number;
  rotateDelayMs?: number;
  autoRotate?: boolean;
}

export interface SliderProps {
  slides: SlideData[];
  designId?: number;
  height?: string;
}

/**
 * Shared slider logic (Instruction 4 hardening):
 *  · Index is CLAMPED when the slide list shrinks (e.g. an admin deactivates a
 *    slide while the tab is open) so `slides[index]` can never be undefined.
 *  · Manual navigation (dots / arrows / cards) RESETS the auto-advance timer
 *    so the freshly-selected slide plays its full duration instead of being
 *    cut short by the old countdown.
 *  · Per-slide DB settings are honoured: `autoRotate:false` on any slide
 *    switches the slider to manual-only; `rotateDelayMs` (>= 1.5s) of the
 *    CURRENT slide overrides the default delay.
 */
function useSliderLogic(slides: SlideData[], delay = 6500) {
  const [rawIndex, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [cycle, setCycle] = React.useState(0); // bumped on manual nav → timer restart

  const index = slides.length ? Math.min(rawIndex, slides.length - 1) : 0;
  const current = slides[index];

  const manualOnly = slides.some(s => s.autoRotate === false);

  React.useEffect(() => {
    if (paused || manualOnly || slides.length <= 1) return;
    const perSlide = typeof current?.rotateDelayMs === 'number' && current.rotateDelayMs >= 1500
      ? current.rotateDelayMs
      : delay;
    const t = setInterval(() => setIndex(i => (i + 1) % slides.length), perSlide);
    return () => clearInterval(t);
  }, [paused, manualOnly, slides.length, current?.rotateDelayMs, delay, cycle, index]);

  /** Navigate manually — wraps around and restarts the auto-advance timer. */
  const goTo = React.useCallback((i: number) => {
    const len = slides.length;
    if (!len) return;
    setIndex(((i % len) + len) % len);
    setCycle(c => c + 1);
  }, [slides.length]);

  return { index, setIndex: goTo, paused, setPaused };
}

const bgOf = (slide: SlideData) => slide.backgroundUrl || slide.imageUrl || '';

/** Frosted-glass boxed content — TYPE A */
const FrostedContent = ({ slide }: { slide: SlideData }) => (
  <div className="inline-block max-w-xl backdrop-blur-sm bg-white/10 border border-white/30 rounded-none p-6 md:p-8 shadow-lg">
    {slide.subtitle && (
      <p className="text-[var(--mc-secondary)] font-bold uppercase tracking-widest text-xs mb-3 drop-shadow">
        {slide.subtitle}
      </p>
    )}
    <h1 className="text-2xl md:text-4xl font-extrabold leading-tight mb-3 text-white drop-shadow-lg">
      {slide.title}
    </h1>
    {slide.description && (
      <p className="text-white/90 text-sm md:text-base max-w-md mb-5 leading-relaxed">
        {slide.description}
      </p>
    )}
    <div className="flex flex-wrap gap-3">
      {slide.ctaPrimaryText && (
        <Link
          href={slide.ctaPrimaryUrl || '/booking'}
          className="inline-flex items-center gap-2 bg-[var(--mc-primary)] hover:bg-[var(--mc-primary-dark)] text-white px-5 py-2.5 font-bold shadow-lg transition-transform hover:-translate-y-0.5 text-sm border border-white/20"
        >
          <CalendarCheck className="h-4 w-4" /> {slide.ctaPrimaryText}
        </Link>
      )}
      {slide.ctaSecondaryText && (
        <Link
          href={slide.ctaSecondaryUrl || '/services'}
          className="inline-flex items-center gap-2 border border-white/60 hover:bg-white hover:text-[var(--mc-primary)] text-white px-5 py-2.5 font-bold transition-colors text-sm backdrop-blur-sm bg-white/5"
        >
          {slide.ctaSecondaryText} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  </div>
);

/** Opaque bottom-band content — TYPE B */
const BottomBandContent = ({ slide }: { slide: SlideData }) => (
  <div className="mc-container">
    <div className="max-w-2xl">
      {slide.subtitle && (
        <p className="text-[var(--mc-secondary)] font-bold uppercase tracking-widest text-xs mb-2">
          {slide.subtitle}
        </p>
      )}
      <h1 className="text-2xl md:text-4xl font-extrabold leading-tight text-white mb-2 drop-shadow-lg">
        {slide.title}
      </h1>
      {slide.description && (
        <p className="text-white/80 text-sm md:text-base max-w-xl mb-4 line-clamp-2">
          {slide.description}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {slide.ctaPrimaryText && (
          <Link
            href={slide.ctaPrimaryUrl || '/booking'}
            className="inline-flex items-center gap-2 bg-[var(--mc-primary)] hover:bg-[var(--mc-primary-dark)] text-white px-5 py-2.5 font-bold shadow-lg transition-transform hover:-translate-y-0.5 text-sm"
          >
            <CalendarCheck className="h-4 w-4" /> {slide.ctaPrimaryText}
          </Link>
        )}
        {slide.ctaSecondaryText && (
          <Link
            href={slide.ctaSecondaryUrl || '/services'}
            className="inline-flex items-center gap-2 border-2 border-white/60 hover:bg-white hover:text-[var(--mc-primary)] text-white px-5 py-2.5 font-bold transition-colors text-sm"
          >
            {slide.ctaSecondaryText}
          </Link>
        )}
      </div>
    </div>
  </div>
);

/** Left-panel content — TYPE C & D */
const PanelContent = ({ slide, light = false }: { slide: SlideData; light?: boolean }) => (
  <div key={slide.id} style={{ animation: 'mc-fade-up 0.65s ease-out both' }}>
    {slide.subtitle && (
      <p className={`font-bold uppercase tracking-widest text-xs mb-3 ${light ? 'text-[var(--mc-secondary)]' : 'text-white/70'}`}>
        {slide.subtitle}
      </p>
    )}
    <h1 className="text-2xl md:text-4xl font-extrabold leading-tight mb-4 text-white">
      {slide.title}
    </h1>
    {slide.description && (
      <p className="text-white/75 text-sm md:text-base max-w-md mb-6 leading-relaxed line-clamp-4">
        {slide.description}
      </p>
    )}
    <div className="flex flex-wrap gap-3">
      {slide.ctaPrimaryText && (
        <Link
          href={slide.ctaPrimaryUrl || '/booking'}
          className="inline-flex items-center gap-2 bg-[var(--mc-primary)] hover:bg-[var(--mc-primary-dark)] text-white px-5 py-2.5 font-bold shadow-lg transition-transform hover:-translate-y-0.5 text-sm"
        >
          <CalendarCheck className="h-4 w-4" /> {slide.ctaPrimaryText}
        </Link>
      )}
      {slide.ctaSecondaryText && (
        <Link
          href={slide.ctaSecondaryUrl || '/services'}
          className="inline-flex items-center gap-2 border-2 border-white/50 hover:bg-white hover:text-[var(--mc-primary)] text-white px-5 py-2.5 font-bold transition-colors text-sm"
        >
          {slide.ctaSecondaryText}
        </Link>
      )}
    </div>
  </div>
);

const Dots = ({
  slides, index, setIndex, variant = 'default',
}: {
  slides: SlideData[]; index: number; setIndex: (i: number) => void; variant?: 'default' | 'bar';
}) => (
  <div className="flex items-center gap-2">
    {slides.map((s, i) => (
      <button
        key={s.id} onClick={() => setIndex(i)} aria-label={`Slide ${i + 1}`}
        className={variant === 'bar'
          ? `h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-10 bg-[var(--mc-secondary)]' : 'w-4 bg-white/35 hover:bg-white/60'}`
          : `h-2 rounded-full transition-all ${i === index ? 'w-8 bg-[var(--mc-primary)]' : 'w-2 bg-white/50 hover:bg-white'}`}
      />
    ))}
  </div>
);

const CenteredDots = ({ slides, index, setIndex }: { slides: SlideData[]; index: number; setIndex: (i: number) => void }) => (
  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
    <Dots slides={slides} index={index} setIndex={setIndex} />
  </div>
);

const Arrows = ({ index, setIndex, count }: { index: number; setIndex: (i: number) => void; count: number }) => (
  <>
    <button
      onClick={() => setIndex((index - 1 + count) % count)} aria-label="Previous slide"
      className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur text-white flex items-center justify-center transition-colors"
    >
      <ChevronLeft className="h-6 w-6" />
    </button>
    <button
      onClick={() => setIndex((index + 1) % count)} aria-label="Next slide"
      className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur text-white flex items-center justify-center transition-colors"
    >
      <ChevronRight className="h-6 w-6" />
    </button>
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// TYPE A — Transparent frosted box + zoom-in/out per slide
// ─────────────────────────────────────────────────────────────────────────────

// ═══ 1: Fade + zoom + frosted box ═══
export function SliderDesign1({ slides, height = '580px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  if (!slides.length) return null;
  return (
    <div
      className="relative overflow-hidden"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes mc-zoom-in  { from { transform: scale(1);    } to { transform: scale(1.12); } }
        @keyframes mc-zoom-out { from { transform: scale(1.12); } to { transform: scale(1);    } }
        @keyframes mc-fade-up  { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {/* Stacked background images — zoom-in on entry, zoom-out on active */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${i === index ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          style={{
            backgroundImage: `url(${bgOf(s)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            animation: i === index ? 'mc-zoom-in 9s ease-out forwards' : 'none',
          }}
        />
      ))}
      {/* Dark overlay */}
      <div className="absolute inset-0 z-10 bg-black/40" aria-hidden />
      {/* Frosted content box */}
      <div className="relative z-20 h-full mc-container flex items-center">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`transition-all duration-700 ${i === index ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute pointer-events-none'}`}
            style={i === index ? { animation: 'mc-fade-up 0.7s ease-out both' } : {}}
          >
            <FrostedContent slide={s} />
          </div>
        ))}
      </div>
      <CenteredDots slides={slides} index={index} setIndex={setIndex} />
      {slides.length > 1 && <Arrows index={index} setIndex={setIndex} count={slides.length} />}
    </div>
  );
}

// ═══ 2: Left-to-right slide + frosted box ═══
export function SliderDesign2({ slides, height = '580px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  if (!slides.length) return null;
  return (
    <div
      className="relative overflow-hidden"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes mc-zoom-in { from { transform: scale(1); } to { transform: scale(1.1); } }
        @keyframes mc-fade-up { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {/* Sliding track — images slide left-to-right */}
      <div
        className="flex h-full transition-transform ease-in-out"
        style={{ transform: `translateX(-${index * 100}%)`, transitionDuration: '800ms' }}
      >
        {slides.map(s => (
          <div
            key={s.id}
            className="w-full h-full shrink-0 relative"
            style={{
              backgroundImage: `url(${bgOf(s)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              animation: 'mc-zoom-in 9s ease-out forwards',
            }}
          >
            <div className="absolute inset-0 bg-black/40" aria-hidden />
          </div>
        ))}
      </div>
      {/* Frosted content — rendered over the track */}
      <div className="absolute inset-0 z-10 h-full mc-container flex items-center">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`transition-all ${i === index ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6 absolute pointer-events-none'}`}
            style={i === index ? { animation: 'mc-fade-up 0.65s ease-out both' } : {}}
          >
            <FrostedContent slide={s} />
          </div>
        ))}
      </div>
      <CenteredDots slides={slides} index={index} setIndex={setIndex} />
      {slides.length > 1 && <Arrows index={index} setIndex={setIndex} count={slides.length} />}
    </div>
  );
}

// ═══ 3: Ken Burns zoom-in/out + frosted box ═══
export function SliderDesign3({ slides, height = '600px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  if (!slides.length) return null;
  return (
    <div
      className="relative overflow-hidden"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes mc-kenburns-in  { 0% { transform:scale(1);    } 100% { transform:scale(1.14); } }
        @keyframes mc-kenburns-out { 0% { transform:scale(1.14); } 100% { transform:scale(1);    } }
        @keyframes mc-fade-up { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${i === index ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          style={{
            backgroundImage: `url(${bgOf(s)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            animation: i === index
              ? `mc-kenburns-in 8s ease-out forwards`
              : `mc-kenburns-out 1s ease-in forwards`,
          }}
        />
      ))}
      <div className="absolute inset-0 z-10 bg-black/35" aria-hidden />
      <div className="relative z-20 h-full mc-container flex items-center">
        {slides.map((s, i) => i === index && (
          <div key={s.id} style={{ animation: 'mc-fade-up 0.7s ease-out both' }}>
            <FrostedContent slide={s} />
          </div>
        ))}
      </div>
      <CenteredDots slides={slides} index={index} setIndex={setIndex} />
      {slides.length > 1 && <Arrows index={index} setIndex={setIndex} count={slides.length} />}
    </div>
  );
}

// ═══ 10: Blur + zoom + frosted box ═══
export function SliderDesign10({ slides, height = '580px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  if (!slides.length) return null;
  return (
    <div
      className="relative overflow-hidden"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes mc-zoom-in { from { transform:scale(1); } to { transform:scale(1.11); } }
        @keyframes mc-fade-up { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
      {slides.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${bgOf(s)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: i === index ? 'blur(0px) brightness(0.88)' : 'blur(16px) brightness(0.6)',
            opacity: i === index ? 1 : 0.3,
            transform: i === index ? 'scale(1)' : 'scale(1.1)',
            transition: 'filter 1.1s, opacity 1.1s, transform 1.1s',
            zIndex: i === index ? 10 : 5,
            animation: i === index ? 'mc-zoom-in 9s ease-out forwards' : 'none',
          }}
        />
      ))}
      <div className="absolute inset-0 z-10 bg-black/30" aria-hidden />
      <div className="relative z-20 h-full mc-container flex items-center">
        {slides.map((s, i) => i === index && (
          <div key={s.id} style={{ animation: 'mc-fade-up 0.7s ease-out both' }}>
            <FrostedContent slide={s} />
          </div>
        ))}
      </div>
      <CenteredDots slides={slides} index={index} setIndex={setIndex} />
      {slides.length > 1 && <Arrows index={index} setIndex={setIndex} count={slides.length} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE B — Opaque bottom-fused caption band, image plays left → right
// ─────────────────────────────────────────────────────────────────────────────

// ═══ 4: Left-to-right + opaque centre-bottom band ═══
export function SliderDesign4({ slides, height = '580px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  if (!slides.length) return null;
  const slide = slides[index];
  if (!slide) return null;
  return (
    <div
      className="relative overflow-hidden"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`@keyframes mc-fade-up { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }`}</style>
      {/* Slides slide left-to-right */}
      <div
        className="flex h-full"
        style={{ transform: `translateX(-${index * 100}%)`, transition: 'transform 0.85s cubic-bezier(0.77,0,0.175,1)' }}
      >
        {slides.map(s => (
          <div
            key={s.id}
            className="w-full h-full shrink-0"
            style={{ backgroundImage: `url(${bgOf(s)})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        ))}
      </div>
      {/* Opaque bottom band — fused to page below */}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-[var(--mc-bg-sidebar)]">
        <div className="py-5 px-4" key={slide.id} style={{ animation: 'mc-fade-up 0.65s ease-out both' }}>
          <BottomBandContent slide={slide} />
        </div>
        {/* Progress bar + dots row */}
        <div className="px-4 pb-3 flex items-center gap-4">
          <Dots slides={slides} index={index} setIndex={setIndex} variant="bar" />
          <div className="flex-1 h-px bg-white/15" />
          <span className="text-white/40 text-[11px] tabular-nums">{index + 1}/{slides.length}</span>
        </div>
      </div>
      {slides.length > 1 && <Arrows index={index} setIndex={setIndex} count={slides.length} />}
    </div>
  );
}

// ═══ 5: Split-text + opaque centre-bottom band ═══
export function SliderDesign5({ slides, height = '580px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  if (!slides.length) return null;
  const slide = slides[index];
  if (!slide) return null;
  return (
    <div
      className="relative overflow-hidden"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes mc-slide-in-word { from { opacity:0; transform:translateX(-28px); } to { opacity:1; transform:translateX(0); } }
        @keyframes mc-fade-up       { from { opacity:0; transform:translateY(18px);  } to { opacity:1; transform:translateY(0);  } }
      `}</style>
      {/* Background images fade */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-800 ${i === index ? 'opacity-100' : 'opacity-0'}`}
          style={{ backgroundImage: `url(${bgOf(s)})`, backgroundSize: 'cover', backgroundPosition: 'center', transitionDuration: '800ms' }}
        />
      ))}
      {/* Opaque bottom band with word-by-word heading */}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-[var(--mc-bg-sidebar)]">
        <div className="py-5 px-4">
          <div className="mc-container">
            {slide.subtitle && (
              <p className="text-[var(--mc-secondary)] font-bold uppercase tracking-widest text-xs mb-2">
                {slide.subtitle}
              </p>
            )}
            <h1 className="text-2xl md:text-4xl font-extrabold leading-tight text-white mb-2">
              {slide.title.split(' ').map((word, wi) => (
                <span
                  key={`${slide.id}-${wi}`}
                  className="inline-block mr-2 mb-1"
                  style={{ animation: `mc-slide-in-word 0.45s ease-out ${wi * 0.08}s both` }}
                >
                  {word}
                </span>
              ))}
            </h1>
            <p className="text-white/75 text-sm max-w-xl mb-3 line-clamp-1" style={{ animation: 'mc-fade-up 0.5s ease-out 0.4s both' }}>
              {slide.description}
            </p>
            <div className="flex flex-wrap gap-3" style={{ animation: 'mc-fade-up 0.5s ease-out 0.55s both' }}>
              {slide.ctaPrimaryText && (
                <Link href={slide.ctaPrimaryUrl || '/booking'} className="inline-flex items-center gap-2 bg-[var(--mc-primary)] hover:bg-[var(--mc-primary-dark)] text-white px-5 py-2 font-bold shadow-lg text-sm">
                  <CalendarCheck className="h-3.5 w-3.5" /> {slide.ctaPrimaryText}
                </Link>
              )}
              {slide.ctaSecondaryText && (
                <Link href={slide.ctaSecondaryUrl || '/services'} className="inline-flex items-center gap-2 border-2 border-white/50 hover:bg-white hover:text-[var(--mc-primary)] text-white px-5 py-2 font-bold text-sm">
                  {slide.ctaSecondaryText}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="px-4 pb-3 mc-container flex items-center gap-4">
          <Dots slides={slides} index={index} setIndex={setIndex} variant="bar" />
        </div>
      </div>
      {slides.length > 1 && <Arrows index={index} setIndex={setIndex} count={slides.length} />}
    </div>
  );
}

// ═══ 11: Fade + opaque bottom band fused to page ═══
export function SliderDesign11({ slides, height = '580px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  if (!slides.length) return null;
  return (
    <div
      className="relative overflow-hidden"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`@keyframes mc-fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${i === index ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          style={{ backgroundImage: `url(${bgOf(s)})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      ))}
      {/* Wide opaque centre-bottom panel — fuses with page below */}
      <div className="absolute inset-x-0 bottom-0 z-20">
        <div
          className="bg-gradient-to-r from-[var(--mc-primary-dark)] via-[var(--mc-primary)] to-[var(--mc-primary-dark)] py-6 px-4 shadow-2xl"
          key={slides[index]?.id}
          style={{ animation: 'mc-fade-up 0.65s ease-out both' }}
        >
          <div className="mc-container flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 min-w-0">
              {slides[index]?.subtitle && (
                <p className="text-white/70 font-bold uppercase tracking-widest text-[10px] mb-1">
                  {slides[index].subtitle}
                </p>
              )}
              <h1 className="text-xl md:text-3xl font-extrabold text-white leading-tight">
                {slides[index]?.title}
              </h1>
              {slides[index]?.description && (
                <p className="text-white/75 text-sm mt-1 line-clamp-1">{slides[index].description}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              {slides[index]?.ctaPrimaryText && (
                <Link
                  href={slides[index].ctaPrimaryUrl || '/booking'}
                  className="inline-flex items-center gap-2 bg-white text-[var(--mc-primary-dark)] hover:bg-[var(--mc-secondary)] hover:text-white px-5 py-2.5 font-bold shadow-lg text-sm transition-colors"
                >
                  <CalendarCheck className="h-4 w-4" /> {slides[index].ctaPrimaryText}
                </Link>
              )}
              {slides[index]?.ctaSecondaryText && (
                <Link
                  href={slides[index].ctaSecondaryUrl || '/services'}
                  className="inline-flex items-center gap-2 border-2 border-white/60 hover:bg-white hover:text-[var(--mc-primary)] text-white px-5 py-2.5 font-bold text-sm transition-colors"
                >
                  {slides[index].ctaSecondaryText}
                </Link>
              )}
            </div>
          </div>
          <div className="mc-container mt-3 flex items-center gap-4">
            <Dots slides={slides} index={index} setIndex={setIndex} variant="bar" />
          </div>
        </div>
      </div>
      {slides.length > 1 && <Arrows index={index} setIndex={setIndex} count={slides.length} />}
    </div>
  );
}

// ═══ 14: Full-bleed image + opaque bottom caption band ═══
export function SliderDesign14({ slides, height = '600px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  if (!slides.length) return null;
  const slide = slides[index];
  if (!slide) return null;
  return (
    <div
      className="relative overflow-hidden"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes mc-zoom-in { from { transform:scale(1); } to { transform:scale(1.09); } }
        @keyframes mc-fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${i === index ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          style={{
            backgroundImage: `url(${bgOf(s)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            animation: i === index ? 'mc-zoom-in 9s ease-out forwards' : 'none',
          }}
        />
      ))}
      {/* Gradient vignette into the opaque bottom band */}
      <div className="absolute inset-x-0 bottom-0 z-20">
        <div className="h-20 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
        <div className="bg-black/90 backdrop-blur-sm py-5 px-4">
          <div
            className="mc-container"
            key={slide.id}
            style={{ animation: 'mc-fade-up 0.65s ease-out both' }}
          >
            <BottomBandContent slide={slide} />
            <div className="mt-3 flex items-center gap-4">
              <Dots slides={slides} index={index} setIndex={setIndex} variant="bar" />
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/30 text-[11px]">{index + 1} / {slides.length}</span>
            </div>
          </div>
        </div>
      </div>
      {slides.length > 1 && <Arrows index={index} setIndex={setIndex} count={slides.length} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE C — Full hero background + framed image on the right
// ─────────────────────────────────────────────────────────────────────────────

// ═══ 6: Hero bg + content left + framed image right ═══
export function SliderDesign6({ slides, height = '580px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  if (!slides.length) return null;
  return (
    <div
      className="relative overflow-hidden"
      style={{ height, background: 'linear-gradient(135deg, var(--mc-primary-dark) 0%, var(--mc-primary) 60%, var(--mc-tertiary, #0891b2) 100%)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes mc-fade-up   { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes mc-img-enter { from { opacity:0; transform:scale(0.96) translateX(20px); } to { opacity:1; transform:scale(1) translateX(0); } }
      `}</style>
      {/* Decorative abstract blobs */}
      <span aria-hidden className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      <span aria-hidden className="absolute bottom-0 right-1/3 h-48 w-96 rounded-full bg-black/10 blur-3xl pointer-events-none" />
      {/* Layout: left content + right framed image */}
      <div className="relative z-10 h-full mc-container flex flex-col md:flex-row items-center gap-8 py-8">
        {/* Left: text content */}
        <div className="flex-1 min-w-0 text-white">
          {slides.map((s, i) => i === index && (
            <PanelContent key={s.id} slide={s} />
          ))}
          <div className="mt-6 flex items-center gap-3">
            <Dots slides={slides} index={index} setIndex={setIndex} variant="bar" />
          </div>
        </div>
        {/* Right: decorative frame with sliding image */}
        <div className="shrink-0 w-full md:w-[44%] relative hidden md:block" style={{ height: '80%' }}>
          {/* Outer decorative frame */}
          <div className="absolute inset-0 border-2 border-white/20 rounded-2xl translate-x-3 translate-y-3" aria-hidden />
          <div className="absolute inset-0 border border-[var(--mc-secondary)]/40 rounded-2xl -translate-x-1 -translate-y-1" aria-hidden />
          {/* Image container */}
          <div className="relative h-full rounded-2xl overflow-hidden shadow-2xl border border-white/15">
            {slides.map((s, i) => (
              <div
                key={s.id}
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${bgOf(s)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: i === index ? 1 : 0,
                  transition: 'opacity 0.9s ease',
                  animation: i === index ? 'mc-img-enter 0.9s ease-out both' : 'none',
                }}
              />
            ))}
            {/* Subtle inner glow/border */}
            <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.3)]" aria-hidden />
          </div>
          {/* Corner accent dots */}
          <span aria-hidden className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full bg-[var(--mc-secondary)]" />
          <span aria-hidden className="absolute -top-2 -left-2 h-3 w-3 rounded-full bg-white/40" />
        </div>
      </div>
      {slides.length > 1 && <Arrows index={index} setIndex={setIndex} count={slides.length} />}
    </div>
  );
}

// ═══ 7: Parallax bg + content left + framed image right ═══
export function SliderDesign7({ slides, height = '600px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  const [offset, setOffset] = React.useState(0);
  React.useEffect(() => {
    const onScroll = () => setOffset(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!slides.length) return null;
  return (
    <div
      className="relative overflow-hidden"
      style={{ height, background: 'linear-gradient(150deg, #0f172a 0%, var(--mc-primary-dark) 45%, var(--mc-primary) 100%)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes mc-fade-up   { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes mc-img-enter { from { opacity:0; transform:scale(0.97) translateX(16px); } to { opacity:1; transform:scale(1) translateX(0); } }
      `}</style>
      {/* Background particle-like decorations that parallax on scroll */}
      <span aria-hidden className="absolute top-0 left-0 w-full h-full opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, var(--mc-secondary) 0, transparent 40%), radial-gradient(circle at 80% 20%, var(--mc-primary) 0, transparent 40%)', transform: `translateY(${offset * 0.08}px)` }} />
      <div className="relative z-10 h-full mc-container flex flex-col md:flex-row items-center gap-8 py-8">
        {/* Left: content shifts slightly with parallax */}
        <div className="flex-1 min-w-0 text-white" style={{ transform: `translateY(${offset * -0.06}px)` }}>
          {slides.map((s, i) => i === index && <PanelContent key={s.id} slide={s} />)}
          <div className="mt-6 flex items-center gap-3">
            <Dots slides={slides} index={index} setIndex={setIndex} variant="bar" />
          </div>
        </div>
        {/* Right: framed image with parallax drift */}
        <div
          className="shrink-0 w-full md:w-[44%] relative hidden md:block"
          style={{ height: '78%', transform: `translateY(${offset * 0.05}px)` }}
        >
          <div className="absolute inset-0 border-2 border-white/15 rounded-3xl translate-x-4 translate-y-4" aria-hidden />
          <div className="absolute inset-0 border border-[var(--mc-secondary)]/30 rounded-3xl -translate-x-2 -translate-y-2" aria-hidden />
          <div className="relative h-full rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.5)] border border-white/10">
            {slides.map((s, i) => (
              <div
                key={s.id}
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${bgOf(s)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: `center ${offset * 0.12}px`,
                  opacity: i === index ? 1 : 0,
                  transition: 'opacity 1s ease',
                  animation: i === index ? 'mc-img-enter 1s ease-out both' : 'none',
                }}
              />
            ))}
            <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.25)]" aria-hidden />
          </div>
          <span aria-hidden className="absolute -bottom-3 -right-3 h-5 w-5 rounded-full bg-[var(--mc-secondary)]" />
          <span aria-hidden className="absolute -top-3 right-8 h-2.5 w-2.5 rounded-full bg-white/50" />
          <span aria-hidden className="absolute top-8 -left-3 h-3 w-3 rounded-full bg-[var(--mc-primary)]/60" />
        </div>
      </div>
      {slides.length > 1 && <Arrows index={index} setIndex={setIndex} count={slides.length} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE D — Diagonal split: deep gradient left / full-bleed image right
// ─────────────────────────────────────────────────────────────────────────────

// ═══ 8: Typewriter + diagonal split ═══
export function SliderDesign8({ slides, height = '580px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  const [typed, setTyped] = React.useState('');
  const slide = slides[index];
  React.useEffect(() => {
    if (!slide) return;
    setTyped('');
    let i = 0;
    const t = setInterval(() => {
      i++;
      setTyped(slide.title.slice(0, i));
      if (i >= slide.title.length) clearInterval(t);
    }, 42);
    return () => clearInterval(t);
  }, [slide]);
  if (!slides.length || !slide) return null;
  return (
    <div
      className="relative overflow-hidden flex"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`@keyframes mc-fade-up { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Left panel — deep gradient, clipped diagonally on right edge */}
      <div
        className="relative z-20 flex flex-col justify-center px-8 md:px-14 py-10 shrink-0"
        style={{
          width: '52%',
          background: 'linear-gradient(160deg, #0f172a 0%, var(--mc-primary-dark) 50%, #0f172a 100%)',
          clipPath: 'polygon(0 0, 100% 0, 88% 100%, 0 100%)',
        }}
      >
        <span aria-hidden className="absolute top-0 right-0 h-48 w-48 rounded-full bg-[var(--mc-primary)]/20 blur-2xl pointer-events-none" />
        <span aria-hidden className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-[var(--mc-secondary)]/10 blur-2xl pointer-events-none" />
        {slide?.subtitle && (
          <p className="text-[var(--mc-secondary)] font-bold uppercase tracking-widest text-xs mb-3 relative z-10">
            {slide.subtitle}
          </p>
        )}
        <h1 className="text-2xl md:text-4xl font-extrabold text-white leading-tight mb-4 min-h-[1.3em] relative z-10">
          {typed}<span className="animate-pulse opacity-70">|</span>
        </h1>
        <p className="text-white/70 text-sm max-w-xs mb-6 relative z-10" style={{ animation: 'mc-fade-up 0.6s 0.3s both' }}>
          {slide?.description}
        </p>
        <div className="flex flex-wrap gap-3 relative z-10" style={{ animation: 'mc-fade-up 0.6s 0.5s both' }}>
          {slide?.ctaPrimaryText && (
            <Link href={slide.ctaPrimaryUrl || '/booking'} className="inline-flex items-center gap-2 bg-[var(--mc-primary)] hover:bg-[var(--mc-primary-dark)] text-white px-5 py-2.5 font-bold shadow-lg text-sm">
              <CalendarCheck className="h-4 w-4" /> {slide.ctaPrimaryText}
            </Link>
          )}
          {slide?.ctaSecondaryText && (
            <Link href={slide.ctaSecondaryUrl || '/services'} className="inline-flex items-center gap-2 border border-white/40 hover:bg-white/10 text-white px-5 py-2.5 font-bold text-sm">
              {slide.ctaSecondaryText}
            </Link>
          )}
        </div>
        <div className="mt-6 relative z-10">
          <Dots slides={slides} index={index} setIndex={setIndex} variant="bar" />
        </div>
      </div>

      {/* Right panel — full-bleed sliding images */}
      <div className="flex-1 relative overflow-hidden" style={{ marginLeft: '-6%' }}>
        <div
          className="flex h-full"
          style={{ transform: `translateX(-${index * 100}%)`, transition: 'transform 0.85s cubic-bezier(0.77,0,0.175,1)' }}
        >
          {slides.map(s => (
            <div
              key={s.id}
              className="w-full h-full shrink-0"
              style={{ backgroundImage: `url(${bgOf(s)})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          ))}
        </div>
        {/* Left-edge gradient to blend with the content panel */}
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[var(--mc-primary-dark)]/60 to-transparent pointer-events-none" aria-hidden />
      </div>
    </div>
  );
}

// ═══ 9: Flip + diagonal split ═══
export function SliderDesign9({ slides, height = '580px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  if (!slides.length) return null;
  return (
    <div
      className="relative overflow-hidden flex"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`@keyframes mc-fade-up { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Left diagonal panel — concentrated deep gradient */}
      <div
        className="relative z-20 flex flex-col justify-center px-8 md:px-14 py-10 shrink-0"
        style={{
          width: '50%',
          background: 'linear-gradient(145deg, #1e1b4b 0%, var(--mc-primary-dark) 40%, #312e81 100%)',
          clipPath: 'polygon(0 0, 100% 0, 86% 100%, 0 100%)',
        }}
      >
        <span aria-hidden className="absolute -top-10 right-10 h-52 w-52 rounded-full bg-[var(--mc-primary)]/25 blur-3xl pointer-events-none" />
        {slides.map((s, i) => i === index && (
          <div key={s.id} className="relative z-10" style={{ animation: 'mc-fade-up 0.65s ease-out both' }}>
            {s.subtitle && (
              <p className="text-[var(--mc-secondary)] font-bold uppercase tracking-widest text-xs mb-3">{s.subtitle}</p>
            )}
            <h1 className="text-2xl md:text-4xl font-extrabold leading-tight text-white mb-4">{s.title}</h1>
            {s.description && (
              <p className="text-white/70 text-sm max-w-xs mb-5 line-clamp-3">{s.description}</p>
            )}
            <div className="flex flex-wrap gap-3">
              {s.ctaPrimaryText && (
                <Link href={s.ctaPrimaryUrl || '/booking'} className="inline-flex items-center gap-2 bg-[var(--mc-primary)] hover:bg-[var(--mc-primary-dark)] text-white px-5 py-2.5 font-bold shadow-lg text-sm">
                  <CalendarCheck className="h-4 w-4" /> {s.ctaPrimaryText}
                </Link>
              )}
              {s.ctaSecondaryText && (
                <Link href={s.ctaSecondaryUrl || '/services'} className="inline-flex items-center gap-2 border border-white/40 hover:bg-white/10 text-white px-5 py-2.5 font-bold text-sm">
                  {s.ctaSecondaryText}
                </Link>
              )}
            </div>
          </div>
        ))}
        <div className="mt-6 relative z-10">
          <Dots slides={slides} index={index} setIndex={setIndex} variant="bar" />
        </div>
      </div>

      {/* Right panel — flip transition on images */}
      <div className="flex-1 relative overflow-hidden" style={{ marginLeft: '-5%', perspective: '1200px' }}>
        {slides.map((s, i) => (
          <div
            key={s.id}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${bgOf(s)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transform: `rotateY(${i === index ? 0 : (i < index ? -90 : 90)}deg)`,
              opacity: i === index ? 1 : 0,
              transition: 'transform 0.9s cubic-bezier(0.4,0,0.2,1), opacity 0.9s',
              zIndex: i === index ? 10 : 0,
            }}
          />
        ))}
        <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#1e1b4b]/70 to-transparent pointer-events-none z-20" aria-hidden />
      </div>
    </div>
  );
}

// ═══ 13: Diagonal split — left content / right image ═══
export function SliderDesign13({ slides, height = '580px' }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides);
  if (!slides.length) return null;
  const slide = slides[index];
  if (!slide) return null;
  return (
    <div
      className="relative overflow-hidden flex"
      style={{ height }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`@keyframes mc-fade-up { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Left — deep teal-to-dark gradient, diagonally clipped */}
      <div
        className="relative z-20 flex flex-col justify-center px-8 md:px-16 py-10 shrink-0"
        style={{
          width: '52%',
          background: 'linear-gradient(155deg, #0f766e 0%, #0d9488 40%, #134e4a 100%)',
          clipPath: 'polygon(0 0, 100% 0, 90% 100%, 0 100%)',
        }}
      >
        {/* Blobs */}
        <span aria-hidden className="absolute -top-14 right-0 h-60 w-60 rounded-full bg-white/8 blur-3xl pointer-events-none" />
        <span aria-hidden className="absolute bottom-10 left-10 h-44 w-44 rounded-full bg-black/15 blur-2xl pointer-events-none" />

        <div key={slide.id} className="relative z-10" style={{ animation: 'mc-fade-up 0.65s ease-out both' }}>
          {slide.subtitle && (
            <p className="text-white/60 font-bold uppercase tracking-widest text-xs mb-3">{slide.subtitle}</p>
          )}
          <h1 className="text-2xl md:text-4xl font-extrabold leading-tight text-white mb-4">{slide.title}</h1>
          {slide.description && (
            <p className="text-white/75 text-sm max-w-sm mb-6 leading-relaxed line-clamp-4">{slide.description}</p>
          )}
          <div className="flex flex-wrap gap-3">
            {slide.ctaPrimaryText && (
              <Link href={slide.ctaPrimaryUrl || '/booking'} className="inline-flex items-center gap-2 bg-white text-[var(--mc-primary-dark)] hover:bg-[var(--mc-secondary)] hover:text-white px-5 py-2.5 font-bold shadow-lg text-sm transition-colors">
                <CalendarCheck className="h-4 w-4" /> {slide.ctaPrimaryText}
              </Link>
            )}
            {slide.ctaSecondaryText && (
              <Link href={slide.ctaSecondaryUrl || '/services'} className="inline-flex items-center gap-2 border-2 border-white/50 hover:bg-white hover:text-[var(--mc-primary)] text-white px-5 py-2.5 font-bold text-sm transition-colors">
                {slide.ctaSecondaryText}
              </Link>
            )}
          </div>
        </div>
        <div className="mt-6 relative z-10">
          <Dots slides={slides} index={index} setIndex={setIndex} variant="bar" />
        </div>
      </div>

      {/* Right — crossfading images */}
      <div className="flex-1 relative overflow-hidden" style={{ marginLeft: '-8%' }}>
        {slides.map((s, i) => (
          <div
            key={s.id}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${bgOf(s)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: i === index ? 1 : 0,
              transition: 'opacity 0.85s ease',
              zIndex: i === index ? 10 : 0,
            }}
          />
        ))}
        <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#134e4a]/80 to-transparent pointer-events-none z-20" aria-hidden />
      </div>

      {slides.length > 1 && <Arrows index={index} setIndex={setIndex} count={slides.length} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Designs 12 — Carousel cards (kept but enhanced)
// ─────────────────────────────────────────────────────────────────────────────

// ═══ 12: Carousel cards — peeking side cards, enhanced ═══
export function SliderDesign12({ slides }: SliderProps) {
  const { index, setIndex, setPaused } = useSliderLogic(slides, 7000);
  if (!slides.length) return null;
  return (
    <div
      className="relative py-10 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, var(--mc-primary-dark) 100%)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`@keyframes mc-fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <div className="mc-container">
        <div className="flex gap-5 items-center justify-center">
          {slides.map((s, i) => {
            const offset = (i - index + slides.length) % slides.length;
            const pos = offset > slides.length / 2 ? offset - slides.length : offset;
            if (Math.abs(pos) > 2) return null;
            const isCenter = pos === 0;
            return (
              /* div (not <button>) so the CTA <Link> inside stays valid HTML —
                 an anchor inside a button breaks hydration (Instruction 4). */
              <div
                key={s.id}
                role="button"
                tabIndex={isCenter ? -1 : 0}
                aria-label={`Show slide ${i + 1}`}
                onClick={() => setIndex(i)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIndex(i); } }}
                className={`relative rounded-2xl overflow-hidden transition-all duration-500 shrink-0 cursor-pointer ${isCenter ? 'w-full md:w-2/3 h-[420px] shadow-2xl z-10' : 'hidden md:block w-1/4 h-60 opacity-50 hover:opacity-80'}`}
                style={{ transform: isCenter ? 'scale(1)' : `scale(0.9) translateX(${pos * -22}px)` }}
              >
                <div
                  className="absolute inset-0"
                  style={{ backgroundImage: `url(${bgOf(s)})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                />
                <div className={`absolute inset-0 ${isCenter ? 'bg-gradient-to-t from-black/80 via-black/25 to-transparent' : 'bg-black/55'}`} />
                {isCenter && (
                  <div className="relative h-full flex flex-col justify-end p-7 text-left text-white" style={{ animation: 'mc-fade-up 0.55s ease-out both' }}>
                    {s.subtitle && (
                      <p className="text-[var(--mc-secondary)] font-bold uppercase tracking-widest text-xs mb-2">{s.subtitle}</p>
                    )}
                    <h2 className="text-2xl md:text-3xl font-extrabold mb-2">{s.title}</h2>
                    <p className="text-sm text-white/80 line-clamp-2 mb-4">{s.description}</p>
                    <div className="flex gap-2">
                      {s.ctaPrimaryText && (
                        <Link
                          href={s.ctaPrimaryUrl || '/booking'}
                          className="inline-flex items-center gap-2 bg-[var(--mc-primary)] hover:bg-[var(--mc-primary-dark)] text-white px-4 py-2 text-sm font-bold transition-colors"
                        >
                          <CalendarCheck className="h-3.5 w-3.5" /> {s.ctaPrimaryText}
                        </Link>
                      )}
                    </div>
                  </div>
                )}
                {!isCenter && (
                  <div className="relative h-full flex items-end p-3 text-white text-sm font-bold drop-shadow line-clamp-2">
                    {s.title}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center mt-5 gap-3">
          <Dots slides={slides} index={index} setIndex={setIndex} variant="bar" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry + Router
// ─────────────────────────────────────────────────────────────────────────────

export const SLIDER_DESIGNS = [
  SliderDesign1,  // TYPE A: fade + zoom + frosted box
  SliderDesign2,  // TYPE A: left-to-right + zoom + frosted box
  SliderDesign3,  // TYPE A: ken burns zoom-in/out + frosted box
  SliderDesign4,  // TYPE B: left-to-right + opaque bottom band
  SliderDesign5,  // TYPE B: split-text + opaque bottom band
  SliderDesign6,  // TYPE C: hero bg + content left + framed image right
  SliderDesign7,  // TYPE C: parallax hero bg + content left + framed image right
  SliderDesign8,  // TYPE D: diagonal split + typewriter left + image right
  SliderDesign9,  // TYPE D: diagonal split + flip image right
  SliderDesign10, // TYPE A: blur+zoom + frosted box
  SliderDesign11, // TYPE B: fade + gradient opaque bottom band
  SliderDesign12, // Carousel cards (enhanced)
  SliderDesign13, // TYPE D: diagonal teal split + crossfade image right
  SliderDesign14, // TYPE B: full-bleed + zoom + opaque bottom band
];

export function SliderRouter({ slides, designId = 1 }: { slides: SlideData[]; designId?: number }) {
  if (!slides?.length) return null;
  const idx = Math.min(Math.max(designId, 1), SLIDER_DESIGNS.length) - 1;
  const Component = SLIDER_DESIGNS[idx];
  return <Component slides={slides} />;
}
