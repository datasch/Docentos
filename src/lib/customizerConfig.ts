import type { ColorMode, ColorTheme, Density } from './themeApplicator';

export interface CustomizerConfig {
  interfaceVersion: 'v0.5-modern' | 'v0.4-classic';
  colorTheme: ColorTheme;
  colorMode: ColorMode;
  density: Density;
  showQuickVersionSwitcher: boolean;
  customCampusName: string;
  customBrandName: string;
  customLogoUrl: string;
}

export const DEFAULT_CUSTOMIZER_CONFIG: CustomizerConfig = {
  interfaceVersion: 'v0.5-modern',
  colorTheme: 'cyan',
  colorMode: 'dark',
  density: 'comfortable',
  showQuickVersionSwitcher: false,
  customCampusName: 'DocentOS Command Center',
  customBrandName: 'DocentOS',
  customLogoUrl: '',
};

const COLOR_THEMES: ColorTheme[] = ['cyan', 'violet', 'emerald', 'amber'];

function isColorTheme(value: unknown): value is ColorTheme {
  return typeof value === 'string' && COLOR_THEMES.includes(value as ColorTheme);
}

function isDensity(value: unknown): value is Density {
  return value === 'comfortable' || value === 'compact';
}

function isColorMode(value: unknown): value is ColorMode {
  return value === 'light' || value === 'dark';
}

function trimOrFallback(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function normalizeCustomizerConfig(
  config: Record<string, unknown> | CustomizerConfig = {},
): CustomizerConfig {
  const brand = trimOrFallback(config.customBrandName, DEFAULT_CUSTOMIZER_CONFIG.customBrandName);
  const campus = trimOrFallback(config.customCampusName, DEFAULT_CUSTOMIZER_CONFIG.customCampusName);

  return {
    interfaceVersion: config.interfaceVersion === 'v0.4-classic'
      ? 'v0.4-classic'
      : DEFAULT_CUSTOMIZER_CONFIG.interfaceVersion,
    colorTheme: isColorTheme(config.colorTheme) ? config.colorTheme : DEFAULT_CUSTOMIZER_CONFIG.colorTheme,
    colorMode: isColorMode(config.colorMode) ? config.colorMode : DEFAULT_CUSTOMIZER_CONFIG.colorMode,
    density: isDensity(config.density) ? config.density : DEFAULT_CUSTOMIZER_CONFIG.density,
    showQuickVersionSwitcher: false,
    customCampusName: campus === 'Academia Giantucchi' ? DEFAULT_CUSTOMIZER_CONFIG.customCampusName : campus,
    customBrandName: brand === 'Academia Giantucchi' ? DEFAULT_CUSTOMIZER_CONFIG.customBrandName : brand,
    customLogoUrl: typeof config.customLogoUrl === 'string' ? config.customLogoUrl : DEFAULT_CUSTOMIZER_CONFIG.customLogoUrl,
  };
}

export function mergeCustomizerDraft(
  current: CustomizerConfig,
  patch: Partial<CustomizerConfig>,
): CustomizerConfig {
  return normalizeCustomizerConfig({ ...current, ...patch });
}

export function buildCustomizerSaveConfig(config: CustomizerConfig): CustomizerConfig {
  return normalizeCustomizerConfig(config);
}
