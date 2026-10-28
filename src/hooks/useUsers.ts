'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export type UserRole =
  | 'admin'
  | 'rh'
  | 'superviseur'
  | 'chef_service'
  | 'directeur'
  | 'commissaire'
  | 'lecteur';

export interface ManagedUser {
  id: number;
  tenant_id: number;
  employe_id: number | null;
  email: string | null;
  nom_complet: string;
  telephone: string | null;
  role: UserRole;
  is_active: boolean;
  is_super_admin: boolean;
  webauthn_enrollment_approved: boolean;
  auth_source: 'LOCAL' | 'LDAP';
  derniere_connexion: string | null;
  employe_nom: string | null;
  employe_matricule: string | null;
  employe_poste: string | null;
  unite_nom: string | null;
}

export interface CurrentEmployeeDetails {
  id: number;
  unite_id: number | null;
  unite_nom: string | null;
  poste: string | null;
  est_responsable_unite: boolean;
  matricule: string;
  badge_id: number;
  user_id_capteur: string | null;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  date_embauche: string | null;
  date_depart: string | null;
  genre: 'M' | 'F' | 'AUTRE' | null;
  photo_url: string | null;
  empreinte_enrolee: boolean;
  nb_empreintes: number;
  role_capteur: number;
  actif: boolean;
  derniere_sync: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface UsersFilters {
  search?: string;
  sans_email?: boolean;
  role?: UserRole;
  actif?: '0' | '1';
  limit: number;
  offset: number;
}

export interface UsersPage {
  items: ManagedUser[];
  pagination: { limit: number; offset: number; total: number };
  total: number;
  limit: number;
  offset: number;
}

export interface UserInput {
  email: string;
  nom_complet: string;
  telephone: string | null;
  role: UserRole;
  employe_id: number | null;
  password?: string;
  is_active?: boolean;
  webauthn_enrollment_approved?: boolean;
}

export interface CurrentProfile extends ManagedUser {
  employe_details: CurrentEmployeeDetails | null;
  server_now: string;
  timezone: string;
  password_hash?: never;
}

export interface PersonalAttendanceStep {
  type: string;
  attendu: string;
  reel: string | null;
  ecart_min: number | null;
  statut: string;
}

export interface PersonalAttendanceDay {
  statut: string;
  heures_travaillees: number;
  retard_total_minutes: number;
  pointages_manquants: string[];
  analyse_plages: PersonalAttendanceStep[];
  horaire_nom: string | null;
  jour_ferie?: boolean;
  jour_ferie_nom?: string;
  raison_non_travaille?: string;
  progression_pourcentage: number | null;
  etapes_effectuees: number;
  etapes_attendues: number;
}

export interface PersonalAttendancePunch {
  id: number;
  date_pointage: string;
  type_evenement: string;
  statut_calcul: string;
  source: string;
  capteur: string | null;
}

export interface PersonalAttendanceHistory {
  date_du_jour: string;
  date_courante: string;
  server_now: string;
  timezone: string;
  passkey_registered: boolean;
  passkey_enrollment_approved: boolean;
  employe: { id: number; matricule: string; nom: string; prenom: string; unite: string | null; poste: string | null };
  presence_du_jour: PersonalAttendanceDay;
  pointages_du_jour: PersonalAttendancePunch[];
  pointages: PersonalAttendancePunch[];
  evaluation?: {
    periode: { debut: string; fin: string };
    totaux: {
      retard_total_minutes: number;
      jours_absence: number;
      heures_travaillees_minutes: number;
      jours_anormaux: number;
      pointages_anormaux: number;
    };
    jours: Array<{ date: string; retard_minutes: number; statut: string; heures_travaillees_minutes: number }>;
    anomalies: Array<{ date: string; type: string; statut: string; attendu: string; reel: string | null; ecart_min: number | null }>;
  };
  pagination: { limit: number; offset: number; total: number };
}

export function getUsersErrorMessage(error: unknown): string {
  if (
    typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof error.response === 'object'
    && error.response !== null
    && 'data' in error.response
    && typeof error.response.data === 'object'
    && error.response.data !== null
    && 'message' in error.response.data
    && typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message;
  }
  return error instanceof Error ? error.message : 'Une erreur est survenue.';
}

const usersKey = ['users'] as const;

export function useUsers(filters: UsersFilters, enabled = true) {
  return useQuery({
    queryKey: [
      ...usersKey,
      filters.search ?? '',
      filters.sans_email ?? false,
      filters.role ?? '',
      filters.actif ?? '',
      filters.limit,
      filters.offset,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(filters.limit),
        offset: String(filters.offset),
      });
      if (filters.search) params.set('search', filters.search);
      if (filters.sans_email) params.set('sans_email', '1');
      if (filters.role) params.set('role', filters.role);
      if (filters.actif !== undefined) params.set('actif', filters.actif);

      const response = await api.get<ApiResponse<UsersPage>>(`/api/users?${params}`);
      return response.data.data;
    },
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useUser(id: number, enabled = true) {
  return useQuery({
    queryKey: [...usersKey, id],
    queryFn: async () => {
      const response = await api.get<ApiResponse<ManagedUser>>(`/api/users/${id}`);
      return response.data.data;
    },
    enabled: enabled && id > 0,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UserInput) => {
      const response = await api.post<ApiResponse<ManagedUser>>('/api/users', input);
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<UserInput> & { id: number }) => {
      const response = await api.put<ApiResponse<ManagedUser>>(`/api/users/${id}`, input);
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete<ApiResponse<{ id: number; is_active: number }>>(
        `/api/users/${id}`,
      );
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useResetUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, password }: { id: number; password?: string }) => {
      const response = await api.post<
        ApiResponse<{ message: string; temp_password: string | null }>
      >(`/api/users/${id}/reset-password`, { password });
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useCurrentProfile(enabled = true) {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<CurrentProfile>>('/api/me');
      return response.data.data;
    },
    enabled,
  });
}

export function usePersonalAttendance(
  dateJour: string,
  enabled = true,
  matricule = '',
  periodeDebut = '',
  periodeFin = '',
) {
  const queryHistory = useQuery({
    queryKey: ['profile', 'attendance', dateJour, matricule, 'history'],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '30' });
      if (dateJour) params.set('date_jour', dateJour);
      if (matricule) params.set('matricule', matricule);
      const response = await api.get<ApiResponse<PersonalAttendanceHistory>>(
        `/api/me/historique?${params.toString()}`,
      );
      return response.data.data;
    },
    enabled,
    refetchInterval: 30_000,
  });
  const queryEvaluation = useQuery({
    queryKey: ['profile', 'attendance', dateJour, matricule, 'evaluation', periodeDebut, periodeFin],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1' });
      if (dateJour) params.set('date_jour', dateJour);
      if (matricule) params.set('matricule', matricule);
      params.set('periode_debut', periodeDebut);
      params.set('periode_fin', periodeFin);
      const response = await api.get<ApiResponse<PersonalAttendanceHistory>>(
        `/api/me/historique?${params.toString()}`,
      );
      return response.data.data.evaluation;
    },
    enabled: enabled && Boolean(periodeDebut && periodeFin),
    refetchInterval: false,
  });

  return {
    data: queryHistory.data
      ? { ...queryHistory.data, ...(queryEvaluation.data ? { evaluation: queryEvaluation.data } : {}) }
      : undefined,
    error: queryHistory.error ?? queryEvaluation.error,
    isLoading: queryHistory.isLoading || queryEvaluation.isLoading,
    isError: queryHistory.isError || queryEvaluation.isError,
    isFetching: queryHistory.isFetching || queryEvaluation.isFetching,
    refetch: async () => {
      await Promise.all([queryHistory.refetch(), queryEvaluation.refetch()]);
    },
  };
}

