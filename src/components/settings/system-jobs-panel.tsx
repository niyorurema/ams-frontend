'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useQueueSystemJobRetry, useSystemJobs, type SystemJobRun } from '@/hooks/useSystemJobs';
import { getErrorMessage } from '@/lib/api';

function peutRelancer(job: SystemJobRun): boolean {
  return ['ERROR', 'PARTIAL', 'STALE'].includes(job.status)
    && ['rapports:envoyer-quotidiens', 'gpio:sync-obr', 'capteurs:sync-attendance'].includes(job.task_key)
    && !job.retry_status;
}

export function SystemJobsPanel() {
  const t = useTranslations('parametres.integrations');
  const query = useSystemJobs();
  const queueRetry = useQueueSystemJobRetry();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const jobs = useMemo(() => (query.data?.runs ?? []).filter((job) => {
    const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;
    const needle = search.trim().toLocaleLowerCase();
    const matchesSearch = !needle || [
      job.task_key,
      job.scope_id,
      job.error_message,
      job.retry_error_message,
    ].some((value) => String(value ?? '').toLocaleLowerCase().includes(needle));
    return matchesStatus && matchesSearch;
  }), [query.data?.runs, search, statusFilter]);

  const relancer = async (job: SystemJobRun) => {
    try {
      await queueRetry.mutateAsync(job.id);
      toast.success(t('jobQueued'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{t('jobsTitle')}</CardTitle>
          <CardDescription>{t('jobsDescription')}</CardDescription>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <RefreshCw aria-hidden="true" className="size-4" />}
          {t('refreshJobs')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p role="note" className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          {t('retrySafetyNotice')}
        </p>
        {query.data?.alerts.length ? (
          <section aria-label={t('jobAlertsTitle')} className="space-y-2" role="alert">
            <h3 className="font-semibold">{t('jobAlertsTitle')}</h3>
            {query.data.alerts.map((alert, index) => (
              <p key={`${alert.key}-${alert.task_key ?? 'queue'}-${index}`} className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <Badge variant="destructive" className="mr-2">{t(`jobSeverities.${alert.severity}`)}</Badge>
                {t(`jobAlerts.${alert.key}`, { count: alert.count, task: alert.task_key ?? '' })}
              </p>
            ))}
          </section>
        ) : null}
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('loadingJobs')}</p>
        ) : query.isError ? (
          <div className="space-y-2" role="alert">
            <p className="text-sm text-destructive">{getErrorMessage(query.error)}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>{t('retry')}</Button>
          </div>
        ) : query.data?.runs.length ? (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label={t('searchJobs')}
                placeholder={t('searchJobs')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label={t('filterJobStatus')}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">{t('allJobStatuses')}</option>
                {['RUNNING', 'SUCCESS', 'PARTIAL', 'ERROR', 'STALE'].map((status) => (
                  <option key={status} value={status}>{t(`jobStatuses.${status}`)}</option>
                ))}
              </select>
            </div>
            {jobs.map((job) => (
              <article key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{job.task_key}{job.scope_id ? ` · #${job.scope_id}` : ''}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('jobStarted')}: {job.started_at} · {t('jobHeartbeat')}: {job.heartbeat_at}
                    {job.finished_at ? ` · ${t('jobFinished')}: ${job.finished_at}` : ''}
                  </p>
                  {job.error_message && <p className="break-words text-sm text-destructive">{job.error_message}</p>}
                  {job.retry_status && (
                    <p className="text-xs text-muted-foreground">{t('retryStatus')}: {t(`jobStatuses.${job.retry_status}`)}</p>
                  )}
                  {job.retry_error_message && <p className="break-words text-sm text-destructive">{job.retry_error_message}</p>}
                  {job.retry_requested_by ? <p className="text-xs text-muted-foreground">{t('retryRequestedBy')}: #{job.retry_requested_by}</p> : null}
                  {Object.keys(job.summary).length ? (
                    <details className="pt-1">
                      <summary className="cursor-pointer text-xs text-muted-foreground">{t('jobSummary')}</summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(job.summary.result ?? job.summary, null, 2)}</pre>
                    </details>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={job.status === 'SUCCESS' ? 'default' : job.status === 'RUNNING' ? 'secondary' : 'destructive'}>
                    {t(`jobStatuses.${job.status}`)}
                  </Badge>
                  {peutRelancer(job) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={queueRetry.isPending}
                      onClick={() => void relancer(job)}
                    >
                      {queueRetry.isPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <RotateCcw aria-hidden="true" className="size-4" />}
                      {t('queueRetry')}
                    </Button>
                  )}
                </div>
              </article>
            ))}
            {!jobs.length ? <p className="py-4 text-center text-sm text-muted-foreground">{t('noJobsMatching')}</p> : null}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('noJobs')}</p>
        )}
      </CardContent>
    </Card>
  );
}
