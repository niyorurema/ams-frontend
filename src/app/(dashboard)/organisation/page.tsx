'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { BriefcaseBusiness, Download, GitBranch, Loader2, MapPinned, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  organisationErrorMessage,
  useCreerMandat,
  useCreerUnite,
  useModifierMandat,
  useModifierUnite,
  useOrganisation,
  useSupprimerMandat,
  useSupprimerUnite,
  type Mandat,
  type MandatInput,
  type OrganisationData,
  type UniteInput,
  type UniteOrganisationnelle,
  type UniteType,
} from '@/hooks/useOrganisation';
import { useEmployes } from '@/hooks/useEmployes';
import { useAuthStore } from '@/stores/authStore';
import { confirmerAvecSweetAlert } from '@/lib/confirmation';

const unitTypes: UniteType[] = ['COMMISSARIAT', 'DIRECTION', 'SERVICE', 'EQUIPE'];
const mandateTypes: MandatInput['type_mandat'][] = ['TITULAIRE', 'INTERIM', 'ADJOINT', 'INTERIM_ADJOINT'];
const PAGE_SIZE = 4;
interface OrganisationContextMenu {
  kind: 'unite' | 'mandat';
  ids: number[];
  x: number;
  y: number;
}
const emptyUnit: UniteInput = {
  nom: '',
  code: '',
  type: 'SERVICE',
  parent_id: null,
  adresse: null,
  telephone: null,
  email: null,
  responsable_id: null,
  ordre_affichage: 0,
  actif: true,
};
const emptyMandate: MandatInput = {
  unite_id: 0,
  user_id: 0,
  type_mandat: 'TITULAIRE',
  date_debut: new Date().toISOString().slice(0, 10),
  date_fin: null,
  est_actif: true,
  remarque: null,
};

function active(value: boolean | number | string): boolean {
  return value === true || value === 1 || value === '1';
}

