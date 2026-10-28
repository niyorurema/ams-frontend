'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Loader2, MailSearch, RotateCw, ShieldCheck, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api, getErrorMessage } from '@/lib/api';
import { confirmerAvecSweetAlert } from '@/lib/confirmation';

interface LdapTestResult {
  success: boolean;
  message?: string;
  resultats: Record<string, { statut: string; message: string; duree_ms: number }>;
}

interface LdapSyncResult {
  total: number;
  crees: number;
  maj: number;
  ignores: number;
  erreurs: number;
}

interface EmployeeEmailSyncResult {
  employes_sans_email: number;
  correspondances: number;
  emails_employes_mis_a_jour: number;
  comptes_sans_email: number;
  emails_comptes_mis_a_jour: number;
  ambigus: number;
  introuvables: number;
  emails_invalides: number;
  collisions: number;
}

interface ApiResponse<T> {
  data: T;
}

export function LdapToolsCard() {
  const t = useTranslations('parametres.tenant.ldap');
  const tCommon = useTranslations('common');
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<ApiResponse<LdapTestResult>>('/api/auth/ldap/test', {});
      return response.data.data;
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const syncMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const response = await api.post<ApiResponse<LdapSyncResult>>('/api/auth/ldap/sync-users', {
        dry_run: dryRun,
      });
      return response.data.data;
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const emailPreviewMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<ApiResponse<EmployeeEmailSyncResult>>(
        '/api/admin/tenant/ldap/employees/email-preview',
        {},
        { timeout: 120_000 },
      );
      return response.data.data;
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const emailApplyMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<ApiResponse<EmployeeEmailSyncResult>>(
        '/api/admin/tenant/ldap/employees/email-apply',
        { confirm: true },
        { timeout: 120_000 },
      );
      return response.data.data;
    },
    onSuccess: () => {
      emailPreviewMutation.reset();
      toast.success(t('emailSyncDone'));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const synchroniser = async (simulation: boolean) => {
    if (!simulation && !await confirmerAvecSweetAlert(t('confirmerSynchronisation'), {
      title: tCommon('confirm'),
      confirmButtonText: tCommon('yes'),
      cancelButtonText: tCommon('no'),
      destructive: true,
    })) return;
    syncMutation.mutate(simulation);
  };
  const synchroniserEmails = async () => {
    const preview = emailPreviewMutation.data;
    if (!preview) return;
    if (!await confirmerAvecSweetAlert(t('emailSyncConfirm', {
      employees: preview.emails_employes_mis_a_jour,
      accounts: preview.emails_comptes_mis_a_jour,
    }), {
      title: tCommon('confirm'),
      confirmButtonText: tCommon('yes'),
      cancelButtonText: tCommon('no'),
      destructive: true,
    })) return;
    emailApplyMutation.mutate();
  };
  const previsualiserEmails = () => {
    emailApplyMutation.reset();
    emailPreviewMutation.mutate();
  };
  const emailResult = emailApplyMutation.data ?? emailPreviewMutation.data;
  const emailResultIsApplied = emailApplyMutation.data !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-5" />
          {t('titre')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('configurationExterne')}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}>
            {testMutation.isPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <RotateCw aria-hidden="true" className="size-4" />}
            {t('tester')}
          </Button>
          <Button type="button" variant="outline" disabled={syncMutation.isPending} onClick={() => void synchroniser(true)}>
            {t('simuler')}
          </Button>
          <Button type="button" disabled={syncMutation.isPending} onClick={() => void synchroniser(false)}>
            {syncMutation.isPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <UsersRound aria-hidden="true" className="size-4" />}
            {t('synchroniser')}
          </Button>
        </div>

        {testMutation.data && (
          <div className="space-y-2 rounded-md border p-3 text-sm" aria-live="polite">
            <p className="font-medium">{testMutation.data.success ? t('testReussi') : testMutation.data.message ?? t('testEchoue')}</p>
            {Object.entries(testMutation.data.resultats).map(([host, result]) => (
              <p key={host} className="text-muted-foreground">
                <span className="font-medium text-foreground">{host}</span> — {result.statut} · {result.duree_ms} ms · {result.message}
              </p>
            ))}
          </div>
        )}

        {syncMutation.data && (
          <div className="space-y-2 rounded-md border p-3" aria-live="polite">
            <p className="text-sm font-medium">
              {syncMutation.variables ? t('resultatSimulation') : t('resultatSynchronisation')}
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              {(['total', 'crees', 'maj', 'ignores', 'erreurs'] as const).map((key) => (
                <div key={key}>
                  <dt className="text-muted-foreground">{t(key)}</dt>
                  <dd className="font-semibold">{syncMutation.data[key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MailSearch aria-hidden="true" className="size-4" />
              {t('emailSyncTitle')}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('emailSyncDescription')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={emailPreviewMutation.isPending || emailApplyMutation.isPending}
              onClick={previsualiserEmails}
            >
              {emailPreviewMutation.isPending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
              {t('emailSyncPreview')}
            </Button>
            <Button
              type="button"
              disabled={!emailPreviewMutation.data
                || emailPreviewMutation.data.emails_employes_mis_a_jour === 0
                || emailPreviewMutation.isPending
                || emailApplyMutation.isPending}
              onClick={() => void synchroniserEmails()}
            >
              {emailApplyMutation.isPending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
              {t('emailSyncApply')}
            </Button>
          </div>
          {emailResult && (
            <div className="space-y-2 rounded-md border p-3" aria-live="polite">
              <p className="text-sm font-medium">
                {t(emailResultIsApplied ? 'emailSyncApplyResult' : 'emailSyncPreviewResult')}
              </p>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                {([
                  ['employes_sans_email', 'emailSyncEmployeesMissing'],
                  ['correspondances', 'emailSyncMatches'],
                  ['emails_employes_mis_a_jour', 'emailSyncEmployeesUpdated'],
                  ['comptes_sans_email', 'emailSyncAccountsMissing'],
                  ['emails_comptes_mis_a_jour', 'emailSyncAccountsUpdated'],
                  ['ambigus', 'emailSyncAmbiguous'],
                  ['introuvables', 'emailSyncNotFound'],
                  ['emails_invalides', 'emailSyncInvalid'],
                  ['collisions', 'emailSyncConflicts'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground">{t(label)}</dt>
                    <dd className="font-semibold">{emailResult[key]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
