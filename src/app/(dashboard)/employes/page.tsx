'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  Ellipsis,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { ContratsHoraires } from '@/components/employes/contrats-horaires';
import { PresenceHoraireEmploye } from '@/components/employes/presence-horaire';
import { getErrorMessage } from '@/lib/api';
import { api } from '@/lib/api';
import { useCapteurs } from '@/hooks/useCapteurs';
import {
  useCapteursEmploye,
  useAffecterEmployeCapteur,
  useCreateEmploye,
  useDeleteEmploye,
  useDeplacerEmploye,
  useDesactiverEmploye,
  useEmployes,
  useReactiverEmploye,
  useRetirerEmployeCapteur,
  useUpdateEmploye,
  type EmployeCreate,
  type EmployeUpdate,
} from '@/hooks/useEmployes';
import type { Capteur } from '@/types/capteur';
import type { Employe } from '@/types/employe';
import { useAuthStore } from '@/stores/authStore';
import { confirmerAvecSweetAlert } from '@/lib/confirmation';

const EMPTY_CAPTEURS: Capteur[] = [];

interface UniteNode {
  id: number;
  nom: string;
  enfants?: UniteNode[];
}

interface UniteOption {
  id: number;
  label: string;
}

interface EmployeeContextMenu {
  employee: Employe;
  x: number;
  y: number;
}

interface EmployeeForm {
  matricule: string;
  badge_id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  poste: string;
  unite_id: string;
  actif: 'active' | 'inactive';
}

const emptyEmployeeForm: EmployeeForm = {
  matricule: '',
  badge_id: '',
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  poste: '',
  unite_id: '',
  actif: 'active',
};

