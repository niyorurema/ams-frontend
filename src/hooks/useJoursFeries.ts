'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export type JourFerieType = 'NATIONAL' | 'RELIGIEUX' | 'PERSONNALISE' | 'CONGE';

export interface JourFerie {
  id: number;
  tenant_id: number;
  date: string;
  date_occurrence?: string;
  nom: string;
  type: JourFerieType;
  recurrent: number | boolean;
  travaille: number | boolean;
  description: string | null;
  actif: number | boolean;
}

export interface JourFerieInput {
  date: string;
  nom: string;
  type: JourFerieType;
  recurrent: boolean;
  travaille: boolean;
  description: string;
  actif: boolean;
}

export interface JoursFeriesFilters {
  annee: number;
  mois: number;
  type: JourFerieType | 'all';
}

export function useJoursFeries(filters: JoursFeriesFilters) {
  return useQuery({
    queryKey: ['jours-feries', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        annee: String(filters.annee),
        mois: String(filters.mois),
      });
      if (filters.type !== 'all') params.set('type', filters.type);
      const response = await api.get<
        ApiResponse<{ items: JourFerie[]; total: number }>
      >(`/api/jours-feries?${params.toString()}`);
      return response.data.data;
    },
  });
}

function useJourFerieMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['jours-feries'] });
      await queryClient.invalidateQueries({ queryKey: ['rapports'] });
      await queryClient.invalidateQueries({ queryKey: ['pointages'] });
    },
  });
}

export function useCreerJourFerie() {
  return useJourFerieMutation(async (data: JourFerieInput) => {
    const response = await api.post<ApiResponse<JourFerie>>('/api/jours-feries', data);
    return response.data.data;
  });
}

export function useModifierJourFerie() {
  return useJourFerieMutation(async ({ id, data }: { id: number; data: JourFerieInput }) => {
    const response = await api.put<ApiResponse<JourFerie>>(`/api/jours-feries/${id}`, data);
    return response.data.data;
  });
}

export function useSupprimerJourFerie() {
  return useJourFerieMutation(async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/api/jours-feries/${id}`);
    return response.data;
  });
}

export function useImporterJoursFeriesBurundi() {
  return useJourFerieMutation(async (annee: number) => {
    const response = await api.post<ApiResponse<{ count: number }>>(
      '/api/jours-feries/importer-burundi',
      { annee },
    );
    return response.data.data;
  });
}
