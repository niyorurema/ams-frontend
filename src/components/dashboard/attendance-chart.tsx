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
  dateDebut: string;
  dateFin: string;
  onDateRangeChange: (dateDebut: string, dateFin: string) => void;
}

/** Graphique des présences avec une plage de dates et plusieurs visualisations. */
export function AttendanceChart({
  days,
  isLoading,
  isError,
  latestDate,
  dateDebut,
  dateFin,
  onDateRangeChange,
}: AttendanceChartProps) {
  const t = useTranslations('dashboard.attendanceChart');
  const latestAvailableDate = latestDate ?? dateString(new Date());
  const preferredChartType = usePreferencesStore((state) => state.attendanceChartType);
  const setPreferredChartType = usePreferencesStore((state) => state.setAttendanceChartType);
  const [chartType, setChartType] = useState<ChartType>(preferredChartType);
  const datesValides = Boolean(dateDebut && dateFin && dateDebut <= dateFin);
  const firstAvailableDate = days[0]?.date;

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
        total: sum.total + item.total,
      }),
      { presents: 0, retards: 0, absents: 0, en_cours: 0, total: 0 },
    ),
    [chartData],
  );
  const tauxPresencePeriode = totals.total > 0
    ? Math.round((totals.presents / totals.total) * 100)
    : null;
  const tauxAbsencePeriode = totals.total > 0
    ? Math.round((totals.absents / totals.total) * 100)
    : null;
  const pieData = [
    { name: t('presents'), value: totals.presents, fill: COLORS.presents },
    { name: t('retards'), value: totals.retards, fill: COLORS.retards },
    { name: t('absents'), value: totals.absents, fill: COLORS.absents },
    { name: t('enCours'), value: totals.en_cours, fill: COLORS.en_cours },
  ];

  function definirPeriode(jours: number) {
    const fin = parseISO(latestAvailableDate);
    onDateRangeChange(dateString(subDays(fin, jours - 1)), dateString(fin));
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
              <Line type="monotone" dataKey="presents" stroke={COLORS.presents} dot={{ r: 2 }} activeDot={{ r: 4 }} name={t('presents')} />
              <Line type="monotone" dataKey="retards" stroke={COLORS.retards} strokeDasharray="5 3" dot={{ r: 2 }} activeDot={{ r: 4 }} name={t('retards')} />
              <Line type="monotone" dataKey="absents" stroke={COLORS.absents} dot={{ r: 2 }} activeDot={{ r: 4 }} name={t('absents')} />
              <Line type="monotone" dataKey="en_cours" stroke={COLORS.en_cours} dot={{ r: 2 }} activeDot={{ r: 4 }} name={t('enCours')} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData}>
              {axes}
              <Area type="monotone" dataKey="presents" stackId="attendance" stroke={COLORS.presents} fill={COLORS.presents} fillOpacity={0.65} name={t('presents')} />
              <Area type="monotone" dataKey="retards" stackId="attendance" stroke={COLORS.retards} fill={COLORS.retards} fillOpacity={0.65} name={t('retards')} />
              <Area type="monotone" dataKey="absents" stackId="attendance" stroke={COLORS.absents} fill={COLORS.absents} fillOpacity={0.65} name={t('absents')} />
              <Area type="monotone" dataKey="en_cours" stackId="attendance" stroke={COLORS.en_cours} fill={COLORS.en_cours} fillOpacity={0.65} name={t('enCours')} />
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
              <Line type="monotone" dataKey="retards" stroke={COLORS.retards} strokeDasharray="5 3" dot={{ r: 2 }} activeDot={{ r: 4 }} name={t('retards')} />
              <Line type="monotone" dataKey="absents" stroke={COLORS.absents} dot={{ r: 2 }} activeDot={{ r: 4 }} name={t('absents')} />
              <Line type="monotone" dataKey="en_cours" stroke={COLORS.en_cours} dot={{ r: 2 }} activeDot={{ r: 4 }} name={t('enCours')} />
            </ComposedChart>
          </ResponsiveContainer>
        );
    }
  }

  return (
    <Card data-widget-id="chart-evolution" className="sm:col-span-2 xl:col-span-4">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle>{t('title')}</CardTitle>
        <div className="flex flex-wrap items-center justify-end gap-2 xl:flex-nowrap">
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
            {t('from')}
            <Input className="w-32" type="date" value={dateDebut} min={firstAvailableDate} max={dateFin} onChange={(event) => onDateRangeChange(event.target.value, dateFin)} />
          </label>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
            {t('to')}
            <Input className="w-32" type="date" value={dateFin} min={dateDebut} max={latestAvailableDate} onChange={(event) => onDateRangeChange(dateDebut, event.target.value)} />
          </label>
          <div className="flex shrink-0 items-center gap-1">
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
          <Select value={chartType} onValueChange={(value) => {
            if (!isChartType(value)) return;
            setChartType(value);
            if (isEvolutionChartType(value)) setPreferredChartType(value);
          }}>
            <SelectTrigger className="w-48" aria-label={t('chartType')}>
              <SelectValue>{t(`types.${chartType}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CHART_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{t(`types.${type}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {!isLoading && !isError && chartData.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ATTENDANCE_STATUSES.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2 rounded-lg border p-3">
                <span className="size-3 rounded-full" style={{ backgroundColor: COLORS[key] }} />
                <div>
                  <p className="text-xs text-muted-foreground">{t(label)}</p>
                  <p className="font-semibold tabular-nums">{totals[key]}</p>
                  {(key === 'presents' || key === 'absents') && (
                    <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                      {t(key === 'presents' ? 'periodPresenceRate' : 'periodAbsenceRate', {
                        rate: (key === 'presents' ? tauxPresencePeriode : tauxAbsencePeriode) === null
                          ? '—'
                          : `${key === 'presents' ? tauxPresencePeriode : tauxAbsencePeriode}%`,
                      })}
                    </p>
                  )}
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
