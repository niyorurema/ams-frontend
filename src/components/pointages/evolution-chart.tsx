'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePreferencesStore, type EvolutionChartType } from '@/stores/preferencesStore';

export interface EvolutionDataPoint {
  date: string;
  label: string;
  count: number;
}

const couleurs = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted-foreground)',
  'var(--secondary-foreground)',
];

/** Graphique de fréquentation avec choix de représentation. */
export function EvolutionChart({ data }: { data: EvolutionDataPoint[] }) {
  const t = useTranslations('pointages');
  const type = usePreferencesStore((state) => state.attendanceChartType);
  const setType = usePreferencesStore((state) => state.setAttendanceChartType);

  const axes = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={data.length > 20 ? Math.ceil(data.length / 10) - 1 : 0} />
      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
      <Tooltip />
      <Legend />
    </>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>{t('evolution30j')}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{t('graphiqueDescription')}</p>
        </div>
        <Select value={type} onValueChange={(value) => { if (value) setType(value as EvolutionChartType); }}>
          <SelectTrigger aria-label={t('graphiqueType')} className="w-40">
            <SelectValue>{t(`graphiqueTypes.${type}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(['bar', 'line', 'area', 'pie'] as const).map((option) => (
              <SelectItem key={option} value={option}>{t(`graphiqueTypes.${option}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">{t('aucunResultat')}</div>
        ) : (
          <div className="h-64 w-full" role="img" aria-label={t('evolution30j')}>
            <ResponsiveContainer width="100%" height="100%">
              {type === 'bar' ? (
                <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  {axes}<Bar dataKey="count" name={t('tooltipPointages')} fill="#0f766e" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              ) : type === 'line' ? (
                <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  {axes}<Line type="monotone" dataKey="count" name={t('tooltipPointages')} stroke="#0f766e" strokeWidth={2} dot={false} />
                </LineChart>
              ) : type === 'area' ? (
                <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  {axes}<Area type="monotone" dataKey="count" name={t('tooltipPointages')} stroke="#0f766e" fill="#0f766e" fillOpacity={0.2} />
                </AreaChart>
              ) : (
                <PieChart>
                  <Tooltip />
                  <Legend />
                  <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={95} label={({ name }) => name}>
                    {data.map((point, index) => <Cell key={point.date} fill={couleurs[index % couleurs.length]} />)}
                  </Pie>
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
