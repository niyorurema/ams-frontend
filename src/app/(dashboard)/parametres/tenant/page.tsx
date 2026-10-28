'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Building2, ImagePlus, Loader2, RotateCcw, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/api';
import {
  useTenantConfig,
  useUpdateTenantConfig,
  useUploadLogo,
  type TenantConfigUpdate,
} from '@/hooks/useTenantConfig';
import { useTenantStore } from '@/stores/tenantStore';
import { useAuthStore } from '@/stores/authStore';

const defaultConfiguration: TenantConfigUpdate = {
  name: '',
  slogan: '',
  primary_color: '#1f2937',
  secondary_color: '#f3f4f6',
  font_family: 'Inter',
  font_size: 'normal',
  timezone: 'Africa/Bujumbura',
  jours_travailles: [1, 2, 3, 4, 5],
};

const fontFamilies = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'] as const;
const fontSizes = ['small', 'normal', 'large', 'xlarge'] as const;

function messageErreur(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message;
  }

  return getErrorMessage(error);
}

/** Configuration de l'identité visuelle du tenant connecté. */
export default function TenantSettingsPage() {
  const t = useTranslations('parametres.tenant');
  const common = useTranslations('common');
  const fileInput = useRef<HTMLInputElement>(null);
  const configurationQuery = useTenantConfig();
  const updateMutation = useUpdateTenantConfig();
  const uploadMutation = useUploadLogo();
  const storedTenant = useTenantStore((state) => state.tenant);
  const user = useAuthStore((state) => state.user);
  const [draft, setDraft] = useState<TenantConfigUpdate | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const configuration = configurationQuery.data ?? storedTenant;
  const values: TenantConfigUpdate = draft ?? {
    name: configuration?.name ?? defaultConfiguration.name,
    slogan: configuration?.slogan ?? defaultConfiguration.slogan,
    primary_color: configuration?.primary_color ?? defaultConfiguration.primary_color,
    secondary_color: configuration?.secondary_color ?? defaultConfiguration.secondary_color,
    font_family: configuration?.font_family ?? defaultConfiguration.font_family,
    font_size: configuration?.font_size ?? defaultConfiguration.font_size,
    timezone: configuration?.timezone ?? defaultConfiguration.timezone,
    jours_travailles: configuration?.jours_travailles ?? defaultConfiguration.jours_travailles,
  };
  const joursSemaine = [
    { value: 1, label: t('jours.lundi') },
    { value: 2, label: t('jours.mardi') },
    { value: 3, label: t('jours.mercredi') },
    { value: 4, label: t('jours.jeudi') },
    { value: 5, label: t('jours.vendredi') },
    { value: 6, label: t('jours.samedi') },
    { value: 7, label: t('jours.dimanche') },
  ];

  useEffect(() => {
    if (!logoPreview) return;
    return () => URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const updateDraft = (partial: Partial<TenantConfigUpdate>) => {
    setDraft((current) => ({
      ...values,
      ...(current ?? {}),
      ...partial,
    }));
  };

  const handleLogo = (file?: File) => {
    if (!file) return;
    const extensionValide = /\.(png|jpe?g|svg)$/i.test(file.name);
    const typesValides = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!extensionValide || !typesValides.includes(file.type)) {
      toast.error(t('logoFormatInvalide'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('logoTropGrand'));
      return;
    }

    setLogoPreview(URL.createObjectURL(file));
    setLogoFile(file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleLogo(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleLogo(event.dataTransfer.files[0]);
  };

  const supprimerLogo = async () => {
    try {
      const saved = await updateMutation.mutateAsync({ ...values, logo_url: null });
      setDraft({
        name: saved.name,
        slogan: saved.slogan ?? '',
        primary_color: saved.primary_color ?? defaultConfiguration.primary_color,
        secondary_color: saved.secondary_color ?? defaultConfiguration.secondary_color,
        font_family: saved.font_family ?? 'Inter',
        font_size: saved.font_size ?? 'normal',
        timezone: saved.timezone ?? 'Africa/Bujumbura',
        jours_travailles: saved.jours_travailles ?? defaultConfiguration.jours_travailles,
      });
      setLogoFile(null);
      setLogoPreview(null);
      toast.success(t('logoSupprime'));
    } catch (error) {
      toast.error(messageErreur(error));
    }
  };

  const enregistrer = async () => {
    try {
      const saved = await updateMutation.mutateAsync(values);
      if (logoFile) {
        await uploadMutation.mutateAsync(logoFile);
        setLogoFile(null);
        setLogoPreview(null);
      }
      setDraft({
        name: saved.name,
        slogan: saved.slogan ?? '',
        primary_color: saved.primary_color ?? defaultConfiguration.primary_color,
        secondary_color: saved.secondary_color ?? defaultConfiguration.secondary_color,
        font_family: saved.font_family ?? 'Inter',
        font_size: saved.font_size ?? 'normal',
        timezone: saved.timezone ?? 'Africa/Bujumbura',
        jours_travailles: saved.jours_travailles ?? defaultConfiguration.jours_travailles,
      });
      toast.success(t('saved'));
    } catch (error) {
      toast.error(messageErreur(error) || t('error'));
    }
  };

  const reinitialiser = () => {
    setDraft(
      configuration
        ? {
            name: configuration.name,
            slogan: configuration.slogan ?? '',
            primary_color: configuration.primary_color ?? defaultConfiguration.primary_color,
            secondary_color: configuration.secondary_color ?? defaultConfiguration.secondary_color,
            font_family: configuration.font_family ?? 'Inter',
            font_size: configuration.font_size ?? 'normal',
            timezone: configuration.timezone ?? 'Africa/Bujumbura',
            jours_travailles: configuration.jours_travailles ?? defaultConfiguration.jours_travailles,
          }
        : defaultConfiguration
    );
    setLogoFile(null);
    setLogoPreview(null);
  };

  const logoUrl = configuration?.logo_url
    ? configuration.logo_url.startsWith('http')
      ? configuration.logo_url
      : `${process.env.NEXT_PUBLIC_API_URL || 'http://10.100.27.136:8080'}/${configuration.logo_url}`
    : null;
  const imageSource = logoPreview || logoUrl;

  if (configurationQuery.isLoading && !configuration) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (configurationQuery.isError && !configuration) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-destructive">{messageErreur(configurationQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => void configurationQuery.refetch()}>
            {common('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (user?.role !== 'admin' && !user?.is_super_admin) {
    return (
      <Card className="w-full">
        <CardContent className="py-12 text-center text-muted-foreground">{t('adminOnly')}</CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{configuration?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={reinitialiser} disabled={updateMutation.isPending || uploadMutation.isPending}>
            <RotateCcw aria-hidden="true" className="size-4" />
            {t('reset')}
          </Button>
          <Button type="button" onClick={() => void enregistrer()} disabled={updateMutation.isPending || uploadMutation.isPending}>
            {(updateMutation.isPending || uploadMutation.isPending) ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            {t('save')}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('logo')}</CardTitle>
          <CardDescription>{t('logoHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`flex min-h-40 flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border'}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg bg-muted">
              {imageSource ? (
                <Image
                  src={imageSource}
                  alt={configuration?.name ?? t('logo')}
                  width={96}
                  height={96}
                  unoptimized
                  className="size-full object-contain"
                />
              ) : (
                <ImagePlus aria-hidden="true" className="size-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                <Upload aria-hidden="true" className="size-4" />
                {t('changeLogo')}
              </Button>
              {(logoFile || configuration?.logo_url) && (
                <Button type="button" variant="ghost" onClick={() => {
                  if (logoFile) {
                    setLogoFile(null);
                    setLogoPreview(null);
                  } else {
                    void supprimerLogo();
                  }
                }} disabled={updateMutation.isPending}>
                  {common('delete')}
                </Button>
              )}
              <p className="text-sm text-muted-foreground">{t('dropLogo')}</p>
              {logoFile && <Badge variant="secondary">{logoFile.name}</Badge>}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('joursTravailles')}</CardTitle>
          <CardDescription>{t('joursTravaillesHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {joursSemaine.map((jour) => {
              const actif = values.jours_travailles.includes(jour.value);
              return (
                <Button
                  key={jour.value}
                  type="button"
                  variant={actif ? 'default' : 'outline'}
                  aria-pressed={actif}
                  disabled={actif && values.jours_travailles.length === 1}
                  onClick={() => updateDraft({
                    jours_travailles: actif
                      ? values.jours_travailles.filter((value) => value !== jour.value)
                      : [...values.jours_travailles, jour.value].sort((a, b) => a - b),
                  })}
                >
                  {jour.label}
                </Button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => updateDraft({ jours_travailles: [1, 2, 3, 4, 5] })}>
              {t('presets.lunVen')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => updateDraft({ jours_travailles: [1, 2, 3, 4, 5, 6] })}>
              {t('presets.lunSam')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => updateDraft({ jours_travailles: [1, 2, 3, 4, 5, 6, 7] })}>
              {t('presets.lunDim')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('identity')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="tenant-timezone">{t('timezone')}</Label>
            <Select value={values.timezone ?? 'Africa/Bujumbura'} onValueChange={(timezone) => timezone && updateDraft({ timezone })}>
              <SelectTrigger id="tenant-timezone" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Africa/Bujumbura', 'Africa/Kigali', 'Africa/Nairobi', 'Africa/Dar_es_Salaam', 'UTC'].map((timezone) => (
                  <SelectItem key={timezone} value={timezone}>{timezone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tenant-name">{t('appName')}</Label>
            <Input id="tenant-name" maxLength={150} value={values.name} onChange={(event) => updateDraft({ name: event.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tenant-slogan">{t('slogan')}</Label>
            <Input id="tenant-slogan" maxLength={250} value={values.slogan} onChange={(event) => updateDraft({ slogan: event.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('colors')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ColorInput id="primary-color" label={t('primaryColor')} value={values.primary_color} onChange={(primary_color) => updateDraft({ primary_color })} />
          <ColorInput id="secondary-color" label={t('secondaryColor')} value={values.secondary_color} onChange={(secondary_color) => updateDraft({ secondary_color })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('typography')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="tenant-font">{t('fontFamily')}</Label>
            <Select value={values.font_family} onValueChange={(font_family) => font_family && updateDraft({ font_family })}>
              <SelectTrigger id="tenant-font" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {fontFamilies.map((font) => <SelectItem key={font} value={font}>{font}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tenant-font-size">{t('fontSize')}</Label>
            <Select value={values.font_size} onValueChange={(font_size) => font_size && updateDraft({ font_size })}>
              <SelectTrigger id="tenant-font-size" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {fontSizes.map((size) => <SelectItem key={size} value={size}>{t(`fontSizes.${size}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('preview')}</CardTitle>
          <CardDescription>{t('previewDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ fontFamily: values.font_family, fontSize: ({ small: 14, normal: 16, large: 18, xlarge: 20 } as const)[values.font_size as 'small' | 'normal' | 'large' | 'xlarge'] ?? 16 }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ backgroundColor: values.primary_color }}>
                {imageSource ? (
                  <Image src={imageSource} alt="" width={48} height={48} unoptimized className="size-full object-contain" />
                ) : (
                  <Building2 aria-hidden="true" className="size-6" style={{ color: values.primary_color.toLowerCase() === '#ffffff' ? '#111827' : '#ffffff' }} />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{values.name || 'AMS'}</p>
                {values.slogan && <p className="truncate text-sm text-muted-foreground">{values.slogan}</p>}
              </div>
            </div>
            <Button type="button" style={{ backgroundColor: values.primary_color }}>
              {t('previewButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

function ColorInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <Input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(event) => onChange(event.target.value)} className="h-10 w-16 cursor-pointer p-1" />
        <Input value={value} maxLength={7} pattern="^#[0-9a-fA-F]{6}$" aria-label={label} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}
