// Compara el texto por defecto que lleva t('clave', 'Texto') en el código con el de es.json.
// Si difieren, la persona ve el de es.json (el del código solo se usa si falta la clave).
const ts = require('I:/Docentos/node_modules/typescript');
const fs = require('fs');
const path = require('path');
const ROOT = 'I:/Docentos';
const es = JSON.parse(fs.readFileSync(`${ROOT}/src/i18n/locales/es.json`, 'utf8'));
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
const ES = Object.fromEntries(flat(es));

function files(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'i18n', 'generated', 'dist'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, out);
    else if (/\.(tsx?|mts)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
const strOf = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);
const found = [];
for (const file of files(`${ROOT}/src`)) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText();
      if (/(^|\.)t$/.test(callee) && node.arguments.length) {
        const key = strOf(node.arguments[0]);
        let def = strOf(node.arguments[1]);
        if (def === null && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])) {
          for (const p of node.arguments[1].properties) if (ts.isPropertyAssignment(p) && p.name.getText() === 'defaultValue') def = strOf(p.initializer);
        }
        if (key && def !== null) found.push({ key, def, file: path.relative(ROOT, file).replace(/\\/g, '/'), line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
const drift = found.filter((f) => f.key in ES && ES[f.key] !== f.def);
const seen = new Set();
const uniq = drift.filter((d) => { const k = d.key + '|' + d.def; if (seen.has(k)) return false; seen.add(k); return true; });
console.log(`llamadas con texto por defecto: ${found.length} | claves que difieren de es.json: ${uniq.length}`);
if (process.argv[2] === 'json') fs.writeFileSync(process.argv[3], JSON.stringify(uniq, null, 1));
else for (const d of uniq) console.log(`${d.key.slice(0, 38).padEnd(38)} | json: ${JSON.stringify(ES[d.key]).slice(0, 44).padEnd(44)} | código: ${JSON.stringify(d.def).slice(0, 56)}  (${d.file}:${d.line})`);
