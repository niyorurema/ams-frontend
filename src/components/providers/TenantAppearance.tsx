'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useTenantStore } from '@/stores/tenantStore';

const fontStacks: Record<string, string> = {
  Inter: '"Inter", Arial, sans-serif',
  Roboto: '"Roboto", Arial, sans-serif',
  'Open Sans': '"Open Sans", Arial, sans-serif',
  Lato: '"Lato", Arial, sans-serif',
  Montserrat: '"Montserrat", Arial, sans-serif',
};

const fontSizes: Record<string, string> = {
  small: '14px',
  normal: '16px',
  large: '18px',
  xlarge: '20px',
};

const preferenceFontFamilies: Record<string, string> = {
  Inter: '"Inter", Arial, sans-serif',
  Roboto: '"Roboto", Arial, sans-serif',
  'Open Sans': '"Open Sans", Arial, sans-serif',
  Lato: '"Lato", Arial, sans-serif',
  Montserrat: '"Montserrat", Arial, sans-serif',
};

const preferenceFontSizes: Record<string, string> = {
  small: '14px',
  normal: '16px',
  large: '18px',
  xlarge: '20px',
};

function foregroundFor(color: string): string {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return 'oklch(0.985 0 0)';

  const [red, green, blue] = [0, 2, 4].map((index) => {
    const channel = Number.parseInt(match[1].slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.42 ? '#111827' : '#ffffff';
}

/** Charge et applique les couleurs, la police et la taille du tenant connecté. */
export function TenantAppearance() {
  const { data } = useTenantConfig();
  const tenant = useTenantStore((state) => state.tenant);
  const setTenant = useTenantStore((state) => state.setTenant);
  const fontFamilyPreference = usePreferencesStore((state) => state.fontFamily);
  const fontSizePreference = usePreferencesStore((state) => state.fontSize);
  const primaryColorPreference = usePreferencesStore((state) => state.primaryColor);
  const customPrimaryColor = usePreferencesStore((state) => state.customPrimaryColor);
  const { resolvedTheme } = useTheme();
  const configuration = data ?? tenant;

  useEffect(() => {
    if (data && data !== tenant) setTenant(data);
  }, [data, setTenant, tenant]);

  useEffect(() => {
    const root = document.documentElement;
    const primary = {
      red: '#b3262d',
      black: '#171717',
      blue: '#2563eb',
      custom: /^#[\da-f]{6}$/i.test(customPrimaryColor) ? customPrimaryColor : '#2563eb',
    }[primaryColorPreference];
    const configuredSecondary = configuration?.secondary_color ?? '';
    const secondary = /^#[\da-f]{6}$/i.test(configuredSecondary)
      ? configuredSecondary
      : '#858779';
    const configuredSidebar = configuration?.sidebar_color ?? '#ffffff';
    const sidebar = /^#[\da-f]{6}$/i.test(configuredSidebar) ? configuredSidebar : '#ffffff';
    const configuredTopbar = configuration?.topbar_color ?? '#ffffff';
    const topbar = /^#[\da-f]{6}$/i.test(configuredTopbar) ? configuredTopbar : '#ffffff';

    const applyTenantColors = () => {
      const isDark = root.classList.contains('dark') || resolvedTheme === 'dark';
      const isAurora = root.classList.contains('aurore');
      root.style.setProperty('--primary', primary);
      root.style.setProperty('--primary-foreground', foregroundFor(primary));
      root.style.setProperty('--sidebar-primary', primary);
      root.style.setProperty('--sidebar-primary-foreground', foregroundFor(primary));
      root.style.setProperty('--ring', primary);
      root.style.setProperty('--sidebar-ring', primary);
      if (isDark) {
        root.style.setProperty('--sidebar', '#171717');
        root.style.setProperty('--sidebar-foreground', '#ffffff');
        root.style.setProperty('--sidebar-accent', '#262626');
        root.style.setProperty('--sidebar-accent-foreground', '#ffffff');
        root.style.setProperty('--header-background', '#171717');
        root.style.setProperty('--header-foreground', '#ffffff');
      } else if (isAurora) {
        root.style.setProperty('--sidebar', '#fff7fb');
        root.style.setProperty('--sidebar-foreground', '#382a3a');
        root.style.setProperty('--sidebar-accent', '#f5e6f1');
        root.style.setProperty('--sidebar-accent-foreground', '#382a3a');
        root.style.setProperty('--header-background', '#fff7fb');
        root.style.setProperty('--header-foreground', '#382a3a');
      } else {
        root.style.setProperty('--sidebar', sidebar);
        root.style.setProperty('--sidebar-foreground', foregroundFor(sidebar));
        root.style.setProperty('--sidebar-accent', '#e5e7eb');
        root.style.setProperty('--sidebar-accent-foreground', foregroundFor(sidebar));
        root.style.setProperty('--header-background', topbar);
        root.style.setProperty('--header-foreground', foregroundFor(topbar));
      }
      if (configuration && !root.classList.contains('dark')) {
        root.style.setProperty('--secondary', secondary);
        root.style.setProperty('--secondary-foreground', foregroundFor(secondary));
      } else {
        root.style.removeProperty('--secondary');
        root.style.removeProperty('--secondary-foreground');
      }
    };

    applyTenantColors();
    const themeObserver = new MutationObserver(applyTenantColors);
    themeObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
    root.style.setProperty(
      '--font-sans',
      preferenceFontFamilies[fontFamilyPreference]
        ?? fontStacks[configuration?.font_family ?? '']
        ?? fontStacks.Inter
    );
    root.style.fontSize =
      preferenceFontSizes[fontSizePreference]
      ?? fontSizes[configuration?.font_size ?? '']
      ?? fontSizes.normal;

    return () => {
      themeObserver.disconnect();
      root.style.removeProperty('--primary');
      root.style.removeProperty('--primary-foreground');
      root.style.removeProperty('--sidebar-primary');
      root.style.removeProperty('--sidebar-primary-foreground');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--sidebar-ring');
      root.style.removeProperty('--sidebar');
      root.style.removeProperty('--sidebar-foreground');
      root.style.removeProperty('--sidebar-accent');
      root.style.removeProperty('--sidebar-accent-foreground');
      root.style.removeProperty('--header-background');
      root.style.removeProperty('--header-foreground');
      root.style.removeProperty('--secondary');
      root.style.removeProperty('--secondary-foreground');
      root.style.removeProperty('--font-sans');
      root.style.removeProperty('font-size');
    };
  }, [configuration, customPrimaryColor, fontFamilyPreference, fontSizePreference, primaryColorPreference, resolvedTheme]);

  return null;
}
