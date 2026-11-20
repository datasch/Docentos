/**
 * Gestor de Festividades Estacionales para DocentOS (Halloween & Navidad)
 *
 * Detecta automáticamente si el mes actual corresponde a:
 * - Octubre (mes 9 en JS) y 1-2 de Noviembre: 🎃 Halloween
 * - Del 20 de Noviembre al 6 de Enero: 🎄 Navidad
 *
 * Se complementa con el plugin `seasonal-festivities` (activar/desactivar globalmente,
 * forzar una festividad o ajustar elementos visuales si la automatización falla).
 */

import { useState, useEffect } from 'react';
import i18n from '../i18n';

export type SeasonalTheme = 'halloween' | 'christmas' | 'none';
export type SeasonalOverride = 'auto' | 'halloween' | 'christmas' | 'none';
export type SeasonalMode = SeasonalOverride;

export interface SeasonalPluginState {
  enabled: boolean;
  mode: SeasonalMode;
  showBanner: boolean;
  showParticles: boolean;
  showFestiveHats: boolean;
}

export const SEASONAL_STORAGE_KEY = 'docentos_festive_theme';
export const SEASONAL_PLUGIN_STORAGE_KEY = 'docentos_seasonal_plugin_state';
export const SEASONAL_EVENT_NAME = 'docentos-seasonal-change';

export const DEFAULT_SEASONAL_PLUGIN_STATE: SeasonalPluginState = {
  enabled: true,
  mode: 'auto',
  showBanner: true,
  showParticles: true,
  showFestiveHats: true,
};

let memoryPluginState: SeasonalPluginState | null = null;

function normalizeMode(value: unknown): SeasonalMode {
  if (value === 'halloween' || value === 'christmas' || value === 'none' || value === 'auto') {
    return value;
  }
  return 'auto';
}

export function normalizeSeasonalPluginState(
  raw?: Partial<SeasonalPluginState> | null,
): SeasonalPluginState {
  return {
    enabled: raw?.enabled !== undefined ? Boolean(raw.enabled) : DEFAULT_SEASONAL_PLUGIN_STATE.enabled,
    mode: normalizeMode(raw?.mode),
    showBanner: raw?.showBanner !== undefined ? Boolean(raw.showBanner) : DEFAULT_SEASONAL_PLUGIN_STATE.showBanner,
    showParticles:
      raw?.showParticles !== undefined ? Boolean(raw.showParticles) : DEFAULT_SEASONAL_PLUGIN_STATE.showParticles,
    showFestiveHats:
      raw?.showFestiveHats !== undefined ? Boolean(raw.showFestiveHats) : DEFAULT_SEASONAL_PLUGIN_STATE.showFestiveHats,
  };
}

export function getSeasonalPluginState(): SeasonalPluginState {
  if (memoryPluginState) {
    return memoryPluginState;
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SEASONAL_PLUGIN_STORAGE_KEY);
      if (raw) {
        const parsed = normalizeSeasonalPluginState(JSON.parse(raw));
        memoryPluginState = parsed;
        return parsed;
      }
    } catch {
      // Ignorar si no hay acceso a localStorage o JSON inválido
    }
  }
  return { ...DEFAULT_SEASONAL_PLUGIN_STATE };
}

/**
 * Sincroniza el estado del plugin `seasonal-festivities` con la capa visual global
 * y notifica a todos los componentes suscritos.
 */
export function syncSeasonalPluginState(
  state?: Partial<SeasonalPluginState> | null,
): SeasonalPluginState {
  const normalized = normalizeSeasonalPluginState(state);
  memoryPluginState = normalized;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SEASONAL_PLUGIN_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignorar si no hay acceso a localStorage
    }
  }

  const resolvedTheme = applySeasonalTheme();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(SEASONAL_EVENT_NAME, {
        detail: { theme: resolvedTheme, ...normalized },
      }),
    );
  }

  return normalized;
}

/**
 * Determina la festividad automáticamente por fecha real de calendario.
 * - Octubre (y 1-2 de Noviembre): 🎃 Halloween
 * - Del 20 de Noviembre al 6 de Enero (Reyes Magos): 🎄 Navidad
 * - Resto del año: 'none' (estándar)
 */
export function getAutomaticSeasonalTheme(now: Date = new Date()): SeasonalTheme {
  const month = now.getMonth(); // 0 = Enero, 9 = Octubre, 11 = Diciembre
  const day = now.getDate();

  // 1. Halloween: Todo el mes de Octubre (y primeros 2 días de Noviembre)
  if (month === 9 || (month === 10 && day <= 2)) {
    return 'halloween';
  }

  // 2. Navidad: Del 20 de Noviembre al 6 de Enero (Reyes Magos)
  if (month === 11 || (month === 10 && day >= 20) || (month === 0 && day <= 6)) {
    return 'christmas';
  }

  return 'none';
}

/**
 * Determina la festividad activa combinando:
 * 1. Estado global del plugin `seasonal-festivities` (si está apagado -> 'none', si fuerza tema -> ese tema)
 * 2. Override local de pruebas (`localStorage`) si el plugin está en modo 'auto'
 * 3. Automatización nativa por fecha de calendario dentro de DocentOS
 */
