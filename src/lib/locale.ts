'use server';

import { cookies } from 'next/headers';

const supportedLocales = ['fr', 'en', 'rn'] as const;
type Locale = (typeof supportedLocales)[number];

function isLocale(locale: string): locale is Locale {
  return supportedLocales.some((supportedLocale) => supportedLocale === locale);
}

export async function setLocale(locale: string) {
  if (!isLocale(locale)) {
    throw new Error('Langue non prise en charge');
  }

  const cookieStore = await cookies();
  cookieStore.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value;

  return locale && isLocale(locale) ? locale : 'fr';
}