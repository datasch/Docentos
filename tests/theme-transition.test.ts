import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clipPathAround, cssAlpha, farthestCorner, runThemeTransition, FEATHER_PX, REVEAL_MS } from '../src/lib/themeTransition.js';

/** Un DOM mínimo: lo justo que usa runThemeTransition. */
interface FakeBlock { left: number; top: number; width: number; height: number; bg: string; hidden?: boolean }

function fakeBrowser({ reduceMotion = false, withViewTransitions = true, blocks = [] as FakeBlock[] } = {}) {
  const classes = new Set<string>();
  const styleProps = new Map<string, string>();
  const animations: Array<{ keyframes: unknown; options: Record<string, unknown> }> = [];
  const transitions: Array<{ finish: () => void; skipped: boolean }> = [];

  const root = {
    classList: {
      add: (...names: string[]) => names.forEach((n) => classes.add(n)),
      remove: (...names: string[]) => names.forEach((n) => classes.delete(n)),
      toggle: (name: string, force?: boolean) => ((force ?? !classes.has(name)) ? classes.add(name) : classes.delete(name)),
      contains: (name: string) => classes.has(name),
    },
    style: {
      setProperty: (key: string, value: string) => styleProps.set(key, value),
      removeProperty: (key: string) => styleProps.delete(key),
    },
    animate: (keyframes: unknown, options: Record<string, unknown>) => animations.push({ keyframes, options }),
  };

  const elements = blocks.map((b) => ({
    bg: b.bg,
    closest: (selector: string) => (b.hidden && selector === '[aria-hidden="true"]' ? {} : null),
    getBoundingClientRect: () => ({ left: b.left, top: b.top, width: b.width, height: b.height, right: b.left + b.width, bottom: b.top + b.height }),
  }));
  const doc: Record<string, unknown> = { documentElement: root, activeElement: null, body: { querySelectorAll: () => elements } };
  if (withViewTransitions) {
    doc.startViewTransition = (update: () => void | Promise<void>) => {
      let finish!: () => void;
      const finished = new Promise<void>((resolve) => { finish = resolve; });
      const entry = { finish, skipped: false };
      transitions.push(entry);
      const updated = Promise.resolve(update());
      return { ready: updated, finished, skipTransition: () => { entry.skipped = true; finish(); } };
    };
  }

  Object.assign(globalThis, {
    HTMLElement: class {},
    getComputedStyle: (el: { bg: string }) => ({ backgroundColor: el.bg }),
    document: doc,
    window: { innerWidth: 1000, innerHeight: 600, matchMedia: () => ({ matches: reduceMotion }), addEventListener: () => {} },
  });
  return { classes, styleProps, animations, transitions };
}

function dropBrowser() {
  for (const key of ['document', 'window', 'HTMLElement', 'getComputedStyle']) delete (globalThis as Record<string, unknown>)[key];
}

test('farthestCorner: desde una esquina es la diagonal; desde el centro, media diagonal', () => {
  assert.ok(Math.abs(farthestCorner(0, 0, 300, 400) - 500) < 1e-9);
  assert.ok(Math.abs(farthestCorner(150, 200, 300, 400) - 250) < 1e-9);
  // Un punto cerca de la esquina superior derecha llega lejos, hasta la inferior izquierda.
  assert.ok(Math.abs(farthestCorner(300, 0, 300, 400) - 500) < 1e-9);
});

test('sin DOM, el cambio de tema se aplica una sola vez y de inmediato', () => {
  dropBrowser();
  let calls = 0;
  runThemeTransition(() => { calls++; });
  assert.equal(calls, 1);
});

test('con View Transitions: revelado circular, tema aplicado una vez y limpieza al terminar', async () => {
  const b = fakeBrowser();
  let calls = 0;
  runThemeTransition(() => { calls++; });

  assert.ok(b.classes.has('theme-reveal'));
  assert.ok(!b.classes.has('theme-crossfade'));
  assert.equal(b.styleProps.get('--vt-feather'), `${FEATHER_PX}px`);
  assert.ok(b.styleProps.has('--vt-x') && b.styleProps.has('--vt-y'));

  await new Promise((resolve) => setTimeout(resolve, 80)); // el tema se aplica y la máscara arranca
  assert.equal(calls, 1);
  assert.equal(b.animations.length, 1);
  const { keyframes, options } = b.animations[0];
  assert.equal(options.duration, REVEAL_MS);
  assert.equal(options.pseudoElement, '::view-transition-new(root)');
  // Origen por defecto (arriba a la derecha) → la esquina más lejana más el difuminado.
  const end = Math.round(farthestCorner(944, 32, 1000, 600) + FEATHER_PX);
  assert.deepEqual(keyframes, [{ '--vt-reveal': '0px' }, { '--vt-reveal': `${end}px` }]);

  b.transitions[0].finish();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(!b.classes.has('theme-reveal'));
  assert.ok(!b.styleProps.has('--vt-x'));
  dropBrowser();
});

