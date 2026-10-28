'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCreerJourFerie,
  useImporterJoursFeriesBurundi,
  useJoursFeries,
  useModifierJourFerie,
  useSupprimerJourFerie,
  type JourFerie,
  type JourFerieInput,
  type JourFerieType,
} from '@/hooks/useJoursFeries';
import { getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { confirmerAvecSweetAlert } from '@/lib/confirmation';

const types: JourFerieType[] = ['NATIONAL', 'RELIGIEUX', 'PERSONNALISE', 'CONGE'];

function creerFormulaire(date: string): JourFerieInput {
  return {
    date,
    nom: '',
    type: 'PERSONNALISE',
    recurrent: false,
    travaille: false,
    description: '',
    actif: true,
  };
}

function estActif(value: number | boolean): boolean {
  return value === true || Number(value) === 1;
}

export default function JoursFeriesPage() {
  const t = useTranslations('parametres.joursFeries');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'rh' || user?.is_super_admin;
  const [moisCourant, setMoisCourant] = useState(() => startOfMonth(new Date()));
  const [typeFiltre, setTypeFiltre] = useState<JourFerieType | 'all'>('all');
  const [dialogueOuvert, setDialogueOuvert] = useState(false);
  const [edition, setEdition] = useState<JourFerie | null>(null);
  const [formulaire, setFormulaire] = useState<JourFerieInput>(() => creerFormulaire(format(new Date(), 'yyyy-MM-dd')));

  const filtres = useMemo(() => ({
    annee: Number(format(moisCourant, 'yyyy')),
    mois: Number(format(moisCourant, 'M')),
    type: typeFiltre,
  }), [moisCourant, typeFiltre]);
  const joursQuery = useJoursFeries(filtres);
  const creer = useCreerJourFerie();
  const modifier = useModifierJourFerie();
  const supprimer = useSupprimerJourFerie();
  const importer = useImporterJoursFeriesBurundi();
  const jours = useMemo(() => joursQuery.data?.items ?? [], [joursQuery.data?.items]);
  const joursParDate = useMemo(
    () => new Map(jours.map((jour) => [jour.date_occurrence ?? jour.date, jour])),
    [jours],
  );
  const datesDuMois = eachDayOfInterval({
    start: startOfMonth(moisCourant),
    end: endOfMonth(moisCourant),
  });
  const decalageDebut = (getDay(startOfMonth(moisCourant)) + 6) % 7;
  const localeDate = locale === 'fr' ? fr : enGB;
  const joursSemaine = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + index)),
  );

  function ouvrirCreation(date = format(moisCourant, 'yyyy-MM-01')) {
    setEdition(null);
    setFormulaire(creerFormulaire(date));
    setDialogueOuvert(true);
  }

  function ouvrirEdition(jour: JourFerie) {
    setEdition(jour);
    setFormulaire({
      date: jour.date,
      nom: jour.nom,
      type: jour.type,
      recurrent: estActif(jour.recurrent),
      travaille: estActif(jour.travaille),
      description: jour.description ?? '',
      actif: estActif(jour.actif),
    });
    setDialogueOuvert(true);
  }

  async function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (edition) {
        await modifier.mutateAsync({ id: edition.id, data: formulaire });
        toast.success(t('updated'));
      } else {
        await creer.mutateAsync(formulaire);
        toast.success(t('created'));
      }
      setDialogueOuvert(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function supprimerJour(jour: JourFerie) {
    if (!await confirmerAvecSweetAlert(t('confirmDelete', { nom: jour.nom }), {
      title: tCommon('confirm'),
      confirmButtonText: tCommon('yes'),
      cancelButtonText: tCommon('no'),
      destructive: true,
    })) return;
    try {
      await supprimer.mutateAsync(jour.id);
      toast.success(t('deleted'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function importerBurundi() {
    try {
      const resultat = await importer.mutateAsync(filtres.annee);
      toast.success(t('importSuccess', { count: resultat.count }));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  if (!isAdmin) {
    return (
      <Card className="w-full">
        <CardHeader><CardTitle>{t('title')}</CardTitle><CardDescription>{t('accessDenied')}</CardDescription></CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void importerBurundi()} disabled={importer.isPending}>
            <CalendarDays aria-hidden="true" className="size-4" />
            {importer.isPending ? t('importing') : t('importerBurundi')}
          </Button>
          <Button type="button" onClick={() => ouvrirCreation()}>
            <Plus aria-hidden="true" className="size-4" />
            {t('ajouter')}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button type="button" size="icon" variant="outline" aria-label={t('moisPrecedent')} onClick={() => setMoisCourant((value) => subMonths(value, 1))}>
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <CardTitle className="min-w-40 text-center capitalize">
              {format(moisCourant, 'MMMM yyyy', { locale: localeDate })}
            </CardTitle>
            <Button type="button" size="icon" variant="outline" aria-label={t('moisSuivant')} onClick={() => setMoisCourant((value) => addMonths(value, 1))}>
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="filtre-type">{t('type')}</Label>
            <Select value={typeFiltre} onValueChange={(value) => setTypeFiltre(value as JourFerieType | 'all')}>
              <SelectTrigger id="filtre-type" className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tousTypes')}</SelectItem>
                {types.map((type) => <SelectItem key={type} value={type}>{t(`types.${type}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {joursQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('loading')}</p>
          ) : joursQuery.isError ? (
            <p role="alert" className="py-8 text-center text-sm text-destructive">{t('loadError')}</p>
          ) : (
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {joursSemaine.map((jour, index) => (
                <div key={`${jour}-${index}`} className="py-2 text-center text-xs font-medium text-muted-foreground">{jour}</div>
              ))}
              {Array.from({ length: decalageDebut }, (_, index) => <div key={`vide-${index}`} aria-hidden="true" />)}
              {datesDuMois.map((date) => {
                const dateTexte = format(date, 'yyyy-MM-dd');
                const jourFerie = joursParDate.get(dateTexte);
                return (
                  <button
                    key={dateTexte}
                    type="button"
                    onClick={() => jourFerie ? ouvrirEdition(jourFerie) : ouvrirCreation(dateTexte)}
                    aria-label={jourFerie ? `${format(date, 'd MMMM', { locale: localeDate })}: ${jourFerie.nom}` : format(date, 'd MMMM', { locale: localeDate })}
                    className={`min-h-16 rounded-lg border p-1 text-left transition-colors sm:min-h-20 sm:p-2 ${
                      jourFerie ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100' : 'hover:bg-accent'
                    }`}
                  >
                    <span className="text-sm font-medium">{format(date, 'd')}</span>
                    {jourFerie && <span className="mt-1 block truncate text-[10px] leading-tight sm:text-xs">{jourFerie.nom}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('listeTitle')}</CardTitle>
          <CardDescription>{t('listeDescription', { count: jours.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          {joursQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>
          ) : jours.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t('aucun')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="sticky-actions">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('nom')}</TableHead>
                    <TableHead>{t('type')}</TableHead>
                    <TableHead>{t('recurrent')}</TableHead>
                    <TableHead>{t('travaille')}</TableHead>
                    <TableHead>{t('actif')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jours.map((jour) => (
                    <TableRow key={jour.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(`${jour.date_occurrence ?? jour.date}T00:00:00`), 'P', { locale: localeDate })}</TableCell>
                      <TableCell className="font-medium">{jour.nom}</TableCell>
                      <TableCell><Badge variant="outline">{t(`types.${jour.type}`)}</Badge></TableCell>
                      <TableCell>{estActif(jour.recurrent) ? t('oui') : t('non')}</TableCell>
                      <TableCell>{estActif(jour.travaille) ? t('oui') : t('non')}</TableCell>
                      <TableCell>{estActif(jour.actif) ? t('oui') : t('non')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="icon" variant="ghost" aria-label={t('modifier')} onClick={() => ouvrirEdition(jour)}>
                            <Pencil aria-hidden="true" className="size-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" aria-label={t('supprimer')} onClick={() => void supprimerJour(jour)}>
                            <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogueOuvert} onOpenChange={setDialogueOuvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edition ? t('modifier') : t('ajouter')}</DialogTitle>
            <DialogDescription>{t('formDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void enregistrer(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="jour-ferie-date">{t('date')}</Label>
                <Input id="jour-ferie-date" type="date" required value={formulaire.date} onChange={(event) => setFormulaire((form) => ({ ...form, date: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jour-ferie-nom">{t('nom')}</Label>
                <Input id="jour-ferie-nom" required maxLength={150} value={formulaire.nom} onChange={(event) => setFormulaire((form) => ({ ...form, nom: event.target.value }))} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="jour-ferie-type">{t('type')}</Label>
                <Select value={formulaire.type} onValueChange={(value) => setFormulaire((form) => ({ ...form, type: value as JourFerieType }))}>
                  <SelectTrigger id="jour-ferie-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{types.map((type) => <SelectItem key={type} value={type}>{t(`types.${type}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="jour-ferie-description">{t('descriptionField')}</Label>
                <textarea
                  id="jour-ferie-description"
                  maxLength={2000}
                  rows={3}
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formulaire.description}
                  onChange={(event) => setFormulaire((form) => ({ ...form, description: event.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <Label htmlFor="jour-ferie-recurrent">{t('recurrent')}</Label>
                <Switch id="jour-ferie-recurrent" checked={formulaire.recurrent} onCheckedChange={(recurrent) => setFormulaire((form) => ({ ...form, recurrent }))} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <Label htmlFor="jour-ferie-travaille">{t('travaille')}</Label>
                <Switch id="jour-ferie-travaille" checked={formulaire.travaille} onCheckedChange={(travaille) => setFormulaire((form) => ({ ...form, travaille }))} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3 sm:col-span-2">
                <Label htmlFor="jour-ferie-actif">{t('actif')}</Label>
                <Switch id="jour-ferie-actif" checked={formulaire.actif} onCheckedChange={(actif) => setFormulaire((form) => ({ ...form, actif }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogueOuvert(false)}>{t('annuler')}</Button>
              <Button type="submit" disabled={creer.isPending || modifier.isPending}>
                {creer.isPending || modifier.isPending ? t('saving') : t('enregistrer')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
