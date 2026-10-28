'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowUpRight, Clock3, Fingerprint, History, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getUsersErrorMessage, useCreatePersonalPunch, useCurrentProfile, usePersonalAttendance, useRegisterPersonalPasskey } from '@/hooks/useUsers';
import { useAuthStore } from '@/stores/authStore';

function dateDecalee(date: string, jours: number): string {
  const valeur = new Date(`${date}T12:00:00`);
  valeur.setDate(valeur.getDate() + jours);
  return `${valeur.getFullYear()}-${String(valeur.getMonth() + 1).padStart(2, '0')}-${String(valeur.getDate()).padStart(2, '0')}`;
}

function dateDansFuseau(instant: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
}

function duree(minutesTotales: number, heures: string, minutesLabel: string): string {
  const minutes = Math.max(0, Math.round(minutesTotales));
  return `${Math.floor(minutes / 60)} ${heures} ${minutes % 60} ${minutesLabel}`;
}

function formatDate(value: string | null, locale: string, empty: string): string {
  if (!value) return empty;
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime())
    ? empty
    : new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      ...(value.length > 10 ? { timeStyle: 'short' as const } : {}),
    }).format(parsed);
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  const displayValue = value === null || value === undefined || value === '' ? '—' : value;

  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{displayValue}</dd>
    </div>
  );
}

function formatTime(value: string): string {
  const match = value.match(/[T ](\d{2}:\d{2}:\d{2})/);
  return match?.[1] ?? '—';
}