test('con movimiento reducido: solo fundido, sin máscara ni desplazamiento', async () => {
  const b = fakeBrowser({ reduceMotion: true });
  let calls = 0;
  runThemeTransition(() => { calls++; });
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.ok(b.classes.has('theme-crossfade'));
  assert.ok(!b.classes.has('theme-reveal'));
  assert.equal(b.animations.length, 0);
  assert.equal(calls, 1);
  b.transitions[0].finish();
  dropBrowser();
});

test('una segunda pulsación a mitad cancela la anterior y aplica su propio cambio', async () => {
  const b = fakeBrowser();
  const applied: string[] = [];
  runThemeTransition(() => { applied.push('primero'); });
  runThemeTransition(() => { applied.push('segundo'); });
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(b.transitions[0].skipped, true);
  assert.equal(b.transitions[1].skipped, false);
  assert.deepEqual(applied, ['primero', 'segundo']);
  // El cierre de la primera no limpia el estado de la segunda, que sigue en marcha.
  assert.ok(b.classes.has('theme-reveal'));
  b.transitions[1].finish();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(!b.classes.has('theme-reveal'));
  dropBrowser();
});

test('sin View Transitions: fundido de colores y el tema se aplica en el acto', async () => {
  const b = fakeBrowser({ withViewTransitions: false });
  let calls = 0;
  runThemeTransition(() => { calls++; });
  assert.equal(calls, 1);
  assert.ok(b.classes.has('theme-fade'));
  await new Promise((resolve) => setTimeout(resolve, 560));
  assert.ok(!b.classes.has('theme-fade'));
  dropBrowser();
});

