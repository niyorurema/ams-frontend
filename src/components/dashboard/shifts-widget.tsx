'use client';

import { useTranslations } from 'next-intl';
import { CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardKpis } from '@/hooks/useDashboardKpis';

interface ShiftsWidgetProps {
  shifts: DashboardKpis['shifts'];
  isLoading: boolean;
  isError: boolean;
}

export function ShiftsWidget({ shifts, isLoading, isError }: ShiftsWidgetProps) {
  const t = useTranslations('dashboard.shifts');

  return (
    <Card data-widget-id="shifts-jour" className="sm:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock aria-hidden="true" className="size-5" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : isError ? (
          <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>
        ) : !shifts.length ? (
          <p className="text-sm text-muted-foreground">{t('noShifts')}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {shifts.map((shift) => {
              const assigned = Number(shift.employes_assignes);
              const present = Number(shift.employes_presents);
              const progress = assigned > 0 ? Math.min(100, Math.round((present / assigned) * 100)) : 0;
              return (
                <div key={shift.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: shift.couleur }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{shift.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {shift.heure_debut.slice(0, 5)} – {shift.heure_fin.slice(0, 5)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{t('presenceCount', { present, assigned })}</span>
                    <span className="tabular-nums">{progress}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={t('presenceCount', { present, assigned })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
