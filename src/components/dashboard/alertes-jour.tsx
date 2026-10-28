'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardKpis } from '@/hooks/useDashboardKpis';

interface AlertesJourProps {
  alertes: DashboardKpis['alertes'];
  isLoading: boolean;
  isError: boolean;
}

export function AlertesJour({ alertes, isLoading, isError }: AlertesJourProps) {
  const t = useTranslations('dashboard.alertes');

  return (
    <Card data-widget-id="alertes-jour" className="sm:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="size-5 text-amber-600" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : isError ? (
          <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>
        ) : alertes.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            {t('empty')}
          </p>
        ) : alertes.map((alerte, index) => (
          <div
            key={`${alerte.type}-${alerte.capteur ?? 'general'}-${index}`}
            className={`rounded-md border-l-4 p-3 text-sm ${
              alerte.severite === 'danger'
                ? 'border-l-destructive bg-destructive/5 text-destructive'
                : 'border-l-amber-500 bg-amber-500/5 text-amber-800 dark:text-amber-300'
            }`}
          >
            {alerte.type === 'SANS_DEPART'
              ? t('missingDepartures', { count: alerte.count })
              : alerte.type === 'ORPHELINS'
                ? t('orphans', { count: alerte.count, sensor: alerte.capteur || t('unknownSensor') })
                : t('missingContracts')}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