test('la G no se congela al pulsar: su canvas es un grupo propio de la transición, con la imagen nueva en vivo', () => {
  // Dentro de la imagen del tema, la zona sin revelar es una foto fija y los triángulos se quedaban
  // quietos ~150 ms al pulsar. Como grupo propio, su imagen nueva es en vivo. Este contrato evita que
  // alguien quite la clase del canvas o la regla del CSS sin darse cuenta de lo que rompe.
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const canvas = readFileSync(new URL('../src/experiences/constellation/ConstellationCanvas.tsx', import.meta.url), 'utf8');

  // Los dos canvas (pantalla completa e incrustado) llevan su clase y cada uno su propio nombre.
  assert.match(canvas, /className="constellation-canvas constellation-canvas--full /);
  assert.match(canvas, /className="constellation-canvas constellation-canvas--inline /);
  assert.match(css, /html\.theme-reveal \.constellation-canvas--full\s*\{\s*view-transition-name:\s*brand-g;\s*\}/);
  assert.match(css, /html\.theme-reveal \.constellation-canvas--inline\s*\{\s*view-transition-name:\s*brand-g-inline;\s*\}/);
  // Los nombres no pueden repetirse (la transición entera se anularía) ni coincidir con el del botón.
  const names = [...css.matchAll(/view-transition-name:\s*([\w-]+)/g)].map((m) => m[1]);
  assert.equal(new Set(names).size, names.length, `nombres repetidos: ${names.join(', ')}`);
  // La imagen vieja del canvas se oculta y la nueva (en vivo) se queda sin animación de fundido.
  assert.match(css, /view-transition-old\(brand-g\),\s*html\.theme-reveal::view-transition-old\(brand-g-inline\)\s*\{\s*opacity:\s*0;/);
  assert.match(css, /view-transition-new\(brand-g\)[\s\S]*?\{\s*animation:\s*none;/);
});

test('cssAlpha: lee la opacidad de los formatos que devuelve el navegador', () => {
  assert.equal(cssAlpha('rgb(9, 9, 11)'), 1);
  assert.equal(cssAlpha('rgba(239, 245, 249, 0.88)'), 0.88);
  assert.equal(cssAlpha('rgba(0, 0, 0, 0)'), 0);
  assert.equal(cssAlpha('transparent'), 0);
  assert.equal(cssAlpha('color(srgb 0.0862745 0.156863 0.227451 / 0.1)'), 0.1);
  assert.equal(cssAlpha('color(srgb 0.9 0.9 0.9 / 50%)'), 0.5);
  assert.equal(cssAlpha('color(srgb 0.9 0.9 0.9)'), 1);
});

test('clipPathAround: la G queda fuera de la barra, el banner y las tarjetas (como por detrás de la interfaz)', () => {
  const header = { left: 0, top: 47, width: 1440, height: 72 };          // la barra de navegación
  const card = { left: 104, top: 657, width: 1232, height: 430 };         // la tarjeta destacada
  const clip = clipPathAround(1440, 900, [header, card]);
  assert.ok(clip);
  assert.match(clip!, /^path\(evenodd, "M0 0H1440V900H0Z /);
  assert.ok(clip!.includes('M0 47h1440v72h-1440Z'), 'hueco de la barra');
  assert.ok(clip!.includes('M104 657h1232v243h-1232Z'), 'hueco de la tarjeta, recortado al borde de la pantalla');
});

test('clipPathAround: ignora lo que no tapa a la G y no deja que dos huecos se anulen', () => {
  const big = { left: 0, top: 0, width: 1440, height: 900 };              // fondo de página entero: envuelve a la G
  const tiny = { left: 10, top: 10, width: 20, height: 20 };               // demasiado pequeño
  assert.equal(clipPathAround(1440, 900, [big, tiny]), null);

  // Dos bloques que se solapan: con la regla par-impar se anularían, así que solo queda el mayor.
  const a = { left: 100, top: 100, width: 400, height: 300 };
  const b = { left: 300, top: 200, width: 300, height: 300 };
  const clip = clipPathAround(1440, 900, [b, a])!;
  assert.equal(clip.match(/M\d+ \d+h/g)?.length, 1);
  assert.ok(clip.includes('M100 100h400v300h-400Z'));
});

test('el recorte de la G llega al CSS: variable --vt-g-clip aplicada al grupo, y la transición la fija y la limpia', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const lib = readFileSync(new URL('../src/lib/themeTransition.ts', import.meta.url), 'utf8');
  assert.match(css, /view-transition-group\(brand-g\),\s*html\.theme-reveal::view-transition-group\(brand-g-inline\)\s*\{[^}]*clip-path:\s*var\(--vt-g-clip, none\)/);
  assert.match(lib, /root\.style\.setProperty\('--vt-g-clip'/);
  assert.match(lib, /root\.style\.removeProperty\('--vt-g-clip'\)/);
});

test('en la transición, la G se recorta alrededor de la interfaz opaca y el recorte se limpia al terminar', async () => {
  const b = fakeBrowser({
    blocks: [
      { left: 0, top: 47, width: 1000, height: 72, bg: 'rgba(239, 245, 249, 0.88)' },   // barra translúcida pero que tapa
      { left: 100, top: 300, width: 300, height: 200, bg: 'rgb(239, 245, 249)' },        // tarjeta
      { left: 0, top: 130, width: 1000, height: 160, bg: 'rgba(0, 0, 0, 0)' },            // sección transparente: no tapa
      { left: 600, top: 100, width: 300, height: 300, bg: 'rgb(9, 9, 11)', hidden: true }, // dentro de algo aria-hidden (la propia G)
    ],
  });
  runThemeTransition(() => {});
  const clip = b.styleProps.get('--vt-g-clip') ?? '';
  assert.ok(clip.includes('M0 47h1000v72h-1000Z'), 'hueco de la barra');
  assert.ok(clip.includes('M100 300h300v200h-300Z'), 'hueco de la tarjeta');
  assert.equal(clip.match(/M\d+ \d+h/g)?.length, 2, 'solo la barra y la tarjeta');

  await new Promise((resolve) => setTimeout(resolve, 80));
  b.transitions[0].finish();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(b.styleProps.has('--vt-g-clip'), false);
  dropBrowser();
});

test('con movimiento reducido no se calcula ningún recorte (no hay grupo de la G)', () => {
  const b = fakeBrowser({ reduceMotion: true, blocks: [{ left: 0, top: 0, width: 500, height: 100, bg: 'rgb(0, 0, 0)' }] });
  runThemeTransition(() => {});
  assert.equal(b.styleProps.has('--vt-g-clip'), false);
  dropBrowser();
});
