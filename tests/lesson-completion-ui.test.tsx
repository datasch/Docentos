/**
 * Completar una lección a mano tras ver el 90%, y no poder saltar a la
 * siguiente sin haberla completado (flechas, botón del reproductor, barra
 * móvil y temario comparten la misma regla).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { flattenLessons, isLessonReachable } from '../src/lib/courseNavigation.js';
import { LessonMetaBar, MobileLessonBar } from '../src/components/course/LessonMetaBar.js';
import type { Course } from '../src/types.js';

const video = (id: string) => ({ id, title: id, driveFileId: '', embedUrl: '', mimeType: 'video/mp4', order: 0 });
const course = {
  modules: [
    { id: 'm1', title: 'M1', videos: [video('a'), video('b'), video('c')] },
    { id: 'm2', title: 'M2', videos: [video('d')] },
  ],
} as unknown as Course;
const lessons = flattenLessons(course);

test('isLessonReachable: hacia delante solo con la lección anterior completada', () => {
  // En la lección 0 sin completar nada: la 1 está cerrada.
  assert.equal(isLessonReachable(lessons, {}, 1, 0), false);
  // Completada la 0: se abre la 1, no la 2.
  assert.equal(isLessonReachable(lessons, { a: true }, 1, 0), true);
  assert.equal(isLessonReachable(lessons, { a: true }, 2, 0), false);
  // Cruzando de módulo vale la misma regla.
  assert.equal(isLessonReachable(lessons, { a: true, b: true }, 3, 2), false);
  assert.equal(isLessonReachable(lessons, { a: true, b: true, c: true }, 3, 2), true);
});

test('isLessonReachable: hacia atrás siempre, y sin trabar a quien tiene huecos', () => {
  assert.equal(isLessonReachable(lessons, {}, 0, 2), true);
  assert.equal(isLessonReachable(lessons, {}, 1, 2), true);
  // Hueco: completó la c pero no la b. Puede ir a la c aunque la b no esté.
  assert.equal(isLessonReachable(lessons, { a: true, c: true }, 2, 0), true);
  assert.equal(isLessonReachable(lessons, {}, 9, 0), false);
  assert.equal(isLessonReachable(lessons, {}, -1, 0), false);
});

const metaProps = {
  lessonTitle: 'Clase 1',
  moduleTitle: 'Módulo 1',
  moduleIndex: 0,
  providerLabel: 'YouTube',
  lessonNumber: 1,
  totalLessons: 4,
  onToggleComplete: () => {},
};

test('botón bloqueado por video: solo dice «Ver video para completar», sin porcentaje', () => {
  const html = renderToStaticMarkup(<LessonMetaBar {...metaProps} isCompleted={false} canComplete={false} lockedReason="video" />);
  assert.match(html, /Ver video para completar/);
  assert.doesNotMatch(html, /Visto \d+%/);
  assert.doesNotMatch(html, /lesson-complete-ready/);
  assert.match(html, /disabled=""/);
});

test('al 90%: «Marcar como completado» con animación y aviso accesible', () => {
  const html = renderToStaticMarkup(<LessonMetaBar {...metaProps} isCompleted={false} canComplete highlightComplete />);
  assert.match(html, /Marcar como completado/);
  assert.match(html, /lesson-complete-ready/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /disabled=""/);
});

test('ya visto antes (sin animación) y completado', () => {
  const ready = renderToStaticMarkup(<LessonMetaBar {...metaProps} isCompleted={false} canComplete />);
  assert.match(ready, /Marcar como completado/);
  assert.doesNotMatch(ready, /lesson-complete-ready/);
  const done = renderToStaticMarkup(<LessonMetaBar {...metaProps} isCompleted canComplete highlightComplete />);
  assert.match(done, /Misión completada/);
  assert.doesNotMatch(done, /lesson-complete-ready/);
});

test('barra móvil: sin porcentaje, «Ver video» bloqueado y «Completar» con animación', () => {
  const base = {
    lessonNumber: 1,
    totalLessons: 4,
    hasPrevious: false,
    hasNext: false,
    onPrevious: () => {},
    onNext: () => {},
    onToggleComplete: () => {},
  };
  const locked = renderToStaticMarkup(<MobileLessonBar {...base} isCompleted={false} canComplete={false} lockedReason="video" />);
  assert.match(locked, /<span class="truncate">Ver video<\/span>/);
  // El texto visible no muestra porcentaje (el «90%» solo está en la ayuda del title).
  assert.doesNotMatch(locked.replace(/title="[^"]*"/g, ''), /\d+%/);
  const ready = renderToStaticMarkup(<MobileLessonBar {...base} isCompleted={false} canComplete highlightComplete />);
  assert.match(ready, /Completar/);
  assert.match(ready, /lesson-complete-ready/);
});
