/**
 * El espectro de marca como eje de progreso.
 *
 * Los seis colores dejan de ser decoracion y pasan a codificar posicion: cada
 * modulo toma el siguiente tono del gradiente, asi que el color del riel dice
 * en que punto del curso estas antes de leer un solo titulo. Se inyecta como
 * --hue en el contenedor del modulo y se consume con bg-(--hue) / text-(--hue),
 * de forma que ningun componente escribe un hexadecimal.
 */
export const MODULE_HUES = [
  'var(--color-brand-cyan)',
  'var(--color-brand-blue)',
  'var(--color-brand-purple)',
  'var(--color-brand-magenta)',
  'var(--color-brand-orange)',
  'var(--color-brand-yellow)',
] as const;

/** Cursos con mas de seis modulos vuelven a empezar el espectro. */
export function moduleHue(index: number): string {
  return MODULE_HUES[index % MODULE_HUES.length];
}
