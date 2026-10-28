'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export interface AdminTenant {
  id: number;
  name: string;
  slug: string;
  contact_email: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  deleted_at: string | null;
  employee_count: number;
  user_count?: number;
}

export interface AdminTenantsFilters {
  search?: string;
  actif?: '0' | '1';
  limit: number;
  offset: number;
}

export interface AdminTenantsPage {
  items: AdminTenant[];
  pagination: { limit: number; offset: number; total: number };
}

export interface AdminTenantInput {
  name: string;
  slug: string;
  contact_email: string;
  timezone: string;
  admin_nom_complet?: string;
  admin_email?: string;
  admin_password?: string;
  is_active?: boolean;
}

export interface CreatedAdminTenant {
  tenant: AdminTenant;
  admin: { id: number; email: string };
  temporary_password: string | null;
}

export function getAdminTenantsErrorMessage(error: unknown): string {
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

const tenantsKey = ['admin-tenants'] as const;

export function useAdminTenants(filters: AdminTenantsFilters, enabled = true) {
  return useQuery({
    queryKey: [...tenantsKey, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(filters.limit),
        offset: String(filters.offset),
      });
      if (filters.search) params.set('search', filters.search);
      if (filters.actif) params.set('actif', filters.actif);

      const response = await api.get<ApiResponse<AdminTenantsPage>>(
        `/api/admin/tenants?${params}`,
      );
      return response.data.data;
    },
    enabled,
  });
}

export function useTenant(id: number, enabled = true) {
  return useQuery({
    queryKey: [...tenantsKey, 'detail', id],
    queryFn: async () => {
      const response = await api.get<ApiResponse<AdminTenant>>(`/api/admin/tenants/${id}`);
      return response.data.data;
    },
    enabled: enabled && id > 0,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminTenantInput) => {
      const response = await api.post<ApiResponse<CreatedAdminTenant>>('/api/admin/tenants', input);
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tenantsKey }),
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<AdminTenantInput> & { id: number }) => {
      const response = await api.put<ApiResponse<AdminTenant>>(`/api/admin/tenants/${id}`, input);
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tenantsKey }),
  });
}

export function useDeactivateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete<ApiResponse<{ id: number; is_active: boolean }>>(
        `/api/admin/tenants/${id}`,
      );
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tenantsKey }),
  });
}
