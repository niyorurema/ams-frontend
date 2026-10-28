'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import type {
  RapportEmployeVisible,
  RapportHistoriqueDetail,
  RapportHistoriqueItem,
  RapportJournalierApercuDetail,
  RapportJournalierApercuItem,
  RapportJournalierApercus,
  RapportJournalierConfigurationData,
  RapportFormat,
  RapportPlanifie,
  RapportPlanifieCreate,
  RapportPlanifieUpdate,
  RapportQuotidien,
} from '@/types/rapport';

/** Récupère les rapports J-1 qui peuvent être prévisualisés avant leur envoi automatique. */
export function useApercusRapportsJournaliers(enabled = true) {
  return useQuery({
    queryKey: ['rapports', 'journalier', 'apercus'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<RapportJournalierApercus>>(
        '/api/rapports/journalier/apercus'
      );

      return response.data.data;
    },
    enabled,
  });
}

/** Génère à la demande le contenu d’un rapport J-1 sans déclencher son envoi. */
export function useApercuRapportJournalier(
  destinataire: RapportJournalierApercuItem | null
) {
  return useQuery({
    queryKey: [
      'rapports',
      'journalier',
      'apercu',
      destinataire?.user_id,
      destinataire?.unite_id ?? 'global',
    ],
    queryFn: async () => {
      if (!destinataire) {
        throw new Error('Aucun destinataire de rapport sélectionné.');
      }
      const params = new URLSearchParams({
        user_id: String(destinataire.user_id),
        unite_id: destinataire.unite_id === null
          ? 'global'
          : String(destinataire.unite_id),
      });
      const response = await api.get<ApiResponse<RapportJournalierApercuDetail>>(
        `/api/rapports/journalier/apercu?${params.toString()}`,
        { timeout: 120_000 }
      );

      return response.data.data;
    },
    enabled: destinataire !== null,
    staleTime: 60_000,
  });
}

/** Récupère les employés visibles par l'utilisateur connecté. */
export function useEmployesVisiblesRapport() {
  return useQuery({
    queryKey: ['rapports', 'employes-visibles'],
    queryFn: async () => {
      const response = await api.get<
        ApiResponse<{ items: RapportEmployeVisible[]; total: number }>
      >('/api/rapports/employes-visibles');

      return response.data.data;
    },
  });
}

/** Récupère le rapport quotidien pour une date. */
export function useRapportQuotidien(date: string) {
  return useQuery({
    queryKey: ['rapports', 'quotidien', date],
    queryFn: async () => {
      const params = new URLSearchParams({ date });
      const response = await api.get<ApiResponse<RapportQuotidien>>(
        `/api/rapports/quotidien?${params.toString()}`,
        { timeout: 120_000 }
      );

      return response.data.data;
    },
    enabled: Boolean(date),
    staleTime: 5 * 60 * 1000,
  });
}

/** Exporte le rapport quotidien et déclenche le téléchargement du fichier. */
export function useExportRapport() {
  return useMutation({
    mutationFn: async ({
      date,
      format,
    }: {
      date: string;
      format: Extract<RapportFormat, 'PDF' | 'EXCEL'>;
    }) => {
      const params = new URLSearchParams({ date, format });
      const response = await api.get<Blob>(
        `/api/rapports/quotidien/export?${params.toString()}`,
        { responseType: 'blob', timeout: 300_000 }
      );
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport_${date}.${format === 'PDF' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    },
  });
}

/** Envoie le rapport quotidien par e-mail. */
export function useEnvoyerRapport() {
  return useMutation({
    mutationFn: async ({
      date,
      format,
      user_id,
    }: {
      date: string;
      format: Extract<RapportFormat, 'PDF' | 'EXCEL'>;
      user_id?: number;
    }) => {
      const response = await api.post<ApiResponse<{ envoye: boolean }>>(
        '/api/rapports/quotidien/envoyer',
        { date, format, ...(user_id === undefined ? {} : { user_id }) }
      );

      return response.data;
    },
  });
}

/** Récupère les rapports planifiés du tenant courant. */
export function useRapportsPlanifies(enabled = true) {
  return useQuery({
    queryKey: ['rapports', 'planifies'],
    queryFn: async () => {
      const response = await api.get<
        ApiResponse<{ items: RapportPlanifie[]; total: number }>
      >('/api/rapports/planifies');

      return response.data.data;
    },
    enabled,
  });
}

/** Crée un rapport planifié. */
export function useCreerRapportPlanifie() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RapportPlanifieCreate) => {
      const response = await api.post<ApiResponse<RapportPlanifie>>(
        '/api/rapports/planifies',
        data
      );

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rapports', 'planifies'] });
    },
  });
}

/** Modifie un rapport planifié. */
export function useModifierRapportPlanifie() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: RapportPlanifieUpdate;
    }) => {
      const response = await api.put<ApiResponse<RapportPlanifie>>(
        `/api/rapports/planifies/${id}`,
        data
      );

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rapports', 'planifies'] });
    },
  });
}

/** Supprime un rapport planifié. */
export function useSupprimerRapportPlanifie() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete<ApiResponse<null>>(
        `/api/rapports/planifies/${id}`
      );

      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rapports', 'planifies'] });
    },
  });
}

/** Récupère la configuration J-1 du tenant, ses destinataires et ses jours ouvrés. */
export function useConfigurationRapportJournalier(enabled = true) {
  return useQuery({
    queryKey: ['rapports', 'journalier', 'configuration'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<RapportJournalierConfigurationData>>(
        '/api/rapports/journalier/configuration'
      );

      return response.data.data;
    },
    enabled,
  });
}

/** Enregistre l’heure et les destinataires supplémentaires du rapport J-1. */
export function useEnregistrerConfigurationRapportJournalier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      heure_envoi: string;
      format: Extract<RapportFormat, 'PDF' | 'EXCEL'>;
      langue: 'fr' | 'en' | 'rn';
      actif: boolean;
      destinataires: Array<{ user_id: number; unite_id: number | null }>;
    }) => {
      const response = await api.put<ApiResponse<RapportJournalierConfigurationData>>(
        '/api/rapports/journalier/configuration',
        data
      );

      return response.data.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rapports', 'journalier', 'configuration'] }),
        queryClient.invalidateQueries({ queryKey: ['rapports', 'journalier', 'apercus'] }),
      ]);
    },
  });
}

/** Liste les envois archivés accessibles à l’utilisateur. */
export function useRapportsHistorique(enabled = true, limit = 20, offset = 0) {
  return useQuery({
    queryKey: ['rapports', 'historique', limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      const response = await api.get<
        ApiResponse<{ items: RapportHistoriqueItem[]; total: number; limit: number; offset: number }>
      >(`/api/rapports/historique?${params.toString()}`);

      return response.data.data;
    },
    enabled,
  });
}

/** Récupère le contenu sauvegardé d’un envoi. */
export function useRapportHistoriqueDetail(id: number | null) {
  return useQuery({
    queryKey: ['rapports', 'historique', id],
    queryFn: async () => {
      const response = await api.get<ApiResponse<RapportHistoriqueDetail>>(
        `/api/rapports/historique/${id}`
      );

      return response.data.data;
    },
    enabled: id !== null,
  });
}
