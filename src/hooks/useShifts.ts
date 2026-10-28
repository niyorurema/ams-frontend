'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Shift {
  id: number;
  tenant_id: number;
  nom: string;
  code: string;
  description?: string | null;
  heure_debut: string;
  heure_fin: string;
  couleur: string;
  ordre_affichage: number;
  actif: boolean | number | '0' | '1';
  employes_assignes?: number;
}

export interface ShiftAssignment {
  id: number;
  employe_id: number;
  shift_id: number;
  date_debut: string;
  date_fin?: string | null;
  shift_nom?: string;
  heure_debut?: string;
  heure_fin?: string;
  couleur?: string;
  employe_nom?: string;
  employe_prenom?: string;
}

export interface ShiftInput {
  nom: string;
  code: string;
  description?: string;
  heure_debut: string;
  heure_fin: string;
  couleur: string;
  ordre_affichage: number;
  actif: boolean;
}

export interface ShiftsResponse {
  items: Shift[];
  affectations: ShiftAssignment[];
  total: number;
}

const shiftsQueryKey = ['shifts'] as const;

export function useShifts() {
  return useQuery({
    queryKey: shiftsQueryKey,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: ShiftsResponse }>('/api/shifts');
      return response.data.data;
    },
  });
}

export function useShift(id: number) {
  return useQuery({
    queryKey: [...shiftsQueryKey, id],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Shift }>(`/api/shifts/${id}`);
      return response.data.data;
    },
    enabled: id > 0,
  });
}

function useShiftMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shiftsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['employes'] }),
      ]);
    },
  });
}

export function useCreerShift() {
  return useShiftMutation(async (data: ShiftInput) => {
    const response = await api.post('/api/shifts', data);
    return response.data;
  });
}

export function useModifierShift() {
  return useShiftMutation(async ({ id, data }: { id: number; data: ShiftInput }) => {
    const response = await api.put(`/api/shifts/${id}`, data);
    return response.data;
  });
}

export function useSupprimerShift() {
  return useShiftMutation(async (id: number) => {
    const response = await api.delete(`/api/shifts/${id}`);
    return response.data;
  });
}

export interface AssignShiftInput {
  employe_id: number;
  shift_id: number;
  date_debut: string;
  date_fin?: string;
}

export function useAssignerShift() {
  return useShiftMutation(async (data: AssignShiftInput) => {
    const response = await api.post('/api/shifts/assigner', data);
    return response.data;
  });
}

export function useDesassignerShift() {
  return useShiftMutation(async (employeId: number) => {
    const response = await api.delete(`/api/shifts/assigner/${employeId}`);
    return response.data;
  });
}

export function useEmployeShifts(employeId: number) {
  return useQuery({
    queryKey: [...shiftsQueryKey, 'employe', employeId],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: { items: ShiftAssignment[]; total: number } }>(
        `/api/shifts/employe/${employeId}`
      );
      return response.data.data;
    },
    enabled: employeId > 0,
  });
}
