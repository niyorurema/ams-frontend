import type { User } from '@/stores/authStore';

export type { User } from '@/stores/authStore';

export interface LoginCredentials {
  tenant_id: number;
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  expires_in: number;
  auth_source?: 'LOCAL' | 'LDAP';
}