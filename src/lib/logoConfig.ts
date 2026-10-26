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
export const LOGO_CHANGE_EVENT = 'docentos-logo-change';
export const BRAND_CHANGE_EVENT = 'docentos-brand-change';
const STORAGE_LOGO_KEY = 'docentos_custom_logo_url';
const STORAGE_BRAND_KEY = 'docentos_custom_campus_name';

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
    // 1. Prioridad: Plugin docentos-customizer
    const customizer = pluginManager.getPlugin('docentos-customizer');
    const pluginBrand = customizer?.config?.customCampusName || customizer?.config?.customBrandName;
    if (pluginBrand && typeof pluginBrand === 'string' && pluginBrand.trim().length > 0) {
      return pluginBrand.trim();
    }

    // 2. Fallback de localStorage
    const saved = localStorage.getItem(STORAGE_BRAND_KEY);
    if (saved && saved.trim().length > 0) {
      return saved.trim();
    }

    // 3. siteConfig
    if (siteConfig.appName && siteConfig.appName.trim().length > 0) {
      return siteConfig.appName.trim();
    }
  } catch {
    // Almacenamiento no disponible
  }

  return DEFAULT_BRAND_NAME;
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

  const cleanName = name.trim();
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

  // Actualizar configuración en el Plugin Manager
  try {
    pluginManager.updateConfig('docentos-customizer', {
      customCampusName: effectiveName,
      customBrandName: effectiveName,
    });
  } catch {
    // Error silencioso
  }

  // Notificar a toda la plataforma
  window.dispatchEvent(
    new CustomEvent(BRAND_CHANGE_EVENT, {
      detail: { brandName: effectiveName, customCampusName: effectiveName, customBrandName: effectiveName },
    })
  );
  window.dispatchEvent(
    new CustomEvent('docentos-customizer-change', {
      detail: { customCampusName: effectiveName, customBrandName: effectiveName },
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
 * Hook de React para reaccionar inmediatamente a cambios del nombre institucional/marca
 */
export function useCustomBrandName(): string {
  const [brandName, setBrandName] = useState<string>(getCustomBrandName);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const newName = e.detail?.brandName || e.detail?.customCampusName || e.detail?.customBrandName || getCustomBrandName();
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
 * Hook unificado de Marca Institucional (Logo + Nombre + Inicial)
 */
export function usePlatformBrand(): { logoUrl: string; brandName: string; logoInitial: string } {
  const logoUrl = useCustomLogo();
  const brandName = useCustomBrandName();
  const logoInitial = (siteConfig.logoInitial || brandName.charAt(0) || 'D').toUpperCase();

  return { logoUrl, brandName, logoInitial };
}
