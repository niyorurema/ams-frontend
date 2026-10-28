'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export interface SystemJobRun {
  id: number;
  task_key: string;
  scope_id: number | null;
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'ERROR' | 'STALE';
  started_at: string;
  heartbeat_at: string;
  finished_at: string | null;
  summary: Record<string, unknown>;
  error_message: string | null;
  retry_id: number | null;
  retry_status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'ERROR' | null;
  retry_requested_at: string | null;
  retry_started_at: string | null;
  retry_finished_at: string | null;
  retry_requested_by: number | null;
  retry_error_message: string | null;
}

export interface SystemJobAlert {
  key: 'daily_reports_missing' | 'retry_queue_stalled' | 'job_stale' | 'job_failed';
  severity: 'HIGH' | 'MEDIUM';
  task_key: string | null;
  count: number;
}

export interface SystemJobsOverview {
  runs: SystemJobRun[];
  alerts: SystemJobAlert[];
}

const systemJobsKey = ['admin', 'system-jobs'] as const;

export function useSystemJobs(enabled = true) {
  return useQuery({
    queryKey: systemJobsKey,
    queryFn: async () => {
      const response = await api.get<ApiResponse<SystemJobsOverview>>('/api/admin/system/jobs');
      return response.data.data;
    },
    enabled,
    refetchInterval: 30_000,
  });
}

export function useQueueSystemJobRetry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runId: number) => {
      const response = await api.post<ApiResponse<{ id: number; status: string }>>(
        `/api/admin/system/jobs/${runId}/retry`,
        {}
      );
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: systemJobsKey }),
  });
}
