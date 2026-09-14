/**
 * Reparto de cursos entre mentees.
 *
 * Fija los dos comportamientos que faltaban en el panel de mentoría: que cada
 * persona salga una sola vez con sus cursos (antes se repetía una fila por
 * asignación, sin decir de qué curso hablaba) y que marcar y desmarcar en el
 * selector se traduzca en altas y bajas sin llevarse por delante a quien ya
 * estaba asignado.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { groupAssignmentsByMentee, resolveRosterChanges } from '../server/mentorship.js';
import type { AssignmentRow } from '../server/mentorship.js';

function assignment(over: Partial<AssignmentRow> & { menteeId: string; courseId: string }): AssignmentRow {
  return {
    id: `a-${over.menteeId}-${over.courseId}`,
    mentorId: 'mentor-01',
    courseProgress: 0,
    completedVideosCount: 0,
    totalVideosCount: 0,
    lastActiveDate: 'Reciente',
    status: 'ACTIVE',
    mentee: { id: over.menteeId, name: 'Mariana Torres', email: 'mariana@ejemplo.com' },
    course: { title: 'Curso' },
    ...over,
  } as AssignmentRow;
}

test('Mentoría: el listado agrupa por persona, no por asignación', async (t) => {
  await t.test('1. Quien lleva tres cursos sale una vez, con los tres', () => {
    const fichas = groupAssignmentsByMentee([
      assignment({ menteeId: 'm1', courseId: 'c1', course: { title: 'Inglés' } }),
      assignment({ menteeId: 'm1', courseId: 'c2', course: { title: 'Cloud' } }),
      assignment({ menteeId: 'm1', courseId: 'c3', course: { title: 'Diseño' } }),
    ]);
    assert.equal(fichas.length, 1, 'Antes esta persona aparecía tres veces en la lista');
    assert.deepEqual(
      fichas[0].courses.map((c) => c.courseTitle),
      ['Inglés', 'Cloud', 'Diseño'],
    );
  });

  await t.test('2. El progreso pesa por lecciones, no promedia porcentajes', () => {
    const fichas = groupAssignmentsByMentee([
      // Curso corto terminado entero.
      assignment({
        menteeId: 'm1',
        courseId: 'c1',
        completedVideosCount: 3,
        totalVideosCount: 3,
        courseProgress: 100,
      }),
      // Curso largo sin empezar.
      assignment({
        menteeId: 'm1',
        courseId: 'c2',
        completedVideosCount: 0,
        totalVideosCount: 97,
        courseProgress: 0,
      }),
    ]);
    assert.equal(
      fichas[0].courseProgress,
      3,
      'Promediar porcentajes daba 50% por terminar el curso de 3 clases',
    );
    assert.equal(fichas[0].completedVideosCount, 3);
    assert.equal(fichas[0].totalVideosCount, 100);
  });

  await t.test('3. Seguir en un curso manda sobre haber terminado otro', () => {
    const fichas = groupAssignmentsByMentee([
      assignment({ menteeId: 'm1', courseId: 'c1', status: 'GRADUATED' }),
      assignment({ menteeId: 'm1', courseId: 'c2', status: 'ACTIVE' }),
    ]);
    assert.equal(fichas[0].status, 'ACTIVE');
  });

  await t.test('4. Sin lecciones publicadas el progreso es 0, no una división por cero', () => {
    const fichas = groupAssignmentsByMentee([
      assignment({ menteeId: 'm1', courseId: 'c1', totalVideosCount: 0 }),
    ]);
    assert.equal(fichas[0].courseProgress, 0);
  });

  await t.test('5. Un curso borrado a medias no deja la ficha sin título', () => {
    const fichas = groupAssignmentsByMentee([
      assignment({ menteeId: 'm1', courseId: 'c1', course: null }),
    ]);
    assert.equal(fichas[0].courses[0].courseTitle, 'Curso sin título');
  });

  await t.test('6. Sin asignaciones no hay fichas', () => {
    assert.deepEqual(groupAssignmentsByMentee([]), []);
  });
});

test('Mentoría: marcar y desmarcar se traduce en altas y bajas', async (t) => {
  await t.test('1. Lo marcado y no asignado se da de alta', () => {
    const cambios = resolveRosterChanges(['a', 'b'], ['a'], ['a', 'b']);
    assert.deepEqual(cambios.toAdd, ['b']);
    assert.deepEqual(cambios.toRemove, []);
  });

  await t.test('2. Lo asignado y no marcado se retira', () => {
    const cambios = resolveRosterChanges(['a'], ['a', 'b'], ['a']);
    assert.deepEqual(cambios.toAdd, []);
    assert.deepEqual(cambios.toRemove, ['b']);
  });

  await t.test('3. Quien ya estaba asignado se conserva aunque no pase el filtro', () => {
    // Caso real: una cuenta VIP con una asignación viva. Filtrarla por rol la
    // expulsaba del curso en cuanto alguien guardaba el reparto.
    const cambios = resolveRosterChanges(['vip', 'nuevo'], ['vip'], ['nuevo']);
    assert.deepEqual(cambios.toRemove, [], 'Guardar no puede expulsar a quien ya estaba');
    assert.deepEqual(cambios.toAdd, ['nuevo']);
    assert.deepEqual(cambios.ignored, []);
  });

  await t.test('4. Un alta que no pasa el filtro se informa, no se traga en silencio', () => {
    const cambios = resolveRosterChanges(['admin'], [], []);
    assert.deepEqual(cambios.toAdd, []);
    assert.deepEqual(cambios.ignored, ['admin'], 'El panel diría «asignado» sin haber asignado nada');
  });

  await t.test('5. Repetir el mismo identificador no da de alta dos veces', () => {
    const cambios = resolveRosterChanges(['a', 'a', 'a'], [], ['a']);
    assert.deepEqual(cambios.toAdd, ['a']);
  });

  await t.test('6. Guardar sin tocar nada no cambia nada', () => {
    const cambios = resolveRosterChanges(['a', 'b'], ['a', 'b'], ['a', 'b']);
    assert.deepEqual(cambios.toAdd, []);
    assert.deepEqual(cambios.toRemove, []);
    assert.deepEqual(cambios.ignored, []);
  });

  await t.test('7. Vaciar la lista retira todo el reparto', () => {
    const cambios = resolveRosterChanges([], ['a', 'b'], []);
    assert.deepEqual(cambios.toRemove, ['a', 'b']);
  });
});
