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
      className="grid h-16 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-2 border-b bg-card px-2 sm:px-4"
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

      <div className="min-w-0 max-w-[52vw] justify-self-center">
        {navigationPosition === 'top' && (
          <div className="hidden md:block">
            <PrimaryNavigation orientation="horizontal" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
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
