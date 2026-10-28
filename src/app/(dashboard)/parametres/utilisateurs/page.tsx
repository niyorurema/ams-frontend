'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { KeyRound, Loader2, Pencil, Plus, Search, UserRound, UserRoundX } from 'lucide-react';
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
import { Combobox } from '@/components/ui/combobox';
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
import { useEmployes } from '@/hooks/useEmployes';
import {
  getUsersErrorMessage,
  useCreateUser,
  useDeactivateUser,
  useResetUserPassword,
  useUpdateUser,
  useUsers,
  type ManagedUser,
  type UserInput,
  type UserRole,
} from '@/hooks/useUsers';
import { useAuthStore } from '@/stores/authStore';
import { confirmerAvecSweetAlert } from '@/lib/confirmation';

const roles: UserRole[] = [
  'admin',
  'rh',
  'superviseur',
  'chef_service',
  'directeur',
  'commissaire',
  'lecteur',
];

const initialForm: UserInput = {
  email: '',
  nom_complet: '',
  telephone: '',
  role: 'lecteur',
  employe_id: null,
  password: '',
  is_active: true,
  webauthn_enrollment_approved: false,
};

function formatDate(value: string | null, locale: string, never: string): string {
  if (!value) return never;
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime())
    ? never
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function UtilisateursPage() {
  const t = useTranslations('parametres.utilisateurs');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const currentUser = useAuthStore((state) => state.user);
  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'rh' || currentUser?.is_super_admin;

  const [search, setSearch] = useState('');
  const [withoutEmail, setWithoutEmail] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserInput>(initialForm);
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      sans_email: withoutEmail,
      role: roleFilter === 'all' ? undefined : roleFilter as UserRole,
      actif: activeFilter === 'all' ? undefined : activeFilter as '0' | '1',
      limit,
      offset,
    }),
    [search, withoutEmail, roleFilter, activeFilter, limit, offset],
  );
  const usersQuery = useUsers(filters, Boolean(canManage));
  const employeesQuery = useEmployes({ limit: 1000, offset: 0, actif: true });
  const employeeOptions = [
    { value: 'none', label: t('aucunEmploye') },
    ...(employeesQuery.data?.items ?? []).map((employee) => ({
      value: String(employee.id),
      label: `${employee.nom} ${employee.prenom} — ${employee.matricule}`,
    })),
  ];
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const resetUserPassword = useResetUserPassword();
  const busy = createUser.isPending || updateUser.isPending;

  const openCreate = () => {
    setEditingUser(null);
    setForm(initialForm);
    setFormOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setForm({
      email: user.email ?? '',
      nom_complet: user.nom_complet,
      telephone: user.telephone ?? '',
      role: user.role,
      employe_id: user.employe_id,
      is_active: user.is_active,
      webauthn_enrollment_approved: user.webauthn_enrollment_approved,
    });
    setFormOpen(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (editingUser) {
        const update = { ...form };
        delete update.password;
        await updateUser.mutateAsync({ ...update, id: editingUser.id });
        toast.success(t('updated'));
      } else {
        await createUser.mutateAsync(form);
        toast.success(t('created'));
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(getUsersErrorMessage(error));
    }
  };

  const toggleActive = async (user: ManagedUser) => {
    if (user.is_active) {
      if (!await confirmerAvecSweetAlert(t('confirmDeactivate', { name: user.nom_complet }), {
        title: tCommon('confirm'),
        confirmButtonText: tCommon('yes'),
        cancelButtonText: tCommon('no'),
        destructive: true,
      })) return;
      try {
        await deactivateUser.mutateAsync(user.id);
        toast.success(t('deactivated'));
      } catch (error) {
        toast.error(getUsersErrorMessage(error));
      }
      return;
    }

    try {
      await updateUser.mutateAsync({ id: user.id, is_active: true });
      toast.success(t('reactivated'));
    } catch (error) {
      toast.error(getUsersErrorMessage(error));
    }
  };

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetUser) return;
    try {
      const result = await resetUserPassword.mutateAsync({
        id: resetUser.id,
        password: resetPassword || undefined,
      });
      setTemporaryPassword(result.temp_password);
      setResetPassword('');
      if (!result.temp_password) setResetUser(null);
      toast.success(t('passwordReset'));
    } catch (error) {
      toast.error(getUsersErrorMessage(error));
    }
  };

  if (!canManage) {
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
          {t('ajouter')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('filtersHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative sm:col-span-1">
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
            <Combobox
              options={roles.map((role) => ({ value: role, label: t(`roles.${role}`) }))}
              value={roleFilter}
              onValueChange={(value) => {
                setRoleFilter(value);
                setOffset(0);
              }}
              placeholder={t('tousRoles')}
              searchPlaceholder={t('rechercherRole')}
              emptyMessage={t('aucunRoleTrouve')}
              ariaLabel={t('role')}
              allowAll
              allLabel={t('tousRoles')}
            />
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
                <SelectValue>{activeFilter === 'all' ? t('tousStatuts') : activeFilter === '1' ? t('actif') : t('inactif')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tousStatuts')}</SelectItem>
                <SelectItem value="1">{t('actif')}</SelectItem>
                <SelectItem value="0">{t('inactif')}</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex min-h-8 items-center gap-2 rounded-md border px-3 text-sm sm:col-span-3">
              <input
                type="checkbox"
                checked={withoutEmail}
                onChange={(event) => {
                  setWithoutEmail(event.target.checked);
                  setOffset(0);
                }}
                className="size-4 accent-primary"
              />
              <span>{t('sansEmail')}</span>
            </label>
          </div>

          {usersQuery.isLoading || usersQuery.isFetching ? (
            <div className="space-y-3" aria-label={tCommon('loading')}>
              {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
            </div>
          ) : usersQuery.isError ? (
            <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
              {getUsersErrorMessage(usersQuery.error)}
              <Button variant="outline" size="sm" className="ml-3" onClick={() => usersQuery.refetch()}>
                {tCommon('retry')}
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table className="sticky-actions">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('email')}</TableHead>
                      <TableHead>{t('nomComplet')}</TableHead>
                      <TableHead>{t('role')}</TableHead>
                      <TableHead>{t('employeLie')}</TableHead>
                      <TableHead>{t('unite')}</TableHead>
                      <TableHead>{t('statut')}</TableHead>
                      <TableHead>{t('derniereConnexion')}</TableHead>
                      <TableHead className="text-right">{tCommon('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(usersQuery.data?.items ?? []).map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="whitespace-nowrap font-medium">{user.email ?? '—'}</TableCell>
                        <TableCell>{user.nom_complet}</TableCell>
                        <TableCell>{t(`roles.${user.role}`)}</TableCell>
                        <TableCell>
                          {user.employe_nom
                            ? <span>{user.employe_nom}<span className="block text-xs text-muted-foreground">{user.employe_matricule}</span></span>
                            : t('aucunEmploye')}
                        </TableCell>
                        <TableCell>{user.unite_nom ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'default' : 'secondary'}>
                            {user.is_active ? t('actif') : t('inactif')}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(user.derniere_connexion, locale, t('jamais'))}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {(!user.is_super_admin || currentUser?.is_super_admin)
                              && !(currentUser?.role === 'rh' && user.role === 'admin') && (
                              <>
                                <Button type="button" variant="ghost" size="icon" aria-label={t('modifier')} title={t('modifier')} onClick={() => openEdit(user)}>
                                  <Pencil aria-hidden="true" className="size-4" />
                                </Button>
                                {user.auth_source === 'LOCAL' && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('resetPassword')}
                                    title={t('resetPassword')}
                                    onClick={() => {
                                      setResetUser(user);
                                      setTemporaryPassword(null);
                                      setResetPassword('');
                                    }}
                                  >
                                    <KeyRound aria-hidden="true" className="size-4" />
                                  </Button>
                                )}
                                {user.id !== currentUser?.id && !user.is_super_admin && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={user.is_active ? t('desactiver') : t('reactiver')}
                                    title={user.is_active ? t('desactiver') : t('reactiver')}
                                    onClick={() => void toggleActive(user)}
                                  >
                                    {user.is_active
                                      ? <UserRoundX aria-hidden="true" className="size-4 text-destructive" />
                                      : <UserRound aria-hidden="true" className="size-4 text-primary" />}
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {usersQuery.data?.items.length === 0 && (
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
                total={usersQuery.data?.pagination.total ?? 0}
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
            <DialogTitle>{editingUser ? t('modifier') : t('ajouter')}</DialogTitle>
            <DialogDescription>{t('formHelp')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="user-name">{t('nomComplet')}</Label>
                <Input id="user-name" required maxLength={150} value={form.nom_complet} onChange={(event) => setForm({ ...form, nom_complet: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-email">{t('email')}</Label>
                <Input id="user-email" required={!editingUser || (editingUser.email !== null && !(editingUser.role === 'lecteur' && editingUser.employe_id !== null && editingUser.auth_source === 'LDAP'))} type="email" maxLength={150} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-phone">{t('telephone')}</Label>
                <Input id="user-phone" type="tel" maxLength={30} value={form.telephone ?? ''} onChange={(event) => setForm({ ...form, telephone: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-role">{t('role')}</Label>
                <Combobox
                  id="user-role"
                  options={roles
                    .filter((role) => currentUser?.role === 'admin' || role !== 'admin')
                    .map((role) => ({ value: role, label: t(`roles.${role}`) }))}
                  value={form.role}
                  onValueChange={(value) => {
                    if (roles.includes(value as UserRole)) setForm({ ...form, role: value as UserRole });
                  }}
                  placeholder={t(`roles.${form.role}`)}
                  searchPlaceholder={t('rechercherRole')}
                  emptyMessage={t('aucunRoleTrouve')}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="user-employee">{t('employeLie')}</Label>
                <Combobox
                  id="user-employee"
                  options={employeeOptions}
                  value={form.employe_id === null ? 'none' : String(form.employe_id)}
                  onValueChange={(value) => setForm({ ...form, employe_id: value === 'none' ? null : Number(value) })}
                  placeholder={t('aucunEmploye')}
                  searchPlaceholder={t('rechercherEmploye')}
                  emptyMessage={t('aucunEmployeTrouve')}
                  className="w-full"
                />
              </div>
              {!editingUser && (
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="user-password">{t('motDePasseInitial')}</Label>
                  <Input id="user-password" required minLength={8} type="password" autoComplete="new-password" value={form.password ?? ''} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                </div>
              )}
              {editingUser && (
                <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                  <Label htmlFor="user-active">{t('actif')}</Label>
                  <Switch id="user-active" checked={Boolean(form.is_active)} onCheckedChange={(is_active) => setForm({ ...form, is_active })} />
                </div>
              )}
              {editingUser && editingUser.employe_id !== null
                && (currentUser?.role === 'admin' || currentUser?.is_super_admin) && (
                  <div className="rounded-lg border p-3 sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="user-passkey-enrollment">{t('passkeyEnrollmentApproval')}</Label>
                      <Switch
                        id="user-passkey-enrollment"
                        checked={Boolean(form.webauthn_enrollment_approved)}
                        onCheckedChange={(webauthn_enrollment_approved) => setForm({ ...form, webauthn_enrollment_approved })}
                      />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t('passkeyEnrollmentApprovalHelp')}</p>
                  </div>
                )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{tCommon('cancel')}</Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={resetUser !== null} onOpenChange={(open) => {
        if (!open) {
          setResetUser(null);
          setTemporaryPassword(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('resetPassword')}</DialogTitle>
            <DialogDescription>{t('resetPasswordHelp', { name: resetUser?.nom_complet ?? '' })}</DialogDescription>
          </DialogHeader>
          {temporaryPassword ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
              <Label htmlFor="temporary-password">{t('temporaryPassword')}</Label>
              <Input id="temporary-password" readOnly value={temporaryPassword} onFocus={(event) => event.currentTarget.select()} />
              <p className="text-xs text-muted-foreground">{t('temporaryPasswordWarning')}</p>
            </div>
          ) : (
            <form onSubmit={(event) => void handleResetPassword(event)} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="reset-password">{t('newPasswordOptional')}</Label>
                <Input id="reset-password" minLength={8} type="password" autoComplete="new-password" placeholder={t('generatePassword')} value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResetUser(null)}>{tCommon('cancel')}</Button>
                <Button type="submit" disabled={resetUserPassword.isPending}>
                  {resetUserPassword.isPending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                  {t('resetPassword')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
