'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
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
  const capteursQuery = useCapteurs({ limit: 1000, offset: 0 });
  const employeOptions = useMemo(() => (employesQuery.data ?? []).map((employe) => ({
    value: String(employe.id),
    label: `${employe.matricule} — ${employe.nom} ${employe.prenom}`,
    description: employe.unite_nom ?? undefined,
    keywords: `${employe.nom} ${employe.prenom} ${employe.matricule}`,
  })), [employesQuery.data]);
  const capteurOptions = useMemo(() => (capteursQuery.data?.items ?? []).map((capteur) => ({
    value: String(capteur.id),
    label: capteur.nom,
  })), [capteursQuery.data?.items]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('manuelTitre')}</DialogTitle>
          <DialogDescription>{t('manuelDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={soumettre} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('employe')}</Label>
            <Combobox
              options={employeOptions}
              value={employeId}
              onValueChange={setEmployeId}
              placeholder={employesQuery.isLoading ? t('chargementEmployes') : t('selectionnerEmploye')}
              searchPlaceholder={t('rechercherEmploye')}
              emptyMessage={employesQuery.isError ? t('erreurEmployesVisibles') : t('aucunEmploye')}
              disabled={employesQuery.isLoading || employesQuery.isError}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('capteur')} ({t('optionnel')})</Label>
            <Combobox
              options={[{ value: 'none', label: t('aucunCapteur') }, ...capteurOptions]}
              value={capteurId}
              onValueChange={setCapteurId}
              placeholder={t('aucunCapteur')}
              searchPlaceholder={t('rechercherCapteur')}
              emptyMessage={t('aucunCapteur')}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pointage-manuel-date">{t('dateHeure')}</Label>
            <Input
              id="pointage-manuel-date"
              type="datetime-local"
              value={datePointage}
              onChange={(event) => setDatePointage(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('type')}</Label>
            <Select value={typeEvenement} onValueChange={(value) => { if (value) setTypeEvenement(value as TypePointage); }}>
              <SelectTrigger className="w-full"><SelectValue>{t(({ CHECK_IN: 'checkIn', CHECK_OUT: 'checkOut', BREAK_IN: 'breakEnd', BREAK_OUT: 'breakStart' })[typeEvenement])}</SelectValue></SelectTrigger>
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
            />
          </div>
          {employesQuery.isError && <p role="alert" className="text-sm text-destructive">{t('erreurEmployesVisibles')}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('annuler')}</Button>
            <Button type="submit" disabled={mutation.isPending || !employeId || employesQuery.isError}>
              {mutation.isPending ? t('manuelCreation') : t('manuelCreer')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
