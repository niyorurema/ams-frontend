'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, Clock3, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/api';
import { useCreateDefaultHoraire, useHoraires, useSetDefaultHoraire, useUpdateHoraire, type HorairePlage, type HoraireTenant } from '@/hooks/useHoraires';
import { useTenantConfig, useUpdateTenantWorkingDays } from '@/hooks/useTenantConfig';
import { useAuthStore } from '@/stores/authStore';
import { AttendanceRuleSettings } from '@/components/settings/attendance-rule-settings';

const TYPES_POINTAGE: HorairePlage['type'][] = ['CHECK_IN', 'BREAK_OUT', 'BREAK_IN', 'CHECK_OUT'];

function estActif(horaire: HoraireTenant): boolean {
  return horaire.actif === true || horaire.actif === 1 || horaire.actif === '1';
}

function estDefaut(value: HoraireTenant['est_defaut']): boolean {
  return value === true || value === 1 || value === '1';
}

function parDefautHoraire(horaire: HoraireTenant): HorairePlage[] {
  return horaire.plages_horaires.map((plage) => ({
    type: plage.type,
    debut: plage.debut.slice(0, 5),
    fin: plage.fin.slice(0, 5),
    tolerance_min: plage.tolerance_min ?? 10,
  }));
}

function configurationInitiale(horaire: HoraireTenant) {
  return {
    nom: horaire.nom,
    description: horaire.description ?? '',
    plages_horaires: parDefautHoraire(horaire),
    heures_travail_normales: Number(horaire.heures_travail_normales),
    seuil_heures_anormal: Number(horaire.seuil_heures_anormal),
  };
}

