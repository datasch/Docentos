/**
 * Transición del cambio de modo claro/oscuro.
 *
 * Antes el tema cambiaba de golpe: de negro a blanco en un solo fotograma, que es
 * justo lo que más cansa la vista. Ahora el tema nuevo se revela como un círculo
 * que nace en el propio botón y crece con el borde difuminado, como un amanecer
 * (u ocaso, al volver a oscuro).
 *
 * Cómo funciona: la View Transitions API congela una imagen del tema viejo y otra
 * del nuevo; aquí solo se anima una máscara (`radial-gradient`) sobre la nueva. La
 * máscara usa la propiedad registrada `--vt-reveal`, que crece de 0 hasta cubrir la
 * esquina más lejana más el ancho del difuminado. Las reglas CSS viven en index.css.
 *
 * Reglas de movimiento:
 * - Con «reducir movimiento» no hay desplazamiento: solo un fundido corto, que
 *   además suaviza el salto de brillo.
 * - Sin View Transitions (Firefox, por ejemplo), un fundido de colores de 0,4 s.
 * - Si se pulsa otra vez a mitad, se cancela la anterior y el estado final se
 *   fija directamente: nunca depende de que la animación termine.
 */

interface ViewTransitionLike {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition(): void;
}

type DocumentWithTransitions = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => ViewTransitionLike;
};

/** Duración del revelado y curva: arranque suave y llegada larga (desaceleración). */
export const REVEAL_MS = 760;
export const REVEAL_EASING = 'cubic-bezier(0.45, 0.05, 0.2, 1)';
/** Ancho del borde difuminado, en píxeles. */
export const FEATHER_PX = 180;
/** Fundido de la alternativa sin View Transitions. */
const FALLBACK_MS = 400;
/** Un clic cuenta como origen de la onda durante este tiempo. */
const POINTER_MAX_AGE_MS = 1500;

/** Distancia desde (x, y) hasta la esquina más lejana de un rectángulo w × h. */
export function farthestCorner(x: number, y: number, width: number, height: number): number {
  return Math.max(Math.hypot(x, y), Math.hypot(width - x, y), Math.hypot(x, height - y), Math.hypot(width - x, height - y));
}

export interface Rect { left: number; top: number; width: number; height: number }

/** Un bloque de la interfaz solo cuenta como "opaco" si es de buen tamaño... */
const MIN_BLOCK_AREA = 4000;
/** ...y no es el fondo de página entero (esos envuelven a la G, no la tapan). */
const MAX_BLOCK_RATIO = 0.85;
/** Opacidad mínima del fondo para que un bloque tape lo que tiene detrás. */
const MIN_BLOCK_ALPHA = 0.8;

/**
 * Recorte (`clip-path`) que deja a la G fuera de los bloques opacos de la interfaz.
 *
 * Durante la transición la G va en un grupo propio que la API pinta SIEMPRE por
 * encima de la imagen principal, así que sus triángulos se montaban sobre la barra
 * de navegación, las tarjetas, el banner y el botón del buzón. En la página real la
 * G va por detrás de todo eso. Este recorte restituye ese orden: una ventana
 * (hueco) por cada bloque opaco.
 *
 * Los huecos usan la regla par-impar, que se anula donde dos se solapan, así que de
 * cada grupo que se solapa solo se conserva el mayor. Devuelve null si no hay huecos.
 */
export function clipPathAround(width: number, height: number, blocks: Rect[]): string | null {
  const area = (r: Rect) => r.width * r.height;
  const overlap = (a: Rect, b: Rect) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
  const kept: Rect[] = [];
  for (const block of [...blocks].sort((a, b) => area(b) - area(a))) {
    if (area(block) < MIN_BLOCK_AREA || area(block) > width * height * MAX_BLOCK_RATIO) continue;
    if (kept.some((k) => overlap(k, block))) continue;
    kept.push(block);
  }
  if (!kept.length) return null;
  const holes = kept.map((r) => {
    const left = Math.round(Math.max(0, r.left));
    const top = Math.round(Math.max(0, r.top));
    const w = Math.round(Math.min(width, r.left + r.width)) - left;
    const h = Math.round(Math.min(height, r.top + r.height)) - top;
    return `M${left} ${top}h${w}v${h}h${-w}Z`;
  });
  return `path(evenodd, "M0 0H${width}V${height}H0Z ${holes.join(' ')}")`;
}

