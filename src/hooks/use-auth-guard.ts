'use client';

/**
 * Auth guard hook — hydration-safe. Zustand persist rehydrates localStorage
 * after the first React commit; redirecting immediately on token===null
 * would wrongly bounce logged-in users to /login (server snapshot is null).
 * We wait one tick and re-check the store directly.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

export function useAuthGuard(allowedRoles?: string[]) {
  const { token, user } = useAuthStore();
  const router = useRouter();

  React.useEffect(() => {
    if (token) return;
    const t = setTimeout(() => {
      if (!useAuthStore.getState().token) {
        router.replace('/login');
      }
    }, 150);
    return () => clearTimeout(t);
  }, [token, router]);

  React.useEffect(() => {
    if (token && user && allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      toast.error('You do not have access to this portal');
      router.replace('/launcher');
    }
  }, [token, user, allowedRoles, router]);

  return { token, user };
}
