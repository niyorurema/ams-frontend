'use client';

import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useContratsHoraire,
  useCreateContratHoraire,
  useDeleteContratHoraire,
  useUpdateContratHoraire,
  type ContratHoraire,
  type ContratHoraireInput,
} from '@/hooks/useContratsHoraire';
import { getErrorMessage } from '@/lib/api';
import { confirmerAvecSweetAlert } from '@/lib/confirmation';

const JOURS = [1, 2, 3, 4, 5, 6, 7] as const;

interface ContratsHorairesProps {
  employeId: number;
  peutGerer: boolean;
  lectureSeule: boolean;
}

interface FormulaireContrat {
  mode_travail: ContratHoraireInput['mode_travail'];
  heure_debut: string;
  heure_fin: string;
  jours_travail: number[];
  date_debut: string;
  date_fin: string;
}

function dateLocale(date: string): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

function dateAujourdhui(): string {
  const maintenant = new Date();
  const deuxChiffres = (valeur: number) => String(valeur).padStart(2, '0');

  return `${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`;
}

function estActifAujourdHui(contrat: ContratHoraire): boolean {
  const aujourdhui = dateAujourdhui();
  return contrat.actif === 1
    && contrat.date_debut <= aujourdhui
    && (!contrat.date_fin || contrat.date_fin >= aujourdhui);
}

