'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export interface SystemIntegrationSettings {
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    encryption: 'none' | 'tls' | 'ssl';
    username: string;
    from_email: string;
    from_name: string;
    password_configured: boolean;
    legacy_configuration: boolean;
  };
  gpio: {
    sync_enabled: boolean;
    hostname: string;
    database: string;
    username: string;
    port: number;
    password_configured: boolean;
    legacy_configuration: boolean;
  };
}

export interface SmtpSettingsInput {
  enabled: boolean;
  host: string;
  port: number;
  encryption: 'none' | 'tls' | 'ssl';
  username: string;
  password: string;
  from_email: string;
  from_name: string;
}

export interface GpioSettingsInput {
  sync_enabled: boolean;
  hostname: string;
  database: string;
  username: string;
  password: string;
  port: number;
}

export interface LdapSettings {
  auth_mode: 'LOCAL' | 'LDAP' | 'HYBRIDE';
  ldap_host: string;
  ldap_host_secondary: string;
  ldap_host_tertiary: string;
  ldap_port: number;
  ldap_base_dn: string;
  ldap_bind_dn: string;
  bind_password_configured: boolean;
  ldap_user_filter: string;
  ldap_use_tls: boolean;
  ldap_attr_email: string;
  ldap_attr_nom: string;
  ldap_attr_prenom: string;
  ldap_attr_matricule: string;
  legacy_configuration: boolean;
}

const systemSettingsKey = ['admin', 'integrations'] as const;
const ldapSettingsKey = ['admin', 'tenant', 'ldap'] as const;

export function useSystemIntegrationSettings(enabled = true) {
  return useQuery({
    queryKey: systemSettingsKey,
    queryFn: async () => {
      const response = await api.get<ApiResponse<SystemIntegrationSettings>>('/api/admin/integrations');
      return response.data.data;
    },
    enabled,
  });
}

export function useUpdateSystemIntegrationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { smtp: SmtpSettingsInput } | { gpio: GpioSettingsInput }) => {
      const response = await api.put<ApiResponse<SystemIntegrationSettings>>('/api/admin/integrations', input);
      return response.data.data;
    },
    onSuccess: (settings) => queryClient.setQueryData(systemSettingsKey, settings),
  });
}

export function useTestSmtpConnection() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.post<ApiResponse<{ success: boolean }>>('/api/admin/integrations/smtp/test', {});
      return response.data.data;
    },
  });
}

export function useTestGpioConnection() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.post<ApiResponse<{ success: boolean }>>('/api/admin/integrations/gpio/test', {});
      return response.data.data;
    },
  });
}

export function useLdapSettings(enabled = true) {
  return useQuery({
    queryKey: ldapSettingsKey,
    queryFn: async () => {
      const response = await api.get<ApiResponse<LdapSettings>>('/api/admin/tenant/ldap');
      return response.data.data;
    },
    enabled,
  });
}

export function useUpdateLdapSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<LdapSettings, 'bind_password_configured' | 'legacy_configuration'> & { ldap_bind_password: string }) => {
      const response = await api.put<ApiResponse<LdapSettings>>('/api/admin/tenant/ldap', input);
      return response.data.data;
    },
    onSuccess: (settings) => queryClient.setQueryData(ldapSettingsKey, settings),
  });
}
