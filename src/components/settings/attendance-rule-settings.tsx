'use client';

import { useState, type FormEvent } from 'react';
import { CalendarDays, Plus, RotateCw, Save, Sparkles, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/lib/api';
import { confirmerAvecSweetAlert } from '@/lib/confirmation';
import {
  useAttendanceRuleSettings,
  useCompareAttendanceRules,
  useRecalculateAttendanceDay,
  useUpdateAttendanceRuleSettings,
  type AttendanceRuleSettings,
  type AttendanceRuleSchedule,
  type AttendanceSlot,
  type AttendanceSlotMode,
  type AttendanceSlotType,
} from '@/hooks/useTenantConfig';

const PARAMETRE_NUMERIQUES = [
  { cle: 'ecart_max_association_minutes', minimum: 0 },
  { cle: 'seuil_heures_sup_minutes', minimum: 0 },
  { cle: 'pas_arrondi_heures_sup_minutes', minimum: 1 },
  { cle: 'duree_pause_minimum_minutes', minimum: 0 },
  { cle: 'duree_pause_maximum_minutes', minimum: 0 },
] as const;

const TYPES_CRENEAU: AttendanceSlotType[] = ['ARRIVEE', 'DEBUT_PAUSE', 'FIN_PAUSE', 'DEPART'];
const MODES_CRENEAU: AttendanceSlotMode[] = ['LIMITE_TARDIVE', 'LIMITE_PRECOCE', 'PLAGE'];

type ParametresForm = Record<(typeof PARAMETRE_NUMERIQUES)[number]['cle'], number> & {
  mode_calcul_heures_sup: string;
};

function heureFormulaire(value: string | null): string {
  return value?.slice(0, 5) ?? '';
}

function normaliserParametres(configuration: AttendanceRuleSettings): ParametresForm {
  const numeriques = Object.fromEntries(
    PARAMETRE_NUMERIQUES.map(({ cle }) => [cle, Number(configuration.parametres[cle]?.valeur)])
  ) as Pick<ParametresForm, (typeof PARAMETRE_NUMERIQUES)[number]['cle']>;

  return {
    ...numeriques,
    mode_calcul_heures_sup: String(configuration.parametres.mode_calcul_heures_sup?.valeur ?? ''),
  };
}

function nouveauCreneau(type: AttendanceSlotType): AttendanceSlot {
  const heuresCibles: Record<AttendanceSlotType, string> = {
    ARRIVEE: '08:00',
    DEBUT_PAUSE: '12:00',
    FIN_PAUSE: '13:00',
    DEPART: '17:00',
  };
  const modesInitiaux: Record<AttendanceSlotType, AttendanceSlotMode> = {
    ARRIVEE: 'LIMITE_TARDIVE',
    DEBUT_PAUSE: 'LIMITE_PRECOCE',
    FIN_PAUSE: 'LIMITE_TARDIVE',
    DEPART: 'LIMITE_PRECOCE',
  };

  return {
    type_creneau: type,
    mode: modesInitiaux[type],
    heure_cible: heuresCibles[type],
    tolerance_minutes: 10,
    plage_debut: null,
    plage_fin: null,
    ordre_affichage: TYPES_CRENEAU.indexOf(type),
    notes: null,
  };
}

interface AttendanceRuleSettingsProps {
  canManageSettings: boolean;
  canManageOptIn: boolean;
}

interface AttendanceRuleDraft {
  source: AttendanceRuleSettings;
  parametres: ParametresForm;
  creneaux: AttendanceSlot[];
  reglesActives: boolean;
  dateEffet: string;
}

function creerBrouillon(configuration: AttendanceRuleSettings): AttendanceRuleDraft {
  return {
    source: configuration,
    parametres: normaliserParametres(configuration),
    creneaux: configuration.creneaux.map((creneau) => ({
      ...creneau,
      heure_cible: heureFormulaire(creneau.heure_cible),
      plage_debut: heureFormulaire(creneau.plage_debut),
      plage_fin: heureFormulaire(creneau.plage_fin),
    })),
    reglesActives: configuration.actif_regles_nouvelles,
    dateEffet: configuration.date_effet,
  };
}

export function AttendanceRuleSettings({ canManageSettings, canManageOptIn }: AttendanceRuleSettingsProps) {
  const t = useTranslations('parametres.pointages.rules');
  const tCommon = useTranslations('common');
  const [profilHoraireId, setProfilHoraireId] = useState<number | null>(null);
  const settingsQuery = useAttendanceRuleSettings(profilHoraireId);
  const updateSettings = useUpdateAttendanceRuleSettings();
  const recalculateDay = useRecalculateAttendanceDay();
  const previewDay = useCompareAttendanceRules();
  const [brouillon, setBrouillon] = useState<AttendanceRuleDraft | null>(null);
  const [typeAAjouter, setTypeAAjouter] = useState<AttendanceSlotType>('ARRIVEE');
  const [dateRecalcul, setDateRecalcul] = useState('');
  const [dateFinComparaison, setDateFinComparaison] = useState('');
  const [employeRecalcul, setEmployeRecalcul] = useState('');
  const configuration = settingsQuery.data;
  const brouillonActuel = configuration
    ? brouillon?.source === configuration ? brouillon : creerBrouillon(configuration)
    : null;
  const parametres = brouillonActuel?.parametres ?? null;
  const creneaux = brouillonActuel?.creneaux ?? [];
  const reglesActives = brouillonActuel?.reglesActives ?? false;
  const dateEffet = brouillonActuel?.dateEffet ?? configuration?.date_effet ?? '';
  const horaireProfil = configuration?.horaires.find((horaire) => horaire.id === profilHoraireId) ?? null;

  const modifierBrouillon = (modifications: Partial<Omit<AttendanceRuleDraft, 'source'>>) => {
    if (!configuration) return;
    previewDay.reset();
    setBrouillon((courant) => ({
      ...(courant?.source === configuration ? courant : creerBrouillon(configuration)),
      ...modifications,
    }));
  };

  const creneauxDisponibles = TYPES_CRENEAU.filter(
    (type) => !creneaux.some((creneau) => creneau.type_creneau === type)
  );
  const typeAAjouterEffectif = creneauxDisponibles.includes(typeAAjouter)
    ? typeAAjouter
    : creneauxDisponibles[0];
  const pauseValide = parametres !== null
    && parametres.duree_pause_minimum_minutes <= parametres.duree_pause_maximum_minutes;
  const parametresValides = parametres !== null
    && PARAMETRE_NUMERIQUES.every(({ cle, minimum }) =>
      Number.isInteger(parametres[cle]) && parametres[cle] >= minimum
    )
    && ['ARRONDI', 'EXACT'].includes(parametres.mode_calcul_heures_sup)
    && pauseValide;
  const creneauxDisponiblesDansHoraire = new Set(
    horaireProfil?.plages_horaires.map((plage) => plage.type) ?? []
  );
  const creneauxIncompatibles = horaireProfil === null
    ? []
    : creneaux.filter((creneau) => !creneauxDisponiblesDansHoraire.has(({
      ARRIVEE: 'CHECK_IN',
      DEBUT_PAUSE: 'BREAK_OUT',
      FIN_PAUSE: 'BREAK_IN',
      DEPART: 'CHECK_OUT',
    } satisfies Record<AttendanceSlotType, string>)[creneau.type_creneau]));
  const configurationActivable = !reglesActives || (creneaux.length > 0 && creneauxIncompatibles.length === 0);

  const modifierCreneau = <K extends keyof AttendanceSlot>(
    index: number,
    cle: K,
    valeur: AttendanceSlot[K]
  ) => {
    modifierBrouillon({
      creneaux: creneaux.map((creneau, slotIndex) =>
        slotIndex === index ? { ...creneau, [cle]: valeur } : creneau
      ),
    });
  };

  const proposerCreneauxDepuisHoraire = (horaire: AttendanceRuleSchedule) => {
    const mapping: Record<string, AttendanceSlotType | undefined> = {
      CHECK_IN: 'ARRIVEE',
      BREAK_OUT: 'DEBUT_PAUSE',
      BREAK_IN: 'FIN_PAUSE',
      CHECK_OUT: 'DEPART',
    };
    const suggestions = horaire.plages_horaires.flatMap((plage): AttendanceSlot[] => {
      const type = mapping[plage.type];
      if (!type) return [];
      const debut = heureFormulaire(plage.debut);
      const fin = heureFormulaire(plage.fin);
      const mode: AttendanceSlotMode = type === 'ARRIVEE' || type === 'FIN_PAUSE'
        ? 'LIMITE_TARDIVE'
        : 'LIMITE_PRECOCE';
      const heureCible = type === 'ARRIVEE'
        ? fin
        : type === 'DEPART' && fin !== '23:59' ? fin : debut;

      return [{
        ...nouveauCreneau(type),
        mode,
        heure_cible: heureCible,
        plage_debut: null,
        plage_fin: null,
        tolerance_minutes: plage.tolerance_min ?? 10,
      }];
    });
    modifierBrouillon({ creneaux: suggestions });
  };

  const enregistrer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageSettings || !configuration || !brouillonActuel || !parametresValides || !configurationActivable) return;

    try {
      await updateSettings.mutateAsync({
        parametres: {
          ...brouillonActuel.parametres,
        },
        creneaux: brouillonActuel.creneaux.map((creneau) => ({
          type_creneau: creneau.type_creneau,
          mode: creneau.mode,
          heure_cible: creneau.mode === 'PLAGE' ? null : creneau.heure_cible,
          tolerance_minutes: creneau.tolerance_minutes,
          plage_debut: creneau.mode === 'PLAGE' ? creneau.plage_debut : null,
          plage_fin: creneau.mode === 'PLAGE' ? creneau.plage_fin : null,
          ordre_affichage: creneau.ordre_affichage,
          notes: creneau.notes,
        })),
        horaire_id: profilHoraireId,
        date_effet: brouillonActuel.dateEffet,
        ...(canManageOptIn ? { actif_regles_nouvelles: brouillonActuel.reglesActives } : {}),
      });
      toast.success(t('saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const recalculer = async () => {
    if (!canManageSettings || !dateRecalcul) return;
    if (!employeRecalcul) {
      const comparaisonConfirmee = previewDay.data?.jours.some((jour) => jour.date === dateRecalcul);
      if (!comparaisonConfirmee) {
        toast.error(t('previewRequired'));
        return;
      }
      if (!await confirmerAvecSweetAlert(t('confirmTenantRecalculation'), {
        title: tCommon('confirm'),
        confirmButtonText: tCommon('yes'),
        cancelButtonText: tCommon('no'),
        destructive: true,
      })) return;
    }
    try {
      await recalculateDay.mutateAsync({
        date: dateRecalcul,
        ...(employeRecalcul ? { employe_id: Number(employeRecalcul) } : {}),
      });
      toast.success(t('recalculationComplete'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const previsualiser = async () => {
    if (!canManageSettings || !dateRecalcul || !dateFinComparaison || !employeRecalcul || !brouillonActuel) return;
    try {
      await previewDay.mutateAsync({
        date_debut: dateRecalcul,
        date_fin: dateFinComparaison,
        employe_id: Number(employeRecalcul),
        horaire_id: profilHoraireId,
        actif_regles_nouvelles: brouillonActuel.reglesActives,
        parametres: { ...brouillonActuel.parametres },
        creneaux: brouillonActuel.creneaux.map((creneau) => ({
          type_creneau: creneau.type_creneau,
          mode: creneau.mode,
          heure_cible: creneau.mode === 'PLAGE' ? null : creneau.heure_cible,
          tolerance_minutes: creneau.tolerance_minutes,
          plage_debut: creneau.mode === 'PLAGE' ? creneau.plage_debut : null,
          plage_fin: creneau.mode === 'PLAGE' ? creneau.plage_fin : null,
          ordre_affichage: creneau.ordre_affichage,
          notes: creneau.notes,
        })),
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (settingsQuery.isLoading) {
    return <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (settingsQuery.isError || !configuration || !parametres) {
    return <p role="alert" className="rounded-lg border p-4 text-sm text-destructive">{t('loadError')}</p>;
  }

  return (
    <form className="space-y-6" onSubmit={(event) => void enregistrer(event)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-5" />{t('profileTitle')}</CardTitle>
          <CardDescription>{t('profileDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            {t('profileSchedule')}
            <select
              className="h-9 rounded-lg border bg-background px-2"
              value={profilHoraireId ?? ''}
              disabled={!canManageSettings || updateSettings.isPending}
              onChange={(event) => {
                setBrouillon(null);
                setProfilHoraireId(event.target.value === '' ? null : Number(event.target.value));
              }}
            >
              <option value="">{t('tenantWideProfile')}</option>
              {configuration.horaires.map((horaire) => (
                <option key={horaire.id} value={horaire.id}>
                  {horaire.nom}{horaire.est_defaut ? ` · ${t('defaultSchedule')}` : ''}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">{t('profileScopeHelp')}</span>
          </label>
          <label className="grid gap-1.5 text-sm">
            {t('effectiveDate')}
            <Input
              required
              type="date"
              value={dateEffet}
              disabled={!canManageSettings}
              onChange={(event) => modifierBrouillon({ dateEffet: event.target.value })}
            />
            <span className="text-xs text-muted-foreground">{t('effectiveDateHelp')}</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('interpretationRulesTitle')}</CardTitle>
          <CardDescription>{t('optInDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <label htmlFor="attendance-rules-enabled" className="text-sm font-medium">{t('optInLabel')}</label>
          <Switch
            id="attendance-rules-enabled"
            checked={reglesActives}
            onCheckedChange={(checked) => modifierBrouillon({ reglesActives: checked })}
            disabled={updateSettings.isPending || !canManageSettings || !canManageOptIn}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('parametersTitle')}</CardTitle>
          <CardDescription>{t('parametersDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PARAMETRE_NUMERIQUES.slice(0, 2).map(({ cle }) => (
            <label key={cle} className="grid gap-1.5 text-sm">
              {t(`parameters.${cle}.label`)}
              <Input
                type="number"
                min={0}
                step={1}
                value={parametres[cle]}
                disabled={!canManageSettings}
                onChange={(event) => modifierBrouillon({
                  parametres: {
                    ...parametres,
                    [cle]: event.target.value === '' ? 0 : Number(event.target.value),
                  },
                })}
              />
              <span className="text-xs text-muted-foreground">{t(`parameters.${cle}.description`)}</span>
            </label>
          ))}

          <label className="grid gap-1.5 text-sm">
            {t('parameters.mode_calcul_heures_sup.label')}
            <select
              className="h-9 rounded-lg border bg-background px-2"
              value={parametres.mode_calcul_heures_sup}
              disabled={!canManageSettings}
              onChange={(event) => modifierBrouillon({
                parametres: {
                  ...parametres,
                  mode_calcul_heures_sup: event.target.value,
                },
              })}
            >
              <option value="ARRONDI">{t('modesOvertime.ARRONDI')}</option>
              <option value="EXACT">{t('modesOvertime.EXACT')}</option>
            </select>
            <span className="text-xs text-muted-foreground">{t('parameters.mode_calcul_heures_sup.description')}</span>
          </label>

          {PARAMETRE_NUMERIQUES.slice(2).map(({ cle, minimum }) => (
            <label key={cle} className="grid gap-1.5 text-sm">
              {t(`parameters.${cle}.label`)}
              <Input
                type="number"
                min={minimum}
                step={1}
                value={parametres[cle]}
                disabled={!canManageSettings}
                onChange={(event) => modifierBrouillon({
                  parametres: {
                    ...parametres,
                    [cle]: event.target.value === '' ? 0 : Number(event.target.value),
                  },
                })}
              />
              <span className="text-xs text-muted-foreground">{t(`parameters.${cle}.description`)}</span>
            </label>
          ))}
          {!pauseValide && <p role="alert" className="text-sm text-destructive sm:col-span-2 xl:col-span-3">{t('invalidPauseRange')}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('slotsTitle')}</CardTitle>
          <CardDescription>{t('slotsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {horaireProfil && canManageSettings && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3">
              <p className="text-sm text-muted-foreground">{t('assistantDescription', { schedule: horaireProfil.nom })}</p>
              <Button type="button" variant="outline" onClick={() => proposerCreneauxDepuisHoraire(horaireProfil)}>
                <Sparkles aria-hidden="true" />
                {t('assistantButton')}
              </Button>
            </div>
          )}
          {creneauxIncompatibles.length > 0 && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {t('incompatibleSlots', { slots: creneauxIncompatibles.map((creneau) => t(`slotTypes.${creneau.type_creneau}`)).join(', ') })}
            </p>
          )}
          {creneaux.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t('noSlots')}</p>}
          {creneaux.map((creneau, index) => (
            <section key={creneau.type_creneau} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">{t(`slotTypes.${creneau.type_creneau}`)}</h3>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  aria-label={t('removeSlot')}
                  disabled={!canManageSettings}
                  onClick={() => modifierBrouillon({
                    creneaux: creneaux.filter((_, slotIndex) => slotIndex !== index),
                  })}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-1.5 text-sm">
                  {t('slotMode')}
                  <select
                    className="h-9 rounded-lg border bg-background px-2"
                    value={creneau.mode}
                    disabled={!canManageSettings}
                    onChange={(event) => modifierCreneau(index, 'mode', event.target.value as AttendanceSlotMode)}
                  >
                    {MODES_CRENEAU.map((mode) => <option key={mode} value={mode}>{t(`modes.${mode}`)}</option>)}
                  </select>
                </label>
                {creneau.mode === 'PLAGE' ? (
                  <>
                    <label className="grid gap-1.5 text-sm">{t('rangeStart')}<Input disabled={!canManageSettings} required type="time" value={creneau.plage_debut ?? ''} onChange={(event) => modifierCreneau(index, 'plage_debut', event.target.value)} /></label>
                    <label className="grid gap-1.5 text-sm">{t('rangeEnd')}<Input disabled={!canManageSettings} required type="time" value={creneau.plage_fin ?? ''} onChange={(event) => modifierCreneau(index, 'plage_fin', event.target.value)} /></label>
                  </>
                ) : (
                  <label className="grid gap-1.5 text-sm">{t('targetTime')}<Input disabled={!canManageSettings} required type="time" value={creneau.heure_cible ?? ''} onChange={(event) => modifierCreneau(index, 'heure_cible', event.target.value)} /></label>
                )}
                <label className="grid gap-1.5 text-sm">
                  {t('slotTolerance')}
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={creneau.tolerance_minutes ?? 0}
                    disabled={!canManageSettings}
                    onChange={(event) => modifierCreneau(index, 'tolerance_minutes', event.target.value === '' ? 0 : Number(event.target.value))}
                  />
                </label>
              </div>
            </section>
          ))}
          {canManageSettings && creneauxDisponibles.length > 0 && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1.5 text-sm">
                {t('slotType')}
                <select
                  className="h-9 rounded-lg border bg-background px-2"
                  value={typeAAjouterEffectif}
                  onChange={(event) => setTypeAAjouter(event.target.value as AttendanceSlotType)}
                >
                  {creneauxDisponibles.map((type) => <option key={type} value={type}>{t(`slotTypes.${type}`)}</option>)}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => typeAAjouterEffectif && modifierBrouillon({
                  creneaux: [...creneaux, nouveauCreneau(typeAAjouterEffectif)],
                })}
              >
                <Plus aria-hidden="true" />
                {t('addSlot')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('recalculationTitle')}</CardTitle>
          <CardDescription>{t('recalculationDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              {t('recalculationDate')}
              <Input
                type="date"
                required
                value={dateRecalcul}
                disabled={!canManageSettings || recalculateDay.isPending}
                onChange={(event) => {
                  previewDay.reset();
                  setDateRecalcul(event.target.value);
                }}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              {t('recalculationEmployee')}
              <Input
                type="number"
                min={1}
                step={1}
                value={employeRecalcul}
                disabled={!canManageSettings || recalculateDay.isPending}
                onChange={(event) => setEmployeRecalcul(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              {t('comparisonEndDate')}
              <Input
                type="date"
                required
                min={dateRecalcul || undefined}
                value={dateFinComparaison}
                disabled={!canManageSettings || previewDay.isPending}
                onChange={(event) => {
                  previewDay.reset();
                  setDateFinComparaison(event.target.value);
                }}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">{t('comparisonHelp')}</p>
          <p className="text-xs text-muted-foreground">{t('recalculationScopeHelp')}</p>
          {canManageSettings && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!dateRecalcul || !dateFinComparaison || !employeRecalcul || Number(employeRecalcul) < 1 || previewDay.isPending}
                onClick={() => void previsualiser()}
              >
                {previewDay.isPending ? t('previewPending') : t('previewButton')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!dateRecalcul || recalculateDay.isPending || (employeRecalcul !== '' && Number(employeRecalcul) < 1) || (!employeRecalcul && !previewDay.data?.jours.some((jour) => jour.date === dateRecalcul))}
                onClick={() => void recalculer()}
              >
                <RotateCw aria-hidden="true" />
                {recalculateDay.isPending ? t('recalculationPending') : t('recalculationButton')}
              </Button>
            </div>
          )}
          {previewDay.data && (
            <div role="status" className="space-y-3 rounded-md border p-3 text-sm">
              <p className="font-medium">{t('comparisonSummary', {
                start: previewDay.data.date_debut,
                end: previewDay.data.date_fin,
                id: previewDay.data.employe_id,
                compared: previewDay.data.jours_compares,
                changed: previewDay.data.jours_differents,
              })}</p>
              {previewDay.data.avertissement_pointages_pause && (
                <p role="alert" className="text-destructive">{t('unconfiguredBreakEventsWarning')}</p>
              )}
              <ul className="max-h-72 space-y-2 overflow-auto">
                {previewDay.data.jours.map((jour) => (
                  <li key={jour.date} className="grid gap-1 rounded border p-2 sm:grid-cols-[auto_1fr_1fr]">
                    <span className="font-medium">{jour.date}{jour.different ? ' · !' : ''}</span>
                    <span>{t('comparisonBefore')}: {jour.avant.statut} · {Number(jour.avant.heures_travaillees).toFixed(2)} h</span>
                    <span>{t('comparisonAfter')}: {jour.apres.statut} · {Number(jour.apres.heures_travaillees).toFixed(2)} h</span>
                    {jour.apres.creneaux.length > 0 && (
                      <span className="text-xs text-muted-foreground sm:col-span-3">
                        {jour.apres.creneaux.map((creneau) => `${creneau.creneau}: ${creneau.statut}`).join(' · ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recalculateDay.data && (
            <div role="status" className="space-y-2 rounded-md border p-3 text-sm">
              <p>{t('recalculationSummary', {
                date: recalculateDay.data.date,
                total: recalculateDay.data.total,
                processed: recalculateDay.data.traitees,
                ignored: recalculateDay.data.ignorees,
              })}</p>
              {recalculateDay.data.erreurs.map((erreur) => (
                <p key={erreur.employe_id} className="text-destructive">
                  {t('recalculationEmployeeError', { id: erreur.employe_id, message: erreur.message })}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canManageSettings && <div className="flex justify-end">
        <Button type="submit" disabled={updateSettings.isPending || !parametresValides || !dateEffet || !configurationActivable}>
          <Save aria-hidden="true" />
          {updateSettings.isPending ? t('saving') : t('saveRules')}
        </Button>
      </div>}
      {configuration.versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('historyTitle')}</CardTitle>
            <CardDescription>{t('historyDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {configuration.versions.map((version) => (
                <li key={version.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b pb-2 last:border-0">
                  <span>{version.horaire_nom ?? t('tenantWideProfile')} · {version.actif ? t('historyEnabled') : t('historyDisabled')}</span>
                  <time dateTime={version.date_effet}>{version.date_effet}</time>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </form>
  );
}
