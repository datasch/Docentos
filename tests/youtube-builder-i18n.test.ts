import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
(globalThis as any).localStorage ??= { getItem: () => null, setItem: () => {} };
const { default: i18n } = await import('../src/i18n/index.js');

const LANGS = ['es', 'en', 'pt', 'fr', 'it'];
// Los idiomas se descargan al pedirlos; el test espera a tener los cinco antes de comparar.
await i18n.loadLanguages(LANGS);
const keysOf = (lang: string) => Object.keys(i18n.getResourceBundle(lang, 'translation').youtubeBuilder ?? {}).sort();

test('youtubeBuilder has the same keys in every language', () => {
  const base = keysOf('es');
  assert.ok(base.length > 100);
  for (const lang of LANGS) assert.deepEqual(keysOf(lang), base, lang);
});

test('every key used by YouTubeCourseBuilder exists (plural forms included)', () => {
  const src = readFileSync(new URL('../src/components/YouTubeCourseBuilder.tsx', import.meta.url), 'utf8');
  const used = [...src.matchAll(/t\('youtubeBuilder\.([A-Za-z0-9]+)'/g)].map((m) => m[1]);
  const have = new Set(keysOf('es'));
  for (const k of used) assert.ok(have.has(k) || have.has(`${k}_other`), k);
});
