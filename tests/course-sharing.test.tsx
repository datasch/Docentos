import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { coursePath, courseIdFromPath, courseShareUrl } from '../src/lib/courseSharing.js';
import { CourseOverview } from '../src/components/CourseOverview.js';
import { CourseShareButton } from '../src/components/CourseShareButton.js';
import { renderSeoCourseHtml } from '../server/seo.js';
import type { Course, User } from '../src/types.js';

const course = { id: 'curso-ciberseguridad', title: 'Ciberseguridad Defensiva', description: 'Protege tus sistemas.', published: true, price: 25, currency: 'USD', modules: [], resources: [], hasAccess: false, coverImage: '/logo.avif' } as Course;
const noop = () => {};
const page = (overrides: Partial<React.ComponentProps<typeof CourseOverview>> = {}) => renderToStaticMarkup(<CourseOverview course={course} ready user={null} onBack={noop} onRegister={noop} onLogin={noop} onPurchase={noop} onContinue={noop} {...overrides} />);

test('Los enlaces compartidos llevan al curso sin parámetros de sesión', () => {
  const id = 'curso con ñ y ? &';
  const path = coursePath(id);
  assert.equal(courseIdFromPath(path), id);
  const url = new URL(courseShareUrl('https://academia.example/courses?session_id=privado#token', id));
  assert.equal(url.origin, 'https://academia.example');assert.equal(url.search, '');assert.equal(url.hash, '');
  assert.equal(courseIdFromPath('/courses'), null);assert.equal(courseIdFromPath('/courses/%broken'), null);
  assert.equal(courseIdFromPath('/admin'), null);assert.equal(courseIdFromPath('/courses/a/lesson'), null);
});
test('La presentación pública permite registrarse sin prometer acceso a las clases', () => {
  const html = page();
  assert.match(html, /Ciberseguridad Defensiva/);assert.match(html, /Crear cuenta para continuar/);
  assert.match(html, /Inicia sesión/);assert.match(html, /Compartir curso/);
  assert.doesNotMatch(html, /<iframe|<video|Continuar aprendiendo/);
});
test('Una cuenta sin acceso recibe opciones de acceso; una autorizada puede continuar', () => {
  const user = { id: 'u', role: 'EXTERNAL' } as User;
  assert.match(page({ user }), /Ver opciones de acceso/);
  assert.match(page({ user, course: { ...course, hasAccess: true } }), /Continuar aprendiendo/);
  const unverified = page({ user, course: { ...course, hasAccess: true }, ready: false });
  assert.match(unverified, /disabled=""/);assert.doesNotMatch(unverified, /Continuar aprendiendo/);
});
test('Un curso no publicado no muestra presentación ni opción de compartir', () => {
  const draft = { ...course, published: false };
  assert.match(page({ course: draft }), /Este curso no está disponible/);
  assert.doesNotMatch(page({ course: draft }), /Ciberseguridad Defensiva/);
  assert.equal(renderToStaticMarkup(<CourseShareButton course={draft} />), '');
});
test('Compartir con solo icono conserva el nombre accesible del curso', () => {
  const html = renderToStaticMarkup(<CourseShareButton course={course} iconOnly variant="overlay" />);
  assert.match(html, /aria-label="Compartir curso: Ciberseguridad Defensiva"/);
  assert.match(html, /<span class="sr-only">Compartir curso<\/span>/);
  assert.match(html, /aria-haspopup="dialog"/);
});
test('La vista previa social escapa contenido y omite imágenes inseguras', () => {
  const html = renderSeoCourseHtml({ ...course, title: 'Curso "<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>', coverImage: 'javascript:alert(1)' }, 'https://academia.example');
  assert.match(html, /og:title/);assert.match(html, /og:url/);
  assert.doesNotMatch(html, /<script>|<img src=x|javascript:/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotThrow(() => renderSeoCourseHtml({ ...course, coverImage: 'http://[' }, 'https://academia.example'));
});
