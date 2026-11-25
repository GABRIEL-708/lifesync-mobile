import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  setAuth: (token: string, user: AuthUser, needsOnboarding?: boolean) => void;
  completeOnboarding: () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  needsOnboarding: false,

  setAuth: (token: string, user: AuthUser, needsOnboarding = false) =>
    set({ token, user, isAuthenticated: true, needsOnboarding }),

  completeOnboarding: () => set({ needsOnboarding: false }),

  clearAuth: () =>
    set({ token: null, user: null, isAuthenticated: false, needsOnboarding: false }),
}));
