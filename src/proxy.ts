import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy (formerly middleware) — stamps x-pathname on every request so server
 * layouts can detect the current route (e.g. to pass isHome to the header).
 * Renamed from middleware.ts to proxy.ts for Next.js 16 compatibility.
 * Runs on all non-static routes; no auth or redirect logic here.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('x-pathname', request.nextUrl.pathname);
  return response;
}

export const config = {
  // Match all routes except static files, images, and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)'],
};
