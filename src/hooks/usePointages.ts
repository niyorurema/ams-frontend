'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Pointage } from '@/types/pointage';

export interface PointagesFilters {
  date_debut?: string;
  date_fin?: string;
  employe_id?: number;
  capteur_id?: number;
  type_evenement?: Pointage['type_evenement'];
  statut?: Pointage['statut'];
  limit?: number;
  offset?: number;
}

export interface PointagesResponse {
  items: Pointage[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface PointagesStats {
  periode: { debut: string; fin: string };
  total: number;
  moyenne_par_jour: number;
  employes_actifs: number;
  capteurs_utilises: number;
  par_jour: Array<{ date: string; count: number }>;
  par_type: Record<string, number>;
}

export interface PresenceStatsData {
  date: string;
  presents: number;
  retards: number;
  absents: number;
  en_cours: number;
  feries: number;
  repos: number;
  sans_jugement: number;
  total: number;
}

export interface PresenceStats {
  periode: { debut: string; fin: string };
  granularite: 'jour' | 'semaine' | 'mois';
  donnees: PresenceStatsData[];
  totaux: { presents: number; retards: number; absents: number; en_cours: number; feries: number; repos: number; sans_jugement: number; total: number };
}

function creerParametres(filters: PointagesFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.date_debut) params.set('date_debut', filters.date_debut);
  if (filters.date_fin) params.set('date_fin', filters.date_fin);
  if (filters.employe_id !== undefined) params.set('employe_id', String(filters.employe_id));
  if (filters.capteur_id !== undefined) params.set('capteur_id', String(filters.capteur_id));
  if (filters.type_evenement) params.set('type_evenement', filters.type_evenement);
  if (filters.statut) params.set('statut', filters.statut);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));

  return params;
}

/** Récupère une page de pointages filtrée côté serveur. */
export function usePointages(filters: PointagesFilters = {}) {
  return useQuery({
    queryKey: ['pointages', filters],
    queryFn: async () => {
      const params = creerParametres(filters);
      const query = params.toString();
      const response = await api.get<{ success: boolean; data: PointagesResponse }>(
        `/api/pointages${query ? `?${query}` : ''}`
      );

      return response.data.data;
    },
  });
}

/** Récupère les statistiques de pointages sur une période. */
export function useStatsPointages(dateDebut: string, dateFin: string) {
  return useQuery({
    queryKey: ['pointages', 'stats', dateDebut, dateFin],
    queryFn: async () => {
      const params = new URLSearchParams({ date_debut: dateDebut, date_fin: dateFin });
      const response = await api.get<{ success: boolean; data: PointagesStats }>(
        `/api/pointages/stats?${params.toString()}`
      );

      return response.data.data;
    },
    enabled: Boolean(dateDebut && dateFin),
  });
}

/** Récupère les présences, retards et absences calculés selon les horaires. */
export function useStatsPresence(dateDebut: string, dateFin: string) {
  return useQuery({
    queryKey: ['pointages', 'stats-presence', dateDebut, dateFin],
    queryFn: async () => {
      const params = new URLSearchParams({
        date_debut: dateDebut,
        date_fin: dateFin,
        granularite: 'jour',
      });
      const response = await api.get<{ success: boolean; data: PresenceStats }>(
        `/api/pointages/stats/presence?${params.toString()}`,
        { timeout: 120000 }
      );

      return response.data.data;
    },
    enabled: Boolean(dateDebut && dateFin && dateDebut <= dateFin),
    staleTime: 5 * 60 * 1000,
  });
}

/** Télécharge les pointages filtrés en CSV. */
export function useExportPointages() {
  return useMutation({
    mutationFn: async ({ filters, format = 'csv' }: { filters: PointagesFilters; format?: 'csv' | 'excel' }) => {
      const params = new URLSearchParams();
      if (filters.date_debut) params.set('date_debut', filters.date_debut);
      if (filters.date_fin) params.set('date_fin', filters.date_fin);
      if (filters.employe_id !== undefined) params.set('employe_id', String(filters.employe_id));
      if (filters.capteur_id !== undefined) params.set('capteur_id', String(filters.capteur_id));
      if (filters.type_evenement) params.set('type_evenement', filters.type_evenement);
      params.set('format', format);
      const response = await api.get<Blob>(`/api/pointages/export?${params.toString()}`, {
        responseType: 'blob',
      });
      const mime = format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8';
      const extension = format === 'excel' ? 'xlsx' : 'csv';
      const url = window.URL.createObjectURL(new Blob([response.data], { type: mime }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `pointages_${filters.date_debut || 'all'}_${filters.date_fin || 'all'}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    },
  });
}