/** Opacidad (0-1) de un color CSS calculado: rgb(), rgba(), color(... / a) o transparent. */
export function cssAlpha(color: string): number {
  if (!color || color === 'transparent') return 0;
  const slash = color.match(/\/\s*([\d.]+%?)/);
  if (slash) return slash[1].endsWith('%') ? Number.parseFloat(slash[1]) / 100 : Number.parseFloat(slash[1]);
  if (/^rgba\(/i.test(color)) {
    const parts = color.replace(/^rgba\(|\)$/gi, '').split(',');
    return parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
  }
  return 1;
}

/** Bloques opacos de la interfaz que están a la vista: lo que en la página real tapa a la G. */
function opaqueBlocks(): Rect[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const found: Rect[] = [];
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
    if (el.closest('[aria-hidden="true"]')) continue;                       // la propia G y sus adornos
    const box = el.getBoundingClientRect();
    if (box.width * box.height < MIN_BLOCK_AREA || box.bottom <= 0 || box.right <= 0 || box.top >= vh || box.left >= vw) continue;
    if (cssAlpha(getComputedStyle(el).backgroundColor) < MIN_BLOCK_ALPHA) continue;
    found.push({ left: box.left, top: box.top, width: box.width, height: box.height });
  }
  return found;
}

let lastPointer: { x: number; y: number; at: number } | null = null;
let running: ViewTransitionLike | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  // El clic sobre el botón fija el origen de la onda.
  window.addEventListener(
    'pointerdown',
    (event) => {
      lastPointer = { x: event.clientX, y: event.clientY, at: performance.now() };
    },
    { capture: true, passive: true },
  );
}

/** Origen de la onda: el último clic, o el centro del botón enfocado si fue con teclado. */
function originPoint(): { x: number; y: number } {
  if (lastPointer && performance.now() - lastPointer.at < POINTER_MAX_AGE_MS) return lastPointer;
  const active = document.activeElement;
  if (typeof HTMLElement !== 'undefined' && active instanceof HTMLElement && active !== document.body) {
    const box = active.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }
  return { x: window.innerWidth - 56, y: 32 };
}

/**
 * Cede un turno para que React confirme los cambios que provoca el evento de tema
 * antes de capturar la imagen nueva. Solo un turno: cada milisegundo aquí es
 * retardo entre el clic y el primer movimiento.
 */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function fadeFallback(root: HTMLElement, apply: () => void, reduceMotion: boolean) {
  root.classList.toggle('theme-fade-short', reduceMotion);
  root.classList.add('theme-fade');
  apply();
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => root.classList.remove('theme-fade', 'theme-fade-short'), FALLBACK_MS + 80);
}

/**
 * Ejecuta `apply` (el cambio real del tema) con la transición. `apply` se llama
 * siempre, haya animación o no, y exactamente una vez.
 */
export function runThemeTransition(apply: () => void): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    apply();
    return;
  }

  const doc = document as DocumentWithTransitions;
  const root = document.documentElement;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  if (!doc.startViewTransition) {
    fadeFallback(root, apply, reduceMotion);
    return;
  }

  // Pulsar otra vez a mitad: se corta la anterior; su cierre no toca el estado de esta.
  running?.skipTransition();

  const { x, y } = originPoint();
  const reveal = Math.round(farthestCorner(x, y, window.innerWidth, window.innerHeight) + FEATHER_PX);
  root.classList.remove('theme-reveal', 'theme-crossfade');
  root.classList.add(reduceMotion ? 'theme-crossfade' : 'theme-reveal');
  root.style.setProperty('--vt-x', `${Math.round(x)}px`);
  root.style.setProperty('--vt-y', `${Math.round(y)}px`);
  root.style.setProperty('--vt-feather', `${FEATHER_PX}px`);
  // La G pasa a un grupo propio (ver index.css); este recorte la deja por detrás de la interfaz opaca.
  // Debe medirse ahora, con la página tal como está, antes de que la API capture nada.
  const gClip = reduceMotion ? null : clipPathAround(window.innerWidth, window.innerHeight, opaqueBlocks());
  if (gClip) root.style.setProperty('--vt-g-clip', gClip);

  const cleanup = () => {
    root.classList.remove('theme-reveal', 'theme-crossfade');
    root.style.removeProperty('--vt-x');
    root.style.removeProperty('--vt-y');
    root.style.removeProperty('--vt-feather');
    root.style.removeProperty('--vt-g-clip');
  };

  let transition: ViewTransitionLike;
  try {
    transition = doc.startViewTransition(async () => {
      apply();
      await settle();
    });
  } catch {
    cleanup();
    apply();
    return;
  }
  running = transition;

  if (!reduceMotion) {
    transition.ready
      .then(() => {
        root.animate(
          [{ '--vt-reveal': '0px' }, { '--vt-reveal': `${reveal}px` }] as unknown as Keyframe[],
          { duration: REVEAL_MS, easing: REVEAL_EASING, fill: 'both', pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => {
        /* Transición cancelada: el tema ya está aplicado. */
      });
  }

  transition.finished
    .catch(() => {
      /* Cancelada o saltada: el estado final ya está fijado. */
    })
    .finally(() => {
      if (running === transition) {
        running = null;
        cleanup();
      }
    });
}