/** Gestion paginée des employés du tenant connecté. */
export default function EmployesPage() {
  const t = useTranslations('employes');
  const tCommon = useTranslations('common');
  const user = useAuthStore((state) => state.user);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [syncFrom, setSyncFrom] = useState('');
  const [syncTo, setSyncTo] = useState('');
  const [limit, setLimit] = useState(5);
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [contextMenu, setContextMenu] = useState<EmployeeContextMenu | null>(null);
  const [detailsEmployee, setDetailsEmployee] = useState<Employe | null>(null);
  const [editingEmployee, setEditingEmployee] = useState(false);
  const [sensorEmployee, setSensorEmployee] = useState<Employe | null>(null);
  const [sensorToAssign, setSensorToAssign] = useState('');
  const [moveEmployee, setMoveEmployee] = useState<Employe | null>(null);
  const [moveSourceId, setMoveSourceId] = useState('');
  const [moveDestinationId, setMoveDestinationId] = useState('');
  const [statusEmployee, setStatusEmployee] = useState<Employe | null>(null);
  const [statusAction, setStatusAction] = useState<'deactivate' | 'reactivate' | null>(null);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(emptyEmployeeForm);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const filters = {
    search: debouncedSearch || undefined,
    unite_id: unitFilter === 'all' || unitFilter === 'without_unit' ? undefined : Number(unitFilter),
    sans_unite: unitFilter === 'without_unit',
    actif: statusFilter === 'all' ? undefined : statusFilter === 'active',
    created_from: createdFrom || undefined,
    created_to: createdTo || undefined,
    sync_from: syncFrom || undefined,
    sync_to: syncTo || undefined,
    limit,
    offset,
  };
  const { data, error, isLoading, isFetching, refetch } = useEmployes(filters);
  const { data: capteursData } = useCapteurs({ limit: 1000, offset: 0 });
  const { data: unitsData } = useQuery({
    queryKey: ['unites'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: UniteNode[] }>('/api/unites');
      return response.data.data;
    },
  });
  const employeeSensorsQuery = useCapteursEmploye(sensorEmployee?.id ?? 0);
  const moveSensorsQuery = useCapteursEmploye(moveEmployee?.id ?? 0);
  const createMutation = useCreateEmploye();
  const updateEmployeeMutation = useUpdateEmploye();
  const deleteEmployeeMutation = useDeleteEmploye();
  const assignSensorMutation = useAffecterEmployeCapteur();
  const removeSensorMutation = useRetirerEmployeCapteur();
  const deactivateMutation = useDesactiverEmploye();
  const reactivateMutation = useReactiverEmploye();
  const moveMutation = useDeplacerEmploye();

  const employees = data?.items ?? [];
  const total = data?.total ?? 0;
  const units = flattenUnits(unitsData ?? []);
  const capteurs = capteursData?.items ?? [];
  const unitOptions = [
    { value: 'none', label: t('aucuneUnite') },
    ...units.map((unit) => ({ value: String(unit.id), label: unit.label })),
  ];
  const sensorOptions = (sensors: Capteur[]) => sensors.map((sensor) => ({
    value: String(sensor.id),
    label: sensor.nom,
  }));
  const moveSources = moveSensorsQuery.data ?? EMPTY_CAPTEURS;
  const selectedMoveSourceId = moveSourceId || (moveSources[0] ? String(moveSources[0].id) : '');
  const moveDestinations = capteurs.filter((sensor) =>
    !moveSources.some((source) => source.id === sensor.id)
  );
  const moveHasSourceAssignment = moveSources.length > 0;
  const canManageEmployees = Boolean(user?.is_super_admin || user?.role === 'admin' || user?.role === 'rh');
  const assignedSensors = employeeSensorsQuery.data ?? EMPTY_CAPTEURS;
  const availableSensors = capteurs.filter((sensor) => !assignedSensors.some((assigned) => assigned.id === sensor.id));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!contextMenu) return;

    const closeOnOutsideClick = (event: globalThis.MouseEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    const closeOnViewportChange = () => setContextMenu(null);

    document.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', closeOnViewportChange, true);
    window.addEventListener('resize', closeOnViewportChange);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', closeOnViewportChange, true);
      window.removeEventListener('resize', closeOnViewportChange);
    };
  }, [contextMenu]);

  const toggleEmployee = (id: number, checked: boolean) => {
    setSelectedIds((current) =>
      checked
        ? current.includes(id) ? current : [...current, id]
        : current.filter((selectedId) => selectedId !== id)
    );
  };

  const pageSelected = employees.length > 0 && employees.every((employee) => selectedIds.includes(employee.id));

  const openStatusConfirmation = (employee: Employe, action: 'deactivate' | 'reactivate') => {
    setContextMenu(null);
    setStatusEmployee(employee);
    setStatusAction(action);
    setDeactivationReason('');
  };

  const confirmStatusChange = async () => {
    if (!statusEmployee || !statusAction) return;

    try {
      if (statusAction === 'deactivate') {
        await deactivateMutation.mutateAsync({
          id: statusEmployee.id,
          raison: deactivationReason.trim(),
        });
        toast.success(t('desactivationReussie'));
      } else {
        await reactivateMutation.mutateAsync(statusEmployee.id);
        toast.success(t('reactivationReussie'));
      }
      setStatusEmployee(null);
      setStatusAction(null);
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const openMoveDialog = (employee: Employe) => {
    setContextMenu(null);
    setMoveSourceId('');
    setMoveDestinationId('');
    setMoveEmployee(employee);
  };

  const confirmMove = async () => {
    if (!moveEmployee || !moveDestinationId) return;

    try {
      if (moveHasSourceAssignment && selectedMoveSourceId) {
        await moveMutation.mutateAsync({
          id: moveEmployee.id,
          capteur_source_id: Number(selectedMoveSourceId),
          capteur_destination_id: Number(moveDestinationId),
        });
        toast.success(t('deplacementReussi'));
      } else {
        await assignSensorMutation.mutateAsync({
          employeId: moveEmployee.id,
          capteurId: Number(moveDestinationId),
        });
        toast.success(t('capteurAffecte'));
      }
      setMoveEmployee(null);
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const createEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: EmployeCreate = {
      matricule: employeeForm.matricule.trim(),
      badge_id: Number(employeeForm.badge_id),
      nom: employeeForm.nom.trim(),
      prenom: employeeForm.prenom.trim(),
      ...(employeeForm.email.trim() && { email: employeeForm.email.trim() }),
      ...(employeeForm.telephone.trim() && { telephone: employeeForm.telephone.trim() }),
      ...(employeeForm.poste.trim() && { poste: employeeForm.poste.trim() }),
      ...(employeeForm.unite_id && { unite_id: Number(employeeForm.unite_id) }),
    };

    try {
      await createMutation.mutateAsync(payload);
      toast.success(t('creationReussie'));
      setCreateOpen(false);
      setEmployeeForm(emptyEmployeeForm);
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const beginEditEmployee = (employee: Employe) => {
    setEmployeeForm({
      matricule: employee.matricule,
      badge_id: String(employee.badge_id),
      nom: employee.nom,
      prenom: employee.prenom,
      email: employee.email ?? '',
      telephone: employee.telephone ?? '',
      poste: employee.poste ?? '',
      unite_id: employee.unite_id ? String(employee.unite_id) : '',
      actif: isEmployeeActive(employee.actif) ? 'active' : 'inactive',
    });
    setEditingEmployee(true);
  };

  const updateEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detailsEmployee) return;
    const payload: EmployeUpdate = {
      matricule: employeeForm.matricule.trim(),
      badge_id: Number(employeeForm.badge_id),
      nom: employeeForm.nom.trim(),
      prenom: employeeForm.prenom.trim(),
      email: employeeForm.email.trim() || null,
      telephone: employeeForm.telephone.trim() || null,
      poste: employeeForm.poste.trim() || null,
      unite_id: employeeForm.unite_id ? Number(employeeForm.unite_id) : null,
      actif: employeeForm.actif === 'active' ? 1 : 0,
    };

    try {
      const updated = await updateEmployeeMutation.mutateAsync({ id: detailsEmployee.id, data: payload });
      setDetailsEmployee(updated);
      setEditingEmployee(false);
      toast.success(t('employeModifie'));
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError) || t('modifierEmployeErreur'));
    }
  };

  const assignSensor = async () => {
    if (!sensorEmployee || !sensorToAssign) return;
    try {
      await assignSensorMutation.mutateAsync({
        employeId: sensorEmployee.id,
        capteurId: Number(sensorToAssign),
      });
      setSensorToAssign('');
      toast.success(t('capteurAffecte'));
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const removeSensor = async (capteurId: number) => {
    if (!sensorEmployee || !await confirmerAvecSweetAlert(t('confirmerRetirerCapteur'), {
      title: tCommon('confirm'),
      confirmButtonText: tCommon('yes'),
      cancelButtonText: tCommon('no'),
      destructive: true,
    })) return;
    try {
      await removeSensorMutation.mutateAsync({ employeId: sensorEmployee.id, capteurId });
      toast.success(t('capteurRetire'));
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const deleteEmployee = async () => {
    if (!detailsEmployee || !await confirmerAvecSweetAlert(t('confirmerSuppressionEmploye'), {
      title: tCommon('confirm'),
      confirmButtonText: tCommon('yes'),
      cancelButtonText: tCommon('no'),
      destructive: true,
    })) return;
    try {
      await deleteEmployeeMutation.mutateAsync(detailsEmployee.id);
      setDetailsEmployee(null);
      setEditingEmployee(false);
      toast.success(t('employeSupprime'));
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const deleteEmployeeFromMenu = async (employee: Employe) => {
    if (!await confirmerAvecSweetAlert(t('confirmerSuppressionEmploye'), {
      title: tCommon('confirm'),
      confirmButtonText: tCommon('yes'),
      cancelButtonText: tCommon('no'),
      destructive: true,
    })) return;
    try {
      await deleteEmployeeMutation.mutateAsync(employee.id);
      if (detailsEmployee?.id === employee.id) {
        setDetailsEmployee(null);
        setEditingEmployee(false);
      }
      setContextMenu(null);
      toast.success(t('employeSupprime'));
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const exportEmployees = async (format: 'excel' | 'pdf') => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (unitFilter !== 'all') params.set('unite_id', unitFilter);
      if (statusFilter !== 'all') params.set('actif', statusFilter === 'active' ? '1' : '0');
      if (createdFrom) params.set('created_from', createdFrom);
      if (createdTo) params.set('created_to', createdTo);
      if (syncFrom) params.set('sync_from', syncFrom);
      if (syncTo) params.set('sync_to', syncTo);
      const response = await api.get<Blob>(`/api/employes/export/${format}?${params.toString()}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `employes.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      toast.error(getErrorMessage(exportError));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex justify-between gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Card>
          <CardContent className="space-y-3 p-4">
            {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex items-center gap-3 p-5 text-destructive">
          <AlertCircle aria-hidden="true" className="size-5 shrink-0" />
          <p>{getErrorMessage(error) || t('erreurChargement')}</p>
          <Button type="button" variant="outline" className="ml-auto" onClick={() => void refetch()}>
            {tCommon('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('totalEmployes', { count: total })}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button type="button" className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {t('ajouter')}
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <div className="relative col-span-2 min-w-0 sm:col-span-2 2xl:col-span-2">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setOffset(0);
              setSelectedIds([]);
            }}
            placeholder={t('rechercher')}
            aria-label={t('rechercher')}
            className="h-8 pl-9 text-sm"
          />
        </div>
        <Combobox
          options={[
            ...units.map((unit) => ({ value: String(unit.id), label: unit.label })),
            { value: 'without_unit', label: t('sansUnite') },
          ]}
          value={unitFilter}
          onValueChange={(value) => {
            setUnitFilter(value);
            setOffset(0);
            setSelectedIds([]);
          }}
          placeholder={t('toutesUnites')}
          searchPlaceholder={t('rechercherUnite')}
          emptyMessage={t('aucuneUniteTrouvee')}
          ariaLabel={t('unite')}
          allowAll
          allLabel={t('toutesUnites')}
          className="h-8 min-w-0 text-sm"
        />
        <Select value={statusFilter} onValueChange={(value) => {
          if (value === 'all' || value === 'active' || value === 'inactive') {
            setStatusFilter(value);
            setOffset(0);
            setSelectedIds([]);
          }
        }}>
          <SelectTrigger aria-label={t('statut')} className="h-8 w-full min-w-0 text-sm">
            <SelectValue>{statusFilter === 'all' ? t('tous') : statusFilter === 'active' ? t('actifs') : t('inactifs')}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('tous')}</SelectItem>
            <SelectItem value="active">{t('actifs')}</SelectItem>
            <SelectItem value="inactive">{t('inactifs')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="min-w-0 space-y-1">
          <Label className="truncate text-[11px] text-muted-foreground">{t('dateCreationDepuis')}</Label>
          <Input type="date" value={createdFrom} onChange={(event) => { setCreatedFrom(event.target.value); setOffset(0); setSelectedIds([]); }} className="h-8 min-w-0 px-2 text-xs" />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="truncate text-[11px] text-muted-foreground">{t('dateCreationJusqua')}</Label>
          <Input type="date" value={createdTo} onChange={(event) => { setCreatedTo(event.target.value); setOffset(0); setSelectedIds([]); }} className="h-8 min-w-0 px-2 text-xs" />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="truncate text-[11px] text-muted-foreground">{t('dateSyncDepuis')}</Label>
          <Input type="date" value={syncFrom} onChange={(event) => { setSyncFrom(event.target.value); setOffset(0); setSelectedIds([]); }} className="h-8 min-w-0 px-2 text-xs" />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="truncate text-[11px] text-muted-foreground">{t('dateSyncJusqua')}</Label>
          <Input type="date" value={syncTo} onChange={(event) => { setSyncTo(event.target.value); setOffset(0); setSelectedIds([]); }} className="h-8 min-w-0 px-2 text-xs" />
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selectedIds.length} {t('selectionnes')}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>{tCommon('cancel')}</Button>
        </div>
      )}

      {employees.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-48 items-center justify-center p-6 text-center text-muted-foreground">
            {t('aucunResultat')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <DataTablePagination
                total={total}
                limit={limit}
                offset={offset}
                limitOptions={[5, 10, 25, 50, 100]}
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
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button type="button" variant="outline" size="icon" className="self-end lg:self-auto" aria-label={t('optionsExport')} title={t('optionsExport')}>
                  <Ellipsis aria-hidden="true" />
                </Button>
              } />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void exportEmployees('excel')}>
                  <FileSpreadsheet aria-hidden="true" />
                  {t('exporterExcel')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportEmployees('pdf')}>
                  <FileText aria-hidden="true" />
                  {t('exporterPdf')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="overflow-x-auto rounded-md border bg-card">
            <Table className="sticky-actions min-w-[42rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label={t('selectionnerTout')}
                    checked={pageSelected}
                    onCheckedChange={(checked) => {
                      setSelectedIds((current) => {
                        const pageIds = employees.map((employee) => employee.id);
                        return checked === true
                          ? Array.from(new Set([...current, ...pageIds]))
                          : current.filter((id) => !pageIds.includes(id));
                      });
                    }}
                  />
                </TableHead>
                <TableHead>{t('matricule')}</TableHead>
                <TableHead>{t('nom')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('prenom')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('unite')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('poste')}</TableHead>
                <TableHead>{t('statut')}</TableHead>
                <TableHead className="w-12 text-right">{tCommon('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow
                  key={employee.id}
                  data-state={selectedIds.includes(employee.id) ? 'selected' : undefined}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setSelectedIds((current) => current.includes(employee.id) ? current : [employee.id]);
                    setContextMenu({
                      employee,
                      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 240)),
                      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 320)),
                    });
                  }}
                >
                  <TableCell>
                    <Checkbox
                      aria-label={`${t('selectionner')}: ${employee.matricule}`}
                      checked={selectedIds.includes(employee.id)}
                      onCheckedChange={(checked) => toggleEmployee(employee.id, checked === true)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs sm:text-sm">{employee.matricule}</TableCell>
                  <TableCell className="max-w-40 truncate font-medium">{employee.nom}</TableCell>
                  <TableCell className="hidden max-w-40 truncate sm:table-cell">{employee.prenom}</TableCell>
                  <TableCell className="hidden max-w-44 truncate lg:table-cell">
                    {employee.unite_nom || (employee.unite_id ? `#${employee.unite_id}` : '—')}
                  </TableCell>
                  <TableCell className="hidden max-w-40 truncate md:table-cell">{employee.poste || '—'}</TableCell>
                  <TableCell>
                    <EmployeeStatus active={isEmployeeActive(employee.actif)} t={t} />
                  </TableCell>
                  <TableCell className="text-right">
                    <EmployeeActionsMenu
                      employee={employee}
                      active={isEmployeeActive(employee.actif)}
                      onDetails={() => setDetailsEmployee(employee)}
                      onSensors={() => { setSensorToAssign(''); setSensorEmployee(employee); }}
                      onMove={() => openMoveDialog(employee)}
                      onEdit={() => { setDetailsEmployee(employee); beginEditEmployee(employee); }}
                      onDelete={() => void deleteEmployeeFromMenu(employee)}
                      onStatus={() => openStatusConfirmation(employee, isEmployeeActive(employee.actif) ? 'deactivate' : 'reactivate')}
                      actionsLabel={tCommon('actions')}
                      canManage={canManageEmployees}
                      t={t}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </div>
          <DataTablePagination
            total={total}
            limit={limit}
            offset={offset}
            limitOptions={[5, 10, 25, 50, 100]}
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
      {isFetching && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[80] min-w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label={`${tCommon('actions')}: ${contextMenu.employee.matricule}`}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <ContextAction label={t('voirDetails')} onSelect={() => { setDetailsEmployee(contextMenu.employee); setContextMenu(null); }} />
          <ContextAction label={t('voirCapteurs')} onSelect={() => { setSensorToAssign(''); setSensorEmployee(contextMenu.employee); setContextMenu(null); }} />
          {canManageEmployees && (
            <>
              <ContextAction label={t('modificationEmploye')} onSelect={() => { setDetailsEmployee(contextMenu.employee); beginEditEmployee(contextMenu.employee); setContextMenu(null); }} />
              <ContextAction label={t('deplacerVersCapteur')} onSelect={() => openMoveDialog(contextMenu.employee)} />
              <ContextAction
                label={isEmployeeActive(contextMenu.employee.actif) ? t('desactiver') : t('reactiver')}
                onSelect={() => openStatusConfirmation(contextMenu.employee, isEmployeeActive(contextMenu.employee.actif) ? 'deactivate' : 'reactivate')}
              />
              <ContextAction label={t('supprimerEmploye')} onSelect={() => void deleteEmployeeFromMenu(contextMenu.employee)} />
            </>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('ajouter')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={createEmployee} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t('matricule')}>
                <Input required value={employeeForm.matricule} onChange={(event) => setEmployeeForm({ ...employeeForm, matricule: event.target.value })} />
              </FormField>
              <FormField label="Badge ID">
                <Input required type="number" min={1} value={employeeForm.badge_id} onChange={(event) => setEmployeeForm({ ...employeeForm, badge_id: event.target.value })} />
              </FormField>
              <FormField label={t('nom')}>
                <Input required value={employeeForm.nom} onChange={(event) => setEmployeeForm({ ...employeeForm, nom: event.target.value })} />
              </FormField>
              <FormField label={t('prenom')}>
                <Input required value={employeeForm.prenom} onChange={(event) => setEmployeeForm({ ...employeeForm, prenom: event.target.value })} />
              </FormField>
              <FormField label={t('email')}>
                <Input type="email" value={employeeForm.email} onChange={(event) => setEmployeeForm({ ...employeeForm, email: event.target.value })} />
              </FormField>
              <FormField label={t('telephone')}>
                <Input value={employeeForm.telephone} onChange={(event) => setEmployeeForm({ ...employeeForm, telephone: event.target.value })} />
              </FormField>
              <FormField label={t('poste')}>
                <Input value={employeeForm.poste} onChange={(event) => setEmployeeForm({ ...employeeForm, poste: event.target.value })} />
              </FormField>
              {units.length > 0 && (
                <FormField label={t('unite')}>
                  <Combobox
                    options={unitOptions}
                    value={employeeForm.unite_id || 'none'}
                    onValueChange={(value) => setEmployeeForm({ ...employeeForm, unite_id: value === 'none' ? '' : value })}
                    placeholder={t('aucuneUnite')}
                    searchPlaceholder={t('rechercherUnite')}
                    emptyMessage={t('aucuneUniteTrouvee')}
                  />
                </FormField>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>{tCommon('cancel')}</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsEmployee !== null} onOpenChange={(open) => {
        if (!open) {
          setDetailsEmployee(null);
          setEditingEmployee(false);
        }
      }}>
        <DialogContent className="w-[calc(100vw-1rem)] max-h-[90dvh] max-w-5xl overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t('voirDetails')}</DialogTitle>
            <DialogDescription>{detailsEmployee?.matricule}</DialogDescription>
          </DialogHeader>
          {detailsEmployee && (
            <Tabs key={detailsEmployee.id} defaultValue="details" className="min-w-0">
              <TabsList className="grid h-auto w-full grid-cols-3">
                <TabsTrigger value="details">{t('voirDetails')}</TabsTrigger>
                <TabsTrigger value="contrats">{t('contrats.titre')}</TabsTrigger>
                <TabsTrigger value="presence">{t('presence.onglet')}</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="pt-4">
                {editingEmployee ? (
                  <form onSubmit={(event) => void updateEmployee(event)} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField label={t('matricule')}><Input required value={employeeForm.matricule} onChange={(event) => setEmployeeForm({ ...employeeForm, matricule: event.target.value })} /></FormField>
                      <FormField label="Badge ID"><Input required type="number" min={1} value={employeeForm.badge_id} onChange={(event) => setEmployeeForm({ ...employeeForm, badge_id: event.target.value })} /></FormField>
                      <FormField label={t('nom')}><Input required value={employeeForm.nom} onChange={(event) => setEmployeeForm({ ...employeeForm, nom: event.target.value })} /></FormField>
                      <FormField label={t('prenom')}><Input required value={employeeForm.prenom} onChange={(event) => setEmployeeForm({ ...employeeForm, prenom: event.target.value })} /></FormField>
                      <FormField label={t('email')}><Input type="email" value={employeeForm.email} onChange={(event) => setEmployeeForm({ ...employeeForm, email: event.target.value })} /></FormField>
                      <FormField label={t('telephone')}><Input type="tel" value={employeeForm.telephone} onChange={(event) => setEmployeeForm({ ...employeeForm, telephone: event.target.value })} /></FormField>
                      <FormField label={t('poste')}><Input value={employeeForm.poste} onChange={(event) => setEmployeeForm({ ...employeeForm, poste: event.target.value })} /></FormField>
                      <FormField label={t('statut')}>
                        <Select
                          value={employeeForm.actif}
                          onValueChange={(value) => {
                            if (value === 'active' || value === 'inactive') {
                              setEmployeeForm({ ...employeeForm, actif: value });
                            }
                          }}
                        >
                          <SelectTrigger aria-label={t('statut')} className="w-full">
                            <SelectValue>{employeeForm.actif === 'active' ? t('actif') : t('inactif')}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">{t('actif')}</SelectItem>
                            <SelectItem value="inactive">{t('inactif')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormField>
                      <FormField label={t('unite')}>
                        <Combobox
                          options={unitOptions}
                          value={employeeForm.unite_id || 'none'}
                          onValueChange={(value) => setEmployeeForm({ ...employeeForm, unite_id: value === 'none' ? '' : value })}
                          placeholder={t('aucuneUnite')}
                          searchPlaceholder={t('rechercherUnite')}
                          emptyMessage={t('aucuneUniteTrouvee')}
                        />
                      </FormField>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setEditingEmployee(false)}>{tCommon('cancel')}</Button>
                      <Button type="submit" disabled={updateEmployeeMutation.isPending}>
                        {updateEmployeeMutation.isPending ? tCommon('loading') : tCommon('save')}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
                      <Detail label={t('matricule')} value={detailsEmployee.matricule} />
                      <Detail label="Badge ID" value={String(detailsEmployee.badge_id)} />
                      <Detail label={t('nom')} value={detailsEmployee.nom} />
                      <Detail label={t('prenom')} value={detailsEmployee.prenom} />
                      <Detail label={t('email')} value={detailsEmployee.email} />
                      <Detail label={t('telephone')} value={detailsEmployee.telephone} />
                      <Detail label={t('unite')} value={detailsEmployee.unite_nom || detailsEmployee.unite_id?.toString()} />
                      <Detail label={t('poste')} value={detailsEmployee.poste} />
                      <Detail label={t('statut')} value={isEmployeeActive(detailsEmployee.actif) ? t('actif') : t('inactif')} />
                    </dl>
                    {canManageEmployees && (
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => beginEditEmployee(detailsEmployee)}>
                          <Pencil aria-hidden="true" className="size-4" />
                          {t('modificationEmploye')}
                        </Button>
                        <Button type="button" variant="destructive" size="sm" disabled={deleteEmployeeMutation.isPending} onClick={() => void deleteEmployee()}>
                          <Trash2 aria-hidden="true" className="size-4" />
                          {t('supprimerEmploye')}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
              <TabsContent value="contrats" className="pt-4">
                <ContratsHoraires
                  key={detailsEmployee.id}
                  employeId={detailsEmployee.id}
                  peutGerer={canManageEmployees}
                  lectureSeule={user?.role === 'superviseur'}
                />
              </TabsContent>
              <TabsContent value="presence">
                <PresenceHoraireEmploye employeId={detailsEmployee.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={sensorEmployee !== null} onOpenChange={(open) => {
        if (!open) {
          setSensorEmployee(null);
          setSensorToAssign('');
        }
      }}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('voirCapteurs')}</DialogTitle>
            <DialogDescription>{sensorEmployee?.nom} {sensorEmployee?.prenom}</DialogDescription>
          </DialogHeader>
          {employeeSensorsQuery.isLoading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : employeeSensorsQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">{getErrorMessage(employeeSensorsQuery.error)}</p>
          ) : employeeSensorsQuery.data?.length ? (
            <ul className="divide-y rounded-md border">
              {employeeSensorsQuery.data.map((sensor) => (
                <li key={sensor.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span className="font-medium">{sensor.nom}</span>
                  <span className="font-mono text-muted-foreground">{sensor.adresse_ip}:{sensor.port}</span>
                  {canManageEmployees && (
                    <Button type="button" size="icon" variant="ghost" aria-label={t('retirerCapteur')} title={t('retirerCapteur')} disabled={removeSensorMutation.isPending} onClick={() => void removeSensor(sensor.id)}>
                      <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('aucunCapteurAffecte')}</p>
          )}
          {canManageEmployees && sensorEmployee && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Combobox
                options={sensorOptions(availableSensors)}
                value={sensorToAssign || undefined}
                onValueChange={setSensorToAssign}
                placeholder={t('aucunCapteurDisponible')}
                searchPlaceholder={t('rechercherCapteur')}
                emptyMessage={t('aucunCapteurTrouve')}
                className="w-full"
              />
              <Button type="button" disabled={!sensorToAssign || assignSensorMutation.isPending} onClick={() => void assignSensor()}>
                {t('affecterCapteur')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={moveEmployee !== null} onOpenChange={(open) => !open && setMoveEmployee(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('deplacerVersCapteur')}</DialogTitle>
            <DialogDescription>{moveEmployee?.nom} {moveEmployee?.prenom}</DialogDescription>
          </DialogHeader>
          {moveEmployee && (
            <div className="space-y-4">
              {moveSensorsQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : moveSensorsQuery.isError ? (
                <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
                  <span>{getErrorMessage(moveSensorsQuery.error)}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void moveSensorsQuery.refetch()}>
                    {tCommon('retry')}
                  </Button>
                </div>
              ) : moveHasSourceAssignment ? (
                <FormField label={t('capteurSource')}>
                  <Combobox
                    options={sensorOptions(moveSources)}
                    value={selectedMoveSourceId || undefined}
                    onValueChange={(value) => { setMoveSourceId(value); setMoveDestinationId(''); }}
                    placeholder={t('capteurSource')}
                    searchPlaceholder={t('rechercherCapteur')}
                    emptyMessage={t('aucunCapteurTrouve')}
                    className="w-full"
                  />
                </FormField>
              ) : (
                <p className="text-sm text-muted-foreground">{t('aucunCapteurAffecte')}</p>
              )}
              <FormField label={t('capteurDestination')}>
                <Combobox
                  options={sensorOptions(moveDestinations)}
                  value={moveDestinationId || undefined}
                  onValueChange={setMoveDestinationId}
                  placeholder={t('capteurDestination')}
                  searchPlaceholder={t('rechercherCapteur')}
                  emptyMessage={t('aucunCapteurTrouve')}
                  className="w-full"
                />
              </FormField>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setMoveEmployee(null)}>{tCommon('cancel')}</Button>
                <Button type="button" disabled={!moveDestinationId || moveSensorsQuery.isLoading || moveSensorsQuery.isError || moveMutation.isPending || assignSensorMutation.isPending} onClick={() => void confirmMove()}>
                  {moveMutation.isPending || assignSensorMutation.isPending ? tCommon('loading') : moveHasSourceAssignment ? t('deplacer') : t('affecterCapteur')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={statusEmployee !== null} onOpenChange={(open) => !open && setStatusEmployee(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{statusAction === 'deactivate' ? t('confirmerDesactivation') : t('confirmerReactivation')}</DialogTitle>
            <DialogDescription>{statusEmployee?.nom} {statusEmployee?.prenom}</DialogDescription>
          </DialogHeader>
          {statusAction === 'deactivate' && (
            <FormField label={t('raisonDesactivation')}>
              <textarea
                value={deactivationReason}
                onChange={(event) => setDeactivationReason(event.target.value)}
                rows={3}
                required
                className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </FormField>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusEmployee(null)}>{tCommon('cancel')}</Button>
            <Button
              type="button"
              variant={statusAction === 'deactivate' ? 'destructive' : 'default'}
              disabled={
                (statusAction === 'deactivate' && deactivationReason.trim() === '') ||
                deactivateMutation.isPending || reactivateMutation.isPending
              }
              onClick={() => void confirmStatusChange()}
            >
              {(deactivateMutation.isPending || reactivateMutation.isPending) && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {statusAction === 'deactivate' ? t('desactiver') : t('reactiver')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeStatus({ active, t }: { active: boolean; t: ReturnType<typeof useTranslations<'employes'>> }) {
  return (
    <Badge variant="outline" className={active ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300' : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300'}>
      {active ? t('actif') : t('inactif')}
    </Badge>
  );
}

function EmployeeActionsMenu({
  employee,
  active,
  onDetails,
  onSensors,
  onMove,
  onEdit,
  onDelete,
  onStatus,
  actionsLabel,
  canManage,
  t,
}: {
  employee: Employe;
  active: boolean;
  onDetails: () => void;
  onSensors: () => void;
  onMove: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: () => void;
  actionsLabel: string;
  canManage: boolean;
  t: ReturnType<typeof useTranslations<'employes'>>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button type="button" variant="ghost" size="icon" aria-label={`${actionsLabel}: ${employee.matricule}`} title={actionsLabel}>
          <Ellipsis aria-hidden="true" />
        </Button>
      } />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onDetails}><UserRound aria-hidden="true" />{t('voirDetails')}</DropdownMenuItem>
        <DropdownMenuItem onClick={onSensors}><UserRound aria-hidden="true" />{t('voirCapteurs')}</DropdownMenuItem>
        {canManage && (
          <>
            <DropdownMenuItem onClick={onEdit}><Pencil aria-hidden="true" />{t('modificationEmploye')}</DropdownMenuItem>
            <DropdownMenuItem onClick={onMove}><UserRound aria-hidden="true" />{t('deplacerVersCapteur')}</DropdownMenuItem>
            <DropdownMenuItem variant={active ? 'destructive' : 'default'} onClick={onStatus}>
              <UserRound aria-hidden="true" />{active ? t('desactiver') : t('reactiver')}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 aria-hidden="true" />{t('supprimerEmploye')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ContextAction({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect();
      }}
      className="flex min-h-9 w-full items-center rounded-sm px-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
    >
      {label}
    </button>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value || '—'}</dd>
    </>
  );
}

function flattenUnits(nodes: UniteNode[], depth = 0): UniteOption[] {
  return nodes.flatMap((unit) => [
    { id: unit.id, label: `${'— '.repeat(depth)}${unit.nom}` },
    ...flattenUnits(unit.enfants ?? [], depth + 1),
  ]);
}

function isEmployeeActive(active: Employe['actif']) {
  return active === true || active === 1 || active === '1';
}
