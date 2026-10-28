'use client';

import { useMemo, useTransition } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { Check, GripVertical, Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { setLocale } from '@/lib/locale';
import {
  usePreferencesStore,
  type PreferenceFontFamily,
  type PreferenceFontSize,
  type WidgetConfig,
} from '@/stores/preferencesStore';

const locales = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'rn', label: 'Kirundi', flag: '🇧🇮' },
] as const;

type Locale = (typeof locales)[number]['code'];

const fontFamilies: PreferenceFontFamily[] = [
  'tenant',
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
];

const fontSizes: PreferenceFontSize[] = [
  'tenant',
  'small',
  'normal',
  'large',
  'xlarge',
];

const themeChoices = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const;

const widgetIds = [
  'stats-employes',
  'stats-pointages',
  'stats-capteurs',
  'stats-presence',
  'stats-retards',
  'stats-heures-sup',
  'chart-evolution',
  'derniers-pointages',
  'capteurs-inactifs',
  'shifts-jour',
  'alertes-jour',
  'top-unites-absentes',
] as const;

const widgetTranslationKeys: Record<(typeof widgetIds)[number], string> = {
  'stats-employes': 'statsEmployes',
  'stats-pointages': 'statsPointages',
  'stats-capteurs': 'statsCapteurs',
  'stats-presence': 'statsPresence',
  'stats-retards': 'statsRetards',
  'stats-heures-sup': 'statsHeuresSup',
  'chart-evolution': 'chartEvolution',
  'derniers-pointages': 'derniersPointages',
  'capteurs-inactifs': 'inactiveCapteurs',
  'shifts-jour': 'shifts',
  'alertes-jour': 'dailyAlerts',
  'top-unites-absentes': 'topAbsentUnits',
};

function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale.code === value);
}

function isWidgetId(value: string): value is (typeof widgetIds)[number] {
  return widgetIds.some((id) => id === value);
}

function isPreferenceFontFamily(value: string): value is PreferenceFontFamily {
  return fontFamilies.some((font) => font === value);
}

function isPreferenceFontSize(value: string): value is PreferenceFontSize {
  return fontSizes.some((size) => size === value);
}

function SortableWidget({
  widget,
  label,
  dragLabel,
  onToggle,
}: {
  widget: WidgetConfig;
  label: string;
  dragLabel: string;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-3 rounded-lg border bg-card p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={dragLabel}
        className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical aria-hidden="true" className="size-5" />
      </button>
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
      <Switch
        checked={widget.visible}
        onCheckedChange={onToggle}
        aria-label={label}
      />
    </div>
  );
}

