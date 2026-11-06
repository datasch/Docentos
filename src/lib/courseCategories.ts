/**
 * Categorías oficiales y estandarizadas de cursos en DocentOS.
 */

export const MENTORSHIP_CATEGORIES = [
  'Mentoría Especializada',
  'Mentoría Premium',
  'Mentoría Elite',
] as const;

export const TECHNICAL_CATEGORIES = [
  'Desarrollo Web',
  'Inteligencia Artificial',
  'Ciberseguridad',
  'Tecnología e Ingeniería',
  'Negocios y Emprendimiento',
  'Diseño y Creatividad',
  'Cloud & DevOps',
] as const;

export const STANDARD_COURSE_CATEGORIES = [
  ...MENTORSHIP_CATEGORIES,
  ...TECHNICAL_CATEGORIES,
] as const;

export type StandardCourseCategory = (typeof STANDARD_COURSE_CATEGORIES)[number];

/**
 * Normaliza y verifica si una categoría pertenece al catálogo oficial estandarizado de DocentOS.
 */
export function isStandardCategory(category?: string | null): category is StandardCourseCategory {
  return getCanonicalCategory(category) !== null;
}

/**
 * Obtiene el nombre canónico de la categoría estandarizada respetando mayúsculas y acentos.
 */
export function getCanonicalCategory(category?: string | null): StandardCourseCategory | null {
  if (!category) return null;
  const trimmed = category.trim().toLowerCase();
  
  // 1. Coincidencia exacta (case-insensitive) con las categorías oficiales
  const exact = STANDARD_COURSE_CATEGORIES.find((sc) => sc.toLowerCase() === trimmed);
  if (exact) return exact;

  // 2. Alias canónicos comunes y pruebas automatizadas
  if (trimmed === 'negocios') return 'Negocios y Emprendimiento';
  if (trimmed === 'diseño' || trimmed === 'diseno') return 'Diseño y Creatividad';
  if (trimmed === 'cloud' || trimmed === 'devops') return 'Cloud & DevOps';
  if (trimmed === 'ia') return 'Inteligencia Artificial';

  return null;
}
