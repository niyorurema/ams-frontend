'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  eachDayOfInterval,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfMonth,
  subDays,
} from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import {
  AlertCircle,
  CalendarDays,
  Download,
  Ellipsis,
  Fingerprint,
  ListFilter,
  Plus,
  Users,
  Waypoints,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { EvolutionChart } from '@/components/pointages/evolution-chart';
import { PointageManuelDialog } from '@/components/pointages/pointage-manuel-dialog';
import { PointagesRealtime } from '@/components/pointages/pointages-realtime';
import { RecalculerDialog } from '@/components/pointages/recalculer-dialog';
import { getErrorMessage } from '@/lib/api';
import { useCapteurs } from '@/hooks/useCapteurs';
import { useEmployes } from '@/hooks/useEmployes';
import {
  useExportPointages,
  usePointages,
  useStatsPointages,
} from '@/hooks/usePointages';
import { useAuthStore } from '@/stores/authStore';
import type { Pointage } from '@/types/pointage';

const eventTypes: Pointage['type_evenement'][] = [
  'CHECK_IN',
  'CHECK_OUT',
  'BREAK_IN',
  'BREAK_OUT',
  'UNKNOWN',
];

const eventColors: Record<Pointage['type_evenement'], string> = {
  CHECK_IN: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  CHECK_OUT: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
  BREAK_IN: 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300',
  BREAK_OUT: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  UNKNOWN: 'border-muted bg-muted text-muted-foreground',
};

interface Period {
  debut: string;
  fin: string;
}

function buildChartData(
  dailyCounts: Array<{ date: string; count: number }>,
  period: Period,
  locale: ReturnType<typeof useLocale>
) {
  const localeDate = locale === 'fr' ? fr : enGB;
  const start = parseISO(`${period.debut}T00:00:00`);
  const end = parseISO(`${period.fin}T00:00:00`);
  const counts = new Map(dailyCounts.map((item) => [item.date, item.count]));
  const days = eachDayOfInterval({ start, end });

  if (differenceInCalendarDays(end, start) <= 90) {
    return days.map((day) => {
      const date = format(day, 'yyyy-MM-dd');
      return {
        date,
        label: format(day, 'dd/MM', { locale: localeDate }),
        count: counts.get(date) ?? 0,
      };
    });
  }

  const monthlyCounts = new Map<string, number>();
  for (const day of days) {
    const month = format(startOfMonth(day), 'yyyy-MM');
    const date = format(day, 'yyyy-MM-dd');
    monthlyCounts.set(month, (monthlyCounts.get(month) ?? 0) + (counts.get(date) ?? 0));
  }

  return Array.from(monthlyCounts, ([month, count]) => ({
    date: month,
    label: format(parseISO(`${month}-01T00:00:00`), 'MMM yyyy', { locale: localeDate }),
    count,
  }));
}

function formatPointageDate(
  value: string,
  locale: ReturnType<typeof useLocale>,
  dateInvalide: string,
) {
  const parsed = parseISO(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() < 2001) return dateInvalide;
  return format(parsed, 'dd/MM/yyyy HH:mm', { locale: locale === 'fr' ? fr : enGB });
}

/** Consultation, filtrage et export des pointages du tenant courant. */
export default function PointagesPage() {
  const t = useTranslations('pointages');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const user = useAuthStore((state) => state.user);
  const localeDate = locale === 'fr' ? fr : enGB;
  const today = new Date();
  const defaultPeriod = {
    debut: format(subDays(today, 29), 'yyyy-MM-dd'),
    fin: format(today, 'yyyy-MM-dd'),
  };

  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [employeeId, setEmployeeId] = useState<number | undefined>();
  const [sensorId, setSensorId] = useState<number | undefined>();
  const [eventType, setEventType] = useState<Pointage['type_evenement'] | undefined>();
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailPointage, setDetailPointage] = useState<Pointage | null>(null);
  const [detailKind, setDetailKind] = useState<'employe' | 'capteur' | null>(null);
  const [pointageRecalcul, setPointageRecalcul] = useState<Pointage | null>(null);
  const [showManuelDialog, setShowManuelDialog] = useState(false);

  const filters = {
    date_debut: period.debut,
    date_fin: period.fin,
    employe_id: employeeId,
    capteur_id: sensorId,
    type_evenement: eventType,
    limit,
    offset,
  };
  const pointagesQuery = usePointages(filters);
  const countQuery = usePointages({ limit: 1, offset: 0 });
  const statsQuery = useStatsPointages(period.debut, period.fin);
  const capteursQuery = useCapteurs({ limit: 1000, offset: 0 });
  const employesQuery = useEmployes({ limit: 1000, offset: 0 });
  const exportMutation = useExportPointages();

  const items = pointagesQuery.data?.items ?? [];
  const total = pointagesQuery.data?.pagination.total ?? 0;
  const selectedOnPage = items.filter((item) => selectedIds.includes(String(item.id))).length;
  const allOnPageSelected = items.length > 0 && selectedOnPage === items.length;
  const peutCreerManuel = user !== null
    && (user.is_super_admin || user.role === 'admin' || user.role === 'rh');
  const chartData = statsQuery.data
    ? buildChartData(statsQuery.data.par_jour, period, locale)
    : [];
  const numberFormat = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB');
  const employeOptions = useMemo(() => (employesQuery.data?.items ?? []).map((employe) => ({
    value: String(employe.id),
    label: `${employe.matricule} — ${employe.nom} ${employe.prenom}`,
    description: employe.unite_nom ?? undefined,
    keywords: `${employe.nom} ${employe.prenom} ${employe.matricule}`,
  })), [employesQuery.data?.items]);
  const capteurOptions = useMemo(() => (capteursQuery.data?.items ?? []).map((capteur) => ({
    value: String(capteur.id),
    label: capteur.nom,
    description: `${capteur.adresse_ip}:${capteur.port}`,
  })), [capteursQuery.data?.items]);

  const resetFilters = () => {
    setPeriod(defaultPeriod);
    setEmployeeId(undefined);
    setSensorId(undefined);
    setEventType(undefined);
    setOffset(0);
    setSelectedIds([]);
  };

  const toggleSelected = (id: number | string, checked: boolean) => {
    const normalizedId = String(id);
    setSelectedIds((current) => checked
      ? current.includes(normalizedId) ? current : [...current, normalizedId]
      : current.filter((selectedId) => selectedId !== normalizedId));
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? items.map((item) => String(item.id)) : []);
  };

  const exporter = async (format: 'csv' | 'excel') => {
    try {
      await exportMutation.mutateAsync({
        filters: {
          date_debut: period.debut,
          date_fin: period.fin,
          employe_id: employeeId,
          capteur_id: sensorId,
          type_evenement: eventType,
        },
        format,
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const typeLabel = (type: Pointage['type_evenement']) => t(typeTranslationKeys[type]);
  const openDetail = (pointage: Pointage, kind: 'employe' | 'capteur') => {
    setDetailPointage(pointage);
    setDetailKind(kind);
  };

  return (
    <div className="w-full space-y-6 pb-8">
      <header className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays aria-hidden="true" className="size-4" />
            <span>{format(parseISO(`${period.debut}T00:00:00`), 'dd MMM', { locale: localeDate })} – {format(parseISO(`${period.fin}T00:00:00`), 'dd MMM yyyy', { locale: localeDate })}</span>
          </div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('totalPointages', { count: numberFormat.format(countQuery.data?.pagination.total ?? 0) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {peutCreerManuel && (
            <Button type="button" variant="outline" onClick={() => setShowManuelDialog(true)}>
              <Plus aria-hidden="true" />
              {t('ajouterManuel')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => void exporter('csv')} disabled={exportMutation.isPending}>
            <Download aria-hidden="true" />
            {exportMutation.isPending ? t('exportEnCours') : t('exporterCSV')}
          </Button>
          <Button type="button" onClick={() => void exporter('excel')} disabled={exportMutation.isPending}>
            <Download aria-hidden="true" />
            {exportMutation.isPending ? t('exportEnCours') : t('exporterExcel')}
          </Button>
        </div>
      </header>

      <PointagesRealtime />

      <section aria-label={t('stats.title')} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t('stats.total')} value={statsQuery.data ? numberFormat.format(statsQuery.data.total) : '—'} icon={Waypoints} tone="text-cyan-700 dark:text-cyan-300" loading={statsQuery.isLoading} />
        <StatCard title={t('stats.moyenneJour')} value={statsQuery.data ? numberFormat.format(statsQuery.data.moyenne_par_jour) : '—'} icon={CalendarDays} tone="text-emerald-700 dark:text-emerald-300" loading={statsQuery.isLoading} />
        <StatCard title={t('stats.employesActifs')} value={statsQuery.data ? numberFormat.format(statsQuery.data.employes_actifs) : '—'} icon={Users} tone="text-amber-700 dark:text-amber-300" loading={statsQuery.isLoading} />
        <StatCard title={t('stats.capteursUtilises')} value={statsQuery.data ? numberFormat.format(statsQuery.data.capteurs_utilises) : '—'} icon={Fingerprint} tone="text-rose-700 dark:text-rose-300" loading={statsQuery.isLoading} />
      </section>

      {statsQuery.isLoading ? (
        <Card><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
      ) : statsQuery.error ? (
        <Card><CardContent><div role="alert" className="flex h-64 items-center justify-center gap-2 text-sm text-destructive"><AlertCircle aria-hidden="true" className="size-4" />{t('erreurStats')}</div></CardContent></Card>
      ) : (
        <EvolutionChart data={chartData} />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListFilter aria-hidden="true" className="size-4 text-muted-foreground" />
            <CardTitle>{t('filtrer')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FormField label={t('dateDebut')}>
              <Input type="date" value={period.debut} max={period.fin} onChange={(event) => {
                setPeriod((current) => ({ ...current, debut: event.target.value }));
                setOffset(0);
                setSelectedIds([]);
              }} />
            </FormField>
            <FormField label={t('dateFin')}>
              <Input type="date" value={period.fin} min={period.debut} onChange={(event) => {
                setPeriod((current) => ({ ...current, fin: event.target.value }));
                setOffset(0);
                setSelectedIds([]);
              }} />
            </FormField>
            <FormField label={t('employe')}>
              <Combobox
                options={employeOptions}
                value={employeeId === undefined ? 'all' : String(employeeId)}
                onValueChange={(value) => {
                  setEmployeeId(value === 'all' ? undefined : Number(value));
                  setOffset(0);
                  setSelectedIds([]);
                }}
                placeholder={t('tousEmployes')}
                searchPlaceholder={t('rechercherEmploye')}
                emptyMessage={t('aucunEmploye')}
                allowAll
                allLabel={t('tousEmployes')}
              />
            </FormField>
            <FormField label={t('capteur')}>
              <Combobox
                options={capteurOptions}
                value={sensorId === undefined ? 'all' : String(sensorId)}
                onValueChange={(value) => {
                  setSensorId(value === 'all' ? undefined : Number(value));
                  setOffset(0);
                  setSelectedIds([]);
                }}
                placeholder={t('tousCapteurs')}
                searchPlaceholder={t('rechercherCapteur')}
                emptyMessage={t('aucunCapteur')}
                allowAll
                allLabel={t('tousCapteurs')}
              />
            </FormField>
            <FormField label={t('type')}>
              <Select value={eventType ?? 'all'} onValueChange={(value) => {
                setEventType(!value || value === 'all' ? undefined : value as Pointage['type_evenement']);
                setOffset(0);
                setSelectedIds([]);
              }}>
                <SelectTrigger aria-label={t('type')}>
                  <SelectValue>{eventType === undefined ? t('tousTypes') : typeLabel(eventType)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('tousTypes')}</SelectItem>
                  {eventTypes.map((type) => (
                    <SelectItem key={type} value={type}>{typeLabel(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={resetFilters}>{t('reinitialiser')}</Button>
          </div>
        </CardContent>
      </Card>

      <section aria-label={t('title')} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold">{t('resultats')}</h2>
            <span className="text-sm tabular-nums text-muted-foreground">{numberFormat.format(total)}</span>
          </div>
          {selectedIds.length > 0 && <p aria-live="polite" className="text-sm text-muted-foreground">{t('selectionnes', { count: selectedIds.length })}</p>}
        </div>

        {pointagesQuery.isLoading ? (
          <Card>
            <CardContent className="space-y-3 pt-4">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
            </CardContent>
          </Card>
        ) : pointagesQuery.error ? (
          <Card>
            <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
              <AlertCircle aria-hidden="true" className="size-6 text-destructive" />
              <p role="alert" className="text-sm text-muted-foreground">{getErrorMessage(pointagesQuery.error)}</p>
              <Button variant="outline" onClick={() => void pointagesQuery.refetch()}>{tCommon('retry')}</Button>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card><CardContent className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">{t('aucunResultat')}</CardContent></Card>
        ) : (
          <div className="space-y-2">
            <DataTablePagination
              total={total}
              limit={limit}
              offset={offset}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setOffset(0);
                setSelectedIds([]);
              }}
              onOffsetChange={(newOffset) => {
                setOffset(newOffset);
                setSelectedIds([]);
              }}
            />
            <Card className="gap-0 py-0">
            <div className="overflow-x-auto">
              <Table className="sticky-actions min-w-[1120px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox aria-label={t('selectionnerPage')} checked={allOnPageSelected} onCheckedChange={(checked) => toggleAll(checked === true)} />
                    </TableHead>
                    <TableHead>{t('dateHeure')}</TableHead>
                    <TableHead>{t('employe')}</TableHead>
                    <TableHead>{t('type')}</TableHead>
                    <TableHead>{t('statutCalcul')}</TableHead>
                    <TableHead>{t('capteur')}</TableHead>
                    <TableHead>{t('source')}</TableHead>
                    <TableHead className="w-12 text-right">{tCommon('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((pointage) => {
                    const rowId = String(pointage.id);
                    return (
                      <TableRow key={rowId} data-state={selectedIds.includes(rowId) ? 'selected' : undefined}>
                        <TableCell>
                          <Checkbox aria-label={t('selectionnerPointage', { id: rowId })} checked={selectedIds.includes(rowId)} onCheckedChange={(checked) => toggleSelected(rowId, checked === true)} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium tabular-nums">{formatPointageDate(pointage.date_pointage, locale, t('realtimeDateInvalide'))}</TableCell>
                        <TableCell className="max-w-56">
                          {pointage.employe_nom || pointage.employe_prenom ? (
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate font-medium">
                                {[pointage.employe_nom, pointage.employe_prenom].filter(Boolean).join(' ')}
                              </span>
                              <span className="truncate font-mono text-xs text-muted-foreground">
                                {pointage.employe_matricule || '—'}
                              </span>
                            </div>
                          ) : (
                            <Badge variant="destructive" className="text-xs">{t('nonIdentifie')}</Badge>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="outline" className={eventColors[pointage.type_evenement]}>{typeLabel(pointage.type_evenement)}</Badge></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={calculationStatusColors[pointage.statut_calcul]}>
                            {t(calculationStatusTranslationKeys[pointage.statut_calcul])}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-48 truncate">{pointage.capteur_nom || t('capteurInconnu')}</TableCell>
                        <TableCell className="text-muted-foreground">{t(`sourceLabels.${pointage.source}`)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={`${tCommon('actions')}: ${rowId}`} title={tCommon('actions')}><Ellipsis aria-hidden="true" /></Button>} />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled={!pointage.employe_nom} onClick={() => openDetail(pointage, 'employe')}>{t('voirEmploye')}</DropdownMenuItem>
                              <DropdownMenuItem disabled={!pointage.capteur_nom} onClick={() => openDetail(pointage, 'capteur')}>{t('voirCapteur')}</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPointageRecalcul(pointage)}>{t('recalculButton')}</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            </Card>
            <DataTablePagination
              total={total}
              limit={limit}
              offset={offset}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setOffset(0);
                setSelectedIds([]);
              }}
              onOffsetChange={(newOffset) => {
                setOffset(newOffset);
                setSelectedIds([]);
              }}
            />
          </div>
        )}
      </section>

      <Dialog open={detailPointage !== null && detailKind !== null} onOpenChange={(open) => { if (!open) { setDetailPointage(null); setDetailKind(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailKind === 'employe' ? t('detailEmploye') : t('detailCapteur')}</DialogTitle>
            <DialogDescription>{t('detailPointageDescription')}</DialogDescription>
          </DialogHeader>
          {detailPointage && detailKind === 'employe' && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('employe')}</dt><dd className="font-medium">{[detailPointage.employe_nom, detailPointage.employe_prenom].filter(Boolean).join(' ') || '—'}</dd>
              <dt className="text-muted-foreground">{t('matricule')}</dt><dd className="font-medium">{detailPointage.employe_matricule ?? '—'}</dd>
              <dt className="text-muted-foreground">{t('badge')}</dt><dd className="font-medium">{detailPointage.badge_id}</dd>
              <dt className="text-muted-foreground">ID</dt><dd className="font-medium">{detailPointage.employe_id ?? '—'}</dd>
            </dl>
          )}
          {detailPointage && detailKind === 'capteur' && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('capteur')}</dt><dd className="font-medium">{detailPointage.capteur_nom || '—'}</dd>
              <dt className="text-muted-foreground">ID</dt><dd className="font-medium">{detailPointage.capteur_id ?? '—'}</dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>
      <RecalculerDialog
        pointage={pointageRecalcul}
        onOpenChange={(open) => { if (!open) setPointageRecalcul(null); }}
      />
      <PointageManuelDialog open={showManuelDialog} onOpenChange={setShowManuelDialog} />
    </div>
  );
}

const typeTranslationKeys: Record<Pointage['type_evenement'], string> = {
  CHECK_IN: 'checkIn',
  CHECK_OUT: 'checkOut',
  BREAK_IN: 'breakEnd',
  BREAK_OUT: 'breakStart',
  UNKNOWN: 'inconnu',
};

const calculationStatusColors: Record<Pointage['statut_calcul'], string> = {
  VALIDE: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  RETARD: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  ANORMAL: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300',
  UNKNOWN: 'border-muted bg-muted text-muted-foreground',
};

const calculationStatusTranslationKeys: Record<Pointage['statut_calcul'], string> = {
  VALIDE: 'valide',
  RETARD: 'retard',
  ANORMAL: 'anormal',
  UNKNOWN: 'statutInconnu',
};

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  title: string;
  value: string;
  icon: typeof Waypoints;
  tone: string;
  loading: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon aria-hidden="true" className={`size-4 shrink-0 ${tone}`} />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-semibold tabular-nums">{value}</p>}
      </CardContent>
    </Card>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
