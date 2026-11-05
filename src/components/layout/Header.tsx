'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Menu } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { PrimaryNavigation } from '@/components/layout/PrimaryNavigation';
import { UserAccountMenu } from '@/components/layout/UserAccountMenu';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useTenantStore } from '@/stores/tenantStore';
import { useAuthStore } from '@/stores/authStore';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';

interface HeaderProps {
  onMobileMenuToggle: () => void;
  mobileMenuOpen: boolean;
}

/** En-tête fixe avec retour, navigation optionnelle et préférences d'affichage. */
export function Header({ onMobileMenuToggle, mobileMenuOpen }: HeaderProps) {
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const homePath = user?.role === 'lecteur' ? '/mon-dossier' : '/dashboard';
  const tenant = useTenantStore((state) => state.tenant);
  const navigationPosition = usePreferencesStore((state) => state.navigationPosition);
  const setNavigationPosition = usePreferencesStore((state) => state.setNavigationPosition);
  const navigationHistory = useRef<string[]>([]);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  const getPageTitle = () => {
    if (pathname.startsWith('/admin/audit-logs')) return t('auditLogs');
    if (pathname.startsWith('/admin/tenants')) return t('adminTenants');
    if (pathname.startsWith('/parametres/profil')) return t('profil');
    if (pathname.startsWith('/parametres/preferences')) return t('preferences');
    if (pathname.startsWith('/parametres/tenant')) return t('tenant');
    if (pathname.startsWith('/parametres/integrations')) return t('parametres') + ' · Intégrations';
    if (pathname.startsWith('/parametres/ldap')) return t('parametres') + ' · LDAP';
    if (pathname.startsWith('/parametres/jours-feries')) return t('parametres') + ' · Jours fériés';
    if (pathname.startsWith('/parametres/pointages')) return t('parametres') + ' · Pointages';
    if (pathname.startsWith('/parametres/shifts')) return t('parametres') + ' · Shifts';
    if (pathname.startsWith('/parametres/utilisateurs')) return t('parametres') + ' · Utilisateurs';
    if (pathname.startsWith('/parametres')) return t('parametres');
    if (pathname.startsWith('/dashboard')) return t('dashboard');
    if (pathname.startsWith('/mon-dossier')) return t('monDossier');
    if (pathname.startsWith('/capteurs')) return t('capteurs');
    if (pathname.startsWith('/employes')) return t('employes');
    if (pathname.startsWith('/organisation')) return t('organisation');
    if (pathname.startsWith('/pointages')) return t('pointages');
    if (pathname.startsWith('/rapports')) return t('rapports');
    return tenant?.name || 'AMS';
  };
  const pageTitle = getPageTitle();

  useEffect(() => {
    const history = navigationHistory.current;
    if (history.length === 0) {
      history.push(pathname);
      return;
    }
    if (history.at(-1) === pathname) return;

    if (history.length > 1 && history.at(-2) === pathname) {
      history.pop();
    } else {
      history.push(pathname);
    }
    setHasPreviousPage(history.length > 1);
  }, [pathname]);

  const revenir = () => {
    if (navigationHistory.current.length > 1) {
      router.back();
      return;
    }
    if (pathname !== homePath) {
      router.replace(homePath);
    }
  };

  const logoUrl = tenant?.logo_url
    ? tenant.logo_url.startsWith('http')
      ? tenant.logo_url
      : `${process.env.NEXT_PUBLIC_API_URL || 'http://10.100.27.136:8080'}/${tenant.logo_url}`
    : null;

  const handleDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (!window.matchMedia('(min-width: 768px)').matches
      || navigationPosition !== 'bottom'
      || (event.target instanceof Element && event.target.closest('button, input, [role="button"]'))) {
      return;
    }
    setNavigationPosition('left');
  };

  return (
    <header
      onDoubleClick={handleDoubleClick}
      title={navigationPosition === 'bottom' ? t('restoreNavigationLeft') : undefined}
      className="grid h-16 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-2 border-b bg-[var(--header-background)] px-2 text-[var(--header-foreground)] sm:px-4"
    >
      <div className="flex min-w-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={mobileMenuOpen ? t('closeNavigation') : t('openNavigation')}
          aria-expanded={mobileMenuOpen}
          className="md:hidden"
          onClick={onMobileMenuToggle}
        >
          <Menu aria-hidden="true" className="size-4" />
        </Button>
        {logoUrl && navigationPosition !== 'left' && (
          <Image
            src={logoUrl}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="hidden size-8 shrink-0 rounded-md object-contain sm:block"
          />
        )}
        <h1 className="truncate text-sm font-semibold sm:text-base">{tenant?.name || 'AMS'}</h1>
      </div>

      <div className={`pointer-events-none hidden min-w-0 justify-self-center self-center text-center md:block md:max-w-[min(32vw,420px)] ${navigationPosition === 'top' ? 'md:-translate-x-36' : ''}`}>
        <h1 className="truncate text-base font-semibold" title={pageTitle}>{pageTitle}</h1>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
        {navigationPosition === 'top' && (
          <div className="hidden min-w-0 max-w-[38vw] overflow-hidden rounded-md px-1 py-1 lg:block">
            <PrimaryNavigation orientation="horizontal" />
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('backToPreviousPage')}
          title={t('backToPreviousPage')}
          disabled={pathname === homePath && !hasPreviousPage}
          onClick={revenir}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </Button>
        <LocaleSwitcher />
        <ThemeSwitcher />
        <UserAccountMenu compact />
      </div>
    </header>
  );
}
