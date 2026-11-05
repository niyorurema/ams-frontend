'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import type { Capteur } from '@/types/capteur';

export interface DashboardEvolutionDay {
  date: string;
  presents: number;
  retards: number;
  absents: number;
  en_cours: number;
  total: number;
}

export interface DashboardRecentPointage {
  id: number;
  employe_id: number | null;
  employe_nom: string | null;
  employe_matricule: string | null;
  badge_id: number;
  date_pointage: string;
  type_evenement: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_IN' | 'BREAK_OUT' | 'UNKNOWN';
  statut_calcul: string;
  capteur_id: number | null;
}

export interface DashboardKpis {
  date: string;
  updated_at?: string;
  comparaison_hier?: {
    attendus: number;
    presents: number;
    en_retard: number;
    absents: number;
    en_cours: number;
  } | null;
  employes: {
    total: number;
    attendus_aujourdhui: number;
    presents: number;
    en_retard: number;
    absents: number;
    en_cours: number;
    sans_pointage_depart: number;
  };
  pointages: { aujourdhui: number; entrees: number; sorties: number };
  pointages_recents: DashboardRecentPointage[];
  capteurs: {
    actifs: number;
    indisponibles: Array<{
      id: number;
      nom: string;
      adresse_ip: string;
      port: number;
      statut: Capteur['statut'];
      etat_connexion: NonNullable<Capteur['etat_connexion']>;
    }>;
  };
  sante_collecte: {
    etat: 'OK' | 'ATTENTION' | 'UNKNOWN';
    capteurs_total: number;
    capteurs_en_ligne: number;
    capteurs_hors_ligne: number;
    capteurs_inconnus: number;
    pointages_non_associes: number;
  };
  heures_sup: {
    mois_en_cours: number;
    mois_precedent: number;
  };
  alertes: Array<{
    type: 'SANS_DEPART' | 'ORPHELINS' | 'CONTRATS_HORAIRES_ABSENTS';
    count: number;
    capteur?: string | null;
    severite: 'warning' | 'danger';
  }>;
  top_unites_absentes: Array<{
    unite_id: number;
    unite: string;
    taux_absence: number;
    absents: number;
    total: number;
  }>;
  evolution_presence: DashboardEvolutionDay[];
  shifts: Array<{
    id: number;
    nom: string;
    heure_debut: string;
    heure_fin: string;
    couleur: string;
    employes_assignes: number;
    employes_presents: number;
  }>;
}

/** Charge les indicateurs et données annexes du tableau de bord en un seul appel. */
export function useDashboardKpis(enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<DashboardKpis>>('/api/admin/dashboard/kpis');
      return response.data.data;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled,
  });
}