export default function MonDossierPage() {
  const t = useTranslations('monDossier');
  const tDashboard = useTranslations('dashboard');
  const locale = useLocale();
  const user = useAuthStore((state) => state.user);
  const isLecteur = user?.role === 'lecteur';
  const [dateSelectionnee, setDateSelectionnee] = useState('');
  const [matriculeSaisi, setMatriculeSaisi] = useState('');
  const [matriculeRecherche, setMatriculeRecherche] = useState('');
  const [periodeFin, setPeriodeFin] = useState('');
  const [periodeDebut, setPeriodeDebut] = useState('');
  const [serverClock, setServerClock] = useState<number | null>(null);
  const profileQuery = useCurrentProfile(Boolean(user));
  const canSearchMatricule = user?.is_super_admin === true
    || user?.role === 'admin'
    || ['chef_service', 'directeur', 'commissaire', 'superviseur'].includes(user?.role ?? '');
  const peutConsulterPresence = Boolean(profileQuery.data?.employe_id)
    || (canSearchMatricule && matriculeRecherche !== '');
  const dateAujourdhui = profileQuery.data
    ? serverClock === null
      ? profileQuery.data.server_now.slice(0, 10)
      : dateDansFuseau(serverClock, profileQuery.data.timezone)
    : '';
  const dateConsultee = dateSelectionnee || dateAujourdhui;
  const periodeFinEffective = periodeFin || dateAujourdhui;
  const periodeDebutEffective = periodeDebut || (dateAujourdhui ? dateDecalee(dateAujourdhui, -30) : '');
  const attendanceQuery = usePersonalAttendance(
    dateConsultee,
    peutConsulterPresence,
    matriculeRecherche,
    periodeDebutEffective,
    periodeFinEffective,
  );
  const createPersonalPunch = useCreatePersonalPunch();
  const registerPasskey = useRegisterPersonalPasskey();

  useEffect(() => {
    const serverNow = attendanceQuery.data?.server_now;
    if (!serverNow) return;
    const serverEpoch = Date.parse(serverNow);
    if (!Number.isFinite(serverEpoch)) return;
    const receivedAt = Date.now();
    const initialClock = window.setTimeout(() => setServerClock(serverEpoch + Date.now() - receivedAt), 0);
    const interval = window.setInterval(() => setServerClock(serverEpoch + Date.now() - receivedAt), 1000);
    return () => {
      window.clearTimeout(initialClock);
      window.clearInterval(interval);
    };
  }, [attendanceQuery.data?.server_now]);

  if (profileQuery.isLoading) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <Card className="w-full">
        <CardContent className="space-y-4 pt-6">
          <p role="alert" className="text-sm text-destructive">
            {getUsersErrorMessage(profileQuery.error)}
          </p>
          <button
            type="button"
            onClick={() => void profileQuery.refetch()}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('retry')}
          </button>
        </CardContent>
      </Card>
    );
  }

  const profile = profileQuery.data;
  const employee = profile.employe_details;
  const nextExpected = dateConsultee === dateAujourdhui
    && !matriculeRecherche
    && attendanceQuery.data?.passkey_registered
    ? attendanceQuery.data?.presence_du_jour.analyse_plages.find((step) => step.statut === 'MANQUANT')?.type
    : undefined;
  const instantServeur = serverClock === null ? null : new Date(serverClock);
  const heureServeur = instantServeur && attendanceQuery.data
    ? new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: attendanceQuery.data.timezone,
    }).format(instantServeur)
    : null;
  const employeCible = attendanceQuery.data?.employe;

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isLecteur ? tDashboard('title') : t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLecteur ? t('dashboardDescription') : t('description')}
          </p>
        </div>
        <Link
          href="/parametres/profil"
          className="inline-flex min-h-9 items-center justify-center gap-2 self-start rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted sm:self-auto"
        >
          {t('editProfile')}
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      </header>

      {peutConsulterPresence ? (
        <section aria-labelledby="personal-attendance-title" className="space-y-6">
          {attendanceQuery.isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : attendanceQuery.isError || !attendanceQuery.data ? (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                <p role="alert" className="text-sm text-destructive">
                  {getUsersErrorMessage(attendanceQuery.error)}
                </p>
                <button
                  type="button"
                  onClick={() => void attendanceQuery.refetch()}
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
                >
                  <RefreshCw aria-hidden="true" className="size-4" />
                  {t('refresh')}
                </button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle id="personal-attendance-title" className="flex items-center gap-2">
                      <Clock3 aria-hidden="true" className="size-5" />
                      {t('attendanceTitle')}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                      <span>{formatDate(attendanceQuery.data.date_du_jour, locale, t('notAvailable'))}</span>
                      {heureServeur && <time className="font-mono tabular-nums" aria-label={t('serverClock', { timezone: attendanceQuery.data.timezone })}>{heureServeur}</time>}
                      {attendanceQuery.data.presence_du_jour.horaire_nom && <span>· {attendanceQuery.data.presence_du_jour.horaire_nom}</span>}
                      {employeCible && <span>· {employeCible.prenom} {employeCible.nom}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="grid gap-1 text-xs text-muted-foreground">
                      {t('situationDate')}
                      <Input
                        type="date"
                        max={dateAujourdhui}
                        value={dateConsultee}
                        onChange={(event) => setDateSelectionnee(event.target.value)}
                        className="w-40"
                      />
                    </label>
                    <label className="grid gap-1 text-xs text-muted-foreground">
                      {t('employeeMatricule')}
                      <Input
                        value={canSearchMatricule ? matriculeSaisi : (employee?.matricule ?? '')}
                        readOnly={!canSearchMatricule}
                        disabled={!canSearchMatricule}
                        onChange={(event) => setMatriculeSaisi(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && canSearchMatricule) {
                            event.preventDefault();
                            setMatriculeRecherche(matriculeSaisi.trim());
                          }
                        }}
                        placeholder={canSearchMatricule ? t('searchMatriculePlaceholder') : undefined}
                        className="w-40"
                      />
                    </label>
                    {canSearchMatricule && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMatriculeRecherche(matriculeSaisi.trim());
                          setDateSelectionnee(dateAujourdhui);
                        }}
                      >
                        <Search aria-hidden="true" className="size-4" />
                        {t('searchEmployee')}
                      </Button>
                    )}
                    {dateConsultee !== dateAujourdhui && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setDateSelectionnee(dateAujourdhui)}>
                        {t('today')}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void attendanceQuery.refetch()}
                      disabled={attendanceQuery.isFetching}
                    >
                      <RefreshCw aria-hidden="true" className={`size-4 ${attendanceQuery.isFetching ? 'animate-spin' : ''}`} />
                      {t('refresh')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">{t('attendanceStatus')}</p>
                      <p className="mt-2 font-semibold">{t(`attendanceStatuses.${attendanceQuery.data.presence_du_jour.statut}`)}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">{t('workedHours')}</p>
                      <p className="mt-2 font-semibold tabular-nums">{duree(attendanceQuery.data.presence_du_jour.heures_travaillees * 60, t('hours'), t('minutes'))}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">{t('lateMinutes')}</p>
                      <p className="mt-2 font-semibold tabular-nums">{attendanceQuery.data.presence_du_jour.retard_total_minutes} {t('minutes')}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">{t('punchesOnDate')}</p>
                      <p className="mt-2 font-semibold tabular-nums">{attendanceQuery.data.pointages_du_jour.length}</p>
                    </div>
                  </div>

                  {attendanceQuery.data.presence_du_jour.progression_pourcentage === null ? (
                    <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                      {attendanceQuery.data.presence_du_jour.statut === 'REPOS'
                        ? t('noScheduleForDate')
                        : attendanceQuery.data.presence_du_jour.statut === 'FERIE'
                          ? t('holidayOnDate', { name: attendanceQuery.data.presence_du_jour.jour_ferie_nom ?? '' })
                          : t('noScheduleAvailableForDate')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{t('dailyProgress')}</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {attendanceQuery.data.presence_du_jour.progression_pourcentage}% · {t('checkpointsCompleted', {
                            completed: attendanceQuery.data.presence_du_jour.etapes_effectuees,
                            total: attendanceQuery.data.presence_du_jour.etapes_attendues,
                          })}
                        </p>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={t('dailyProgress')}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={attendanceQuery.data.presence_du_jour.progression_pourcentage}
                        className="h-3 overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-500"
                          style={{ width: `${attendanceQuery.data.presence_du_jour.progression_pourcentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {attendanceQuery.data.presence_du_jour.analyse_plages.length > 0 && (
                    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {attendanceQuery.data.presence_du_jour.analyse_plages.map((step, index) => (
                        <li key={`${step.type}-${index}`} className="flex min-w-0 items-start gap-3 rounded-lg border p-3">
                          <span className={`mt-1 size-2.5 shrink-0 rounded-full ${step.statut === 'MANQUANT' ? 'bg-muted-foreground/40' : 'bg-primary'}`} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{t(`punchTypes.${step.type}`)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t('expectedAt')}: {step.attendu || '—'}
                              {step.reel ? ` · ${t('recordedAt')}: ${step.reel}` : ''}
                            </p>
                            <p className="mt-1 text-xs font-medium">
                              {step.statut === 'MANQUANT'
                                ? t('missingPunch')
                                : step.statut === 'A_VENIR'
                                  ? t('upcomingPunch')
                                : step.statut === 'RETARD'
                                  ? t('latePunch', { minutes: step.ecart_min ?? 0 })
                                  : t('recorded')}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  {dateConsultee === dateAujourdhui && !matriculeRecherche && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                      <div>
                        <p className="font-medium">{attendanceQuery.data.passkey_registered ? t('manualPunchTitle') : t('passkeyRequired')}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {attendanceQuery.data.passkey_registered
                            ? t('manualPunchDescription')
                            : attendanceQuery.data.passkey_enrollment_approved
                              ? t('passkeyDescription')
                              : t('passkeyAwaitingApproval')}
                        </p>
                      </div>
                      {attendanceQuery.data.passkey_registered ? (
                        <Button
                          type="button"
                          disabled={!nextExpected || createPersonalPunch.isPending}
                          onClick={() => {
                            if (!nextExpected) return;
                            void createPersonalPunch.mutateAsync(nextExpected)
                              .then(() => toast.success(t('punchSuccess')))
                              .catch((error: unknown) => toast.error(getUsersErrorMessage(error)));
                          }}
                        >
                          <Clock3 aria-hidden="true" />
                          {createPersonalPunch.isPending
                            ? t('punching')
                            : nextExpected
                              ? t('markPunch', { type: t(`punchTypes.${nextExpected}`) })
                              : t('noPunchExpected')}
                        </Button>
                      ) : attendanceQuery.data.passkey_enrollment_approved ? (
                        <Button
                          type="button"
                          disabled={registerPasskey.isPending}
                          onClick={() => {
                            void registerPasskey.mutateAsync()
                              .then(() => toast.success(t('passkeyRegistered')))
                              .catch((error: unknown) => toast.error(getUsersErrorMessage(error)));
                          }}
                        >
                          <Fingerprint aria-hidden="true" />
                          {registerPasskey.isPending ? t('passkeyRegistering') : t('registerPasskey')}
                        </Button>
                      ) : (
                        <Badge variant="outline">{t('passkeyAwaitingApprovalShort')}</Badge>
                      )}
                    </div>
                  )}

                  {attendanceQuery.data.pointages_du_jour.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('noPunchOnDate')}</p>
                  ) : (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">{t('punchDetailsForDate')}</h3>
                      <ul className="divide-y rounded-lg border">
                        {attendanceQuery.data.pointages_du_jour.map((punch) => (
                          <li key={punch.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                            <span className="font-medium">{t(`punchTypes.${punch.type_evenement}`)}</span>
                            <span className="tabular-nums">{formatTime(punch.date_pointage)}</span>
                            <span className="text-muted-foreground">{punch.capteur ?? t('manualPunch')}</span>
                            <Badge variant="outline">{t(`calculationStatuses.${punch.statut_calcul}`)}</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History aria-hidden="true" className="size-5" />
                    {t('recentHistoryTitle')}
                  </CardTitle>
                  <CardDescription>{t('recentHistoryDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {attendanceQuery.data.pointages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('noHistory')}</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {attendanceQuery.data.pointages.slice(0, 10).map((punch) => (
                        <li key={punch.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                          <span className="font-medium">{t(`punchTypes.${punch.type_evenement}`)}</span>
                          <span>{formatDate(punch.date_pointage, locale, t('notAvailable'))}</span>
                          <span className="text-muted-foreground">{punch.capteur ?? t('manualPunch')}</span>
                          <Badge variant="outline">{t(`calculationStatuses.${punch.statut_calcul}`)}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('selfEvaluationTitle')}</CardTitle>
                  <CardDescription>                  {t('selfEvaluationDescription', { start: formatDate(periodeDebutEffective, locale, t('notAvailable')), end: formatDate(periodeFinEffective, locale, t('notAvailable')) })}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="grid gap-1 text-xs text-muted-foreground">{t('periodStart')}<Input type="date" max={periodeFinEffective} value={periodeDebutEffective} onChange={(event) => setPeriodeDebut(event.target.value)} /></label>
                    <label className="grid gap-1 text-xs text-muted-foreground">{t('periodEnd')}<Input type="date" min={periodeDebutEffective} max={dateAujourdhui} value={periodeFinEffective} onChange={(event) => setPeriodeFin(event.target.value)} /></label>
                  </div>
                  {attendanceQuery.data.evaluation && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">{t('periodLate')}</p><p className="mt-2 font-semibold tabular-nums">{duree(attendanceQuery.data.evaluation.totaux.retard_total_minutes, t('hours'), t('minutes'))}</p></div>
                        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">{t('periodAbsences')}</p><p className="mt-2 font-semibold tabular-nums">{attendanceQuery.data.evaluation.totaux.jours_absence}</p></div>
                        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">{t('periodWorked')}</p><p className="mt-2 font-semibold tabular-nums">{duree(attendanceQuery.data.evaluation.totaux.heures_travaillees_minutes, t('hours'), t('minutes'))}</p></div>
                        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">{t('periodAnomalies')}</p><p className="mt-2 font-semibold tabular-nums">{attendanceQuery.data.evaluation.totaux.pointages_anormaux}</p></div>
                      </div>
                      <div className="h-72 w-full" role="img" aria-label={t('lateTrend')}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={attendanceQuery.data.evaluation.jours} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} unit={` ${t('minutes')}`} tickLine={false} axisLine={false} />
                            <Tooltip labelFormatter={(value) => formatDate(String(value), locale, t('notAvailable'))} />
                            <Area type="monotone" dataKey="retard_minutes" name={t('lateMinutes')} stroke="#0f766e" fill="#0f766e" fillOpacity={0.2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-semibold">{t('anomalyDetails')}</h3>
                        {attendanceQuery.data.evaluation.anomalies.length === 0 ? (
                          <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{t('noAnomalies')}</p>
                        ) : (
                          <ul className="divide-y rounded-lg border">
                            {attendanceQuery.data.evaluation.anomalies.slice(0, 30).map((anomaly, index) => (
                              <li key={`${anomaly.date}-${anomaly.type}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                                <span>{formatDate(anomaly.date, locale, t('notAvailable'))}</span>
                                <span className="font-medium">{t(`punchTypes.${anomaly.type}`)}</span>
                                <span>{anomaly.reel ?? t('missingPunch')}</span>
                                <Badge variant={anomaly.statut === 'RETARD' ? 'secondary' : 'destructive'}>{t(`stepStatuses.${anomaly.statut}`)}</Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle id="personal-attendance-title" className="flex items-center gap-2">
              <Clock3 aria-hidden="true" className="size-5" />
              {t('todayTitle')}
            </CardTitle>
            <CardDescription>{t('attendanceUnavailableTitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('attendanceUnavailableDescription')}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound aria-hidden="true" className="size-5" />
            {t('accountTitle')}
          </CardTitle>
          <CardDescription>{t('accountDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label={t('fullName')} value={profile.nom_complet} />
            <Detail label={t('email')} value={profile.email} />
            <Detail label={t('phone')} value={profile.telephone} />
            <Detail label={t('role')} value={t(`roles.${profile.role}`)} />
            <Detail label={t('accountType')} value={profile.auth_source === 'LDAP' ? 'LDAP' : t('localAccount')} />
            <Detail
              label={t('accountStatus')}
              value={
                <Badge variant={profile.is_active ? 'default' : 'secondary'}>
                  {profile.is_active ? t('active') : t('inactive')}
                </Badge>
              }
            />
            <Detail label={t('lastLogin')} value={formatDate(profile.derniere_connexion, locale, t('notAvailable'))} />
            <Detail label={t('accountId')} value={profile.id} />
            <Detail label={t('tenantId')} value={profile.tenant_id} />
            <Detail label={t('superAdmin')} value={profile.is_super_admin ? t('yes') : t('no')} />
          </dl>
        </CardContent>
      </Card>

      {employee ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint aria-hidden="true" className="size-5" />
              {t('employeeTitle')}
            </CardTitle>
            <CardDescription>{t('employeeDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label={t('employeeName')} value={`${employee.prenom} ${employee.nom}`} />
              <Detail label={t('matricule')} value={employee.matricule} />
              <Detail label={t('position')} value={employee.poste} />
              <Detail label={t('unit')} value={employee.unite_nom} />
              <Detail label={t('unitId')} value={employee.unite_id} />
              <Detail label={t('unitManager')} value={employee.est_responsable_unite ? t('yes') : t('no')} />
              <Detail label={t('employeeEmail')} value={employee.email} />
              <Detail label={t('employeePhone')} value={employee.telephone} />
              <Detail label={t('gender')} value={employee.genre ? t(`genders.${employee.genre}`) : null} />
              <Detail label={t('photo')} value={employee.photo_url} />
              <Detail label={t('hireDate')} value={formatDate(employee.date_embauche, locale, t('notProvided'))} />
              <Detail label={t('departureDate')} value={formatDate(employee.date_depart, locale, t('notProvided'))} />
              <Detail label={t('employeeStatus')} value={<Badge variant={employee.actif ? 'default' : 'secondary'}>{employee.actif ? t('active') : t('inactive')}</Badge>} />
              <Detail label={t('badgeId')} value={employee.badge_id} />
              <Detail label={t('deviceUserId')} value={employee.user_id_capteur} />
              <Detail label={t('deviceRole')} value={employee.role_capteur} />
              <Detail label={t('fingerprintStatus')} value={employee.empreinte_enrolee ? t('enrolled') : t('notEnrolled')} />
              <Detail label={t('fingerprintCount')} value={employee.nb_empreintes} />
              <Detail label={t('lastDeviceSync')} value={formatDate(employee.derniere_sync, locale, t('notProvided'))} />
              <Detail label={t('recordCreated')} value={formatDate(employee.created_at, locale, t('notProvided'))} />
              <Detail label={t('recordUpdated')} value={formatDate(employee.updated_at, locale, t('notProvided'))} />
              <Detail label={t('employeeId')} value={employee.id} />
            </dl>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('employeeTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('noEmployee')}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-5" />
            {t('dataScopeTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('dataScopeDescription')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
