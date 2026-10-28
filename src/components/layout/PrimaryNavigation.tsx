'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Fingerprint,
  LayoutDashboard,
  Network,
  Settings,
  Users,
  UserRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

const navigation = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'monDossier', href: '/mon-dossier', icon: UserRound },
  { key: 'capteurs', href: '/capteurs', icon: Fingerprint },
  { key: 'employes', href: '/employes', icon: Users },
  { key: 'organisation', href: '/organisation', icon: Network, managerOnly: true },
  { key: 'pointages', href: '/pointages', icon: Clock },
  { key: 'rapports', href: '/rapports', icon: FileText },
  { key: 'parametres', href: '/parametres', icon: Settings },
  { key: 'adminTenants', href: '/admin/tenants', icon: Building2, superAdminOnly: true },
] as const;

interface PrimaryNavigationProps {
  orientation: 'vertical' | 'horizontal';
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function PrimaryNavigation({
  orientation,
  collapsed = false,
  onNavigate,
}: PrimaryNavigationProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const horizontal = orientation === 'horizontal';

  useEffect(() => {
    if (!horizontal) return;

    const element = scrollRef.current;
    if (!element) return;

    const updateScrollState = () => {
      setCanScrollPrevious(element.scrollLeft > 0);
      setCanScrollNext(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
    };

    updateScrollState();
    element.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      element.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [horizontal, user?.is_super_admin, user?.role]);

  const isLecteur = user?.role === 'lecteur';
  const items = navigation
    .filter((item) => {
      if (isLecteur && item.key === 'monDossier') return false;
      if ('superAdminOnly' in item && item.superAdminOnly && !user?.is_super_admin) return false;
      if ('managerOnly' in item && item.managerOnly
        && user?.role !== 'admin' && user?.role !== 'rh' && !user?.is_super_admin) return false;
      return true;
    })
    .map((item) => isLecteur && item.key === 'dashboard'
      ? { ...item, href: '/mon-dossier' }
      : item);

  const scrollByPage = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direction * Math.max(180, scrollRef.current.clientWidth * 0.7), behavior: 'smooth' });
  };

  const links = items.map((item) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const label = t(item.key);
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        onClick={onNavigate}
        title={collapsed ? label : undefined}
        className={cn(
          'flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          horizontal && 'min-h-10 shrink-0 whitespace-nowrap',
          collapsed && 'md:justify-center md:px-2',
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span className={cn(collapsed && 'md:sr-only')}>{label}</span>
      </Link>
    );
  });

  if (!horizontal) {
    return (
      <nav aria-label={t('mainNavigation')} className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {links}
      </nav>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('previousNavigationItems')}
        onClick={() => scrollByPage(-1)}
        disabled={!canScrollPrevious}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </Button>
      <nav
        ref={scrollRef}
        aria-label={t('mainNavigation')}
        className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {links}
      </nav>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('nextNavigationItems')}
        onClick={() => scrollByPage(1)}
        disabled={!canScrollNext}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
