'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { format, subDays } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarClock,
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import {
  useCreerRapportPlanifie,
  useEnvoyerRapport,
  useExportRapport,
  useModifierRapportPlanifie,
  useRapportQuotidien,
  useRapportsPlanifies,
  useSupprimerRapportPlanifie,
} from '@/hooks/useRapports';
import { RapportHistorique } from '@/components/rapports/rapport-historique';
import { RapportJournalierConfig } from '@/components/rapports/rapport-journalier-config';
import { RapportJournalierApercus } from '@/components/rapports/rapport-journalier-apercus';
import { useAuthStore } from '@/stores/authStore';
import { api, getErrorMessage, type ApiResponse } from '@/lib/api';
import type {
  RapportFormat,
  RapportPerimetreType,
  RapportPlanifie,
  RapportPlanifieCreate,
  RapportPlanifieType,
  RapportQuotidien,
} from '@/types/rapport';

interface UniteOption {
  id: number;
  nom: string;
  enfants?: UniteOption[];
}

const defaultForm: RapportPlanifieCreate = {
  nom: '',
  type: 'QUOTIDIEN',
  heure_envoi: '08:00',
  jours_semaine: '1,2,3,4,5',
  format: 'PDF',
  langue: 'fr',
  perimetre_type: 'TOUS',
  perimetre_unite_id: null,
  inclure_agents_bureau: 1,
  actif: 1,
};

const statutColors: Record<RapportQuotidien['details'][number]['statut'], string> = {
  NORMAL:
    'border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300',
  RETARD:
    'border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300',
  EN_COURS:
    'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
  ANORMAL:
    'border-red-200 bg-red-100 text-red-800 dark:border-muted dark:bg-muted dark:text-muted-foreground',
  ABSENT:
    'border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300',
  SANS_JUGEMENT:
    'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300',
  FERIE:
    'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
  REPOS:
    'border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300',
};

function flattenUnites(unites: UniteOption[], niveau = 0): Array<{ id: number; nom: string; niveau: number }> {
  return unites.flatMap((unite) => [
    { id: unite.id, nom: unite.nom, niveau },
    ...flattenUnites(unite.enfants ?? [], niveau + 1),
  ]);
}

function getErrorMessageFromApi(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = error.response;
    if (typeof response === 'object' && response !== null && 'data' in response) {
      const data = response.data;
      if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
        return data.message;
      }
    }
  }

  return getErrorMessage(error);
}

function formatDateTime(value: string | null, locale: string, emptyLabel: string): string {
  if (!value) return emptyLabel;
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return format(date, 'Pp', { locale: locale === 'fr' ? fr : enGB });
}

