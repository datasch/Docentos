import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Course, CertificateRecord, User } from '../src/types';
import { learningCourses, courseLearningProgress, nextLearningCourse } from '../src/lib/myLearning';
import { searchCourseCatalog } from '../src/lib/catalogSearch';
import { TAB_PATHS, tabFromPath } from '../src/lib/appRoutes';
import { ConstellationMyLearning } from '../src/experiences/constellation/ConstellationMyLearning';
import { ConstellationNavbar } from '../src/experiences/constellation/ConstellationNavbar';

function course(id: string, overrides: Partial<Course> = {}): Course {
  return { id, title: `Curso ${id}`, description: '', published: true, category: 'Ciberseguridad', price: 10, coverImage: '', hasAccess: true,
    modules: [{ id: `m-${id}`, title: 'Fundamentos', videos: [{ id: `v-${id}`, title: 'Análisis de incidentes', description: 'Revisión de alertas' }] }], resources: [], ...overrides } as Course;
}
const certificate = (overrides: Partial<CertificateRecord> = {}) => ({ id: 'cert', courseId: 'a', verificationCode: 'TEST', issuedAt: '2026-11-07', ...overrides }) as CertificateRecord;

test('Mi aprendizaje espera la sesión y la verificación; nunca concede acceso por ausencia de datos', () => {
  const courses = [course('a'), course('locked', { hasAccess: false }), course('unknown', { hasAccess: undefined }), course('draft', { published: false })];
  assert.deepEqual(learningCourses(courses, false, true), []);
  assert.deepEqual(learningCourses(courses, true, false), []);
  assert.deepEqual(learningCourses(courses, true, true).map(item => item.id), ['a']);
});

test('El progreso cuenta únicamente las lecciones del curso y no inventa porcentajes sin contenido', () => {
  const a = course('a');
  assert.equal(courseLearningProgress(a, { 'v-b': true }, []).percent, 0);
  assert.equal(courseLearningProgress(a, { 'v-a': true, 'v-b': true }, []).percent, 100);
  assert.equal(courseLearningProgress(course('empty', { modules: [] }), {}, []).percent, null);
  assert.equal(courseLearningProgress(a, {}, [certificate({ revokedAt: '2026-11-07' })]).certificate, undefined);
  assert.equal(courseLearningProgress(a, {}, [certificate()]).certificate?.id, 'cert');
});

test('Continuar prioriza el último curso disponible y descarta cursos bloqueados o certificados válidos', () => {
  const courses = [course('a'), course('b'), course('blocked', { hasAccess: false })];
  assert.equal(nextLearningCourse(courses, {}, [], 'b')?.id, 'b');
  assert.equal(nextLearningCourse(courses, {}, [], 'blocked')?.id, 'a');
  assert.equal(nextLearningCourse(courses, { 'v-a': true }, [certificate()], 'a')?.id, 'b');
  assert.equal(nextLearningCourse([course('a')], { 'v-a': true }, [])?.id, 'a', 'Las lecciones vistas no sustituyen la validación del certificado');
});

test('El catálogo encuentra lecciones sin acentos y respeta la categoría elegida', () => {
  const courses = [course('a'), course('b', { category: 'Desarrollo Web' })];
  const found = searchCourseCatalog(courses, 'analisis', 'Ciberseguridad');
  assert.deepEqual(found.courses.map(item => item.id), ['a']);
  assert.deepEqual(found.lessons.map(item => item.video.id), ['v-a']);
  assert.equal(searchCourseCatalog(courses, 'sin coincidencias', 'todos').courses.length, 0);
  assert.equal(searchCourseCatalog(courses, '', 'todos').lessons.length, 0);
});

test('Las rutas conservan el catálogo y permiten recargar Mi aprendizaje', () => {
  assert.equal(TAB_PATHS.learning, '/learning');
  assert.equal(tabFromPath('/learning'), 'learning');
  assert.equal(tabFromPath('/search'), 'courses');
  assert.equal(tabFromPath('/courses/abc'), 'courses');
  assert.equal(tabFromPath('/admin/plugins'), 'plugins');
});

test('Sin sesión o sin acceso verificado no se muestran cursos personales', () => {
  const props = { courses: [course('privado')], onContinue() {}, onBrowse() {}, onLogin() {} };
  const guest = renderToStaticMarkup(<ConstellationMyLearning {...props} user={null} accessReady />);
  assert.match(guest, /Iniciar sesión/);
  assert.doesNotMatch(guest, /Curso privado/);
  const pending = renderToStaticMarkup(<ConstellationMyLearning {...props} user={{ id: 'user' } as User} accessReady={false} />);
  assert.match(pending, /Cargando tu aprendizaje/);
  assert.doesNotMatch(pending, /Curso privado/);
});

test('La navegación ofrece una sola barra con Inicio, Catálogo y Mi aprendizaje', () => {
  const html = renderToStaticMarkup(<ConstellationNavbar currentUser={null} courses={[]} activeCourse={course('a')} activeTab="learning" onSelectTab={() => {}} onOpenAuth={() => {}} onLogout={() => {}} />);
  assert.equal((html.match(/<nav\b/g) || []).length, 1);
  assert.match(html, /Inicio/);
  assert.match(html, /Catálogo/);
  assert.match(html, /Mi aprendizaje/);
  assert.doesNotMatch(html, /Búsqueda|En Curso/);
});

test('Los certificados obtenidos ofrecen vista y descarga, sin incluir los revocados', async () => {
  const { LearningCertificates } = await import('../src/experiences/constellation/LearningCertificates');
  const html = renderToStaticMarkup(<LearningCertificates studentName="Carlos Mendoza" certificates={[
    certificate({ courseTitle: 'Seguridad aplicada' }),
    certificate({ id: 'revoked', courseTitle: 'Certificado revocado', revokedAt: '2026-11-07' }),
  ]} />);
  assert.match(html, /Seguridad aplicada/);
  assert.match(html, /Ver certificado/);
  assert.match(html, /Descargar/);
  assert.doesNotMatch(html, /Certificado revocado/);
});

test('La descarga conserva la identidad, el código y la fecha original del certificado', async () => {
  const { prepareCertificateData } = await import('../src/experiences/constellation/CertificatePreviewModal');
  const data = await prepareCertificateData({ studentName: 'Carlos Mendoza', courseTitle: 'Seguridad aplicada', verificationCode: 'DOC-ORIGINAL', issuedAt: '2024-05-10T12:00:00Z' });
  assert.equal(data.studentName, 'Carlos Mendoza');
  assert.equal(data.certificateId, 'DOC-ORIGINAL');
  assert.equal(data.dateStr, '10 de mayo de 2024');
});
