'use client';

import { useMutation } from '@tanstack/react-query';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api, getErrorMessage } from '@/lib/api';
import type { Pointage } from '@/types/pointage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RecalculResult {
  pointage_avant: { type_evenement: Pointage['type_evenement']; statut_calcul: Pointage['statut_calcul'] };
  pointage_apres: { type_evenement: Pointage['type_evenement']; statut_calcul: Pointage['statut_calcul'] };
  contexte: {
    date: string;
    nb_pointages_jour: number;
    position: number;
    horaire: string;
    plages: unknown[];
  };
}

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

/** Dialogue de recalcul consultatif; aucune donnée de pointage n'est modifiée. */
export function RecalculerDialog({
  pointage,
  onOpenChange,
}: {
  pointage: Pointage | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('pointages');
  const mutation = useMutation({
    mutationFn: async () => {
      if (!pointage) throw new Error('Aucun pointage sélectionné.');
      const response = await api.post<{ success: boolean; data: RecalculResult }>(
        `/api/pointages/${pointage.id}/recalculer`
      );
      return response.data.data;
    },
  });

  const close = (open: boolean) => {
    if (!open) mutation.reset();
    onOpenChange(open);
  };

  return (
    <Dialog open={pointage !== null} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('recalculTitle', { id: pointage?.id ?? '' })}</DialogTitle>
          <DialogDescription>{t('recalculDescription')}</DialogDescription>
        </DialogHeader>
        <Button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!pointage || mutation.isPending}
        >
          {mutation.isPending
            ? <LoaderCircle aria-hidden="true" className="animate-spin" />
            : <RefreshCw aria-hidden="true" />}
          {mutation.isPending ? t('recalculLoading') : t('recalculButton')}
        </Button>

        {mutation.error && (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(mutation.error)}
          </p>
        )}

        {mutation.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {([
                ['recalculBefore', mutation.data.pointage_avant],
                ['recalculAfter', mutation.data.pointage_apres],
              ] as const).map(([label, result]) => (
                <div key={label} className="space-y-2">
                  <h3 className="text-sm font-medium">{t(label)}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{t(typeTranslationKeys[result.type_evenement])}</Badge>
                    <Badge variant="secondary">{t(statusTranslationKeys[result.statut_calcul])}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <Card>
              <CardContent className="space-y-2 pt-4 text-sm">
                <h3 className="font-medium">{t('recalculContext')}</h3>
                <p>{t('recalculContextSummary', {
                  date: mutation.data.contexte.date,
                  position: mutation.data.contexte.position,
                  count: mutation.data.contexte.nb_pointages_jour,
                  schedule: mutation.data.contexte.horaire,
                })}</p>
                <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(mutation.data.contexte.plages, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
