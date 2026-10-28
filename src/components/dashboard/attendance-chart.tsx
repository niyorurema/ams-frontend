'use client';

import { useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { useTranslations } from 'next-intl';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardEvolutionDay } from '@/hooks/useDashboardKpis';
import { usePreferencesStore, type EvolutionChartType } from '@/stores/preferencesStore';

type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'radar' | 'composed';

const COLORS = {
  presents: 'var(--chart-2)',
  retards: 'var(--chart-4)',
  absents: 'var(--chart-1)',
  en_cours: 'var(--chart-3)',
} as const;

const ATTENDANCE_STATUSES = [
  { key: 'presents', label: 'presents' },
  { key: 'retards', label: 'retards' },
  { key: 'absents', label: 'absents' },
  { key: 'en_cours', label: 'enCours' },
] as const;

const CHART_TYPES: ChartType[] = ['bar', 'line', 'area', 'pie', 'radar', 'composed'];

function isChartType(value: string | null): value is ChartType {
  return value !== null && CHART_TYPES.includes(value as ChartType);
}

function isEvolutionChartType(value: ChartType): value is EvolutionChartType {
  return value === 'bar' || value === 'line' || value === 'area' || value === 'pie';
}

function dateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

interface AttendanceChartProps {
  days: DashboardEvolutionDay[];
  isLoading: boolean;
  isError: boolean;
  latestDate?: string;
}

