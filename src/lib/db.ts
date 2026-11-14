/**
 * Boyani Health Dispensary System — Database client
 *
 * Database strategy:
 *  - LOCAL DEVELOPMENT : SQLite via DATABASE_URL (resolved by db-path.ts)
 *  - PRODUCTION (Vercel): Turso (libsql) via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 *
 * When TURSO_DATABASE_URL is set the Prisma libsql adapter is used so the
 * schema (provider = "sqlite") works against Turso without any change.
 */
import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from '@/lib/db-path';

// ── Turso / libsql adapter (production only) ─────────────────────────────────
function createTursoClient(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@libsql/client');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaLibSQL } = require('@prisma/adapter-libsql');
  const libsql = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  const adapter = new PrismaLibSQL(libsql);
  return new PrismaClient({
    adapter,
    log: ['error'],
  } as any);
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createClient(): PrismaClient {
  // Turso takes priority when both env vars are present (Vercel production)
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    return createTursoClient();
  }
  // Local SQLite fallback with absolute path resolution
  return new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const db =
  globalForPrisma.prisma || createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