interface PasskeyDescriptor {
  id: string;
  type: 'public-key';
  transports?: AuthenticatorTransport[];
}

interface PasskeyOptions {
  challenge: string;
  timeout?: number;
  rp?: PublicKeyCredentialRpEntity;
  user?: { id: string; name: string; displayName: string };
  pubKeyCredParams?: PublicKeyCredentialParameters[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
  excludeCredentials?: PasskeyDescriptor[];
  allowCredentials?: PasskeyDescriptor[];
  rpId?: string;
  userVerification?: UserVerificationRequirement;
}

function decodeBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function encodeBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function passkeyOptions(data: PasskeyOptions): PublicKeyCredentialCreationOptions {
  if (!data.user || !data.pubKeyCredParams) throw new Error('Invalid passkey registration options.');
  return {
    challenge: decodeBase64Url(data.challenge),
    rp: data.rp ?? { name: 'AMS' },
    user: { ...data.user, id: decodeBase64Url(data.user.id) },
    pubKeyCredParams: data.pubKeyCredParams,
    timeout: data.timeout,
    authenticatorSelection: data.authenticatorSelection,
    attestation: data.attestation,
    excludeCredentials: (data.excludeCredentials ?? []).map((item) => ({
      ...item,
      id: decodeBase64Url(item.id),
    })),
  };
}

function assertionOptions(data: PasskeyOptions): PublicKeyCredentialRequestOptions {
  return {
    challenge: decodeBase64Url(data.challenge),
    rpId: data.rpId,
    timeout: data.timeout,
    userVerification: data.userVerification,
    allowCredentials: (data.allowCredentials ?? []).map((item) => ({
      ...item,
      id: decodeBase64Url(item.id),
    })),
  };
}

function serializeAttestation(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
      attestationObject: encodeBase64Url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
  };
}

