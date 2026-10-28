'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { useTenantStore, type TenantConfig } from '@/stores/tenantStore';

export interface TenantConfigUpdate {
  name: string;
  slogan: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  font_size: string;
  timezone?: string;
  jours_travailles: number[];
  logo_url?: null;
}

export type AttendanceSlotType = 'ARRIVEE' | 'DEBUT_PAUSE' | 'FIN_PAUSE' | 'DEPART';
export type AttendanceSlotMode = 'LIMITE_TARDIVE' | 'LIMITE_PRECOCE' | 'PLAGE';

export interface AttendanceSlot {
  id?: number;
  tenant_id?: number;
  type_creneau: AttendanceSlotType;
  mode: AttendanceSlotMode;
  heure_cible: string | null;
  tolerance_minutes: number | null;
  plage_debut: string | null;
  plage_fin: string | null;
  ordre_affichage: number;
  notes: string | null;
  actif?: boolean | number | string;
}

export interface AttendanceRuleSettings {
  actif_regles_nouvelles: boolean;
  horaire_id: number | null;
  date_effet: string;
  horaires: AttendanceRuleSchedule[];
  versions: AttendanceRuleVersion[];
  parametres: Record<string, {
    valeur: string | number | boolean;
    type: string;
    description: string;
  }>;
  creneaux: AttendanceSlot[];
}

export interface AttendanceRuleSchedule {
  id: number;
  nom: string;
  est_defaut: boolean;
  heures_travail_normales: number;
  plages_horaires: Array<{
    type: string;
    debut: string;
    fin: string;
    tolerance_min?: number;
  }>;
}

export interface AttendanceRuleVersion {
  id: number;
  horaire_id: number | null;
  horaire_nom: string | null;
  date_effet: string;
  actif: boolean | number;
  created_at: string;
}

export interface AttendanceRuleSettingsUpdate {
  parametres: Record<string, string | number>;
  creneaux: Omit<AttendanceSlot, 'id' | 'tenant_id' | 'actif'>[];
  horaire_id: number | null;
  date_effet: string;
  actif_regles_nouvelles?: boolean;
}

export interface AttendanceRecalculationResult {
  date: string;
  portee: 'TENANT' | 'EMPLOYE';
  employe_id: number | null;
  total: number;
  traitees: number;
  ignorees: number;
  erreurs: Array<{ employe_id: number; message: string }>;
}

export interface AttendanceRuleComparisonDay {
  date: string;
  employe_id: number;
  avant: {
    statut: string;
    heures_travaillees: number;
  };
  apres: {
    statut: string;
    heures_travaillees: number;
    horaire_nom: string | null;
    creneaux: Array<{ creneau: string; statut: string; reel?: string | null }>;
  };
  different: boolean;
  pointages_pause_observes: boolean;
  creneaux_pause_configures: boolean;
}

export interface AttendanceRuleComparisonResult {
  date_debut: string;
  date_fin: string;
  employe_id: number;
  jours_compares: number;
  jours_differents: number;
  avertissement_pointages_pause: boolean;
  jours: AttendanceRuleComparisonDay[];
}

export interface AttendanceDayPreviewResult {
  date: string;
  employe_id: number;
  resultat: {
    statut_global?: string;
    statut?: string;
    source_calcul?: string;
    heure_arrivee?: string | null;
    heure_depart?: string | null;
    heures_travaillees?: number;
    details?: { source?: string; evaluation?: string };
  };
}

const tenantConfigQueryKey = ['admin', 'tenant'] as const;
const attendanceRuleSettingsQueryKey = ['admin', 'tenant', 'pointage-parametres'] as const;

