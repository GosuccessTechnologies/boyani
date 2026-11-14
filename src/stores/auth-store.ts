'use client';

/**
 * Auth store — Bearer token session management (hills.zip pattern).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
  avatarUrl?: string;
}

interface AuthState {
  token: string | null;
  user: SessionUser | null;
  setAuth: (token: string, user: SessionUser) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
      isAuthenticated: () => !!get().token,
    }),
    { name: 'boyani-auth' }
  )
);
