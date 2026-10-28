'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ContratHoraire {
  id: number;
  tenant_id: number;
  employe_id: number;
  mode_travail: 'TEMPS_PLEIN' | 'MI_TEMPS_MATIN' | 'MI_TEMPS_APRES_MIDI' | 'HORAIRE_LIBRE';
  heure_debut: string | null;
  heure_fin: string | null;
  jours_travail: string;
  date_debut: string;
  date_fin: string | null;
  actif: number;
  notes: string | null;
  deleted_at: string | null;
}

export interface ContratHoraireInput {
  mode_travail: ContratHoraire['mode_travail'];
  heure_debut: string | null;
  heure_fin: string | null;
  jours_travail: number[];
  date_debut: string;
  date_fin: string | null;
  cloturer_contrat_existant?: boolean;
}

export function useContratsHoraire(employeId: number) {
  return useQuery({
    queryKey: ['employes', employeId, 'contrats-horaires'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: ContratHoraire[] }>(
        `/api/admin/employes/${employeId}/contrats`
      );

      return response.data.data;
    },
    enabled: employeId > 0,
  });
}

export function useCreateContratHoraire(employeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contrat: ContratHoraireInput) => {
      const response = await api.post<{ success: boolean; data: ContratHoraire }>(
        `/api/admin/employes/${employeId}/contrats`,
        contrat
      );

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['employes', employeId, 'contrats-horaires'],
      });
    },
  });
}

export function useUpdateContratHoraire(employeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contratId,
      contrat,
    }: {
      contratId: number;
      contrat: ContratHoraireInput;
    }) => {
      const response = await api.put<{ success: boolean; data: ContratHoraire }>(
        `/api/admin/employes/${employeId}/contrats/${contratId}`,
        contrat
      );

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['employes', employeId, 'contrats-horaires'],
      });
    },
  });
}

export function useDeleteContratHoraire(employeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contratId: number) => {
      await api.delete(`/api/admin/employes/${employeId}/contrats/${contratId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['employes', employeId, 'contrats-horaires'],
      });
    },
  });
}
