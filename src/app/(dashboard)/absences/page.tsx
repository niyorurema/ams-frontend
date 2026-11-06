'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { addDays, format, startOfMonth, endOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Check, Download, FileUp, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAbsenceDecision,
  useAbsenceCategories,
  useAbsenceForecast,
  useAbsenceErpContract,
  useAbsenceStatusMappings,
  useAbsenceImportCommit,
  useAbsenceImportPreview,
  useDownloadAbsenceImportTemplate,
  useDeleteAbsenceStatusMapping,
  useAbsenceSettings,
  useAbsences,
  useBulkApproveAbsences,
  useCreateImpediment,
  useCreateAbsenceCategory,
  useDeleteAbsenceCategory,
  useSaveAbsenceWorkflow,
  useSaveAbsenceStatusMapping,
  useUpdateAbsenceCategory,
  type Absence,
  type AbsenceCategory,
  type AbsenceImportPreview,
  type AbsenceFilters,
  type AbsenceStatus,
  type AbsenceStatusMapping,
  type AbsenceWorkflow,
  type MappedAbsenceStatus,
  type ImpedimentInput,
} from '@/hooks/useAbsences';
import { useEmployes } from '@/hooks/useEmployes';
import { getErrorMessage } from '@/lib/api';
import { confirmerAvecSweetAlert } from '@/lib/confirmation';
import { useAuthStore } from '@/stores/authStore';

function estJourneeComplete(value: number | boolean): boolean {
  return value === true || Number(value) === 1;
}