export default function PointagesSettingsPage() {
  const t = useTranslations('parametres.pointages');
  const user = useAuthStore((state) => state.user);
  const horairesQuery = useHoraires();
  const tenantQuery = useTenantConfig();
  const createDefault = useCreateDefaultHoraire();
  const setDefault = useSetDefaultHoraire();
  const updateHoraire = useUpdateHoraire();
  const updateTenantWorkingDays = useUpdateTenantWorkingDays();
  const horaires = horairesQuery.data?.items.filter(estActif) ?? [];
  const horaireDefaut = horaires.find((horaire) => estDefaut(horaire.est_defaut)) ?? null;
  const [horaireForm, setHoraireForm] = useState<{
    id: number;
    values: ReturnType<typeof configurationInitiale>;
  } | null>(null);
  const [typeInitial, setTypeInitial] = useState<'OBR' | 'STANDARD' | 'FLEXIBLE'>('OBR');
  const [joursTravaillesModifies, setJoursTravailles] = useState<number[] | null>(null);
  const canWrite = user?.role === 'admin' || user?.role === 'rh' || user?.is_super_admin;
  const readOnly = !canWrite && user?.role === 'superviseur';
  const joursTravailles = joursTravaillesModifies ?? tenantQuery.data?.jours_travailles ?? [];
  const configurationHoraire = horaireDefaut
    ? horaireForm?.id === horaireDefaut.id ? horaireForm.values : configurationInitiale(horaireDefaut)
    : null;

  const modifierPlage = <K extends keyof HorairePlage>(index: number, key: K, value: HorairePlage[K]) => {
    if (!configurationHoraire || !horaireDefaut) return;
    setHoraireForm({
      id: horaireDefaut.id,
      values: {
        ...configurationHoraire,
        plages_horaires: configurationHoraire.plages_horaires.map((plage, plageIndex) => plageIndex === index
          ? { ...plage, [key]: value }
          : plage),
      },
    });
  };

  const enregistrerHoraire = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!horaireDefaut || !configurationHoraire) return;
    try {
      await updateHoraire.mutateAsync({
        id: horaireDefaut.id,
        data: {
          nom: configurationHoraire.nom.trim(),
          description: configurationHoraire.description.trim(),
          plages_horaires: configurationHoraire.plages_horaires,
          heures_travail_normales: configurationHoraire.heures_travail_normales,
          seuil_heures_anormal: configurationHoraire.seuil_heures_anormal,
        },
      });
      setHoraireForm(null);
      toast.success(t('saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const enregistrerJours = async () => {
    if (!tenantQuery.data || joursTravailles.length === 0) return;
    try {
      await updateTenantWorkingDays.mutateAsync([...joursTravailles].sort((a, b) => a - b));
      setJoursTravailles(null);
      toast.success(t('saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const choisirHoraire = async (id: number) => {
    try {
      await setDefault.mutateAsync(id);
      setHoraireForm(null);
      toast.success(t('defaultChanged'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const creerHoraire = async () => {
    try {
      await createDefault.mutateAsync(typeInitial);
      await horairesQuery.refetch();
      toast.success(t('templateReady'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (!canWrite && !readOnly) {
    return <p role="alert" className="w-full rounded-lg border p-6 text-sm text-destructive">{t('accessDenied')}</p>;
  }

  if (horairesQuery.isLoading || tenantQuery.isLoading) {
    return <div className="w-full space-y-6"><Skeleton className="h-20 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (horairesQuery.isError || tenantQuery.isError || !tenantQuery.data) {
    return <p role="alert" className="w-full rounded-lg border p-6 text-sm text-destructive">{t('loadError')}</p>;
  }

  const jours = [
    { value: 1, key: 'monday' },
    { value: 2, key: 'tuesday' },
    { value: 3, key: 'wednesday' },
    { value: 4, key: 'thursday' },
    { value: 5, key: 'friday' },
    { value: 6, key: 'saturday' },
    { value: 7, key: 'sunday' },
  ];
  const hasDefault = horaireDefaut !== null;

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </header>

      {readOnly && <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">{t('readOnlyNotice')}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{t('workingDaysTitle')}</CardTitle>
          <CardDescription>{t('workingDaysDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {jours.map((jour) => {
              const checked = joursTravailles.includes(jour.value);
              return (
                <label key={jour.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={readOnly || (checked && joursTravailles.length === 1)}
                    onChange={(event) => setJoursTravailles((current) => {
                      const values = current ?? tenantQuery.data?.jours_travailles ?? [];
                      return event.target.checked
                        ? [...values, jour.value].sort((a, b) => a - b)
                        : values.filter((value) => value !== jour.value);
                    })}
                  />
                  {t(`days.${jour.key}`)}
                </label>
              );
            })}
          </div>
          {!readOnly && (
            <Button type="button" onClick={() => void enregistrerJours()} disabled={updateTenantWorkingDays.isPending || joursTravailles.length === 0}>
              <Save aria-hidden="true" />
              {t('saveWorkingDays')}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock3 aria-hidden="true" className="size-5" />{t('defaultScheduleTitle')}</CardTitle>
          <CardDescription>{t('defaultScheduleDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!hasDefault && !readOnly && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-4">
              <label className="grid gap-1.5 text-sm">
                {t('template')}
                <select className="h-9 rounded-lg border bg-background px-2" value={typeInitial} onChange={(event) => setTypeInitial(event.target.value as typeof typeInitial)}>
                  {(['OBR', 'STANDARD', 'FLEXIBLE'] as const).map((type) => <option key={type} value={type}>{t(`templates.${type}`)}</option>)}
                </select>
              </label>
              <Button type="button" onClick={() => void creerHoraire()} disabled={createDefault.isPending}>
                <Plus aria-hidden="true" />
                {t('createTemplate')}
              </Button>
            </div>
          )}

          {horaires.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{t('activeSchedules')}:</span>
              {horaires.map((horaire) => readOnly ? (
                <Badge key={horaire.id} variant={estDefaut(horaire.est_defaut) ? 'default' : 'secondary'}>
                  {horaire.nom}{estDefaut(horaire.est_defaut) ? ` · ${t('defaultBadge')}` : ''}
                </Badge>
              ) : (
                <Button
                  key={horaire.id}
                  type="button"
                  size="sm"
                  variant={estDefaut(horaire.est_defaut) ? 'default' : 'outline'}
                  disabled={setDefault.isPending || estDefaut(horaire.est_defaut)}
                  onClick={() => void choisirHoraire(horaire.id)}
                >
                  {horaire.nom}{estDefaut(horaire.est_defaut) ? ` · ${t('defaultBadge')}` : ''}
                </Button>
              ))}
            </div>
          )}

          {horaireDefaut ? (
            <form className="space-y-5 border-t pt-5" onSubmit={(event) => {
              if (readOnly) {
                event.preventDefault();
                return;
              }
              void enregistrerHoraire(event);
            }}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-1.5 text-sm">{t('scheduleName')}<Input disabled={readOnly} required maxLength={100} value={configurationHoraire?.nom ?? ''} onChange={(event) => configurationHoraire && horaireDefaut && setHoraireForm({ id: horaireDefaut.id, values: { ...configurationHoraire, nom: event.target.value } })} /></label>
                <label className="grid gap-1.5 text-sm sm:col-span-2">{t('scheduleDescription')}<Input disabled={readOnly} value={configurationHoraire?.description ?? ''} onChange={(event) => configurationHoraire && horaireDefaut && setHoraireForm({ id: horaireDefaut.id, values: { ...configurationHoraire, description: event.target.value } })} /></label>
                <label className="grid gap-1.5 text-sm">{t('normalHours')}<Input disabled={readOnly} required type="number" min="0.25" max="24" step="0.25" value={configurationHoraire?.heures_travail_normales ?? 8} onChange={(event) => configurationHoraire && horaireDefaut && setHoraireForm({ id: horaireDefaut.id, values: { ...configurationHoraire, heures_travail_normales: Number(event.target.value) } })} /></label>
                <label className="grid gap-1.5 text-sm">{t('abnormalThreshold')}<Input disabled={readOnly} required type="number" min="0" max={configurationHoraire?.heures_travail_normales ?? 8} step="0.25" value={configurationHoraire?.seuil_heures_anormal ?? 6} onChange={(event) => configurationHoraire && horaireDefaut && setHoraireForm({ id: horaireDefaut.id, values: { ...configurationHoraire, seuil_heures_anormal: Number(event.target.value) } })} /></label>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{t('punchWindows')}</h3>
                    <p className="text-sm text-muted-foreground">{t('punchWindowsDescription')}</p>
                  </div>
                  {!readOnly && <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => configurationHoraire && horaireDefaut && setHoraireForm({
                      id: horaireDefaut.id,
                      values: {
                        ...configurationHoraire,
                        plages_horaires: [...configurationHoraire.plages_horaires, { type: 'CHECK_IN', debut: '08:00', fin: '08:15', tolerance_min: 10 }],
                      },
                    })}
                  >
                    <Plus aria-hidden="true" />
                    {t('addPunchWindow')}
                  </Button>}
                </div>
                {(configurationHoraire?.plages_horaires.length ?? 0) === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t('noPunchWindows')}</p>
                ) : (
                  <div className="space-y-3">
                    {(configurationHoraire?.plages_horaires ?? []).map((plage, index) => (
                      <div key={`${index}-${plage.type}`} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_minmax(130px,0.7fr)_minmax(130px,0.7fr)_minmax(130px,0.7fr)_auto]">
                        <label className="grid gap-1.5 text-sm">
                          {t('punchType')}
                          <select disabled={readOnly} className="h-9 rounded-lg border bg-background px-2" value={plage.type} onChange={(event) => modifierPlage(index, 'type', event.target.value as HorairePlage['type'])}>
                            {TYPES_POINTAGE.map((type) => <option key={type} value={type}>{t(`punchTypes.${type}`)}</option>)}
                          </select>
                        </label>
                        <label className="grid gap-1.5 text-sm">{t('expectedTime')}<Input disabled={readOnly} required type="time" value={plage.debut} onChange={(event) => modifierPlage(index, 'debut', event.target.value)} /></label>
                        <label className="grid gap-1.5 text-sm">{t('windowEnd')}<Input disabled={readOnly} required type="time" value={plage.fin} onChange={(event) => modifierPlage(index, 'fin', event.target.value)} /></label>
                        <label className="grid gap-1.5 text-sm">{t('toleranceMinutes')}<Input disabled={readOnly} required type="number" min="0" max="240" value={plage.tolerance_min ?? 10} onChange={(event) => modifierPlage(index, 'tolerance_min', Number(event.target.value))} /></label>
                        {!readOnly && <Button type="button" variant="destructive" size="icon" aria-label={t('removePunchWindow')} className="self-end" onClick={() => configurationHoraire && horaireDefaut && setHoraireForm({
                          id: horaireDefaut.id,
                          values: {
                            ...configurationHoraire,
                            plages_horaires: configurationHoraire.plages_horaires.filter((_, plageIndex) => plageIndex !== index),
                          },
                        })}>
                          <Trash2 aria-hidden="true" />
                        </Button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">{t('defaultBadge')}</Badge>
                  {t('schedulePrecedence')}
                </div>
                {!readOnly && <Button type="submit" disabled={updateHoraire.isPending || !configurationHoraire || !configurationHoraire.nom.trim() || configurationHoraire.plages_horaires.length === 0}>
                  <Save aria-hidden="true" />
                  {updateHoraire.isPending ? t('saving') : t('saveSchedule')}
                </Button>}
              </div>
            </form>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t('noDefaultSchedule')}</p>
          )}
        </CardContent>
      </Card>

      <AttendanceRuleSettings
        canManageSettings={Boolean(canWrite)}
        canManageOptIn={user?.is_super_admin === true || user?.role === 'admin' || user?.role === 'rh'}
      />

      {!readOnly && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-muted-foreground">{t('advancedConfigurationHelp')}</p>
            <Link href="/parametres/shifts" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              {t('manageShifts')}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
