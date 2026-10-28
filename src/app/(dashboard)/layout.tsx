'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { PrimaryNavigation } from '@/components/layout/PrimaryNavigation';
import { TenantAppearance } from '@/components/providers/TenantAppearance';
import { useAuthStore } from '@/stores/authStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useHydrated } from '@/hooks/useHydrated';

/** Protège les pages du dashboard et affiche sa navigation principale. */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const navigationPosition = usePreferencesStore((state) => state.navigationPosition);
  const hasMounted = useHydrated();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (hasMounted && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hasMounted, isAuthenticated, router]);

  useEffect(() => {
    const redirectToLogin = () => router.replace('/login');
    window.addEventListener('ams:unauthorized', redirectToLogin);
    return () => window.removeEventListener('ams:unauthorized', redirectToLogin);
  }, [router]);

  useEffect(() => {
    if (hasMounted && isAuthenticated && user?.role === 'lecteur' && pathname === '/dashboard') {
      router.replace('/mon-dossier');
    }
  }, [hasMounted, isAuthenticated, pathname, router, user?.role]);

  if (!hasMounted || !isAuthenticated || (user?.role === 'lecteur' && pathname === '/dashboard')) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div
          aria-label="Chargement"
          className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary"
        />
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <TenantAppearance />
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onMobileMenuToggle={() => setMobileSidebarOpen((open) => !open)}
          mobileMenuOpen={mobileSidebarOpen}
        />
        <main className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 ${navigationPosition === 'bottom' ? 'md:pb-24' : ''}`}>
          {children}
        </main>
      </div>
      {navigationPosition === 'bottom' && (
        <div className="fixed inset-x-0 bottom-0 z-30 hidden border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur md:block">
          <div className="flex w-full justify-center px-2 py-2 sm:px-4">
            <PrimaryNavigation
              orientation="horizontal"
            />
          </div>
        </div>
      )}
    </div>
  );
}