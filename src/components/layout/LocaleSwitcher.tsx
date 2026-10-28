'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setLocale } from '@/lib/locale';
import { usePreferencesStore } from '@/stores/preferencesStore';

const locales = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'rn', label: 'Kirundi' },
] as const;

type Locale = (typeof locales)[number]['code'];

/** Sélecteur de langue qui synchronise le cookie et les préférences locales. */
export function LocaleSwitcher() {
  const currentLocale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const setStoreLocale = usePreferencesStore((state) => state.setLocale);

  const handleChange = (locale: Locale) => {
    startTransition(async () => {
      await setLocale(locale);
      setStoreLocale(locale);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            aria-label={`Langue : ${currentLocale.toUpperCase()}`}
            title={`Langue : ${currentLocale.toUpperCase()}`}
            className="gap-2 px-2"
          />
        }
      >
        <Languages aria-hidden="true" className="size-4" />
        <span className="text-xs font-semibold">{currentLocale.toUpperCase()}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            onClick={() => handleChange(locale.code)}
            aria-current={currentLocale === locale.code ? 'true' : undefined}
          >
            <span className="w-7 font-semibold">{locale.code.toUpperCase()}</span>
            {locale.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}