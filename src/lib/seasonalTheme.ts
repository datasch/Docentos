/**
 * Gestor de Festividades Estacionales para DocentOS (Halloween & Navidad)
 *
 * Detecta automáticamente si el mes actual corresponde a:
 * - Octubre (mes 9 en JS): 🎃 Halloween
 * - Diciembre (mes 11 en JS) o primeros días de enero: 🎄 Navidad
 *
 * También permite anular/forzar manualmente el tema para pruebas y demostraciones.
 */

import { useState, useEffect } from 'react';

export type SeasonalTheme = 'halloween' | 'christmas' | 'none';
export type SeasonalOverride = 'auto' | 'halloween' | 'christmas' | 'none';

export const SEASONAL_STORAGE_KEY = 'docentos_festive_theme';
export const SEASONAL_EVENT_NAME = 'docentos-seasonal-change';

/**
 * Determina la festividad actual automáticamente por fecha de calendario.
 * - Octubre (y 1-2 de Noviembre): 🎃 Halloween
 * - Del 20 de Noviembre al 6 de Enero: 🎄 Navidad
 * - Resto del año: ninguno (estándar)
 */
export function getSeasonalTheme(): SeasonalTheme {
  if (typeof window === 'undefined') return 'none';

  // Detección automática por fecha real de calendario
  const now = new Date();
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
  applySeasonalTheme();
  window.dispatchEvent(new CustomEvent(SEASONAL_EVENT_NAME, { detail: getSeasonalTheme() }));
}

/**
 * Hook de React para reaccionar inmediatamente a los cambios de festividad estacional.
 */
export function useSeasonalTheme(): SeasonalTheme {
  const [theme, setTheme] = useState<SeasonalTheme>(getSeasonalTheme);

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

export const SEASONAL_INFO = {
  halloween: {
    id: 'halloween',
    nombre: 'Noche de Brujas',
    emoji: '🎃',
    badge: '🎃 Especial de Halloween',
    mensaje: '¡Feliz Noche de Brujas! Conquista tus misiones con energía sobrenatural.',
    colorAcento: '#f97316',
  },
  christmas: {
    id: 'christmas',
    nombre: 'Temporada Navideña',
    emoji: '🎄',
    badge: '🎄 Especial de Navidad',
    mensaje: '¡Felices Fiestas! Tu aprendizaje y dedicación son el mejor regalo.',
    colorAcento: '#ef4444',
  },
  none: {
    id: 'none',
    nombre: 'Estándar Cósmico',
    emoji: '✨',
    badge: '✨ Constelación Estándar',
    mensaje: 'Ruta Oficial de Aprendizaje DocentOS',
    colorAcento: '#06b6d4',
  },
} as const;
