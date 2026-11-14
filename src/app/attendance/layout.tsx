import type { Metadata, Viewport } from 'next';
import { AttendanceHeader } from './_header';

/**
 * ATTENDANCE PWA LAYOUT — custom minimal mobile-first shell (NOT PortalShell —
 * this is a phone app): max-w-md centered column, no sidebar, bottom
 * safe-area padding. Registers /sw.js when supported.
 */

export const metadata: Metadata = {
  title: 'Attendance',
  description: 'Boyani Health Dispensary staff attendance PWA — GPS-checked check-in and check-out.',
  manifest: '/manifest.json',
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'BoyaniHealth',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d9488',
  viewportFit: 'cover',
};

const SW_REGISTER = [
  "if ('serviceWorker' in navigator) {",
  "  window.addEventListener('load', function () {",
  "    // Scoped to /attendance/ so the SW NEVER intercepts public website",
  "    // or dashboard navigations (root-scope SW broke /news/[slug] etc).",
  "    navigator.serviceWorker.register('/attendance-sw.js', { scope: '/attendance/' }).catch(function () {});",
  "  });",
  "}",
  "// Kill any legacy root-scoped service worker from previous installs",
  "if ('serviceWorker' in navigator) {",
  "  navigator.serviceWorker.getRegistrations().then(function (regs) {",
  "    regs.forEach(function (r) {",
  "      const scope = r.scope || '';",
  "      if (scope.endsWith('/sw.js') === false && scope.replace(/\/$/, '') === location.origin) { r.unregister(); }",
  "    });",
  "  }).catch(function () {});",
  "}",
].join('\n');

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--mc-bg-body)]">
      {/* Register the attendance service worker */}
      <script dangerouslySetInnerHTML={{ __html: SW_REGISTER }} />
      <AttendanceHeader />
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {children}
      </main>
    </div>
  );
}
