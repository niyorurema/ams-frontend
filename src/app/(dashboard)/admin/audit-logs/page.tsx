'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Download, Eye, Loader2, RotateCcw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { useAuditLogs, type AuditLogFilters } from '@/hooks/useAuditLogs';
import { getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useHydrated } from '@/hooks/useHydrated';
import type { AuditLogEntry } from '@/hooks/useAuditLogs';

interface FilterForm {
  tenant_id: string;
  actor_id: string;
  action: string;
  object_type: string;
  object_id: string;
  device_id: string;
  request_id: string;
  date_debut: string;
  date_fin: string;
}

const emptyForm: FilterForm = {
  tenant_id: '',
  actor_id: '',
  action: '',
  object_type: '',
  object_id: '',
  device_id: '',
  request_id: '',
  date_debut: '',
  date_fin: '',
};

function positiveInt(value: string): number | undefined {
  if (!/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
}

function renderSnapshot(value: Record<string, unknown> | null, emptyLabel: string): string {
  return value ? JSON.stringify(value, null, 2) : emptyLabel;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

export default function AuditLogsPage() {
  const t = useTranslations('admin.auditLogs');
  const locale = useLocale();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useHydrated();
  const isAllowed = Boolean(user?.is_super_admin || user?.role === 'admin');
  const [form, setForm] = useState<FilterForm>(emptyForm);
  const [applied, setApplied] = useState<FilterForm>(emptyForm);
  const [limit, setLimit] = useState(5);
  const [offset, setOffset] = useState(0);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    if (hydrated && user && !isAllowed) router.replace('/dashboard');
  }, [hydrated, isAllowed, router, user]);

  const filters = useMemo<AuditLogFilters>(() => ({
    tenant_id: user?.is_super_admin ? positiveInt(applied.tenant_id) : undefined,
    actor_id: positiveInt(applied.actor_id),
    action: applied.action || undefined,
    object_type: applied.object_type.trim() || undefined,
    object_id: applied.object_id.trim() || undefined,
    device_id: positiveInt(applied.device_id),
    request_id: applied.request_id.trim() || undefined,
    date_debut: applied.date_debut || undefined,
    date_fin: applied.date_fin || undefined,
    limit,
    offset,
  }), [applied, limit, offset, user?.is_super_admin]);
  const query = useAuditLogs(filters, hydrated && isAllowed);
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilterError(null);
    for (const field of ['tenant_id', 'actor_id', 'device_id'] as const) {
      if (form[field] && positiveInt(form[field]) === undefined) {
        setFilterError(t('invalidId'));
        return;
      }
    }
    if (form.request_id && !/^[a-f0-9]{32}$/i.test(form.request_id.trim())) {
      setFilterError(t('invalidRequestId'));
      return;
    }
    if (form.date_debut && form.date_fin && form.date_debut > form.date_fin) {
      setFilterError(t('invalidDates'));
      return;
    }
    setApplied({ ...form });
    setOffset(0);
  };

  const resetFilters = () => {
    setForm(emptyForm);
    setApplied(emptyForm);
    setFilterError(null);
    setOffset(0);
  };

  if (!hydrated || !user || !isAllowed) {
    return (
      <div className="flex min-h-64 items-center justify-center" aria-label={t('loading')}>
        <Loader2 aria-hidden="true" className="size-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const entries = query.data?.items ?? [];
  const sourceLabel = (source: string) => {
    if (source === 'API') return t('sources.API');
    if (source === 'DEVICE') return t('sources.DEVICE');
    return t('sources.SYSTEM');
  };

  const objectLabel = (entry: AuditLogEntry) => (
    entry.object_type === 'tenants' ? t('tenantObjectLabel') : entry.object_type
  );
  const tenantLabel = (entry: AuditLogEntry) => (
    entry.tenant_name || (entry.tenant_id === null ? '—' : `#${entry.tenant_id}`)
  );

  const downloadPdf = (entry: AuditLogEntry) => {
    setPdfError(null);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setPdfError(t('pdfPopupBlocked'));
      return;
    }

    const details: Array<[string, string]> = [
      [t('occurredAt'), formatDate(entry.occurred_at, locale)],
      [t('actor'), entry.actor_name || (entry.actor_id ? `#${entry.actor_id}` : t('systemActor'))],
      [t('action'), t(`actions.${entry.action}`)],
      [t('object'), `${objectLabel(entry)}${entry.object_id ? ` · #${entry.object_id}` : ''}`],
      [t('source'), sourceLabel(entry.source)],
      [t('tenantName'), tenantLabel(entry)],
      [t('deviceId'), entry.device_id ? `#${entry.device_id}` : '—'],
      ['IP', entry.ip_address || '—'],
      [t('requestId'), entry.request_id || '—'],
      [t('browser'), entry.user_agent || '—'],
    ];
    const detailRows = details.map(([label, value]) => (
      `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
    )).join('');
    const before = escapeHtml(renderSnapshot(entry.before_values, t('notAvailable')));
    const after = escapeHtml(renderSnapshot(entry.after_values, t('notAvailable')));

    printWindow.document.write(`<!doctype html>
      <html lang="${escapeHtml(locale)}">
        <head>
          <meta charset="utf-8">
          <title>${escapeHtml(t('eventDetails'))} #${entry.id}</title>
          <style>
            body { color: #111827; font: 14px Arial, sans-serif; margin: 32px; }
            h1 { font-size: 20px; margin: 0 0 20px; }
            h2 { font-size: 16px; margin: 24px 0 8px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; width: 25%; }
            pre { background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; font: 11px/1.5 Consolas, monospace; overflow-wrap: anywhere; padding: 12px; white-space: pre-wrap; }
            @media print { body { margin: 16mm; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(t('eventDetails'))} #${entry.id}</h1>
          <table><tbody>${detailRows}</tbody></table>
          <h2>${escapeHtml(t('before'))}</h2><pre>${before}</pre>
          <h2>${escapeHtml(t('after'))}</h2><pre>${after}</pre>
        </body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => printWindow.print(), 250);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('filtersTitle')}</CardTitle>
          <CardDescription>{t('filtersDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={applyFilters} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {user.is_super_admin && (
                <div className="space-y-2">
                  <Label htmlFor="audit-tenant">{t('tenantId')}</Label>
                  <Input id="audit-tenant" inputMode="numeric" value={form.tenant_id} onChange={(event) => setForm({ ...form, tenant_id: event.target.value })} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="audit-actor">{t('actorId')}</Label>
                <Input id="audit-actor" inputMode="numeric" value={form.actor_id} onChange={(event) => setForm({ ...form, actor_id: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit-action">{t('action')}</Label>
                <NativeSelect id="audit-action" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.action} onChange={(event) => setForm({ ...form, action: event.target.value })}>
                  <option value="">{t('allActions')}</option>
                  <option value="INSERT">{t('actions.INSERT')}</option>
                  <option value="UPDATE">{t('actions.UPDATE')}</option>
                  <option value="DELETE">{t('actions.DELETE')}</option>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit-object-type">{t('objectType')}</Label>
                <Input id="audit-object-type" maxLength={128} value={form.object_type} onChange={(event) => setForm({ ...form, object_type: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit-object-id">{t('objectId')}</Label>
                <Input id="audit-object-id" maxLength={512} value={form.object_id} onChange={(event) => setForm({ ...form, object_id: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit-device">{t('deviceId')}</Label>
                <Input id="audit-device" inputMode="numeric" value={form.device_id} onChange={(event) => setForm({ ...form, device_id: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit-request">{t('requestId')}</Label>
                <Input id="audit-request" maxLength={32} value={form.request_id} onChange={(event) => setForm({ ...form, request_id: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit-date-start">{t('dateStart')}</Label>
                <Input id="audit-date-start" type="date" value={form.date_debut} onChange={(event) => setForm({ ...form, date_debut: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit-date-end">{t('dateEnd')}</Label>
                <Input id="audit-date-end" type="date" value={form.date_fin} onChange={(event) => setForm({ ...form, date_fin: event.target.value })} />
              </div>
            </div>
            {filterError && <p role="alert" className="text-sm text-destructive">{filterError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm">
                <Search aria-hidden="true" className="size-4" />
                {t('applyFilters')}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
                <RotateCcw aria-hidden="true" className="size-4" />
                {t('resetFilters')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t('eventsTitle')}</CardTitle>
            <CardDescription>
              {query.data ? t('eventsCount', { count: numberFormat.format(query.data.pagination.total) }) : t('eventsDescription')}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {query.data && (
              <DataTablePagination
                total={query.data.pagination.total}
                limit={limit}
                offset={offset}
                onLimitChange={setLimit}
                onOffsetChange={setOffset}
                limitOptions={[5, 10, 25, 50, 100]}
                showTotal={false}
              />
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <RotateCcw aria-hidden="true" className="size-4" />}
              {t('refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              {t('loading')}
            </div>
          ) : query.isError ? (
            <div role="alert" className="space-y-3 py-6 text-center">
              <p className="text-sm text-destructive">{getErrorMessage(query.error)}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>{t('retry')}</Button>
            </div>
          ) : entries.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t('noResults')}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('occurredAt')}</TableHead>
                    <TableHead>{t('actor')}</TableHead>
                    <TableHead>{t('action')}</TableHead>
                    <TableHead>{t('object')}</TableHead>
                    <TableHead>{t('source')}</TableHead>
                    <TableHead>{t('deviceId')}</TableHead>
                    <TableHead>{t('details')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.occurred_at, locale)}</TableCell>
                      <TableCell>{entry.actor_name || (entry.actor_id ? `#${entry.actor_id}` : t('systemActor'))}</TableCell>
                      <TableCell>
                        <Badge variant={entry.action === 'DELETE' ? 'destructive' : entry.action === 'UPDATE' ? 'secondary' : 'default'}>
                          {t(`actions.${entry.action}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{objectLabel(entry)}</span>
                        {entry.object_id ? <span className="text-muted-foreground"> · #{entry.object_id}</span> : null}
                      </TableCell>
                      <TableCell>{sourceLabel(entry.source)}</TableCell>
                      <TableCell>{entry.device_id ? `#${entry.device_id}` : '—'}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <details className="max-w-xs">
                            <summary className="cursor-pointer text-sm font-medium text-primary">{t('viewChanges')}</summary>
                            <div className="mt-3 min-w-64 space-y-3">
                              <p className="break-all text-xs text-muted-foreground">
                                {t('tenantId')}: {entry.tenant_id ?? '—'} · IP: {entry.ip_address || '—'}
                              </p>
                              {entry.request_id && (
                                <p className="break-all text-xs text-muted-foreground">{t('requestId')}: {entry.request_id}</p>
                              )}
                              {entry.user_agent && (
                                <p className="break-all text-xs text-muted-foreground">{t('browser')}: {entry.user_agent}</p>
                              )}
                              <div className="grid gap-3 lg:grid-cols-2">
                                <div>
                                  <h3 className="mb-1 text-xs font-semibold">{t('before')}</h3>
                                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs">
                                    {renderSnapshot(entry.before_values, t('notAvailable'))}
                                  </pre>
                                </div>
                                <div>
                                  <h3 className="mb-1 text-xs font-semibold">{t('after')}</h3>
                                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs">
                                    {renderSnapshot(entry.after_values, t('notAvailable'))}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </details>
                          <Button type="button" size="sm" variant="outline" onClick={() => setSelectedEntry(entry)}>
                            <Eye aria-hidden="true" className="size-4" />
                            {t('openDetails')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedEntry !== null} onOpenChange={(open) => { if (!open) { setSelectedEntry(null); setPdfError(null); } }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto sm:max-w-5xl">
          {selectedEntry && (
            <>
              <DialogHeader>
                <DialogTitle>{t('eventDetails')} #{selectedEntry.id}</DialogTitle>
                <DialogDescription>
                  {objectLabel(selectedEntry)}{selectedEntry.object_id ? ` · #${selectedEntry.object_id}` : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  [t('occurredAt'), formatDate(selectedEntry.occurred_at, locale)],
                  [t('actor'), selectedEntry.actor_name || (selectedEntry.actor_id ? `#${selectedEntry.actor_id}` : t('systemActor'))],
                  [t('action'), t(`actions.${selectedEntry.action}`)],
                  [t('source'), sourceLabel(selectedEntry.source)],
                  [t('tenantName'), tenantLabel(selectedEntry)],
                  [t('deviceId'), selectedEntry.device_id ? `#${selectedEntry.device_id}` : '—'],
                  ['IP', selectedEntry.ip_address || '—'],
                  [t('requestId'), selectedEntry.request_id || '—'],
                  [t('browser'), selectedEntry.user_agent || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-md border p-3">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="mt-1 break-all text-sm">{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="min-w-0">
                  <h3 className="mb-2 text-sm font-semibold">{t('before')}</h3>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                    {renderSnapshot(selectedEntry.before_values, t('notAvailable'))}
                  </pre>
                </section>
                <section className="min-w-0">
                  <h3 className="mb-2 text-sm font-semibold">{t('after')}</h3>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                    {renderSnapshot(selectedEntry.after_values, t('notAvailable'))}
                  </pre>
                </section>
              </div>
              <p className="text-sm text-muted-foreground">{t('pdfPrintHint')}</p>
              {pdfError && <p role="alert" className="text-sm text-destructive">{pdfError}</p>}
              <DialogFooter>
                <Button type="button" onClick={() => downloadPdf(selectedEntry)}>
                  <Download aria-hidden="true" className="size-4" />
                  {t('downloadPdf')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
