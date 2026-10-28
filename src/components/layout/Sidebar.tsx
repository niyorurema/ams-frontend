'use client';

import Image from 'next/image';
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PrimaryNavigation } from '@/components/layout/PrimaryNavigation';
import { UserAccountMenu } from '@/components/layout/UserAccountMenu';
import { cn } from '@/lib/utils';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useTenantStore } from '@/stores/tenantStore';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

/** Navigation latérale par défaut, repliable sur ordinateur et tiroir sur mobile. */
export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const t = useTranslations('nav');
  const tenant = useTenantStore((state) => state.tenant);
  const sidebarOpen = usePreferencesStore((state) => state.sidebarOpen);
  const sidebarWidth = usePreferencesStore((state) => state.sidebarWidth);
  const navigationPosition = usePreferencesStore((state) => state.navigationPosition);
  const toggleSidebar = usePreferencesStore((state) => state.toggleSidebar);
  const setSidebarWidth = usePreferencesStore((state) => state.setSidebarWidth);
  const setNavigationPosition = usePreferencesStore((state) => state.setNavigationPosition);
  const [resizingWidth, setResizingWidth] = useState<number | null>(null);
  const resizeStart = useRef<{ x: number; width: number } | null>(null);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label={t('closeNavigation')}
          onClick={onMobileClose}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}
      <aside
        title={navigationPosition === 'left' ? t('moveNavigationToBottom') : undefined}
        onDoubleClick={(event) => {
          if (!window.matchMedia('(min-width: 768px)').matches
            || navigationPosition !== 'left'
            || (event.target instanceof Element && event.target.closest('button, input, [role="button"], [role="separator"]'))) {
            return;
          }
          setNavigationPosition('bottom');
        }}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-dvh w-64 flex-col border-r bg-card transition-[width,transform] duration-200 md:w-[var(--sidebar-width)]',
          navigationPosition === 'left' ? 'md:static md:translate-x-0' : 'md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          !sidebarOpen && 'md:!w-16',
          resizingWidth !== null && 'md:!transition-none',
        )}
        style={{ '--sidebar-width': `${resizingWidth ?? sidebarWidth}px` } as CSSProperties}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-3">
          {(sidebarOpen || mobileOpen) && (
            <div className="flex min-w-0 items-center gap-2">
              {tenant?.logo_url ? (
                <Image
                  src={tenant.logo_url.startsWith('http') ? tenant.logo_url : `${process.env.NEXT_PUBLIC_API_URL || 'http://10.100.27.136:8080'}/${tenant.logo_url}`}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="size-8 shrink-0 rounded-md object-contain"
                />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Building2 aria-hidden="true" className="size-4" />
                </span>
              )}
              <span className="truncate font-semibold">{tenant?.name || 'AMS'}</span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={sidebarOpen ? t('collapseNavigation') : t('expandNavigation')}
            title={sidebarOpen ? t('collapseNavigation') : t('expandNavigation')}
            onClick={toggleSidebar}
            className="ml-auto"
          >
            <ChevronLeft
              aria-hidden="true"
              className={`size-4 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`}
            />
          </Button>
        </div>

        <PrimaryNavigation
          orientation="vertical"
          collapsed={!sidebarOpen && !mobileOpen}
          onNavigate={() => {
            if (window.matchMedia('(max-width: 767px)').matches && mobileOpen) {
              onMobileClose();
            }
          }}
        />

        <div className="mt-auto shrink-0 border-t p-2">
          {sidebarOpen || mobileOpen ? (
            <UserAccountMenu />
          ) : (
            <UserAccountMenu compact />
          )}
        </div>
        {sidebarOpen && (
          <div
            role="separator"
            aria-label={t('resizeNavigation')}
            aria-orientation="vertical"
            aria-valuemin={200}
            aria-valuemax={420}
            aria-valuenow={resizingWidth ?? sidebarWidth}
            tabIndex={0}
            className="absolute inset-y-0 right-0 z-10 hidden w-1 cursor-col-resize touch-none hover:bg-primary/40 focus-visible:bg-primary/50 md:block"
            onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              resizeStart.current = { x: event.clientX, width: sidebarWidth };
              setResizingWidth(sidebarWidth);
            }}
            onPointerMove={(event: PointerEvent<HTMLDivElement>) => {
              if (!resizeStart.current) return;
              const nextWidth = Math.min(420, Math.max(200, resizeStart.current.width + event.clientX - resizeStart.current.x));
              setResizingWidth(nextWidth);
            }}
            onPointerUp={(event: PointerEvent<HTMLDivElement>) => {
              if (!resizeStart.current) return;
              const nextWidth = Math.min(420, Math.max(200, resizeStart.current.width + event.clientX - resizeStart.current.x));
              setSidebarWidth(nextWidth);
              resizeStart.current = null;
              setResizingWidth(null);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              resizeStart.current = null;
              setResizingWidth(null);
            }}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setSidebarWidth(sidebarWidth - 16);
              } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                setSidebarWidth(sidebarWidth + 16);
              }
            }}
          />
        )}
      </aside>
    </>
  );
}
