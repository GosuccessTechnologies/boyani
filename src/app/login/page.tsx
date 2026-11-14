'use client';

/**
 * LOGIN PAGE — renders the admin-selected login design (1..6) with
 * dynamic facility branding from /api/company and banner config.
 * Demo credentials removed (Instruction 2).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import { LoginRouter, LoginBrand } from '@/components/auth/LoginDesigns';
import { FALLBACK_COMPANY } from '@/hooks/use-company';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [design, setDesign] = useState(1);
  const [brand, setBrand] = useState<LoginBrand>({
    companyName: FALLBACK_COMPANY.companyName,
    slogan: FALLBACK_COMPANY.companySlogan,
    phone: FALLBACK_COMPANY.companyPhone,
    email: FALLBACK_COMPANY.companyEmail,
    address: FALLBACK_COMPANY.companyAddress,
    city: FALLBACK_COMPANY.companyCity,
    bannerHeading: 'Modern Care for Modern Health',
    bannerSubheading: 'Sign in to access your staff portal',
    bannerImage: '',
    bannerShow: true,
    logoUrl: '',
  });
  const setAuth = useAuthStore(s => s.setAuth);

  useEffect(() => {
    // Fetch site settings (login design) + company config (branding/banner)
    Promise.all([
      fetch('/api/site-settings').then(r => r.json()).catch(() => ({})),
      fetch('/api/company').then(r => r.json()).catch(() => ({})),
    ]).then(([settings, companyRes]) => {
      const c = companyRes.company || {};
      const cfg = (k: string, d: string) => {
        const v = c[k];
        return typeof v === 'string' && v ? v : d;
      };
      const newBrand: LoginBrand = {
        companyName: cfg('companyName', FALLBACK_COMPANY.companyName),
        slogan: cfg('companySlogan', FALLBACK_COMPANY.companySlogan),
        phone: cfg('companyPhone', FALLBACK_COMPANY.companyPhone),
        email: cfg('companyEmail', FALLBACK_COMPANY.companyEmail),
        address: cfg('companyAddress', FALLBACK_COMPANY.companyAddress),
        city: cfg('companyCity', FALLBACK_COMPANY.companyCity),
        bannerHeading: cfg('login_banner_heading', 'Modern Care for Modern Health'),
        bannerSubheading: cfg('login_banner_subheading', 'Sign in to access your staff portal'),
        bannerImage: cfg('login_banner_image', ''),
        bannerShow: cfg('login_banner_show', 'true') !== 'false',
        logoUrl: cfg('logoUrl', ''),
      };
      setBrand(newBrand);
      if (settings.setting?.activeLoginDesign) {
        setDesign(Math.min(Math.max(Number(settings.setting.activeLoginDesign) || 1, 1), 6));
      }
      document.title = `${newBrand.companyName} — Staff Login`;
    }).catch(() => {/* defaults already set */});
  }, []);

  const submit = async (username: string, password: string) => {
    if (!username || !password) { toast.error('Enter username and password'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setAuth(data.token, data.user);
      toast.success(`Welcome back, ${data.user.firstName || data.user.username}!`);
      router.push('/launcher');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return <LoginRouter design={design} brand={brand} onSubmit={submit} loading={loading} />;
}