/** Consultation et gestion des rapports de présence et de leurs planifications. */
export default function RapportsPage() {
  const t = useTranslations('rapports');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const user = useAuthStore((state) => state.user);
  const canManageReports = Boolean(user?.is_super_admin || user?.role === 'admin' || user?.role === 'rh');
  const canPreviewScheduledReports = Boolean(
    canManageReports
    || ['superviseur', 'chef_service', 'directeur', 'commissaire'].includes(user?.role ?? '')
  );
  const [activeTab, setActiveTab] = useState('quotidien');
  const [selectedDate, setSelectedDate] = useState(() => format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [reportDate, setReportDate] = useState('');
  const [detailsLimit, setDetailsLimit] = useState(10);
  const [detailsOffset, setDetailsOffset] = useState(0);
  const [planifiesLimit, setPlanifiesLimit] = useState(10);
  const [planifiesOffset, setPlanifiesOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlanifie, setEditingPlanifie] = useState<RapportPlanifie | null>(null);
  const [deletingPlanifie, setDeletingPlanifie] = useState<RapportPlanifie | null>(null);
  const [form, setForm] = useState<RapportPlanifieCreate>(defaultForm);

  const rapportQuery = useRapportQuotidien(reportDate);
  const exportMutation = useExportRapport();
  const envoyerMutation = useEnvoyerRapport();
  const planifiesQuery = useRapportsPlanifies(canManageReports);
  const creerMutation = useCreerRapportPlanifie();
  const modifierMutation = useModifierRapportPlanifie();
  const supprimerMutation = useSupprimerRapportPlanifie();
  const unitsQuery = useQuery({
    queryKey: ['unites'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<UniteOption[]>>('/api/unites');
      return flattenUnites(response.data.data);
    },
  });

  const rapport = rapportQuery.data;
  const planifies = planifiesQuery.data?.items ?? [];
  const totalDetails = rapport?.details.length ?? 0;
  const detailsPage = rapport?.details.slice(detailsOffset, detailsOffset + detailsLimit) ?? [];
  const planifiesPage = planifies.slice(planifiesOffset, planifiesOffset + planifiesLimit);
  const unites = unitsQuery.data ?? [];
  const formPending = creerMutation.isPending || modifierMutation.isPending;
  const stats = useMemo(
    () =>
      rapport
        ? [
            { label: t('stats.totalEmployes'), value: rapport.stats.total_employes },
            { label: t('stats.presents'), value: rapport.stats.presents },
            { label: t('stats.absents'), value: rapport.stats.absents },
            { label: t('stats.normaux'), value: rapport.stats.normaux },
            { label: t('stats.retards'), value: rapport.stats.retards },
            { label: t('stats.anormaux'), value: rapport.stats.anormaux },
            { label: t('stats.feries'), value: rapport.stats.feries },
            { label: t('stats.repos'), value: rapport.stats.repos },
            { label: t('stats.sansJugement'), value: rapport.stats.sans_jugement ?? 0 },
            { label: t('stats.heuresTotales'), value: `${rapport.stats.heures_totales} ${t('heures')}` },
            { label: t('stats.moyenneHeures'), value: `${rapport.stats.moyenne_heures} ${t('heures')}` },
          ]
        : [],
    [rapport, t]
  );

  const genererRapport = () => {
    if (!selectedDate) return;
    setDetailsOffset(0);
    setReportDate(selectedDate);
  };

  const exporterRapport = async (format: Extract<RapportFormat, 'PDF' | 'EXCEL'>) => {
    try {
      await exportMutation.mutateAsync({ date: reportDate, format });
      toast.success(t('exportReussi'));
    } catch (error) {
      toast.error(getErrorMessageFromApi(error));
    }
  };

  const envoyerRapport = async () => {
    try {
      await envoyerMutation.mutateAsync({ date: reportDate, format: 'PDF' });
      toast.success(t('envoiReussi'));
    } catch (error) {
      toast.error(getErrorMessageFromApi(error));
    }
  };

  const ouvrirCreation = () => {
    setEditingPlanifie(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const ouvrirModification = (planifie: RapportPlanifie) => {
    setEditingPlanifie(planifie);
    setForm({
      nom: planifie.nom,
      type: planifie.type,
      heure_envoi: planifie.heure_envoi.slice(0, 5),
      jours_semaine: planifie.jours_semaine,
      format: planifie.format,
      langue: planifie.langue,
      perimetre_type: planifie.perimetre_type,
      perimetre_unite_id: planifie.perimetre_unite_id,
      inclure_agents_bureau: planifie.inclure_agents_bureau,
      actif: planifie.actif,
    });
    setDialogOpen(true);
  };

  const enregistrerPlanifie = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = {
      ...form,
      heure_envoi: form.heure_envoi.length === 5 ? `${form.heure_envoi}:00` : form.heure_envoi,
    };

    try {
      if (editingPlanifie) {
        await modifierMutation.mutateAsync({ id: editingPlanifie.id, data });
        toast.success(t('modificationReussie'));
      } else {
        await creerMutation.mutateAsync(data);
        toast.success(t('ajoutReussi'));
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessageFromApi(error));
    }
  };

  const supprimerPlanifie = async () => {
    if (!deletingPlanifie) return;
    try {
      await supprimerMutation.mutateAsync(deletingPlanifie.id);
      toast.success(t('suppressionReussie'));
      if (planifies.length - 1 <= planifiesOffset) {
        setPlanifiesOffset(Math.max(0, planifiesOffset - planifiesLimit));
      }
      setDeletingPlanifie(null);
    } catch (error) {
      toast.error(getErrorMessageFromApi(error));
    }
  };

  const basculerPlanifie = async (planifie: RapportPlanifie, actif: boolean) => {
    try {
      await modifierMutation.mutateAsync({ id: planifie.id, data: { actif: actif ? 1 : 0 } });
      toast.success(actif ? t('planification.activer') : t('planification.desactiver'));
    } catch (error) {
      toast.error(getErrorMessageFromApi(error));
    }
  };

  const typeLabel = (type: RapportPlanifieType) => t(`planification.${type.toLowerCase()}`);
  const perimetreLabel = (perimetre: RapportPerimetreType) => t(`perimetres.${perimetre.toLowerCase()}`);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      </header>

      <Tabs value={activeTab} onValueChange={(value) => value && setActiveTab(value)}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="quotidien">
            <FileText aria-hidden="true" className="size-4" />
            {t('quotidien')}
          </TabsTrigger>
          {canPreviewScheduledReports && (
            <TabsTrigger value="apercus">
              <Eye aria-hidden="true" className="size-4" />
              {t('apercus.title')}
            </TabsTrigger>
          )}
          {canManageReports && (
            <>
              <TabsTrigger value="planifies">
                <RefreshCw aria-hidden="true" className="size-4" />
                {t('planifies')}
              </TabsTrigger>
              <TabsTrigger value="journalier">
                <CalendarClock aria-hidden="true" className="size-4" />
                {t('journalier.title')}
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="historique">
            <History aria-hidden="true" className="size-4" />
            {t('historique.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotidien" className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-end">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="rapport-date">{t('date')}</Label>
                <Input
                  id="rapport-date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setReportDate('');
                  }}
                />
              </div>
              <Button type="button" onClick={genererRapport} disabled={!selectedDate || rapportQuery.isFetching}>
                {rapportQuery.isFetching ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <FileText aria-hidden="true" className="size-4" />
                )}
                {t('generer')}
              </Button>
            </CardContent>
          </Card>

          {!reportDate && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">{t('aucunRapport')}</CardContent>
            </Card>
          )}

          {rapportQuery.isFetching && (
            <Card>
              <CardHeader>
                <CardTitle>{t('chargement')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-8 w-2/3" />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-24" />)}
                </div>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          )}

          {rapportQuery.isError && !rapportQuery.isFetching && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-destructive">{getErrorMessageFromApi(rapportQuery.error) || t('erreurChargement')}</p>
                <Button type="button" variant="outline" onClick={() => void rapportQuery.refetch()}>
                  <RefreshCw aria-hidden="true" className="size-4" />
                  {tCommon('retry')}
                </Button>
              </CardContent>
            </Card>
          )}

          {rapport && !rapportQuery.isFetching && (
            <>
              <section className="space-y-4" aria-labelledby="rapport-apercu">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 id="rapport-apercu" className="text-2xl font-semibold">{rapport.titre}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('destinataire')}: {rapport.destinataire.nom}
                      {rapport.destinataire.unite ? ` · ${rapport.destinataire.unite}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void exporterRapport('PDF')}
                      disabled={exportMutation.isPending}
                    >
                        {exportMutation.isPending && exportMutation.variables?.format === 'PDF' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                        {exportMutation.isPending && exportMutation.variables?.format === 'PDF' ? t('exportEnCours') : t('exporterPDF')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void exporterRapport('EXCEL')}
                      disabled={exportMutation.isPending}
                    >
                        {exportMutation.isPending && exportMutation.variables?.format === 'EXCEL' ? <Loader2 className="size-4 animate-spin" /> : <Download aria-hidden="true" className="size-4" />}
                        {exportMutation.isPending && exportMutation.variables?.format === 'EXCEL' ? t('exportEnCours') : t('exporterExcel')}
                    </Button>
                    <Button type="button" onClick={() => void envoyerRapport()} disabled={envoyerMutation.isPending}>
                      {envoyerMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                      {envoyerMutation.isPending ? t('envoiEnCours') : t('envoyerParEmail')}
                    </Button>
                  </div>
                </div>

                {!rapport.est_jour_travaille && rapport.raison_non_travaille && (
                  <p role="status" className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-200">
                    {t(`jourNonTravaille.${rapport.raison_non_travaille.toLowerCase()}`)}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {stats.map((stat) => (
                    <Card key={stat.label} size="sm">
                      <CardHeader className="pb-1">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {rapport.alertes.length > 0 && (
                  <Card className="border-destructive/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle aria-hidden="true" className="size-5" />
                        {t('alertes')} ({rapport.alertes.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-inside list-disc space-y-1 text-sm">
                        {rapport.alertes.map((alerte, index) => <li key={`${index}-${alerte}`}>{alerte}</li>)}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>{t('apercu')} — {rapport.stats.total_employes.toLocaleString(locale)} {t('employes')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detailsPage.length === 0 ? (
                      <p className="py-8 text-center text-muted-foreground">{t('aucunDetail')}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('date')}</TableHead>
                              <TableHead>{t('table.matricule')}</TableHead>
                              <TableHead>{t('table.nom')}</TableHead>
                              <TableHead>{t('table.prenom')}</TableHead>
                              <TableHead>{t('table.unite')}</TableHead>
                              <TableHead>{t('table.pointages')}</TableHead>
                              <TableHead className="text-right">{t('table.heures')}</TableHead>
                              <TableHead>{t('table.arriveeTardive')}</TableHead>
                              <TableHead>{t('table.departAnticipe')}</TableHead>
                              <TableHead>{t('table.statut')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detailsPage.map((detail) => (
                              <TableRow key={`${detail.matricule}-${detail.nom}-${detail.prenom}`}>
                                <TableCell>{rapport.date}</TableCell>
                                <TableCell className="font-medium">{detail.matricule}</TableCell>
                                <TableCell>{detail.nom}</TableCell>
                                <TableCell>{detail.prenom}</TableCell>
                                <TableCell>{detail.unite || '—'}</TableCell>
                                <TableCell className="min-w-48">
                                  {detail.pointages.map((pointage) => `${pointage.type} ${pointage.heure}`).join(', ') || '—'}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{detail.heures_travaillees}</TableCell>
                                <TableCell className="tabular-nums">
                                  {detail.arrivee_tardive
                                    ? `${detail.arrivee_tardive} (${t('retardMinutes', { count: detail.retard_minutes })})`
                                    : '—'}
                                </TableCell>
                                <TableCell className="tabular-nums">
                                  {detail.depart_anticipe
                                    ? `${detail.depart_anticipe} (${t('retardMinutes', { count: detail.depart_anticipe_minutes })})`
                                    : '—'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={statutColors[detail.statut]}>
                                    {t(`statuts.${detail.statut.toLowerCase()}`)}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {totalDetails > 0 && (
                      <DataTablePagination
                        total={totalDetails}
                        limit={detailsLimit}
                        offset={detailsOffset}
                        onLimitChange={setDetailsLimit}
                        onOffsetChange={setDetailsOffset}
                      />
                    )}
                  </CardContent>
                </Card>
              </section>
            </>
          )}
        </TabsContent>

        <TabsContent value="journalier">
          <RapportJournalierConfig />
        </TabsContent>

        {canPreviewScheduledReports && (
          <TabsContent value="apercus">
            <RapportJournalierApercus enabled={activeTab === 'apercus'} />
          </TabsContent>
        )}

        <TabsContent value="historique">
          <RapportHistorique />
        </TabsContent>

        {canManageReports && <TabsContent value="planifies" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">{t('planifies')}</h2>
            <Button type="button" onClick={ouvrirCreation}>
              <Plus aria-hidden="true" className="size-4" />
              {t('creerPlanifie')}
            </Button>
          </div>

          {planifiesQuery.isLoading ? (
            <Card>
              <CardContent className="space-y-3 py-4">
                {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
              </CardContent>
            </Card>
          ) : planifiesQuery.isError ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10">
                <p className="text-destructive">{getErrorMessageFromApi(planifiesQuery.error)}</p>
                <Button type="button" variant="outline" onClick={() => void planifiesQuery.refetch()}>{tCommon('retry')}</Button>
              </CardContent>
            </Card>
          ) : planifies.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">{t('aucunPlanifie')}</CardContent>
            </Card>
          ) : (
            <Card>
              <Table className="sticky-actions">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('planification.nom')}</TableHead>
                    <TableHead>{t('planification.destinataire')}</TableHead>
                    <TableHead>{t('planification.frequence')}</TableHead>
                    <TableHead>{t('planification.heure')}</TableHead>
                    <TableHead>{t('planification.format')}</TableHead>
                    <TableHead>{t('planification.langue')}</TableHead>
                    <TableHead>{t('planification.perimetre')}</TableHead>
                    <TableHead>{t('planification.actif')}</TableHead>
                    <TableHead>{t('planification.dernierEnvoi')}</TableHead>
                    <TableHead className="text-right">{tCommon('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planifiesPage.map((planifie) => (
                    <TableRow key={planifie.id}>
                      <TableCell className="font-medium">{planifie.nom}</TableCell>
                      <TableCell>{planifie.destinataire_nom || planifie.destinataire_email || planifie.user_id}</TableCell>
                      <TableCell>{typeLabel(planifie.type)}</TableCell>
                      <TableCell>{planifie.heure_envoi.slice(0, 5)}</TableCell>
                      <TableCell>{planifie.format}</TableCell>
                      <TableCell>{t(`langues.${planifie.langue}`)}</TableCell>
                      <TableCell>{perimetreLabel(planifie.perimetre_type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(Number(planifie.actif))}
                            aria-label={Boolean(Number(planifie.actif)) ? t('planification.desactiver') : t('planification.activer')}
                            onCheckedChange={(checked) => void basculerPlanifie(planifie, checked)}
                            disabled={modifierMutation.isPending}
                          />
                          <span className="text-sm text-muted-foreground">
                            {Boolean(Number(planifie.actif)) ? t('actif') : t('inactif')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDateTime(planifie.dernier_envoi, locale, '—')}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="icon" variant="ghost" aria-label={t('planification.modifier')} onClick={() => ouvrirModification(planifie)}>
                            <Pencil aria-hidden="true" className="size-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" aria-label={t('planification.supprimer')} onClick={() => setDeletingPlanifie(planifie)}>
                            <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <CardContent className="pt-0">
                <DataTablePagination
                  total={planifies.length}
                  limit={planifiesLimit}
                  offset={planifiesOffset}
                  onLimitChange={setPlanifiesLimit}
                  onOffsetChange={setPlanifiesOffset}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPlanifie ? t('modifierPlanifie') : t('creerPlanifie')}</DialogTitle>
            <DialogDescription>{t('planifies')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void enregistrerPlanifie(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="planifie-nom">{t('nom')}</Label>
                <Input id="planifie-nom" required maxLength={150} value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="planifie-type">{t('type')}</Label>
                <Select value={form.type} onValueChange={(value) => value && setForm({ ...form, type: value as RapportPlanifieType })}>
                  <SelectTrigger id="planifie-type" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['QUOTIDIEN', 'HEBDOMADAIRE', 'MENSUEL'] as const).map((type) => <SelectItem key={type} value={type}>{typeLabel(type)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="planifie-heure">{t('heure')}</Label>
                <Input id="planifie-heure" type="time" required value={form.heure_envoi} onChange={(event) => setForm({ ...form, heure_envoi: event.target.value })} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="planifie-jours">{t('joursSemaine')}</Label>
                <Input id="planifie-jours" value={form.jours_semaine ?? ''} onChange={(event) => setForm({ ...form, jours_semaine: event.target.value })} />
                <p className="text-xs text-muted-foreground">{t('joursAide')}</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="planifie-format">{t('format')}</Label>
                <Select value={form.format} onValueChange={(value) => value && setForm({ ...form, format: value as RapportFormat })}>
                  <SelectTrigger id="planifie-format" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['PDF', 'EXCEL', 'HTML'] as const).map((formatOption) => <SelectItem key={formatOption} value={formatOption}>{formatOption}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="planifie-langue">{t('langue')}</Label>
                <Select value={form.langue} onValueChange={(value) => value && setForm({ ...form, langue: value as RapportPlanifieCreate['langue'] })}>
                  <SelectTrigger id="planifie-langue" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['fr', 'en', 'rn'] as const).map((langue) => <SelectItem key={langue} value={langue}>{t(`langues.${langue}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="planifie-perimetre">{t('perimetre')}</Label>
                <Select value={form.perimetre_type} onValueChange={(value) => value && setForm({ ...form, perimetre_type: value as RapportPerimetreType })}>
                  <SelectTrigger id="planifie-perimetre" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['EQUIPE', 'SERVICE', 'DIRECTION', 'COMMISSARIAT', 'TOUS'] as const).map((perimetre) => <SelectItem key={perimetre} value={perimetre}>{perimetreLabel(perimetre)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="planifie-unite">{t('unite')}</Label>
                <Combobox
                  id="planifie-unite"
                  options={[
                    { value: 'none', label: t('aucuneUnite') },
                    ...unites.map((unite) => ({
                      value: String(unite.id),
                      label: `${'\u00a0'.repeat(unite.niveau * 2)}${unite.nom}`,
                    })),
                  ]}
                  value={form.perimetre_unite_id ? String(form.perimetre_unite_id) : 'none'}
                  onValueChange={(value) => setForm({ ...form, perimetre_unite_id: value && value !== 'none' ? Number(value) : null })}
                  placeholder={t('aucuneUnite')}
                  searchPlaceholder={t('rechercherUnite')}
                  emptyMessage={t('aucuneUniteTrouvee')}
                  className="w-full"
                />
                {unitsQuery.isError && <p className="text-xs text-destructive">{getErrorMessageFromApi(unitsQuery.error)}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:justify-between">
              <label htmlFor="planifie-bureau" className="flex items-center gap-3 text-sm">
                <Switch id="planifie-bureau" checked={Boolean(Number(form.inclure_agents_bureau))} onCheckedChange={(checked) => setForm({ ...form, inclure_agents_bureau: checked ? 1 : 0 })} />
                {t('inclureAgentsBureau')}
              </label>
              <label htmlFor="planifie-actif" className="flex items-center gap-3 text-sm">
                <Switch id="planifie-actif" checked={Boolean(Number(form.actif))} onCheckedChange={(checked) => setForm({ ...form, actif: checked ? 1 : 0 })} />
                {t('actif')}
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{tCommon('cancel')}</Button>
              <Button type="submit" disabled={formPending}>
                {formPending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deletingPlanifie !== null} onOpenChange={(open) => { if (!open) setDeletingPlanifie(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('planification.supprimer')}</DialogTitle>
            <DialogDescription>
              {deletingPlanifie && t('confirmationSuppression', { nom: deletingPlanifie.nom })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingPlanifie(null)}>{tCommon('cancel')}</Button>
            <Button type="button" variant="destructive" onClick={() => void supprimerPlanifie()} disabled={supprimerMutation.isPending}>
              {supprimerMutation.isPending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
              {tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
