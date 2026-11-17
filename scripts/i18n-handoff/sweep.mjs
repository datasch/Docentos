// Barrido de idiomas: recorre pantallas en cada idioma y lista el texto visible que sigue en español.
// Uso: node sweep.mjs [idiomas] [escenas] [correo:contraseña para escenas con sesión]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = 'http://localhost:3000';
const langs = (process.argv[2] || 'en,pt,fr,it').split(',');
const only = (process.argv[3] || '').split(',').filter(Boolean);
const [AUTH_EMAIL, AUTH_PASS] = (process.argv[4] || '').split(':');
const es = JSON.parse(fs.readFileSync('I:/Docentos/src/i18n/locales/es.json', 'utf8'));
const flatEntries = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flatEntries(v, p + k + '.') : [[p + k, String(v)]]));
const LOC = Object.fromEntries(['es', 'en', 'pt', 'fr', 'it'].map((l) => [l, Object.fromEntries(flatEntries(JSON.parse(fs.readFileSync(`I:/Docentos/src/i18n/locales/${l}.json`, 'utf8'))))]));
// texto en español -> claves que lo usan
const ES_TO_KEYS = new Map();
for (const [k, v] of Object.entries(LOC.es)) { const t = v.trim(); if (t.length > 3) { if (!ES_TO_KEYS.has(t)) ES_TO_KEYS.set(t, []); ES_TO_KEYS.get(t).push(k); } }
// Un texto visible es "español pendiente" si hay una clave con ese texto en español cuya traducción en este idioma es DISTINTA.
const isUntranslatedKnown = (bare, lang) => (ES_TO_KEYS.get(bare) || []).some((k) => LOC[lang][k] && LOC[lang][k].trim() && LOC[lang][k].trim() !== bare);
// Rasgos que solo tiene el español (las palabras compartidas con pt/fr/it —una, con, tu, para, curso— se excluyen a propósito).
const SPANISH_ONLY = {
  base: /(los|las|tus|está|están|puedes|aquí|también|más|esta|estos|nuestros|nuestras|lección|lecciones|clases|todos|todas|buscar|enviar|cerrar|guardar|contraseña|correo|iniciar|registrarse|cargando|gracias|hola)/i,
  del: /del/i,
  y: /\sy\s/i,
};
const SPANISH_CHARS = /[¿¡ñ]|ción|ciones/i;
const looksSpanish = (bare, lang) => {
  if (SPANISH_CHARS.test(bare)) return true;
  if (bare.split(' ').length < 2) return false;
  if (SPANISH_ONLY.base.test(bare)) return true;
  if (lang !== 'it' && SPANISH_ONLY.del.test(bare)) return true;
  if (lang !== 'fr' && SPANISH_ONLY.y.test(bare)) return true;
  return false;
};

const browser = await chromium.launch({ channel: 'msedge' });

