/**
 * Indicador de carga del reproductor (morphing-infinity de loading-ui).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MorphingInfinity } from '../src/components/loading/MorphingInfinity.js';

test('MorphingInfinity se anuncia como estado de carga en español', () => {
  const html = renderToStaticMarkup(<MorphingInfinity label="Cargando video" className="h-14 w-14" />);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-label="Cargando video"/);
  assert.match(html, /class="h-14 w-14"/);
  assert.match(html, /<path/);
});

test('MorphingInfinity usa «Cargando» por defecto', () => {
  const html = renderToStaticMarkup(<MorphingInfinity />);
  assert.match(html, /aria-label="Cargando"/);
});
