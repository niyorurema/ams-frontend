'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
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
import { useCapteurs } from '@/hooks/useCapteurs';
import { api, getErrorMessage } from '@/lib/api';

type TypePointage = 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_IN' | 'BREAK_OUT';

interface EmployeVisible {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  unite_nom?: string | null;
}

function maintenantLocal(): string {
  const date = new Date();
  const corrigee = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return corrigee.toISOString().slice(0, 16);
}

/** Formulaire de pointage manuel, la validation d'autorisation restant côté API. */
export function PointageManuelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('pointages');
  const queryClient = useQueryClient();
  const [employeId, setEmployeId] = useState('');
  const [capteurId, setCapteurId] = useState('none');
  const [capteurLookupText, setCapteurLookupText] = useState('');
  const [capteurLookup, setCapteurLookup] = useState('');
  const [selectedCapteurOption, setSelectedCapteurOption] = useState<ComboboxOption | undefined>();
  const [datePointage, setDatePointage] = useState(maintenantLocal);
  const [typeEvenement, setTypeEvenement] = useState<TypePointage>('CHECK_IN');
  const [raison, setRaison] = useState('');

  const employesQuery = useQuery({
    queryKey: ['rapports', 'employes-visibles', 'pointage-manuel'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: { items: EmployeVisible[] } }>(
        '/api/rapports/employes-visibles'
      );
      return response.data.data.items;
    },
    enabled: open,
  });
  useEffect(() => {
    const timeout = window.setTimeout(() => setCapteurLookup(capteurLookupText.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [capteurLookupText]);

  const capteursQuery = useCapteurs({ search: capteurLookup || undefined, limit: 50, offset: 0 });
  const employeOptions = useMemo(() => (employesQuery.data ?? []).map((employe) => ({
    value: String(employe.id),
    label: `${employe.matricule} — ${employe.nom} ${employe.prenom}`,
    description: employe.unite_nom ?? undefined,
    keywords: `${employe.nom} ${employe.prenom} ${employe.matricule}`,
  })), [employesQuery.data]);
  const capteurOptions = useMemo(() => {
    const options: ComboboxOption[] = (capteursQuery.data?.items ?? []).map((capteur) => ({
      value: String(capteur.id),
      label: capteur.nom,
    }));
    if (selectedCapteurOption && !options.some((option) => option.value === selectedCapteurOption.value)) {
      options.unshift(selectedCapteurOption);
    }
    return options;
  }, [capteursQuery.data?.items, selectedCapteurOption]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!employeId || !datePointage) {
        throw new Error(t('manuelChampsRequis'));
      }
      const response = await api.post<{ success: boolean; data: { id: number } }>('/api/pointages', {
        employe_id: Number(employeId),
        capteur_id: capteurId === 'none' ? null : Number(capteurId),
        date_pointage: `${datePointage.replace('T', ' ')}:00`,
        type_evenement: typeEvenement,
        raison: raison.trim(),
      });
      return response.data.data;
    },
    onSuccess: async () => {
      toast.success(t('manuelCree'));
      await queryClient.invalidateQueries({ queryKey: ['pointages'] });
      setEmployeId('');
      setCapteurId('none');
      setCapteurLookupText('');
      setCapteurLookup('');
      setSelectedCapteurOption(undefined);
      setDatePointage(maintenantLocal());
      setTypeEvenement('CHECK_IN');
      setRaison('');
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const soumettre = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!mutation.isPending) onOpenChange(nextOpen); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('manuelTitre')}</DialogTitle>
          <DialogDescription>{t('manuelDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={soumettre} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pointage-manuel-employe">{t('employe')}</Label>
            <Combobox
              id="pointage-manuel-employe"
              ariaLabel={t('employe')}
              options={employeOptions}
              value={employeId}
              onValueChange={setEmployeId}
              placeholder={employesQuery.isLoading ? t('chargementEmployes') : t('selectionnerEmploye')}
              searchPlaceholder={t('rechercherEmploye')}
              emptyMessage={employesQuery.isError ? t('erreurEmployesVisibles') : t('aucunEmploye')}
              disabled={mutation.isPending || employesQuery.isLoading || employesQuery.isError}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pointage-manuel-capteur">{t('capteur')} ({t('optionnel')})</Label>
            <Combobox
              id="pointage-manuel-capteur"
              ariaLabel={t('capteur')}
              options={[{ value: 'none', label: t('aucunCapteur') }, ...capteurOptions]}
              value={capteurId}
              onValueChange={(value) => {
                setCapteurId(value);
                setSelectedCapteurOption(value === 'none'
                  ? undefined
                  : capteurOptions.find((option) => option.value === value));
              }}
              onSearch={setCapteurLookupText}
              placeholder={t('aucunCapteur')}
              searchPlaceholder={t('rechercherCapteur')}
              emptyMessage={t('aucunCapteur')}
              className="w-full"
              disabled={mutation.isPending || capteursQuery.isLoading || capteursQuery.isError}
            />
            {capteursQuery.isError && <p role="alert" className="text-sm text-destructive">{t('erreurCapteurs')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pointage-manuel-date">{t('dateHeure')}</Label>
            <Input
              id="pointage-manuel-date"
              type="datetime-local"
              value={datePointage}
              onChange={(event) => setDatePointage(event.target.value)}
              required
              disabled={mutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pointage-manuel-type">{t('type')}</Label>
            <Select value={typeEvenement} onValueChange={(value) => { if (value) setTypeEvenement(value as TypePointage); }}>
              <SelectTrigger id="pointage-manuel-type" className="w-full" disabled={mutation.isPending}><SelectValue>{t(({ CHECK_IN: 'checkIn', CHECK_OUT: 'checkOut', BREAK_IN: 'breakEnd', BREAK_OUT: 'breakStart' })[typeEvenement])}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="CHECK_IN">{t('checkIn')}</SelectItem>
                <SelectItem value="BREAK_OUT">{t('breakStart')}</SelectItem>
                <SelectItem value="BREAK_IN">{t('breakEnd')}</SelectItem>
                <SelectItem value="CHECK_OUT">{t('checkOut')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pointage-manuel-raison">{t('manuelRaison')} ({t('optionnel')})</Label>
            <Input
              id="pointage-manuel-raison"
              value={raison}
              onChange={(event) => setRaison(event.target.value)}
              maxLength={500}
              placeholder={t('manuelRaisonExemple')}
              disabled={mutation.isPending}
            />
          </div>
          {employesQuery.isError && <p role="alert" className="text-sm text-destructive">{t('erreurEmployesVisibles')}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>{t('annuler')}</Button>
            <Button type="submit" disabled={mutation.isPending || !employeId || employesQuery.isError}>
              {mutation.isPending ? t('manuelCreation') : t('manuelCreer')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
