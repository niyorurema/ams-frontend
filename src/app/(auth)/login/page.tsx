'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Fingerprint, Loader2, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/api';
import { login } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string()
    .trim()
    .min(1, 'Nom d’utilisateur requis')
    .max(254, 'Identifiant trop long')
    .refine((value) => !value.includes('@') || z.email().safeParse(value).success, 'Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

type LoginFormData = z.infer<typeof loginSchema>;
const LAST_LOGIN_KEY = 'ams-last-login';
const OBR_EMAIL_DOMAIN = '@obr.gov.bi';

function usernameForDisplay(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.toLowerCase().endsWith(OBR_EMAIL_DOMAIN)
    ? trimmed.slice(0, -OBR_EMAIL_DOMAIN.length)
    : trimmed;
}

function emailForAuthentication(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.includes('@') ? trimmed : `${trimmed}${OBR_EMAIL_DOMAIN}`;
}

/** Formulaire de connexion AMS avec sélection d'entreprise. */
export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    try {
      const lastLogin = window.localStorage.getItem(LAST_LOGIN_KEY);
      if (lastLogin) setValue('email', usernameForDisplay(lastLogin));
    } catch {
      console.warn('Impossible de récupérer le dernier identifiant de connexion.');
    }
  }, [setValue]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    try {
      const identifier = data.email.trim();
      const session = await login({ ...data, email: emailForAuthentication(identifier) });
      try {
        window.localStorage.setItem(LAST_LOGIN_KEY, usernameForDisplay(identifier));
      } catch {
        console.warn('Impossible de mémoriser le dernier identifiant de connexion.');
      }
      toast.success(t('loginSuccess'));
      router.push(session.user.role === 'lecteur' ? '/mon-dossier' : '/dashboard');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-primary/15 bg-card/95 shadow-2xl shadow-primary/10 backdrop-blur">
      <CardHeader className="space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Fingerprint aria-hidden="true" className="size-7" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-wide">
            <span className="text-primary">OBR</span>
            <span className="mx-2 text-secondary">·</span>
            AMS
          </CardTitle>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="email"
                type="text"
                autoComplete="username"
                placeholder="nom.utilisateur"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className="h-10 pl-10"
                disabled={isLoading}
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="mb-5 space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <div className="relative">
              <Lock
                aria-hidden="true"
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="password"
                type={passwordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className="h-10 pl-10 pr-10"
                disabled={isLoading}
                {...register('password')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground"
                aria-label={passwordVisible ? t('hidePassword') : t('showPassword')}
                aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible
                  ? <EyeOff aria-hidden="true" className="size-4" />
                  : <Eye aria-hidden="true" className="size-4" />}
              </Button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-sm text-destructive" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="h-10 w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                {t('loggingIn')}
              </>
            ) : (
              t('loginButton')
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">© 2026 OBR - AMS</p>
        </CardFooter>
      </form>
    </Card>
  );
}