/** Récupère la configuration du tenant connecté. */
export function useTenantConfig() {
  return useQuery({
    queryKey: tenantConfigQueryKey,
    queryFn: async () => {
      const response = await api.get<ApiResponse<TenantConfig>>('/api/admin/tenant');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Met à jour la configuration visuelle du tenant. */
export function useUpdateTenantConfig() {
  const queryClient = useQueryClient();
  const setTenant = useTenantStore((state) => state.setTenant);

  return useMutation({
    mutationFn: async (data: TenantConfigUpdate) => {
      const response = await api.put<ApiResponse<TenantConfig>>('/api/admin/tenant', data);
      return response.data.data;
    },
    onSuccess: (tenant) => {
      setTenant(tenant);
      queryClient.setQueryData(tenantConfigQueryKey, tenant);
    },
  });
}

/** Met à jour les jours travaillés sans toucher aux autres options du tenant. */
export function useUpdateTenantWorkingDays() {
  const queryClient = useQueryClient();
  const setTenant = useTenantStore((state) => state.setTenant);

  return useMutation({
    mutationFn: async (joursTravailles: number[]) => {
      const response = await api.put<ApiResponse<TenantConfig>>('/api/admin/tenant', {
        jours_travailles: joursTravailles,
      });
      return response.data.data;
    },
    onSuccess: (tenant) => {
      setTenant(tenant);
      queryClient.setQueryData(tenantConfigQueryKey, tenant);
    },
  });
}

/** Envoie un logo au backend et actualise la configuration du tenant. */
export function useUploadLogo() {
  const queryClient = useQueryClient();
  const setTenant = useTenantStore((state) => state.setTenant);

  return useMutation({
    mutationFn: async (fichier: File) => {
      const formData = new FormData();
      formData.append('logo', fichier);
      const response = await api.post<ApiResponse<TenantConfig>>(
        '/api/admin/tenant/logo',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30_000 }
      );

      return response.data.data;
    },
    onSuccess: (tenant) => {
      setTenant(tenant);
      queryClient.setQueryData(tenantConfigQueryKey, tenant);
    },
  });
}

/** Récupère les paramètres métier et créneaux de pointage du tenant connecté. */
export function useAttendanceRuleSettings(horaireId: number | null = null) {
  return useQuery({
    queryKey: [...attendanceRuleSettingsQueryKey, horaireId],
    queryFn: async () => {
      const response = await api.get<ApiResponse<AttendanceRuleSettings>>(
        '/api/admin/tenant/pointage-parametres',
        { params: horaireId === null ? undefined : { horaire_id: horaireId } }
      );
      return response.data.data;
    },
    staleTime: 60_000,
  });
}

/** Enregistre ensemble les paramètres métier et les créneaux du tenant connecté. */
export function useUpdateAttendanceRuleSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AttendanceRuleSettingsUpdate) => {
      const response = await api.put<ApiResponse<AttendanceRuleSettings>>(
        '/api/admin/tenant/pointage-parametres',
        data
      );
      return response.data.data;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData([...attendanceRuleSettingsQueryKey, settings.horaire_id], settings);
      void queryClient.invalidateQueries({ queryKey: attendanceRuleSettingsQueryKey });
    },
  });
}

/** Recalcule une journée dans le périmètre du tenant connecté. */
export function useRecalculateAttendanceDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ date, employe_id }: { date: string; employe_id?: number }) => {
      const response = await api.post<ApiResponse<AttendanceRecalculationResult>>(
        '/api/pointages/journee/recalculer',
        { date, ...(employe_id ? { employe_id } : {}) }
      );

      return response.data.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'kpis'] }),
        queryClient.invalidateQueries({ queryKey: ['pointages', 'stats-presence'] }),
        queryClient.invalidateQueries({ queryKey: ['profile', 'attendance'] }),
      ]);
    },
  });
}

/** Prévisualise le résultat journalier sans persister de projection. */
export function usePreviewAttendanceDay() {
  return useMutation({
    mutationFn: async ({ date, employe_id }: { date: string; employe_id: number }) => {
      const response = await api.post<ApiResponse<AttendanceDayPreviewResult>>(
        '/api/pointages/journee/recalculer',
        { date, employe_id, action: 'previsualiser' }
      );

      return response.data.data;
    },
  });
}

/** Compare les règles actuelles à une proposition sur une période sans persister de calcul. */
export function useCompareAttendanceRules() {
  return useMutation({
    mutationFn: async (data: {
      date_debut: string;
      date_fin: string;
      employe_id: number;
      horaire_id: number | null;
      actif_regles_nouvelles: boolean;
      parametres: Record<string, number | string>;
      creneaux: Omit<AttendanceSlot, 'id' | 'tenant_id' | 'actif'>[];
    }) => {
      const response = await api.post<ApiResponse<AttendanceRuleComparisonResult>>(
        '/api/pointages/journee/comparer-regles',
        data
      );

      return response.data.data;
    },
  });
}
