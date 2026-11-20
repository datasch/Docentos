import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CourseCategoryFilter } from '../src/components/CourseCategoryFilter.js';


import './helpers/initI18n.js';
test('el filtro omite la categoría seleccionada de las alternativas y permite volver a Todos', () => {
  const html = renderToStaticMarkup(
    <CourseCategoryFilter id="category" value="Cloud & DevOps" onChange={() => {}}
      courses={[{ category: 'cloud' }, { category: 'devops' }, { category: 'Ciberseguridad' }]} />
  );
  const options = html.slice(html.indexOf('role="group"'), html.indexOf('</details>'));
  assert.doesNotMatch(options, /Cloud &amp; DevOps/);
  assert.match(options, /<span>Todos<\/span>/);
  // La categoría activa se lee en el propio menú, con su nombre delante.
  assert.match(html, /<summary[^>]*aria-label="Filtrar por categoría: Cloud &amp; DevOps"/);
  assert.match(html, /course-category-filter__label"><span class="text-ink-muted">Categoría: <\/span>Cloud &amp; DevOps/);
  assert.match(html, /Todos<\/span><span class="course-category-filter__count">3<\/span>/);
});

test('Todos no se repite entre las alternativas cuando ya está seleccionado', () => {
  const html = renderToStaticMarkup(
    <CourseCategoryFilter id="category" value="todos" onChange={() => {}} courses={[]} />
  );
  assert.doesNotMatch(html.slice(html.indexOf('role="group"'), html.indexOf('</details>')), /<span>Todos<\/span>/);
  assert.doesNotMatch(html, /Ciberseguridad/);
});
