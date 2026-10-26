/**
 * Generador y Previsualizador de Portadas de Cursos con IA y Logo del Plugin (Frontend)
 * DocentOS LMS
 */

import { getCustomLogoUrl, getCustomBrandName } from './logoConfig';
import { siteConfig } from '../config/theme';

export function getActiveFrontendBrand(): {
  logoUrl: string;
  brandName: string;
  logoInitial: string;
} {
  const logoUrl = getCustomLogoUrl();
  const brandName = getCustomBrandName();
  const logoInitial = (siteConfig.logoInitial || brandName.charAt(0) || 'D').toUpperCase();
  return { logoUrl, brandName, logoInitial };
}

export function isAiSvgCover(url: string | null | undefined): boolean {
  const clean = String(url ?? '').trim();
  return clean.startsWith('data:image/svg+xml') && clean.includes('docentos-ai-cover');
}