function serializeAssertion(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
      authenticatorData: encodeBase64Url(response.authenticatorData),
      signature: encodeBase64Url(response.signature),
      userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : null,
    },
  };
}

export function useRegisterPersonalPasskey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!window.PublicKeyCredential || !navigator.credentials?.create) {
        throw new Error('This browser does not support passkeys.');
      }
      const optionsResponse = await api.post<ApiResponse<{ challenge_id: string; public_key: PasskeyOptions }>>(
        '/api/me/passkeys/registration-options',
      );
      const options = optionsResponse.data.data;
      const credential = await navigator.credentials.create({ publicKey: passkeyOptions(options.public_key) });
      if (!(credential instanceof PublicKeyCredential)) throw new Error('Passkey registration was cancelled.');
      await api.post('/api/me/passkeys/register', {
        challenge_id: options.challenge_id,
        credential: serializeAttestation(credential),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile', 'attendance'] });
    },
  });
}

export function useCreatePersonalPunch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (typeEvenement: string) => {
      if (!window.PublicKeyCredential || !navigator.credentials?.get) {
        throw new Error('This browser does not support passkeys.');
      }
      const optionsResponse = await api.post<ApiResponse<{ challenge_id: string; public_key: PasskeyOptions }>>(
        '/api/me/passkeys/authentication-options',
      );
      const options = optionsResponse.data.data;
      const credential = await navigator.credentials.get({ publicKey: assertionOptions(options.public_key) });
      if (!(credential instanceof PublicKeyCredential)) throw new Error('Passkey verification was cancelled.');
      const response = await api.post<ApiResponse<{ id: number; date_pointage: string }>>(
        '/api/me/pointage',
        {
          type_evenement: typeEvenement,
          challenge_id: options.challenge_id,
          credential: serializeAssertion(credential),
        },
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile', 'attendance'] }),
        queryClient.invalidateQueries({ queryKey: ['pointages'] }),
      ]);
    },
  });
}

export function useUpdateCurrentProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Pick<UserInput, 'email' | 'nom_complet' | 'telephone'>) => {
      const response = await api.put<ApiResponse<CurrentProfile>>('/api/me', input);
      return response.data.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile', 'me'] }),
        queryClient.invalidateQueries({ queryKey: usersKey }),
      ]);
    },
  });
}

export function useChangeOwnPassword() {
  return useMutation({
    mutationFn: async (input: { current_password: string; new_password: string }) => {
      const response = await api.post<ApiResponse<{ changed: boolean }>>(
        '/api/me/change-password',
        input,
      );
      return response.data.data;
    },
  });
}
