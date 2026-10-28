'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertCircle,
  Ellipsis,
  Fingerprint,
  Pencil,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { getErrorMessage } from '@/lib/api';
import type { Capteur } from '@/types/capteur';
import {
  useCapteurs,
  useSyncCapteur,
  useUpdateCapteur,
  type CapteurSyncType,
  type CapteurUpdate,
} from '@/hooks/useCapteurs';

interface ContextMenuState {
  capteur: Capteur;
  x: number;
  y: number;
}

const localeTags: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  rn: 'rn-BI',
};

/** Liste responsive des capteurs avec sélection et actions contextuelles. */
export default function CapteursPage() {
  const t = useTranslations('capteurs');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const { data, error, isFetching, isLoading, refetch } = useCapteurs({ limit, offset });
  const syncMutation = useSyncCapteur();
  const updateMutation = useUpdateCapteur();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [syncingIds, setSyncingIds] = useState<number[]>([]);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingCapteur, setEditingCapteur] = useState<Capteur | null>(null);
  const [editForm, setEditForm] = useState<CapteurUpdate | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const capteurs = data?.items ?? [];

  useEffect(() => {
    if (!contextMenu) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
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

  const toggleSelected = (capteurId: number, checked: boolean) => {
    setSelectedIds((current) =>
      checked
        ? current.includes(capteurId)
          ? current
          : [...current, capteurId]
        : current.filter((id) => id !== capteurId)
    );
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? capteurs.map((capteur) => capteur.id) : []);
  };

  const openContextMenu = (event: React.MouseEvent<HTMLTableRowElement>, capteur: Capteur) => {
    event.preventDefault();
    setSelectedIds((current) =>
      current.includes(capteur.id) ? current : [capteur.id]
    );
    setContextMenu({
      capteur,
      x: Math.min(event.clientX, window.innerWidth - 230),
      y: Math.min(event.clientY, window.innerHeight - 190),
    });
  };

  const openEditor = (capteur: Capteur) => {
    setContextMenu(null);
    setEditingCapteur(capteur);
    setEditForm({
      nom: capteur.nom,
      adresse_ip: capteur.adresse_ip,
      port: capteur.port,
      type_reseau: capteur.type_reseau,
      statut: capteur.statut,
    });
  };

  const syncCapteur = async (capteurId: number, type: CapteurSyncType) => {
    setContextMenu(null);
    setSyncingIds((current) => [...new Set([...current, capteurId])]);

    try {
      await syncMutation.mutateAsync({ capteurId, type });
      toast.success(t('synchronisationReussie'));
    } catch (syncError) {
      toast.error(getErrorMessage(syncError));
    } finally {
      setSyncingIds((current) => current.filter((id) => id !== capteurId));
    }
  };

  const syncSelected = async () => {
    setIsBulkSyncing(true);

    try {
      for (const capteurId of selectedIds) {
        await syncMutation.mutateAsync({ capteurId, type: 'assignments' });
      }
      toast.success(t('synchronisationReussie'));
      setSelectedIds([]);
    } catch (syncError) {
      toast.error(getErrorMessage(syncError));
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const saveCapteur = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCapteur || !editForm) return;

    try {
      await updateMutation.mutateAsync({
        capteurId: editingCapteur.id,
        data: editForm,
      });
      toast.success(t('miseAJourReussie'));
      setEditingCapteur(null);
      setEditForm(null);
    } catch (updateError) {
      toast.error(getErrorMessage(updateError));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="size-9" />
        </div>
        <Card>
          <CardContent className="space-y-4 p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
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
            <RefreshCw aria-hidden="true" className="size-4" />
            {tCommon('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const allSelected = capteurs.length > 0 && capteurs.every((capteur) => selectedIds.includes(capteur.id));
  const localeTag = localeTags[locale] ?? locale;

  return (
    <div className="space-y-5" onClick={() => setContextMenu(null)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? capteurs.length} · {t('title')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={tCommon('refresh')}
          title={tCommon('refresh')}
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw aria-hidden="true" className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
        </Button>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">
            {selectedIds.length} {t('selectionnes')}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => void syncSelected()}
            disabled={isBulkSyncing}
          >
            <RefreshCw aria-hidden="true" className={isBulkSyncing ? 'size-4 animate-spin' : 'size-4'} />
            {t('synchroniserAffectations')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            {tCommon('cancel')}
          </Button>
        </div>
      )}

      {capteurs.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
            <Fingerprint aria-hidden="true" className="size-8 text-muted-foreground" />
            <p className="font-medium">{t('aucunCapteur')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <DataTablePagination
            total={data?.total ?? 0}
            limit={limit}
            offset={offset}
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
          <div className="overflow-hidden rounded-md border bg-card">
            <Table className="sticky-actions">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label={t('selectionnerTout')}
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                  />
                </TableHead>
                <TableHead>{t('nom')}</TableHead>
                <TableHead>{t('adresseIp')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('typeReseau')}</TableHead>
                <TableHead>{t('statut')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('derniereSync')}</TableHead>
                <TableHead className="w-12 text-right">{tCommon('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {capteurs.map((capteur) => (
                <TableRow
                  key={capteur.id}
                  data-state={selectedIds.includes(capteur.id) ? 'selected' : undefined}
                  onContextMenu={(event) => openContextMenu(event, capteur)}
                >
                  <TableCell>
                    <Checkbox
                      aria-label={`${t('selectionner')}: ${capteur.nom}`}
                      checked={selectedIds.includes(capteur.id)}
                      onCheckedChange={(checked) => toggleSelected(capteur.id, checked === true)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-36 items-center gap-2">
                      <Fingerprint aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{capteur.nom}</p>
                        {capteur.numero_serie && (
                          <p className="truncate text-xs text-muted-foreground">{capteur.numero_serie}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs sm:text-sm">
                    {capteur.adresse_ip}:{capteur.port}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-mono text-xs">
                    {capteur.type_reseau}
                  </TableCell>
                  <TableCell>
                    <CapteurStatus capteur={capteur} t={t} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {formatLastSync(capteur, localeTag, t('aucuneSync'))}
                  </TableCell>
                  <TableCell className="text-right">
                    <CapteurActionsMenu
                      capteur={capteur}
                      busy={syncingIds.includes(capteur.id)}
                      actionsLabel={tCommon('actions')}
                      onEdit={openEditor}
                      onSync={(type) => void syncCapteur(capteur.id, type)}
                      t={t}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </div>
          <DataTablePagination
            total={data?.total ?? 0}
            limit={limit}
            offset={offset}
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

      {contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          aria-label={`${tCommon('actions')}: ${contextMenu.capteur.nom}`}
          className="fixed z-50 min-w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <ContextAction
            icon={<RefreshCw aria-hidden="true" />}
            label={t('synchroniserEmployes')}
            onSelect={() => void syncCapteur(contextMenu.capteur.id, 'users')}
          />
          <ContextAction
            icon={<RefreshCw aria-hidden="true" />}
            label={t('synchroniserPointages')}
            onSelect={() => void syncCapteur(contextMenu.capteur.id, 'attendance')}
          />
          <ContextAction
            icon={<RefreshCw aria-hidden="true" />}
            label={t('synchroniserAffectations')}
            onSelect={() => void syncCapteur(contextMenu.capteur.id, 'assignments')}
          />
          <div className="my-1 h-px bg-border" />
          <ContextAction
            icon={<Pencil aria-hidden="true" />}
            label={t('modifier')}
            onSelect={() => openEditor(contextMenu.capteur)}
          />
        </div>
      )}

      <Dialog
        open={editingCapteur !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCapteur(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('modifier')}</DialogTitle>
            <DialogDescription>{editingCapteur?.nom}</DialogDescription>
          </DialogHeader>
          {editForm && (
            <form onSubmit={saveCapteur} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="capteur-nom">{t('nom')}</Label>
                <Input
                  id="capteur-nom"
                  value={editForm.nom}
                  onChange={(event) => setEditForm({ ...editForm, nom: event.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <div className="space-y-2">
                  <Label htmlFor="capteur-ip">{t('adresseIp')}</Label>
                  <Input
                    id="capteur-ip"
                    value={editForm.adresse_ip}
                    onChange={(event) => setEditForm({ ...editForm, adresse_ip: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capteur-port">{t('port')}</Label>
                  <Input
                    id="capteur-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={editForm.port}
                    onChange={(event) => setEditForm({ ...editForm, port: Number(event.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="capteur-reseau">{t('typeReseau')}</Label>
                  <Select
                    value={editForm.type_reseau}
                    onValueChange={(value) => {
                      if (value === 'LAN' || value === 'NETBIRD') {
                        setEditForm({ ...editForm, type_reseau: value });
                      }
                    }}
                  >
                    <SelectTrigger id="capteur-reseau" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LAN">LAN</SelectItem>
                      <SelectItem value="NETBIRD">NETBIRD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capteur-statut">{t('statut')}</Label>
                  <Select
                    value={editForm.statut}
                    onValueChange={(value) => {
                      if (value === 'ACTIF' || value === 'INACTIF' || value === 'HORS_LIGNE') {
                        setEditForm({ ...editForm, statut: value });
                      }
                    }}
                  >
                    <SelectTrigger id="capteur-statut" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIF">{t('actif')}</SelectItem>
                      <SelectItem value="INACTIF">{t('inactif')}</SelectItem>
                      <SelectItem value="HORS_LIGNE">{t('horsLigne')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingCapteur(null);
                    setEditForm(null);
                  }}
                >
                  {tCommon('cancel')}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <RefreshCw aria-hidden="true" className="size-4 animate-spin" />}
                  {tCommon('save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CapteurStatus({
  capteur,
  t,
}: {
  capteur: Capteur;
  t: ReturnType<typeof useTranslations<'capteurs'>>;
}) {
  const isActive = capteur.statut === 'ACTIF';
  const isOffline = capteur.statut === 'HORS_LIGNE';
  const Icon = isActive ? Wifi : isOffline ? WifiOff : AlertCircle;
  const label = isActive
    ? t('actif')
    : isOffline
      ? t('horsLigne')
      : t('inactif');

  return (
    <Badge
      variant="outline"
      className={
        isActive
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
          : isOffline
            ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300'
            : 'text-muted-foreground'
      }
    >
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}

function CapteurActionsMenu({
  capteur,
  busy,
  actionsLabel,
  onEdit,
  onSync,
  t,
}: {
  capteur: Capteur;
  busy: boolean;
  actionsLabel: string;
  onEdit: (capteur: Capteur) => void;
  onSync: (type: CapteurSyncType) => void;
  t: ReturnType<typeof useTranslations<'capteurs'>>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${actionsLabel}: ${capteur.nom}`}
            title={actionsLabel}
          >
            <Ellipsis aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled={busy} onClick={() => onSync('users')}>
          <RefreshCw aria-hidden="true" />
          {t('synchroniserEmployes')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onClick={() => onSync('attendance')}>
          <RefreshCw aria-hidden="true" />
          {t('synchroniserPointages')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onClick={() => onSync('assignments')}>
          <RefreshCw aria-hidden="true" />
          {t('synchroniserAffectations')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(capteur)}>
          <Pencil aria-hidden="true" />
          {t('modifier')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ContextAction({
  icon,
  label,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="flex min-h-9 w-full items-center gap-2 rounded-sm px-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
    >
      {icon}
      {label}
    </button>
  );
}

function formatLastSync(capteur: Capteur, locale: string, fallback: string) {
  const dates = [
    capteur.derniere_sync_users,
    capteur.derniere_sync_attendance,
    capteur.dernier_scan,
  ]
    .filter((date): date is string => Boolean(date))
    .sort((left, right) => Date.parse(right) - Date.parse(left));
  const timestamp = dates[0] ? Date.parse(dates[0]) : Number.NaN;

  if (!Number.isFinite(timestamp)) return fallback;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(timestamp);
}