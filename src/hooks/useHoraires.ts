'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export interface HorairePlage {
  type: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_IN' | 'BREAK_OUT';
  debut: string;
  fin: string;
  tolerance_min?: number;
}

export interface HoraireTenant {
  id: number;
  tenant_id: number;
  nom: string;
  description: string | null;
  nb_pointages_attendus: number;
  plages_horaires: HorairePlage[];
  jours_travailles: string;
  heures_travail_normales: number | string;
  seuil_heures_anormal: number | string;
  est_defaut: boolean | number | string;
  actif: boolean | number | string;
}

export interface HoraireUpdate {
  nom: string;
  description: string;
  plages_horaires: HorairePlage[];
  heures_travail_normales: number;
  seuil_heures_anormal: number;
}

const horairesKey = ['horaires'] as const;

export function useHoraires() {
  return useQuery({
    queryKey: horairesKey,
    queryFn: async () => {
      const response = await api.get<ApiResponse<{ items: HoraireTenant[]; total: number }>>('/api/horaires');
      return response.data.data;
    },
  });
}

function useInvalidateAttendanceSettings() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: horairesKey }),
      queryClient.invalidateQueries({ queryKey: ['profile', 'attendance'] }),
      queryClient.invalidateQueries({ queryKey: ['pointages'] }),
    ]);
  };
}

export function useCreateDefaultHoraire() {
  const invalidate = useInvalidateAttendanceSettings();
  return useMutation({
    mutationFn: async (type: 'OBR' | 'STANDARD' | 'FLEXIBLE') => {
      const response = await api.post<ApiResponse<{ id: number }>>('/api/horaires/defaut', { type });
      return response.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useSetDefaultHoraire() {
  const invalidate = useInvalidateAttendanceSettings();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.put<ApiResponse<{ id: number }>>(`/api/horaires/${id}/defaut`);
      return response.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateHoraire() {
  const invalidate = useInvalidateAttendanceSettings();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: HoraireUpdate }) => {
      const response = await api.put<ApiResponse<HoraireTenant>>(`/api/horaires/${id}`, data);
      return response.data.data;
    },
    onSuccess: invalidate,
  });
}
