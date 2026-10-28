'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertCircle, Clock3 } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface PresenceJour {
  statut_global?: string;
  heures_travaillees?: number | string | null;
  heures_supplementaires?: number | string | null;
  heure_arrivee?: string | null;
  statut_arrivee?: string | null;
  heure_debut_pause?: string | null;
  statut_debut_pause?: string | null;
  heure_fin_pause?: string | null;
  statut_fin_pause?: string | null;
  heure_depart?: string | null;
  statut_depart?: string | null;
  jour_ferie_nom?: string | null;
}

interface PlageHoraire {
  type?: string;
  debut?: string;
  fin?: string;
}

interface HoraireEmploye {
  nom?: string;
  description?: string | null;
  heures_travail_normales?: number | string;
  plages_horaires?: PlageHoraire[];
}

function dateLocaleAujourdhui(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function heure(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '—';
}

export function PresenceHoraireEmploye({ employeId }: { employeId: number }) {
  const t = useTranslations('employes');
  const [date, setDate] = useState(dateLocaleAujourdhui);
  const presenceQuery = useQuery({
    queryKey: ['employes', employeId, 'presence', date],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: PresenceJour }>(
        `/api/employes/${employeId}/presence?date=${date}`
      );
      return response.data.data;
    },
    enabled: employeId > 0 && Boolean(date),
  });
  const horaireQuery = useQuery({
    queryKey: ['employes', employeId, 'horaire', date],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: HoraireEmploye }>(
        `/api/employes/${employeId}/horaire?date=${date}`
      );
      return response.data.data;
    },
    enabled: employeId > 0 && Boolean(date),
    retry: false,
  });
  const presence = presenceQuery.data;
  const horaire = horaireQuery.data;
  const slots = [
    ['heure_arrivee', 'statut_arrivee', t('presence.arrivee')],
    ['heure_debut_pause', 'statut_debut_pause', t('presence.debutPause')],
    ['heure_fin_pause', 'statut_fin_pause', t('presence.finPause')],
    ['heure_depart', 'statut_depart', t('presence.depart')],
  ] as const;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t('presence.titre')}</h3>
          <p className="text-sm text-muted-foreground">{t('presence.description')}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`presence-date-${employeId}`}>{t('presence.date')}</Label>
          <Input id={`presence-date-${employeId}`} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>

      {presenceQuery.isLoading ? (
        <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-16 w-full" /></div>
      ) : presenceQuery.isError ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle aria-hidden="true" className="size-4" />{getErrorMessage(presenceQuery.error)}
        </p>
      ) : presence ? (
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{t('presence.statutGlobal')}</span>
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold">{presence.statut_global ?? '—'}</span>
          </div>
          {presence.jour_ferie_nom && <p className="text-sm text-muted-foreground">{t('presence.jourFerie')}: {presence.jour_ferie_nom}</p>}
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {slots.map(([timeKey, statusKey, label]) => (
              <div key={timeKey}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">
                  {heure(presence[timeKey])}
                  {presence[statusKey] ? ` · ${presence[statusKey]}` : ''}
                </dd>
              </div>
            ))}
            <div><dt className="text-muted-foreground">{t('presence.heuresTravaillees')}</dt><dd className="font-medium">{presence.heures_travaillees ?? '—'}</dd></div>
            <div><dt className="text-muted-foreground">{t('presence.heuresSupplementaires')}</dt><dd className="font-medium">{presence.heures_supplementaires ?? '—'}</dd></div>
          </dl>
        </div>
      ) : null}

      <div className="rounded-md border p-3">
        <h4 className="mb-2 flex items-center gap-2 font-semibold">
          <Clock3 aria-hidden="true" className="size-4" />{t('presence.horaire')}
        </h4>
        {horaireQuery.isLoading ? <Skeleton className="h-10 w-full" /> : horaireQuery.isError ? (
          <p className="text-sm text-muted-foreground">{getErrorMessage(horaireQuery.error)}</p>
        ) : horaire ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">{horaire.nom ?? '—'}</p>
            {horaire.description && <p className="text-muted-foreground">{horaire.description}</p>}
            <p>{t('presence.heuresNormales')}: {horaire.heures_travail_normales ?? '—'}</p>
            {horaire.plages_horaires?.length ? (
              <ul className="space-y-1">
                {horaire.plages_horaires.map((plage, index) => (
                  <li key={`${plage.type ?? 'plage'}-${index}`} className="text-muted-foreground">
                    {plage.type ?? t('presence.plage')} : {heure(plage.debut)}–{heure(plage.fin)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
