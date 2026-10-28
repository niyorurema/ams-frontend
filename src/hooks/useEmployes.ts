'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Capteur } from '@/types/capteur';
import type { Employe } from '@/types/employe';

export interface EmployesFilters {
  search?: string;
  unite_id?: number;
  sans_unite?: boolean;
  actif?: boolean;
  created_from?: string;
  created_to?: string;
  sync_from?: string;
  sync_to?: string;
  limit?: number;
  offset?: number;
}

export interface EmployesResponse {
  items: Employe[];
  total: number;
  limit: number;
  offset: number;
}

export interface EmployeCreate {
  matricule: string;
  badge_id: number;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  unite_id?: number;
  poste?: string;
}

export type EmployeUpdate = Omit<Partial<EmployeCreate>, 'email' | 'telephone' | 'unite_id' | 'poste'> & {
  email?: string | null;
  telephone?: string | null;
  unite_id?: number | null;
  poste?: string | null;
  actif?: Employe['actif'];
};

/** Récupère une page d'employés filtrée côté serveur. */
export function useEmployes(filters: EmployesFilters = {}) {
  return useQuery({
    queryKey: ['employes', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.unite_id) params.set('unite_id', String(filters.unite_id));
      if (filters.sans_unite) params.set('sans_unite', '1');
      if (filters.actif !== undefined) params.set('actif', filters.actif ? '1' : '0');
      if (filters.created_from) params.set('created_from', filters.created_from);
      if (filters.created_to) params.set('created_to', filters.created_to);
      if (filters.sync_from) params.set('sync_from', filters.sync_from);
      if (filters.sync_to) params.set('sync_to', filters.sync_to);
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.offset) params.set('offset', String(filters.offset));

      const query = params.toString();
      const response = await api.get<{
        success: boolean;
        data: EmployesResponse;
      }>(`/api/employes${query ? `?${query}` : ''}`);

      return response.data.data;
    },
  });
}

/** Récupère un employé par son identifiant. */
export function useEmploye(id: number) {
  return useQuery({
    queryKey: ['employes', id],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Employe }>(
        `/api/employes/${id}`
      );

      return response.data.data;
    },
    enabled: id > 0,
  });
}

/** Récupère les capteurs actuellement affectés à un employé. */
export function useCapteursEmploye(id: number) {
  return useQuery({
    queryKey: ['employes', id, 'capteurs'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Capteur[] }>(
        `/api/employes/${id}/capteurs`
      );

      return response.data.data;
    },
    enabled: id > 0,
  });
}

/** Affecte un employé à un capteur du même tenant. */
export function useAffecterEmployeCapteur() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeId, capteurId }: { employeId: number; capteurId: number }) => {
      const response = await api.post(`/api/employes/${employeId}/capteurs`, {
        capteur_id: capteurId,
      });
      return response.data;
    },
    onSuccess: async (_result, { employeId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employes', employeId, 'capteurs'] }),
        queryClient.invalidateQueries({ queryKey: ['capteurs'] }),
      ]);
    },
  });
}

/** Retire une affectation employé/capteur après confirmation dans l'interface. */
export function useRetirerEmployeCapteur() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeId, capteurId }: { employeId: number; capteurId: number }) => {
      const response = await api.delete(`/api/employes/${employeId}/capteurs/${capteurId}`);
      return response.data;
    },
    onSuccess: async (_result, { employeId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employes', employeId, 'capteurs'] }),
        queryClient.invalidateQueries({ queryKey: ['capteurs'] }),
      ]);
    },
  });
}

/** Crée un employé dans le tenant connecté. */
export function useCreateEmploye() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EmployeCreate) => {
      const response = await api.post<{ success: boolean; data: Employe }>(
        '/api/employes',
        data
      );

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employes'] });
    },
  });
}

/** Met à jour les informations d'un employé du tenant connecté. */
export function useUpdateEmploye() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EmployeUpdate }) => {
      const response = await api.put<{ success: boolean; data: Employe }>(
        `/api/employes/${id}`,
        data
      );

      return response.data.data;
    },
    onSuccess: async (_employee, { id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employes'] }),
        queryClient.invalidateQueries({ queryKey: ['employes', id] }),
      ]);
    },
  });
}

/** Supprime logiquement l'employé après désactivation de ses affectations capteur. */
export function useDeleteEmploye() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/api/employes/${id}`);
      return response.data;
    },
    onSuccess: async (_result, id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employes'] }),
        queryClient.invalidateQueries({ queryKey: ['employes', id, 'capteurs'] }),
        queryClient.invalidateQueries({ queryKey: ['capteurs'] }),
      ]);
    },
  });
}

/** Désactive un employé sur ses capteurs après confirmation dans l'interface. */
export function useDesactiverEmploye() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, raison }: { id: number; raison: string }) => {
      const response = await api.post(`/api/employes/${id}/desactiver`, { raison });
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employes'] });
    },
  });
}

/** Réactive un employé sur ses capteurs après confirmation dans l'interface. */
export function useReactiverEmploye() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/api/employes/${id}/reactiver`);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employes'] });
    },
  });
}

/** Déplace une affectation d'un capteur source vers un capteur destination. */
export function useDeplacerEmploye() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      capteur_source_id,
      capteur_destination_id,
    }: {
      id: number;
      capteur_source_id: number;
      capteur_destination_id: number;
    }) => {
      const response = await api.post(`/api/employes/${id}/deplacer`, {
        capteur_source_id,
        capteur_destination_id,
      });
      return response.data;
    },
    onSuccess: async (_result, { id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employes'] }),
        queryClient.invalidateQueries({ queryKey: ['employes', id, 'capteurs'] }),
        queryClient.invalidateQueries({ queryKey: ['capteurs'] }),
      ]);
    },
  });
}