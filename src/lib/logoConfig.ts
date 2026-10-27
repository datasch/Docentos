/**
 * Gestor Centralizado de Logo e Identidad Institucional - DocentOS
 * Sincroniza el logo y nombre personalizados configurados en el Plugin de Personalización
 * con los Navbars, Cabeceras, Footers, Canvas y diplomas de toda la plataforma.
 */

import { useState, useEffect } from 'react';
import { pluginManager } from '../plugins/PluginManager';
import { siteConfig } from '../config/theme';

export const DEFAULT_LOGO_URL = '/logo.avif';
export const DEFAULT_BRAND_NAME = 'DocentOS';
export const DEFAULT_CAMPUS_NAME = 'DocentOS Command Center';
export const LOGO_CHANGE_EVENT = 'docentos-logo-change';
export const BRAND_CHANGE_EVENT = 'docentos-brand-change';
export const CAMPUS_CHANGE_EVENT = 'docentos-campus-change';
const STORAGE_LOGO_KEY = 'docentos_custom_logo_url';
const STORAGE_BRAND_KEY = 'docentos_custom_brand_name';
const STORAGE_CAMPUS_KEY = 'docentos_custom_campus_name';

export function getCustomLogoUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_LOGO_URL;

  try {
    // 1. Prioridad: Configuración activa del plugin docentos-customizer
    const customizer = pluginManager.getPlugin('docentos-customizer');
    const pluginLogo = customizer?.config?.customLogoUrl;
    if (pluginLogo && typeof pluginLogo === 'string' && pluginLogo.trim().length > 0) {
      return pluginLogo.trim();
    }

    // 2. Fallback de localStorage
    const saved = localStorage.getItem(STORAGE_LOGO_KEY);
    if (saved && saved.trim().length > 0) {
      return saved.trim();
    }

    // 3. siteConfig
    if (siteConfig.logoUrl && siteConfig.logoUrl.trim().length > 0) {
      return siteConfig.logoUrl.trim();
    }
  } catch {
    // Almacenamiento no disponible
  }

  return DEFAULT_LOGO_URL;
}

export function getCustomBrandName(): string {
  if (typeof window === 'undefined') return DEFAULT_BRAND_NAME;

  try {
    // 1. Prioridad: LocalStorage específico de marca (persistencia inmediata sin flash)
    const savedBrand = localStorage.getItem(STORAGE_BRAND_KEY);
    if (savedBrand && savedBrand.trim().length > 0) {
      const cleanSaved = savedBrand.trim();
      if (cleanSaved !== 'Academia Giantucchi') {
        return cleanSaved;
      }
      localStorage.removeItem(STORAGE_BRAND_KEY);
    }

    // 2. Plugin docentos-customizer en memoria (si tiene marca personalizada configurada)
    const customizer = pluginManager.getPlugin('docentos-customizer');
    const pluginBrand = customizer?.config?.customBrandName;
    if (pluginBrand && typeof pluginBrand === 'string' && pluginBrand.trim().length > 0) {
      const cleanPlugin = pluginBrand.trim();
      if (cleanPlugin !== 'Academia Giantucchi' && cleanPlugin !== DEFAULT_BRAND_NAME) {
        return cleanPlugin;
      }
    }

    // 3. Fallback a configuración de campus si no hay marca definida
    const savedCampus = localStorage.getItem(STORAGE_CAMPUS_KEY);
    if (savedCampus && savedCampus.trim().length > 0) {
      const cleanSaved = savedCampus.trim();
      if (cleanSaved !== 'Academia Giantucchi' && cleanSaved !== DEFAULT_CAMPUS_NAME) {
        return cleanSaved;
      }
    }

    const legacyCampus = customizer?.config?.customCampusName;
    if (legacyCampus && typeof legacyCampus === 'string' && legacyCampus.trim().length > 0) {
      const cleanCampus = legacyCampus.trim();
      if (cleanCampus !== 'Academia Giantucchi' && cleanCampus !== DEFAULT_CAMPUS_NAME) {
        return cleanCampus;
      }
    }

    // 4. siteConfig
    if (siteConfig.appName && siteConfig.appName.trim().length > 0) {
      const cleanSite = siteConfig.appName.trim();
      if (cleanSite !== 'Academia Giantucchi') {
        return cleanSite;
      }
    }
  } catch {
    // Almacenamiento no disponible
  }

  return DEFAULT_BRAND_NAME;
}

