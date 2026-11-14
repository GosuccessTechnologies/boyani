import Link from 'next/link';
import { Home, SearchX, Phone } from 'lucide-react';

/**
 * PUBLIC NOT-FOUND — branded 404 for the public website (Instruction 3).
 * Renders inside the (public) layout so header/footer still show.
 */
export default function PublicNotFound() {
  return (
    <section className="mc-section">
      <div className="mc-container text-center max-w-xl">
        <div className="mx-auto h-20 w-20 rounded-3xl bg-[var(--mc-primary-light)] flex items-center justify-center mb-6">
          <SearchX className="h-10 w-10 text-[var(--mc-primary)]" />
        </div>
        <p className="text-6xl font-extrabold mc-text-gradient">404</p>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--mc-text-primary)] mt-3">
          We couldn&apos;t find that page
        </h1>
        <p className="text-[var(--mc-text-secondary)] mt-3">
          The page may have been moved, renamed or is temporarily unavailable.
          Explore our services or contact us and we&apos;ll point you in the right direction.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full mc-gradient-primary text-white px-6 py-3 font-bold shadow hover:-translate-y-0.5 transition-transform"
          >
            <Home className="h-4 w-4" /> Back to Homepage
          </Link>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--mc-divider)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)] px-6 py-3 font-bold transition-colors"
          >
            Browse Services
          </Link>
          <a
            href="tel:0750239057"
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--mc-text-secondary)] hover:text-[var(--mc-primary)]"
          >
            <Phone className="h-4 w-4" /> 0750239057
          </a>
        </div>
      </div>
    </section>
  );
}
