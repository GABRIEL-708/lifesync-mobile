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
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  setAuth: (token: string, user: AuthUser) =>
    set({ token, user, isAuthenticated: true }),

  clearAuth: () =>
    set({ token: null, user: null, isAuthenticated: false }),
}));
