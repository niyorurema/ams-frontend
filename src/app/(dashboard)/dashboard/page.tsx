'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import { Activity, Clock, Fingerprint, Gauge, LogOut, TrendingUp, UserX, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertesJour } from '@/components/dashboard/alertes-jour';
import { AttendanceChart } from '@/components/dashboard/attendance-chart';
import { InactiveCapteurs } from '@/components/dashboard/inactive-capteurs';
import { ShiftsWidget } from '@/components/dashboard/shifts-widget';
import { TopUnites } from '@/components/dashboard/top-unites';
import { useDashboardKpis } from '@/hooks/useDashboardKpis';
import { usePreferencesStore } from '@/stores/preferencesStore';

/** Tableau de bord alimenté par une seule requête KPI tenant-scoped. */
export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tPointages = useTranslations('pointages');
  const tPreferences = useTranslations('preferences');
  const locale = useLocale();
  const dateLocale = locale === 'fr' ? fr : enGB;
  const widgets = usePreferencesStore((state) => state.widgets);
  const dashboardKpis = useDashboardKpis();
  const kpis = dashboardKpis.data;
  const tauxPresence = kpis?.employes.attendus_aujourdhui
    ? `${Math.min(100, Math.max(0, Math.round(kpis.employes.presents / kpis.employes.attendus_aujourdhui * 100)))}%`
    : t('noScheduleData');
  const tauxPonctualite = kpis?.employes.presents
    ? `${Math.round(
      Math.max(0, kpis.employes.presents - kpis.employes.en_retard)
      / kpis.employes.presents * 100
    )}%`
    : '—';
  const stats = [
    { id: 'stats-employes', key: 'totalEmployes', value: kpis?.employes.total, icon: Users, color: 'text-primary' },
    { id: 'stats-pointages', key: 'pointagesAujourdhui', value: kpis?.pointages.aujourdhui, icon: Clock, color: 'text-secondary-foreground' },
    { id: 'stats-capteurs', key: 'capteursActifs', value: kpis?.capteurs.actifs, icon: Fingerprint, color: 'text-primary' },
    { id: 'stats-presence', key: 'tauxPresence', value: tauxPresence, icon: TrendingUp, color: 'text-secondary-foreground' },
    { id: 'stats-retards', key: 'retardsAujourdhui', value: kpis?.employes.en_retard, icon: Clock, color: 'text-amber-600' },
    { id: 'stats-heures-sup', key: 'heuresSupMois', value: kpis?.heures_sup.mois_en_cours, icon: TrendingUp, color: 'text-primary', suffix: ' h' },
    { id: 'stats-absents-attendus', key: 'absentsAttendus', value: kpis?.employes.absents, icon: UserX, color: 'text-destructive' },
    { id: 'stats-ponctualite', key: 'tauxPonctualite', value: tauxPonctualite, icon: Gauge, color: 'text-emerald-600' },
  ] as const;
  const visibleWidgets = [...widgets]
    .filter((widget) => widget.visible)
    .sort((first, second) => first.order - second.order);
  const statsByWidget = new Map<string, (typeof stats)[number]>(
    stats.map((stat) => [stat.id, stat]),
  );

  const variationPresents = kpis?.comparaison_hier
    ? kpis.employes.presents - kpis.comparaison_hier.presents
    : null;

  return (
    <div className="w-full space-y-6">
      {visibleWidgets.length > 0 ? (
        <section
          aria-label={t('title')}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {visibleWidgets.map((widget) => {
            const stat = statsByWidget.get(widget.id);
            if (stat) {
              const Icon = stat.icon;
              const href = stat.id === 'stats-employes' || stat.id === 'stats-retards'
                ? '/employes'
                : stat.id === 'stats-capteurs'
                  ? '/capteurs'
                  : stat.id === 'stats-pointages' || stat.id === 'stats-presence' || stat.id === 'stats-ponctualite'
                    ? '/pointages'
                    : stat.id === 'stats-absents-attendus'
                      ? '/employes'
                    : '/parametres/pointages';
              return (
                <Link key={widget.id} href={href} className="block rounded-xl transition-transform hover:-translate-y-0.5">
                <Card data-widget-id={widget.id} className="h-full cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t(stat.key)}
                    </CardTitle>
                    <Icon aria-hidden="true" className={`size-4 shrink-0 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    {dashboardKpis.isLoading ? (
                      <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                    ) : dashboardKpis.isError ? (
                      <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>
                    ) : (
                      <p className="text-2xl font-semibold tabular-nums">
                        {typeof stat.value === 'number'
                          ? `${new Intl.NumberFormat().format(stat.value)}${'suffix' in stat ? stat.suffix : ''}`
                          : stat.value}
                      </p>
                    )}
                    {!dashboardKpis.isLoading && !dashboardKpis.isError && stat.id === 'stats-presence' && variationPresents !== null && (
                      <p className={`mt-1 text-xs ${variationPresents >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                        {variationPresents >= 0 ? '+' : ''}{variationPresents} présence(s) par rapport à hier
                      </p>
                    )}
                    {!dashboardKpis.isLoading && !dashboardKpis.isError && stat.id === 'stats-pointages' && kpis && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {kpis.pointages.entrees} entrées · {kpis.pointages.sorties} sorties
                      </p>
                    )}
                  </CardContent>
                </Card>
                </Link>
              );
            }

            if (widget.id === 'chart-evolution') {
              return (
                <AttendanceChart
                  key={widget.id}
                  days={kpis?.evolution_presence ?? []}
                  isLoading={dashboardKpis.isLoading}
                  isError={dashboardKpis.isError}
                  latestDate={kpis?.date}
                />
              );
            }

            if (widget.id === 'capteurs-inactifs') {
              return (
                <InactiveCapteurs
                  key={widget.id}
                  capteurs={kpis?.capteurs.indisponibles ?? []}
                  isLoading={dashboardKpis.isLoading}
                  isError={dashboardKpis.isError}
                />
              );
            }

            if (widget.id === 'shifts-jour') {
              return (
                <ShiftsWidget
                  key={widget.id}
                  shifts={dashboardKpis.data?.shifts ?? []}
                  isLoading={dashboardKpis.isLoading}
                  isError={dashboardKpis.isError}
                />
              );
            }

            if (widget.id === 'alertes-jour') {
              return (
                <AlertesJour
                  key={widget.id}
                  alertes={kpis?.alertes ?? []}
                  isLoading={dashboardKpis.isLoading}
                  isError={dashboardKpis.isError}
                />
              );
            }

            if (widget.id === 'top-unites-absentes') {
              return (
                <TopUnites
                  key={widget.id}
                  unites={kpis?.top_unites_absentes ?? []}
                  isLoading={dashboardKpis.isLoading}
                  isError={dashboardKpis.isError}
                />
              );
            }

            if (widget.id === 'stats-sante-collecte') {
              const health = kpis?.sante_collecte;
              return (
                <Card key={widget.id} data-widget-id={widget.id} className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('santeCollecte')}
                    </CardTitle>
                    <Activity aria-hidden="true" className={`size-4 shrink-0 ${health?.etat === 'OK' ? 'text-emerald-600' : health?.etat === 'ATTENTION' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  </CardHeader>
                  <CardContent>
                    {dashboardKpis.isLoading ? (
                      <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                    ) : dashboardKpis.isError ? (
                      <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>
                    ) : (
                      <>
                        <p className="text-2xl font-semibold">{t(`collectionHealth.${health?.etat ?? 'UNKNOWN'}`)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('collectionHealthDetails', {
                            online: health?.capteurs_en_ligne ?? 0,
                            offline: health?.capteurs_hors_ligne ?? 0,
                            unknown: health?.capteurs_inconnus ?? 0,
                            total: health?.capteurs_total ?? 0,
                            orphaned: health?.pointages_non_associes ?? 0,
                          })}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            }

            if (widget.id === 'stats-pointages-sans-sortie') {
              return (
                <Card key={widget.id} data-widget-id={widget.id} className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('pointagesSansSortie')}
                    </CardTitle>
                    <LogOut aria-hidden="true" className="size-4 shrink-0 text-amber-600" />
                  </CardHeader>
                  <CardContent>
                    {dashboardKpis.isLoading ? (
                      <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                    ) : dashboardKpis.isError ? (
                      <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>
                    ) : (
                      <p className="text-2xl font-semibold tabular-nums">
                        {new Intl.NumberFormat().format(kpis?.employes.sans_pointage_depart ?? 0)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            }

            if (widget.id === 'derniers-pointages') {
              return (
                <Card key={widget.id} data-widget-id={widget.id} className="sm:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <CardTitle>{t('derniersPointages')}</CardTitle>
                    <Link href="/pointages" className="text-sm text-primary underline-offset-4 hover:underline">
                      {t('voirTout')}
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {dashboardKpis.isLoading ? (
                      <div className="h-56 animate-pulse rounded-md bg-muted" />
                    ) : dashboardKpis.isError ? (
                      <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>
                    ) : kpis?.pointages_recents.length ? (
                      <div className="max-h-56 space-y-2 overflow-y-auto">
                        {kpis.pointages_recents.map((pointage) => {
                          const nom = pointage.employe_nom?.trim()
                            || (pointage.employe_matricule
                              ? tPointages('realtimeMatricule', { matricule: pointage.employe_matricule })
                              : tPointages('realtimeBadge', { badge: pointage.badge_id }));
                          const date = parseISO(pointage.date_pointage.replace(' ', 'T'));

                          return (
                            <div key={pointage.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{nom}</p>
                                <p className="text-xs text-muted-foreground">
                                  {Number.isNaN(date.getTime())
                                    ? tPointages('realtimeDateInvalide')
                                    : format(date, 'dd/MM/yyyy HH:mm', { locale: dateLocale })}
                                </p>
                              </div>
                              <span className="rounded-md bg-muted px-2 py-1 text-xs">
                                {tPointages({
                                  CHECK_IN: 'checkIn',
                                  CHECK_OUT: 'checkOut',
                                  BREAK_IN: 'breakEnd',
                                  BREAK_OUT: 'breakStart',
                                  UNKNOWN: 'inconnu',
                                }[pointage.type_evenement])}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex h-56 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                        {t('aucunPointage')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            }

            return null;
          })}
        </section>
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {tPreferences('noWidgets')}
        </p>
      )}
    </div>
  );
}