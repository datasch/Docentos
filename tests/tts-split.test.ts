import test from 'node:test';
import assert from 'node:assert/strict';
import { ttsService } from '../src/lib/ttsService.js';

const split = (text: string, max?: number) => (ttsService as any).splitText(text, max) as { text: string; offset: number }[];

test('ttsService.splitText: conserva todo el texto y los desplazamientos', () => {
  const text = '¡Hola! Bienvenido a la lección. En esta clase exploraremos las claves. Revisa los recursos y deja tus dudas al finalizar.';
  const chunks = split(text, 40);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.map((c) => c.text).join(''), text);
  for (const chunk of chunks) assert.equal(text.slice(chunk.offset, chunk.offset + chunk.text.length), chunk.text);
});

test('ttsService.splitText: un texto corto es un solo fragmento', () => {
  assert.equal(split('Hola mundo').length, 1);
  assert.equal(split('   ').length, 0);
});
