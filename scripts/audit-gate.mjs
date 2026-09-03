/**
 * Informe y control de vulnerabilidades de dependencias.
 *
 * `npm audit` tarda más de dos minutos porque consulta el registro. La CI lo
 * ejecutaba dos veces —una para bloquear ante severidad crítica y otra para
 * imprimir el listado completo—, así que esta comprobación se hace ahora sobre
 * un único informe: se imprime entero y solo se falla si hay algo crítico.
 *
 * Uso: node scripts/audit-gate.mjs <informe.json>
 */

import { readFile } from 'node:fs/promises';

const SEVERITIES = ['critical', 'high', 'moderate', 'low', 'info'];

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('Indica la ruta del informe de npm audit.');
  process.exit(2);
}

let report;
try {
  report = JSON.parse(await readFile(reportPath, 'utf8'));
} catch (error) {
  // Un informe ilegible no puede interpretarse como ausencia de problemas.
  console.error(`No se pudo leer el informe de auditoría (${reportPath}): ${error.message}`);
  process.exit(2);
}

// npm escribe un JSON de error —sin recuento alguno— cuando no logra consultar
// el registro, y el `|| true` del workflow oculta su código de salida. Sin esta
// comprobación, una auditoría que nunca llegó a ejecutarse se interpretaba como
// una auditoría sin hallazgos y daba vía libre a la publicación.
const counts = report.metadata?.vulnerabilities;
if (!counts || typeof counts !== 'object') {
  const reason = report.message || report.error?.summary || 'el informe no contiene ningún recuento';
  console.error(`La auditoría de dependencias no llegó a completarse: ${reason}`);
  process.exit(2);
}

const summary = SEVERITIES.map((level) => `${level}: ${counts[level] ?? 0}`).join(' · ');
console.log(`Vulnerabilidades detectadas → ${summary}`);

const advisories = Object.values(report.vulnerabilities ?? {});
if (advisories.length > 0) {
  console.log('');
  for (const advisory of advisories.sort((a, b) => a.name.localeCompare(b.name))) {
    const via = (advisory.via ?? [])
      .map((entry) => (typeof entry === 'string' ? entry : entry.title))
      .filter(Boolean);
    console.log(`- [${advisory.severity}] ${advisory.name} ${advisory.range ?? ''}`);
    for (const title of new Set(via)) console.log(`    ${title}`);
    if (advisory.fixAvailable) console.log('    corrección disponible');
  }
}

const critical = counts.critical ?? 0;
if (critical > 0) {
  console.error(`\nHay ${critical} vulnerabilidad(es) de severidad crítica; la compilación se detiene.`);
  process.exit(1);
}

console.log('\nSin vulnerabilidades críticas.');