export function getCustomCampusName(): string {
  if (typeof window === 'undefined') return DEFAULT_CAMPUS_NAME;

  try {
    // 1. Prioridad: LocalStorage de campus
    const saved = localStorage.getItem(STORAGE_CAMPUS_KEY);
    if (saved && saved.trim().length > 0) {
      const cleanSaved = saved.trim();
      if (cleanSaved !== 'Academia Giantucchi' && cleanSaved !== DEFAULT_CAMPUS_NAME) {
        return cleanSaved;
      }
      localStorage.removeItem(STORAGE_CAMPUS_KEY);
    }

    // 2. Plugin docentos-customizer
    const customizer = pluginManager.getPlugin('docentos-customizer');
    const pluginCampus = customizer?.config?.customCampusName;
    if (pluginCampus && typeof pluginCampus === 'string' && pluginCampus.trim().length > 0) {
      const clean = pluginCampus.trim();
      if (clean !== 'Academia Giantucchi' && clean !== DEFAULT_CAMPUS_NAME) {
        return clean;
      }
    }
  } catch {
    // Error silencioso
  }

  return DEFAULT_CAMPUS_NAME;
}

export function setCustomLogoUrl(url: string): void {
  if (typeof window === 'undefined') return;

  const cleanUrl = url.trim();
  try {
    if (cleanUrl) {
      localStorage.setItem(STORAGE_LOGO_KEY, cleanUrl);
    } else {
      localStorage.removeItem(STORAGE_LOGO_KEY);
    }
  } catch {
    // Error silencioso
  }

  siteConfig.logoUrl = cleanUrl;

  // Actualizar configuración en el Plugin Manager
  try {
    pluginManager.updateConfig('docentos-customizer', { customLogoUrl: cleanUrl });
  } catch {
    // Error silencioso
  }

  // Notificar a toda la plataforma
  window.dispatchEvent(
    new CustomEvent(LOGO_CHANGE_EVENT, {
      detail: { logoUrl: cleanUrl || DEFAULT_LOGO_URL },
    })
  );
  window.dispatchEvent(
    new CustomEvent('docentos-customizer-change', {
      detail: { customLogoUrl: cleanUrl },
    })
  );
}

export function setCustomBrandName(name: string): void {
  if (typeof window === 'undefined') return;

  const rawClean = name.trim();
  const cleanName = rawClean === 'Academia Giantucchi' ? '' : rawClean;
  try {
    if (cleanName) {
      localStorage.setItem(STORAGE_BRAND_KEY, cleanName);
    } else {
      localStorage.removeItem(STORAGE_BRAND_KEY);
    }
  } catch {
    // Error silencioso
  }

  const effectiveName = cleanName || DEFAULT_BRAND_NAME;
  siteConfig.appName = effectiveName;

  if (typeof document !== 'undefined') {
    document.title = `${effectiveName} — Plataforma Educativa`;
  }

  // Actualizar únicamente marca en docentos-customizer (sin mutar institutionName de certificados)
  try {
    pluginManager.updateConfig('docentos-customizer', {
      customBrandName: effectiveName,
    });
  } catch {
    // Error silencioso
  }

  // Notificar a toda la plataforma
  window.dispatchEvent(
    new CustomEvent(BRAND_CHANGE_EVENT, {
      detail: { brandName: effectiveName, customBrandName: effectiveName },
    })
  );
  window.dispatchEvent(
    new CustomEvent('docentos-customizer-change', {
      detail: { customBrandName: effectiveName },
    })
  );
}

