const runtimeConfig = typeof window === 'undefined' ? {} : window.__DOCENTOS_CONFIG__ || {};

export const siteConfig = {
  appName: runtimeConfig.appName || 'DocentOS',
  appTagline: runtimeConfig.appTagline || 'Plataforma e-Learning Open Source',
  logoInitial: runtimeConfig.logoInitial || 'D',
  logoUrl: runtimeConfig.logoUrl || '',
  poweredByText: runtimeConfig.poweredByText || 'Powered by DocentOS LMS Engine',
  poweredByLink: runtimeConfig.poweredByLink || 'https://github.com/giantucchi-org/docentos',
  authorCredit: runtimeConfig.authorCredit || 'DocentOS Community Edition',
  defaultLanguage: runtimeConfig.defaultLanguage || 'es',
  assistantName: runtimeConfig.assistantName || 'Ian',
  complaintsBookUrl: runtimeConfig.complaintsBookUrl || '',
};

export function applyRuntimeConfig(cfg: Record<string, any> | undefined | null) {
  if (!cfg || typeof cfg !== 'object') return;
  if (cfg.appName) siteConfig.appName = cfg.appName;
  if (cfg.appTagline) siteConfig.appTagline = cfg.appTagline;
  if (cfg.logoInitial) siteConfig.logoInitial = cfg.logoInitial;
  if (typeof cfg.logoUrl === 'string') siteConfig.logoUrl = cfg.logoUrl;
  if (cfg.poweredByText) siteConfig.poweredByText = cfg.poweredByText;
  if (cfg.poweredByLink) siteConfig.poweredByLink = cfg.poweredByLink;
  if (cfg.authorCredit) siteConfig.authorCredit = cfg.authorCredit;
  if (cfg.defaultLanguage) siteConfig.defaultLanguage = cfg.defaultLanguage;
  if (cfg.assistantName) siteConfig.assistantName = cfg.assistantName;
  if (typeof cfg.complaintsBookUrl === 'string') siteConfig.complaintsBookUrl = cfg.complaintsBookUrl;
}
