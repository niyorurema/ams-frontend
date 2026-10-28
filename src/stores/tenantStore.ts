import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Configuration personnalisée d'un tenant. */
export interface TenantConfig {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  slogan?: string;
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  font_size?: string;
  timezone?: string;
  jours_travailles?: number[];
}

/** État du tenant courant. */
interface TenantState {
  /** Configuration du tenant (null si non chargée). */
  tenant: TenantConfig | null;
  /** Charge la configuration du tenant. */
  setTenant: (tenant: TenantConfig) => void;
  /** Efface la configuration. */
  clearTenant: () => void;
  /** Met à jour partiellement la configuration. */
  updateTenant: (partial: Partial<TenantConfig>) => void;
}

/** Store Zustand persistant pour la configuration du tenant. */
export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      tenant: null,

      setTenant: (tenant) => set({ tenant }),

      clearTenant: () => set({ tenant: null }),

      updateTenant: (partial) =>
        set((state) => ({
          tenant: state.tenant ? { ...state.tenant, ...partial } : null,
        })),
    }),
    {
      name: 'ams-tenant',
    }
  )
);