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
  /** Indique si l'utilisateur est authentifié côté interface. */
  isAuthenticated: boolean;
  /** Enregistre l'utilisateur après login; la session utilise exclusivement un cookie HttpOnly. */
  setAuth: (user: User) => void;
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
      isAuthenticated: false,

      setAuth: (user) => set({ user, isAuthenticated: true }),

      clearAuth: () =>
        set({ user: null, isAuthenticated: false }),

      updateUser: (partialUser) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partialUser } : null,
        })),
    }),
    {
      name: 'ams-auth',
      version: 1,
      migrate: (persistedState) => {
        if (typeof persistedState !== 'object' || persistedState === null) return persistedState;
        const migrated = { ...persistedState } as Record<string, unknown>;
        delete migrated.token;
        return migrated as unknown as AuthState;
      },
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);