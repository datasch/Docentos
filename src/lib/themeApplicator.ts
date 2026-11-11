/**
 * Aplicador Dinámico de Temas y Densidad Visual para DocentOS
 * Permite cambiar en caliente los colores de acento y la densidad de datos de toda la plataforma.
 */

export type ColorTheme = 'cyan' | 'violet' | 'emerald' | 'amber';
export type Density = 'comfortable' | 'compact';
export type ColorMode = 'light' | 'dark';

export interface ThemePalette {
  name: string;
  brandCyan: string;
  brandBlue: string;
  brandPurple: string;
  accentRgb: string;
  gradient: string;
}

export const THEME_PALETTES: Record<ColorTheme, ThemePalette> = {
  cyan: {
    name: 'Cian DocentOS',
    brandCyan: '#06b6d4',
    brandBlue: '#3b82f6',
    brandPurple: '#a855f7',
    accentRgb: '6, 182, 212',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #a855f7 100%)',
  },
  violet: {
    name: 'Violeta Neón',
    brandCyan: '#a855f7',
    brandBlue: '#8b5cf6',
    brandPurple: '#ec4899',
    accentRgb: '168, 85, 247',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 50%, #ec4899 100%)',
  },
  emerald: {
    name: 'Esmeralda Academia',
    brandCyan: '#10b981',
    brandBlue: '#059669',
    brandPurple: '#047857',
    accentRgb: '16, 185, 129',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
  },
  amber: {
    name: 'Ámbar Gold',
    brandCyan: '#f59e0b',
    brandBlue: '#d97706',
    brandPurple: '#b45309',
    accentRgb: '245, 158, 11',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
  },
};

const STORAGE_THEME_KEY = 'docentos_color_theme';
const STORAGE_DENSITY_KEY = 'docentos_density';
const STORAGE_COLOR_MODE_KEY = 'docentos_color_mode';

const LIGHT_ACCENTS: Record<ColorTheme, [string, string, string]> = {
  cyan: ['#0e7490', '#1d4ed8', '#6b21a8'],
  violet: ['#7e22ce', '#4338ca', '#6d28d9'],
  emerald: ['#047857', '#0e7490', '#0f766e'],
  amber: ['#b45309', '#9a3412', '#b91c1c'],
};

export function getThemePalette(theme: ColorTheme, mode: ColorMode): ThemePalette {
  const palette = THEME_PALETTES[theme] || THEME_PALETTES.cyan;
  if (mode !== 'light') return palette;
  const [brandCyan, brandBlue, brandPurple] = LIGHT_ACCENTS[theme] || LIGHT_ACCENTS.cyan;
  const accentRgb = [1, 3, 5].map(index => parseInt(brandCyan.slice(index, index + 2), 16)).join(', ');
  return { ...palette, brandCyan, brandBlue, brandPurple, accentRgb,
    gradient: `linear-gradient(135deg, ${brandCyan} 0%, ${brandBlue} 50%, ${brandPurple} 100%)` };
}

export function applyPlatformTheme(
  theme: ColorTheme = 'cyan',
  density: Density = 'comfortable',
  colorMode: ColorMode = getCurrentColorMode(),
  options: { persist?: boolean } = {},
) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const palette = getThemePalette(theme, colorMode);

  const resolvedBrandCyan = palette.brandCyan;
  const resolvedBrandBlue = palette.brandBlue;
  const resolvedBrandPurple = palette.brandPurple;

  // Actualizar variables CSS de acento y marca en :root
  root.style.setProperty('--color-brand-cyan', resolvedBrandCyan);
  root.style.setProperty('--brand-cyan', resolvedBrandCyan);
  root.style.setProperty('--color-brand-blue', resolvedBrandBlue);
  root.style.setProperty('--brand-blue', resolvedBrandBlue);
  root.style.setProperty('--color-brand-purple', resolvedBrandPurple);
  root.style.setProperty('--brand-purple', resolvedBrandPurple);
  root.style.setProperty('--brand-accent-gradient', palette.gradient);
  root.style.setProperty('--brand-accent-rgb', palette.accentRgb);

  // Variables para la Navbar, Landing Page y botones flotantes
  root.style.setProperty('--lp-cyan', resolvedBrandCyan);
  root.style.setProperty('--lp-accent', resolvedBrandCyan);
  root.style.setProperty('--lp-accent-soft', resolvedBrandBlue);
  root.style.setProperty('--lp-gradient', palette.gradient);

  // Clases temáticas en html y body
  const themeClasses = ['theme-cyan', 'theme-violet', 'theme-emerald', 'theme-amber'];
  root.classList.remove(...themeClasses);
  root.classList.add(`theme-${theme}`);
  if (document.body) {
    document.body.classList.remove(...themeClasses);
    document.body.classList.add(`theme-${theme}`);
  }

  // Densidad compacta
  if (density === 'compact') {
    root.classList.add('density-compact');
    document.body?.classList.add('density-compact');
  } else {
    root.classList.remove('density-compact');
    document.body?.classList.remove('density-compact');
  }

  // Modo de color (Dark vs Light)
  root.setAttribute('data-color-mode', colorMode);
  root.classList.remove('mode-dark', 'mode-light');
  root.classList.add(`mode-${colorMode}`);
  if (colorMode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  if (document.body) {
    document.body.setAttribute('data-color-mode', colorMode);
    document.body.classList.remove('mode-dark', 'mode-light');
    document.body.classList.add(`mode-${colorMode}`);
    if (colorMode === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }

  if (options.persist !== false) {
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
      localStorage.setItem(STORAGE_DENSITY_KEY, density);
      localStorage.setItem(STORAGE_COLOR_MODE_KEY, colorMode);
    } catch {
      // Almacenamiento local restringido o privado
    }
  }

  // Disparar evento para componentes que requieran sincronizar su estado
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('docentos-theme-change', {
        detail: { theme, density, colorMode },
      })
    );
  }
}

export function getCurrentColorMode(): ColorMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(STORAGE_COLOR_MODE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // fallback
  }
  return 'dark';
}

export function setColorMode(mode: ColorMode): ColorMode {
  try {
    const savedTheme = (localStorage.getItem(STORAGE_THEME_KEY) as ColorTheme) || 'cyan';
    const savedDensity = (localStorage.getItem(STORAGE_DENSITY_KEY) as Density) || 'comfortable';
    applyPlatformTheme(savedTheme, savedDensity, mode);
  } catch {
    applyPlatformTheme('cyan', 'comfortable', mode);
  }
  return mode;
}

export function toggleColorMode(): ColorMode {
  const current = getCurrentColorMode();
  const next: ColorMode = current === 'dark' ? 'light' : 'dark';
  return setColorMode(next);
}

export function initSavedTheme() {
  if (typeof window === 'undefined') return;
  try {
    const savedTheme = (localStorage.getItem(STORAGE_THEME_KEY) as ColorTheme) || 'cyan';
    const savedDensity = (localStorage.getItem(STORAGE_DENSITY_KEY) as Density) || 'comfortable';
    const savedMode = (localStorage.getItem(STORAGE_COLOR_MODE_KEY) as ColorMode) || 'dark';
    applyPlatformTheme(savedTheme, savedDensity, savedMode);
  } catch {
    applyPlatformTheme('cyan', 'comfortable', 'dark');
  }
}
