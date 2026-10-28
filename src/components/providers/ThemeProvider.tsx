'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

/**
 * Fournit le contexte de thème clair, sombre ou système à l'application.
 * La préférence est persistée dans le localStorage sous la clé ams-theme.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="ams-theme"
    >
      {children}
    </NextThemesProvider>
  );
}