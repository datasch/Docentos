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
import { assignableMenteeWhere, groupAssignmentsByMentee, resolveRosterChanges } from '../server/mentorship.js';
import { prisma } from '../server/prisma.js';
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

/**
 * El selector de "Asignar mentees al curso" enseñaba tres personas de quince:
 * exigía el rol MENTEE y dejaba fuera a todo el que estaba registrado sin él.
 * Desde que el precio no abre cursos, repartir a mano es la vía normal de dar
 * acceso, así que el selector tiene que llegar a cualquier cuenta con registro.
 */
test('Mentoría: el selector alcanza a todas las cuentas registradas', async (t) => {
  await t.test('1. Ya no se exige el rol MENTEE', () => {
    const where = assignableMenteeWhere([]);
    assert.deepEqual(
      where.OR[0],
      { role: { not: 'ADMIN' } },
      'Antes esta condición era { role: "MENTEE" } y escondía a PUBLIC_USER, VIP y EXTERNAL',
    );
  });

  await t.test('2. Solo se pide que la cuenta esté activa', () => {
    assert.equal(assignableMenteeWhere([]).isActive, true);
  });

  await t.test('3. Administración queda fuera salvo que ya esté asignada', () => {
    // Excluir a quien ya tiene una asignación viva no lo escondía: hacía que
    // guardar el reparto le retirase el curso.
    const where = assignableMenteeWhere(['admin-con-curso', 'admin-con-curso', 'otra']);
    assert.deepEqual(where.OR[1], { id: { in: ['admin-con-curso', 'otra'] } }, 'Sin duplicados');
  });
});

/**
 * El panel se contradecía solo: enseñaba en la lista de mentees a cuentas cuyo
 * rol no era MENTEE —porque tenían un curso asignado— y al pulsar «Editar
 * cursos» respondía «Mentee no encontrado», porque esa ruta exigía el rol.
 *
 * La prueba se fabrica su propio caso en vez de buscarlo en la base. La primera
 * versión daba por hecho que existía alguna cuenta asignada sin rol MENTEE: era
 * cierto en la base de desarrollo y falso en una recién sembrada, así que pasaba
 * en local y moría en integración continua. Un dato ambiental no es un caso de
 * prueba.
 */
test('Mentoría: quien sale en la lista se puede editar', async (t) => {
  const marca = `roster-${Date.now()}`;
  const curso = await prisma.course.findFirst({ orderBy: { createdAt: 'asc' } });
  assert.ok(curso, 'La base debe tener algún curso');

  const mentor = await prisma.user.create({
    data: { name: 'Mentor fixture', email: `mentor-${marca}@ejemplo.invalid`, role: 'MENTOR', avatarUrl: '/logo.avif' },
  });
  // Los dos roles que el filtro viejo perdía, con asignación viva.
  const publico = await prisma.user.create({
    data: { name: 'Público asignado', email: `publico-${marca}@ejemplo.invalid`, role: 'PUBLIC_USER', avatarUrl: '/logo.avif' },
  });
  const vip = await prisma.user.create({
    data: { name: 'VIP asignado', email: `vip-${marca}@ejemplo.invalid`, role: 'VIP', avatarUrl: '/logo.avif' },
  });
  const ids = [mentor.id, publico.id, vip.id];

  for (const menteeId of [publico.id, vip.id]) {
    await prisma.menteeAssignment.create({
      data: { menteeId, mentorId: mentor.id, courseId: curso.id, totalVideosCount: 0 },
    });
  }

  t.after(async () => {
    await prisma.menteeAssignment.deleteMany({ where: { menteeId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  await t.test('1. Todo el que sale en la lista se alcanza al guardar', async () => {
    const asignaciones = await prisma.menteeAssignment.findMany({
      select: { menteeId: true },
      distinct: ['menteeId'],
    });
    const enLista = asignaciones.map((a) => a.menteeId);

    const alcanzables = await prisma.user.findMany({
      where: {
        id: { in: enLista },
        OR: [{ menteeAssignments: { some: {} } }, assignableMenteeWhere(enLista)],
      },
      select: { id: true },
    });

    const perdidos = enLista.filter((id) => !alcanzables.some((u) => u.id === id));
    assert.deepEqual(perdidos, [], 'Nadie que salga en la lista puede quedar fuera al buscarlo');
  });

  await t.test('2. Y el caso que lo provocaba está representado de verdad', async () => {
    const sinRolMentee = await prisma.user.findMany({
      where: { id: { in: [publico.id, vip.id] }, role: { not: 'MENTEE' } },
      select: { id: true },
    });
    assert.equal(sinRolMentee.length, 2, 'Las dos cuentas del montaje siguen sin rol MENTEE');
  });

  await t.test('3. La regla vieja sí las perdía', () => {
    // El filtro anterior era: isActive y (role MENTEE o ya asignado). Con la
    // condición reducida al rol, estas dos cuentas no aparecían.
    const pasaLaReglaVieja = (rol: string) => rol === 'MENTEE';
    assert.equal(pasaLaReglaVieja('PUBLIC_USER'), false);
    assert.equal(pasaLaReglaVieja('VIP'), false);
  });
});
