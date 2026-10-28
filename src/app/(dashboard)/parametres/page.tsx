'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Building2, CalendarDays, ChevronRight, Clock3, Fingerprint, KeyRound, Network, SlidersHorizontal, Users, UserRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';

/** Point d'entrée des paramètres de l'application. */
export default function ParametresPage() {
  const t = useTranslations('parametres');
  const tTenant = useTranslations('parametres.tenant');
  const user = useAuthStore((state) => state.user);

  return (
    <div className="w-full space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <Link href="/parametres/preferences" className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Card className="transition-colors hover:bg-accent/40">
          <CardHeader className="flex grid-cols-[auto_1fr_auto] items-center gap-4">
            <SlidersHorizontal aria-hidden="true" className="size-6 text-primary" />
            <div>
              <CardTitle>{t('preferences.title')}</CardTitle>
              <CardDescription>{t('preferences.widgetsHelp')}</CardDescription>
            </div>
            <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="sr-only">{t('preferences.title')}</CardContent>
        </Card>
      </Link>
      <Link href="/parametres/profil" className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Card className="transition-colors hover:bg-accent/40">
          <CardHeader className="flex grid-cols-[auto_1fr_auto] items-center gap-4">
            <UserRound aria-hidden="true" className="size-6 text-primary" />
            <div>
              <CardTitle>{t('profil.title')}</CardTitle>
              <CardDescription>{t('profil.description')}</CardDescription>
            </div>
            <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="sr-only">{t('profil.title')}</CardContent>
        </Card>
      </Link>
      {(user?.role === 'admin' || user?.role === 'rh' || user?.role === 'superviseur' || user?.is_super_admin) && (
        <Link href="/parametres/pointages" className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="transition-colors hover:bg-accent/40">
            <CardHeader className="flex grid-cols-[auto_1fr_auto] items-center gap-4">
              <Fingerprint aria-hidden="true" className="size-6 text-primary" />
              <div>
                <CardTitle>{t('pointages.title')}</CardTitle>
                <CardDescription>{t('pointages.description')}</CardDescription>
              </div>
              <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="sr-only">{t('pointages.title')}</CardContent>
          </Card>
        </Link>
      )}
      {(user?.role === 'admin' || user?.role === 'rh' || user?.is_super_admin) && (
        <Link href="/parametres/shifts" className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="transition-colors hover:bg-accent/40">
            <CardHeader className="flex grid-cols-[auto_1fr_auto] items-center gap-4">
              <Clock3 aria-hidden="true" className="size-6 text-primary" />
              <div>
                <CardTitle>{t('shifts.title')}</CardTitle>
                <CardDescription>{t('shifts.description')}</CardDescription>
              </div>
              <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="sr-only">{t('shifts.title')}</CardContent>
          </Card>
        </Link>
      )}
      {(user?.role === 'admin' || user?.role === 'rh' || user?.is_super_admin) && (
        <Link href="/parametres/jours-feries" className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="transition-colors hover:bg-accent/40">
            <CardHeader className="flex grid-cols-[auto_1fr_auto] items-center gap-4">
              <CalendarDays aria-hidden="true" className="size-6 text-primary" />
              <div>
                <CardTitle>{t('joursFeries.title')}</CardTitle>
                <CardDescription>{t('joursFeries.description')}</CardDescription>
              </div>
              <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="sr-only">{t('joursFeries.title')}</CardContent>
          </Card>
        </Link>
      )}
      {(user?.role === 'admin' || user?.role === 'rh' || user?.is_super_admin) && (
        <Link href="/parametres/utilisateurs" className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="transition-colors hover:bg-accent/40">
            <CardHeader className="flex grid-cols-[auto_1fr_auto] items-center gap-4">
              <Users aria-hidden="true" className="size-6 text-primary" />
              <div>
                <CardTitle>{t('utilisateurs.title')}</CardTitle>
                <CardDescription>{t('utilisateurs.description')}</CardDescription>
              </div>
              <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="sr-only">{t('utilisateurs.title')}</CardContent>
          </Card>
        </Link>
      )}
      {(user?.role === 'admin' || user?.role === 'rh' || user?.is_super_admin) && (
        <Link href="/parametres/ldap" className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="transition-colors hover:bg-accent/40">
            <CardHeader className="flex grid-cols-[auto_1fr_auto] items-center gap-4">
              <KeyRound aria-hidden="true" className="size-6 text-primary" />
              <div>
                <CardTitle>{t('ldap.title')}</CardTitle>
                <CardDescription>{t('ldap.description')}</CardDescription>
              </div>
              <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="sr-only">{t('ldap.title')}</CardContent>
          </Card>
        </Link>
      )}
      {(user?.role === 'admin' || user?.is_super_admin) && (
        <Link href="/parametres/tenant" className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="transition-colors hover:bg-accent/40">
            <CardHeader className="flex grid-cols-[auto_1fr_auto] items-center gap-4">
              <Building2 aria-hidden="true" className="size-6 text-primary" />
              <div>
                <CardTitle>{tTenant('title')}</CardTitle>
                <CardDescription>{tTenant('previewDescription')}</CardDescription>
              </div>
              <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="sr-only">{tTenant('title')}</CardContent>
          </Card>
        </Link>
      )}
      {user?.is_super_admin && (
        <Link href="/parametres/integrations" className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="transition-colors hover:bg-accent/40">
            <CardHeader className="flex grid-cols-[auto_1fr_auto] items-center gap-4">
              <Network aria-hidden="true" className="size-6 text-primary" />
              <div>
                <CardTitle>{t('integrations.title')}</CardTitle>
                <CardDescription>{t('integrations.description')}</CardDescription>
              </div>
              <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="sr-only">{t('integrations.title')}</CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