async function visibleTexts(page) {
  return page.evaluate(() => {
    const out = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const visible = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    let n;
    while ((n = walker.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (t.length < 3 || /^[\d\s.,:%$€\-–—/·|•+()[\]{}#@x×]+$/.test(t)) continue;
      const el = n.parentElement;
      if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
      if (!visible(el)) continue;
      out.add(t);
    }
    // atributos que ve o lee la persona
    for (const el of document.querySelectorAll('[placeholder],[title],[aria-label],[alt]')) {
      if (!visible(el)) continue;
      for (const a of ['placeholder', 'title', 'aria-label', 'alt']) {
        const v = (el.getAttribute(a) || '').replace(/\s+/g, ' ').trim();
        if (v.length >= 3) out.add(`[${a}] ${v}`);
      }
    }
    return [...out];
  });
}

async function courseTexts(ctx) {
  // Contenido que escriben los autores (títulos, descripciones, lecciones): no se traduce.
  try {
    const r = await ctx.request.get(`${BASE}/api/courses`);
    const j = await r.json();
    const list = Array.isArray(j) ? j : j.courses || [];
    const s = new Set();
    const add = (v) => { if (typeof v === 'string' && v.trim()) s.add(v.trim()); };
    for (const c of list) { add(c.title); add(c.description); add(c.category); for (const m of c.modules || []) { add(m.title); add(m.description); for (const v of m.videos || []) { add(v.title); add(v.description); } } }
    return s;
  } catch { return new Set(); }
}

const goto = (path, wait = 3000) => async (page) => { await page.goto(BASE + path, { waitUntil: 'load' }); await page.waitForTimeout(wait); };
const clickTabs = (path) => async (page) => {
  // Recorre las pestañas del panel para que se pinten todas sus vistas.
  await page.goto(BASE + path, { waitUntil: 'load' }); await page.waitForTimeout(2500);
  const tabs = page.locator('main [role="tab"], main nav button');
  const n = Math.min(await tabs.count(), 14);
  for (let i = 0; i < n; i++) { await tabs.nth(i).click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(700); }
};
const authScenes = {
  aprendizaje: goto('/learning'),
  cursos: goto('/courses'),
  mentor: clickTabs('/mentor'),
  admin: clickTabs('/admin'),
  plugins: goto('/admin/plugins'),
};
const scenes = {
  async inicio(page) { await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(2500); },
  async 'inicio-movil'(page) { await page.setViewportSize({ width: 390, height: 844 }); await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(2500); },
  async catalogo(page) { await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(1500); await page.locator('nav').getByRole('button').nth(1).click().catch(() => {}); await page.waitForTimeout(1500); },
  async acceso(page) {
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(1500);
    await page.locator('header button, nav button').filter({ hasText: /Acceder|Sign in|Entrar|Entrer|Accedi|Connexion|Iniciar/i }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
  },
  async terminos(page) {
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(800);
    await page.locator('footer button').filter({ hasText: /rminos|Terms|Termos|Conditions|Termini/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
  },
};

const report = [];
for (const lang of langs) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, colorScheme: 'dark' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('giantucchi_lang', l); } catch {} }, lang);
  if (AUTH_EMAIL) {
    const r = await ctx.request.post(`${BASE}/api/auth/login`, { headers: { Origin: BASE }, data: { email: AUTH_EMAIL, password: AUTH_PASS } });
    console.log(`[${lang}] login ${AUTH_EMAIL}: ${r.status()}`);
  }
  const authored = await courseTexts(ctx);
  const allScenes = AUTH_EMAIL ? authScenes : scenes;
  for (const [name, run] of Object.entries(allScenes)) {
    if (only.length && !only.includes(name)) continue;
    const page = await ctx.newPage();
    try { await run(page); } catch (e) { console.log(`[${lang}/${name}] error de escena: ${String(e).slice(0, 100)}`); }
    const texts = await visibleTexts(page);
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    const leftovers = texts.filter((t) => {
      const bare = t.replace(/^\[[a-z-]+\]\s*/, '');
      if (authored.has(bare)) return false;
      if ([...authored].some((a) => a.includes(bare) || bare.includes(a))) return false;
      return isUntranslatedKnown(bare, lang) || looksSpanish(bare, lang);
    });
    const raw = texts.filter((t) => /\{\{|\[object Object\]|undefined|NaN/.test(t));
    report.push({ lang, name, total: texts.length, leftovers, raw, htmlLang });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
for (const r of report) {
  console.log(`\n=== ${r.lang} / ${r.name} (html lang=${r.htmlLang}): ${r.total} textos, ${r.leftovers.length} en español, ${r.raw.length} con marcadores sin resolver`);
  r.leftovers.slice(0, 40).forEach((t) => console.log('   ES:', t.slice(0, 110)));
  r.raw.slice(0, 10).forEach((t) => console.log('  RAW:', t.slice(0, 110)));
}
const totalLeft = report.reduce((n, r) => n + r.leftovers.length, 0);
console.log(`\nTOTAL en español: ${totalLeft} | marcadores sin resolver: ${report.reduce((n, r) => n + r.raw.length, 0)}`);