export function ContratsHoraires({
  employeId,
  peutGerer,
  lectureSeule,
}: ContratsHorairesProps) {
  const t = useTranslations('employes');
  const tCommon = useTranslations('common');
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [confirmerCloture, setConfirmerCloture] = useState(false);
  const [contratEnEdition, setContratEnEdition] = useState<number | null>(null);
  const [formulaire, setFormulaire] = useState<FormulaireContrat>({
    mode_travail: 'TEMPS_PLEIN',
    heure_debut: '07:30',
    heure_fin: '17:30',
    jours_travail: [1, 2, 3, 4, 5],
    date_debut: dateAujourdhui(),
    date_fin: '',
  });
  const contratsQuery = useContratsHoraire(employeId);
  const createMutation = useCreateContratHoraire(employeId);
  const updateMutation = useUpdateContratHoraire(employeId);
  const deleteMutation = useDeleteContratHoraire(employeId);

  async function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const libre = formulaire.mode_travail === 'HORAIRE_LIBRE';
    const donnees: ContratHoraireInput = {
      ...formulaire,
      heure_debut: libre ? null : formulaire.heure_debut,
      heure_fin: libre ? null : formulaire.heure_fin,
      date_fin: formulaire.date_fin || null,
      cloturer_contrat_existant: confirmerCloture || undefined,
    };

    try {
      if (contratEnEdition !== null) {
        await updateMutation.mutateAsync({ contratId: contratEnEdition, contrat: donnees });
      } else {
        await createMutation.mutateAsync(donnees);
      }
      toast.success(t('contrats.enregistre'));
      setFormulaireOuvert(false);
      setConfirmerCloture(false);
      setContratEnEdition(null);
    } catch (error) {
      if (contratEnEdition === null && axios.isAxiosError(error) && error.response?.status === 409 && !confirmerCloture) {
        setConfirmerCloture(true);
        return;
      }
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message ?? getErrorMessage(error)
        : getErrorMessage(error);
      toast.error(message);
    }
  }

  function commencerModification(contrat: ContratHoraire) {
    let jours: number[] = [];
    try {
      const parsed: unknown = JSON.parse(contrat.jours_travail);
      if (Array.isArray(parsed)) {
        jours = parsed.filter((jour): jour is number => Number.isInteger(jour) && jour >= 1 && jour <= 7);
      }
    } catch {
      jours = [];
    }
    setFormulaire({
      mode_travail: contrat.mode_travail,
      heure_debut: contrat.heure_debut?.slice(0, 5) ?? '',
      heure_fin: contrat.heure_fin?.slice(0, 5) ?? '',
      jours_travail: jours,
      date_debut: contrat.date_debut.slice(0, 10),
      date_fin: contrat.date_fin?.slice(0, 10) ?? '',
    });
    setContratEnEdition(contrat.id);
    setConfirmerCloture(false);
    setFormulaireOuvert(true);
  }

  async function supprimerContrat(contrat: ContratHoraire) {
    if (!await confirmerAvecSweetAlert(t('contrats.confirmerSuppression'), {
      title: tCommon('confirm'),
      confirmButtonText: tCommon('yes'),
      cancelButtonText: tCommon('no'),
      destructive: true,
    })) return;
    try {
      await deleteMutation.mutateAsync(contrat.id);
      toast.success(t('contrats.supprime'));
      if (contratEnEdition === contrat.id) {
        setContratEnEdition(null);
        setFormulaireOuvert(false);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  function modifierJour(jour: number, coche: boolean) {
    setFormulaire((courant) => ({
      ...courant,
      jours_travail: coche
        ? [...courant.jours_travail, jour].sort((a, b) => a - b)
        : courant.jours_travail.filter((valeur) => valeur !== jour),
    }));
  }

  return (
    <div className="space-y-4">
      {lectureSeule && (
        <div className="flex items-center gap-2 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
          <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
          {t('contrats.lectureSeule')}
        </div>
      )}

      {contratsQuery.isLoading ? (
        <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
      ) : contratsQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">{getErrorMessage(contratsQuery.error)}</p>
      ) : contratsQuery.data?.length ? (
        <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
          {contratsQuery.data.map((contrat) => (
            <li key={contrat.id} className="space-y-2 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{t(`contrats.modes.${contrat.mode_travail}`)}</span>
                <div className="flex items-center gap-2">
                  {estActifAujourdHui(contrat) && <Badge>{t('contrats.actif')}</Badge>}
                  {peutGerer && (
                    <>
                      <Button type="button" size="icon" variant="ghost" aria-label={t('contrats.modifier')} title={t('contrats.modifier')} onClick={() => commencerModification(contrat)}>
                        <Pencil aria-hidden="true" className="size-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" aria-label={t('contrats.supprimer')} title={t('contrats.supprimer')} disabled={deleteMutation.isPending} onClick={() => void supprimerContrat(contrat)}>
                        <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-muted-foreground">
                {dateLocale(contrat.date_debut)} — {contrat.date_fin ? dateLocale(contrat.date_fin) : t('contrats.sansFin')}
                {contrat.heure_debut && contrat.heure_fin
                  ? ` · ${contrat.heure_debut.slice(0, 5)}–${contrat.heure_fin.slice(0, 5)}`
                  : ''}
              </p>
              {estActifAujourdHui(contrat) && (
                <p className="text-xs text-muted-foreground">
                  {t('contrats.actifDepuis', { date: dateLocale(contrat.date_debut) })}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('contrats.aucun')}</p>
      )}

      {peutGerer && (
        <>
          {!formulaireOuvert ? (
            <Button type="button" size="sm" onClick={() => {
              setContratEnEdition(null);
              setFormulaire({
                mode_travail: 'TEMPS_PLEIN',
                heure_debut: '07:30',
                heure_fin: '17:30',
                jours_travail: [1, 2, 3, 4, 5],
                date_debut: dateAujourdhui(),
                date_fin: '',
              });
              setFormulaireOuvert(true);
            }}>
              <Plus aria-hidden="true" className="size-4" />
              {t('contrats.nouveau')}
            </Button>
          ) : (
            <form onSubmit={enregistrer} className="space-y-4 rounded-md border p-4">
              <div className="space-y-2">
                <Label>{t('contrats.mode')}</Label>
                <Select
                  value={formulaire.mode_travail}
                  onValueChange={(value) => {
                    if (value !== null) {
                      setFormulaire((courant) => ({ ...courant, mode_travail: value }));
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['TEMPS_PLEIN', 'MI_TEMPS_MATIN', 'MI_TEMPS_APRES_MIDI', 'HORAIRE_LIBRE'] as const).map((mode) => (
                      <SelectItem key={mode} value={mode}>{t(`contrats.modes.${mode}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formulaire.mode_travail !== 'HORAIRE_LIBRE' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`contrat-debut-${employeId}`}>{t('contrats.heureDebut')}</Label>
                    <Input id={`contrat-debut-${employeId}`} type="time" required value={formulaire.heure_debut} onChange={(event) => setFormulaire({ ...formulaire, heure_debut: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`contrat-fin-${employeId}`}>{t('contrats.heureFin')}</Label>
                    <Input id={`contrat-fin-${employeId}`} type="time" required value={formulaire.heure_fin} onChange={(event) => setFormulaire({ ...formulaire, heure_fin: event.target.value })} />
                  </div>
                </div>
              )}

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t('contrats.joursTravail')}</legend>
                <div className="flex flex-wrap gap-3">
                  {JOURS.map((jour) => (
                    <label key={jour} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={formulaire.jours_travail.includes(jour)}
                        onCheckedChange={(checked) => modifierJour(jour, checked === true)}
                      />
                      {t(`contrats.jours.${jour}`)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`contrat-date-debut-${employeId}`}>{t('contrats.dateDebut')}</Label>
                  <Input id={`contrat-date-debut-${employeId}`} type="date" required value={formulaire.date_debut} onChange={(event) => setFormulaire({ ...formulaire, date_debut: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`contrat-date-fin-${employeId}`}>{t('contrats.dateFin')}</Label>
                  <Input id={`contrat-date-fin-${employeId}`} type="date" value={formulaire.date_fin} onChange={(event) => setFormulaire({ ...formulaire, date_fin: event.target.value })} />
                </div>
              </div>

              {confirmerCloture && (
                <label className="flex items-start gap-2 rounded-md border border-amber-500/50 p-3 text-sm">
                  <Checkbox checked onCheckedChange={() => setConfirmerCloture(false)} />
                  <span>{t('contrats.cloturerAncien')}</span>
                </label>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setFormulaireOuvert(false); setConfirmerCloture(false); setContratEnEdition(null); }}>
                  {tCommon('cancel')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || formulaire.jours_travail.length === 0}>
                  {createMutation.isPending || updateMutation.isPending ? t('contrats.enregistrement') : tCommon('save')}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
