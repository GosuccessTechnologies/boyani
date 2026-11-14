'use client';

/**
 * USE COMPANY — client hook exposing the facility's CompanyConfig
 * (name, slogan, contacts, receipt prefix…) so nothing is hardcoded.
 * Cached in-module; refresh() re-fetches.
 */

import { useCallback, useEffect, useState } from 'react';

export interface CompanyData {
  companyName: string;
  companySlogan: string;
  companyPhone: string;
  emergencyPhone: string;
  companyEmail: string;
  companyAddress: string;
  companyCity: string;
  companyCountry: string;
  companyWebsite: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  taxEnabled: boolean;
  receiptPrefix: string;
  receiptFooter: string;
  logoUrl: string;
  themeColor: string;
  openingHours: string;
  facebookUrl: string;
  twitterUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  [key: string]: unknown;
}

export const FALLBACK_COMPANY: CompanyData = {
  companyName: 'Boyani Health Dispensary',
  companySlogan: 'Quality Care, Compassionate Service',
  companyPhone: '0750239057',
  emergencyPhone: '0750239057',
  companyEmail: 'info@africandivinechurch.org',
  companyAddress: 'Boyani, Vihiga County',
  companyCity: 'Vihiga',
  companyCountry: 'Kenya',
  companyWebsite: 'https://www.boyanihealth.africandivinechurch.org',
  currency: 'KES',
  currencySymbol: 'KSh',
  taxRate: 0,
  taxEnabled: false,
  receiptPrefix: 'MNH',
  receiptFooter: 'Thank you for choosing Boyani Health Dispensary. Get well soon!',
  logoUrl: '/logo.svg',
  themeColor: '#0d9488',
  openingHours: 'Mon–Sat 08:00–21:00',
  facebookUrl: '', twitterUrl: '', instagramUrl: '', linkedinUrl: '', youtubeUrl: '',
};

let cache: CompanyData | null = null;
let inflight: Promise<CompanyData> | null = null;

export async function fetchCompany(): Promise<CompanyData> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch('/api/company')
    .then(r => r.json())
    .then((d: { company?: Record<string, unknown> }) => {
      const merged = { ...FALLBACK_COMPANY, ...(d.company || {}) } as CompanyData;
      cache = merged;
      return merged;
    })
    .catch(() => FALLBACK_COMPANY)
    .finally(() => { inflight = null; });
  return inflight;
}

export function useCompany() {
  const [company, setCompany] = useState<CompanyData>(cache || FALLBACK_COMPANY);
  const [loading, setLoading] = useState(!cache);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const c = await fetchCompany();
      setCompany(c);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!cache) refresh(); else setCompany(cache); }, [refresh]);

  return { company, loading, refresh };
}
