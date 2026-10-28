'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Mail, Network, Save, Server, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getErrorMessage,
} from '@/lib/api';
import {
  useSystemIntegrationSettings,
  useTestGpioConnection,
  useTestSmtpConnection,
  useUpdateSystemIntegrationSettings,
  type GpioSettingsInput,
  type SmtpSettingsInput,
} from '@/hooks/useIntegrationSettings';
import { useAuthStore } from '@/stores/authStore';
import { SystemJobsPanel } from '@/components/settings/system-jobs-panel';

const smtpInitial: SmtpSettingsInput = {
  enabled: false,
  host: '',
  port: 587,
  encryption: 'tls',
  username: '',
  password: '',
  from_email: '',
  from_name: 'AMS',
};

const gpioInitial: GpioSettingsInput = {
  sync_enabled: false,
  hostname: '',
  database: 'etau',
  username: '',
  password: '',
  port: 3306,
};

export default function IntegrationsSettingsPage() {
  const t = useTranslations('parametres.integrations');
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = Boolean(user?.is_super_admin);
  const settingsQuery = useSystemIntegrationSettings(isSuperAdmin);
  const saveSettings = useUpdateSystemIntegrationSettings();
  const testSmtp = useTestSmtpConnection();
  const testGpio = useTestGpioConnection();
  const [smtpDraft, setSmtpDraft] = useState<SmtpSettingsInput | null>(null);
  const [gpioDraft, setGpioDraft] = useState<GpioSettingsInput | null>(null);
  const smtp: SmtpSettingsInput = smtpDraft ?? (settingsQuery.data ? {
    enabled: settingsQuery.data.smtp.enabled,
    host: settingsQuery.data.smtp.host,
    port: settingsQuery.data.smtp.port,
    encryption: settingsQuery.data.smtp.encryption,
    username: settingsQuery.data.smtp.username,
    password: '',
    from_email: settingsQuery.data.smtp.from_email,
    from_name: settingsQuery.data.smtp.from_name,
  } : smtpInitial);
  const gpio: GpioSettingsInput = gpioDraft ?? (settingsQuery.data ? {
    sync_enabled: settingsQuery.data.gpio.sync_enabled,
    hostname: settingsQuery.data.gpio.hostname,
    database: settingsQuery.data.gpio.database,
    username: settingsQuery.data.gpio.username,
    password: '',
    port: settingsQuery.data.gpio.port,
  } : gpioInitial);

  const saveSmtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveSettings.mutateAsync({ smtp });
      setSmtpDraft({ ...smtp, password: '' });
      toast.success(t('saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const saveGpio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveSettings.mutateAsync({ gpio });
      setGpioDraft({ ...gpio, password: '' });
      toast.success(t('saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const testConnection = async (kind: 'smtp' | 'gpio') => {
    try {
      if (kind === 'smtp') {
        await saveSettings.mutateAsync({ smtp });
        setSmtpDraft(smtp);
        await testSmtp.mutateAsync();
      } else {
        await saveSettings.mutateAsync({ gpio });
        setGpioDraft(gpio);
        await testGpio.mutateAsync();
      }
      toast.success(t(kind === 'smtp' ? 'smtpTestSuccess' : 'gpioTestSuccess'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('superAdminOnly')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (settingsQuery.isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t('loading')}</div>;
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription role="alert">{t('loadError')}</CardDescription>
        </CardHeader>
        <CardContent><Button variant="outline" onClick={() => settingsQuery.refetch()}>{t('retry')}</Button></CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('description')}</p>
      </header>

      {settingsQuery.data.smtp.legacy_configuration || settingsQuery.data.gpio.legacy_configuration ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">{t('legacyNotice')}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail aria-hidden="true" className="size-5" />{t('smtpTitle')}</CardTitle>
          <CardDescription>{t('smtpDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void saveSmtp(event)} className="space-y-5">
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={smtp.enabled} onChange={(event) => setSmtpDraft({ ...smtp, enabled: event.target.checked })} />
              {t('smtpEnabled')}
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor="smtp-host">{t('smtpHost')}</Label><Input id="smtp-host" required={smtp.enabled} maxLength={255} value={smtp.host} onChange={(event) => setSmtpDraft({ ...smtp, host: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="smtp-port">{t('smtpPort')}</Label><Input id="smtp-port" type="number" required min={1} max={65535} value={smtp.port} onChange={(event) => setSmtpDraft({ ...smtp, port: Number(event.target.value) })} /></div>
              <div className="grid gap-2"><Label htmlFor="smtp-encryption">{t('encryption')}</Label>
                <Select value={smtp.encryption} onValueChange={(value) => { if (value === 'none' || value === 'tls' || value === 'ssl') setSmtpDraft({ ...smtp, encryption: value }); }}>
                  <SelectTrigger id="smtp-encryption"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">{t('noEncryption')}</SelectItem><SelectItem value="tls">STARTTLS</SelectItem><SelectItem value="ssl">SSL/TLS</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label htmlFor="smtp-username">{t('smtpUsername')}</Label><Input id="smtp-username" autoComplete="username" maxLength={255} value={smtp.username} onChange={(event) => setSmtpDraft({ ...smtp, username: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="smtp-password">{t('smtpPassword')}</Label><Input id="smtp-password" type="password" autoComplete="new-password" value={smtp.password} placeholder={settingsQuery.data.smtp.password_configured ? t('secretUnchanged') : ''} onChange={(event) => setSmtpDraft({ ...smtp, password: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="smtp-from-email">{t('smtpFromEmail')}</Label><Input id="smtp-from-email" type="email" required={smtp.enabled} maxLength={150} value={smtp.from_email} onChange={(event) => setSmtpDraft({ ...smtp, from_email: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="smtp-from-name">{t('smtpFromName')}</Label><Input id="smtp-from-name" maxLength={150} value={smtp.from_name} onChange={(event) => setSmtpDraft({ ...smtp, from_name: event.target.value })} /></div>
            </div>
            {settingsQuery.data.smtp.password_configured && <p className="text-sm text-muted-foreground">{t('secretConfigured')}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saveSettings.isPending}>{saveSettings.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{t('save')}</Button>
              <Button type="button" variant="outline" disabled={testSmtp.isPending || saveSettings.isPending} onClick={() => void testConnection('smtp')}>{testSmtp.isPending || saveSettings.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{t('testConnection')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Network aria-hidden="true" className="size-5" />{t('gpioTitle')}</CardTitle>
          <CardDescription>{t('gpioDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void saveGpio(event)} className="space-y-5">
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={gpio.sync_enabled} onChange={(event) => setGpioDraft({ ...gpio, sync_enabled: event.target.checked })} />
              {t('gpioEnabled')}
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor="gpio-host">{t('gpioHost')}</Label><Input id="gpio-host" required={gpio.sync_enabled} maxLength={255} value={gpio.hostname} onChange={(event) => setGpioDraft({ ...gpio, hostname: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="gpio-database">{t('gpioDatabase')}</Label><Input id="gpio-database" required={gpio.sync_enabled} maxLength={64} value={gpio.database} onChange={(event) => setGpioDraft({ ...gpio, database: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="gpio-port">{t('gpioPort')}</Label><Input id="gpio-port" type="number" required min={1} max={65535} value={gpio.port} onChange={(event) => setGpioDraft({ ...gpio, port: Number(event.target.value) })} /></div>
              <div className="grid gap-2"><Label htmlFor="gpio-username">{t('gpioUsername')}</Label><Input id="gpio-username" autoComplete="username" required={gpio.sync_enabled} maxLength={100} value={gpio.username} onChange={(event) => setGpioDraft({ ...gpio, username: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="gpio-password">{t('gpioPassword')}</Label><Input id="gpio-password" type="password" autoComplete="new-password" value={gpio.password} placeholder={settingsQuery.data.gpio.password_configured ? t('secretUnchanged') : ''} onChange={(event) => setGpioDraft({ ...gpio, password: event.target.value })} /></div>
            </div>
            {settingsQuery.data.gpio.password_configured && <p className="text-sm text-muted-foreground">{t('secretConfigured')}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saveSettings.isPending}>{saveSettings.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{t('save')}</Button>
              <Button type="button" variant="outline" disabled={testGpio.isPending || saveSettings.isPending} onClick={() => void testConnection('gpio')}>{testGpio.isPending || saveSettings.isPending ? <Loader2 className="size-4 animate-spin" /> : <Server className="size-4" />}{t('testConnection')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <SystemJobsPanel />
      <p className="text-sm text-muted-foreground">{t('encryptionNotice')}</p>
    </div>
  );
}
