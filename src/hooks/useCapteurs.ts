'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Capteur } from '@/types/capteur';

export type CapteurSyncType = 'users' | 'attendance' | 'assignments';

export interface CapteursResponse {
  items: Capteur[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface CapteursFilters {
  limit?: number;
  offset?: number;
  statut?: Capteur['statut'] | Capteur['statut'][];
}

export interface CapteurUpdate {
  nom: string;
  adresse_ip: string;
  port: number;
  type_reseau: Capteur['type_reseau'];
  statut: Capteur['statut'];
}

/** Récupère les capteurs visibles par le tenant connecté. */
export function useCapteurs(filters: CapteursFilters = {}) {
  return useQuery({
    queryKey: ['capteurs', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(filters.limit ?? 10),
        offset: String(filters.offset ?? 0),
      });
      if (filters.statut) {
        params.set('statut', Array.isArray(filters.statut) ? filters.statut.join(',') : filters.statut);
      }
      const response = await api.get<{
        success: boolean;
        data: CapteursResponse;
      }>(`/api/capteurs?${params.toString()}`);

      return response.data.data;
    },
  });
}

function useCapteurAction(action: 'test' | 'restart' | 'enable') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (capteurId: number) => {
      const response = await api.post<{ success: boolean; data: unknown }>(
        `/api/capteurs/${capteurId}/${action}`
      );
      return response.data;
    },
    onSuccess: async (_data, capteurId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['capteurs'] }),
        queryClient.invalidateQueries({ queryKey: ['capteurs', capteurId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'kpis'] }),
      ]);
    },
  });
}

/** Vérifie la connexion réseau à un capteur. */
export function useTestCapteur() {
  return useCapteurAction('test');
}

/** Demande au capteur joignable de redémarrer. */
export function useRestartCapteur() {
  return useCapteurAction('restart');
}

/** Réactive un capteur joignable qui était désactivé. */
export function useEnableCapteur() {
  return useCapteurAction('enable');
}

/** Récupère un capteur par son identifiant. */
export function useCapteur(id: number) {
  return useQuery({
    queryKey: ['capteurs', id],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Capteur }>(
        `/api/capteurs/${id}`
      );

      return response.data.data;
    },
    enabled: id > 0,
  });
}

/** Synchronise les utilisateurs, pointages ou affectations d'un capteur. */
export function useSyncCapteur() {
  const queryClient = useQueryClient();
  const paths: Record<CapteurSyncType, string> = {
    users: 'sync-users',
    attendance: 'sync-attendance',
    assignments: 'sync-affectations',
  };

  return useMutation({
    mutationFn: async ({ capteurId, type }: { capteurId: number; type: CapteurSyncType }) => {
      const response = await api.post(
        `/api/capteurs/${capteurId}/${paths[type]}`
      );

      return response.data;
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['capteurs'] }),
        queryClient.invalidateQueries({ queryKey: ['capteurs', variables.capteurId] }),
      ]);
    },
  });
}

/** Met à jour les informations modifiables d'un capteur. */
export function useUpdateCapteur() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      capteurId,
      data,
    }: {
      capteurId: number;
      data: CapteurUpdate;
    }) => {
      const response = await api.put<{ success: boolean; data: Capteur }>(
        `/api/capteurs/${capteurId}`,
        data
      );

      return response.data.data;
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['capteurs'] }),
        queryClient.invalidateQueries({ queryKey: ['capteurs', variables.capteurId] }),
      ]);
    },
  });
}