/**
 * Shared API utilities for Boyani Health Dispensary routes
 */
import { db } from '@/lib/db';

/** Read all company config as a camelCase + snake_case map (pattern from hills.zip) */
export async function getCompanyConfig(): Promise<Record<string, string>> {
  const configs = await db.companyConfig.findMany();
  const company: Record<string, string> = {};
  for (const c of configs) {
    company[c.key] = c.value;
    const camel = c.key.split('_').map((s, i) => (i === 0 ? s : s[0].toUpperCase() + s.slice(1))).join('');
    if (!(camel in company)) company[camel] = c.value;
  }
  return company;
}

export function isTrueFlag(value?: string) {
  return value === 'true' || value === '1';
}

export function getTaxEnabled(config: Record<string, string | undefined>) {
  if (config.tax_enabled !== undefined) return isTrueFlag(config.tax_enabled);
  if (config.enableTax !== undefined) return isTrueFlag(config.enableTax);
  return true;
}

export function getTaxRate(config: Record<string, string | undefined>) {
  return parseFloat(config.tax_rate || config.taxRate || '16') || 16;
}

/** Paginate helper */
export function getPagination(searchParams: URLSearchParams, defaultPerPage = 20) {
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || String(defaultPerPage));
  return { page: Math.max(1, page), perPage: Math.max(1, Math.min(perPage, 200)), skip: (Math.max(1, page) - 1) * Math.min(perPage, 200) };
}

/** Date range filter builder (pattern from hills.zip profit-loss) */
export function getDateFilter(searchParams: URLSearchParams) {
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const specificDate = searchParams.get('specificDate') || '';

  const dateFilter: Record<string, unknown> = {};
  if (specificDate) {
    dateFilter.gte = new Date(specificDate + 'T00:00:00');
    dateFilter.lte = new Date(specificDate + 'T23:59:59');
  } else {
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo + 'T23:59:59');
  }
  return dateFilter;
}

export function money(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