export function setCustomCampusName(name: string): void {
  if (typeof window === 'undefined') return;

  const rawClean = name.trim();
  const cleanName = rawClean === 'Academia Giantucchi' ? '' : rawClean;
  try {
    if (cleanName) {
      localStorage.setItem(STORAGE_CAMPUS_KEY, cleanName);
    } else {
      localStorage.removeItem(STORAGE_CAMPUS_KEY);
    }
  } catch {
    // Error silencioso
  }

  const effectiveCampus = cleanName || DEFAULT_CAMPUS_NAME;

  // Actualizar únicamente campus en docentos-customizer
  try {
    pluginManager.updateConfig('docentos-customizer', {
      customCampusName: effectiveCampus,
    });
  } catch {
    // Error silencioso
  }

  // Notificar a toda la plataforma
  window.dispatchEvent(
    new CustomEvent(CAMPUS_CHANGE_EVENT, {
      detail: { customCampusName: effectiveCampus },
    })
  );
  window.dispatchEvent(
    new CustomEvent('docentos-customizer-change', {
      detail: { customCampusName: effectiveCampus },
    })
  );
}

/**
 * Hook de React para reaccionar inmediatamente a cambios del logo
 */
export function useCustomLogo(): string {
  const [logoUrl, setLogoUrl] = useState<string>(getCustomLogoUrl);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const newUrl = e.detail?.logoUrl || e.detail?.customLogoUrl || getCustomLogoUrl();
      setLogoUrl(newUrl);
    };

    window.addEventListener(LOGO_CHANGE_EVENT, handleUpdate);
    window.addEventListener('docentos-customizer-change', handleUpdate);

    return () => {
      window.removeEventListener(LOGO_CHANGE_EVENT, handleUpdate);
      window.removeEventListener('docentos-customizer-change', handleUpdate);
    };
  }, []);

  return logoUrl;
}

/**
 * Hook de React para reaccionar inmediatamente a cambios del nombre de la marca (Navbar, Footer, Título)
 */
export function useCustomBrandName(): string {
  const [brandName, setBrandName] = useState<string>(getCustomBrandName);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const candidate = e.detail?.brandName || e.detail?.customBrandName;
      const cleanCandidate = candidate && typeof candidate === 'string' && candidate.trim() !== 'Academia Giantucchi' ? candidate.trim() : '';
      const newName = cleanCandidate || getCustomBrandName();
      setBrandName(newName);
    };

    window.addEventListener(BRAND_CHANGE_EVENT, handleUpdate);
    window.addEventListener('docentos-customizer-change', handleUpdate);

    return () => {
      window.removeEventListener(BRAND_CHANGE_EVENT, handleUpdate);
      window.removeEventListener('docentos-customizer-change', handleUpdate);
    };
  }, []);

  return brandName;
}

/**
 * Hook de React para reaccionar inmediatamente a cambios del título del campus / panel de administración
 */
export function useCustomCampusName(): string {
  const [campusName, setCampusName] = useState<string>(getCustomCampusName);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const candidate = e.detail?.customCampusName;
      const cleanCandidate = candidate && typeof candidate === 'string' && candidate.trim() !== 'Academia Giantucchi' ? candidate.trim() : '';
      const newName = cleanCandidate || getCustomCampusName();
      setCampusName(newName);
    };

    window.addEventListener(CAMPUS_CHANGE_EVENT, handleUpdate);
    window.addEventListener('docentos-customizer-change', handleUpdate);

    return () => {
      window.removeEventListener(CAMPUS_CHANGE_EVENT, handleUpdate);
      window.removeEventListener('docentos-customizer-change', handleUpdate);
    };
  }, []);

  return campusName;
}

/**
 * Hook unificado de Marca Institucional (Logo + Nombre + Campus + Inicial)
 */
export function usePlatformBrand(): { logoUrl: string; brandName: string; campusName: string; logoInitial: string } {
  const logoUrl = useCustomLogo();
  const brandName = useCustomBrandName();
  const campusName = useCustomCampusName();
  const logoInitial = (siteConfig.logoInitial || brandName.charAt(0) || 'D').toUpperCase();

  return { logoUrl, brandName, campusName, logoInitial };
}
