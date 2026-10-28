'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import { Eye, Loader2 } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { RapportDetail } from '@/components/rapports/rapport-journalier-apercus';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRapportHistoriqueDetail, useRapportsHistorique } from '@/hooks/useRapports';
import { getErrorMessage } from '@/lib/api';
import type { RapportHistoriqueItem } from '@/types/rapport';

function formatDateTime(value: string, locale: string): string {
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return format(date, 'Pp', { locale: locale === 'fr' ? fr : enGB });
}

export function RapportHistorique() {
  const t = useTranslations('rapports.historique');
  const locale = useLocale();
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const historyPageQuery = useRapportsHistorique(true, limit, offset);
  const [selected, setSelected] = useState<RapportHistoriqueItem | null>(null);
  const detailQuery = useRapportHistoriqueDetail(selected?.id ?? null);
  const items = historyPageQuery.data?.items ?? [];
  const detail = detailQuery.data;

  return (
    <>
      <Card>
        <CardContent className="pt-4">
          {historyPageQuery.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : historyPageQuery.isError ? (
            <p className="py-8 text-center text-destructive">{getErrorMessage(historyPageQuery.error)}</p>
          ) : items.length === 0 && offset === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="sticky-actions">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reportDate')}</TableHead>
                    <TableHead>{t('recipient')}</TableHead>
                    <TableHead>{t('sentAt')}</TableHead>
                    <TableHead>{t('format')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('content')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.date_rapport}</TableCell>
                      <TableCell>
                        <span className="block font-medium">{item.destinataire_nom || item.destinataire_email}</span>
                        {item.destinataire_nom && <span className="block text-xs text-muted-foreground">{item.destinataire_email}</span>}
                      </TableCell>
                      <TableCell>{formatDateTime(item.heure_envoi, locale)}</TableCell>
                      <TableCell>{item.format}</TableCell>
                      <TableCell>
                        <Badge variant={item.statut === 'ENVOYE' ? 'default' : 'destructive'}>
                          {t(`statusValues.${item.statut.toLowerCase()}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!item.contenu_disponible}
                          onClick={() => setSelected(item)}
                        >
                          <Eye aria-hidden="true" className="size-4" />
                          {t('open')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <DataTablePagination
                total={historyPageQuery.data?.total ?? 0}
                limit={limit}
                offset={offset}
                onLimitChange={(newLimit) => {
                  setLimit(newLimit);
                  setOffset(0);
                }}
                onOffsetChange={setOffset}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent
          className="h-[96dvh] max-h-[96dvh] overflow-x-auto overflow-y-auto p-3 sm:p-6"
          style={{ width: '96vw', maxWidth: '1800px' }}
        >
          <DialogHeader>
            <DialogTitle>{detail?.contenu?.titre ?? t('content')}</DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.envoi.destinataire_nom || detail.envoi.destinataire_email} · ${detail.envoi.destinataire_email}`
                : t('loading')}
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-[45vh] w-full" />
            </div>
          ) : detailQuery.isError ? (
            <p className="text-sm text-destructive">{getErrorMessage(detailQuery.error)}</p>
          ) : detail?.contenu ? (
            <RapportDetail rapport={detail.contenu} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('unavailable')}</p>
          )}
          {detailQuery.isFetching && <Loader2 aria-label={t('loading')} className="size-4 animate-spin" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
