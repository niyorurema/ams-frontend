import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

const supportedLocales = ['fr', 'en'] as const;

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;
  const locale = supportedLocales.find((supportedLocale) => supportedLocale === cookieLocale) ?? 'fr';

  const messages = {
    fr: (await import('@/messages/fr.json')).default,
    en: (await import('@/messages/en.json')).default,
  };

  return {
    locale,
    messages: messages[locale],
  };
});