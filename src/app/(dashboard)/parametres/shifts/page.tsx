'use client';

import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { useAssignerShift, useCreerShift, useDesassignerShift, useModifierShift, useShifts, useSupprimerShift, type Shift, type ShiftInput } from '@/hooks/useShifts';
import { useEmployes } from '@/hooks/useEmployes';
import { useAuthStore } from '@/stores/authStore';
import { confirmerAvecSweetAlert } from '@/lib/confirmation';

const DEFAULT_SHIFT: ShiftInput = {
  nom: '',
  code: '',
  description: '',
  heure_debut: '06:00',
  heure_fin: '14:00',
  couleur: '#3b82f6',
  ordre_affichage: 0,
  actif: true,
};

function dateAujourdhui(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function ShiftsPage() {
  const t = useTranslations('parametres.shifts');
  const tCommon = useTranslations('common');
  const user = useAuthStore((state) => state.user);
  const shiftsQuery = useShifts();
  const employesQuery = useEmployes({ actif: true, limit: 1000 });
  const creer = useCreerShift();
  const modifier = useModifierShift();
  const supprimer = useSupprimerShift();
  const assigner = useAssignerShift();
  const desassigner = useDesassignerShift();
  const [editionId, setEditionId] = useState<number | null>(null);
  const [formShift, setFormShift] = useState<ShiftInput>(DEFAULT_SHIFT);
  const [employeId, setEmployeId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [dateDebut, setDateDebut] = useState(dateAujourdhui);
  const [dateFin, setDateFin] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'rh' || user?.is_super_admin;
  const shifts = shiftsQuery.data?.items ?? [];
  const activeShiftOptions = shifts
    .filter((shift) => Boolean(Number(shift.actif)))
    .map((shift) => ({
      value: String(shift.id),
      label: `${shift.nom} (${shift.heure_debut.slice(0, 5)}–${shift.heure_fin.slice(0, 5)})`,
    }));
  const affectations = shiftsQuery.data?.affectations ?? [];
  const employes = employesQuery.data?.items ?? [];
  const employeeOptions = employes.map((employe) => ({
    value: String(employe.id),
    label: `${employe.nom} ${employe.prenom} · ${employe.matricule}`,
  }));

  function modifierChamp<K extends keyof ShiftInput>(cle: K, valeur: ShiftInput[K]) {
    setFormShift((precedent) => ({ ...precedent, [cle]: valeur }));
  }

  function commencerEdition(shift: Shift) {
    setEditionId(shift.id);
    setFormShift({
      nom: shift.nom,
      code: shift.code,
      description: shift.description ?? '',
      heure_debut: shift.heure_debut.slice(0, 5),
      heure_fin: shift.heure_fin.slice(0, 5),
      couleur: shift.couleur,
      ordre_affichage: Number(shift.ordre_affichage),
      actif: Boolean(Number(shift.actif)),
    });
  }

  function annulerEdition() {
    setEditionId(null);
    setFormShift(DEFAULT_SHIFT);
  }

  async function enregistrerShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editionId === null) {
        await creer.mutateAsync(formShift);
        toast.success(t('created'));
      } else {
        await modifier.mutateAsync({ id: editionId, data: formShift });
        toast.success(t('updated'));
      }
      annulerEdition();
    } catch {
      toast.error(t('saveError'));
    }
  }

  async function supprimerShift(shift: Shift) {
    if (!await confirmerAvecSweetAlert(t('confirmDelete', { nom: shift.nom }), {
      title: tCommon('confirm'),
      confirmButtonText: tCommon('yes'),
      cancelButtonText: tCommon('no'),
      destructive: true,
    })) return;
    try {
      await supprimer.mutateAsync(shift.id);
      toast.success(t('deleted'));
      if (editionId === shift.id) annulerEdition();
    } catch {
      toast.error(t('deleteError'));
    }
  }

  async function enregistrerAffectation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeId || !shiftId) return;
    try {
      await assigner.mutateAsync({
        employe_id: Number(employeId),
        shift_id: Number(shiftId),
        date_debut: dateDebut,
        ...(dateFin ? { date_fin: dateFin } : {}),
      });
      toast.success(t('assigned'));
      setEmployeId('');
      setShiftId('');
      setDateDebut(dateAujourdhui());
      setDateFin('');
    } catch {
      toast.error(t('assignmentError'));
    }
  }

  async function retirerAffectation(id: number, nom: string) {
    if (!await confirmerAvecSweetAlert(t('confirmUnassign', { nom }), {
      title: tCommon('confirm'),
      confirmButtonText: tCommon('yes'),
      cancelButtonText: tCommon('no'),
      destructive: true,
    })) return;
    try {
      await desassigner.mutateAsync(id);
      toast.success(t('unassigned'));
    } catch {
      toast.error(t('unassignError'));
    }
  }

  if (!isAdmin) {
    return <p role="alert" className="w-full rounded-lg border p-6 text-sm text-destructive">{t('accessDenied')}</p>;
  }

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {editionId ? <Pencil aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
            {editionId ? t('editShift') : t('addShift')}
          </CardTitle>
          <CardDescription>{t('overnightHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => void enregistrerShift(event)}>
            <label className="grid gap-1.5 text-sm">{t('name')}<Input required maxLength={100} value={formShift.nom} onChange={(event) => modifierChamp('nom', event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm">{t('code')}<Input required maxLength={20} pattern="[A-Za-z0-9_-]+" value={formShift.code} onChange={(event) => modifierChamp('code', event.target.value.toUpperCase())} /></label>
            <label className="grid gap-1.5 text-sm">{t('startTime')}<Input required type="time" value={formShift.heure_debut} onChange={(event) => modifierChamp('heure_debut', event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm">{t('endTime')}<Input required type="time" value={formShift.heure_fin} onChange={(event) => modifierChamp('heure_fin', event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm">{t('descriptionField')}<Input maxLength={255} value={formShift.description ?? ''} onChange={(event) => modifierChamp('description', event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm">{t('color')}<Input type="color" className="h-9 p-1" value={formShift.couleur} onChange={(event) => modifierChamp('couleur', event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm">{t('displayOrder')}<Input type="number" value={formShift.ordre_affichage} onChange={(event) => modifierChamp('ordre_affichage', Number(event.target.value))} /></label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={formShift.actif} onChange={(event) => modifierChamp('actif', event.target.checked)} />{t('active')}</label>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={creer.isPending || modifier.isPending}>{editionId ? t('save') : t('addShift')}</Button>
              {editionId !== null && <Button type="button" variant="outline" onClick={annulerEdition}>{t('cancel')}</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('configuredShifts')}</h2>
        {shiftsQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : shiftsQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>
        ) : shifts.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t('none')}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shifts.map((shift) => (
              <Card key={shift.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-1 size-4 shrink-0 rounded-full" style={{ backgroundColor: shift.couleur }} />
                    <div className="min-w-0">
                      <CardTitle>{shift.nom}</CardTitle>
                      <CardDescription>{shift.code}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={Boolean(Number(shift.actif)) ? 'outline' : 'secondary'}>{Boolean(Number(shift.actif)) ? t('active') : t('inactive')}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-lg font-medium tabular-nums">{shift.heure_debut.slice(0, 5)} – {shift.heure_fin.slice(0, 5)}</p>
                  {shift.description && <p className="text-sm text-muted-foreground">{shift.description}</p>}
                  <p className="text-sm text-muted-foreground">{t('assignedCount', { count: Number(shift.employes_assignes ?? 0) })}</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => commencerEdition(shift)}><Pencil aria-hidden="true" />{t('edit')}</Button>
                    <Button type="button" variant="destructive" size="sm" disabled={supprimer.isPending} onClick={() => void supprimerShift(shift)}><Trash2 aria-hidden="true" />{t('delete')}</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t('assignments')}</CardTitle>
          <CardDescription>{t('oneActiveShift')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(event) => void enregistrerAffectation(event)}>
            <label className="grid gap-1.5 text-sm">{t('employee')}
              <Combobox
                options={employeeOptions}
                value={employeId || undefined}
                onValueChange={setEmployeId}
                placeholder={t('selectEmployee')}
                searchPlaceholder={t('searchEmployee')}
                emptyMessage={t('noEmployeeFound')}
                className="h-9"
              />
            </label>
            <label className="grid gap-1.5 text-sm">{t('shift')}
              <Combobox
                options={activeShiftOptions}
                value={shiftId || undefined}
                onValueChange={setShiftId}
                placeholder={t('selectShift')}
                searchPlaceholder={t('searchShift')}
                emptyMessage={t('noShiftFound')}
                className="h-9"
              />
            </label>
            <label className="grid gap-1.5 text-sm">{t('startDate')}<Input required type="date" value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm">{t('endDateOptional')}<Input type="date" min={dateDebut} value={dateFin} onChange={(event) => setDateFin(event.target.value)} /></label>
            <Button type="submit" className="self-end" disabled={!employeId || !shiftId || !activeShiftOptions.length || assigner.isPending}>{t('assign')}</Button>
          </form>

          {shiftsQuery.isLoading || employesQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : shiftsQuery.isError || employesQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>
          ) : affectations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noAssignments')}</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {affectations.map((affectation) => {
                const nom = `${affectation.employe_nom ?? ''} ${affectation.employe_prenom ?? ''}`.trim();
                return (
                  <div key={affectation.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{nom}</p>
                      <p className="text-sm text-muted-foreground">
                        {affectation.shift_nom} · {affectation.heure_debut?.slice(0, 5)}–{affectation.heure_fin?.slice(0, 5)}
                      </p>
                      <p className="text-xs text-muted-foreground">{affectation.date_debut} – {affectation.date_fin ?? t('permanent')}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled={desassigner.isPending} onClick={() => void retirerAffectation(affectation.employe_id, nom)}>{t('unassign')}</Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
