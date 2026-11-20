/**
 * Lo que se edita en Portal → Portada llega al inicio real por aquí.
 *
 * El inicio solo cambia cuando alguien escribe algo propio: los valores que trae
 * la base de datos de fábrica (el titular de la portada antigua, los beneficios
 * "Motor AI-Native…", el GitHub de otra cuenta) se tratan como "sin personalizar"
 * y el inicio sigue mostrando sus textos de siempre.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { safeExternalUrl } from './safeUrl';
import type { LandingBenefit, LandingConfig } from '../types';

const LEGACY_TITLE = 'Una nueva forma de aprender | con inteligencia artificial.';
const LEGACY_SUBTITLE_START = 'Supera los límites de la educación tradicional.';
const LEGACY_CTA_TEXTS = ['Explorar Cursos', 'Explorar Catálogo de Cursos'];
const LEGACY_BENEFIT_TITLES = [
  'Motor AI-Native Integrado',
  'Streaming Nativo con Google Drive',
  'Control de Roles RBAC & Single-Admin',
  'Arquitectura Modular de Plugins',
];
const LEGACY_FOOTER_TEXTS = ['DocentOS Community Edition', 'Created and maintained by Giantucchi (Jose Luis Hernandez Hernandez)'];
const LEGACY_GITHUB = 'https://github.com/giantucchi/docentos';

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Cada campo devuelve el texto propio o `undefined` si sigue siendo el de fábrica o está vacío. */
export const customLanding = (config: LandingConfig | null) => {
  if (!config) return {};
  const title = clean(config.heroTitle).replace('|', '').replace(/\s{2,}/g, ' ');
  const subtitle = clean(config.heroSubtitle);
  const ctaText = clean(config.heroCtaText);
  const benefits: LandingBenefit[] = Array.isArray(config.benefits) ? config.benefits : [];
  const legacyBenefits = benefits.length === 0 || benefits.some((item) => LEGACY_BENEFIT_TITLES.includes(clean(item.title)));
  const footerText = clean(config.footerText);
  const github = safeExternalUrl(config.githubUrl, false);
  return {
    heroTitle: title && clean(config.heroTitle) !== LEGACY_TITLE ? title : undefined,
    heroSubtitle: subtitle && !subtitle.startsWith(LEGACY_SUBTITLE_START) ? subtitle : undefined,
    heroCtaText: ctaText && !LEGACY_CTA_TEXTS.includes(ctaText) ? ctaText : undefined,
    heroCtaLink: clean(config.heroCtaLink) || undefined,
    featuredCourseId: Array.isArray(config.featuredCourseIds) ? config.featuredCourseIds.find(Boolean) : undefined,
    benefits: legacyBenefits ? undefined : benefits.filter((item) => clean(item.title)),
    footerText: footerText && !LEGACY_FOOTER_TEXTS.includes(footerText) ? footerText : undefined,
    githubUrl: github && github !== LEGACY_GITHUB && github !== `${LEGACY_GITHUB}/` ? github : undefined,
    discordUrl: safeExternalUrl(config.discordUrl, false) || undefined,
    twitterUrl: safeExternalUrl(config.twitterUrl, false) || undefined,
    linkedinUrl: safeExternalUrl(config.linkedinUrl, false) || undefined,
  };
};

/** Destinos que un botón de la portada puede tener. */
export type LandingTarget = { kind: 'courses' } | { kind: 'section'; id: string } | { kind: 'external'; url: string } | { kind: 'none' };

const SECTION_ALIASES: Record<string, LandingTarget> = {
  '#cursos': { kind: 'courses' }, '#courses': { kind: 'courses' }, '/courses': { kind: 'courses' }, '#catalogo': { kind: 'courses' },
  '#catalog': { kind: 'courses' }, '#vip': { kind: 'courses' }, '/vip': { kind: 'courses' }, '#planes': { kind: 'courses' }, '#pricing': { kind: 'courses' },
  '#inicio': { kind: 'section', id: 'inicio' }, '#beneficios': { kind: 'section', id: 'beneficios' }, '#testimonios': { kind: 'section', id: 'testimonios' },
};

export const landingTarget = (link: string | undefined): LandingTarget => {
  const value = clean(link);
  if (!value) return { kind: 'courses' };
  const external = safeExternalUrl(value, false);
  if (external) return { kind: 'external', url: external };
  return SECTION_ALIASES[value.toLowerCase()] ?? { kind: 'courses' };
};

const LandingConfigContext = createContext<LandingConfig | null>(null);

/** Entrega la configuración al inicio. Con `value` se usa ese borrador (vista previa del editor) y no se pide nada al servidor. */
export const LandingConfigProvider: React.FC<{ value?: LandingConfig; children: React.ReactNode }> = ({ value, children }) => {
  const [loaded, setLoaded] = useState<LandingConfig | null>(null);
  useEffect(() => {
    if (value) return;
    let cancelled = false;
    api.getLandingConfig().then((res) => { if (!cancelled && res?.config) setLoaded(res.config); }).catch(() => { /* sin configuración, el inicio usa sus textos */ });
    return () => { cancelled = true; };
  }, [value]);
  return <LandingConfigContext.Provider value={value ?? loaded}>{children}</LandingConfigContext.Provider>;
};

export const useLandingConfig = () => customLanding(useContext(LandingConfigContext));
