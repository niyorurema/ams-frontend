'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export type UniteType = 'COMMISSARIAT' | 'DIRECTION' | 'SERVICE' | 'EQUIPE';
export type MandatType = 'TITULAIRE' | 'INTERIM' | 'ADJOINT' | 'INTERIM_ADJOINT';

export interface UniteOrganisationnelle {
  id: number;
  parent_id: number | null;
  nom: string;
  code: string;
  type: UniteType;
  niveau: number;
  adresse: string | null;
  telephone: string | null;
  email?: string | null;
  responsable_id: number | null;
  ordre_affichage: number;
  actif: boolean | number | '0' | '1';
  source_id: number | null;
  source_systeme: string | null;
  source_synced_at: string | null;
  ams_override: boolean | number | '0' | '1';
  parent_nom: string | null;
}

export interface Mandat {
  id: number;
  unite_id: number;
  user_id: number;
  type_mandat: MandatType;
  date_debut: string;
  date_fin: string | null;
  est_actif: boolean | number | '0' | '1';
  remarque: string | null;
  source_id: number | null;
  source_systeme: string | null;
  source_synced_at: string | null;
  ams_override: boolean | number | '0' | '1';
  unite_nom: string;
  titulaire_nom: string;
  employe_nom: string | null;
  employe_prenom: string | null;
}

export interface OrganisationUser {
  id: number;
  nom_complet: string;
  email: string | null;
  role: string;
  employe_id: number | null;
  matricule: string | null;
}

export interface OrganisationData {
  unites: UniteOrganisationnelle[];
  mandats: Mandat[];
  utilisateurs: OrganisationUser[];
}

export type UniteInput = Pick<UniteOrganisationnelle,
  'nom' | 'code' | 'type' | 'parent_id' | 'adresse' | 'telephone' | 'email' |
  'responsable_id' | 'ordre_affichage' | 'actif'
>;

export type MandatInput = Pick<Mandat,
  'unite_id' | 'user_id' | 'type_mandat' | 'date_debut' | 'date_fin' | 'est_actif' | 'remarque'
>;

const organisationKey = ['organisation'] as const;

export function useOrganisation(enabled = true) {
  return useQuery({
    queryKey: organisationKey,
    queryFn: async () => {
      const response = await api.get<ApiResponse<OrganisationData>>('/api/organisation');
      return response.data.data;
    },
    enabled,
  });
}

function useOrganisationMutation<T>(mutationFn: (variables: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organisationKey }),
        queryClient.invalidateQueries({ queryKey: ['unites'] }),
        queryClient.invalidateQueries({ queryKey: ['employes'] }),
      ]);
    },
  });
}

export function useCreerUnite() {
  return useOrganisationMutation(async (data: UniteInput) => {
    const response = await api.post('/api/organisation/unites', data);
    return response.data;
  });
}

export function useModifierUnite() {
  return useOrganisationMutation(async ({ id, data }: { id: number; data: Partial<UniteInput> }) => {
    const response = await api.put(`/api/organisation/unites/${id}`, data);
    return response.data;
  });
}

export function useSupprimerUnite() {
  return useOrganisationMutation(async (id: number) => {
    const response = await api.delete(`/api/organisation/unites/${id}`);
    return response.data;
  });
}

export function useCreerMandat() {
  return useOrganisationMutation(async (data: MandatInput) => {
    const response = await api.post('/api/organisation/mandats', data);
    return response.data;
  });
}

export function useModifierMandat() {
  return useOrganisationMutation(async ({ id, data }: { id: number; data: Partial<MandatInput> }) => {
    const response = await api.put(`/api/organisation/mandats/${id}`, data);
    return response.data;
  });
}

export function useSupprimerMandat() {
  return useOrganisationMutation(async (id: number) => {
    const response = await api.delete(`/api/organisation/mandats/${id}`);
    return response.data;
  });
}

export function organisationErrorMessage(error: unknown): string {
  if (
    typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof error.response === 'object'
    && error.response !== null
    && 'data' in error.response
    && typeof error.response.data === 'object'
    && error.response.data !== null
    && (
      ('message' in error.response.data && typeof error.response.data.message === 'string')
      || ('error' in error.response.data && typeof error.response.data.error === 'string')
    )
  ) {
    return 'message' in error.response.data && typeof error.response.data.message === 'string'
      ? error.response.data.message
      : 'error' in error.response.data && typeof error.response.data.error === 'string'
        ? error.response.data.error
        : 'Une erreur est survenue.';
  }

  return error instanceof Error ? error.message : 'Une erreur est survenue.';
}
