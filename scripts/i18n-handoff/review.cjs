// Revisión de las claves nuevas de es.json respecto a HEAD: marca las que probablemente no se traducen.
// Uso: node review.cjs [todo]   (sin argumentos: solo las sospechosas)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = 'I:/Docentos';
const head = JSON.parse(execSync('git show HEAD:src/i18n/locales/es.json', { cwd: ROOT, maxBuffer: 1 << 26 }).toString());
const now = JSON.parse(fs.readFileSync(`${ROOT}/src/i18n/locales/es.json`, 'utf8'));
const nw = Object.entries(now).filter(([k]) => !(k in head) && typeof now[k] === 'string');
const showAll = process.argv[2] === 'todo';
const suspicious = ([k, v]) =>
  !/\s/.test(v.trim()) || /^[A-Z0-9 .&@/_+%-]+$/.test(v) || /@|https?:|\.com|DocentOS|Giantucchi|\.js\b|\{\{[^}]*\}\}$/i.test(v) || v.length < 4;
const list = showAll ? nw : nw.filter(suspicious);
console.log(`claves nuevas: ${nw.length} | mostradas: ${list.length}`);
for (const [k, v] of list) console.log(`${k.slice(0, 46).padEnd(46)} | ${JSON.stringify(v).slice(0, 90)}`);
