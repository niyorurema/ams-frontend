'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  eachDayOfInterval,
  differenceInCalendarDays,
  format,
  addMonths,
  parseISO,
  startOfMonth,
  subDays,
} from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import {
  AlertCircle,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  CalendarDays,
  Download,
  Ellipsis,
  Fingerprint,
  ListFilter,
  Plus,
  Search,
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
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
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
import { api, getErrorMessage } from '@/lib/api';
import { useAllAdminTenants } from '@/hooks/useAdminTenants';
import { useCapteurs, type CapteursResponse } from '@/hooks/useCapteurs';
import { useEmployes, type EmployesResponse } from '@/hooks/useEmployes';
import {
  useExportPointages,
  useRecalculerPointagesMasse,
  usePointages,
  useStatsPointages,
  type RecalculMasseResult,
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

  if (differenceInCalendarDays(end, start) <= 90) {
    const days = eachDayOfInterval({ start, end });
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
  for (let month = startOfMonth(start); month <= end; month = addMonths(month, 1)) {
    monthlyCounts.set(format(month, 'yyyy-MM'), 0);
  }
  for (const [date, count] of counts) {
    if (date < period.debut || date > period.fin) continue;
    const month = date.slice(0, 7);
    if (monthlyCounts.has(month)) {
      monthlyCounts.set(month, (monthlyCounts.get(month) ?? 0) + count);
    }
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

/** Consultation, filtrage et export des pointages dans le périmètre autorisé. */
export default function PointagesPage() {
  const t = useTranslations('pointages');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.is_super_admin === true;
  const localeDate = locale === 'fr' ? fr : enGB;
  const today = new Date();
  const defaultPeriod = {
    debut: format(subDays(today, 29), 'yyyy-MM-dd'),
    fin: format(today, 'yyyy-MM-dd'),
  };
  const requestedStart = searchParams.get('date_debut');
  const requestedEnd = searchParams.get('date_fin');
  const validRequestedRange = requestedStart !== null
    && requestedEnd !== null
    && /^\d{4}-\d{2}-\d{2}$/.test(requestedStart)
    && /^\d{4}-\d{2}-\d{2}$/.test(requestedEnd)
    && requestedStart <= requestedEnd;
  const requestedEventType = searchParams.get('type_evenement');
  const requestedCalculatedStatus = searchParams.get('statut_calcul');

  const [period, setPeriod] = useState<Period>(
    validRequestedRange
      ? { debut: requestedStart, fin: requestedEnd }
      : defaultPeriod
  );
  const [selectedTenant, setSelectedTenant] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [employeeLookupText, setEmployeeLookupText] = useState('');
  const [employeeLookup, setEmployeeLookup] = useState('');
  const [selectedEmployeeOption, setSelectedEmployeeOption] = useState<ComboboxOption | undefined>();
  const [sensorLookupText, setSensorLookupText] = useState('');
  const [sensorLookup, setSensorLookup] = useState('');
  const [selectedSensorOption, setSelectedSensorOption] = useState<ComboboxOption | undefined>();
  const [employeeId, setEmployeeId] = useState<number | undefined>();
  const [sensorId, setSensorId] = useState<number | undefined>();
  const [eventType, setEventType] = useState<Pointage['type_evenement'] | undefined>(
    requestedEventType && eventTypes.includes(requestedEventType as Pointage['type_evenement'])
      ? requestedEventType as Pointage['type_evenement']
      : undefined
  );
  const [calculatedStatus, setCalculatedStatus] = useState<Pointage['statut_calcul'] | undefined>(
    requestedCalculatedStatus && ['VALIDE', 'RETARD', 'ANORMAL', 'UNKNOWN'].includes(requestedCalculatedStatus)
      ? requestedCalculatedStatus as Pointage['statut_calcul']
      : undefined
  );
  const [status, setStatus] = useState<Pointage['statut'] | undefined>();
  const [sortBy, setSortBy] = useState<'date_pointage' | 'employe' | 'type_evenement' | 'statut_calcul' | 'capteur' | 'source' | 'statut'>('date_pointage');
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC');
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkResult, setBulkResult] = useState<RecalculMasseResult | null>(null);
  const [detailPointage, setDetailPointage] = useState<Pointage | null>(null);
  const [detailKind, setDetailKind] = useState<'employe' | 'capteur' | null>(null);
  const [pointageRecalcul, setPointageRecalcul] = useState<Pointage | null>(null);
  const [showManuelDialog, setShowManuelDialog] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchText.trim());
      setOffset(0);
      setSelectedIds([]);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setEmployeeLookup(employeeLookupText.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [employeeLookupText]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSensorLookup(sensorLookupText.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [sensorLookupText]);

  const filters = {
    tenant_id: isSuperAdmin && selectedTenant !== 'all' ? Number(selectedTenant) : undefined,
    date_debut: period.debut,
    date_fin: period.fin,
    search: search || undefined,
    employe_id: employeeId,
    capteur_id: sensorId,
    type_evenement: eventType,
    statut_calcul: calculatedStatus,
    statut: status,
    sort_by: sortBy,
    sort_dir: sortDirection,
    limit,
    offset,
  };
  const tenantScopeId = isSuperAdmin
    ? selectedTenant === 'all' ? undefined : Number(selectedTenant)
    : user?.tenant_id;
  const tenantsQuery = useAllAdminTenants(isSuperAdmin);
  const allTenantScope = isSuperAdmin && tenantScopeId === undefined;
  const pointagesQuery = usePointages(filters);
  const statsQuery = useStatsPointages(period.debut, period.fin, filters.tenant_id);
  const capteursQuery = useCapteurs({
    tenant_id: tenantScopeId,
    search: sensorLookup || undefined,
    limit: 50,
    offset: 0,
    enabled: !allTenantScope,
  });
  const employesQuery = useEmployes({
    tenant_id: tenantScopeId,
    search: employeeLookup || undefined,
    limit: 50,
    offset: 0,
    enabled: !allTenantScope,
  });
  const tenantsForFilter = (tenantsQuery.data ?? []).filter((tenant) => tenant.is_active && !tenant.deleted_at);
  const employesTousTenantsQueries = useQueries({
    queries: allTenantScope
      ? tenantsForFilter.map((tenant) => ({
        queryKey: ['employes', 'pointages-filter', tenant.id, employeeLookup],
        queryFn: async () => {
          const params = new URLSearchParams({
            tenant_id: String(tenant.id),
            limit: '50',
            offset: '0',
          });
          if (employeeLookup) params.set('search', employeeLookup);
          const response = await api.get<{ data: EmployesResponse }>(`/api/employes?${params}`);
          return response.data.data.items;
        },
      }))
      : [],
  });
  const capteursTousTenantsQueries = useQueries({
    queries: allTenantScope
      ? tenantsForFilter.map((tenant) => ({
        queryKey: ['capteurs', 'pointages-filter', tenant.id, sensorLookup],
        queryFn: async () => {
          const params = new URLSearchParams({
            tenant_id: String(tenant.id),
            limit: '50',
            offset: '0',
          });
          if (sensorLookup) params.set('search', sensorLookup);
          const response = await api.get<{ data: CapteursResponse }>(`/api/capteurs?${params}`);
          return response.data.data.items;
        },
      }))
      : [],
  });
  const exportMutation = useExportPointages();
  const bulkRecalculate = useRecalculerPointagesMasse();

  const items = pointagesQuery.data?.items ?? [];
  const total = pointagesQuery.data?.pagination.total ?? 0;
  const selectedOnPage = items.filter((item) => selectedIds.includes(item.id)).length;
  const allOnPageSelected = items.length > 0 && selectedOnPage === items.length;
  const peutCreerManuel = user !== null
    && (user.is_super_admin || user.role === 'admin' || user.role === 'rh');
  const chartData = statsQuery.data
    ? buildChartData(statsQuery.data.par_jour, period, locale)
    : [];
  const numberFormat = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB');
  const employesFilterError = allTenantScope
    ? tenantsQuery.isError || employesTousTenantsQueries.some((query) => query.isError)
    : employesQuery.isError;
  const capteursFilterError = allTenantScope
    ? tenantsQuery.isError || capteursTousTenantsQueries.some((query) => query.isError)
    : capteursQuery.isError;
  const employesFilterLoading = allTenantScope
    ? tenantsQuery.isLoading || employesTousTenantsQueries.some((query) => query.isLoading)
    : employesQuery.isLoading;
  const capteursFilterLoading = allTenantScope
    ? tenantsQuery.isLoading || capteursTousTenantsQueries.some((query) => query.isLoading)
    : capteursQuery.isLoading;
  const employeOptions = useMemo(() => {
    const employesPourFiltre = allTenantScope
      ? employesTousTenantsQueries.flatMap((query) => query.data ?? [])
      : employesQuery.data?.items ?? [];
    const options: ComboboxOption[] = employesPourFiltre.map((employe) => {
      const tenantName = allTenantScope
        ? tenantsForFilter.find((tenant) => tenant.id === employe.tenant_id)?.name
        : undefined;
      return {
        value: String(employe.id),
        label: `${tenantName ? `${tenantName} · ` : ''}${employe.matricule} — ${employe.nom} ${employe.prenom}`,
        description: [tenantName, employe.unite_nom].filter(Boolean).join(' · ') || undefined,
        keywords: `${tenantName ?? ''} ${employe.nom} ${employe.prenom} ${employe.matricule}`,
      };
    });
    if (selectedEmployeeOption && !options.some((option) => option.value === selectedEmployeeOption.value)) {
      options.unshift(selectedEmployeeOption);
    }
    return options;
  }, [allTenantScope, employesQuery.data?.items, employesTousTenantsQueries, selectedEmployeeOption, tenantsForFilter]);
  const capteurOptions = useMemo(() => {
    const capteursPourFiltre = allTenantScope
      ? capteursTousTenantsQueries.flatMap((query) => query.data ?? [])
      : capteursQuery.data?.items ?? [];
    const options: ComboboxOption[] = capteursPourFiltre.map((capteur) => {
      const tenantName = allTenantScope
        ? tenantsForFilter.find((tenant) => tenant.id === capteur.tenant_id)?.name
        : undefined;
      return {
        value: String(capteur.id),
        label: `${tenantName ? `${tenantName} · ` : ''}${capteur.nom}`,
        description: `${tenantName ? `${tenantName} · ` : ''}${capteur.adresse_ip}:${capteur.port}`,
        keywords: tenantName,
      };
    });
    if (selectedSensorOption && !options.some((option) => option.value === selectedSensorOption.value)) {
      options.unshift(selectedSensorOption);
    }
    return options;
  }, [allTenantScope, capteursQuery.data?.items, capteursTousTenantsQueries, selectedSensorOption, tenantsForFilter]);
  const activeFilterLabels = [
    search ? `${t('recherche')}: ${search}` : null,
    employeeId !== undefined
      ? `${t('employe')}: ${employeOptions.find((option) => option.value === String(employeeId))?.label ?? employeeId}`
      : null,
    sensorId !== undefined
      ? `${t('capteur')}: ${capteurOptions.find((option) => option.value === String(sensorId))?.label ?? sensorId}`
      : null,
    eventType ? `${t('type')}: ${typeLabel(eventType)}` : null,
    calculatedStatus ? `${t('statutCalcule')}: ${t(`calculatedStatusLabels.${calculatedStatus}`)}` : null,
    status ? `${t('statut')}: ${t(`statusLabels.${status}`)}` : null,
  ].filter((label): label is string => label !== null);

  const resetFilters = () => {
    setPeriod(defaultPeriod);
    setSelectedTenant('all');
    setSearchText('');
    setSearch('');
    setEmployeeId(undefined);
    setEmployeeLookupText('');
    setEmployeeLookup('');
    setSelectedEmployeeOption(undefined);
    setSensorId(undefined);
    setSensorLookupText('');
    setSensorLookup('');
    setSelectedSensorOption(undefined);
    setEventType(undefined);
    setCalculatedStatus(undefined);
    setStatus(undefined);
    setOffset(0);
    setSelectedIds([]);
  };

  const changerTri = (column: NonNullable<typeof sortBy>) => {
    if (sortBy === column) {
      setSortDirection((current) => current === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortDirection(column === 'date_pointage' ? 'DESC' : 'ASC');
    }
    setOffset(0);
    setSelectedIds([]);
  };

  const togglePointage = (id: number, checked: boolean) => {
    setSelectedIds((current) => checked
      ? current.includes(id) ? current : [...current, id]
      : current.filter((selectedId) => selectedId !== id));
  };

  const togglePageSelection = (checked: boolean) => {
    setSelectedIds(checked ? items.slice(0, 100).map((item) => item.id) : []);
  };

  const recalculerSelection = async () => {
    try {
      const result = await bulkRecalculate.mutateAsync(selectedIds);
      setBulkResult(result);
      setSelectedIds([]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const exporter = async (format: 'csv' | 'excel') => {
    try {
      await exportMutation.mutateAsync({
        filters: {
          tenant_id: filters.tenant_id,
          date_debut: period.debut,
          date_fin: period.fin,
          employe_id: employeeId,
          capteur_id: sensorId,
          type_evenement: eventType,
          statut_calcul: calculatedStatus,
          statut: status,
          search: search || undefined,
        },
        format,
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  function typeLabel(type: Pointage['type_evenement']) {
    return t(typeTranslationKeys[type]);
  }
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
          <p className="text-sm text-muted-foreground">
            {t('totalPointages', { count: numberFormat.format(total) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <div className="w-full sm:w-56">
              <FormField label={t('tenant')} htmlFor="pointages-tenant">
                <Select value={selectedTenant} onValueChange={(value) => {
                  setSelectedTenant(value ?? 'all');
                  setEmployeeId(undefined);
                  setSensorId(undefined);
                  setSelectedEmployeeOption(undefined);
                  setSelectedSensorOption(undefined);
                  setEmployeeLookup('');
                  setSensorLookup('');
                  setEmployeeLookupText('');
                  setSensorLookupText('');
                  setOffset(0);
                  setSelectedIds([]);
                }}>
                  <SelectTrigger id="pointages-tenant" aria-label={t('tenant')}>
                    <SelectValue>
                      {selectedTenant === 'all'
                        ? t('tousTenants')
                        : tenantsQuery.data?.find((tenant) => String(tenant.id) === selectedTenant)?.name
                          ?? t('chargementTenants')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('tousTenants')}</SelectItem>
                    {(tenantsQuery.data ?? []).map((tenant) => (
                      <SelectItem key={tenant.id} value={String(tenant.id)}>{tenant.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tenantsQuery.isError && <p role="alert" className="text-sm text-destructive">{t('erreurTenants')}</p>}
              </FormField>
            </div>
          )}
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
      <p className="-mt-4 text-sm text-muted-foreground">{t('stats.scopeNote')}</p>

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
            <FormField label={t('dateDebut')} htmlFor="pointages-date-debut">
              <Input id="pointages-date-debut" type="date" value={period.debut} max={period.fin} onChange={(event) => {
                setPeriod((current) => ({ ...current, debut: event.target.value }));
                setOffset(0);
                setSelectedIds([]);
              }} />
            </FormField>
            <FormField label={t('dateFin')} htmlFor="pointages-date-fin">
              <Input id="pointages-date-fin" type="date" value={period.fin} min={period.debut} onChange={(event) => {
                setPeriod((current) => ({ ...current, fin: event.target.value }));
                setOffset(0);
                setSelectedIds([]);
              }} />
            </FormField>
            <FormField label={t('employe')} htmlFor="pointages-employe">
              <Combobox
                id="pointages-employe"
                ariaLabel={t('employe')}
                options={employeOptions}
                value={employeeId === undefined ? 'all' : String(employeeId)}
                onValueChange={(value) => {
                  setEmployeeId(!value || value === 'all' ? undefined : Number(value));
                  setSelectedEmployeeOption(!value || value === 'all'
                    ? undefined
                    : employeOptions.find((option) => option.value === value));
                  setOffset(0);
                  setSelectedIds([]);
                }}
                onSearch={setEmployeeLookupText}
                placeholder={t('tousEmployes')}
                searchPlaceholder={t('rechercherEmploye')}
                emptyMessage={employesFilterError
                  ? t('erreurEmployesVisibles')
                  : employesFilterLoading ? t('chargementEmployes') : t('aucunEmploye')}
                allowAll
                allLabel={t('tousEmployes')}
              />
            </FormField>
            <FormField label={t('capteur')} htmlFor="pointages-capteur">
              <Combobox
                id="pointages-capteur"
                ariaLabel={t('capteur')}
                options={capteurOptions}
                value={sensorId === undefined ? 'all' : String(sensorId)}
                onValueChange={(value) => {
                  setSensorId(!value || value === 'all' ? undefined : Number(value));
                  setSelectedSensorOption(!value || value === 'all'
                    ? undefined
                    : capteurOptions.find((option) => option.value === value));
                  setOffset(0);
                  setSelectedIds([]);
                }}
                onSearch={setSensorLookupText}
                placeholder={t('tousCapteurs')}
                searchPlaceholder={t('rechercherCapteur')}
                emptyMessage={capteursFilterError
                  ? t('erreurChargementCapteurs')
                  : capteursFilterLoading ? t('chargementCapteurs') : t('aucunCapteur')}
                allowAll
                allLabel={t('tousCapteurs')}
              />
            </FormField>
            <FormField label={t('type')} htmlFor="pointages-type">
              <Select value={eventType ?? 'all'} onValueChange={(value) => {
                setEventType(!value || value === 'all' ? undefined : value as Pointage['type_evenement']);
                setOffset(0);
                setSelectedIds([]);
              }}>
                <SelectTrigger id="pointages-type" aria-label={t('type')}>
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
            <FormField label={t('statutCalcule')} htmlFor="pointages-statut-calcule">
              <Select value={calculatedStatus ?? 'all'} onValueChange={(value) => {
                setCalculatedStatus(!value || value === 'all' ? undefined : value as Pointage['statut_calcul']);
                setOffset(0);
                setSelectedIds([]);
              }}>
                <SelectTrigger id="pointages-statut-calcule" aria-label={t('statutCalcule')}>
                  <SelectValue>{calculatedStatus ? t(`calculatedStatusLabels.${calculatedStatus}`) : t('tousStatuts')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('tousStatuts')}</SelectItem>
                  {(['VALIDE', 'RETARD', 'ANORMAL', 'UNKNOWN'] as const).map((value) => (
                    <SelectItem key={value} value={value}>{t(`calculatedStatusLabels.${value}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t('statut')} htmlFor="pointages-statut">
              <Select value={status ?? 'all'} onValueChange={(value) => {
                setStatus(!value || value === 'all' ? undefined : value as Pointage['statut']);
                setOffset(0);
                setSelectedIds([]);
              }}>
                <SelectTrigger id="pointages-statut" aria-label={t('statut')}>
                  <SelectValue>{status ? t(`statusLabels.${status}`) : t('tousStatuts')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('tousStatuts')}</SelectItem>
                  {(['VALIDE', 'INVALIDE', 'REJETE', 'SUPPRIME'] as const).map((value) => (
                    <SelectItem key={value} value={value}>{t(`statusLabels.${value}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t('recherche')} htmlFor="pointages-recherche">
              <div className="relative">
                <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pointages-recherche"
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={t('recherchePlaceholder')}
                  className="pl-9"
                  maxLength={100}
                />
              </div>
            </FormField>
            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={resetFilters}>{t('reinitialiser')}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <section aria-label={t('title')} className="space-y-3">
        {activeFilterLabels.length > 0 && (
          <div aria-live="polite" className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('filtresActifs', { count: numberFormat.format(activeFilterLabels.length) })}</span>
            {activeFilterLabels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)}
          </div>
        )}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
            <p aria-live="polite" className="text-sm">{t('selectionnes', { count: numberFormat.format(selectedIds.length) })}</p>
            <div className="flex items-center gap-2">
              {selectedIds.length === 100 && <p className="text-sm text-muted-foreground">{t('selectionLimite')}</p>}
              <Button
                type="button"
                onClick={() => void recalculerSelection()}
                disabled={bulkRecalculate.isPending || selectedIds.length > 100}
              >
                {bulkRecalculate.isPending ? t('recalculMasseEnCours') : t('recalculMasse')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelectedIds([])} disabled={bulkRecalculate.isPending}>
                {t('annulerSelection')}
              </Button>
            </div>
          </div>
        )}

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
              <Table className="sticky-actions min-w-[1240px]">
                <TableHeader>
                  <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          aria-label={t('selectionnerPage')}
                          checked={allOnPageSelected}
                          disabled={items.length > 100}
                          onCheckedChange={(checked) => togglePageSelection(checked === true)}
                        />
                      </TableHead>
                      {isSuperAdmin && selectedTenant === 'all' && <TableHead>{t('tenant')}</TableHead>}
                      <TableHead aria-sort={sortBy === 'date_pointage' ? sortDirection === 'ASC' ? 'ascending' : 'descending' : 'none'}><SortButton label={t('dateHeure')} active={sortBy === 'date_pointage'} direction={sortDirection} directionLabel={t(sortDirection === 'ASC' ? 'triCroissant' : 'triDecroissant')} onClick={() => changerTri('date_pointage')} /></TableHead>
                      <TableHead aria-sort={sortBy === 'employe' ? sortDirection === 'ASC' ? 'ascending' : 'descending' : 'none'}><SortButton label={t('employe')} active={sortBy === 'employe'} direction={sortDirection} directionLabel={t(sortDirection === 'ASC' ? 'triCroissant' : 'triDecroissant')} onClick={() => changerTri('employe')} /></TableHead>
                      <TableHead aria-sort={sortBy === 'type_evenement' ? sortDirection === 'ASC' ? 'ascending' : 'descending' : 'none'}><SortButton label={t('type')} active={sortBy === 'type_evenement'} direction={sortDirection} directionLabel={t(sortDirection === 'ASC' ? 'triCroissant' : 'triDecroissant')} onClick={() => changerTri('type_evenement')} /></TableHead>
                      <TableHead aria-sort={sortBy === 'statut_calcul' ? sortDirection === 'ASC' ? 'ascending' : 'descending' : 'none'}><SortButton label={t('statutCalcul')} active={sortBy === 'statut_calcul'} direction={sortDirection} directionLabel={t(sortDirection === 'ASC' ? 'triCroissant' : 'triDecroissant')} onClick={() => changerTri('statut_calcul')} /></TableHead>
                      <TableHead aria-sort={sortBy === 'statut' ? sortDirection === 'ASC' ? 'ascending' : 'descending' : 'none'}><SortButton label={t('statut')} active={sortBy === 'statut'} direction={sortDirection} directionLabel={t(sortDirection === 'ASC' ? 'triCroissant' : 'triDecroissant')} onClick={() => changerTri('statut')} /></TableHead>
                      <TableHead aria-sort={sortBy === 'capteur' ? sortDirection === 'ASC' ? 'ascending' : 'descending' : 'none'}><SortButton label={t('capteur')} active={sortBy === 'capteur'} direction={sortDirection} directionLabel={t(sortDirection === 'ASC' ? 'triCroissant' : 'triDecroissant')} onClick={() => changerTri('capteur')} /></TableHead>
                      <TableHead aria-sort={sortBy === 'source' ? sortDirection === 'ASC' ? 'ascending' : 'descending' : 'none'}><SortButton label={t('source')} active={sortBy === 'source'} direction={sortDirection} directionLabel={t(sortDirection === 'ASC' ? 'triCroissant' : 'triDecroissant')} onClick={() => changerTri('source')} /></TableHead>
                    <TableHead className="w-12 text-right">{tCommon('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((pointage) => {
                    const rowId = String(pointage.id);
                    return (
                      <TableRow key={rowId}>
                        <TableCell>
                          <Checkbox
                            aria-label={t('selectionnerPointage', { id: rowId })}
                            checked={selectedIds.includes(pointage.id)}
                            disabled={!selectedIds.includes(pointage.id) && selectedIds.length >= 100}
                            onCheckedChange={(checked) => togglePointage(pointage.id, checked === true)}
                          />
                        </TableCell>
                        {isSuperAdmin && selectedTenant === 'all' && (
                          <TableCell className="max-w-48 truncate">{pointage.tenant_name || t('tenantInconnu')}</TableCell>
                        )}
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
                        <TableCell><Badge variant="secondary">{t(`statusLabels.${pointage.statut}`)}</Badge></TableCell>
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
              }}
              onOffsetChange={(newOffset) => {
                setOffset(newOffset);
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
      <Dialog open={bulkResult !== null} onOpenChange={(open) => { if (!open) setBulkResult(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('recalculMasseResultat')}</DialogTitle>
            <DialogDescription>{t('recalculMasseDescription')}</DialogDescription>
          </DialogHeader>
          {bulkResult && (
            <div className="space-y-4">
              <p role="status" className="text-sm">
                {t('recalculMasseResume', {
                  total: numberFormat.format(bulkResult.total),
                  calcules: numberFormat.format(bulkResult.calcules),
                  erreurs: numberFormat.format(bulkResult.erreurs.length),
                })}
              </p>
              <div className="max-h-96 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('pointage')}</TableHead>
                      {isSuperAdmin && selectedTenant === 'all' && <TableHead>{t('tenant')}</TableHead>}
                      <TableHead>{t('recalculBefore')}</TableHead>
                      <TableHead>{t('recalculAfter')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkResult.resultats.map((resultat) => (
                      <TableRow key={`${resultat.tenant_id}-${resultat.id}`}>
                        <TableCell>#{resultat.id}</TableCell>
                        {isSuperAdmin && selectedTenant === 'all' && (
                          <TableCell>{tenantsQuery.data?.find((tenant) => tenant.id === resultat.tenant_id)?.name ?? resultat.tenant_id}</TableCell>
                        )}
                        <TableCell>
                          {t(typeTranslationKeys[resultat.pointage_avant.type_evenement])}
                          {' · '}
                          {t(calculationStatusTranslationKeys[resultat.pointage_avant.statut_calcul])}
                        </TableCell>
                        <TableCell>
                          {t(typeTranslationKeys[resultat.pointage_apres.type_evenement])}
                          {' · '}
                          {t(calculationStatusTranslationKeys[resultat.pointage_apres.statut_calcul])}
                        </TableCell>
                      </TableRow>
                    ))}
                    {bulkResult.erreurs.map((erreur) => (
                      <TableRow key={`error-${erreur.id}`}>
                        <TableCell>#{erreur.id}</TableCell>
                        {isSuperAdmin && selectedTenant === 'all' && <TableCell>—</TableCell>}
                        <TableCell colSpan={2} className="text-destructive">{t('recalculMasseErreur')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogDescription>{t('recalculMasseNonModifie')}</DialogDescription>
            </div>
          )}
        </DialogContent>
      </Dialog>
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

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function SortButton({
  label,
  active,
  direction,
  directionLabel,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: 'ASC' | 'DESC';
  directionLabel: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={active ? `${label}, ${directionLabel}` : label}
      aria-pressed={active}
      onClick={onClick}
      className="-ml-3 h-8 gap-1 px-2 font-medium"
    >
      {label}
      {!active
        ? <ArrowDownUp aria-hidden="true" className="size-3 text-muted-foreground" />
        : direction === 'ASC'
          ? <ArrowUp aria-hidden="true" className="size-3 text-primary" />
          : <ArrowDown aria-hidden="true" className="size-3 text-primary" />}
    </Button>
  );
}
