import { readFile } from 'node:fs/promises';

const packageMetadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const versionSource = await readFile(new URL('../src/version.ts', import.meta.url), 'utf8');
const sourceVersion = versionSource.match(/DOCENTOS_VERSION\s*=\s*'([^']+)'/)?.[1];

if (!sourceVersion) {
  throw new Error('No se pudo localizar DOCENTOS_VERSION en src/version.ts.');
}

if (packageMetadata.version !== sourceVersion) {
  throw new Error(
    'Versiones inconsistentes: package.json=' + packageMetadata.version + ', src/version.ts=' + sourceVersion,
  );
}

console.log('Version consistente: ' + sourceVersion);
