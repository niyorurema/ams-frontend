import { api } from '@/lib/api';
import { useAuthStore, type User } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';

/** Données de connexion envoyées au backend. */
export interface LoginCredentials {
  email: string;
  password: string;
}

/** Réponse du backend après une connexion réussie. */
export interface LoginResponse {
  user: User;
  access_token: string;
  auth_source: 'LOCAL' | 'LDAP';
}

/** Connecte un utilisateur et enregistre sa session dans le store. */
export async function login(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  const response = await api.post<{ success: boolean; data: LoginResponse }>(
    '/api/auth/login',
    credentials
  );

  const { user, access_token } = response.data.data;
  useTenantStore.getState().clearTenant();
  useAuthStore.getState().setAuth(user, access_token);

  return response.data.data;
}

/** Déconnecte l'utilisateur et efface toujours la session locale. */
export async function logout(): Promise<void> {
  try {
    await api.post('/api/auth/logout');
  } catch (error) {
    console.warn('Erreur lors du logout :', error);
  } finally {
    useTenantStore.getState().clearTenant();
    useAuthStore.getState().clearAuth();
  }
}

/** Récupère le profil de l'utilisateur connecté. */
export async function fetchCurrentUser(): Promise<User> {
  const response = await api.get<{ success: boolean; data: User }>(
    '/api/employe/moi'
  );

  return response.data.data;
}