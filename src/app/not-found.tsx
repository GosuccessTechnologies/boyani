import Link from 'next/link';
import { Home } from 'lucide-react';

/** Global not-found for routes outside the (public) group. */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--mc-bg-body)]">
      <div className="text-center">
        <p className="text-6xl font-extrabold mc-text-gradient">404</p>
        <h1 className="text-2xl font-extrabold text-[var(--mc-text-primary)] mt-3">Page not found</h1>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full mc-gradient-primary text-white px-6 py-3 font-bold shadow hover:-translate-y-0.5 transition-transform"
        >
          <Home className="h-4 w-4" /> Back to Homepage
        </Link>
      </div>
    </div>
  );
}
