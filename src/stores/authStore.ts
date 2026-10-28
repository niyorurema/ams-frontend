import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Utilisateur connecté à l'application. */
export interface User {
  id: number;
  email: string | null;
  nom_complet: string;
  role: string;
  tenant_id: number;
  is_super_admin: boolean;
  employe_id?: number;
  telephone?: string;
  auth_source?: 'LOCAL' | 'LDAP';
  derniere_connexion?: string | null;
}

/** État d'authentification de l'application. */
interface AuthState {
  /** Utilisateur connecté (null si non connecté). */
  user: User | null;
  /** Token JWT (null si non connecté). */
  token: string | null;
  /** Indique si l'utilisateur est authentifié. */
  isAuthenticated: boolean;
  /** Enregistre l'utilisateur et le token après login. */
  setAuth: (user: User, token: string) => void;
  /** Efface les données d'authentification (logout). */
  clearAuth: () => void;
  /** Met à jour partiellement les données de l'utilisateur. */
  updateUser: (partialUser: Partial<User>) => void;
}

/** Store Zustand persistant pour l'authentification. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),

      clearAuth: () =>
        set({ user: null, token: null, isAuthenticated: false }),

      updateUser: (partialUser) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partialUser } : null,
        })),
    }),
    {
      name: 'ams-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);