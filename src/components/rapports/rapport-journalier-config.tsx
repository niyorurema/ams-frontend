'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import {
  useOrganisation,
  type Mandat,
  type OrganisationData,
  type UniteOrganisationnelle,
} from '@/hooks/useOrganisation';
import {
  useConfigurationRapportJournalier,
  useEnregistrerConfigurationRapportJournalier,
} from '@/hooks/useRapports';
import { getErrorMessage } from '@/lib/api';
import type {
  RapportJournalierConfiguration,
  RapportJournalierDestinataire,
} from '@/types/rapport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

const defaultConfiguration: RapportJournalierConfiguration = {
  heure_envoi: '08:00',
  format: 'PDF',
  langue: 'fr',
  actif: false,
};

const weekdayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

interface UniteNode extends UniteOrganisationnelle {
  enfants: UniteNode[];
}

function estActif(value: boolean | number | string): boolean {
  return value === true || value === 1 || value === '1';
}

function construireArbre(unites: UniteOrganisationnelle[]): UniteNode[] {
  const nodes = new Map<number, UniteNode>();
  for (const unite of unites) {
    nodes.set(unite.id, { ...unite, enfants: [] });
  }

  const racines: UniteNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id === null ? undefined : nodes.get(node.parent_id);
    if (parent) parent.enfants.push(node);
    else racines.push(node);
  }

  for (const node of nodes.values()) {
    node.enfants.sort((left, right) => left.ordre_affichage - right.ordre_affichage || left.nom.localeCompare(right.nom));
  }

  const visites = new Set<number>();
  const visiter = (node: UniteNode) => {
    if (visites.has(node.id)) return;
    visites.add(node.id);
    node.enfants.forEach(visiter);
  };
  racines.forEach(visiter);
  for (const node of nodes.values()) {
    if (!visites.has(node.id)) {
      racines.push(node);
      visiter(node);
    }
  }

  return racines.sort((left, right) => left.ordre_affichage - right.ordre_affichage || left.nom.localeCompare(right.nom));
}

function aplatirArbre(unites: UniteNode[], niveau = 0): Array<{ unite: UniteNode; niveau: number }> {
  return unites.flatMap((unite) => [
    { unite, niveau },
    ...aplatirArbre(unite.enfants, niveau + 1),
  ]);
}

function mandatCourant(mandat: Mandat, utilisateurs: OrganisationData['utilisateurs'], uniteActive: boolean): boolean {
  const utilisateur = utilisateurs.find((user) => user.id === mandat.user_id);
  if (
    !estActif(mandat.est_actif)
    || !uniteActive
    || !utilisateur
    || !['superviseur', 'chef_service', 'directeur', 'commissaire'].includes(utilisateur.role)
  ) {
    return false;
  }
  const today = new Date();
  const dateAujourdhui = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return mandat.date_debut <= dateAujourdhui
    && (mandat.date_fin === null || mandat.date_fin >= dateAujourdhui);
}

