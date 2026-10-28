'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2, Power, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEnableCapteur, useRestartCapteur, useTestCapteur } from '@/hooks/useCapteurs';
import type { DashboardKpis } from '@/hooks/useDashboardKpis';

interface InactiveCapteursProps {
  capteurs: DashboardKpis['capteurs']['indisponibles'];
  isLoading: boolean;
  isError: boolean;
}

/** Affiche les capteurs désactivés ou hors ligne avec leurs actions réseau. */
export function InactiveCapteurs({ capteurs, isLoading, isError }: InactiveCapteursProps) {
  const t = useTranslations('dashboard.inactiveCapteurs');
  const testMutation = useTestCapteur();
  const restartMutation = useRestartCapteur();
  const enableMutation = useEnableCapteur();
  const [actionCapteurId, setActionCapteurId] = useState<number | null>(null);

  async function tester(capteur: DashboardKpis['capteurs']['indisponibles'][number]) {
    setActionCapteurId(capteur.id);
    try {
      await testMutation.mutateAsync(capteur.id);
      toast.success(t('testSuccess', { nom: capteur.nom }));
    } catch {
      toast.error(t('testError', { nom: capteur.nom }));
    } finally {
      setActionCapteurId(null);
    }
  }

  async function redemarrer(capteur: DashboardKpis['capteurs']['indisponibles'][number]) {
    setActionCapteurId(capteur.id);
    try {
      await restartMutation.mutateAsync(capteur.id);
      toast.success(t('restartSuccess', { nom: capteur.nom }));
    } catch {
      toast.error(t('restartError', { nom: capteur.nom }));
    } finally {
      setActionCapteurId(null);
    }
  }

  async function activer(capteur: DashboardKpis['capteurs']['indisponibles'][number]) {
    setActionCapteurId(capteur.id);
    try {
      await enableMutation.mutateAsync(capteur.id);
      toast.success(t('enableSuccess', { nom: capteur.nom }));
    } catch {
      toast.error(t('enableError', { nom: capteur.nom }));
    } finally {
      setActionCapteurId(null);
    }
  }

  return (
    <Card data-widget-id="capteurs-inactifs" className="sm:col-span-2">
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${capteurs.length ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-400'}`}>
          {capteurs.length ? <AlertCircle aria-hidden="true" className="size-5" /> : <CheckCircle2 aria-hidden="true" className="size-5" />}
          {t('title')}
          {!isLoading && !isError && <Badge variant={capteurs.length ? 'destructive' : 'outline'} className="ml-auto">{capteurs.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isError ? (
          <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>
        ) : capteurs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('allActive')}</p>
        ) : (
          capteurs.map((capteur) => {
            const pending = actionCapteurId === capteur.id;
            return (
              <div key={capteur.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <WifiOff aria-hidden="true" className="size-4 shrink-0 text-destructive" />
                    <span className="truncate font-medium">{capteur.nom}</span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{capteur.adresse_ip}:{capteur.port}</p>
                  <Badge variant={capteur.statut === 'INACTIF' ? 'outline' : 'destructive'}>{t(`statuses.${capteur.statut}`)}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" title={t('test')} aria-label={t('test')} disabled={actionCapteurId !== null} onClick={() => void tester(capteur)}>
                    <Wifi aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">{t('test')}</span>
                  </Button>
                  {capteur.statut === 'INACTIF' && (
                    <Button type="button" variant="outline" size="sm" title={t('enable')} aria-label={t('enable')} disabled={actionCapteurId !== null} onClick={() => void activer(capteur)}>
                      <Power aria-hidden="true" />
                      <span className="sr-only sm:not-sr-only">{t('enable')}</span>
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" title={t('restart')} aria-label={t('restart')} disabled={actionCapteurId !== null} onClick={() => void redemarrer(capteur)}>
                    <RefreshCw aria-hidden="true" className={pending ? 'animate-spin' : undefined} />
                    <span className="sr-only sm:not-sr-only">{t('restart')}</span>
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
