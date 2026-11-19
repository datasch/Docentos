import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const LOCALES_DIR = path.resolve('src/i18n/locales');
const TARGET_LANGS = ['en', 'pt', 'fr', 'it'] as const;

function loadJson(filepath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function extractKeyPaths(obj: Record<string, any>, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = extractKeyPaths(value, fullPath);
      for (const [k, v] of nested.entries()) {
        result.set(k, v);
      }
    } else if (typeof value === 'string') {
      result.set(fullPath, value);
    }
  }
  return result;
}

function extractInterpolationParams(text: string): string[] {
  const matches = text.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))].sort();
}

test('i18n: los 5 archivos de idiomas existen y son JSON válidos', () => {
  for (const lang of ['es', ...TARGET_LANGS]) {
    const file = path.join(LOCALES_DIR, `${lang}.json`);
    assert.ok(fs.existsSync(file), `Archivo de idioma faltante: ${lang}.json`);
    const data = loadJson(file);
    assert.ok(typeof data === 'object' && data !== null);
  }
});

test('i18n: paridad del 100% de claves entre es.json y los demás idiomas', () => {
  const esData = loadJson(path.join(LOCALES_DIR, 'es.json'));
  const esKeys = extractKeyPaths(esData);

  for (const lang of TARGET_LANGS) {
    const langData = loadJson(path.join(LOCALES_DIR, `${lang}.json`));
    const langKeys = extractKeyPaths(langData);

    const missingKeys: string[] = [];
    for (const key of esKeys.keys()) {
      // Excepción conocida de i18next: plurales en inglés no usan _many
      if (lang === 'en' && key.endsWith('_many')) {
        continue;
      }
      if (!langKeys.has(key)) {
        missingKeys.push(key);
      }
    }

    assert.equal(
      missingKeys.length,
      0,
      `Idioma ${lang} tiene ${missingKeys.length} claves faltantes respecto a es.json:\n${missingKeys.slice(0, 10).join('\n')}`,
    );
  }
});

test('i18n: ninguna clave contiene un string vacío', () => {
  for (const lang of ['es', ...TARGET_LANGS]) {
    const data = loadJson(path.join(LOCALES_DIR, `${lang}.json`));
    const keys = extractKeyPaths(data);
    const emptyKeys: string[] = [];

    for (const [key, value] of keys.entries()) {
      if (!value.trim()) {
        emptyKeys.push(key);
      }
    }

    assert.equal(
      emptyKeys.length,
      0,
      `Idioma ${lang} tiene ${emptyKeys.length} claves vacías: ${emptyKeys.slice(0, 5).join(', ')}`,
    );
  }
});

test('i18n: coherencia de parámetros {{param}} entre es.json y las traducciones', () => {
  const esData = loadJson(path.join(LOCALES_DIR, 'es.json'));
  const esKeys = extractKeyPaths(esData);

  for (const lang of TARGET_LANGS) {
    const langData = loadJson(path.join(LOCALES_DIR, `${lang}.json`));
    const langKeys = extractKeyPaths(langData);
    const mismatchedParams: string[] = [];

    for (const [key, esText] of esKeys.entries()) {
      if (lang === 'en' && key.endsWith('_many')) continue;
      const targetText = langKeys.get(key);
      if (!targetText) continue;

      const esParams = extractInterpolationParams(esText);
      const targetParams = extractInterpolationParams(targetText);

      // Verificamos que contenga exactamente los mismos parámetros de interpolación
      if (JSON.stringify(esParams) !== JSON.stringify(targetParams)) {
        mismatchedParams.push(`${key}: es=${JSON.stringify(esParams)} vs ${lang}=${JSON.stringify(targetParams)}`);
      }
    }

    assert.equal(
      mismatchedParams.length,
      0,
      `Idioma ${lang} tiene parámetros de interpolación inconsistentes:\n${mismatchedParams.slice(0, 5).join('\n')}`,
    );
  }
});

test('ninguna clave usada en el código coincide con una sección del JSON', () => {
  // t('mentor', ...) cuando "mentor" es una sección devuelve un objeto y la pantalla muestra
  // "key 'mentor (es)' returned an object instead of string". Hay que usar otra clave.
  const sections = new Set(
    Object.entries(loadJson(path.join(LOCALES_DIR, 'es.json')))
      .filter(([, value]) => value && typeof value === 'object')
      .map(([key]) => key),
  );
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        const source = fs.readFileSync(full, 'utf8');
        for (const match of source.matchAll(/\bt\(\s*['"`]([A-Za-z0-9_]+)['"`]/g)) {
          if (sections.has(match[1])) offenders.push(`${full}: t('${match[1]}')`);
        }
      }
    }
  };
  walk('src');
  assert.deepEqual(offenders, []);
});
