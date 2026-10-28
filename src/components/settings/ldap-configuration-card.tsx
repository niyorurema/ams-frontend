'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getErrorMessage } from '@/lib/api';
import { useLdapSettings, useUpdateLdapSettings, type LdapSettings } from '@/hooks/useIntegrationSettings';

type LdapForm = Omit<LdapSettings, 'bind_password_configured' | 'legacy_configuration' | 'ldap_port'> & {
  ldap_port: number;
  ldap_bind_password: string;
};

const emptyForm: LdapForm = {
  auth_mode: 'LOCAL',
  ldap_host: '',
  ldap_host_secondary: '',
  ldap_host_tertiary: '',
  ldap_port: 389,
  ldap_base_dn: '',
  ldap_bind_dn: '',
  ldap_bind_password: '',
  ldap_user_filter: '(sAMAccountName={username})',
  ldap_use_tls: false,
  ldap_attr_email: 'mail',
  ldap_attr_nom: 'sn',
  ldap_attr_prenom: 'givenName',
  ldap_attr_matricule: 'employeeID',
};

export function LdapConfigurationCard() {
  const t = useTranslations('parametres.ldap.configuration');
  const query = useLdapSettings();
  const update = useUpdateLdapSettings();
  const [formDraft, setFormDraft] = useState<LdapForm | null>(null);
  const form: LdapForm = formDraft ?? (query.data
    ? {
      auth_mode: query.data.auth_mode,
      ldap_host: query.data.ldap_host,
      ldap_host_secondary: query.data.ldap_host_secondary,
      ldap_host_tertiary: query.data.ldap_host_tertiary,
      ldap_port: query.data.ldap_port,
      ldap_base_dn: query.data.ldap_base_dn,
      ldap_bind_dn: query.data.ldap_bind_dn,
      ldap_bind_password: '',
      ldap_user_filter: query.data.ldap_user_filter,
      ldap_use_tls: query.data.ldap_use_tls,
      ldap_attr_email: query.data.ldap_attr_email,
      ldap_attr_nom: query.data.ldap_attr_nom,
      ldap_attr_prenom: query.data.ldap_attr_prenom,
      ldap_attr_matricule: query.data.ldap_attr_matricule,
    }
    : emptyForm);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await update.mutateAsync(form);
      setFormDraft({ ...form, ldap_bind_password: '' });
      toast.success(t('saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (query.isLoading) {
    return <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t('loading')}</p>;
  }
  if (query.isError || !query.data) {
    return <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{t('loadError')}</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void save(event)} className="space-y-5">
          {query.data.legacy_configuration && <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">{t('legacyNotice')}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ldap-auth-mode">{t('authMode')}</Label>
              <Select value={form.auth_mode} onValueChange={(value) => {
                if (value === 'LOCAL' || value === 'LDAP' || value === 'HYBRIDE') setFormDraft({ ...form, auth_mode: value });
              }}>
                <SelectTrigger id="ldap-auth-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOCAL">{t('local')}</SelectItem>
                  <SelectItem value="LDAP">LDAP</SelectItem>
                  <SelectItem value="HYBRIDE">{t('hybrid')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label htmlFor="ldap-port">{t('port')}</Label><Input id="ldap-port" type="number" min={1} max={65535} required value={form.ldap_port} onChange={(event) => setFormDraft({ ...form, ldap_port: Number(event.target.value) })} /></div>
            <div className="grid gap-2"><Label htmlFor="ldap-host">{t('primaryHost')}</Label><Input id="ldap-host" maxLength={255} value={form.ldap_host} onChange={(event) => setFormDraft({ ...form, ldap_host: event.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="ldap-host-secondary">{t('secondaryHost')}</Label><Input id="ldap-host-secondary" maxLength={255} value={form.ldap_host_secondary} onChange={(event) => setFormDraft({ ...form, ldap_host_secondary: event.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="ldap-host-tertiary">{t('tertiaryHost')}</Label><Input id="ldap-host-tertiary" maxLength={255} value={form.ldap_host_tertiary} onChange={(event) => setFormDraft({ ...form, ldap_host_tertiary: event.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="ldap-base-dn">{t('baseDn')}</Label><Input id="ldap-base-dn" maxLength={255} value={form.ldap_base_dn} onChange={(event) => setFormDraft({ ...form, ldap_base_dn: event.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="ldap-bind-dn">{t('bindDn')}</Label><Input id="ldap-bind-dn" autoComplete="username" maxLength={255} value={form.ldap_bind_dn} onChange={(event) => setFormDraft({ ...form, ldap_bind_dn: event.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="ldap-bind-password">{t('bindPassword')}</Label><Input id="ldap-bind-password" type="password" autoComplete="new-password" value={form.ldap_bind_password} placeholder={query.data.bind_password_configured ? t('secretUnchanged') : ''} onChange={(event) => setFormDraft({ ...form, ldap_bind_password: event.target.value })} /></div>
            <div className="grid gap-2 md:col-span-2"><Label htmlFor="ldap-filter">{t('userFilter')}</Label><Input id="ldap-filter" required maxLength={255} value={form.ldap_user_filter} onChange={(event) => setFormDraft({ ...form, ldap_user_filter: event.target.value })} /></div>
            <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor="ldap-email-attr">{t('emailAttribute')}</Label><Input id="ldap-email-attr" required maxLength={50} value={form.ldap_attr_email} onChange={(event) => setFormDraft({ ...form, ldap_attr_email: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="ldap-surname-attr">{t('surnameAttribute')}</Label><Input id="ldap-surname-attr" required maxLength={50} value={form.ldap_attr_nom} onChange={(event) => setFormDraft({ ...form, ldap_attr_nom: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="ldap-given-attr">{t('givenNameAttribute')}</Label><Input id="ldap-given-attr" required maxLength={50} value={form.ldap_attr_prenom} onChange={(event) => setFormDraft({ ...form, ldap_attr_prenom: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="ldap-employee-attr">{t('employeeIdAttribute')}</Label><Input id="ldap-employee-attr" required maxLength={50} value={form.ldap_attr_matricule} onChange={(event) => setFormDraft({ ...form, ldap_attr_matricule: event.target.value })} /></div>
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={form.ldap_use_tls} onChange={(event) => setFormDraft({ ...form, ldap_use_tls: event.target.checked })} />
            {t('useTls')}
          </label>
          {query.data.bind_password_configured && <p className="text-sm text-muted-foreground">{t('secretConfigured')}</p>}
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
