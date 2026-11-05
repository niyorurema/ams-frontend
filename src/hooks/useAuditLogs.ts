'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export interface AuditLogEntry {
  id: number;
  tenant_id: number | null;
  tenant_name: string | null;
  actor_id: number | null;
  actor_name: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  object_type: string;
  object_id: string | null;
  occurred_at: string;
  before_values: Record<string, unknown> | null;
  after_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  source: 'API' | 'DEVICE' | 'SYSTEM' | string;
  device_id: number | null;
}

export interface AuditLogFilters {
  tenant_id?: number;
  actor_id?: number;
  action?: string;
  object_type?: string;
  object_id?: string;
  device_id?: number;
  request_id?: string;
  date_debut?: string;
  date_fin?: string;
  limit: number;
  offset: number;
}

export interface AuditLogsPage {
  items: AuditLogEntry[];
  pagination: { limit: number; offset: number; total: number };
}

export function useAuditLogs(filters: AuditLogFilters, enabled = true) {
  return useQuery({
    queryKey: ['admin-audit-logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(filters.limit),
        offset: String(filters.offset),
      });
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== '' && key !== 'limit' && key !== 'offset') {
          params.set(key, String(value));
        }
      }

      const response = await api.get<ApiResponse<AuditLogsPage>>(
        `/api/admin/audit-logs?${params.toString()}`,
      );
      return response.data.data;
    },
    enabled,
    staleTime: 15_000,
  });
}