export function getSeasonalTheme(now: Date = new Date()): SeasonalTheme {
  const pluginState = getSeasonalPluginState();
  if (!pluginState.enabled) {
    return 'none';
  }

  if (pluginState.mode !== 'auto') {
    return pluginState.mode;
  }

  if (typeof window !== 'undefined') {
    const override = getSeasonalOverride();
    if (override !== 'auto') {
      return override;
    }
  }

  return getAutomaticSeasonalTheme(now);
}

export function getSeasonalDisplayOptions(): SeasonalPluginState & { theme: SeasonalTheme } {
  const state = getSeasonalPluginState();
  const theme = getSeasonalTheme();
  const active = theme !== 'none';
  return {
    ...state,
    theme,
    showBanner: active && state.showBanner,
    showParticles: active && state.showParticles,
    showFestiveHats: active && state.showFestiveHats,
  };
}

export function getSeasonalOverride(): SeasonalOverride {
  if (typeof window === 'undefined') return 'auto';
  try {
    return (localStorage.getItem(SEASONAL_STORAGE_KEY) as SeasonalOverride) || 'auto';
  } catch {
    return 'auto';
  }
}

export function setSeasonalOverride(override: SeasonalOverride): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SEASONAL_STORAGE_KEY, override);
  } catch {
    // Ignorar si no hay acceso a localStorage
  }
  const theme = applySeasonalTheme();
  window.dispatchEvent(
    new CustomEvent(SEASONAL_EVENT_NAME, { detail: { theme, ...getSeasonalPluginState() } }),
  );
}

/**
 * Hook de React para reaccionar inmediatamente a los cambios de festividad estacional.
 */
export function useSeasonalTheme(): SeasonalTheme {
  const [theme, setTheme] = useState<SeasonalTheme>(() => getSeasonalTheme());

  useEffect(() => {
    const handleUpdate = () => {
      setTheme(getSeasonalTheme());
    };
    window.addEventListener(SEASONAL_EVENT_NAME, handleUpdate);
    return () => window.removeEventListener(SEASONAL_EVENT_NAME, handleUpdate);
  }, []);

  return theme;
}

/**
 * Hook de React con tema efectivo y banderas visuales del plugin de festividades.
 */
export function useSeasonalDisplay(): SeasonalPluginState & { theme: SeasonalTheme } {
  const [display, setDisplay] = useState(() => getSeasonalDisplayOptions());

  useEffect(() => {
    const handleUpdate = () => {
      setDisplay(getSeasonalDisplayOptions());
    };
    window.addEventListener(SEASONAL_EVENT_NAME, handleUpdate);
    return () => window.removeEventListener(SEASONAL_EVENT_NAME, handleUpdate);
  }, []);

  return display;
}

/**
 * Aplica el atributo `data-festividad` al elemento `<html>` y `<body>`.
 */
export function applySeasonalTheme(): SeasonalTheme {
  if (typeof document === 'undefined') return 'none';
  const theme = getSeasonalTheme();
  const root = document.documentElement;

  if (theme === 'halloween') {
    root.setAttribute('data-festividad', 'halloween');
    document.body?.setAttribute('data-festividad', 'halloween');
  } else if (theme === 'christmas') {
    root.setAttribute('data-festividad', 'navidad');
    document.body?.setAttribute('data-festividad', 'navidad');
  } else {
    root.removeAttribute('data-festividad');
    document.body?.removeAttribute('data-festividad');
  }

  return theme;
}

export type SeasonalInfo = {
  id: string;
  get nombre(): string;
  emoji: string;
  get badge(): string;
  get mensaje(): string;
  colorAcento: string;
};

export const SEASONAL_INFO: Record<SeasonalTheme, SeasonalInfo> = {
  halloween: {
    id: 'halloween',
    get nombre() { return i18n.t('season_halloween_nombre', 'Noche de Brujas'); },
    emoji: '🎃',
    get badge() { return i18n.t('season_halloween_badge', '🎃 Especial de Halloween'); },
    get mensaje() { return i18n.t('season_halloween_mensaje', '¡Feliz Noche de Brujas! Conquista tus misiones con energía sobrenatural.'); },
    colorAcento: '#f97316',
  },
  christmas: {
    id: 'christmas',
    get nombre() { return i18n.t('season_christmas_nombre', 'Temporada Navideña'); },
    emoji: '🎄',
    get badge() { return i18n.t('season_christmas_badge', '🎄 Especial de Navidad'); },
    get mensaje() { return i18n.t('season_christmas_mensaje', '¡Felices Fiestas! Tu aprendizaje y dedicación son el mejor regalo.'); },
    colorAcento: '#ef4444',
  },
  none: {
    id: 'none',
    get nombre() { return i18n.t('season_none_nombre', 'Estándar Cósmico'); },
    emoji: '✨',
    get badge() { return i18n.t('season_none_badge', '✨ Constelación Estándar'); },
    get mensaje() { return i18n.t('season_none_mensaje', 'Ruta Oficial de Aprendizaje DocentOS'); },
    colorAcento: '#06b6d4',
  },
};