export default function PreferencesPage() {
  const t = useTranslations('preferences');
  const currentLocaleValue = useLocale();
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const widgets = usePreferencesStore((state) => state.widgets);
  const fontFamily = usePreferencesStore((state) => state.fontFamily);
  const fontSize = usePreferencesStore((state) => state.fontSize);
  const primaryColor = usePreferencesStore((state) => state.primaryColor);
  const customPrimaryColor = usePreferencesStore((state) => state.customPrimaryColor);
  const navigationPosition = usePreferencesStore((state) => state.navigationPosition);
  const setStoreLocale = usePreferencesStore((state) => state.setLocale);
  const setFontFamily = usePreferencesStore((state) => state.setFontFamily);
  const setFontSize = usePreferencesStore((state) => state.setFontSize);
  const setPrimaryColor = usePreferencesStore((state) => state.setPrimaryColor);
  const setCustomPrimaryColor = usePreferencesStore((state) => state.setCustomPrimaryColor);
  const setNavigationPosition = usePreferencesStore((state) => state.setNavigationPosition);
  const toggleWidget = usePreferencesStore((state) => state.toggleWidget);
  const reorderWidgets = usePreferencesStore((state) => state.reorderWidgets);
  const resetPreferences = usePreferencesStore((state) => state.resetPreferences);

  const currentLocale = isLocale(currentLocaleValue) ? currentLocaleValue : 'fr';
  const orderedWidgets = useMemo(
    () =>
      widgets
        .filter((widget): widget is WidgetConfig & { id: (typeof widgetIds)[number] } =>
          isWidgetId(widget.id),
        )
        .sort((first, second) => first.order - second.order),
    [widgets],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleLocaleChange = (locale: Locale) => {
    startTransition(async () => {
      try {
        await setLocale(locale);
        setStoreLocale(locale);
        router.refresh();
        toast.success(t('saved'));
      } catch {
        toast.error(t('localeError'));
      }
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedWidgets.findIndex((widget) => widget.id === active.id);
    const newIndex = orderedWidgets.findIndex((widget) => widget.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    reorderWidgets(
      arrayMove(orderedWidgets, oldIndex, newIndex).map((widget, order) => ({
        ...widget,
        order,
      })),
    );
  };

  const handleReset = () => {
    resetPreferences();
    setTheme('system');
    handleLocaleChange('fr');
  };

  const themeLabels = {
    light: t('themeLight'),
    dark: t('themeDark'),
    system: t('themeSystem'),
  };
  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('autoSave')}</p>
        </div>
        <Button type="button" variant="outline" onClick={handleReset} disabled={isPending}>
          <RotateCcw aria-hidden="true" className="size-4" />
          {t('resetAll')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('appearance')}</CardTitle>
          <CardDescription>{t('appearanceHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t('theme')}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {themeChoices.map(({ value, icon: Icon }) => (
                <label
                  key={value}
                  htmlFor={`theme-${value}`}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/40"
                >
                  <input
                    id={`theme-${value}`}
                    type="radio"
                    name="theme"
                    value={value}
                    checked={theme === value}
                    onChange={() => setTheme(value)}
                    className="size-4 accent-primary"
                  />
                  <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span className="flex-1 text-sm">{themeLabels[value]}</span>
                  {theme === value && (
                    <Check aria-hidden="true" className="size-4 text-primary" />
                  )}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t('primaryColor')}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['red', 'black', 'blue'] as const).map((color) => (
                <label
                  key={color}
                  htmlFor={`primary-color-${color}`}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/40"
                >
                  <input
                    id={`primary-color-${color}`}
                    type="radio"
                    name="primary-color"
                    value={color}
                    checked={primaryColor === color}
                    onChange={() => setPrimaryColor(color)}
                    className="size-4 accent-primary"
                  />
                  <span
                    aria-hidden="true"
                    className="size-5 rounded-full border"
                    style={{
                      backgroundColor: color === 'red'
                        ? '#b3262d'
                        : color === 'black' ? '#171717' : '#2563eb',
                    }}
                  />
                  <span className="flex-1 text-sm">{t(`primaryColors.${color}`)}</span>
                  {primaryColor === color && (
                    <Check aria-hidden="true" className="size-4 text-primary" />
                  )}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <input
                id="primary-color-custom"
                type="color"
                value={customPrimaryColor}
                onChange={(event) => setCustomPrimaryColor(event.target.value)}
                aria-label={t('customPrimaryColor')}
                className="size-10 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              <div className="min-w-0 flex-1">
                <Label htmlFor="primary-color-custom">{t('customPrimaryColor')}</Label>
                <p className="text-xs text-muted-foreground">{t('customPrimaryColorHelp')}</p>
              </div>
              <Button
                type="button"
                variant={primaryColor === 'custom' ? 'default' : 'outline'}
                onClick={() => setPrimaryColor('custom')}
              >
                {t('selectCustomColor')}
              </Button>
              {primaryColor === 'custom' && (
                <Check aria-hidden="true" className="size-4 text-primary" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('primaryColorHelp')}</p>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="preference-font">{t('fontFamily')}</Label>
              <Select
                value={fontFamily}
                onValueChange={(value) => {
                  if (value && isPreferenceFontFamily(value)) setFontFamily(value);
                }}
              >
                <SelectTrigger id="preference-font" className="w-full">
                  <SelectValue>
                    {fontFamily === 'tenant' ? t('tenantDefault') : fontFamily}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {fontFamilies.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font === 'tenant' ? t('tenantDefault') : font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="preference-font-size">{t('fontSize')}</Label>
              <Select
                value={fontSize}
                onValueChange={(value) => {
                  if (value && isPreferenceFontSize(value)) setFontSize(value);
                }}
              >
                <SelectTrigger id="preference-font-size" className="w-full">
                  <SelectValue>
                    {fontSize === 'tenant' ? t('tenantDefault') : t(`fontSizes.${fontSize}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {fontSizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size === 'tenant' ? t('tenantDefault') : t(`fontSizes.${size}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            className="rounded-lg border bg-muted/30 p-4"
            style={{
              fontFamily: fontFamily === 'tenant' ? undefined : fontFamily,
              fontSize: fontSize === 'tenant' ? undefined : {
                small: '14px',
                normal: '16px',
                large: '18px',
                xlarge: '20px',
              }[fontSize],
            }}
          >
            <p className="font-semibold">{t('preview')}</p>
            <p className="mt-1 text-muted-foreground">{t('previewText')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('navigation')}</CardTitle>
          <CardDescription>{t('navigationHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:max-w-xl">
          <Label htmlFor="preference-navigation">{t('navigationPosition')}</Label>
          <Select
            value={navigationPosition}
            onValueChange={(value) => {
              if (value === 'left' || value === 'top' || value === 'bottom') {
                setNavigationPosition(value);
              }
            }}
          >
            <SelectTrigger id="preference-navigation" className="w-full">
              <SelectValue>{t(`navigationPositions.${navigationPosition}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(['left', 'top', 'bottom'] as const).map((position) => (
                <SelectItem key={position} value={position}>
                  {t(`navigationPositions.${position}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('language')}</CardTitle>
          <CardDescription>{t('languageHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={currentLocale}
            onValueChange={(value) => {
              if (value && isLocale(value)) handleLocaleChange(value);
            }}
            disabled={isPending}
          >
            <SelectTrigger id="preference-language" className="w-full sm:max-w-sm">
              <SelectValue>
                {locales.find((locale) => locale.code === currentLocale)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {locales.map((locale) => (
                <SelectItem key={locale.code} value={locale.code}>
                  <span aria-hidden="true">{locale.flag}</span>
                  {locale.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>{t('widgets')}</CardTitle>
            <CardDescription>{t('widgetsHelp')}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              reorderWidgets(
                widgetIds.map((id, order) => ({
                  id,
                  visible: true,
                  order,
                })),
              )
            }
          >
            {t('resetWidgets')}
          </Button>
        </CardHeader>
        <CardContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedWidgets.map((widget) => widget.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {orderedWidgets.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    label={t(`widgetLabels.${widgetTranslationKeys[widget.id]}`)}
                    dragLabel={t('moveWidget', {
                      name: t(`widgetLabels.${widgetTranslationKeys[widget.id]}`),
                    })}
                    onToggle={() => toggleWidget(widget.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>
    </div>
  );
}
