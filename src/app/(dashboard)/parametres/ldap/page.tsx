'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { LdapConfigurationCard } from '@/components/settings/ldap-configuration-card';
import { LdapToolsCard } from '@/components/settings/ldap-tools-card';
import { useAuthStore } from '@/stores/authStore';

export default function LdapSettingsPage() {
  const t = useTranslations('parametres.ldap');
  const user = useAuthStore((state) => state.user);
  const peutConsulter = Boolean(user?.is_super_admin || user?.role === 'admin' || user?.role === 'rh');
  const peutConfigurer = Boolean(user?.is_super_admin || user?.role === 'admin');

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </header>
      {peutConsulter ? (
        <>
          {peutConfigurer && <LdapConfigurationCard />}
          <LdapToolsCard />
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">{t('adminOnly')}</CardContent>
        </Card>
      )}
    </div>
  );
}