function ArbreDestinataires({
  unites,
  mandats,
  utilisateurs,
  niveau = 0,
  chemin = [],
}: {
  unites: UniteNode[];
  mandats: Mandat[];
  utilisateurs: OrganisationData['utilisateurs'];
  niveau?: number;
  chemin?: number[];
}) {
  const t = useTranslations('rapports.journalier');

  return (
    <ul className={niveau > 0 ? 'ml-4 space-y-2 border-l pl-3' : 'space-y-2'}>
      {unites.map((unite) => {
        const mandatsUnite = mandats.filter((mandat) => mandat.unite_id === unite.id);
        const recursif = chemin.includes(unite.id);

        return (
          <li key={unite.id} className="min-w-0">
            <details open={niveau === 0}>
              <summary className="cursor-pointer rounded-md px-2 py-2 hover:bg-muted">
                <span className="ml-1 inline-flex flex-wrap items-center gap-2 align-middle">
                  <span className="font-medium">{unite.nom}</span>
                  <span className="text-xs text-muted-foreground">{unite.type} · {unite.code}</span>
                  {!estActif(unite.actif) && (
                    <span className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">{t('inactiveUnit')}</span>
                  )}
                </span>
              </summary>
              <div className="space-y-2 py-2 pl-5">
                {mandatsUnite.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noUnitRecipients')}</p>
                ) : (
                  <ul className="space-y-1">
                    {mandatsUnite.map((mandat) => {
                      const utilisateur = utilisateurs.find((user) => user.id === mandat.user_id);
                      const courant = mandatCourant(mandat, utilisateurs, estActif(unite.actif));
                      const nom = utilisateur?.nom_complet
                        || mandat.titulaire_nom
                        || [mandat.employe_prenom, mandat.employe_nom].filter(Boolean).join(' ')
                        || t('unknownRecipient');

                      return (
                        <li key={mandat.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span>{nom}</span>
                          <span className="text-muted-foreground">{utilisateur?.email || t('missingEmail')}</span>
                          <span className="rounded border px-1.5 py-0.5 text-xs">{t(`mandateTypes.${mandat.type_mandat}`)}</span>
                          <span className={courant ? 'text-xs text-green-700 dark:text-green-400' : 'text-xs text-muted-foreground'}>
                            {courant ? t('currentRecipient') : t('inactiveRecipient')}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!recursif && unite.enfants.length > 0 && (
                  <ArbreDestinataires
                    unites={unite.enfants}
                    mandats={mandats}
                    utilisateurs={utilisateurs}
                    niveau={niveau + 1}
                    chemin={[...chemin, unite.id]}
                  />
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export function RapportJournalierConfig() {
  const t = useTranslations('rapports.journalier');
  const configurationQuery = useConfigurationRapportJournalier();
  const organisationQuery = useOrganisation();
  const saveMutation = useEnregistrerConfigurationRapportJournalier();
  const [configurationDraft, setConfigurationDraft] = useState<Partial<RapportJournalierConfiguration> | null>(null);
  const [destinatairesDraft, setDestinatairesDraft] = useState<RapportJournalierDestinataire[] | null>(null);
  const [uniteDestinataire, setUniteDestinataire] = useState('');
  const [utilisateurDestinataire, setUtilisateurDestinataire] = useState('');
  const serverConfiguration = configurationQuery.data?.configuration;
  const configuration: RapportJournalierConfiguration = {
    ...defaultConfiguration,
    ...(serverConfiguration ?? {}),
    ...(serverConfiguration
      ? { heure_envoi: serverConfiguration.heure_envoi.slice(0, 5) }
      : {}),
    ...(configurationDraft ?? {}),
  };
  const destinataires = destinatairesDraft ?? configurationQuery.data?.destinataires ?? [];

  const modifierConfiguration = (patch: Partial<RapportJournalierConfiguration>) => {
    setConfigurationDraft((current) => ({ ...configuration, ...current, ...patch }));
  };

  const ajouterDestinataire = () => {
    const userId = Number(utilisateurDestinataire);
    const uniteId = Number(uniteDestinataire);
    const utilisateur = utilisateurs.find((item) => item.id === userId);
    const unite = unitesPlates.find((item) => item.unite.id === uniteId)?.unite;
    if (!utilisateur || !unite) return;
    if (destinataires.some((item) => item.user_id === userId && item.unite_id === uniteId)) {
      toast.error(t('duplicateAssignment'));
      return;
    }
    setDestinatairesDraft((current) => [
      ...(current ?? destinataires),
      {
        user_id: userId,
        unite_id: uniteId,
        unite_nom: unite.nom,
        nom_complet: utilisateur.nom_complet,
        email: utilisateur.email ?? '',
      },
    ]);
    setUtilisateurDestinataire('');
  };

  const supprimerDestinataire = (userId: number, uniteId: number | null) => {
    setDestinatairesDraft((current) => (current ?? destinataires).filter(
      (item) => item.user_id !== userId || item.unite_id !== uniteId
    ));
  };

  const changerUniteDestinataire = (userId: number, ancienneUniteId: number | null, nouvelleValeur: string) => {
    const nouvelleUniteId = nouvelleValeur === 'none' ? null : Number(nouvelleValeur);
    if (destinataires.some((item) => (
      item.user_id === userId
      && item.unite_id === nouvelleUniteId
      && item.unite_id !== ancienneUniteId
    ))) {
      toast.error(t('duplicateAssignment'));
      return;
    }
    const unite = nouvelleUniteId === null
      ? null
      : unitesPlates.find((item) => item.unite.id === nouvelleUniteId)?.unite ?? null;
    setDestinatairesDraft((current) => (current ?? destinataires).map((item) => (
      item.user_id === userId && item.unite_id === ancienneUniteId
        ? { ...item, unite_id: nouvelleUniteId, unite_nom: unite?.nom ?? null }
        : item
    )));
  };

  const enregistrer = async () => {
    try {
      await saveMutation.mutateAsync({
        ...configuration,
        heure_envoi: configuration.heure_envoi.length === 5
          ? `${configuration.heure_envoi}:00`
          : configuration.heure_envoi,
        actif: Boolean(Number(configuration.actif)),
        destinataires: destinataires.map(({ user_id, unite_id }) => ({ user_id, unite_id })),
      });
      toast.success(t('saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const joursTravailles = configurationQuery.data?.jours_travailles ?? [];
  const utilisateurs = organisationQuery.data?.utilisateurs ?? [];
  const organisation = organisationQuery.data;
  const arbreUnites = construireArbre(organisation?.unites ?? []);
  const unitesPlates = aplatirArbre(arbreUnites).filter(({ unite }) => estActif(unite.actif));
  const optionsUnites = unitesPlates.map(({ unite, niveau }) => ({
    value: String(unite.id),
    label: `${'— '.repeat(niveau)}${unite.nom}`,
    description: `${unite.type} · ${unite.code}`,
    keywords: `${unite.nom} ${unite.code} ${unite.type}`,
  }));
  const optionsUnitesAffectation = [
    {
      value: 'none',
      label: t('legacyTenantWide'),
      keywords: t('legacyTenantWide'),
    },
    ...optionsUnites,
  ];
  const optionsUtilisateurs = utilisateurs
    .filter((utilisateur) => Boolean(utilisateur.email))
    .map((utilisateur) => ({
      value: String(utilisateur.id),
      label: utilisateur.nom_complet,
      description: utilisateur.email ?? undefined,
      keywords: `${utilisateur.nom_complet} ${utilisateur.email ?? ''} ${utilisateur.matricule ?? ''}`,
    }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        {configurationQuery.isLoading ? (
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </CardContent>
        ) : configurationQuery.isError ? (
          <CardContent className="text-sm text-destructive">{getErrorMessage(configurationQuery.error)}</CardContent>
        ) : (
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="journalier-heure">{t('time')}</Label>
                <Input
                  id="journalier-heure"
                  type="time"
                  value={configuration.heure_envoi}
                  onChange={(event) => modifierConfiguration({ heure_envoi: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="journalier-format">{t('format')}</Label>
                <Select
                  value={configuration.format}
                  onValueChange={(value) => value && modifierConfiguration({
                    format: value as RapportJournalierConfiguration['format'],
                  })}
                >
                  <SelectTrigger id="journalier-format"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PDF">PDF</SelectItem>
                    <SelectItem value="EXCEL">Excel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="journalier-langue">{t('language')}</Label>
                <Select
                  value={configuration.langue}
                  onValueChange={(value) => value && modifierConfiguration({
                    langue: value as RapportJournalierConfiguration['langue'],
                  })}
                >
                  <SelectTrigger id="journalier-langue"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="rn">Kirundi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-3">
              <p className="text-sm">
                {t('workingDays', {
                  days: joursTravailles
                    .map((day) => t(`weekdays.${weekdayKeys[day - 1]}`))
                    .join(', '),
                })}
              </p>
              <label htmlFor="journalier-actif" className="flex items-center gap-3 text-sm">
                <Switch
                  id="journalier-actif"
                  checked={Boolean(Number(configuration.actif))}
                  onCheckedChange={(actif) => modifierConfiguration({ actif })}
                />
                {Boolean(Number(configuration.actif)) ? t('enabled') : t('disabled')}
              </label>
            </div>

            <section className="space-y-3">
              <div>
                <h3 className="font-medium">{t('automaticRecipients')}</h3>
                <p className="text-sm text-muted-foreground">{t('automaticRecipientsHelp')}</p>
                {organisationQuery.isLoading ? (
                  <Skeleton className="mt-2 h-24 w-full" />
                ) : organisationQuery.isError ? (
                  <p className="mt-2 text-sm text-destructive">{getErrorMessage(organisationQuery.error)}</p>
                ) : arbreUnites.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{t('noUnits')}</p>
                ) : (
                  <div className="mt-2 max-h-[32rem] overflow-y-auto rounded-lg border p-2">
                    <ArbreDestinataires
                      unites={arbreUnites}
                      mandats={organisation?.mandats ?? []}
                      utilisateurs={utilisateurs}
                    />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-medium">{t('additionalRecipients')}</h3>
                <p className="mb-2 text-sm text-muted-foreground">{t('additionalRecipientsHelp')}</p>
                {organisationQuery.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : organisationQuery.isError ? (
                  <p className="text-sm text-destructive">{getErrorMessage(organisationQuery.error)}</p>
                ) : (
                  <div className="space-y-4 rounded-lg border p-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1.5fr)_auto] sm:items-end">
                      <div className="grid gap-2">
                        <Label htmlFor="destinataire-unite">{t('assignmentUnit')}</Label>
                        <Combobox
                          id="destinataire-unite"
                          options={optionsUnites}
                          value={uniteDestinataire || undefined}
                          onValueChange={setUniteDestinataire}
                          placeholder={t('chooseUnit')}
                          searchPlaceholder={t('searchUnit')}
                          emptyMessage={t('noSearchResults')}
                          disabled={optionsUnites.length === 0}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="destinataire-utilisateur">{t('searchRecipient')}</Label>
                        <Combobox
                          id="destinataire-utilisateur"
                          options={optionsUtilisateurs}
                          value={utilisateurDestinataire || undefined}
                          onValueChange={setUtilisateurDestinataire}
                          placeholder={t('chooseRecipient')}
                          searchPlaceholder={t('searchPlaceholder')}
                          emptyMessage={t('noSearchResults')}
                          disabled={optionsUtilisateurs.length === 0}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={ajouterDestinataire}
                        disabled={!uniteDestinataire || !utilisateurDestinataire}
                      >
                        <Plus aria-hidden="true" className="size-4" />
                        {t('addAssignment')}
                      </Button>
                    </div>

                    {destinataires.length > 0 ? (
                      <div className="space-y-2">
                        {destinataires.map((destinataire) => (
                          <div
                            key={`${destinataire.user_id}-${destinataire.unite_id ?? 'global'}`}
                            className="grid gap-2 rounded-md bg-muted/50 p-2 sm:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1.5fr)_auto] sm:items-center"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{destinataire.nom_complet}</span>
                              <span className="block truncate text-xs text-muted-foreground">{destinataire.email || t('missingEmail')}</span>
                            </span>
                            <Combobox
                              ariaLabel={t('assignmentUnit')}
                              options={optionsUnitesAffectation}
                              value={destinataire.unite_id === null ? 'none' : String(destinataire.unite_id)}
                              onValueChange={(value) => changerUniteDestinataire(destinataire.user_id, destinataire.unite_id, value)}
                              placeholder={t('chooseUnit')}
                              searchPlaceholder={t('searchUnit')}
                              emptyMessage={t('noSearchResults')}
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label={t('removeAssignment')}
                              onClick={() => supprimerDestinataire(destinataire.user_id, destinataire.unite_id)}
                            >
                              <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('noRecipients')}</p>
                    )}
                  </div>
                )}
              </div>
            </section>

            <div className="flex justify-end">
              <Button type="button" onClick={() => void enregistrer()} disabled={saveMutation.isPending || organisationQuery.isLoading}>
                {saveMutation.isPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />}
                {t('save')}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
