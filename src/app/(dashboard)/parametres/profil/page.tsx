'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2, Save, ShieldCheck, UserRound } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getUsersErrorMessage, useChangeOwnPassword, useCurrentProfile, useUpdateCurrentProfile } from '@/hooks/useUsers';
import { logout } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';
import type { CurrentProfile } from '@/hooks/useUsers';

function formatDate(value: string | null, locale: string, never: string): string {
  if (!value) return never;
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime())
    ? never
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function ProfileForm({ profile }: { profile: CurrentProfile }) {
  const t = useTranslations('parametres.profil');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const updateProfile = useUpdateCurrentProfile();
  const changePassword = useChangeOwnPassword();
  const updateAuthUser = useAuthStore((state) => state.updateUser);
  const [identity, setIdentity] = useState({
    nom_complet: profile.nom_complet,
    email: profile.email ?? '',
    telephone: profile.telephone ?? '',
  });
  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirmation: '',
  });
  const localAccount = profile.auth_source === 'LOCAL';

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const updated = await updateProfile.mutateAsync({
        ...identity,
        telephone: identity.telephone || null,
      });
      updateAuthUser({
        email: updated.email,
        nom_complet: updated.nom_complet,
        telephone: updated.telephone ?? undefined,
      });
      toast.success(t('profileUpdated'));
    } catch (error) {
      toast.error(getUsersErrorMessage(error));
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwords.new_password !== passwords.confirmation) {
      toast.error(t('passwordMismatch'));
      return;
    }
    try {
      await changePassword.mutateAsync({
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswords({ current_password: '', new_password: '', confirmation: '' });
      toast.success(t('passwordUpdated'));
    } catch (error) {
      toast.error(getUsersErrorMessage(error));
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{profile.email ?? ''}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound aria-hidden="true" className="size-5" />
            {t('informations')}
          </CardTitle>
          <CardDescription>{t('profileHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={(event) => void saveProfile(event)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="profile-name">{t('nomComplet')}</Label>
                <Input id="profile-name" required maxLength={150} value={identity.nom_complet} onChange={(event) => setIdentity({ ...identity, nom_complet: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-email">{t('email')}</Label>
                <Input id="profile-email" required={profile.email !== null && !(profile.role === 'lecteur' && profile.employe_id !== null && profile.auth_source === 'LDAP')} type="email" maxLength={150} value={identity.email} onChange={(event) => setIdentity({ ...identity, email: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-phone">{t('telephone')}</Label>
                <Input id="profile-phone" type="tel" maxLength={30} value={identity.telephone} onChange={(event) => setIdentity({ ...identity, telephone: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t('role')}</Label>
                <div className="flex h-9 items-center">
                  <Badge variant="secondary">{t(`roles.${profile.role}`)}</Badge>
                </div>
              </div>
            </div>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending
                ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                : <Save aria-hidden="true" className="size-4" />}
              {tCommon('save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('employeLie')}</CardTitle>
          <CardDescription>{t('employeeHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          {profile.employe_id ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div><dt className="text-sm text-muted-foreground">{t('employeLie')}</dt><dd className="font-medium">{profile.employe_nom ?? '—'}</dd></div>
              <div><dt className="text-sm text-muted-foreground">{t('matricule')}</dt><dd className="font-medium">{profile.employe_matricule ?? '—'}</dd></div>
              <div><dt className="text-sm text-muted-foreground">{t('unite')}</dt><dd className="font-medium">{profile.unite_nom ?? '—'}</dd></div>
              <div><dt className="text-sm text-muted-foreground">{t('poste')}</dt><dd className="font-medium">{profile.employe_poste ?? '—'}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noEmployee')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-5" />
            {t('securite')}
          </CardTitle>
          <CardDescription>{t('lastLogin')}: {formatDate(profile.derniere_connexion, locale, t('jamais'))}</CardDescription>
        </CardHeader>
        <CardContent>
          {localAccount ? (
            <form onSubmit={(event) => void savePassword(event)} className="space-y-4">
              <h3 className="font-medium">{t('changerMotDePasse')}</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="current-password">{t('motDePasseActuel')}</Label>
                  <Input id="current-password" required autoComplete="current-password" type="password" value={passwords.current_password} onChange={(event) => setPasswords({ ...passwords, current_password: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">{t('nouveauMotDePasse')}</Label>
                  <Input id="new-password" required minLength={8} autoComplete="new-password" type="password" value={passwords.new_password} onChange={(event) => setPasswords({ ...passwords, new_password: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">{t('confirmerMotDePasse')}</Label>
                  <Input id="confirm-password" required minLength={8} autoComplete="new-password" type="password" value={passwords.confirmation} onChange={(event) => setPasswords({ ...passwords, confirmation: event.target.value })} />
                </div>
              </div>
              <Button type="submit" variant="outline" disabled={changePassword.isPending}>
                {changePassword.isPending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                {t('changerMotDePasse')}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">{t('ldapPasswordManaged')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('session')}</CardTitle>
          <CardDescription>{t('sessionHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="destructive" onClick={() => void handleLogout()}>
            <LogOut aria-hidden="true" className="size-4" />
            {t('deconnecter')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilPage() {
  const t = useTranslations('parametres.profil');
  const user = useAuthStore((state) => state.user);
  const query = useCurrentProfile(Boolean(user));

  if (!user) {
    return null;
  }
  if (query.isLoading) {
    return <div className="w-full space-y-4"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (query.isError || !query.data) {
    return <Card className="w-full"><CardHeader><CardTitle>{t('title')}</CardTitle><CardDescription role="alert">{query.error ? getUsersErrorMessage(query.error) : t('loadError')}</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => void query.refetch()}>{t('retry')}</Button></CardContent></Card>;
  }

  return <ProfileForm key={query.data.id} profile={query.data} />;
}
