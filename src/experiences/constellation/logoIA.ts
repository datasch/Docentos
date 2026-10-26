/* ------------------------------------------------------------------
   Logo de IA vivo «Prisma» (portado desde TalentHuman)
   
   Cada instancia es un logo con su propio estado:
   reposo · escucha · piensa · habla · celebra.

   Un solo bucle requestAnimationFrame calcula y pinta todas las instancias
   visibles. Los valores persiguen su objetivo con muelles, así que los
   cambios de estado nunca saltan, y al salir de un estado los giros vuelven
   a múltiplos de 60°: en reposo la geometría es exactamente la del manual.
   ------------------------------------------------------------------ */

export type EvaluatorId = 'salome' | 'celeste' | 'nai' | 'ian';
export const DEFAULT_EVALUATOR_ID: EvaluatorId = 'celeste';

export type EstadoIA = 'reposo' | 'escucha' | 'piensa' | 'habla' | 'celebra';

const NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;
/** La opacidad del manual se alcanza con lit = 1; por encima, brilla. */
const LUZ_MAX = 1.75;

const reducido = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const HEX = (r: number) =>
  [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (i * Math.PI) / 3;
      return (r * Math.sin(a)).toFixed(2) + ',' + (-r * Math.cos(a)).toFixed(2);
    })
    .join(' ');
const r60 = (v: number) => Math.round(v / 60) * 60;

/** Geometría del manual: 12 direcciones a 30°, largas y cortas alternas. */
const GEO = Array.from({ length: 12 }, (_, k) => {
  const g = k % 2 === 0;
  return {
    k,
    g,
    a: k * 30,
    r0: g ? 37.5 : 32.8,
    r1: g ? 70.2 : 56.2,
    d: g ? 82.4 : 65.5,
    nr: g ? 5.62 : 3.75,
    fase: (k * 0.618) % 1,
  };
});

/** El color de cada evaluador queda arriba (0°) en la rueda. */
const GIRO_QUIEN: Record<string, number> = { salome: 6, celeste: 0, nai: 4, ian: 10 };

/** Poses quietas para movimiento reducido: cada estado se sigue distinguiendo. */
const POSE: Record<EstadoIA, { ext: number; ns: number; lit: number; s: number; aroO: number; aroS: number; aroR: number; e: number }> = {
  reposo: { ext: 1, ns: 1, lit: 1, s: 1, aroO: 0, aroS: 1, aroR: 0, e: 0.12 },
  escucha: { ext: 0.93, ns: 1.15, lit: 0.55, s: 0.96, aroO: 0.45, aroS: 1.4, aroR: 0, e: 0.2 },
  piensa: { ext: 0.88, ns: 0.9, lit: 0.3, s: 0.92, aroO: 0.6, aroS: 1.15, aroR: 30, e: 0.1 },
  habla: { ext: 1.08, ns: 1.25, lit: 1.6, s: 1.04, aroO: 0, aroS: 1, aroR: 0, e: 0.6 },
  celebra: { ext: 1.16, ns: 1.4, lit: 1.75, s: 1.06, aroO: 0, aroS: 1, aroR: 0, e: 1 },
};

/** Habla: un plan de sílabas y pausas, determinista. */
const PLAN = (() => {
  let sem = 7;
  const rnd = () => (sem = (sem * 16807) % 2147483647) / 2147483647;
  const s: { t0: number; d: number; a: number }[] = [];
  let t = 0;
  while (t < 36) {
    const n = 3 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const d = 0.11 + rnd() * 0.17;
      s.push({ t0: t, d, a: 0.45 + rnd() * 0.55 });
      t += d + rnd() * 0.05;
    }
    t += 0.3 + rnd() * 0.45;
  }
  return { s, largo: t };
})();

function silabaEn(t: number): { i: number; a?: number; env: number } {
  const tt = ((t % PLAN.largo) + PLAN.largo) % PLAN.largo;
  for (let i = 0; i < PLAN.s.length; i++) {
    const x = PLAN.s[i];
    if (tt < x.t0) return { i: -1, env: 0 };
    if (tt < x.t0 + x.d) return { i, a: x.a, env: x.a * Math.pow(Math.sin((Math.PI * (tt - x.t0)) / x.d), 0.7) };
  }
  return { i: -1, env: 0 };
}