export default function AbsencesPage() {
  const t = useTranslations('absences');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const canManage = Boolean(user?.is_super_admin || user?.role === 'admin' || user?.role === 'rh');
  const isManager = ['superviseur', 'chef_service', 'directeur', 'commissaire'].includes(user?.role ?? '');
  const isSupervisor = user?.role === 'superviseur';
  const isOwnAccount = Boolean(user?.employe_id);
  const canChooseEmployee = canManage || isManager;

  const [dateDebut, setDateDebut] = useState(() =>
    searchParams.get('date_debut') ?? format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateFin, setDateFin] = useState(() =>
    searchParams.get('date_fin') ?? format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<AbsenceStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<'AMS' | 'OBR' | ''>('');
  const [matriculeInput, setMatriculeInput] = useState('');
  const [matriculeSearch, setMatriculeSearch] = useState('');
  const [requestNumberInput, setRequestNumberInput] = useState('');
  const [requestNumberSearch, setRequestNumberSearch] = useState('');
  const [limit, setLimit] = useState(5);
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [dateDebutForm, setDateDebutForm] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [dateFinForm, setDateFinForm] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [fullDay, setFullDay] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [category, setCategory] = useState('ADMINISTRATIVE');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<AbsenceImportPreview | null>(null);
  const [acknowledgeSkipped, setAcknowledgeSkipped] = useState(false);
  const [workflowDraft, setWorkflowDraft] = useState<AbsenceWorkflow | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [statusCodeDraft, setStatusCodeDraft] = useState('');
  const [statusLabelDraft, setStatusLabelDraft] = useState('');
  const [statusTargetDraft, setStatusTargetDraft] = useState<MappedAbsenceStatus>('PENDING');
  const [editingStatusMapping, setEditingStatusMapping] = useState(false);
  const [activeTab, setActiveTab] = useState('history');
  const [forecastStart, setForecastStart] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [forecastEnd, setForecastEnd] = useState(() => format(addDays(new Date(), 89), 'yyyy-MM-dd'));

  const filters = useMemo<AbsenceFilters>(() => ({
    date_debut: dateDebut,
    date_fin: dateFin,
    statut: statusFilter,
    source: sourceFilter,
    matricule: matriculeSearch,
    numero_demande: requestNumberSearch,
    limit,
    offset,
  }), [dateDebut, dateFin, statusFilter, sourceFilter, matriculeSearch, requestNumberSearch, limit, offset]);
  const absencesQuery = useAbsences(filters);
  const forecastQuery = useAbsenceForecast(forecastStart, forecastEnd, activeTab === 'forecast');
  const settingsQuery = useAbsenceSettings(canManage);
  const erpContractQuery = useAbsenceErpContract(canManage);
  const statusMappingsQuery = useAbsenceStatusMappings(canManage);
  const categoriesQuery = useAbsenceCategories(true);
  const employeesQuery = useEmployes({ limit: 500, actif: true, enabled: canChooseEmployee });
  const createImpediment = useCreateImpediment();
  const approve = useAbsenceDecision('approve');
  const reject = useAbsenceDecision('reject');
  const cancel = useAbsenceDecision('cancel');
  const saveWorkflow = useSaveAbsenceWorkflow();
  const createCategory = useCreateAbsenceCategory();
  const updateCategory = useUpdateAbsenceCategory();
  const deleteCategory = useDeleteAbsenceCategory();
  const approveBatch = useBulkApproveAbsences();
  const previewImport = useAbsenceImportPreview();
  const commitImport = useAbsenceImportCommit();
  const downloadImportTemplate = useDownloadAbsenceImportTemplate();
  const saveStatusMapping = useSaveAbsenceStatusMapping();
  const deleteStatusMapping = useDeleteAbsenceStatusMapping();

  const settingsWorkflow = settingsQuery.data?.workflow ?? 'RH_ONLY';
  const workflow = canManage ? (workflowDraft ?? settingsWorkflow) : settingsWorkflow;
  const items = absencesQuery.data?.items ?? [];
  const categories = categoriesQuery.data ?? [];
  const activeCategories = categories.filter((item) => item.actif);
  const selectedCategory = category === ''
    ? ''
    : activeCategories.some((item) => item.code === category)
      ? category
      : activeCategories[0]?.code ?? '';
  const categoryOptions = activeCategories.map((item) => ({
    value: item.code,
    label: categoryLabel(item.code),
    keywords: item.nom,
  }));
  const employeeOptions = useMemo(
    () => (employeesQuery.data?.items ?? []).map((employee) => ({
      value: String(employee.id),
      label: `${employee.matricule} — ${employee.prenom} ${employee.nom}`,
      keywords: employee.matricule,
    })),
    [employeesQuery.data?.items],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMatriculeSearch(matriculeInput.trim());
      setRequestNumberSearch(requestNumberInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [matriculeInput, requestNumberInput]);

  const eligiblePageItems = items.filter(canApprove);
  const allEligibleSelected = eligiblePageItems.length > 0
    && eligiblePageItems.every((item) => selectedIds.includes(item.id));

  function categoryLabel(code: string): string {
    const categoryItem = categories.find((item) => item.code === code);
    const defaultNames: Record<string, string> = {
      MEDICAL: 'Empêchement médical',
      FAMILY: 'Empêchement familial',
      ADMINISTRATIVE: 'Obligation administrative',
      OTHER: 'Autre empêchement',
    };
    if (Object.hasOwn(defaultNames, code) && categoryItem?.nom === defaultNames[code]) {
      return t(`categories.${code}`);
    }
    return categoryItem?.nom ?? code;
  }

  function toggleSelected(absenceId: number) {
    setSelectedIds((current) => current.includes(absenceId)
      ? current.filter((id) => id !== absenceId)
      : [...current, absenceId]);
  }

  function updateOffset(value: number) {
    setOffset(value);
    setSelectedIds([]);
  }

  function updateLimit(value: number) {
    setLimit(value);
    setOffset(0);
    setSelectedIds([]);
  }

  function toggleAllEligible() {
    setSelectedIds((current) => allEligibleSelected
      ? current.filter((id) => !eligiblePageItems.some((item) => item.id === id))
      : [...new Set([...current, ...eligiblePageItems.map((item) => item.id)])]);
  }

  async function approveSelected() {
    if (selectedIds.length === 0) return;
    try {
      const result = await approveBatch.mutateAsync(selectedIds);
      toast.success(t('actions.bulkApproveSuccess', { count: result.validees }));
      setSelectedIds([]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingCategoryId === null) {
        await createCategory.mutateAsync(categoryName);
        toast.success(t('categoryCreated'));
      } else {
        await updateCategory.mutateAsync({ id: editingCategoryId, nom: categoryName });
        toast.success(t('categoryUpdated'));
      }
      setCategoryName('');
      setEditingCategoryId(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function reactivateCategory(categoryItem: AbsenceCategory) {
    try {
      await updateCategory.mutateAsync({ id: categoryItem.id, actif: true });
      toast.success(t('categoryReactivated'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function removeCategory(categoryItem: AbsenceCategory) {
    if (!await confirmerAvecSweetAlert(t('confirmDeleteCategory', { name: categoryItem.nom }), {
      title: tc('confirm'),
      confirmButtonText: tc('yes'),
      cancelButtonText: tc('no'),
      destructive: true,
    })) return;
    try {
      const result = await deleteCategory.mutateAsync(categoryItem.id);
      toast.success(result.deleted
        ? t('categoryDeleted')
        : result.used ? t('categoryDeactivated') : t('categorySystemDeactivated'));
      if (editingCategoryId === categoryItem.id) {
        setEditingCategoryId(null);
        setCategoryName('');
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function submitImpediment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data: ImpedimentInput = {
      date_debut: dateDebutForm,
      date_fin: dateFinForm,
      journee_complete: fullDay,
      categorie: selectedCategory,
      motif: reason.trim() || undefined,
    };
    if (canChooseEmployee) {
      if (!selectedEmployee) {
        toast.error(t('chooseEmployee'));
        return;
      }
      data.employe_id = Number(selectedEmployee);
    }
    if (!fullDay) {
      data.heure_debut = startTime;
      data.heure_fin = endTime;
    }

    try {
      await createImpediment.mutateAsync(data);
      toast.success(t('submitted'));
      setReason('');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function validerWorkflow() {
    try {
      await saveWorkflow.mutateAsync(workflow);
      toast.success(t('workflowSaved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function downloadTemplate() {
    try {
      await downloadImportTemplate.mutateAsync();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function saveStatusMappingForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await saveStatusMapping.mutateAsync({
        source_code: statusCodeDraft.trim(),
        source_label: statusLabelDraft.trim(),
        absence_status: statusTargetDraft,
      });
      toast.success(t('statusMappingSaved'));
      setStatusCodeDraft('');
      setStatusLabelDraft('');
      setStatusTargetDraft('PENDING');
      setEditingStatusMapping(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function removeStatusMapping(mapping: AbsenceStatusMapping) {
    if (mapping.id === null) return;
    if (!await confirmerAvecSweetAlert(t('confirmDeleteStatusMapping', {
      code: mapping.source_code,
      label: mapping.source_label,
    }), {
      title: tc('confirm'),
      confirmButtonText: tc('yes'),
      cancelButtonText: tc('no'),
      destructive: true,
    })) return;

    try {
      await deleteStatusMapping.mutateAsync(mapping.id);
      toast.success(t('statusMappingDeleted'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function runPreview() {
    if (!file) return;
    try {
      setImportPreview(await previewImport.mutateAsync(file));
      setAcknowledgeSkipped(false);
    } catch (error) {
      setImportPreview(null);
      toast.error(getErrorMessage(error));
    }
  }

  async function runImport() {
    if (!file || !importPreview) return;
    try {
      const result = await commitImport.mutateAsync({
        file,
        ignorerErreurs: acknowledgeSkipped,
      });
      toast.success(t('importSuccess', {
        added: result.ajoute,
        updated: result.mis_a_jour,
        unchanged: result.sans_changement,
        skipped: result.ignorees,
        cancelled: result.annulations_explicites,
      }));
      setFile(null);
      setImportPreview(null);
      setAcknowledgeSkipped(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function decide(absence: Absence, action: 'approve' | 'reject' | 'cancel') {
    let commentaire: string | undefined;
    if (action === 'reject') {
      commentaire = window.prompt(t('rejectReason'))?.trim();
      if (!commentaire) return;
    } else if (action === 'cancel' && !window.confirm(t('confirmCancel'))) {
      return;
    }

    try {
      if (action === 'approve') await approve.mutateAsync({ id: absence.id });
      else if (action === 'reject') await reject.mutateAsync({ id: absence.id, commentaire });
      else await cancel.mutateAsync({ id: absence.id });
      toast.success(t(`actions.${action}Success`));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  function canApprove(absence: Absence): boolean {
    if (workflow === 'SUPERVISOR_ONLY') {
      return isSupervisor && absence.statut === 'PENDING';
    }
    if (canManage) {
      return workflow === 'RH_ONLY'
        ? absence.statut === 'PENDING'
        : absence.statut === 'MANAGER_APPROVED';
    }
    return isManager && workflow === 'MANAGER_THEN_RH' && absence.statut === 'PENDING';
  }

  function canReject(absence: Absence): boolean {
    if (absence.source === 'OBR') return false;
    if (workflow === 'SUPERVISOR_ONLY') {
      return isSupervisor && absence.statut === 'PENDING';
    }
    if (canManage) return ['PENDING', 'MANAGER_APPROVED'].includes(absence.statut);
    return isManager && workflow === 'MANAGER_THEN_RH' && absence.statut === 'PENDING';
  }

  function canCancel(absence: Absence): boolean {
    return absence.source === 'AMS'
      && ['PENDING', 'MANAGER_APPROVED', 'APPROVED'].includes(absence.statut)
      && (canManage || (user?.employe_id != null && Number(user.employe_id) === absence.employe_id));
  }

  if (!isOwnAccount && !canChooseEmployee) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>{t('accountLinkRequired')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="history">{t('historyTab')}</TabsTrigger>
          <TabsTrigger value="forecast">{t('forecastTab')}</TabsTrigger>
          <TabsTrigger value="report">{t('reportTab')}</TabsTrigger>
          {canManage && (
            <>
              <TabsTrigger value="import">{t('importTab')}</TabsTrigger>
              <TabsTrigger value="settings">{t('settingsTab')}</TabsTrigger>
            </>
          )}
        </TabsList>
        <TabsContent value="forecast" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>{t('forecastTitle')}</CardTitle>
              <CardDescription>{t('forecastHelp')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 sm:max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="forecast-start">{t('startDate')}</Label>
                  <Input
                    id="forecast-start"
                    type="date"
                    value={forecastStart}
                    onChange={(event) => setForecastStart(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forecast-end">{t('endDate')}</Label>
                  <Input
                    id="forecast-end"
                    type="date"
                    value={forecastEnd}
                    onChange={(event) => setForecastEnd(event.target.value)}
                  />
                </div>
              </div>
              {forecastQuery.isLoading ? (
                <div className="flex items-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />{t('forecastLoading')}
                </div>
              ) : forecastQuery.isError ? (
                <p className="py-8 text-center text-destructive">
                  {getErrorMessage(forecastQuery.error)}
                </p>
              ) : forecastStart > forecastEnd ? (
                <p className="py-8 text-center text-destructive">{t('forecastInvalidRange')}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t('forecastRange', {
                      start: forecastQuery.data?.date_debut ?? forecastStart,
                      end: forecastQuery.data?.date_fin ?? forecastEnd,
                    })}
                  </p>
                  {(forecastQuery.data?.jours ?? []).every((jour) => jour.absences.length === 0) ? (
                    <p className="rounded-md border py-8 text-center text-muted-foreground">
                      {t('forecastEmpty')}
                    </p>
                  ) : (
                    <div className="overflow-auto rounded-md border">
                      <Table className="min-w-[1100px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('forecastDate')}</TableHead>
                            <TableHead>{t('forecastFullDay')}</TableHead>
                            <TableHead>{t('forecastPartial')}</TableHead>
                            <TableHead>{t('forecastUnits')}</TableHead>
                            <TableHead>{t('forecastEmployees')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(forecastQuery.data?.jours ?? [])
                            .filter((jour) => jour.absences.length > 0)
                            .map((jour) => (
                              <TableRow key={jour.date} className="align-top">
                                <TableCell className="whitespace-nowrap font-medium">{jour.date}</TableCell>
                                <TableCell>
                                  {jour.employes_journee_complete}/{jour.effectif}
                                  <span className="block text-xs text-muted-foreground">
                                    {jour.taux_absence_complete}%
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {jour.absences_partielles}
                                  {jour.heures_partielles > 0 && (
                                    <span className="block text-xs text-muted-foreground">
                                      {t('forecastPartialHours', { hours: jour.heures_partielles })}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <ul className="space-y-1">
                                    {jour.par_unite.map((unit) => (
                                      <li key={unit.unite_id ?? 'sans-unite'}>
                                        {unit.unite}: {unit.employes_journee_complete}/{unit.effectif}
                                        <span className="text-xs text-muted-foreground"> ({unit.taux_absence_complete}%)</span>
                                        {unit.absences_partielles > 0
                                          ? ` · ${t('forecastPartialCount', { count: unit.absences_partielles })}`
                                          : ''}
                                      </li>
                                    ))}
                                  </ul>
                                </TableCell>
                                <TableCell>
                                  <ul className="space-y-1">
                                    {jour.absences.map((absence, index) => (
                                      <li key={`${absence.numero_demande}-${absence.employe_id}-${index}`}>
                                        <span className="font-medium">
                                          {absence.matricule} — {absence.prenom} {absence.nom}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                          {absence.unite || t('noUnit')} · {absence.categorie}
                                          {!absence.journee_complete && absence.heure_debut && absence.heure_fin
                                            ? ` · ${absence.heure_debut.slice(0, 5)}–${absence.heure_fin.slice(0, 5)}`
                                            : ''}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="report" className="mt-0">
      <Card>
        <CardHeader>
          <CardTitle>{t('reportImpediment')}</CardTitle>
          <CardDescription>{t('reportImpedimentHelp')}</CardDescription>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void submitImpediment(event)} className="grid gap-4 md:grid-cols-2">
            {canChooseEmployee && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="absence-employee">{t('employee')}</Label>
                <Combobox
                  id="absence-employee"
                  options={employeeOptions}
                  value={selectedEmployee}
                  onValueChange={setSelectedEmployee}
                  placeholder={t('chooseEmployee')}
                  searchPlaceholder={t('searchEmployees')}
                  emptyMessage={t('noEmployeesFound')}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="absence-start">{t('startDate')}</Label>
              <Input id="absence-start" type="date" value={dateDebutForm} onChange={(event) => setDateDebutForm(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="absence-end">{t('endDate')}</Label>
              <Input id="absence-end" type="date" value={dateFinForm} onChange={(event) => setDateFinForm(event.target.value)} required />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input id="absence-full-day" type="checkbox" checked={fullDay} onChange={(event) => setFullDay(event.target.checked)} />
              <Label htmlFor="absence-full-day">{t('fullDay')}</Label>
            </div>
            {!fullDay && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="absence-time-start">{t('timeStart')}</Label>
                  <Input id="absence-time-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="absence-time-end">{t('timeEnd')}</Label>
                  <Input id="absence-time-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="absence-category">{t('category')}</Label>
              <Combobox
                id="absence-category"
                options={categoryOptions}
                value={selectedCategory}
                onValueChange={setCategory}
                placeholder={t('chooseCategory')}
                searchPlaceholder={t('searchCategories')}
                emptyMessage={t('noCategoriesFound')}
                disabled={categoriesQuery.isLoading || activeCategories.length === 0}
              />
              {categoriesQuery.isError && <p className="text-sm text-destructive">{t('categoriesLoadError')}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="absence-reason">{t('reasonOptional')}</Label>
              <Input id="absence-reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
              <p className="text-xs text-muted-foreground">{t('privacyNote')}</p>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createImpediment.isPending || !selectedCategory || categoriesQuery.isError}>
                {createImpediment.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t('submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
        </TabsContent>

      {canManage && (
        <TabsContent value="settings" className="mt-0 space-y-4">
        <Tabs defaultValue="erp" className="space-y-4">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="erp">{t('settingsTabs.erp')}</TabsTrigger>
            <TabsTrigger value="template">{t('settingsTabs.template')}</TabsTrigger>
            <TabsTrigger value="statuses">{t('settingsTabs.statuses')}</TabsTrigger>
            <TabsTrigger value="categories">{t('settingsTabs.categories')}</TabsTrigger>
            <TabsTrigger value="workflow">{t('settingsTabs.workflow')}</TabsTrigger>
          </TabsList>
          <TabsContent value="erp" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle>{t('apiContractTitle')}</CardTitle>
            <CardDescription>{t('apiContractHelp')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {erpContractQuery.isError ? (
              <p className="text-sm text-destructive">{t('apiContractLoadError')}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t('apiSyncDisabled')}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {erpContractQuery.data?.direct_sync.message ?? t('apiContractLoading')}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('apiField')}</TableHead>
                        <TableHead>{t('apiType')}</TableHead>
                        <TableHead>{t('apiRequired')}</TableHead>
                        <TableHead>{t('apiDescription')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(erpContractQuery.data?.fields ?? []).map((field) => (
                        <TableRow key={field.field}>
                          <TableCell className="font-mono text-xs">{field.field}</TableCell>
                          <TableCell>{field.type}</TableCell>
                          <TableCell>{field.required ? t('apiYes') : t('apiNo')}</TableCell>
                          <TableCell>{field.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="template" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle>{t('manualTemplateTitle')}</CardTitle>
            <CardDescription>{t('manualTemplateHelp')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('manualTemplateDateFormat')}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void downloadTemplate()}
              disabled={downloadImportTemplate.isPending}
            >
              {downloadImportTemplate.isPending
                ? <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                : <Download aria-hidden="true" className="mr-2 size-4" />}
              {t('downloadManualTemplate')}
            </Button>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="statuses" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle>{t('statusMappingsTitle')}</CardTitle>
            <CardDescription>{t('statusMappingsHelp')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={(event) => void saveStatusMappingForm(event)} className="grid gap-3 md:grid-cols-4 md:items-end">
              <div className="space-y-2">
                <Label htmlFor="erp-status-code">{t('statusSourceCode')}</Label>
                <Input
                  id="erp-status-code"
                  value={statusCodeDraft}
                  maxLength={30}
                  disabled={editingStatusMapping}
                  onChange={(event) => setStatusCodeDraft(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="erp-status-label">{t('statusSourceLabel')}</Label>
                <Input
                  id="erp-status-label"
                  value={statusLabelDraft}
                  maxLength={100}
                  disabled={editingStatusMapping}
                  onChange={(event) => setStatusLabelDraft(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="erp-status-target">{t('statusAmsTarget')}</Label>
                <NativeSelect
                  id="erp-status-target"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={statusTargetDraft}
                  onChange={(event) => setStatusTargetDraft(event.target.value as MappedAbsenceStatus)}
                >
                  {(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((status) => (
                    <option key={status} value={status}>{t(`statuses.${status}`)}</option>
                  ))}
                </NativeSelect>
              </div>
              <Button type="submit" disabled={saveStatusMapping.isPending}>
                {saveStatusMapping.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                <Plus aria-hidden="true" className="mr-2 size-4" />
                {editingStatusMapping ? t('updateStatusMapping') : t('saveStatusMapping')}
              </Button>
              {editingStatusMapping && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStatusCodeDraft('');
                    setStatusLabelDraft('');
                    setStatusTargetDraft('PENDING');
                    setEditingStatusMapping(false);
                  }}
                >
                  {t('cancelEditCategory')}
                </Button>
              )}
            </form>

            {statusMappingsQuery.isError ? (
              <p className="text-sm text-destructive">{t('statusMappingsLoadError')}</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('statusSourceCode')}</TableHead>
                      <TableHead>{t('statusSourceLabel')}</TableHead>
                      <TableHead>{t('statusAmsTarget')}</TableHead>
                      <TableHead>{t('statusMappingOrigin')}</TableHead>
                      <TableHead>{t('actionsColumn')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(statusMappingsQuery.data ?? []).map((mapping) => (
                      <TableRow key={`${mapping.source_code}:${mapping.source_label}`}>
                        <TableCell>{mapping.source_code}</TableCell>
                        <TableCell>{mapping.source_label}</TableCell>
                        <TableCell>{t(`statuses.${mapping.absence_status}`)}</TableCell>
                        <TableCell>{mapping.is_default ? t('statusMappingDefault') : t('statusMappingCustom')}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setStatusCodeDraft(mapping.source_code);
                                setStatusLabelDraft(mapping.source_label);
                                setStatusTargetDraft(mapping.absence_status);
                                setEditingStatusMapping(true);
                              }}
                            >
                              <Pencil aria-hidden="true" className="size-4" />
                            </Button>
                            {mapping.id !== null && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void removeStatusMapping(mapping)}
                                disabled={deleteStatusMapping.isPending}
                                aria-label={t('deleteStatusMapping', {
                                  code: mapping.source_code,
                                  label: mapping.source_label,
                                })}
                              >
                                <Trash2 aria-hidden="true" className="size-4" />
                              </Button>
                            )}
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
          </TabsContent>

          <TabsContent value="categories" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle>{t('categoriesTitle')}</CardTitle>
            <CardDescription>{t('categoriesHelp')}</CardDescription>
            <p className="text-sm text-muted-foreground">{t('categoriesSuggested')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={(event) => void saveCategory(event)} className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1 space-y-2">
                <Label htmlFor="absence-category-name">{t('categoryName')}</Label>
                <Input
                  id="absence-category-name"
                  value={categoryName}
                  maxLength={100}
                  onChange={(event) => setCategoryName(event.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={createCategory.isPending || updateCategory.isPending}
              >
                {editingCategoryId === null
                  ? <Plus aria-hidden="true" className="mr-2 size-4" />
                  : <Check aria-hidden="true" className="mr-2 size-4" />}
                {editingCategoryId === null ? t('addCategory') : t('saveCategory')}
              </Button>
              {editingCategoryId !== null && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingCategoryId(null);
                    setCategoryName('');
                  }}
                >
                  {t('cancelEditCategory')}
                </Button>
              )}
            </form>
            {categoriesQuery.isError ? (
              <p className="text-sm text-destructive">{t('categoriesLoadError')}</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {categories.map((categoryItem) => (
                  <li key={categoryItem.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <span className={categoryItem.actif ? '' : 'text-muted-foreground'}>
                      {categoryLabel(categoryItem.code)}
                      {!categoryItem.actif && <span className="ml-2 text-xs">({t('categoryInactive')})</span>}
                    </span>
                    <div className="flex gap-2">
                      {categoryItem.actif ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCategoryId(categoryItem.id);
                              setCategoryName(categoryItem.nom);
                            }}
                            aria-label={t('editCategory', { name: categoryItem.nom })}
                          >
                            <Pencil aria-hidden="true" className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void removeCategory(categoryItem)}
                            disabled={deleteCategory.isPending}
                            aria-label={t('deleteCategory', { name: categoryItem.nom })}
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void reactivateCategory(categoryItem)}
                          disabled={updateCategory.isPending}
                        >
                          {t('categoryReactivate')}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="workflow" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle>{t('workflowTitle')}</CardTitle>
            <CardDescription>{t('workflowHelp')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 space-y-2">
              <Label htmlFor="absence-workflow">{t('workflow')}</Label>
              <NativeSelect
                id="absence-workflow"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={workflow}
                onChange={(event) => setWorkflowDraft(event.target.value as AbsenceWorkflow)}
              >
                <option value="RH_ONLY">{t('workflows.RH_ONLY')}</option>
                <option value="SUPERVISOR_ONLY">{t('workflows.SUPERVISOR_ONLY')}</option>
                <option value="MANAGER_THEN_RH">{t('workflows.MANAGER_THEN_RH')}</option>
              </NativeSelect>
            </div>
            <Button type="button" onClick={() => void validerWorkflow()} disabled={saveWorkflow.isPending}>
              {saveWorkflow.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('saveWorkflow')}
            </Button>
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
        </TabsContent>
      )}

      {canManage && (
        <TabsContent value="import" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle>{t('importTitle')}</CardTitle>
            <CardDescription>{t('importHelp')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 space-y-2">
                <Label htmlFor="erp-file">{t('selectFile')}</Label>
                <Input
                  id="erp-file"
                  type="file"
                  accept=".xls,.xlsx,.csv"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setImportPreview(null);
                    setAcknowledgeSkipped(false);
                  }}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => void runPreview()} disabled={!file || previewImport.isPending}>
                {previewImport.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileUp className="mr-2 size-4" />}
                {t('previewImport')}
              </Button>
              {importPreview && (
                <Button
                  type="button"
                  onClick={() => void runImport()}
                  disabled={commitImport.isPending || (importPreview.import_partiel_requis && !acknowledgeSkipped)}
                >
                  {commitImport.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {t('confirmImport')}
                </Button>
              )}
            </div>
            {importPreview && (
              <div className="space-y-3 rounded-md border p-4 text-sm">
                <p>{t('previewSummary', {
                  total: importPreview.total_lignes,
                  valid: importPreview.lignes_valides,
                  errors: importPreview.lignes_en_erreur,
                })}</p>
                <ul className="list-inside list-disc">
                  {Object.entries(importPreview.statuts_source).map(([label, count]) => (
                    <li key={label}>{label}: {count}</li>
                  ))}
                  <li>{t('futureApprovedDays')}: {importPreview.jours_conge_futurs_confirmes}</li>
                  <li>{t('multiDayPeriods')}: {importPreview.periodes_multi_jours}</li>
                  <li>{t('halfDays')}: {importPreview.demi_journees}</li>
                  <li>{t('explicitCancellations')}: {importPreview.annulations_explicites}</li>
                </ul>
                {importPreview.avertissements.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium text-destructive">{t('invalidRows')}</p>
                    <ul className="max-h-40 list-inside list-disc overflow-auto">
                      {importPreview.avertissements.map((warning) => (
                        <li key={`${warning.ligne}-${warning.raison}`}>{t('rowNumber', { row: warning.ligne })}: {warning.raison}</li>
                      ))}
                    </ul>
                    {importPreview.avertissements_tronques && <p>{t('moreErrors')}</p>}
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={acknowledgeSkipped} onChange={(event) => setAcknowledgeSkipped(event.target.checked)} />
                      <span>{t('acknowledgeSkipped')}</span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>
      )}

      <TabsContent value="history" className="mt-0">
      <Card>
        <CardHeader>
          <CardTitle>{t('historyTitle')}</CardTitle>
          <CardDescription>{t('historyHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="filter-start">{t('startDate')}</Label>
                <Input id="filter-start" type="date" value={dateDebut} onChange={(event) => {
                  setDateDebut(event.target.value);
                  updateOffset(0);
                }} />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="filter-end">{t('endDate')}</Label>
                <Input id="filter-end" type="date" value={dateFin} onChange={(event) => {
                  setDateFin(event.target.value);
                  updateOffset(0);
                }} />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="filter-status">{t('status')}</Label>
                <NativeSelect id="filter-status" className="h-10 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={(event) => {
                  setStatusFilter(event.target.value as AbsenceStatus | '');
                  updateOffset(0);
                }}>
                  <option value="">{t('allStatuses')}</option>
                  {(['PENDING', 'MANAGER_APPROVED', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((value) => (
                    <option key={value} value={value}>{t(`statuses.${value}`)}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="filter-source">{t('source')}</Label>
                <NativeSelect id="filter-source" className="h-10 rounded-md border bg-background px-3 text-sm" value={sourceFilter} onChange={(event) => {
                  setSourceFilter(event.target.value as 'AMS' | 'OBR' | '');
                  updateOffset(0);
                }}>
                  <option value="">{t('allSources')}</option>
                  <option value="AMS">{t('sources.AMS')}</option>
                  <option value="OBR">{t('sources.OBR')}</option>
                </NativeSelect>
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="filter-request-number">{t('requestNumber')}</Label>
                <Input
                  id="filter-request-number"
                  value={requestNumberInput}
                  maxLength={100}
                  placeholder={t('searchRequestNumber')}
                  onChange={(event) => {
                    setRequestNumberInput(event.target.value);
                    updateOffset(0);
                  }}
                />
              </div>
            </div>
            {selectedIds.length > 0 && (
              <Button
                type="button"
                onClick={() => void approveSelected()}
                disabled={approveBatch.isPending}
              >
                {approveBatch.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                <Check aria-hidden="true" className="mr-2 size-4" />
                {t('actions.bulkApprove', { count: selectedIds.length })}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DataTablePagination
              total={absencesQuery.data?.total ?? 0}
              limit={limit}
              offset={offset}
              onLimitChange={updateLimit}
              onOffsetChange={updateOffset}
              limitOptions={[5, 10, 25, 50, 100]}
            />
            {absencesQuery.isFetching && !absencesQuery.isLoading && (
              <span className="text-xs text-muted-foreground">{t('updating')}</span>
            )}
          </div>
          {absencesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t('loading')}</div>
          ) : absencesQuery.isError ? (
            <p className="py-8 text-center text-destructive">{t('loadError')}</p>
          ) : (
            <div className="overflow-auto rounded-md border">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    {eligiblePageItems.length > 0 && (
                      <TableHead>
                        <input
                          type="checkbox"
                          aria-label={t('selectAllEligible')}
                          checked={allEligibleSelected}
                          onChange={toggleAllEligible}
                        />
                      </TableHead>
                    )}
                    <TableHead>
                      <div className="flex min-w-[280px] items-center gap-2">
                        <span className="shrink-0">{t('employee')}</span>
                        <Input
                          className="h-8 min-w-0"
                          aria-label={t('searchEmployeeMatricule')}
                          placeholder={t('searchEmployeeMatricule')}
                          value={matriculeInput}
                          maxLength={100}
                          onChange={(event) => {
                            setMatriculeInput(event.target.value);
                            updateOffset(0);
                          }}
                        />
                      </div>
                    </TableHead>
                    <TableHead>{t('requestNumberColumn')}</TableHead>
                    <TableHead>{t('period')}</TableHead>
                    <TableHead>{t('category')}</TableHead>
                    <TableHead>{t('source')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('sourceStatus')}</TableHead>
                    <TableHead>{t('actionsColumn')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={eligiblePageItems.length > 0 ? 9 : 8}
                        className="py-8 text-center text-muted-foreground"
                      >
                        {t('empty')}
                      </TableCell>
                    </TableRow>
                  ) : items.map((absence) => (
                    <TableRow key={absence.id}>
                      {eligiblePageItems.length > 0 && (
                        <TableCell>
                          {canApprove(absence) && (
                            <input
                              type="checkbox"
                              aria-label={t('selectAbsence', { employee: `${absence.matricule} — ${absence.prenom} ${absence.nom}` })}
                              checked={selectedIds.includes(absence.id)}
                              onChange={() => toggleSelected(absence.id)}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell>{absence.matricule} — {absence.prenom} {absence.nom}</TableCell>
                      <TableCell>{absence.source_request_id || '—'}</TableCell>
                      <TableCell>
                        {absence.date_debut === absence.date_fin
                          ? absence.date_debut
                          : `${absence.date_debut} – ${absence.date_fin}`}
                        <span className="block text-xs text-muted-foreground">
                          {estJourneeComplete(absence.journee_complete)
                            ? t('fullDay')
                            : `${absence.heure_debut?.slice(0, 5)}–${absence.heure_fin?.slice(0, 5)}`}
                        </span>
                      </TableCell>
                      <TableCell>{absence.source === 'AMS' ? categoryLabel(absence.categorie) : absence.categorie}</TableCell>
                      <TableCell>{t(`sources.${absence.source}`)}</TableCell>
                      <TableCell><Badge variant="outline">{t(`statuses.${absence.statut}`)}</Badge></TableCell>
                      <TableCell>{absence.source_status_label ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {canApprove(absence) && (
                            <Button size="sm" variant="outline" onClick={() => void decide(absence, 'approve')} aria-label={t('actions.approve')}>
                              <Check className="size-4" />
                            </Button>
                          )}
                          {canReject(absence) && (
                            <Button size="sm" variant="outline" onClick={() => void decide(absence, 'reject')} aria-label={t('actions.reject')}>
                              <X className="size-4" />
                            </Button>
                          )}
                          {canCancel(absence) && (
                            <Button size="sm" variant="outline" onClick={() => void decide(absence, 'cancel')}>{t('actions.cancel')}</Button>
                          )}
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
      </TabsContent>
      </Tabs>
    </div>
  );
}
