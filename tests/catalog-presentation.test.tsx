import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConstellationCourseCatalog } from '../src/experiences/constellation/ConstellationCourseCatalog.js';
import { ConstellationFooter } from '../src/experiences/constellation/ConstellationFooter.js';
import type { Course } from '../src/types.js';

const courses = [
  { id: 'seguridad', title: 'Ciberseguridad defensiva', category: 'Ciberseguridad' },
  { id: 'negocios', title: 'Gestión de negocios', category: 'Negocios' },
].map((course) => ({ ...course, published: true, price: 20, modules: [], resources: [] }) as Course);

const renderCatalog = (items: Course[]) => renderToStaticMarkup(
  <ConstellationCourseCatalog courses={items} onSelectCourse={() => {}} />,
);

test('El destacado aparece una sola vez y los demás cursos siguen disponibles', () => {
  const html = renderCatalog(courses);
  const headings = [...html.matchAll(/<h3\b[^>]*>(.*?)<\/h3>/g)].map((match) => match[1]);
  assert.deepEqual(headings, courses.map((course) => course.title));
  assert.match(html, /Programa destacado/);
  assert.ok(html.indexOf('Programa destacado') < html.indexOf('aria-label="Buscar cursos"'));
  for (const course of courses) assert.ok(html.includes(`Compartir curso: ${course.title}`));
});

test('Un catálogo con un solo destacado no muestra un mensaje de ausencia de cursos', () => {
  const html = renderCatalog(courses.slice(0, 1));
  assert.equal((html.match(/<h3\b/g) || []).length, 1);
  assert.doesNotMatch(html, /No se encontraron cursos/);
  assert.match(renderCatalog([]), /No se encontraron cursos/);
});

test('Las tarjetas sin precio omiten etiquetas de acceso y conservan la opción de compartir', () => {
  for (const hasAccess of [true, false, undefined]) {
    const html = renderCatalog([courses[0], { ...courses[1], price: 0, hasAccess }]);
    assert.doesNotMatch(html, /Acceso disponible|Ver opciones de acceso|ACCESO LIBRE|Acceso libre/);
    assert.doesNotMatch(html, /catalog-course-badge/);
    assert.match(html, /aria-label="Compartir curso: Gestión de negocios"/);
  }
});

test('El precio conserva la moneda configurada, aunque el curso esté autorizado', () => {
  const html = renderCatalog([courses[0], { ...courses[1], price: 49, currency: 'PEN', hasAccess: true }]);
  const text = html.replace(/<[^>]*>/g, ' ');
  assert.match(text, /49\s+PEN/);
  assert.doesNotMatch(html, /49 USD|Acceso libre/);
});

test('El footer ofrece volver arriba y conserva los enlaces sin repetir el acceso legal', () => {
  const html = renderToStaticMarkup(<ConstellationFooter />);
  assert.match(html, /aria-label="Volver arriba"/);
  assert.match(html, /GitHub/);
  assert.match(html, /Términos y privacidad/);
  assert.doesNotMatch(html, /Catálogo|Términos de Servicio &amp; Custodia/);
});
