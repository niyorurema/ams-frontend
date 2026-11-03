import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/authStore';
import {
  confirmerAvecSweetAlert,
  confirmationHasBeenHandled,
  getMutationConfirmationCopy,
  consommerConfirmationGeree,
} from '@/lib/confirmation';

/** URL de base de l'API, configurable via NEXT_PUBLIC_API_URL. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/** Client Axios configuré pour communiquer avec l'API AMS. */
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30_000,
  withCredentials: true,
});

/** Ajoute les cookies HttpOnly de session aux requêtes authentifiées. */
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const method = String(config.method || 'GET').toUpperCase();
    const url = String(config.url || '').toLowerCase();
    const mutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const safeMutation = !mutatingMethod
      || url.includes('/login') || url.includes('/logout')
      || url.includes('/preview') || url.includes('/test')
      || url.includes('/options') || url.includes('/export')
      || url.includes('/authentication-options') || url.includes('/registration-options');
    const customConfig = config as InternalAxiosRequestConfig & { _amsConfirmationChecked?: boolean };

    if (!safeMutation && !customConfig._amsConfirmationChecked && typeof window !== 'undefined') {
      if (confirmationHasBeenHandled()) {
        consommerConfirmationGeree();
      } else {
        const copy = getMutationConfirmationCopy(method, url);
        const locale = (document.documentElement.lang || 'fr').slice(0, 2);
        const confirmText = locale === 'en' ? 'Confirm' : locale === 'rn' ? 'Emeza' : 'Confirmer';
        const cancelText = locale === 'en' ? 'Cancel' : locale === 'rn' ? 'Reka' : 'Annuler';
        const confirmed = await confirmerAvecSweetAlert(copy.message, {
          title: copy.title, confirmButtonText: confirmText, cancelButtonText: cancelText, destructive: copy.destructive,
        });
        if (!confirmed) return Promise.reject(new axios.CanceledError('Action annulée par l’utilisateur.'));
        consommerConfirmationGeree();
      }
      customConfig._amsConfirmationChecked = true;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

/** Gère les réponses d'erreur courantes de l'API. */
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;

    if (status === 401) {
      useAuthStore.getState().clearAuth();
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.includes('/login')
      ) {
        window.dispatchEvent(new Event('ams:unauthorized'));
      }
    }

    if (status === 403) {
      console.warn('Accès interdit :', error.config?.url);
    }

    if (status && status >= 500) {
      console.error('Erreur serveur :', error.response?.data);
    }

    return Promise.reject(error);
  }
);

/** Réponse API standardisée. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

/** Réponse paginée de l'API. */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/** Erreur renvoyée par l'API. */
export interface ApiError {
  success?: false;
  error?: string;
  message?: string;
  code?: string;
}

/** Extrait un message lisible depuis une erreur Axios ou JavaScript. */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined;
    return data?.message || data?.error || error.message || 'Une erreur est survenue';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Une erreur inconnue est survenue';
}

