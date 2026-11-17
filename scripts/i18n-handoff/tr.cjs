// Herramienta de apoyo para traducir por lotes (claves planas y anidadas).
//   node tr.cjs pending [n] [offset]   -> JSON {clave: textoEnEspañol} de las claves con hueco vacío en algún idioma
//   node tr.cjs apply archivo.json      -> aplica {clave: {en, pt, fr, it}} validando {{parámetros}} y <etiquetas>
//   node tr.cjs add archivo.json        -> inserta {"seccion.clave": "Texto es"}: es con texto, los demás con hueco ''
//   node tr.cjs drop clave1 clave2 ...  -> borra claves (planas o con puntos) de los 5 idiomas
const fs = require('fs');
const ROOT = 'I:/Docentos/src/i18n/locales';
const LANGS = ['en', 'pt', 'fr', 'it'];
const load = (l) => JSON.parse(fs.readFileSync(`${ROOT}/${l}.json`, 'utf8'));
const save = (l, o) => fs.writeFileSync(`${ROOT}/${l}.json`, JSON.stringify(o, null, 2) + '\n', 'utf8');
function flatten(o, p = '', out = {}) {
  for (const [k, v] of Object.entries(o)) { if (v && typeof v === 'object') flatten(v, p + k + '.', out); else out[p + k] = v; }
  return out;
}
// Escribe en una ruta existente. Con create=true crea las secciones intermedias.
function setPath(o, path, val, create = false) {
  const parts = path.split('.'); let cur = o;
  for (const p of parts.slice(0, -1)) {
    if (typeof cur[p] !== 'object' || cur[p] === null) { if (!create) return false; cur[p] = {}; }
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = val; return true;
}
function delPath(o, path) {
  const parts = path.split('.'); let cur = o;
  for (const p of parts.slice(0, -1)) { if (!cur || typeof cur[p] !== 'object') return; cur = cur[p]; }
  delete cur[parts[parts.length - 1]];
}
const tokens = (t) => (String(t).match(/\{\{[^}]+\}\}|<\/?\d+\/?>|<\/?[a-z]+>/gi) || []).map((x) => x.replace(/\s/g, '')).sort().join('|');

const [cmd, ...rest] = process.argv.slice(2);
const esNested = load('es');
const es = flatten(esNested);

if (cmd === 'pending') {
  const n = Number(rest[0] || 120), off = Number(rest[1] || 0);
  const flat = Object.fromEntries(LANGS.map((l) => [l, flatten(load(l))]));
  const keys = Object.keys(es).filter((k) => typeof es[k] === 'string' && es[k] !== '' && LANGS.some((l) => flat[l][k] === ''));
  console.error(`pendientes: ${keys.length} (mostrando ${off}..${Math.min(off + n, keys.length)})`);
  console.log(JSON.stringify(Object.fromEntries(keys.slice(off, off + n).map((k) => [k, es[k]])), null, 1));
} else if (cmd === 'apply') {
  const incoming = JSON.parse(fs.readFileSync(rest[0], 'utf8'));
  const nested = Object.fromEntries(LANGS.map((l) => [l, load(l)]));
  const flat = Object.fromEntries(LANGS.map((l) => [l, flatten(nested[l])]));
  let applied = 0; const problems = [];
  for (const [k, tr] of Object.entries(incoming)) {
    if (!(k in es)) { problems.push(`${k}: no existe en es.json`); continue; }
    for (const l of LANGS) {
      if (!(k in flat[l])) continue; // ese idioma no usa esta forma plural
      const v = tr[l];
      if (typeof v !== 'string' || !v.trim()) { problems.push(`${k}[${l}]: vacío`); continue; }
      if (tokens(v) !== tokens(es[k])) problems.push(`${k}[${l}]: parámetros/etiquetas distintos -> es "${tokens(es[k])}" vs "${tokens(v)}"`);
      if (!setPath(nested[l], k, v)) problems.push(`${k}[${l}]: ruta no encontrada`); else applied++;
    }
  }
  for (const l of LANGS) save(l, nested[l]);
  console.log(`aplicadas ${applied} traducciones; avisos: ${problems.length}`);
  problems.slice(0, 40).forEach((p) => console.log(' -', p));
} else if (cmd === 'add') {
  const incoming = JSON.parse(fs.readFileSync(rest[0], 'utf8'));
  for (const l of ['es', ...LANGS]) {
    const o = load(l); const f = flatten(o);
    for (const [path, text] of Object.entries(incoming)) { if (l === 'en' && /_many$/.test(path)) continue; if (!(path in f)) setPath(o, path, l === 'es' ? text : '', true); }
    save(l, o);
  }
  console.log('añadidas', Object.keys(incoming).length, 'claves');
} else if (cmd === 'set') {
  // set archivo.json con {"clave": "Nuevo texto es"} -> actualiza es y deja huecos '' en los demás para retraducir
  const incoming = JSON.parse(fs.readFileSync(rest[0], 'utf8'));
  for (const l of ['es', ...LANGS]) {
    const o = load(l);
    for (const [path, text] of Object.entries(incoming)) setPath(o, path, l === 'es' ? text : '', true);
    save(l, o);
  }
  console.log('actualizadas', Object.keys(incoming).length, 'claves');
} else if (cmd === 'drop') {
  for (const l of ['es', ...LANGS]) { const o = load(l); rest.forEach((k) => delPath(o, k)); save(l, o); }
  console.log('borradas:', rest.join(', '));
}