export default function OrganisationPage() {
  const t = useTranslations('organisation');
  const tc = useTranslations('common');
  const user = useAuthStore((state) => state.user);
  const canManage = user?.role === 'admin' || user?.role === 'rh' || user?.is_super_admin;
  const query = useOrganisation(Boolean(canManage));
  const createUnit = useCreerUnite();
  const updateUnit = useModifierUnite();
  const deleteUnit = useSupprimerUnite();
  const createMandate = useCreerMandat();
  const updateMandate = useModifierMandat();
  const deleteMandate = useSupprimerMandat();

  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UniteOrganisationnelle | null>(null);
  const [unitForm, setUnitForm] = useState<UniteInput>(emptyUnit);
  const [mandateDialogOpen, setMandateDialogOpen] = useState(false);
  const [editingMandate, setEditingMandate] = useState<Mandat | null>(null);
  const [mandateForm, setMandateForm] = useState<MandatInput>(emptyMandate);
  const [unitPage, setUnitPage] = useState(0);
  const [mandatePage, setMandatePage] = useState(0);
  const [unitPageSize, setUnitPageSize] = useState(PAGE_SIZE);
  const [mandatePageSize, setMandatePageSize] = useState(PAGE_SIZE);
  const [unitSearch, setUnitSearch] = useState('');
  const [mandateSearch, setMandateSearch] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [selectedMandateIds, setSelectedMandateIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [contextMenu, setContextMenu] = useState<OrganisationContextMenu | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const busy = createUnit.isPending || updateUnit.isPending
    || createMandate.isPending || updateMandate.isPending;

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !contextMenuRef.current?.contains(event.target)) setContextMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    const closeOnViewportChange = () => setContextMenu(null);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', closeOnViewportChange, true);
    window.addEventListener('resize', closeOnViewportChange);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', closeOnViewportChange, true);
      window.removeEventListener('resize', closeOnViewportChange);
    };
  }, [contextMenu, contextMenuRef]);

  const openUnit = (unit?: UniteOrganisationnelle) => {
    setEditingUnit(unit ?? null);
    setUnitForm(unit ? {
      nom: unit.nom,
      code: unit.code,
      type: unit.type,
      parent_id: unit.parent_id,
      adresse: unit.adresse,
      telephone: unit.telephone,
      email: unit.email,
      responsable_id: unit.responsable_id,
      ordre_affichage: unit.ordre_affichage,
      actif: active(unit.actif),
    } : { ...emptyUnit });
    setUnitDialogOpen(true);
  };

  const saveUnit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (editingUnit) {
        await updateUnit.mutateAsync({ id: editingUnit.id, data: unitForm });
        toast.success(t('serviceModifie'));
      } else {
        await createUnit.mutateAsync(unitForm);
        toast.success(t('serviceCree'));
      }
      setUnitDialogOpen(false);
    } catch (error) {
      toast.error(organisationErrorMessage(error));
    }
  };

  const removeUnit = async (unit: UniteOrganisationnelle) => {
    if (!await confirmerAvecSweetAlert(t('confirmerSuppressionService', { name: unit.nom }), {
      title: tc('confirm'),
      confirmButtonText: tc('yes'),
      cancelButtonText: tc('no'),
      destructive: true,
    })) return;
    try {
      await deleteUnit.mutateAsync(unit.id);
      toast.success(t('serviceSupprime'));
    } catch (error) {
      toast.error(organisationErrorMessage(error));
    }
  };

  const openMandate = (mandate?: Mandat) => {
    setEditingMandate(mandate ?? null);
    setMandateForm(mandate ? {
      unite_id: mandate.unite_id,
      user_id: mandate.user_id,
      type_mandat: mandate.type_mandat,
      date_debut: mandate.date_debut,
      date_fin: mandate.date_fin,
      est_actif: active(mandate.est_actif),
      remarque: mandate.remarque,
    } : {
      ...emptyMandate,
      unite_id: query.data?.unites[0]?.id ?? 0,
      user_id: query.data?.utilisateurs[0]?.id ?? 0,
    });
    setMandateDialogOpen(true);
  };

  const saveMandate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (editingMandate) {
        await updateMandate.mutateAsync({ id: editingMandate.id, data: mandateForm });
        toast.success(t('mandatModifie'));
      } else {
        await createMandate.mutateAsync(mandateForm);
        toast.success(t('mandatCree'));
      }
      setMandateDialogOpen(false);
    } catch (error) {
      toast.error(organisationErrorMessage(error));
    }
  };

  const removeMandate = async (mandate: Mandat) => {
    if (!await confirmerAvecSweetAlert(t('confirmerSuppressionMandat'), {
      title: tc('confirm'),
      confirmButtonText: tc('yes'),
      cancelButtonText: tc('no'),
      destructive: true,
    })) return;
    try {
      await deleteMandate.mutateAsync(mandate.id);
      toast.success(t('mandatSupprime'));
    } catch (error) {
      toast.error(organisationErrorMessage(error));
    }
  };

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t('accesInterdit')}
        </CardContent>
      </Card>
    );
  }

  if (query.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-72 w-full" /><Skeleton className="h-72 w-full" /></div>;
  }
  if (query.error || !query.data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-8">
          <p role="alert" className="text-sm text-destructive">{t('erreurChargement')}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>{tc('retry')}</Button>
        </CardContent>
      </Card>
    );
  }

  const { unites, mandats, utilisateurs } = query.data;
  const unitsById = new Map(unites.map((unit) => [unit.id, unit]));
  const choicesForParent = unites.filter((unit) => unit.id !== editingUnit?.id);
  const normalizedUnitSearch = unitSearch.trim().toLocaleLowerCase();
  const normalizedMandateSearch = mandateSearch.trim().toLocaleLowerCase();
  const filteredUnits = unites.filter((unit) => [
    unit.nom,
    unit.code,
    unit.type,
    unit.parent_nom,
    unit.source_systeme,
    active(unit.actif) ? t('actif') : t('inactif'),
  ].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalizedUnitSearch));
  const filteredMandates = mandats.filter((mandate) => [
    mandate.unite_nom,
    mandate.titulaire_nom,
    mandate.employe_nom,
    mandate.employe_prenom,
    mandate.type_mandat,
    mandate.date_debut,
    mandate.date_fin,
    mandate.source_systeme,
    active(mandate.est_actif) ? t('actif') : t('inactif'),
  ].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalizedMandateSearch));
  const unitPageCount = Math.max(1, Math.ceil(filteredUnits.length / unitPageSize));
  const mandatePageCount = Math.max(1, Math.ceil(filteredMandates.length / mandatePageSize));
  const visibleUnitPage = Math.min(unitPage, unitPageCount - 1);
  const visibleMandatePage = Math.min(mandatePage, mandatePageCount - 1);
  const visibleUnits = filteredUnits.slice(visibleUnitPage * unitPageSize, (visibleUnitPage + 1) * unitPageSize);
  const visibleMandates = filteredMandates.slice(visibleMandatePage * mandatePageSize, (visibleMandatePage + 1) * mandatePageSize);
  const allVisibleUnitsSelected = visibleUnits.length > 0
    && visibleUnits.every((unit) => selectedUnitIds.includes(unit.id));
  const allVisibleMandatesSelected = visibleMandates.length > 0
    && visibleMandates.every((mandate) => selectedMandateIds.includes(mandate.id));
  const parentOptions: ComboboxOption[] = [
    { value: 'none', label: t('aucunParent') },
    ...choicesForParent.map((unit) => ({
      value: String(unit.id),
      label: `${unit.code} — ${unit.nom}`,
      keywords: t(`typesUnite.${unit.type}`),
    })),
  ];
  const unitOptions: ComboboxOption[] = unites.map((unit) => ({
    value: String(unit.id),
    label: `${unit.code} — ${unit.nom}`,
    keywords: t(`typesUnite.${unit.type}`),
  }));
  const managersByEmployee = new Map<number, ComboboxOption>();
  for (const account of utilisateurs) {
    if (account.employe_id !== null && !managersByEmployee.has(account.employe_id)) {
      managersByEmployee.set(account.employe_id, {
        value: String(account.employe_id),
        label: account.nom_complet,
        description: account.matricule ?? undefined,
      });
    }
  }
  const managerOptions: ComboboxOption[] = [
    { value: 'none', label: t('aucunResponsable') },
    ...managersByEmployee.values(),
  ];
  const userOptions: ComboboxOption[] = utilisateurs.map((account) => ({
    value: String(account.id),
    label: account.nom_complet,
    description: account.matricule ?? undefined,
    keywords: account.role,
  }));
  const unitTypeOptions: ComboboxOption[] = unitTypes.map((type) => ({
    value: type,
    label: t(`typesUnite.${type}`),
  }));
  const mandateTypeOptions: ComboboxOption[] = mandateTypes.map((type) => ({
    value: type,
    label: t(`typesMandat.${type}`),
  }));
  const statusOptions: ComboboxOption[] = [
    { value: 'active', label: t('actif') },
    { value: 'inactive', label: t('inactif') },
  ];

  const toggleUnit = (id: number, checked: boolean) => {
    setSelectedUnitIds((selected) => checked
      ? [...new Set([...selected, id])]
      : selected.filter((selectedId) => selectedId !== id));
  };
  const toggleMandate = (id: number, checked: boolean) => {
    setSelectedMandateIds((selected) => checked
      ? [...new Set([...selected, id])]
      : selected.filter((selectedId) => selectedId !== id));
  };
  const toggleVisibleUnits = (checked: boolean) => {
    const visibleIds = new Set(visibleUnits.map((unit) => unit.id));
    setSelectedUnitIds((selected) => checked
      ? [...new Set([...selected, ...visibleIds])]
      : selected.filter((id) => !visibleIds.has(id)));
  };
  const toggleVisibleMandates = (checked: boolean) => {
    const visibleIds = new Set(visibleMandates.map((mandate) => mandate.id));
    setSelectedMandateIds((selected) => checked
      ? [...new Set([...selected, ...visibleIds])]
      : selected.filter((id) => !visibleIds.has(id)));
  };

  const showContextMenu = (
    event: MouseEvent<HTMLTableRowElement>,
    kind: OrganisationContextMenu['kind'],
    id: number,
  ) => {
    event.preventDefault();
    const selectedIds = kind === 'unite' ? selectedUnitIds : selectedMandateIds;
    const ids = selectedIds.includes(id) ? selectedIds : [id];
    if (kind === 'unite') setSelectedUnitIds(ids);
    else setSelectedMandateIds(ids);
    setContextMenu({
      kind,
      ids,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 240)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 210)),
    });
  };

  const updateSelectedUnits = async (isActive: boolean, targetIds = selectedUnitIds) => {
    setBulkBusy(true);
    try {
      const ids = [...targetIds];
      const results = await Promise.allSettled(ids.map((id) =>
        updateUnit.mutateAsync({ id, data: { actif: isActive } }),
      ));
      const failedIds = ids.filter((_, index) => results[index].status === 'rejected');
      setSelectedUnitIds(failedIds);
      if (failedIds.length === 0) {
        toast.success(t('selectionModifiee', { count: results.length }));
        return;
      }
      const firstFailure = results.find((result) => result.status === 'rejected');
      toast.error(t('resultatPartiel', {
        succeeded: results.length - failedIds.length,
        failed: failedIds.length,
        detail: firstFailure?.status === 'rejected' ? organisationErrorMessage(firstFailure.reason) : '',
      }));
    } finally {
      setBulkBusy(false);
    }
  };

  const updateSelectedMandates = async (isActive: boolean, targetIds = selectedMandateIds) => {
    setBulkBusy(true);
    try {
      const ids = [...targetIds];
      const results = await Promise.allSettled(ids.map((id) =>
        updateMandate.mutateAsync({ id, data: { est_actif: isActive } }),
      ));
      const failedIds = ids.filter((_, index) => results[index].status === 'rejected');
      setSelectedMandateIds(failedIds);
      if (failedIds.length === 0) {
        toast.success(t('selectionModifiee', { count: results.length }));
        return;
      }
      const firstFailure = results.find((result) => result.status === 'rejected');
      toast.error(t('resultatPartiel', {
        succeeded: results.length - failedIds.length,
        failed: failedIds.length,
        detail: firstFailure?.status === 'rejected' ? organisationErrorMessage(firstFailure.reason) : '',
      }));
    } finally {
      setBulkBusy(false);
    }
  };

  const deleteSelectedUnits = async (targetIds = selectedUnitIds) => {
    if (!await confirmerAvecSweetAlert(t('confirmerSuppressionSelection', { count: targetIds.length }), {
      title: tc('confirm'),
      confirmButtonText: tc('yes'),
      cancelButtonText: tc('no'),
      destructive: true,
    })) return;
    const ids = [...targetIds].sort((left, right) =>
      (unitsById.get(right)?.niveau ?? 0) - (unitsById.get(left)?.niveau ?? 0),
    );
    setBulkBusy(true);
    try {
      const failedIds: number[] = [];
      let successCount = 0;
      let firstError: unknown;
      for (const id of ids) {
        try {
          await deleteUnit.mutateAsync(id);
          successCount++;
        } catch (error) {
          failedIds.push(id);
          firstError ??= error;
        }
      }
      setSelectedUnitIds(failedIds);
      if (failedIds.length === 0) {
        toast.success(t('selectionSupprimee', { count: successCount }));
      } else {
        toast.error(t('resultatPartiel', {
          succeeded: successCount,
          failed: failedIds.length,
          detail: firstError ? organisationErrorMessage(firstError) : '',
        }));
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const deleteSelectedMandates = async (targetIds = selectedMandateIds) => {
    if (!await confirmerAvecSweetAlert(t('confirmerSuppressionSelection', { count: targetIds.length }), {
      title: tc('confirm'),
      confirmButtonText: tc('yes'),
      cancelButtonText: tc('no'),
      destructive: true,
    })) return;
    const ids = [...targetIds];
    setBulkBusy(true);
    try {
      const failedIds: number[] = [];
      let successCount = 0;
      let firstError: unknown;
      for (const id of ids) {
        try {
          await deleteMandate.mutateAsync(id);
          successCount++;
        } catch (error) {
          failedIds.push(id);
          firstError ??= error;
        }
      }
      setSelectedMandateIds(failedIds);
      if (failedIds.length === 0) {
        toast.success(t('selectionSupprimee', { count: successCount }));
      } else {
        toast.error(t('resultatPartiel', {
          succeeded: successCount,
          failed: failedIds.length,
          detail: firstError ? organisationErrorMessage(firstError) : '',
        }));
      }
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={() => openUnit()}><Plus aria-hidden="true" />{t('ajouterService')}</Button>
      </header>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-48">
            <CardTitle>{t('servicesTitle')}</CardTitle>
            <CardDescription>{t('servicesDescription')}</CardDescription>
          </div>
          <div className="relative w-full max-w-md flex-1">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label={t('rechercherServices')} placeholder={t('rechercherServices')} value={unitSearch} onChange={(event) => { setUnitSearch(event.target.value); setUnitPage(0); }} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {selectedUnitIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3">
              <span className="mr-auto text-sm font-medium">{t('selectionCount', { count: selectedUnitIds.length })}</span>
              <Button size="sm" variant="outline" disabled={bulkBusy || updateUnit.isPending} onClick={() => void updateSelectedUnits(true)}>{t('activerSelection')}</Button>
              <Button size="sm" variant="outline" disabled={bulkBusy || updateUnit.isPending} onClick={() => void updateSelectedUnits(false)}>{t('desactiverSelection')}</Button>
              <Button size="sm" variant="destructive" disabled={bulkBusy} onClick={() => void deleteSelectedUnits()}><Trash2 aria-hidden="true" className="size-4" />{t('supprimerSelection')}</Button>
              <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelectedUnitIds([])}>{t('annulerSelection')}</Button>
            </div>
          )}
          {unites.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('aucunService')}</p>
          ) : filteredUnits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('aucunServiceCorrespondant')}</p>
          ) : (
            <div className="space-y-2">
              <PaginationControls page={visibleUnitPage} pageSize={unitPageSize} pageCount={unitPageCount} total={filteredUnits.length} onPageChange={setUnitPage} onPageSizeChange={(size) => { setUnitPageSize(size); setUnitPage(0); }} />
              <div className="max-h-[280px] overflow-auto rounded-md border">
                <Table className="sticky-actions">
                <TableHeader><TableRow>
                  <TableHead className="sticky top-0 z-10 w-10 bg-card">
                    <Checkbox aria-label={t('selectionnerPage')} checked={allVisibleUnitsSelected} disabled={bulkBusy} onCheckedChange={(checked) => toggleVisibleUnits(checked === true)} />
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card">{t('service')}</TableHead><TableHead className="sticky top-0 z-10 bg-card">{t('code')}</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card">{t('type')}</TableHead><TableHead className="sticky top-0 z-10 bg-card">{t('parent')}</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card">{t('statut')}</TableHead><TableHead className="sticky top-0 z-10 bg-card">{t('source')}</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card text-right">{tc('actions')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {visibleUnits.map((unit) => (
                    <TableRow key={unit.id} data-state={selectedUnitIds.includes(unit.id) ? 'selected' : undefined} onContextMenu={(event) => showContextMenu(event, 'unite', unit.id)}>
                      <TableCell><Checkbox aria-label={t('selectionnerService', { name: unit.nom })} checked={selectedUnitIds.includes(unit.id)} disabled={bulkBusy} onCheckedChange={(checked) => toggleUnit(unit.id, checked === true)} /></TableCell>
                      <TableCell className="font-medium">
                        <span style={{ paddingLeft: `${Math.min(unit.niveau - 1, 6) * 16}px` }}>{unit.nom}</span>
                      </TableCell>
                      <TableCell>{unit.code}</TableCell>
                      <TableCell>{t(`typesUnite.${unit.type}`)}</TableCell>
                      <TableCell>{unit.parent_nom || t('aucunParent')}</TableCell>
                      <TableCell><Badge variant={active(unit.actif) ? 'default' : 'secondary'}>{active(unit.actif) ? t('actif') : t('inactif')}</Badge></TableCell>
                      <TableCell>{unit.source_systeme ? `${unit.source_systeme}${active(unit.ams_override) ? ` · ${t('modifieDansAms')}` : ''}` : t('sourceAms')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" aria-label={t('modifierService', { name: unit.nom })} onClick={() => openUnit(unit)} disabled={bulkBusy}><Pencil aria-hidden="true" className="size-4" /></Button>
                          <Button size="icon" variant="ghost" aria-label={t('supprimerService', { name: unit.nom })} onClick={() => void removeUnit(unit)} disabled={deleteUnit.isPending || bulkBusy}><Trash2 aria-hidden="true" className="size-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
              <PaginationControls page={visibleUnitPage} pageSize={unitPageSize} pageCount={unitPageCount} total={filteredUnits.length} onPageChange={setUnitPage} onPageSizeChange={(size) => { setUnitPageSize(size); setUnitPage(0); }} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3">
          <div className="min-w-48"><CardTitle>{t('mandatsTitle')}</CardTitle><CardDescription>{t('mandatsDescription')}</CardDescription></div>
          <div className="relative w-full max-w-md flex-1">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label={t('rechercherMandats')} placeholder={t('rechercherMandats')} value={mandateSearch} onChange={(event) => { setMandateSearch(event.target.value); setMandatePage(0); }} className="pl-9" />
          </div>
          <Button onClick={() => openMandate()} disabled={unites.length === 0 || utilisateurs.length === 0}><Plus aria-hidden="true" />{t('ajouterMandat')}</Button>
        </CardHeader>
        <CardContent>
          {selectedMandateIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3">
              <span className="mr-auto text-sm font-medium">{t('selectionCount', { count: selectedMandateIds.length })}</span>
              <Button size="sm" variant="outline" disabled={bulkBusy || updateMandate.isPending} onClick={() => void updateSelectedMandates(true)}>{t('activerSelection')}</Button>
              <Button size="sm" variant="outline" disabled={bulkBusy || updateMandate.isPending} onClick={() => void updateSelectedMandates(false)}>{t('desactiverSelection')}</Button>
              <Button size="sm" variant="destructive" disabled={bulkBusy} onClick={() => void deleteSelectedMandates()}><Trash2 aria-hidden="true" className="size-4" />{t('supprimerSelection')}</Button>
              <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelectedMandateIds([])}>{t('annulerSelection')}</Button>
            </div>
          )}
          {mandats.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('aucunMandat')}</p>
          ) : filteredMandates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('aucunMandatCorrespondant')}</p>
          ) : (
            <div className="space-y-2">
              <PaginationControls page={visibleMandatePage} pageSize={mandatePageSize} pageCount={mandatePageCount} total={filteredMandates.length} onPageChange={setMandatePage} onPageSizeChange={(size) => { setMandatePageSize(size); setMandatePage(0); }} />
              <div className="max-h-[280px] overflow-auto rounded-md border">
                <Table className="sticky-actions">
                <TableHeader><TableRow>
                  <TableHead className="sticky top-0 z-10 w-10 bg-card">
                    <Checkbox aria-label={t('selectionnerPage')} checked={allVisibleMandatesSelected} disabled={bulkBusy} onCheckedChange={(checked) => toggleVisibleMandates(checked === true)} />
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card">{t('service')}</TableHead><TableHead className="sticky top-0 z-10 bg-card">{t('titulaire')}</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card">{t('typeMandat')}</TableHead><TableHead className="sticky top-0 z-10 bg-card">{t('dateDebut')}</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card">{t('dateFin')}</TableHead><TableHead className="sticky top-0 z-10 bg-card">{t('statut')}</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-card">{t('source')}</TableHead><TableHead className="sticky top-0 z-10 bg-card text-right">{tc('actions')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {visibleMandates.map((mandate) => (
                    <TableRow key={mandate.id} data-state={selectedMandateIds.includes(mandate.id) ? 'selected' : undefined} onContextMenu={(event) => showContextMenu(event, 'mandat', mandate.id)}>
                      <TableCell><Checkbox aria-label={t('selectionnerMandat', { id: mandate.id })} checked={selectedMandateIds.includes(mandate.id)} disabled={bulkBusy} onCheckedChange={(checked) => toggleMandate(mandate.id, checked === true)} /></TableCell>
                      <TableCell className="font-medium">{mandate.unite_nom || unitsById.get(mandate.unite_id)?.nom || '—'}</TableCell>
                      <TableCell>{mandate.titulaire_nom}{mandate.employe_nom ? ` · ${mandate.employe_prenom ?? ''} ${mandate.employe_nom}` : ''}</TableCell>
                      <TableCell>{t(`typesMandat.${mandate.type_mandat}`)}</TableCell>
                      <TableCell>{mandate.date_debut}</TableCell>
                      <TableCell>{mandate.date_fin || '—'}</TableCell>
                      <TableCell><Badge variant={active(mandate.est_actif) ? 'default' : 'secondary'}>{active(mandate.est_actif) ? t('actif') : t('inactif')}</Badge></TableCell>
                      <TableCell>{mandate.source_systeme ? `${mandate.source_systeme}${active(mandate.ams_override) ? ` · ${t('modifieDansAms')}` : ''}` : t('sourceAms')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" aria-label={t('modifierMandat')} onClick={() => openMandate(mandate)} disabled={bulkBusy}><Pencil aria-hidden="true" className="size-4" /></Button>
                          <Button size="icon" variant="ghost" aria-label={t('supprimerMandat')} title={active(mandate.est_actif) ? t('desactiverAvantSuppression') : undefined} onClick={() => void removeMandate(mandate)} disabled={deleteMandate.isPending || bulkBusy || active(mandate.est_actif)}><Trash2 aria-hidden="true" className="size-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
              <PaginationControls page={visibleMandatePage} pageSize={mandatePageSize} pageCount={mandatePageCount} total={filteredMandates.length} onPageChange={setMandatePage} onPageSizeChange={(size) => { setMandatePageSize(size); setMandatePage(0); }} />
            </div>
          )}
        </CardContent>
      </Card>

      <OrganisationMap unites={unites} mandats={mandats} />

      <OrganisationTree unites={unites} mandats={mandats} utilisateurs={utilisateurs} />

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[70] min-w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label={t('operationsSelection')}
        >
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            {t('selectionCount', { count: contextMenu.ids.length })}
          </p>
          {contextMenu.kind === 'unite' && contextMenu.ids.length === 1 && (
            <ContextMenuAction label={t('modifierSelection')} onSelect={() => {
              const unit = unitsById.get(contextMenu.ids[0]);
              setContextMenu(null);
              if (unit) openUnit(unit);
            }} />
          )}
          {contextMenu.kind === 'mandat' && contextMenu.ids.length === 1 && (
            <ContextMenuAction label={t('modifierMandat')} onSelect={() => {
              const mandate = mandats.find((item) => item.id === contextMenu.ids[0]);
              setContextMenu(null);
              if (mandate) openMandate(mandate);
            }} />
          )}
          {(contextMenu.kind === 'unite'
            ? contextMenu.ids.some((id) => !active(unitsById.get(id)?.actif ?? false))
            : contextMenu.ids.some((id) => {
              const mandate = mandats.find((item) => item.id === id);
              return mandate !== undefined && !active(mandate.est_actif);
            })) && (
            <ContextMenuAction label={t('activerSelection')} onSelect={() => {
              const { kind, ids } = contextMenu;
              setContextMenu(null);
              void (kind === 'unite' ? updateSelectedUnits(true, ids) : updateSelectedMandates(true, ids));
            }} />
          )}
          {(contextMenu.kind === 'unite'
            ? contextMenu.ids.some((id) => active(unitsById.get(id)?.actif ?? false))
            : contextMenu.ids.some((id) => {
              const mandate = mandats.find((item) => item.id === id);
              return mandate !== undefined && active(mandate.est_actif);
            })) && (
            <ContextMenuAction label={t('desactiverSelection')} onSelect={() => {
              const { kind, ids } = contextMenu;
              setContextMenu(null);
              void (kind === 'unite' ? updateSelectedUnits(false, ids) : updateSelectedMandates(false, ids));
            }} />
          )}
          <ContextMenuAction destructive label={t('supprimerSelection')} onSelect={() => {
            const { kind, ids } = contextMenu;
            setContextMenu(null);
            void (kind === 'unite' ? deleteSelectedUnits(ids) : deleteSelectedMandates(ids));
          }} />
        </div>
      )}

      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingUnit ? t('modifierServiceTitre') : t('ajouterServiceTitre')}</DialogTitle><DialogDescription>{t('serviceFormDescription')}</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void saveUnit(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('nom')}><Input required maxLength={150} value={unitForm.nom} onChange={(event) => setUnitForm({ ...unitForm, nom: event.target.value })} /></FormField>
              <FormField label={t('code')}><Input required maxLength={50} value={unitForm.code} onChange={(event) => setUnitForm({ ...unitForm, code: event.target.value })} /></FormField>
              <FormField label={t('type')}><Combobox options={unitTypeOptions} value={unitForm.type} onValueChange={(value) => setUnitForm({ ...unitForm, type: value as UniteType })} placeholder={t('choisirTypeUnite')} searchPlaceholder={t('rechercher')} emptyMessage={t('aucunResultat')} /></FormField>
              <FormField label={t('parent')}><Combobox options={parentOptions} value={unitForm.parent_id ? String(unitForm.parent_id) : 'none'} onValueChange={(value) => setUnitForm({ ...unitForm, parent_id: value === 'none' ? null : Number(value) })} placeholder={t('choisirParent')} searchPlaceholder={t('rechercher')} emptyMessage={t('aucunResultat')} /></FormField>
              <FormField label={t('adresse')}><Input value={unitForm.adresse ?? ''} onChange={(event) => setUnitForm({ ...unitForm, adresse: event.target.value || null })} /></FormField>
              <FormField label={t('telephone')}><Input value={unitForm.telephone ?? ''} onChange={(event) => setUnitForm({ ...unitForm, telephone: event.target.value || null })} /></FormField>
              <FormField label={t('email')}><Input type="email" value={unitForm.email ?? ''} onChange={(event) => setUnitForm({ ...unitForm, email: event.target.value || null })} /></FormField>
              <FormField label={t('responsable')}><Combobox options={managerOptions} value={unitForm.responsable_id ? String(unitForm.responsable_id) : 'none'} onValueChange={(value) => setUnitForm({ ...unitForm, responsable_id: value === 'none' ? null : Number(value) })} placeholder={t('choisirResponsable')} searchPlaceholder={t('rechercher')} emptyMessage={t('aucunResultat')} /></FormField>
              <FormField label={t('ordre')}><Input type="number" min={0} value={unitForm.ordre_affichage} onChange={(event) => setUnitForm({ ...unitForm, ordre_affichage: Number(event.target.value) || 0 })} /></FormField>
              <FormField label={t('statut')}><Combobox options={statusOptions} value={active(unitForm.actif) ? 'active' : 'inactive'} onValueChange={(value) => setUnitForm({ ...unitForm, actif: value === 'active' })} placeholder={t('statut')} searchPlaceholder={t('rechercher')} emptyMessage={t('aucunResultat')} /></FormField>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setUnitDialogOpen(false)}>{tc('cancel')}</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{tc('save')}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mandateDialogOpen} onOpenChange={setMandateDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{editingMandate ? t('modifierMandat') : t('ajouterMandatTitre')}</DialogTitle><DialogDescription>{t('mandatFormDescription')}</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void saveMandate(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('service')}><Combobox options={unitOptions} value={mandateForm.unite_id ? String(mandateForm.unite_id) : undefined} onValueChange={(value) => setMandateForm({ ...mandateForm, unite_id: Number(value) })} placeholder={t('choisirService')} searchPlaceholder={t('rechercher')} emptyMessage={t('aucunResultat')} /></FormField>
              <FormField label={t('titulaire')}><Combobox options={userOptions} value={mandateForm.user_id ? String(mandateForm.user_id) : undefined} onValueChange={(value) => setMandateForm({ ...mandateForm, user_id: Number(value) })} placeholder={t('choisirTitulaire')} searchPlaceholder={t('rechercher')} emptyMessage={t('aucunResultat')} /></FormField>
              <FormField label={t('typeMandat')}><Combobox options={mandateTypeOptions} value={mandateForm.type_mandat} onValueChange={(value) => setMandateForm({ ...mandateForm, type_mandat: value as MandatInput['type_mandat'] })} placeholder={t('typeMandat')} searchPlaceholder={t('rechercher')} emptyMessage={t('aucunResultat')} /></FormField>
              <FormField label={t('statut')}><Combobox options={statusOptions} value={active(mandateForm.est_actif) ? 'active' : 'inactive'} onValueChange={(value) => setMandateForm({ ...mandateForm, est_actif: value === 'active' })} placeholder={t('statut')} searchPlaceholder={t('rechercher')} emptyMessage={t('aucunResultat')} /></FormField>
              <FormField label={t('dateDebut')}><Input required type="date" value={mandateForm.date_debut} onChange={(event) => setMandateForm({ ...mandateForm, date_debut: event.target.value })} /></FormField>
              <FormField label={t('dateFin')}><Input type="date" min={mandateForm.date_debut} value={mandateForm.date_fin ?? ''} onChange={(event) => setMandateForm({ ...mandateForm, date_fin: event.target.value || null })} /></FormField>
              <FormField label={t('remarque')}><Input value={mandateForm.remarque ?? ''} onChange={(event) => setMandateForm({ ...mandateForm, remarque: event.target.value || null })} /></FormField>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setMandateDialogOpen(false)}>{tc('cancel')}</Button><Button type="submit" disabled={busy || !mandateForm.unite_id || !mandateForm.user_id}>{busy && <Loader2 className="size-4 animate-spin" />}{tc('save')}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function ContextMenuAction({
  label,
  onSelect,
  destructive = false,
}: {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus:bg-accent ${destructive ? 'text-destructive' : ''}`}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}

function PaginationControls({
  page,
  pageSize,
  pageCount,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const t = useTranslations('organisation');
  const pageSizeId = useId();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{t('pageInfo', {
          from: page * pageSize + 1,
          to: Math.min((page + 1) * pageSize, total),
          total,
        })}</span>
        <Label htmlFor={pageSizeId} className="text-sm font-normal text-muted-foreground">{t('elementsParPage')}</Label>
        <Select value={String(pageSize)} onValueChange={(value) => value && onPageSizeChange(Number(value))}>
          <SelectTrigger id={pageSizeId} className="h-8 w-20"><SelectValue /></SelectTrigger>
          <SelectContent>{[4, 8, 12, 50].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0}>{t('precedent')}</Button>
        <span aria-live="polite" className="min-w-20 text-center text-sm">{t('pageNombre', { current: page + 1, total: pageCount })}</span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1}>{t('suivant')}</Button>
      </div>
    </div>
  );
}

interface OrganisationMapNode {
  unit: UniteOrganisationnelle;
  manager: string;
  children: OrganisationMapNode[];
  titleLines: string[];
  managerLines: string[];
  height: number;
  width: number;
  columnDepth?: number;
  x?: number;
  y?: number;
}

interface OrganisationMapConnector {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  path?: string;
}

function normalizeOrganisationLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
}

function organisationNodeWidth(unit: UniteOrganisationnelle): number {
  const name = normalizeOrganisationLabel(unit.nom);
  if (name.includes('conseil') && name.includes('administration')) return 390;
  if (name.includes('tutelle')) return 300;
  if (name.includes('commissaire general') || name.includes('commissariat general')) return 340;
  if (name.includes('adjoint') && (name.includes('commissaire') || name.includes('commissariat'))) return 320;
  return unit.type === 'COMMISSARIAT' ? 300 : 252;
}

function wrapMapLabel(value: string, maxCharacters: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of value.trim().split(/\s+/).filter(Boolean)) {
    const parts = word.length > maxCharacters
      ? word.match(new RegExp(`.{1,${maxCharacters}}`, 'gu')) ?? [word]
      : [word];
    for (const part of parts) {
      const nextLine = line ? `${line} ${part}` : part;
      if (nextLine.length > maxCharacters && line) {
        lines.push(line);
        line = part;
      } else {
        line = nextLine;
      }
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

function OrganisationMap({
  unites,
  mandats,
}: {
  unites: UniteOrganisationnelle[];
  mandats: Mandat[];
}) {
  const t = useTranslations('organisation');
  const [search, setSearch] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const mapSvgRef = useRef<SVGSVGElement>(null);
  const searchQuery = normalizeOrganisationLabel(search.trim());
  const unitsById = new Map(unites.map((unit) => [unit.id, unit]));
  const childrenByParent = new Map<number, UniteOrganisationnelle[]>();
  for (const unit of unites) {
    if (unit.parent_id === null || !unitsById.has(unit.parent_id)) continue;
    const children = childrenByParent.get(unit.parent_id) ?? [];
    children.push(unit);
    childrenByParent.set(unit.parent_id, children);
  }
  const selectedEntity = selectedEntityId
    ? unitsById.get(Number(selectedEntityId)) ?? null
    : null;
  function isWithinSelectedEntity(unit: UniteOrganisationnelle): boolean {
    let current: UniteOrganisationnelle | undefined = unit;
    const checked = new Set<number>();
    while (current && !checked.has(current.id)) {
      if (current.id === selectedEntity?.id) return true;
      checked.add(current.id);
      current = current.parent_id === null ? undefined : unitsById.get(current.parent_id);
    }
    return false;
  }
  const chartUnits = unites.filter((unit) =>
    selectedEntity
      ? isWithinSelectedEntity(unit)
      : unit.type === 'COMMISSARIAT' || unit.type === 'DIRECTION',
  );
  const chartUnitIds = new Set(chartUnits.map((unit) => unit.id));
  const chartChildrenByParent = new Map<number, UniteOrganisationnelle[]>();
  const chartParentIdByUnitId = new Map<number, number | null>();
  const chartRoots: UniteOrganisationnelle[] = [];
  for (const unit of chartUnits) {
    let parentId = selectedEntity && unit.id === selectedEntity.id ? null : unit.parent_id;
    const checked = new Set<number>();
    while (parentId !== null && !chartUnitIds.has(parentId) && !checked.has(parentId)) {
      checked.add(parentId);
      parentId = unitsById.get(parentId)?.parent_id ?? null;
    }
    chartParentIdByUnitId.set(unit.id, parentId);
    if (parentId === null) {
      chartRoots.push(unit);
      continue;
    }
    const children = chartChildrenByParent.get(parentId) ?? [];
    children.push(unit);
    chartChildrenByParent.set(parentId, children);
  }
  const entityOptions: ComboboxOption[] = unites
    .slice()
    .sort((left, right) => left.nom.localeCompare(right.nom))
    .map((unit) => ({
      value: String(unit.id),
      label: unit.nom,
      description: unit.parent_nom ?? t(`typesUnite.${unit.type}`),
      keywords: `${unit.code} ${unit.type} ${unit.parent_nom ?? ''}`,
    }));

  const today = new Date();
  const currentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentMandates = new Map<number, Mandat[]>();
  for (const mandate of mandats) {
    if (!active(mandate.est_actif) || mandate.date_debut > currentDate
      || (mandate.date_fin !== null && mandate.date_fin < currentDate)) continue;
    const list = currentMandates.get(mandate.unite_id) ?? [];
    list.push(mandate);
    currentMandates.set(mandate.unite_id, list);
  }
  const mandateRank: Record<Mandat['type_mandat'], number> = {
    TITULAIRE: 0,
    INTERIM: 1,
    ADJOINT: 2,
    INTERIM_ADJOINT: 3,
  };
  for (const list of currentMandates.values()) {
    list.sort((left, right) => mandateRank[left.type_mandat] - mandateRank[right.type_mandat]);
  }

  const managerName = (unit: UniteOrganisationnelle): string => {
    const chief = currentMandates.get(unit.id)?.[0];
    return chief?.titulaire_nom ?? '';
  };
  const matches = (unit: UniteOrganisationnelle): boolean => {
    if (!searchQuery) return true;
    const chiefNames = (currentMandates.get(unit.id) ?? []).map((mandate) => mandate.titulaire_nom);
    return normalizeOrganisationLabel(
      [unit.nom, unit.code, unit.type, unit.parent_nom, managerName(unit), ...chiefNames].join(' '),
    ).includes(searchQuery);
  };
  const matchesEntitySearch = (unit: UniteOrganisationnelle): boolean =>
    normalizeOrganisationLabel([unit.nom, unit.code].join(' ')).includes(searchQuery);
  const visibleIds = new Set<number>();
  const visiting = new Set<number>();
  const includeAllDescendants = (unit: UniteOrganisationnelle) => {
    if (visibleIds.has(unit.id) || visiting.has(unit.id)) return;
    visibleIds.add(unit.id);
    visiting.add(unit.id);
    for (const child of chartChildrenByParent.get(unit.id) ?? []) {
      includeAllDescendants(child);
    }
    visiting.delete(unit.id);
  };
  const includeMatchingBranches = (unit: UniteOrganisationnelle, path: Set<number>): boolean => {
    if (path.has(unit.id)) return false;
    const nextPath = new Set(path).add(unit.id);
    const matchingDescendant = (chartChildrenByParent.get(unit.id) ?? [])
      .some((child) => includeMatchingBranches(child, nextPath));
    const unitMatches = matches(unit);
    if (unitMatches) includeAllDescendants(unit);
    if (unitMatches || matchingDescendant) visibleIds.add(unit.id);
    return unitMatches || matchingDescendant;
  };
  if (searchQuery) {
    for (const root of chartRoots) includeMatchingBranches(root, new Set());
    for (const unit of chartUnits) {
      if (!visibleIds.has(unit.id) && (selectedEntity ? isWithinSelectedEntity(unit) : true)) {
        includeMatchingBranches(unit, new Set());
      }
    }
  } else {
    for (const root of chartRoots) includeAllDescendants(root);
  }

  const building = new Set<number>();
  const buildNode = (unit: UniteOrganisationnelle): OrganisationMapNode | null => {
    if (!visibleIds.has(unit.id) || building.has(unit.id)) return null;
    building.add(unit.id);
    const children = (chartChildrenByParent.get(unit.id) ?? [])
      .map(buildNode)
      .filter((child): child is OrganisationMapNode => child !== null);
    building.delete(unit.id);
    const manager = managerName(unit);
    const titleLines = wrapMapLabel(unit.nom, 28);
    const managerLines = manager ? wrapMapLabel(manager, 34) : [];
    const height = 62 + titleLines.length * 17 + managerLines.length * 15;
    return {
      unit,
      manager,
      children,
      titleLines,
      managerLines,
      height: Math.max(120, height),
      width: organisationNodeWidth(unit),
    };
  };
  const mapRoots = chartRoots.map(buildNode).filter((node): node is OrganisationMapNode => node !== null);
  const builtIds = new Set<number>();
  const collectBuiltIds = (node: OrganisationMapNode) => {
    builtIds.add(node.unit.id);
    node.children.forEach(collectBuiltIds);
  };
  mapRoots.forEach(collectBuiltIds);
  for (const unit of chartUnits) {
    if (visibleIds.has(unit.id) && !builtIds.has(unit.id)) {
      const node = buildNode(unit);
      if (node) {
        mapRoots.push(node);
        collectBuiltIds(node);
      }
    }
  }

  const laidOutNodes: OrganisationMapNode[] = [];
  const connectors: OrganisationMapConnector[] = [];
  const nodeWidth = 252;
  const columnGap = 36;
  const nodeById = new Map<number, OrganisationMapNode>();
  const indexNodes = (node: OrganisationMapNode) => {
    nodeById.set(node.unit.id, node);
    node.children.forEach(indexNodes);
  };
  mapRoots.forEach(indexNodes);

  const commissariats = [...nodeById.values()].filter((node) => node.unit.type === 'COMMISSARIAT');
  const generalCommissioner = commissariats.find((node) => {
    const name = normalizeOrganisationLabel(node.unit.nom);
    return (name.includes('commissaire general') || name.includes('commissariat general'))
      && !name.includes('adjoint');
  });
  const deputyCommissioner = commissariats.find((node) => {
    const name = normalizeOrganisationLabel(node.unit.nom);
    return name.includes('adjoint')
      && (name.includes('commissaire') || name.includes('commissariat') || name.includes('general'));
  });

  let mapWidth = 0;
  let mapHeight = 0;
  let orgChartLayout = false;

  if (generalCommissioner) {
    const otherCommissioners = commissariats
      .filter((node) => node !== generalCommissioner && node !== deputyCommissioner);
    const directPortfolios = otherCommissioners.filter(
      (node) => chartParentIdByUnitId.get(node.unit.id) === generalCommissioner.unit.id,
    );
    const peerPortfolios = otherCommissioners.filter(
      (node) => chartParentIdByUnitId.get(node.unit.id) === chartParentIdByUnitId.get(generalCommissioner.unit.id),
    );
    const portfolioNodes = (directPortfolios.length > 0
      ? directPortfolios
      : peerPortfolios.length > 0
        ? peerPortfolios
        : otherCommissioners)
      .sort((left, right) =>
        (left.unit.ordre_affichage - right.unit.ordre_affichage) || left.unit.nom.localeCompare(right.unit.nom),
      );
    const directUnits = [...nodeById.values()]
      .filter((node) =>
        node.unit.type !== 'COMMISSARIAT'
        && chartParentIdByUnitId.get(node.unit.id) === generalCommissioner.unit.id,
      )
      .sort((left, right) =>
        (left.unit.ordre_affichage - right.unit.ordre_affichage) || left.unit.nom.localeCompare(right.unit.nom),
      );
    const ancestors: OrganisationMapNode[] = [];
    const ancestorIds = new Set<number>();
    let parentId = generalCommissioner.unit.parent_id;
    while (parentId !== null && !ancestorIds.has(parentId)) {
      ancestorIds.add(parentId);
      const ancestor = nodeById.get(parentId);
      if (!ancestor) break;
      ancestors.unshift(ancestor);
      parentId = ancestor.unit.parent_id;
    }
    const boardNode = Array.from(nodeById.values()).find((node) => {
      const name = normalizeOrganisationLabel(node.unit.nom);
      return name.includes('conseil') && name.includes('administration');
    });
    if (boardNode && !ancestors.includes(boardNode)) {
      const tutelleIndex = ancestors.findIndex((node) =>
        normalizeOrganisationLabel(node.unit.nom).includes('tutelle'),
      );
      ancestors.splice(tutelleIndex >= 0 ? tutelleIndex + 1 : ancestors.length, 0, boardNode);
    }
    if (!selectedEntity && !ancestors.some((node) => normalizeOrganisationLabel(node.unit.nom).includes('tutelle'))) {
      const tutelleUnit: UniteOrganisationnelle = {
        id: -1,
        parent_id: null,
        nom: 'TUTELLE',
        code: '',
        type: 'COMMISSARIAT',
        niveau: 0,
        adresse: null,
        telephone: null,
        email: null,
        responsable_id: null,
        ordre_affichage: -1,
        actif: true,
        source_id: null,
        source_systeme: null,
        source_synced_at: null,
        ams_override: false,
        parent_nom: null,
      };
      const tutelleNode: OrganisationMapNode = {
        unit: tutelleUnit,
        manager: '',
        children: [],
        titleLines: ['TUTELLE'],
        managerLines: [],
        height: 120,
        width: organisationNodeWidth(tutelleUnit),
      };
      const boardIndex = ancestors.findIndex((node) => {
        const name = normalizeOrganisationLabel(node.unit.nom);
        return name.includes('conseil') && name.includes('administration');
      });
      ancestors.splice(boardIndex >= 0 ? boardIndex : 0, 0, tutelleNode);
    }
    const topAncestors = ancestors.filter((node) =>
      node !== generalCommissioner && node !== deputyCommissioner && !portfolioNodes.includes(node),
    );
    const portIds = new Set(portfolioNodes.map((node) => node.unit.id));
    const fixedIds = new Set([
      ...topAncestors.map((node) => node.unit.id),
      generalCommissioner.unit.id,
      ...(deputyCommissioner ? [deputyCommissioner.unit.id] : []),
      ...portIds,
      ...directUnits.map((node) => node.unit.id),
    ]);
    const nodesInPortfolios = new Set<number>();
    const markPortfolioDescendants = (node: OrganisationMapNode) => {
      for (const child of node.children) {
        if (portIds.has(child.unit.id)
          || child.unit.id === generalCommissioner.unit.id
          || child.unit.id === deputyCommissioner?.unit.id
          || directUnits.some((directUnit) => directUnit.unit.id === child.unit.id)) {
          continue;
        }
        if (nodesInPortfolios.has(child.unit.id)) continue;
        nodesInPortfolios.add(child.unit.id);
        markPortfolioDescendants(child);
      }
    };
    portfolioNodes.forEach(markPortfolioDescendants);

    const placed = new Set<number>();
    const placeNode = (node: OrganisationMapNode, x: number, y: number, depth = 0) => {
      if (placed.has(node.unit.id)) return;
      placed.add(node.unit.id);
      node.x = x;
      node.y = y;
      node.columnDepth = depth;
      laidOutNodes.push(node);
    };
    const columnStep = Math.max(...portfolioNodes.map((node) => node.width), 300) + columnGap;
    const centerX = Math.max(
      420,
      ((portfolioNodes.length - 1) * columnStep) / 2
        + Math.max(...portfolioNodes.map((node) => node.width), 300) / 2
        + 48,
    );
    let topY = 28;
    for (const ancestor of topAncestors) {
      placeNode(ancestor, centerX, topY);
      const ancestorIndex = topAncestors.indexOf(ancestor);
      if (topAncestors[ancestorIndex + 1]) {
        connectors.push({
          fromX: centerX,
          fromY: topY + ancestor.height,
          toX: centerX,
          toY: topY + ancestor.height + 28,
        });
      }
      topY += ancestor.height + 28;
    }
    const commissionerY = topY + 20;
    placeNode(generalCommissioner, centerX, commissionerY);
    if (topAncestors.length > 0) {
      const lastAncestor = topAncestors[topAncestors.length - 1];
      connectors.push({
        fromX: centerX,
        fromY: (lastAncestor.y ?? 0) + lastAncestor.height,
        toX: centerX,
        toY: commissionerY,
      });
    }

    const commissionerBottom = commissionerY + generalCommissioner.height;
    const trunkY = commissionerBottom + 170;
    const portY = trunkY + 44;
    const firstPortX = portfolioNodes.length > 0
      ? centerX - ((portfolioNodes.length - 1) * columnStep) / 2
      : centerX;
    const lastPortX = portfolioNodes.length > 0
      ? centerX + ((portfolioNodes.length - 1) * columnStep) / 2
      : centerX;
    connectors.push({
      fromX: centerX,
      fromY: commissionerBottom,
      toX: centerX,
      toY: trunkY,
    });
    if (portfolioNodes.length > 0) {
      if (portfolioNodes.length > 1) {
        connectors.push({ fromX: firstPortX, fromY: trunkY, toX: lastPortX, toY: trunkY });
      }
      portfolioNodes.forEach((portfolio, index) => {
        const portfolioX = firstPortX + index * columnStep;
        connectors.push({ fromX: portfolioX, fromY: trunkY, toX: portfolioX, toY: portY });
        placeNode(portfolio, portfolioX, portY);
        const children = portfolio.children.filter((child) =>
          !portIds.has(child.unit.id)
          && child.unit.id !== generalCommissioner.unit.id
          && child.unit.id !== deputyCommissioner?.unit.id
          && !placed.has(child.unit.id),
        );
        const descendants: Array<{ node: OrganisationMapNode; depth: number; parent: OrganisationMapNode; level: number; order: number }> = [];
        const collected = new Set<number>();
        let order = 0;
        const collectDescendants = (parent: OrganisationMapNode, depth: number) => {
          const children = parent.children
            .filter((child) =>
              !portIds.has(child.unit.id)
              && child.unit.id !== generalCommissioner.unit.id
              && child.unit.id !== deputyCommissioner?.unit.id
              && !placed.has(child.unit.id)
              && !collected.has(child.unit.id),
            )
            .sort((left, right) =>
              (left.unit.ordre_affichage - right.unit.ordre_affichage)
              || left.unit.nom.localeCompare(right.unit.nom),
            );
          for (const child of children) {
            collected.add(child.unit.id);
            const level = child.unit.niveau;
            descendants.push({ node: child, depth, parent, level, order: order++ });
            collectDescendants(child, depth + 1);
          }
        };
        for (const child of children) {
          if (collected.has(child.unit.id)) continue;
          collected.add(child.unit.id);
          const level = child.unit.niveau;
          descendants.push({ node: child, depth: 1, parent: portfolio, level, order: order++ });
          collectDescendants(child, 2);
        }
        descendants.sort((left, right) =>
          (left.level - right.level) || (left.order - right.order),
        );
        const levelGroups = new Map<number, typeof descendants>();
        for (const item of descendants) {
          const group = levelGroups.get(item.level) ?? [];
          group.push(item);
          levelGroups.set(item.level, group);
        }
        let cursorY = portY + portfolio.height + 38;
        const railX = portfolioX - portfolio.width / 2 - 18;
        for (const group of levelGroups.values()) {
          for (const item of group) {
            if (placed.has(item.node.unit.id)) continue;
            const indent = Math.min(item.depth - 1, 3) * 12;
            const nodeX = portfolioX + indent;
            placeNode(item.node, nodeX, cursorY, item.depth);
            const parentLeft = (item.parent.x ?? portfolioX) - item.parent.width / 2;
            const childLeft = nodeX - item.node.width / 2;
            const parentCenterY = (item.parent.y ?? portY) + item.parent.height / 2;
            const childCenterY = cursorY + item.node.height / 2;
            const depthRailX = railX - Math.min(item.depth, 3) * 8;
            connectors.push({
              fromX: parentLeft,
              fromY: parentCenterY,
              toX: childLeft,
              toY: childCenterY,
              path: `M ${parentLeft} ${parentCenterY} H ${depthRailX} V ${childCenterY} H ${childLeft}`,
            });
            cursorY += item.node.height + 18;
          }
          cursorY += 30;
        }
        mapHeight = Math.max(mapHeight, cursorY + 24);
      });
    }

    if (deputyCommissioner) {
      const deputyX = centerX
        + generalCommissioner.width / 2
        + deputyCommissioner.width / 2
        + 36;
      const deputyBranchY = commissionerBottom + (trunkY - commissionerBottom) / 2;
      const deputyY = deputyBranchY - deputyCommissioner.height / 2;
      placeNode(deputyCommissioner, deputyX, deputyY);
      connectors.push({
        fromX: centerX,
        fromY: deputyBranchY,
        toX: deputyX - deputyCommissioner.width / 2,
        toY: deputyBranchY,
      });
    }

    if (directUnits.length > 0) {
      const contentRight = Math.max(
        ...laidOutNodes.map((node) => (node.x ?? 0) + node.width / 2),
      );
      const unitY = portY
        + Math.max(...portfolioNodes.map((node) => node.height), generalCommissioner.height)
        + 38;
      const descendants: Array<{ node: OrganisationMapNode; parent: OrganisationMapNode; level: number; order: number }> = [];
      const collected = new Set<number>();
      let order = 0;
      const collectDirectUnitDescendants = (parent: OrganisationMapNode) => {
        const children = parent.children
          .filter((child) => !placed.has(child.unit.id) && !collected.has(child.unit.id))
          .sort((left, right) =>
            (left.unit.ordre_affichage - right.unit.ordre_affichage)
            || left.unit.nom.localeCompare(right.unit.nom),
          );
        for (const child of children) {
          collected.add(child.unit.id);
          const level = child.unit.niveau;
          descendants.push({ node: child, parent, level, order: order++ });
          collectDirectUnitDescendants(child);
        }
      };
      for (const directUnit of directUnits) {
        if (placed.has(directUnit.unit.id)) continue;
        collected.add(directUnit.unit.id);
        const level = directUnit.unit.niveau;
        descendants.push({ node: directUnit, parent: generalCommissioner, level, order: order++ });
        collectDirectUnitDescendants(directUnit);
      }
      descendants.sort((left, right) => (left.level - right.level) || (left.order - right.order));
      const levels = new Map<number, typeof descendants>();
      for (const item of descendants) {
        const group = levels.get(item.level) ?? [];
        group.push(item);
        levels.set(item.level, group);
      }
      const unitWidth = Math.max(...descendants.map(({ node }) => node.width));
      const unitX = contentRight + unitWidth / 2 + columnGap;
      let cursorY = unitY;
      for (const group of levels.values()) {
        for (const { node, parent } of group) {
          if (placed.has(node.unit.id)) continue;
          const nodeX = unitX;
          placeNode(node, nodeX, cursorY, node.unit.niveau);
          const childCenterY = cursorY + node.height / 2;
          const childLeft = nodeX - node.width / 2;
          if (parent.unit.id === generalCommissioner.unit.id) {
            connectors.push({
              fromX: centerX,
              fromY: trunkY,
              toX: childLeft,
              toY: childCenterY,
              path: `M ${centerX} ${trunkY} H ${childLeft} V ${childCenterY}`,
            });
          } else {
            const parentRight = (parent.x ?? nodeX) + parent.width / 2;
            const parentCenterY = (parent.y ?? cursorY) + parent.height / 2;
            const railX = (parentRight + childLeft) / 2;
            connectors.push({
              fromX: parentRight,
              fromY: parentCenterY,
              toX: childLeft,
              toY: childCenterY,
              path: `M ${parentRight} ${parentCenterY} H ${railX} V ${childCenterY} H ${childLeft}`,
            });
          }
          cursorY += node.height + 18;
        }
        cursorY += 30;
        mapHeight = Math.max(mapHeight, cursorY + 24);
      }
    }

    for (const node of nodeById.values()) {
      if (placed.has(node.unit.id) || nodesInPortfolios.has(node.unit.id)) continue;
      if (fixedIds.has(node.unit.id)) continue;
      if (node.unit.parent_id !== null && !placed.has(node.unit.parent_id)) continue;
      const x = Math.max(...laidOutNodes.map((item) => (item.x ?? 0) + item.width / 2)) + node.width / 2 + columnGap;
      const y = portY;
      placeNode(node, x, y);
      mapHeight = Math.max(mapHeight, y + node.height + 24);
    }
    const maxX = Math.max(...laidOutNodes.map((node) => (node.x ?? 0) + node.width / 2));
    mapWidth = Math.max(760, maxX + 32);
    mapHeight = Math.max(mapHeight, ...laidOutNodes.map((node) => (node.y ?? 0) + node.height + 32));
    orgChartLayout = true;
  }

  if (!orgChartLayout) {
    const horizontalGap = 32;
    const verticalGap = 48;
    const levelHeights: number[] = [];
    let maxDepth = 0;
    const maximumNodeWidth = Math.max(nodeWidth, ...Array.from(nodeById.values(), (node) => node.width));
    const leafGap = maximumNodeWidth + horizontalGap;
    const measureDepth = (node: OrganisationMapNode, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      levelHeights[depth] = Math.max(levelHeights[depth] ?? 0, node.height);
      node.children.forEach((child) => measureDepth(child, depth + 1));
    };
    mapRoots.forEach((root) => measureDepth(root, 0));
    const levelY: number[] = [32];
    for (let depth = 1; depth <= maxDepth; depth++) {
      levelY[depth] = levelY[depth - 1] + (levelHeights[depth - 1] ?? 116) + verticalGap;
    }
    let leafIndex = 0;
    const positionNode = (node: OrganisationMapNode, depth: number): number => {
      laidOutNodes.push(node);
      node.y = levelY[depth];
      if (node.children.length === 0) {
        node.x = maximumNodeWidth / 2 + leafIndex * leafGap;
        leafIndex++;
        return node.x;
      }
      const childXs = node.children.map((child) => positionNode(child, depth + 1));
      node.x = (childXs[0] + childXs[childXs.length - 1]) / 2;
      for (let index = 0; index < childXs.length; index++) {
        const child = node.children[index];
        connectors.push({ fromX: node.x, fromY: node.y + node.height, toX: childXs[index], toY: child.y ?? 0 });
      }
      return node.x;
    };
    mapRoots.forEach((root) => positionNode(root, 0));
    mapWidth = Math.max(nodeWidth + 64, ...laidOutNodes.map((node) => (node.x ?? 0) + node.width / 2 + 32));
    mapHeight = Math.max(180, levelY[maxDepth] + (levelHeights[maxDepth] ?? 116) + 32);
  }

  const exportImage = async () => {
    const svg = mapSvgRef.current;
    if (!svg) {
      toast.error(t('erreurExportImage'));
      return;
    }

    let objectUrl: string | null = null;
    try {
      const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clonedSvg.setAttribute('width', String(mapWidth));
      clonedSvg.setAttribute('height', String(mapHeight));
      objectUrl = URL.createObjectURL(new Blob(
        [new XMLSerializer().serializeToString(clonedSvg)],
        { type: 'image/svg+xml;charset=utf-8' },
      ));

      const image = new Image();
      image.src = objectUrl;
      await image.decode();

      const maxCanvasDimension = 16384;
      const maxCanvasPixels = 48_000_000;
      const scale = Math.min(
        4,
        maxCanvasDimension / Math.max(mapWidth, mapHeight),
        Math.sqrt(maxCanvasPixels / (mapWidth * mapHeight)),
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(mapWidth * scale));
      canvas.height = Math.max(1, Math.round(mapHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D context is unavailable.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('PNG image could not be generated.'));
        }, 'image/png');
      });
      const downloadUrl = URL.createObjectURL(pngBlob);
      const anchor = document.createElement('a');
      const filePart = selectedEntity
        ? normalizeOrganisationLabel(selectedEntity.nom).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        : 'organisation';
      anchor.href = downloadUrl;
      anchor.download = `cartographie-${filePart || 'organisation'}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      toast.success(t('exportImageReussi'));
    } catch (error) {
      console.error('Échec de l’export de la cartographie en image.', error);
      toast.error(t('erreurExportImage'));
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  };

  const searchedLeaf = searchQuery
    ? unites
      .filter((unit) => matchesEntitySearch(unit)
        && (childrenByParent.get(unit.id)?.length ?? 0) === 0
        && (!selectedEntity || isWithinSelectedEntity(unit)))
      .sort((left, right) => {
        const leftExact = normalizeOrganisationLabel(left.nom) === searchQuery ? 0 : 1;
        const rightExact = normalizeOrganisationLabel(right.nom) === searchQuery ? 0 : 1;
        return leftExact - rightExact || left.nom.localeCompare(right.nom);
      })[0] ?? null
    : null;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3">
          <div className="min-w-48">
            <CardTitle className="flex items-center gap-2"><MapPinned aria-hidden="true" className="size-5" />{t('cartographieTitle')}</CardTitle>
            <CardDescription>
              {selectedEntity
                ? t('cartographieEntiteSelectionnee', { name: selectedEntity.nom })
                : t('cartographieJusquaDirections')}
            </CardDescription>
          </div>
          <div className="map-controls flex w-full flex-wrap items-center gap-2">
            <div className="w-full sm:w-64">
              <Combobox
                options={entityOptions}
                value={selectedEntityId || 'all'}
                onValueChange={(value) => setSelectedEntityId(value === 'all' ? '' : value)}
                placeholder={t('selectionnerEntite')}
                searchPlaceholder={t('rechercher')}
                emptyMessage={t('aucunResultat')}
                allowAll
                allLabel={t('toutesEntitesJusquaDirections')}
              />
            </div>
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label={t('rechercherCartographie')} placeholder={t('rechercherCartographie')} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
            </div>
            <Button type="button" variant="outline" onClick={exportImage} disabled={laidOutNodes.length === 0}>
              <Download aria-hidden="true" className="size-4" />{t('exporterImage')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {unites.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('aucunService')}</p>
          ) : laidOutNodes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('aucunServiceCorrespondant')}</p>
          ) : (
            <div className="map-canvas max-h-[520px] overflow-auto rounded-md border bg-muted/20 p-4">
                <svg
                  ref={mapSvgRef}
                  role="img"
                  aria-label={t('cartographieDescription')}
                  className="map-svg block h-auto w-full"
                  width={mapWidth}
                  height={mapHeight}
                  viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  <title>{t('cartographieTitle')}</title>
                  {connectors.map((edge, index) => {
                    const midY = edge.fromY + (edge.toY - edge.fromY) / 2;
                    return (
                      <path
                        key={index}
                        d={edge.path ?? `M ${edge.fromX} ${edge.fromY} V ${midY} H ${edge.toX} V ${edge.toY}`}
                        fill="none"
                        className="map-connector"
                        stroke="#64748b"
                        strokeOpacity="0.75"
                        strokeWidth="2.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  {laidOutNodes.map((node) => {
                    const x = (node.x ?? 0) - node.width / 2;
                    const y = node.y ?? 0;
                    const isActive = active(node.unit.actif);
                    const normalizedName = normalizeOrganisationLabel(node.unit.nom);
                    const isBoard = normalizedName.includes('conseil') && normalizedName.includes('administration');
                    const isTutelle = normalizedName.includes('tutelle');
                    const isCommissioner = node.unit.type === 'COMMISSARIAT' && !isTutelle;
                    const titleY = y + 22;
                    const managerY = titleY + node.titleLines.length * 17 + 10;
                    const shapeFill = isBoard ? '#a8cf9b'
                      : isTutelle ? '#ffd782'
                        : isCommissioner ? '#4f91ca'
                          : (isActive ? '#ffffff' : '#f4f4f5');
                    const shapeStroke = isBoard ? '#72a567'
                      : isTutelle ? '#e4ad38'
                        : isCommissioner ? '#28669e'
                          : (isActive ? '#64748b' : '#a1a1aa');
                    const titleFill = isCommissioner ? '#ffffff' : '#111827';
                    return (
                      <g key={node.unit.id}>
                        {isBoard ? (
                          <ellipse
                            cx={node.x}
                            cy={y + node.height / 2}
                            rx={node.width / 2}
                            ry={node.height / 2}
                            fill={shapeFill}
                            stroke={shapeStroke}
                            strokeWidth="1.5"
                          />
                        ) : (
                          <rect
                            x={x}
                            y={y}
                            width={node.width}
                            height={node.height}
                            rx={isTutelle ? 14 : 10}
                            fill={shapeFill}
                            stroke={shapeStroke}
                            strokeWidth="1.5"
                          />
                        )}
                        {!isBoard && !isTutelle && (
                          <rect
                            x={x}
                            y={y}
                            width={node.width}
                            height="5"
                            rx="3"
                            fill={isCommissioner ? '#1e5b93' : (isActive ? '#2563eb' : '#71717a')}
                          />
                        )}
                        {node.titleLines.map((line, index) => (
                          <text
                            key={`title-${index}`}
                            className="map-node-title"
                            x={x + node.width / 2}
                            y={titleY + index * 17}
                            textAnchor="middle"
                            fontSize="13"
                            fontWeight="700"
                            fill={titleFill}
                          >
                            {line}
                          </text>
                        ))}
                        {node.managerLines.length > 0 && (
                          <line
                            x1={x + 14}
                            x2={x + node.width - 14}
                            y1={managerY - 9}
                            y2={managerY - 9}
                            stroke="#cbd5e1"
                          />
                        )}
                        {node.managerLines.map((line, index) => (
                          <text
                            key={`manager-${index}`}
                            className="map-node-manager"
                            x={x + node.width / 2}
                            y={managerY + index * 15}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight={index === 0 ? '600' : '400'}
                            fill={isCommissioner ? '#ffffff' : '#1e3a8a'}
                          >
                            {line}
                          </text>
                        ))}
                      </g>
                    );
                  })}
                </svg>
            </div>
          )}
          {searchedLeaf && (
            <OrganisationMapEmployees key={searchedLeaf.id} unit={searchedLeaf} />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function OrganisationMapEmployees({ unit }: { unit: UniteOrganisationnelle }) {
  const t = useTranslations('organisation');
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const { data, isPending, isError } = useEmployes({
    unite_id: unit.id,
    limit: pageSize,
    offset: page * pageSize,
  });
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <section className="map-employees mt-4 rounded-md border p-4" aria-live="polite">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-semibold">{t('employesEntite', { name: unit.nom })}</h4>
          {data && <p className="text-sm text-muted-foreground">{t('nombreEmployesEntite', { count: data.total })}</p>}
        </div>
        {data && data.total > pageSize && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
              {t('precedent')}
            </Button>
            <span className="text-sm">{t('pageNombre', { current: page + 1, total: pageCount })}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1}>
              {t('suivant')}
            </Button>
          </div>
        )}
      </div>
      {isPending ? (
        <p className="text-sm text-muted-foreground">{t('chargementEmployesEntite')}</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-destructive">{t('erreurChargementEmployesEntite')}</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('aucunEmployeEntite')}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((employee) => (
            <li key={employee.id} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <p className="font-medium">{employee.prenom} {employee.nom}</p>
              <p className="text-muted-foreground">
                {employee.matricule}{employee.poste ? ` · ${employee.poste}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OrganisationTree({
  unites,
  mandats,
  utilisateurs,
}: {
  unites: UniteOrganisationnelle[];
  mandats: Mandat[];
  utilisateurs: OrganisationData['utilisateurs'];
}) {
  const t = useTranslations('organisation');
  const [search, setSearch] = useState('');
  const searchQuery = search.trim().toLocaleLowerCase();
  const unitsById = new Map(unites.map((unit) => [unit.id, unit]));
  const childrenByParent = new Map<number, UniteOrganisationnelle[]>();
  const roots: UniteOrganisationnelle[] = [];
  for (const unit of unites) {
    if (unit.parent_id === null || !unitsById.has(unit.parent_id)) {
      roots.push(unit);
      continue;
    }
    const children = childrenByParent.get(unit.parent_id) ?? [];
    children.push(unit);
    childrenByParent.set(unit.parent_id, children);
  }

  const today = new Date();
  const currentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const mandatesByUnit = new Map<number, Mandat[]>();
  for (const mandate of mandats) {
    if (!active(mandate.est_actif) || mandate.date_debut > currentDate
      || (mandate.date_fin !== null && mandate.date_fin < currentDate)) continue;
    const unitMandates = mandatesByUnit.get(mandate.unite_id) ?? [];
    unitMandates.push(mandate);
    mandatesByUnit.set(mandate.unite_id, unitMandates);
  }
  const rank: Record<Mandat['type_mandat'], number> = {
    TITULAIRE: 0,
    INTERIM: 1,
    ADJOINT: 2,
    INTERIM_ADJOINT: 3,
  };
  const renderedIds = new Set<number>();
  const unitMatches = (unit: UniteOrganisationnelle) => {
    if (!searchQuery) return true;
    const chiefs = mandatesByUnit.get(unit.id) ?? [];
    const responsible = utilisateurs.find((account) => account.employe_id === unit.responsable_id);
    return [
      unit.nom,
      unit.code,
      unit.type,
      unit.parent_nom,
      responsible?.nom_complet,
      ...chiefs.map((chief) => chief.titulaire_nom),
    ].filter(Boolean).join(' ').toLocaleLowerCase().includes(searchQuery);
  };
  const hasMatchingUnit = (unit: UniteOrganisationnelle, path: Set<number>): boolean => {
    if (path.has(unit.id)) return false;
    if (unitMatches(unit)) return true;
    const nextPath = new Set(path).add(unit.id);
    return (childrenByParent.get(unit.id) ?? []).some((child) => hasMatchingUnit(child, nextPath));
  };

  const renderUnit = (unit: UniteOrganisationnelle, path: Set<number>, includeSubtree = false): ReactNode => {
    if (path.has(unit.id) || renderedIds.has(unit.id)) return null;
    const matches = unitMatches(unit);
    if (searchQuery && !includeSubtree && !matches && !hasMatchingUnit(unit, path)) return null;
    renderedIds.add(unit.id);
    const nextPath = new Set(path).add(unit.id);
    const chiefs = (mandatesByUnit.get(unit.id) ?? []).sort((left, right) =>
      rank[left.type_mandat] - rank[right.type_mandat],
    );
    const responsible = utilisateurs.find((account) => account.employe_id === unit.responsable_id);
    const children = childrenByParent.get(unit.id) ?? [];
    return (
      <li key={unit.id} className="min-w-0 list-none">
        <article className="w-full max-w-sm rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BriefcaseBusiness aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-semibold" title={unit.nom}>{unit.nom}</h3>
                <p className="truncate text-xs text-muted-foreground">{unit.code} · {t(`typesUnite.${unit.type}`)}</p>
              </div>
            </div>
            <Badge variant={active(unit.actif) ? 'default' : 'secondary'}>{active(unit.actif) ? t('actif') : t('inactif')}</Badge>
          </div>
          <div className="mt-3 space-y-2 border-t pt-3 text-sm">
            {chiefs.length > 0 ? chiefs.map((chief) => (
              <div key={chief.id} className="flex min-w-0 items-center gap-2">
                <UserRound aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <span className="truncate font-medium">{chief.titulaire_nom}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t(`typesMandat.${chief.type_mandat}`)}</span>
              </div>
            )) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserRound aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{responsible?.nom_complet ?? t('aucunChefActif')}</span>
                {responsible && <span className="shrink-0 text-xs">{t('responsableDirect')}</span>}
              </div>
            )}
          </div>
        </article>
        {children.length > 0 && (
          <ul className="ml-5 mt-4 space-y-4 border-l-2 border-muted-foreground/20 pl-5">
            {children.map((child) => renderUnit(child, nextPath, includeSubtree || matches))}
          </ul>
        )}
      </li>
    );
  };
  const renderRoot = (unit: UniteOrganisationnelle) => renderUnit(unit, new Set());
  const treeNodes = roots.map(renderRoot);
  for (const unit of unites) {
    if (!renderedIds.has(unit.id)) treeNodes.push(renderRoot(unit));
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-48">
          <CardTitle className="flex items-center gap-2"><GitBranch aria-hidden="true" className="size-5" />{t('vueHierarchique')}</CardTitle>
          <CardDescription>{t('vueHierarchiqueDescription')}</CardDescription>
        </div>
        <div className="relative w-full max-w-md flex-1">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label={t('rechercherHierarchie')} placeholder={t('rechercherHierarchie')} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
        </div>
      </CardHeader>
      <CardContent>
        {unites.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('aucunService')}</p>
        ) : searchQuery && !unites.some((unit) => hasMatchingUnit(unit, new Set())) ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('aucunServiceCorrespondant')}</p>
        ) : (
          <div className="max-h-[560px] overflow-auto rounded-md border bg-muted/20 p-4">
            <ul className="flex min-w-max items-start gap-8">{treeNodes}</ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