interface Muelle { v: number; w: number; t: number; k: number; c: number }
const muelle = (v: number, k: number, c: number): Muelle => ({ v, w: 0, t: v, k, c });
function paso(m: Muelle, dt: number) {
  m.w += (m.t - m.v) * m.k * dt;
  m.w *= Math.exp(-m.c * dt);
  m.v += m.w * dt;
}

function el<K extends keyof SVGElementTagNameMap>(n: K, at: Record<string, string | number>, padre?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, n) as SVGElementTagNameMap[K];
  for (const k in at) e.setAttribute(k, String(at[k]));
  if (padre) padre.appendChild(e);
  return e;
}

interface Direccion { ext: Muelle; ns: Muelle; lit: number; pulso: { p: number; a: number } }
interface Onda { r: number; v: number; a: number; vida: number; t: number }
interface Chispa { x: number; y: number; vx: number; vy: number; vida: number; t: number; k: number; tam: number; hexa: boolean; giro: number }

interface Modelo {
  dirs: Direccion[];
  s: Muelle; rot: Muelle; gx: Muelle; gy: Muelle; ag: Muelle; ac: Muelle;
  ab: number; aroO: number; aroS: number; aroR: number;
  estado: EstadoIA; t: number; tick: number; rafagaEn: number; silPrev: number;
  energia: number; destello: number; nacer: number; senal: number; voz: number;
  ondas: Onda[]; chispas: Chispa[];
}

function modelo(): Modelo {
  return {
    dirs: GEO.map(() => ({ ext: muelle(1, 190, 12), ns: muelle(1, 210, 14), lit: 1, pulso: { p: -1, a: 0 } })),
    s: muelle(1, 230, 15), rot: muelle(0, 95, 10), gx: muelle(0, 60, 12), gy: muelle(0, 60, 12),
    ag: muelle(0, 120, 12), ac: muelle(0, 120, 12),
    ab: 0, aroO: 0, aroS: 1, aroR: 0, estado: 'reposo', t: 0, tick: -1, rafagaEn: 0, silPrev: -1,
    energia: 0.12, destello: 0, nacer: 99, senal: 0, voz: 0, ondas: [], chispas: [],
  };
}

interface Parte { r: SVGGElement; rayo: SVGRectElement; pulso: SVGRectElement; n: SVGGElement; nodo: SVGCircleElement }

export interface InstanciaIA {
  ser: HTMLElement;
  svg: SVGSVGElement;
  partes: Parte[];
  gc: SVGGElement;
  aro: SVGPolygonElement;
  hc: SVGPolygonElement;
  hm: SVGPolygonElement;
  lienzo: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  m: Modelo;
  quien: string | null;
  off: number;
  visible: boolean;
  base: EstadoIA;
  hasta: number;
  lado: number;
  dpr: number;
  cx: number;
  cy: number;
  u: number;
  fundido?: ReturnType<typeof setTimeout>;
  celebraConTodos: boolean;
  alTocar: () => void;
}

/* ---------- recursos compartidos (degradados y brillo, una sola vez) ---------- */
let sprite: SVGSVGElement | null = null;
function asegurarSprite() {
  if (sprite && sprite.isConnected) return;
  sprite = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' });
  sprite.style.position = 'absolute';
  sprite.style.width = '0';
  sprite.style.height = '0';
  sprite.style.overflow = 'hidden';
  const defs = el('defs', {}, sprite);
  GEO.forEach((d) => {
    const lg = el('linearGradient', { id: 'th-haz-ia-' + d.k, x1: 0, y1: 1, x2: 0, y2: 0 }, defs);
    const a = el('stop', { offset: 0 }, lg);
    const b = el('stop', { offset: 1 }, lg);
    a.style.stopColor = `var(--th-haz-${d.k}, #8b5cf6)`;
    a.style.stopOpacity = '0.96';
    b.style.stopColor = `var(--th-haz-${d.k}, #8b5cf6)`;
    b.style.stopOpacity = '0';
  });
  const f = el('filter', { id: 'th-brillo-ia', x: '-100%', y: '-100%', width: '300%', height: '300%' }, defs);
  el('feGaussianBlur', { stdDeviation: 2.6, result: 'b' }, f);
  const fm = el('feMerge', {}, f);
  el('feMergeNode', { in: 'b' }, fm);
  el('feMergeNode', { in: 'SourceGraphic' }, fm);
  document.body.prepend(sprite);
}

