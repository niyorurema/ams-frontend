'use client';

import { format, parseISO } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import { Wifi, WifiOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtimePointages } from '@/hooks/useRealtime';

const typeTranslationKeys = {
  CHECK_IN: 'checkIn',
  CHECK_OUT: 'checkOut',
  BREAK_IN: 'breakEnd',
  BREAK_OUT: 'breakStart',
  UNKNOWN: 'inconnu',
} as const;

const statusTranslationKeys = {
  VALIDE: 'valide',
  RETARD: 'retard',
  ANORMAL: 'anormal',
  UNKNOWN: 'statutInconnu',
} as const;

/** Affiche les derniers pointages reçus par le flux SSE du tenant courant. */
export function PointagesRealtime() {
  const t = useTranslations('pointages');
  const locale = useLocale();
  const { events, connected } = useRealtimePointages();
  const dateLocale = locale === 'fr' ? fr : enGB;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t('realtimeTitle')}</CardTitle>
        <Badge variant={connected ? 'default' : 'destructive'} className="gap-1">
          {connected ? <Wifi aria-hidden="true" className="size-3" /> : <WifiOff aria-hidden="true" className="size-3" />}
          {connected ? t('realtimeConnected') : t('realtimeDisconnected')}
        </Badge>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('realtimeEmpty')}</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {events.slice(0, 8).map((event) => {
              const date = parseISO(event.data.date_pointage.replace(' ', 'T'));
              const dateValide = !Number.isNaN(date.getTime()) && date.getFullYear() >= 2001;
              const employeeLabel = event.data.employe_nom?.trim()
                || (event.data.employe_matricule
                  ? t('realtimeMatricule', { matricule: event.data.employe_matricule })
                  : event.data.badge_id
                    ? t('realtimeBadge', { badge: event.data.badge_id })
                    : t('nonIdentifie'));
              return (
                <div key={`${event.data.id}-${event.timestamp}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{employeeLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateValide ? format(date, 'dd/MM/yyyy HH:mm:ss', { locale: dateLocale }) : t('realtimeDateInvalide')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{t(typeTranslationKeys[event.data.type_evenement])}</Badge>
                    <Badge variant="secondary">{t(statusTranslationKeys[event.data.statut_calcul])}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
