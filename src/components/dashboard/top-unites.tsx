'use client';

import { Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardKpis } from '@/hooks/useDashboardKpis';

interface TopUnitesProps {
  unites: DashboardKpis['top_unites_absentes'];
  isLoading: boolean;
  isError: boolean;
}

export function TopUnites({ unites, isLoading, isError }: TopUnitesProps) {
  const t = useTranslations('dashboard.topUnits');

  return (
    <Card data-widget-id="top-unites-absentes" className="sm:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 aria-hidden="true" className="size-5" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isError ? (
          <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>
        ) : unites.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">{t('unit')}</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">{t('rate')}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t('absent')}</th>
                </tr>
              </thead>
              <tbody>
                {unites.map((unite) => (
                  <tr key={unite.unite_id} className="border-b last:border-0">
                    <th scope="row" className="max-w-64 truncate py-2 pr-3 font-medium">{unite.unite}</th>
                    <td className="py-2 pr-3 text-right tabular-nums">{t('rateValue', { rate: unite.taux_absence })}</td>
                    <td className="py-2 text-right tabular-nums">{t('absentCount', { absent: unite.absents, total: unite.total })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