let colores: string[] = [];
function leerColores() {
  const cs = getComputedStyle(document.documentElement);
  colores = GEO.map((d) => cs.getPropertyValue('--th-haz-' + d.k).trim() || '#8b5cf6');
}

/* ---------- instancias ---------- */
const instancias: InstanciaIA[] = [];

function colorear(inst: InstanciaIA) {
  const q = inst.ser.dataset.quien || 'celeste';
  if (q === inst.quien) return;
  inst.quien = q;
  inst.off = GIRO_QUIEN[q] ?? 0;
  inst.partes.forEach((p, k) => {
    const c = (k + inst.off) % 12;
    p.r.style.setProperty('--c', `var(--th-haz-${c}, #8b5cf6)`);
    p.n.style.setProperty('--c', `var(--th-haz-${c}, #8b5cf6)`);
    p.rayo.setAttribute('fill', `url(#th-haz-ia-${c})`);
  });
}

function ponerEstado(inst: InstanciaIA, nuevo: EstadoIA) {
  const m = inst.m;
  if (m.estado === nuevo) return;
  m.ag.t = r60(m.ag.t);
  m.ac.t = r60(m.ac.t);
  m.rot.t = r60(m.rot.t);
  m.dirs.forEach((d) => { d.pulso.p = -1; });
  m.estado = nuevo;
  m.t = 0;
  m.tick = -1;
  m.rafagaEn = 0;
  m.silPrev = -1;
  inst.ser.dataset.estado = nuevo;
  if (reducido() && inst.visible) {
    inst.svg.style.opacity = '0.2';
    clearTimeout(inst.fundido);
    inst.fundido = setTimeout(() => { inst.svg.style.opacity = ''; }, 250);
  }
}

function nacer(inst: InstanciaIA) {
  const m = inst.m;
  m.dirs.forEach((d) => { d.ext.v = 0; d.ns.v = 0; d.lit = 0; d.ext.w = d.ns.w = 0; });
  m.s.v = 0.15;
  m.s.w = 0;
  m.nacer = 0;
  m.ondas.length = 0;
  m.chispas.length = 0;
}

/* ---------- luz alrededor del logo grande (canvas propio) ---------- */
function onda(m: Modelo, r: number, v: number, a: number, vida: number) {
  if (!reducido()) m.ondas.push({ r, v, a, vida, t: 0 });
}

function estallar(inst: InstanciaIA) {
  if (reducido() || !inst.lienzo) return;
  const m = inst.m, c = inst.lado / 2, u = inst.u;
  GEO.forEach((g, i) => {
    for (let n = 0; n < (g.g ? 10 : 6); n++) {
      const ang = ((g.a + (g.g ? m.ag.v : m.ac.v) + (Math.random() - 0.5) * 14) * Math.PI) / 180;
      const vel = (g.g ? 520 : 400) * (0.45 + Math.random() * 0.75) * u;
      const r0 = g.d * u;
      m.chispas.push({
        x: c + Math.sin(ang) * r0, y: c - Math.cos(ang) * r0, vx: Math.sin(ang) * vel, vy: -Math.cos(ang) * vel,
        vida: 1.2 + Math.random() * 0.8, t: 0, k: i, tam: (1.6 + Math.random() * 3) * u, hexa: Math.random() < 0.45, giro: Math.random() * 6,
      });
    }
  });
}

