'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export type AbsenceStatus = 'PENDING' | 'MANAGER_APPROVED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AbsenceWorkflow = 'RH_ONLY' | 'MANAGER_THEN_RH' | 'SUPERVISOR_ONLY';

export interface Absence {
  id: number;
  employe_id: number;
  source: 'AMS' | 'OBR';
  source_request_id: string;
  source_status_label: string | null;
  source_type_code: string | null;
  source_day_type: string | null;
  categorie: string;
  motif: string | null;
  date_debut: string;
  date_fin: string;
  journee_complete: number | boolean;
  heure_debut: string | null;
  heure_fin: string | null;
  duree_heures: number | null;
  statut: AbsenceStatus;
  matricule: string;
  nom: string;
  prenom: string;
}

export interface AbsenceFilters {
  date_debut: string;
  date_fin: string;
  statut?: AbsenceStatus | '';
  source?: 'AMS' | 'OBR' | '';
  matricule?: string;
  numero_demande?: string;
  limit: number;
  offset: number;
}

export interface AbsenceCategory {
  id: number;
  code: string;
  nom: string;
  actif: boolean;
}

export interface AbsenceImportPreview {
  total_lignes: number;
  lignes_valides: number;
  lignes_en_erreur: number;
  statuts_source: Record<string, number>;
  jours_conge_futurs_confirmes: number;
  periodes_multi_jours: number;
  demi_journees: number;
  annulations_explicites: number;
  avertissements: Array<{ ligne: number; raison: string }>;
  avertissements_tronques: boolean;
  import_partiel_requis: boolean;
}

export interface AbsenceErpContract {
  version: number;
  direct_sync: {
    enabled: boolean;
    status: 'DISABLED';
    message: string;
  };
  fields: Array<{
    field: string;
    type: string;
    required: boolean;
    description: string;
  }>;
}

export type MappedAbsenceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface AbsenceStatusMapping {
  id: number | null;
  source_code: string;
  source_label: string;
  absence_status: MappedAbsenceStatus;
  is_default: boolean;
}

export interface AbsenceForecast {
  date_debut: string;
  date_fin: string;
  jours: Array<{
    date: string;
    effectif: number;
    employes_journee_complete: number;
    absences_partielles: number;
    heures_partielles: number;
    taux_absence_complete: number;
    par_unite: Array<{
      unite_id: number | null;
      unite: string;
      effectif: number;
      employes_journee_complete: number;
      absences_partielles: number;
      taux_absence_complete: number;
    }>;
    absences: Array<{
      employe_id: number;
      matricule: string;
      nom: string;
      prenom: string;
      unite_id: number | null;
      unite: string | null;
      numero_demande: string;
      categorie: string;
      journee_complete: boolean;
      heure_debut: string | null;
      heure_fin: string | null;
      duree_heures: number | null;
    }>;
  }>;
}

async function invalider(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['absences'] }),
    queryClient.invalidateQueries({ queryKey: ['absences-forecast'] }),
    queryClient.invalidateQueries({ queryKey: ['absence-settings'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['rapports'] }),
    queryClient.invalidateQueries({ queryKey: ['pointages'] }),
  ]);
}

export function useAbsences(filters: AbsenceFilters) {
  return useQuery({
    queryKey: ['absences', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        date_debut: filters.date_debut,
        date_fin: filters.date_fin,
      });
      if (filters.statut) params.set('statut', filters.statut);
      if (filters.source) params.set('source', filters.source);
      if (filters.matricule) params.set('matricule', filters.matricule);
      if (filters.numero_demande) params.set('numero_demande', filters.numero_demande);
      params.set('limit', String(filters.limit));
      params.set('offset', String(filters.offset));
      const response = await api.get<ApiResponse<{
        items: Absence[];
        total: number;
        limit: number;
        offset: number;
      }>>(`/api/absences?${params}`);
      return response.data.data;
    },
  });
}

export function useAbsenceForecast(dateDebut: string, dateFin: string, enabled: boolean) {
  return useQuery({
    queryKey: ['absences-forecast', dateDebut, dateFin],
    queryFn: async () => {
      const params = new URLSearchParams({ date_debut: dateDebut, date_fin: dateFin });
      const response = await api.get<ApiResponse<AbsenceForecast>>(`/api/absences/forecast?${params}`);
      return response.data.data;
    },
    enabled: enabled && dateDebut !== '' && dateDebut <= dateFin,
  });
}

export function useAbsenceCategories(enabled: boolean) {
  return useQuery({
    queryKey: ['absence-categories'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<AbsenceCategory[]>>('/api/absences/categories');
      return response.data.data;
    },
    enabled,
  });
}

