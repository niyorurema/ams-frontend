'use client';

import { useEffect } from 'react';
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

    const applyTenantColors = () => {
      root.style.setProperty('--primary', primary);
      root.style.setProperty('--primary-foreground', foregroundFor(primary));
      root.style.setProperty('--sidebar-primary', primary);
      root.style.setProperty('--sidebar-primary-foreground', foregroundFor(primary));
      root.style.setProperty('--ring', primary);
      root.style.setProperty('--sidebar-ring', primary);
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
      root.style.removeProperty('--secondary');
      root.style.removeProperty('--secondary-foreground');
      root.style.removeProperty('--font-sans');
      root.style.removeProperty('font-size');
    };
  }, [configuration, customPrimaryColor, fontFamilyPreference, fontSizePreference, primaryColorPreference]);

  return null;
}