function hexa(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = giro + (i * Math.PI) / 3;
    const px = x + r * Math.sin(a), py = y - r * Math.cos(a);
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function medirLienzo(inst: InstanciaIA) {
  if (!inst.lienzo) return;
  const lado = inst.lienzo.clientWidth, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (lado && lado !== inst.lado) {
    inst.lado = lado;
    inst.lienzo.width = inst.lienzo.height = Math.round(lado * dpr);
    inst.dpr = dpr;
  }
}

function pintarLuz(inst: InstanciaIA, dt: number) {
  const ctx = inst.ctx, m = inst.m, L = inst.lado, c = L / 2, u = inst.u;
  if (!ctx || !L) return;
  ctx.setTransform(inst.dpr, 0, 0, inst.dpr, 0, 0);
  ctx.clearRect(0, 0, L, L);
  ctx.globalCompositeOperation = 'lighter';
  const color = (k: number) => colores[(k + inst.off) % 12] || '#8b5cf6';
  GEO.forEach((g, i) => {
    const d = m.dirs[i];
    const ang = ((g.a + (g.g ? m.ag.v : m.ac.v)) * Math.PI) / 180;
    const sx = Math.sin(ang), sy = -Math.cos(ang), nx = -sy, ny = sx;
    const r0 = g.d * Math.max(0.6, d.ext.v) * u + 8 * u;
    const ax = c + sx * r0, ay = c + sy * r0, bx = c + sx * c * 1.4, by = c + sy * c * 1.4;
    const a0 = 1.5 * u, a1 = (g.g ? 34 : 20) * u;
    const lg = ctx.createLinearGradient(ax, ay, bx, by);
    lg.addColorStop(0, color(i));
    lg.addColorStop(0.7, 'transparent');
    ctx.globalAlpha = Math.min(1, (0.04 + m.energia * 0.24 + m.destello * 0.3) * Math.min(1.4, d.lit) * (g.g ? 1 : 0.7));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(ax + nx * a0, ay + ny * a0);
    ctx.lineTo(bx + nx * a1, by + ny * a1);
    ctx.lineTo(bx - nx * a1, by - ny * a1);
    ctx.lineTo(ax - nx * a0, ay - ny * a0);
    ctx.fill();
  });
  for (let i = m.ondas.length - 1; i >= 0; i--) {
    const o = m.ondas[i];
    o.t += dt;
    o.r += o.v * dt;
    const x = o.t / o.vida;
    if (x >= 1 || o.r < 26) { m.ondas.splice(i, 1); continue; }
    ctx.globalAlpha = o.a * Math.sin(Math.PI * x);
    ctx.lineWidth = 1.6 * u;
    ctx.strokeStyle = colores[(i * 3 + inst.off) % 12] || '#8b5cf6';
    hexa(ctx, c + m.gx.v * u, c + m.gy.v * u, o.r * u, (m.rot.v * Math.PI) / 180);
    ctx.stroke();
  }
  for (let i = m.chispas.length - 1; i >= 0; i--) {
    const p = m.chispas[i];
    p.t += dt;
    if (p.t >= p.vida) { m.chispas.splice(i, 1); continue; }
    const fr = Math.exp(-2.4 * dt);
    p.vx *= fr; p.vy *= fr; p.vy += 60 * u * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.giro += dt * 4;
    ctx.globalAlpha = Math.pow(1 - p.t / p.vida, 1.3);
    ctx.fillStyle = color(p.k);
    if (p.hexa) hexa(ctx, p.x, p.y, p.tam, p.giro);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.tam * 0.8, 0, TAU); }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/* ---------- cada estado, en el tiempo ---------- */
const puntero: { x: number | null; y: number | null } = { x: null, y: null };
let escuchandoPuntero = false;
function escucharPuntero() {
  if (escuchandoPuntero) return;
  escuchandoPuntero = true;
  window.addEventListener('pointermove', (e) => { puntero.x = e.clientX; puntero.y = e.clientY; }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { puntero.x = null; });
}

function animar(inst: InstanciaIA, t: number, dt: number) {
  const m = inst.m, st = m.t, D = m.dirs;
  const lean = D.map(() => 0);
  if (puntero.x !== null && puntero.y !== null) {
    const dx = puntero.x - inst.cx, dy = puntero.y - inst.cy, dist = Math.hypot(dx, dy) || 1;
    const mira = Math.min(1, dist / (240 * inst.u));
    m.gx.t = (dx / dist) * mira * 7;
    m.gy.t = (dy / dist) * mira * 7;
    GEO.forEach((g, i) => {
      const ang = ((g.a + (g.g ? m.ag.v : m.ac.v)) * Math.PI) / 180;
      lean[i] = Math.pow(Math.max(0, (dx * Math.sin(ang) - dy * Math.cos(ang)) / dist), 3) * mira;
    });
  } else {
    m.gx.t = 0;
    m.gy.t = 0;
  }

  let s = 1, ab = 0, e = 0.12, aroO = 0, aroS = 1;
  const respira = Math.sin((TAU * t) / 4.8);
  const sen = m.senal;

  if (m.estado === 'reposo') {
    const h = ((t / 9) % 1) * 12;
    GEO.forEach((g, i) => {
      const d = D[i], dd = Math.min(Math.abs(g.k - h), 12 - Math.abs(g.k - h));
      d.ext.t = 1 + 0.018 * respira + lean[i] * 0.05;
      d.ns.t = 1 + 0.07 * Math.sin((TAU * t) / 4.8 - g.k * 0.52);
      d.lit += (1 + 0.55 * Math.exp((-dd * dd) / 2) - d.lit) * Math.min(1, dt * 4);
      d.pulso.p = -1;
    });
    s = 1 + 0.014 * respira;
  } else if (m.estado === 'escucha') {
    GEO.forEach((g, i) => {
      const d = D[i];
      d.ext.t = 0.93 + lean[i] * 0.13;
      d.ns.t = 1.15 + lean[i] * 0.35;
      d.lit += (0.55 + lean[i] * 0.9 + sen * 0.7 - d.lit) * Math.min(1, dt * 5);
      const fase = (t * 0.62 + g.fase) % 1, previa = d.pulso.p;
      d.pulso.p = 1 - fase;
      d.pulso.a = 0.85;
      if (previa >= 0 && previa < 0.08 && d.pulso.p > 0.9) m.s.w += 0.9;
    });
    s = 0.96;
    e = 0.2 + sen * 0.3;
    const c = (t * 0.8) % 1;
    aroS = 1.7 - 0.7 * c;
    aroO = 0.5 * Math.sin(Math.PI * c);
    if (Math.floor(st / 0.95) !== m.tick) { m.tick = Math.floor(st / 0.95); onda(m, 150, -100, 0.45, 1.2); }
  } else if (m.estado === 'piensa') {
    const n = Math.floor(st / 0.72);
    if (n !== m.tick) {
      m.tick = n;
      if (n > 0) {
        if (n % 2) m.ac.t -= 60; else m.ag.t += 60;
        m.rot.t += 60;
      }
    }
    const h = ((t / 1.4) % 1) * 12;
    GEO.forEach((g, i) => {
      const d = D[i], dd = Math.min(Math.abs(g.k - h), 12 - Math.abs(g.k - h));
      d.ext.t = 0.88;
      d.ns.t = 0.9;
      d.lit += (0.28 + 1.4 * Math.exp((-dd * dd) / 1.2) - d.lit) * Math.min(1, dt * 10);
      d.pulso.p = -1;
    });
    s = 0.92; e = 0.1; aroO = 0.6; aroS = 1.15;
    m.aroR -= dt * 40;
  } else if (m.estado === 'habla') {
    const sg = silabaEn(t), sc = silabaEn(t - 0.07);
    const voz = Math.max(sg.env, m.voz), vozC = Math.max(sc.env, m.voz * 0.8);
    if (sg.i !== m.silPrev && sg.i >= 0 && sg.a !== undefined) {
      const a = sg.a;
      if (a > 0.5) D.forEach((d) => { d.pulso.p = 0; d.pulso.a = 0.5 + a * 0.5; });
      if (a > 0.72) onda(m, 30, 150, 0.5, 1.3);
    }
    m.silPrev = sg.i;
    GEO.forEach((g, i) => {
      const d = D[i], env = g.g ? voz : vozC;
      d.ext.t = 1 + 0.14 * env + lean[i] * 0.05;
      d.ns.t = 1 + 0.4 * env;
      d.lit += (0.9 + 0.85 * env - d.lit) * Math.min(1, dt * 18);
      if (d.pulso.p >= 0) { d.pulso.p += dt / 0.38; if (d.pulso.p > 1) d.pulso.p = -1; }
    });
    s = 1 + 0.07 * voz; ab = 3.4 * voz; e = 0.2 + 0.7 * voz;
  } else if (m.estado === 'celebra') {
    if (st >= m.rafagaEn) {
      m.rafagaEn = st + 3.4;
      D.forEach((d) => { d.ext.w += 6.5; d.ns.w += 9; d.pulso.p = 0; d.pulso.a = 1; });
      m.rot.t += 120; m.s.w += 3.5; m.destello = 1;
      estallar(inst);
      onda(m, 30, 230, 0.8, 1.1);
      onda(m, 30, 150, 0.5, 1.5);
    }
    const baile = Math.sin(t * 7);
    GEO.forEach((g, i) => {
      const d = D[i];
      d.ext.t = 1 + 0.06 * (g.g ? baile : -baile) + lean[i] * 0.05;
      d.ns.t = 1.15 + 0.15 * Math.abs(baile);
      d.lit += (1.55 - d.lit) * Math.min(1, dt * 6);
      if (d.pulso.p >= 0) { d.pulso.p += dt / 0.5; if (d.pulso.p > 1) d.pulso.p = -1; }
    });
    s = 1.04; e = 0.8;
  }

  // nacimiento: el logo se arma desde el núcleo cada vez que aparece
  if (m.nacer < 1.4) {
    m.nacer += dt;
    GEO.forEach((g, i) => { if (m.nacer < 0.2 + g.k * 0.045) { D[i].ext.t = 0; D[i].ns.t = 0; D[i].lit = 0; } });
  }

  m.s.t = s;
  m.aroO += (aroO - m.aroO) * Math.min(1, dt * 8);
  m.aroS = aroS;
  if (m.estado !== 'piensa') m.aroR += (r60(m.aroR) - m.aroR) * Math.min(1, dt * 6);
  m.ab += (ab - m.ab) * Math.min(1, dt * 20);
  m.energia += (e - m.energia) * Math.min(1, dt * 6);
  m.destello = Math.max(0, m.destello - dt * 1.6);
  m.senal = Math.max(0, m.senal - dt * 2.5);
  m.voz = Math.max(0, m.voz - dt * 4);
  D.forEach((d) => { paso(d.ext, dt); paso(d.ns, dt); });
  [m.s, m.rot, m.gx, m.gy, m.ag, m.ac].forEach((x) => paso(x, dt));
}

function quieto(inst: InstanciaIA) {
  const m = inst.m, p = POSE[m.estado];
  m.dirs.forEach((d) => { d.ext.v = d.ext.t = p.ext; d.ns.v = d.ns.t = p.ns; d.lit = p.lit; d.pulso.p = -1; });
  m.s.v = m.s.t = p.s;
  m.gx.v = m.gy.v = 0;
  m.rot.v = m.rot.t = r60(m.rot.v);
  m.ag.v = m.ag.t = r60(m.ag.v);
  m.ac.v = m.ac.t = r60(m.ac.v);
  m.aroO = p.aroO; m.aroS = p.aroS; m.aroR = p.aroR; m.ab = 0;
  m.energia = p.e; m.destello = 0; m.ondas.length = 0; m.chispas.length = 0;
}

function pintar(inst: InstanciaIA) {
  const m = inst.m;
  const s = Math.max(0.1, Math.min(1.5, Number.isFinite(m.s.v) ? m.s.v : 1));
  const gx = Number.isFinite(m.gx.v) ? Math.max(-25, Math.min(25, m.gx.v)) : 0;
  const gy = Number.isFinite(m.gy.v) ? Math.max(-25, Math.min(25, m.gy.v)) : 0;
  const rot = Number.isFinite(m.rot.v) ? m.rot.v : 0;
  inst.gc.setAttribute('transform', `translate(${gx.toFixed(2)} ${gy.toFixed(2)}) rotate(${rot.toFixed(2)}) scale(${s.toFixed(3)})`);
  const ab = Number.isFinite(m.ab) ? Math.max(-15, Math.min(15, m.ab)) : 0;
  inst.hc.setAttribute('transform', `translate(${(-ab).toFixed(2)} 0)`);
  inst.hm.setAttribute('transform', `translate(${ab.toFixed(2)} 0)`);
  inst.aro.setAttribute('opacity', (Number.isFinite(m.aroO) ? Math.max(0, Math.min(1, m.aroO)) : 0).toFixed(3));
  const aroS = Math.max(0.1, Math.min(1.8, Number.isFinite(m.aroS) ? m.aroS : 1));
  const aroR = Number.isFinite(m.aroR) ? m.aroR : 0;
  inst.aro.setAttribute('transform', `rotate(${aroR.toFixed(2)}) scale(${aroS.toFixed(3)})`);
  GEO.forEach((g, i) => {
    const p = inst.partes[i], d = m.dirs[i];
    const tr = `rotate(${(g.a + (g.g ? m.ag.v : m.ac.v)).toFixed(2)})`;
    p.r.setAttribute('transform', tr);
    p.n.setAttribute('transform', tr);
    const ext = Math.max(0, Math.min(2.5, Number.isFinite(d.ext.v) ? d.ext.v : 1));
    const ini = g.r0 * Math.max(0.2, s);
    const fin = Math.max(ini + 2, g.r1 * ext);
    p.rayo.setAttribute('y', (-fin).toFixed(2));
    p.rayo.setAttribute('height', (fin - ini).toFixed(2));
    p.rayo.setAttribute('opacity', (Math.min(1, Math.max(0, d.lit / LUZ_MAX)) * Math.min(1, ext * 1.4)).toFixed(3));
    p.nodo.setAttribute('cy', (-g.d * ext).toFixed(2));
    p.nodo.setAttribute('r', (g.nr * Math.max(0, Math.min(2.5, Number.isFinite(d.ns.v) ? d.ns.v : 1))).toFixed(2));
    if (d.pulso.p >= 0 && d.pulso.p <= 1) {
      const rr = ini + d.pulso.p * (fin - ini);
      p.pulso.setAttribute('y', (-rr - 4.5).toFixed(2));
      p.pulso.setAttribute('opacity', (d.pulso.a * Math.sin(Math.PI * d.pulso.p)).toFixed(3));
    } else p.pulso.setAttribute('opacity', '0');
  });
}

let antes = 0;
let cuadroId = 0;
function cuadro(ahora: number) {
  const dt = Math.min(0.05, (ahora - antes) / 1000);
  antes = ahora;
  const t = ahora / 1000;
  const rm = reducido();
  instancias.forEach((inst) => {
    const vis = inst.ser.isConnected && inst.ser.getClientRects().length > 0;
    if (!vis) { inst.visible = false; return; }
    if (!inst.visible) { inst.visible = true; if (!rm) nacer(inst); }
    if (inst.hasta && ahora > inst.hasta) { inst.hasta = 0; ponerEstado(inst, inst.base); }
    colorear(inst);
    const r = inst.svg.getBoundingClientRect();
    inst.cx = r.left + r.width / 2;
    inst.cy = r.top + r.height / 2;
    inst.u = Math.min(1.4, Math.max(0.2, (r.width > 0 && r.width < 500 ? r.width : 72) / 208));
    inst.m.t += dt;
    if (rm) quieto(inst); else animar(inst, t, dt);
    pintar(inst);
    if (inst.lienzo) { medirLienzo(inst); pintarLuz(inst, dt); }
  });
  cuadroId = instancias.length ? requestAnimationFrame(cuadro) : 0;
}

/**
 * Monta el logo dentro de `ser` (su contenido se sustituye).
 * `grande` añade la luz ambiente en un canvas propio.
 */
export function crearLogo(ser: HTMLElement, opciones: { grande: boolean; celebraConTodos?: boolean }): InstanciaIA {
  asegurarSprite();
  if (!colores.length) leerColores();
  escucharPuntero();
  ser.textContent = '';
  let lienzo: HTMLCanvasElement | null = null;
  if (opciones.grande) {
    lienzo = document.createElement('canvas');
    lienzo.className = 'luz-ia';
    lienzo.setAttribute('aria-hidden', 'true');
    ser.appendChild(lienzo);
  }
  const svg = el('svg', { class: 'marca-ia', viewBox: '-104 -104 208 208', 'aria-hidden': 'true', focusable: 'false' }, ser);
  const raizG = el('g', {}, svg);
  const gr = el('g', { class: 'rayos' }, raizG);
  const gn = el('g', { class: 'nodos' }, raizG);
  const partes = GEO.map(() => {
    const r = el('g', {}, gr);
    const rayo = el('rect', { x: -2.8, width: 5.6, rx: 2.8 }, r);
    const pulso = el('rect', { class: 'pulso', x: -2.8, width: 5.6, height: 9, rx: 2.8, opacity: 0 }, r);
    const n = el('g', {}, gn);
    const nodo = el('circle', { class: 'nodo', cx: 0 }, n);
    return { r, rayo, pulso, n, nodo };
  });
  const gc = el('g', { class: 'nucleo-ia' }, raizG);
  const aro = el('polygon', { class: 'aro', points: HEX(31), opacity: 0 }, gc);
  const hc = el('polygon', { class: 'hex-c', points: HEX(23.41) }, gc);
  const hm = el('polygon', { class: 'hex-m', points: HEX(23.41) }, gc);
  el('polygon', { class: 'hex', points: HEX(23.41) }, gc);
  const inst: InstanciaIA = {
    ser, svg, partes, gc, aro, hc, hm, lienzo, ctx: lienzo && lienzo.getContext('2d'),
    m: modelo(), quien: null, off: 0, visible: false, base: 'reposo', hasta: 0, lado: 0, dpr: 1, cx: 0, cy: 0, u: 1,
    celebraConTodos: opciones.celebraConTodos !== false,
    alTocar: () => toque(inst),
  };
  ser.dataset.estado = 'reposo';
  ser.addEventListener('pointerdown', inst.alTocar);
  colorear(inst);
  instancias.push(inst);
  if (!cuadroId) {
    antes = performance.now();
    cuadroId = requestAnimationFrame(cuadro);
  }
  return inst;
}

export function destruirLogo(inst: InstanciaIA) {
  const i = instancias.indexOf(inst);
  if (i >= 0) instancias.splice(i, 1);
  clearTimeout(inst.fundido);
  inst.ser.removeEventListener('pointerdown', inst.alTocar);
  inst.ser.textContent = '';
  if (!instancias.length && cuadroId) {
    cancelAnimationFrame(cuadroId);
    cuadroId = 0;
  }
}

/** Pone el estado base: al terminar una celebración vuelve a este. */
export function estado(inst: InstanciaIA, nombre: EstadoIA) {
  inst.base = nombre;
  if (inst.hasta) return;
  ponerEstado(inst, nombre);
}

/** Celebra durante `ms` y vuelve a su estado base. */
export function celebrar(inst: InstanciaIA, ms = 2000) {
  ponerEstado(inst, 'celebra');
  inst.hasta = performance.now() + ms;
}

/** Celebran todos los logos montados, salvo los de las tarjetas de voz. */
export function celebrarTodos(ms = 2000) {
  instancias.filter((i) => i.celebraConTodos).forEach((i) => celebrar(i, ms));
}

/** Sacudida, como al pulsarlo. */
export function toque(inst: InstanciaIA) {
  if (reducido()) return;
  inst.m.dirs.forEach((d) => { d.ext.w += 2.6; d.ns.w += 4; });
  inst.m.s.w -= 1.6;
  onda(inst.m, 30, 200, 0.6, 1);
}

/** Le llega información: el núcleo late y dos nodos se encienden. */
export function senal(inst: InstanciaIA) {
  if (reducido()) return;
  inst.m.senal = 1;
  inst.m.s.w += 1.2;
  for (let n = 0; n < 2; n++) inst.m.dirs[Math.floor(Math.random() * 12)].ns.w += 6;
}

/** Una sílaba de voz real. */
export function silaba(inst: InstanciaIA) {
  inst.m.voz = 0.9;
}
