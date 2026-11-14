/**
 * Boyani Health Dispensary — Database URL resolver.
 *
 * WHY THIS EXISTS (Instruction 3 root cause):
 * A relative SQLite URL (`file:./db/custom.db`) is resolved by Prisma against
 * the schema directory at GENERATE time, but under the Next.js 16 server
 * runtime (Turbopack dev chunks / production server started from an arbitrary
 * working directory — exactly the cPanel/Hepsia case) the engine receives a
 * path that does not exist → "Error code 14: Unable to open the database file"
 * on every query → public slug pages fail ("This page couldn't load…") while
 * the homepage silently renders fallback defaults.
 *
 * FIX: resolve the SQLite file to an ABSOLUTE path at runtime, trying a set of
 * well-known roots (cwd + walk-up, module dir + walk-up). The first existing
 * file wins; otherwise the canonical `<cwd>/db/custom.db` location is used and
 * its parent folder is created so a fresh deploy works without manual setup.
 *
 * Shared by `src/lib/db.ts` (app runtime) and `prisma/seed.ts` (CLI seeding)
 * so both ALWAYS agree on the same single database file.
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_RELATIVE = './db/custom.db';

function toFileUrl(absolutePath: string): string {
  return `file:${absolutePath}`;
}

/** Candidate project roots, most-likely first. */
function candidateRoots(): string[] {
  const roots: string[] = [];
  if (typeof process !== 'undefined' && process.cwd) roots.push(process.cwd());
  // Module-relative fallbacks (works under bundlers that define __dirname)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (typeof __dirname === 'string') roots.push(__dirname);
  } catch { /* ESM without __dirname — ignored */ }
  return roots;
}

/**
 * Walk up at most 6 levels from each root collecting candidate locations for
 * the relative DB path (both `<root>/<rel>` and `<root>/prisma/<rel>`).
 */
function collectCandidates(rel: string): string[] {
  const out: string[] = [];
  for (const root of candidateRoots()) {
    let dir: string | undefined = path.resolve(root);
    for (let i = 0; i < 6 && dir; i++) {
      out.push(path.join(dir, rel));
      out.push(path.join(dir, 'prisma', rel));
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return out;
}

let cached: string | null = null;

export function resolveDatabaseUrl(): string {
  if (cached) return cached;

  const raw = (typeof process !== 'undefined' && process.env.DATABASE_URL) || `file:${DEFAULT_RELATIVE}`;
  if (!raw.startsWith('file:')) return raw; // postgres/mysql — pass through untouched

  let p = raw.slice('file:'.length);
  if (p.startsWith('//')) p = p.slice(1); // tolerate file://host/path forms
  // Windows-style absolute path after file: (e.g. file:C:\...) — keep as-is
  if (/^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/') || p.startsWith('\\')) {
    const abs = path.resolve(p);
    // Honour the explicit absolute location when it (or its parent folder)
    // exists; a stale/stray env var pointing at a missing directory falls
    // through to the candidate search below instead of failing to open.
    try {
      if (fs.existsSync(path.dirname(abs))) {
        cached = toFileUrl(abs);
        return cached;
      }
    } catch { /* ignore */ }
  }

  const candidates = collectCandidates(p);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        cached = toFileUrl(c);
        return cached;
      }
    } catch { /* ignore stat errors */ }
  }

  // No existing file found → canonical location under the primary root.
  // `../`-prefixed paths follow Prisma's schema-relative semantics (the CLI
  // resolves them against prisma/), so mirror that here. The parent folder is
  // created so SQLite can create the file on first push.
  const canonical = p.startsWith('..')
    ? path.resolve(process.cwd(), 'prisma', p)
    : path.resolve(process.cwd(), p);
  try {
    fs.mkdirSync(path.dirname(canonical), { recursive: true });
  } catch { /* best effort */ }
  cached = toFileUrl(canonical);
  return cached;
}

/** Human-readable absolute path of the SQLite file (for boot logs). */
export function databaseFilePath(): string {
  const url = resolveDatabaseUrl();
  return url.startsWith('file:') ? url.slice('file:'.length) : url;
}
