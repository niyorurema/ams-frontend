'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Building2, LogOut, Settings, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logout } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';

interface UserAccountMenuProps {
  compact?: boolean;
}

/** Menu de compte partagé par l’en-tête et la navigation latérale. */
export function UserAccountMenu({ compact = false }: UserAccountMenuProps) {
  const t = useTranslations('nav');
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const initials = user?.nom_complet
    ?.trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const handleLogout = async () => {
    await logout();
    toast.success(t('logoutSuccess'));
    router.push('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size={compact ? 'icon' : 'default'}
            aria-label={user?.nom_complet || t('userMenu')}
            className={compact ? 'rounded-full' : 'h-auto w-full justify-start gap-3 px-2 py-2'}
          >
            <Avatar className="size-9 shrink-0">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {!compact && (
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium">{user?.nom_complet || t('userMenu')}</span>
                {user?.email && (
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                )}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate">{user?.nom_complet || t('userMenu')}</span>
            {user?.email && (
              <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {(user?.role === 'admin' || user?.is_super_admin) && (
            <DropdownMenuItem onClick={() => router.push('/parametres/tenant')}>
              <Building2 aria-hidden="true" />
              {t('tenant')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => router.push('/parametres/profil')}>
            <UserRound aria-hidden="true" />
            {t('profil')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/parametres/preferences')}>
            <Settings aria-hidden="true" />
            {t('preferences')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={handleLogout}>
            <LogOut aria-hidden="true" />
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
