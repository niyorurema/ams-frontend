'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Eye, Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  useApercuRapportJournalier,
  useApercusRapportsJournaliers,
} from '@/hooks/useRapports';
import { getErrorMessage } from '@/lib/api';
import { filtrerApercusRapports } from '@/lib/rapport-search.mjs';
import type {
  RapportJournalierApercuItem,
  RapportQuotidien,
} from '@/types/rapport';

function nombre(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

const typesPointage = [
  { types: ['ARRIVEE', 'CHECK_IN'], label: 'ARRIVEE' },
  { types: ['DEBUT_PAUSE', 'BREAK_OUT'], label: 'DEBUT_PAUSE' },
  { types: ['FIN_PAUSE', 'BREAK_IN'], label: 'FIN_PAUSE' },
  { types: ['DEPART', 'CHECK_OUT'], label: 'DEPART' },
] as const;

function Statistiques({ rapport }: { rapport: RapportQuotidien }) {
  const t = useTranslations('rapports');
  const stats = [
    ['stats.totalEmployes', rapport.stats.total_employes],
    ['stats.presents', rapport.stats.presents],
    ['stats.absents', rapport.stats.absents],
    ['stats.normaux', rapport.stats.normaux],
    ['stats.retards', rapport.stats.retards],
    ['stats.anormaux', rapport.stats.anormaux],
    ['stats.feries', rapport.stats.feries],
    ['stats.repos', rapport.stats.repos],
    ['stats.sansJugement', rapport.stats.sans_jugement ?? 0],
    ['stats.heuresTotales', `${rapport.stats.heures_totales} ${t('heures')}`],
    ['stats.moyenneHeures', `${rapport.stats.moyenne_heures} ${t('heures')}`],
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map(([key, value]) => (
        <Card key={key} size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t(key)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function RapportDetail({ rapport }: { rapport: RapportQuotidien }) {
  const t = useTranslations('rapports');
  const locale = useLocale();
  const alertesParEmploye = rapport.alertes.reduce<
    Array<{ employe: RapportQuotidien['details'][number] | null; alertes: string[] }>
  >((groupes, alerte) => {
    const employe = [...rapport.details]
      .sort((a, b) => `${b.nom} ${b.prenom}`.length - `${a.nom} ${a.prenom}`.length)
      .find((detail) => alerte.startsWith(`${detail.nom} ${detail.prenom} :`));
    const groupe = groupes.find((item) => item.employe === employe);

    if (groupe) {
      groupe.alertes.push(alerte);
    } else {
      groupes.push({ employe: employe ?? null, alertes: [alerte] });
    }

    return groupes;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <p><span className="font-medium">{t('date')}:</span> {rapport.date}</p>
        <p><span className="font-medium">{t('employes')}:</span> {nombre(rapport.stats.total_employes, locale)}</p>
        <p>
          <span className="font-medium">{t('stats.tauxPresence')}:</span>{' '}
          {nombre(rapport.stats.taux_presence, locale)}%
        </p>
      </div>

      <Statistiques rapport={rapport} />

      <section className="space-y-3">
        <h3 className="font-semibold">
          {t('apercu')} — {nombre(rapport.details.length, locale)} {t('employes')}
        </h3>
        {rapport.details.length === 0 ? (
          <p className="rounded-lg border py-10 text-center text-muted-foreground">{t('aucunDetail')}</p>
        ) : (
          <div className="max-h-[55vh] overflow-auto rounded-lg border">
            <Table className="min-w-[1500px] text-xs sm:text-sm">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="whitespace-normal break-words">{t('table.matricule')}</TableHead>
                  <TableHead className="whitespace-normal break-words">{t('table.nomComplet')}</TableHead>
                  <TableHead className="whitespace-normal break-words">{t('table.unite')}</TableHead>
                  <TableHead className="whitespace-normal break-words">{t('table.horaire')}</TableHead>
                  <TableHead className="whitespace-normal break-words">{t('table.pointages')}</TableHead>
                  <TableHead className="whitespace-normal break-words">{t('table.arrivee')}</TableHead>
                  <TableHead className="whitespace-normal break-words">{t('table.depart')}</TableHead>
                  <TableHead className="whitespace-normal break-words">{t('table.heures')}</TableHead>
                  <TableHead className="whitespace-normal break-words">{t('table.arriveeTardive')}</TableHead>
                  <TableHead className="whitespace-normal break-words">{t('table.departAnticipe')}</TableHead>
                  <TableHead className="whitespace-normal break-words">{t('table.statut')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rapport.details.map((detail, index) => (
                  <TableRow key={`${detail.matricule}-${index}`}>
                    <TableCell className="break-words">{detail.matricule}</TableCell>
                    <TableCell className="break-words">{`${detail.prenom} ${detail.nom}`.trim()}</TableCell>
                    <TableCell className="break-words">{detail.unite || '—'}</TableCell>
                    <TableCell className="break-words">{detail.horaire_nom || '—'}</TableCell>
                    <TableCell className="break-words">
                      <ul className="space-y-0.5">
                        {typesPointage.map(({ types, label }) => {
                          const pointage = detail.pointages.find((item) =>
                            types.some((type) => type === item.type)
                          );
                          return (
                            <li key={label} className="whitespace-nowrap">
                              <span className="font-medium">{t(`table.pointageTypes.${label}`)}:</span>{' '}
                              {pointage?.heure || '---'}
                            </li>
                          );
                        })}
                      </ul>
                    </TableCell>
                    <TableCell className="break-words">{detail.heure_arrivee ?? '—'}</TableCell>
                    <TableCell className="break-words">{detail.heure_depart ?? '—'}</TableCell>
                    <TableCell className="break-words">{detail.heures_travaillees}</TableCell>
                    <TableCell className="break-words">{detail.arrivee_tardive ?? '—'}</TableCell>
                    <TableCell className="break-words">{detail.depart_anticipe ?? '—'}</TableCell>
                    <TableCell className="break-words">
                      <Badge variant="outline" className="whitespace-normal">
                        {t(`statuts.${detail.statut.toLowerCase()}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {rapport.alertes.length > 0 && (
        <section
          aria-labelledby="rapport-alertes-title"
          className="overflow-hidden rounded-xl border border-destructive/30 bg-destructive/5"
        >
          <div className="flex items-center gap-3 border-b border-destructive/20 bg-destructive/10 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle aria-hidden="true" className="size-5" />
            </span>
            <h3 id="rapport-alertes-title" className="min-w-0 flex-1 font-semibold text-destructive">
              {t('alertes')}
            </h3>
            <Badge variant="destructive">{nombre(rapport.alertes.length, locale)}</Badge>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
            {alertesParEmploye.map((groupe, index) => (
              <article
                key={groupe.employe
                  ? `${groupe.employe.matricule}-${groupe.employe.nom}-${groupe.employe.prenom}`
                  : `generale-${index}`}
                className="min-w-0 rounded-lg border border-destructive/15 bg-background/80 p-3"
              >
                {groupe.employe && (
                  <h4 className="mb-2 break-words text-sm font-semibold">
                    {groupe.employe.prenom} {groupe.employe.nom}
                    <span className="ml-2 block text-xs font-normal text-muted-foreground">
                      {groupe.employe.matricule}
                    </span>
                  </h4>
                )}
                <ul className="space-y-1">
                  {groupe.alertes.map((alerte, alerteIndex) => (
                    <li
                      key={`${alerteIndex}-${alerte}`}
                      className="flex min-w-0 items-start gap-1.5 text-xs"
                    >
                      <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                      <span className="min-w-0 break-words">{alerte}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function RapportJournalierApercus({ enabled }: { enabled: boolean }) {
  const t = useTranslations('rapports.apercus');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const listingQuery = useApercusRapportsJournaliers(enabled);
  const [selected, setSelected] = useState<RapportJournalierApercuItem | null>(null);
  const [limit, setLimit] = useState(5);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [dateSearch, setDateSearch] = useState('');
  const detailQuery = useApercuRapportJournalier(selected);
  const data = listingQuery.data;
  const detail = detailQuery.data;
  const filteredItems = data
    ? filtrerApercusRapports(
      dateSearch ? data.items.filter((item) => item.date_rapport === dateSearch) : data.items,
      search,
      locale
    )
    : [];
  const pageItems = filteredItems.slice(offset, offset + limit);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {listingQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
            </div>
          ) : listingQuery.isError ? (
            <p className="text-sm text-destructive">{getErrorMessage(listingQuery.error)}</p>
          ) : data ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={data.configuration_active ? 'default' : 'secondary'}>
                  {data.configuration_active ? t('active') : t('inactive')}
                </Badge>
                <span>{t('reportDate')}: {data.date_rapport}</span>
                {data.heure_envoi && <span>{t('sendTime')}: {data.heure_envoi.slice(0, 5)}</span>}
                <Badge variant={data.pret_a_envoyer ? 'outline' : 'secondary'}>
                  {data.pret_a_envoyer ? t('ready') : t(`reason.${data.raison_non_envoi ?? 'DESACTIVE'}`)}
                </Badge>
              </div>
              <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
                {t('previewOnly')}
              </p>
              {data.raison_non_envoi === 'CONFIGURATION_ABSENTE' && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  {t('configurationMissing')}
                </p>
              )}
              {data.items.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">{t('empty')}</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3">
                    <div className="relative w-full sm:min-w-72 sm:flex-1">
                      <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      />
                      <Input
                        type="search"
                        value={search}
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setOffset(0);
                        }}
                        placeholder={t('searchPlaceholder')}
                        aria-label={tCommon('search')}
                        className="pl-9"
                      />
                    </div>
                    <div className="grid w-full gap-1 sm:min-w-72 sm:flex-1">
                      <label htmlFor="rapport-j1-date-search" className="text-sm font-medium">
                        {t('searchByDate')}
                      </label>
                      <Input
                        id="rapport-j1-date-search"
                        type="date"
                        value={dateSearch}
                        onChange={(event) => {
                          setDateSearch(event.target.value);
                          setOffset(0);
                        }}
                      />
                    </div>
                  </div>
                  {filteredItems.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">{t('noSearchResults')}</p>
                  ) : (
                    <>
                      <DataTablePagination
                        total={filteredItems.length}
                        limit={limit}
                        offset={offset}
                        limitOptions={[5, 10, 20, 50, 100]}
                        onLimitChange={setLimit}
                        onOffsetChange={setOffset}
                      />
                      <div className="overflow-x-auto rounded-lg border">
                        <Table className="sticky-actions min-w-[950px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('reportDate')}</TableHead>
                              <TableHead>{t('recipient')}</TableHead>
                              <TableHead>{t('role')}</TableHead>
                              <TableHead>{t('unit')}</TableHead>
                              <TableHead className="text-right">{t('content')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageItems.map((item) => (
                              <TableRow key={`${item.user_id}-${item.unite_id ?? 'global'}`}>
                                <TableCell>{item.date_rapport || '—'}</TableCell>
                                <TableCell>
                                  <span className="block font-medium">{item.nom_complet}</span>
                                  <span className="block text-xs text-muted-foreground">
                                    {item.email || t('missingEmail')}
                                  </span>
                                </TableCell>
                                <TableCell>{item.role}</TableCell>
                                <TableCell>{item.unite_nom || t('allUnits')}</TableCell>
                                <TableCell className="text-right">
                                  <Button type="button" size="sm" variant="outline" onClick={() => setSelected(item)}>
                                    <Eye aria-hidden="true" className="size-4" />
                                    {t('open')}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <DataTablePagination
                        total={filteredItems.length}
                        limit={limit}
                        offset={offset}
                        limitOptions={[5, 10, 20, 50, 100]}
                        onLimitChange={setLimit}
                        onOffsetChange={setOffset}
                      />
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="py-8 text-center text-muted-foreground">{tCommon('loading')}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent
          className="h-[96dvh] max-h-[96dvh] overflow-x-auto overflow-y-auto p-3 sm:p-6"
          style={{ width: '96vw', maxWidth: '1800px' }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">
              {detail?.contenu.titre ?? t('loadingReport')}
            </DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.destinataire.nom_complet} · ${detail.destinataire.unite_nom || t('allUnits')} · ${detail.destinataire.email || t('missingEmail')}`
                : t('previewOnly')}
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
          ) : detail ? (
            <RapportDetail rapport={detail.contenu} />
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              {t('loadingReport')}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
