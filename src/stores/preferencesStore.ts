import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Configuration d'un widget du tableau de bord. */
export interface WidgetConfig {
  id: string;
  visible: boolean;
  order: number;
}

export type PreferenceFontFamily =
  | 'tenant'
  | 'Inter'
  | 'Roboto'
  | 'Open Sans'
  | 'Lato'
  | 'Montserrat';

export type PreferenceFontSize =
  | 'tenant'
  | 'small'
  | 'normal'
  | 'large'
  | 'xlarge';

export type PrimaryColorPreference = 'red' | 'black' | 'blue' | 'custom';
export type EvolutionChartType = 'bar' | 'line' | 'area' | 'pie';
export type NavigationPosition = 'left' | 'top' | 'bottom';

/** État des préférences utilisateur. */
interface PreferencesState {
  /** Langue préférée. */
  locale: 'fr' | 'en' | 'rn';
  /** Police et taille, ou configuration visuelle par défaut du tenant. */
  fontFamily: PreferenceFontFamily;
  fontSize: PreferenceFontSize;
  /** Couleur principale de l'interface en thème clair. */
  primaryColor: PrimaryColorPreference;
  /** Couleur hexadécimale utilisée lorsque la couleur personnalisée est choisie. */
  customPrimaryColor: string;
  /** Widgets du tableau de bord, avec leur ordre et visibilité. */
  widgets: WidgetConfig[];
  /** Indique si la barre latérale est ouverte. */
  sidebarOpen: boolean;
  /** Largeur préférée de la barre latérale en pixels. */
  sidebarWidth: number;
  /** Position de la navigation principale. */
  navigationPosition: NavigationPosition;
  /** Type du graphique d'évolution des pointages. */
  attendanceChartType: EvolutionChartType;
  setLocale: (locale: 'fr' | 'en' | 'rn') => void;
  setFontFamily: (fontFamily: PreferenceFontFamily) => void;
  setFontSize: (fontSize: PreferenceFontSize) => void;
  setPrimaryColor: (primaryColor: PrimaryColorPreference) => void;
  setCustomPrimaryColor: (color: string) => void;
  toggleWidget: (widgetId: string) => void;
  reorderWidgets: (widgets: WidgetConfig[]) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setNavigationPosition: (position: NavigationPosition) => void;
  resetNavigationPosition: () => void;
  setAttendanceChartType: (type: EvolutionChartType) => void;
  resetPreferences: () => void;
}

/** Configuration initiale des widgets du tableau de bord. */
const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'stats-employes', visible: true, order: 0 },
  { id: 'stats-pointages', visible: true, order: 1 },
  { id: 'stats-capteurs', visible: true, order: 2 },
  { id: 'stats-presence', visible: true, order: 3 },
  { id: 'stats-retards', visible: true, order: 4 },
  { id: 'stats-heures-sup', visible: true, order: 5 },
  { id: 'chart-evolution', visible: true, order: 6 },
  { id: 'derniers-pointages', visible: true, order: 7 },
  { id: 'capteurs-inactifs', visible: true, order: 8 },
  { id: 'shifts-jour', visible: true, order: 9 },
  { id: 'alertes-jour', visible: true, order: 10 },
  { id: 'top-unites-absentes', visible: true, order: 11 },
];

/** Store Zustand persistant pour les préférences utilisateur. */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      locale: 'fr',
      fontFamily: 'tenant',
      fontSize: 'tenant',
      primaryColor: 'red',
      customPrimaryColor: '#2563eb',
      widgets: DEFAULT_WIDGETS,
      sidebarOpen: true,
      sidebarWidth: 256,
      navigationPosition: 'left',
      attendanceChartType: 'area',

      setLocale: (locale) => set({ locale }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize }),
      setPrimaryColor: (primaryColor) => set({ primaryColor }),
      setCustomPrimaryColor: (customPrimaryColor) =>
        set({ primaryColor: 'custom', customPrimaryColor }),

      toggleWidget: (widgetId) =>
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === widgetId
              ? { ...widget, visible: !widget.visible }
              : widget
          ),
        })),

      reorderWidgets: (widgets) => set({ widgets }),

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarWidth: (sidebarWidth) =>
        set({ sidebarWidth: Math.min(420, Math.max(200, Math.round(sidebarWidth))) }),

      setNavigationPosition: (navigationPosition) => set({ navigationPosition }),
      resetNavigationPosition: () => set({ navigationPosition: 'left' }),

      setAttendanceChartType: (attendanceChartType) => set({ attendanceChartType }),

      resetPreferences: () =>
        set({
          locale: 'fr',
          fontFamily: 'tenant',
          fontSize: 'tenant',
          primaryColor: 'red',
          customPrimaryColor: '#2563eb',
          widgets: DEFAULT_WIDGETS.map((widget) => ({ ...widget })),
          sidebarOpen: true,
          sidebarWidth: 256,
          navigationPosition: 'left',
          attendanceChartType: 'area',
        }),
    }),
    {
      name: 'ams-preferences',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PreferencesState> | undefined;
        const widgets = Array.isArray(persisted?.widgets) ? persisted.widgets : [];
        const existingIds = new Set(widgets.map((widget) => widget.id));

        return {
          ...currentState,
          ...persisted,
          primaryColor:
            persisted?.primaryColor === 'black'
            || persisted?.primaryColor === 'blue'
            || persisted?.primaryColor === 'custom'
              ? persisted.primaryColor
              : 'red',
          customPrimaryColor:
            typeof persisted?.customPrimaryColor === 'string'
            && /^#[\da-f]{6}$/i.test(persisted.customPrimaryColor)
              ? persisted.customPrimaryColor
              : currentState.customPrimaryColor,
          navigationPosition:
            persisted?.navigationPosition === 'top' || persisted?.navigationPosition === 'bottom'
              ? persisted.navigationPosition
              : 'left',
          sidebarWidth: typeof persisted?.sidebarWidth === 'number'
            && Number.isFinite(persisted.sidebarWidth)
            ? Math.min(420, Math.max(200, Math.round(persisted.sidebarWidth)))
            : currentState.sidebarWidth,
          widgets: [
            ...widgets,
            ...DEFAULT_WIDGETS.filter((widget) => !existingIds.has(widget.id)),
          ],
        };
      },
    }
  )
);