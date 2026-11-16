/**
 * Espaciado vertical del camino de islas segun la longitud de los titulos.
 *
 * El rotulo de cada isla muestra el titulo completo (13px, interlineado 1.25,
 * unos 20 caracteres por linea medidos con el ancho maximo; se estiman 18 para
 * cubrir tambien pantallas estrechas) mas 12px de relleno vertical.
 * Con titulos cortos el espaciado base (165px) basta; con titulos largos crece lo
 * justo para que el rotulo no choque con la isla siguiente.
 */

const ROCK_HALF_HEIGHT = 35;
const LABEL_GAP = 8;
const LABEL_AIR = 12;
const CHARS_PER_LINE = 18;
export const BASE_STEP_Y = 165;
export const BASE_BOTTOM_OFFSET = 95;

export function estimateLabelHeight(titleLength: number): number {
  const lines = Math.max(1, Math.ceil(titleLength / CHARS_PER_LINE));
  return Math.round((lines * 16.25 + 12) * 100) / 100;
}

export function caminoSpacing(longestTitle: number) {
  const labelHeight = estimateLabelHeight(longestTitle);
  return {
    // Roca (35px bajo el centro) + hueco + rotulo + aire + mitad de la roca siguiente.
    stepY: Math.max(BASE_STEP_Y, Math.ceil(ROCK_HALF_HEIGHT + LABEL_GAP + labelHeight + LABEL_AIR + ROCK_HALF_HEIGHT)),
    bottomOffset: Math.max(BASE_BOTTOM_OFFSET, Math.ceil(labelHeight + ROCK_HALF_HEIGHT)),
  };
}