/** Graphique des présences avec une plage de dates et plusieurs visualisations. */
export function AttendanceChart({ days, isLoading, isError, latestDate }: AttendanceChartProps) {
  const t = useTranslations('dashboard.attendanceChart');
  const [dateFinOverride, setDateFinOverride] = useState<string | null>(null);
  const [dateDebutOverride, setDateDebutOverride] = useState<string | null>(null);
  const latestAvailableDate = latestDate ?? dateString(new Date());
  const dateFin = dateFinOverride ?? latestAvailableDate;
  const dateDebut = dateDebutOverride ?? dateString(subDays(parseISO(latestAvailableDate), 29));
  const preferredChartType = usePreferencesStore((state) => state.attendanceChartType);
  const setPreferredChartType = usePreferencesStore((state) => state.setAttendanceChartType);
  const [chartType, setChartType] = useState<ChartType>(preferredChartType);
  const datesValides = Boolean(dateDebut && dateFin && dateDebut <= dateFin);

  const chartData = useMemo(
    () =>
      days.filter((item) => item.date >= dateDebut && item.date <= dateFin).map((item) => ({
        ...item,
        dateFormatted: format(parseISO(item.date), 'dd/MM'),
      })) ?? [],
    [days, dateDebut, dateFin]
  );
  const totals = useMemo(
    () => chartData.reduce(
      (sum, item) => ({
        presents: sum.presents + item.presents,
        retards: sum.retards + item.retards,
        absents: sum.absents + item.absents,
        en_cours: sum.en_cours + item.en_cours,
      }),
      { presents: 0, retards: 0, absents: 0, en_cours: 0 },
    ),
    [chartData],
  );
  const pieData = [
    { name: t('presents'), value: totals.presents, fill: COLORS.presents },
    { name: t('retards'), value: totals.retards, fill: COLORS.retards },
    { name: t('absents'), value: totals.absents, fill: COLORS.absents },
    { name: t('enCours'), value: totals.en_cours, fill: COLORS.en_cours },
  ];

  function definirPeriode(jours: number) {
    const fin = parseISO(latestAvailableDate);
    setDateFinOverride(dateString(fin));
    setDateDebutOverride(dateString(subDays(fin, jours - 1)));
  }

  function renderChart() {
    if (chartData.length === 0) {
      return <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">{t('noData')}</div>;
    }

    const axes = (
      <>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="dateFormatted" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
      </>
    );

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              {axes}
              <Bar dataKey="presents" fill={COLORS.presents} name={t('presents')} />
              <Bar dataKey="retards" fill={COLORS.retards} name={t('retards')} />
              <Bar dataKey="absents" fill={COLORS.absents} name={t('absents')} />
              <Bar dataKey="en_cours" fill={COLORS.en_cours} name={t('enCours')} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              {axes}
              <Line type="monotone" dataKey="presents" stroke={COLORS.presents} name={t('presents')} />
              <Line type="monotone" dataKey="retards" stroke={COLORS.retards} name={t('retards')} />
              <Line type="monotone" dataKey="absents" stroke={COLORS.absents} name={t('absents')} />
              <Line type="monotone" dataKey="en_cours" stroke={COLORS.en_cours} name={t('enCours')} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData}>
              {axes}
              <Area type="monotone" dataKey="presents" stackId="1" stroke={COLORS.presents} fill={COLORS.presents} name={t('presents')} />
              <Area type="monotone" dataKey="retards" stackId="1" stroke={COLORS.retards} fill={COLORS.retards} name={t('retards')} />
              <Area type="monotone" dataKey="absents" stackId="1" stroke={COLORS.absents} fill={COLORS.absents} name={t('absents')} />
              <Area type="monotone" dataKey="en_cours" stackId="1" stroke={COLORS.en_cours} fill={COLORS.en_cours} name={t('enCours')} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={105} label>
                {pieData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={pieData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" />
              <PolarRadiusAxis allowDecimals={false} />
              <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.45} />
              <Tooltip />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        );
      case 'composed':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              {axes}
              <Bar dataKey="presents" fill={COLORS.presents} name={t('presents')} />
              <Line type="monotone" dataKey="retards" stroke={COLORS.retards} name={t('retards')} />
              <Line type="monotone" dataKey="absents" stroke={COLORS.absents} name={t('absents')} />
              <Line type="monotone" dataKey="en_cours" stroke={COLORS.en_cours} name={t('enCours')} />
            </ComposedChart>
          </ResponsiveContainer>
        );
    }
  }

  return (
    <Card data-widget-id="chart-evolution" className="sm:col-span-2 xl:col-span-4">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{t('title')}</CardTitle>
        <Select value={chartType} onValueChange={(value) => {
          if (!isChartType(value)) return;
          setChartType(value);
          if (isEvolutionChartType(value)) setPreferredChartType(value);
        }}>
          <SelectTrigger className="w-full sm:w-48" aria-label={t('chartType')}>
            <SelectValue>{t(`types.${chartType}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CHART_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{t(`types.${type}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm text-muted-foreground">
            {t('from')}
            <Input type="date" value={dateDebut} max={dateFin} onChange={(event) => setDateDebutOverride(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            {t('to')}
            <Input type="date" value={dateFin} min={dateDebut} max={latestAvailableDate} onChange={(event) => setDateFinOverride(event.target.value)} />
          </label>
          {[
            { days: 7, label: 'seven' },
            { days: 30, label: 'thirty' },
            { days: 90, label: 'ninety' },
          ].map(({ days, label }) => (
            <Button key={days} type="button" variant="outline" size="sm" onClick={() => definirPeriode(days)}>
              {t(`periods.${label}`)}
            </Button>
          ))}
        </div>

        {!isLoading && !isError && chartData.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {ATTENDANCE_STATUSES.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2 rounded-lg border p-3">
                <span className="size-3 rounded-full" style={{ backgroundColor: COLORS[key] }} />
                <div>
                  <p className="text-xs text-muted-foreground">{t(label)}</p>
                  <p className="font-semibold tabular-nums">{totals[key]}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!datesValides ? (
          <div role="alert" className="flex h-80 items-center justify-center text-sm text-destructive">{t('invalidRange')}</div>
        ) : isLoading ? (
          <Skeleton className="h-80 w-full" />
        ) : isError ? (
          <div role="alert" className="flex h-80 items-center justify-center text-sm text-destructive">{t('error')}</div>
        ) : (
          renderChart()
        )}
      </CardContent>
    </Card>
  );
}
