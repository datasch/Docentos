/**
 * Medición de "visto de forma limpia".
 *
 * La comparten el navegador (que va sumando lo que el alumno reproduce) y el
 * servidor (que es quien decide si la lección se puede completar).
 *
 * Un tramo `[inicio, fin)` está en segundos enteros. La lista se mantiene
 * ordenada y sin solapes, así que repetir un tramo no suma dos veces.
 */

export type WatchRanges = Array<[number, number]>;

/** Fracción del video que hay que ver para desbloquear la siguiente lección. */
export const WATCH_THRESHOLD = 0.9;

/**
 * Mayor avance entre dos lecturas del reproductor que todavía cuenta como
 * reproducción normal. Las lecturas llegan cada 0,25–1 s y la velocidad
 * máxima es 2x; cualquier salto mayor es la barra, los +10 s o una tecla.
 */
export const MAX_NATURAL_STEP = 3;

function normalize(ranges: WatchRanges): WatchRanges {
  const sorted = ranges
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .map(([start, end]) => [start, end] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: WatchRanges = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/** Inserta el tramo `[floor(from), ceil(to))` y fusiona los que se tocan o se solapan. */
export function addWatchedSegment(ranges: WatchRanges, from: number, to: number): WatchRanges {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return normalize(ranges);
  const start = Math.max(0, Math.floor(Math.min(from, to)));
  const end = Math.max(0, Math.ceil(Math.max(from, to)));
  if (end <= start) return normalize(ranges);
  return normalize([...ranges, [start, end]]);
}

/**
 * Registra una lectura del reproductor. Solo suma si el avance desde la
 * lectura anterior es reproducción normal (`0 < paso <= MAX_NATURAL_STEP`).
 * Un salto, una pausa o un retroceso no suman nada.
 */
export function registerPlaybackTick(
  ranges: WatchRanges,
  previousTime: number | null,
  currentTime: number,
): WatchRanges {
  if (previousTime === null || !Number.isFinite(previousTime) || !Number.isFinite(currentTime)) return ranges;
  const step = currentTime - previousTime;
  if (step <= 0 || step > MAX_NATURAL_STEP) return ranges;
  return addWatchedSegment(ranges, previousTime, currentTime);
}

export function watchedSeconds(ranges: WatchRanges): number {
  return normalize(ranges).reduce((total, [start, end]) => total + (end - start), 0);
}

/** Fracción vista. 0 si la duración no es finita o es <= 0 (un stream sin duración llega como Infinity). */
export function watchedFraction(ranges: WatchRanges, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const total = Math.ceil(duration);
  const seen = normalize(ranges).reduce(
    (sum, [start, end]) => sum + Math.max(0, Math.min(end, total) - Math.max(start, 0)),
    0,
  );
  return Math.min(1, seen / total);
}

export function isCleanlyWatched(ranges: WatchRanges, duration: number, threshold = WATCH_THRESHOLD): boolean {
  return watchedFraction(ranges, duration) >= threshold;
}

/** Lee tramos guardados como JSON. Tolera datos corruptos (devuelve `[]`) y re-fusiona. */
export function parseWatchRanges(raw: unknown): WatchRanges {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const ranges: WatchRanges = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const start = Number(item[0]);
    const end = Number(item[1]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    ranges.push([Math.max(0, Math.floor(start)), Math.ceil(end)]);
  }
  return normalize(ranges);
}
