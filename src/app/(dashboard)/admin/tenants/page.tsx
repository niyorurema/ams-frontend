'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, Eye, Loader2, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import {
  getAdminTenantsErrorMessage,
  useAdminTenants,
  useCreateTenant,
  useDeactivateTenant,
  useTenant,
  useUpdateTenant,
  type AdminTenant,
  type AdminTenantInput,
} from '@/hooks/useAdminTenants';
import { useAuthStore } from '@/stores/authStore';
import { confirmerAvecSweetAlert } from '@/lib/confirmation';

const initialForm: AdminTenantInput = {
  name: '',
  slug: '',
  contact_email: '',
  timezone: 'Africa/Bujumbura',
  admin_nom_complet: '',
  admin_email: '',
  admin_password: '',
  is_active: true,
};

function formatDate(value: string, locale: string): string {
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

export default function AdminTenantsPage() {
  const t = useTranslations('admin.tenants');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const currentUser = useAuthStore((state) => state.user);
  const isSuperAdmin = currentUser?.is_super_admin === true;

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<AdminTenant | null>(null);
  const [viewingTenant, setViewingTenant] = useState<AdminTenant | null>(null);
  const [form, setForm] = useState<AdminTenantInput>(initialForm);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const filters = useMemo(() => ({
    search: search.trim() || undefined,
    actif: activeFilter === 'all' ? undefined : activeFilter as '0' | '1',
    limit,
    offset,
  }), [search, activeFilter, limit, offset]);
  const tenantsQuery = useAdminTenants(filters, isSuperAdmin);
  const tenantDetail = useTenant(viewingTenant?.id ?? 0, Boolean(viewingTenant && isSuperAdmin));
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();
  const deactivateTenant = useDeactivateTenant();
  const busy = createTenant.isPending || updateTenant.isPending;

  const openCreate = () => {
    setEditingTenant(null);
    setForm({ ...initialForm });
    setFormOpen(true);
  };

  const openEdit = (tenant: AdminTenant) => {
    setEditingTenant(tenant);
    setForm({
      name: tenant.name,
      slug: tenant.slug,
      contact_email: tenant.contact_email ?? '',
      timezone: tenant.timezone,
      is_active: tenant.is_active,
    });
    setFormOpen(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (editingTenant) {
        await updateTenant.mutateAsync({
          id: editingTenant.id,
          name: form.name,
          slug: form.slug,
          contact_email: form.contact_email,
          timezone: form.timezone,
          is_active: form.is_active,
        });
        toast.success(t('updated'));
      } else {
        const created = await createTenant.mutateAsync(form);
        toast.success(t('created'));
        if (created.temporary_password) {
          setCredentials({
            email: created.admin.email,
            password: created.temporary_password,
          });
        }
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(getAdminTenantsErrorMessage(error));
    }
  };

  const toggleActive = async (tenant: AdminTenant) => {
    if (tenant.is_active) {
      if (!await confirmerAvecSweetAlert(t('confirmDeactivate', { name: tenant.name }), {
        title: tCommon('confirm'),
        confirmButtonText: tCommon('yes'),
        cancelButtonText: tCommon('no'),
        destructive: true,
      })) return;
      try {
        await deactivateTenant.mutateAsync(tenant.id);
        toast.success(t('deactivated'));
      } catch (error) {
        toast.error(getAdminTenantsErrorMessage(error));
      }
      return;
    }

    try {
      await updateTenant.mutateAsync({ id: tenant.id, is_active: true });
      toast.success(t('reactivated'));
    } catch (error) {
      toast.error(getAdminTenantsErrorMessage(error));
    }
  };

  if (!isSuperAdmin) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('accessDenied')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus aria-hidden="true" className="size-4" />
          {t('creer')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('filtersHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setOffset(0);
                }}
                placeholder={t('rechercher')}
                aria-label={t('rechercher')}
                className="pl-9"
              />
            </div>
            <Select
              value={activeFilter}
              onValueChange={(value) => {
                if (value) {
                  setActiveFilter(value);
                  setOffset(0);
                }
              }}
            >
              <SelectTrigger aria-label={t('statut')}>
                <SelectValue>
                  {activeFilter === 'all' ? t('tousStatuts') : activeFilter === '1' ? t('actif') : t('inactif')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tousStatuts')}</SelectItem>
                <SelectItem value="1">{t('actif')}</SelectItem>
                <SelectItem value="0">{t('inactif')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tenantsQuery.isLoading ? (
            <div className="space-y-3" aria-label={tCommon('loading')}>
              {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
            </div>
          ) : tenantsQuery.isError ? (
            <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
              {getAdminTenantsErrorMessage(tenantsQuery.error)}
              <Button variant="outline" size="sm" className="ml-3" onClick={() => tenantsQuery.refetch()}>
                {tCommon('retry')}
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table className="sticky-actions">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('id')}</TableHead>
                      <TableHead>{t('nom')}</TableHead>
                      <TableHead>{t('slug')}</TableHead>
                      <TableHead>{t('contact')}</TableHead>
                      <TableHead>{t('actif')}</TableHead>
                      <TableHead>{t('creeLe')}</TableHead>
                      <TableHead>{t('nbEmployes')}</TableHead>
                      <TableHead className="text-right">{tCommon('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tenantsQuery.data?.items ?? []).map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell>{tenant.id}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium">{tenant.name}</TableCell>
                        <TableCell>{tenant.slug}</TableCell>
                        <TableCell>{tenant.contact_email ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
                            {tenant.is_active ? t('actif') : t('inactif')}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(tenant.created_at, locale)}</TableCell>
                        <TableCell>{tenant.employee_count}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t('voir')}
                              title={t('voir')}
                              onClick={() => setViewingTenant(tenant)}
                            >
                              <Eye aria-hidden="true" className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t('modifier')}
                              title={t('modifier')}
                              onClick={() => openEdit(tenant)}
                            >
                              <Pencil aria-hidden="true" className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={tenant.is_active ? t('desactiver') : t('reactiver')}
                              title={tenant.is_active ? t('desactiver') : t('reactiver')}
                              disabled={tenant.id === currentUser?.tenant_id || deactivateTenant.isPending || updateTenant.isPending}
                              onClick={() => void toggleActive(tenant)}
                            >
                              {deactivateTenant.isPending || updateTenant.isPending
                                ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                                : <Building2 aria-hidden="true" className="size-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {tenantsQuery.data?.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                          {t('aucunResultat')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <DataTablePagination
                total={tenantsQuery.data?.pagination.total ?? 0}
                limit={limit}
                offset={offset}
                onLimitChange={setLimit}
                onOffsetChange={setOffset}
                limitOptions={[10, 25, 50, 100]}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingTenant ? t('dialogueModification.title') : t('dialogueCreation.title')}</DialogTitle>
            <DialogDescription>{editingTenant ? t('dialogueModification.description') : t('dialogueCreation.description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tenant-name">{t('nom')}</Label>
                <Input id="tenant-name" required maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-slug">{t('slug')}</Label>
                <Input id="tenant-slug" maxLength={100} value={form.slug} placeholder={t('slugAuto')} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-timezone">{t('timezone')}</Label>
                <Input id="tenant-timezone" required maxLength={64} value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tenant-contact">{t('contact')}</Label>
                <Input id="tenant-contact" type="email" value={form.contact_email ?? ''} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} />
              </div>
              {editingTenant ? (
                <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
                  <Label htmlFor="tenant-active">{t('actif')}</Label>
                  <Switch id="tenant-active" checked={Boolean(form.is_active)} disabled={editingTenant?.id === currentUser?.tenant_id} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
                </div>
              ) : (
                <fieldset className="space-y-3 rounded-md border p-4 sm:col-span-2">
                  <legend className="px-1 text-sm font-medium">{t('dialogueCreation.admin')}</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="tenant-admin-name">{t('dialogueCreation.adminNom')}</Label>
                      <Input id="tenant-admin-name" required maxLength={150} value={form.admin_nom_complet ?? ''} onChange={(event) => setForm({ ...form, admin_nom_complet: event.target.value })} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="tenant-admin-email">{t('dialogueCreation.adminEmail')}</Label>
                      <Input id="tenant-admin-email" type="email" required value={form.admin_email ?? ''} onChange={(event) => setForm({ ...form, admin_email: event.target.value })} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="tenant-admin-password">{t('dialogueCreation.adminPassword')}</Label>
                      <Input id="tenant-admin-password" type="password" minLength={8} autoComplete="new-password" value={form.admin_password ?? ''} placeholder={t('dialogueCreation.genererPassword')} onChange={(event) => setForm({ ...form, admin_password: event.target.value })} />
                    </div>
                  </div>
                </fieldset>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{tCommon('cancel')}</Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                {editingTenant ? tCommon('save') : t('dialogueCreation.creer')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewingTenant)} onOpenChange={(open) => { if (!open) setViewingTenant(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tenantDetail.data?.name ?? viewingTenant?.name ?? t('voir')}</DialogTitle>
            <DialogDescription>{t('details')}</DialogDescription>
          </DialogHeader>
          {tenantDetail.isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : tenantDetail.isError ? (
            <p role="alert" className="text-sm text-destructive">{getAdminTenantsErrorMessage(tenantDetail.error)}</p>
          ) : tenantDetail.data ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="min-w-0"><dt className="text-muted-foreground">{t('id')}</dt><dd>{tenantDetail.data.id}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">{t('slug')}</dt><dd className="break-all">{tenantDetail.data.slug}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">{t('contact')}</dt><dd className="break-all">{tenantDetail.data.contact_email ?? '—'}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">{t('timezone')}</dt><dd className="break-all">{tenantDetail.data.timezone}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">{t('nbEmployes')}</dt><dd>{tenantDetail.data.employee_count}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">{t('nbUtilisateurs')}</dt><dd>{tenantDetail.data.user_count ?? '—'}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">{t('creeLe')}</dt><dd>{formatDate(tenantDetail.data.created_at, locale)}</dd></div>
              <div className="min-w-0"><dt className="text-muted-foreground">{t('actif')}</dt><dd>{tenantDetail.data.is_active ? t('oui') : t('non')}</dd></div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(credentials)} onOpenChange={(open) => { if (!open) setCredentials(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('identifiantsAdmin.title')}</DialogTitle>
            <DialogDescription>{t('identifiantsAdmin.description')}</DialogDescription>
          </DialogHeader>
          {credentials && (
            <dl className="space-y-3 rounded-md border p-4 text-sm">
              <div><dt className="text-muted-foreground">{t('dialogueCreation.adminEmail')}</dt><dd className="font-medium">{credentials.email}</dd></div>
              <div><dt className="text-muted-foreground">{t('dialogueCreation.adminPassword')}</dt><dd className="break-all font-mono">{credentials.password}</dd></div>
            </dl>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setCredentials(null)}>{tCommon('close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