export function useCreateAbsenceCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nom: string) => {
      const response = await api.post<ApiResponse<{ id: number }>>('/api/absences/categories', { nom });
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence-categories'] }),
  });
}

export function useUpdateAbsenceCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nom, actif }: { id: number; nom?: string; actif?: boolean }) => {
      const response = await api.put<ApiResponse<{ id: number }>>(
        `/api/absences/categories/${id}`,
        actif === undefined ? { nom } : { actif },
      );
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence-categories'] }),
  });
}

export function useDeleteAbsenceCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete<ApiResponse<{ deleted: boolean; active: boolean; used: boolean }>>(
        `/api/absences/categories/${id}`,
      );
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence-categories'] }),
  });
}

export function useAbsenceSettings(enabled: boolean) {
  return useQuery({
    queryKey: ['absence-settings'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<{ workflow: AbsenceWorkflow }>>('/api/absences/settings');
      return response.data.data;
    },
    enabled,
  });
}

export function useAbsenceErpContract(enabled: boolean) {
  return useQuery({
    queryKey: ['absence-erp-contract'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<AbsenceErpContract>>('/api/absences/erp-contract');
      return response.data.data;
    },
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}

export function useDownloadAbsenceImportTemplate() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get<Blob>('/api/absences/import/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'modele_import_conges_ams.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    },
  });
}

export function useAbsenceStatusMappings(enabled: boolean) {
  return useQuery({
    queryKey: ['absence-status-mappings'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<AbsenceStatusMapping[]>>('/api/absences/status-mappings');
      return response.data.data;
    },
    enabled,
  });
}

export function useSaveAbsenceStatusMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mapping: {
      source_code: string;
      source_label: string;
      absence_status: MappedAbsenceStatus;
    }) => {
      const response = await api.post<ApiResponse<{ id: number }>>('/api/absences/status-mappings', mapping);
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence-status-mappings'] }),
  });
}

export function useDeleteAbsenceStatusMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete<ApiResponse<{ id: number }>>(`/api/absences/status-mappings/${id}`);
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence-status-mappings'] }),
  });
}

export function useSaveAbsenceWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workflow: AbsenceWorkflow) => {
      const response = await api.put<ApiResponse<{ workflow: AbsenceWorkflow }>>(
        '/api/absences/settings',
        { workflow },
      );
      return response.data.data;
    },
    onSuccess: () => invalider(queryClient),
  });
}

export interface ImpedimentInput {
  employe_id?: number;
  date_debut: string;
  date_fin: string;
  journee_complete: boolean;
  heure_debut?: string;
  heure_fin?: string;
  categorie: string;
  motif?: string;
}

export function useCreateImpediment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ImpedimentInput) => {
      const response = await api.post<ApiResponse<{ id: number; statut: AbsenceStatus }>>(
        '/api/absences/impediments',
        data,
      );
      return response.data.data;
    },
    onSuccess: () => invalider(queryClient),
  });
}

export function useAbsenceDecision(action: 'approve' | 'reject' | 'cancel') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, commentaire }: { id: number; commentaire?: string }) => {
      const response = await api.post<ApiResponse<{ id: number; statut: AbsenceStatus }>>(
        `/api/absences/${id}/${action}`,
        { commentaire },
      );
      return response.data.data;
    },
    onSuccess: () => invalider(queryClient),
  });
}

export function useBulkApproveAbsences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await api.post<ApiResponse<{ validees: number; statut: AbsenceStatus }>>(
        '/api/absences/approve-batch',
        { ids },
      );
      return response.data.data;
    },
    onSuccess: () => invalider(queryClient),
  });
}

export function useAbsenceImportPreview() {
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('fichier', file);
      const response = await api.post<ApiResponse<AbsenceImportPreview>>(
        '/api/absences/import/preview',
        body,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 },
      );
      return response.data.data;
    },
  });
}

export function useAbsenceImportCommit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, ignorerErreurs }: { file: File; ignorerErreurs: boolean }) => {
      const body = new FormData();
      body.append('fichier', file);
      body.append('ignorer_erreurs', String(ignorerErreurs));
      const response = await api.post<ApiResponse<{
        importe: number;
        ajoute: number;
        mis_a_jour: number;
        sans_changement: number;
        ignorees: number;
        annulations_explicites: number;
      }>>('/api/absences/import/commit', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300_000,
      });
      return response.data.data;
    },
    onSuccess: () => invalider(queryClient),
  });
}
