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
};
