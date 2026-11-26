import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCourseNpsStage } from '../src/lib/courseNps.js';
import {
  courseNpsToCsv,
  extractCourseNpsStudents,
  latestCourseNpsPerUser,
  submitCourseNpsSchema,
  summarizeCourseNps,
  type CourseNpsRow,
} from '../server/courseNpsService.js';

const day = (n: number) => new Date(Date.UTC(2026, 10, n, 12));

const makeRow = (over: Partial<CourseNpsRow>): CourseNpsRow => ({
  id: 's1',
  userId: 'u1',
  courseId: 'c1',
  courseTitle: 'Curso Arquitectura',
  stage: 'START',
  npsScore: 9,
  comment: null,
  dismissed: false,
  authorName: 'Ana',
  authorEmail: 'ana@example.com',
  createdAt: day(1),
  updatedAt: day(1),
  ...over,
});

test('CourseNPS: resolveCourseNpsStage selecciona START, MID (50%) y END (100%) en orden y sin repetir', () => {
  const empty = new Set<'START' | 'MID' | 'END'>();
  assert.equal(resolveCourseNpsStage(0, 0, empty), null);
  assert.equal(resolveCourseNpsStage(0, 4, empty), 'START');
  assert.equal(resolveCourseNpsStage(1, 4, empty), 'START');
  assert.equal(resolveCourseNpsStage(2, 4, empty), 'MID');
  assert.equal(resolveCourseNpsStage(3, 4, empty), 'MID');
  assert.equal(resolveCourseNpsStage(4, 4, empty), 'END');

  // Si ya respondió START, no vuelve a pedir nada hasta llegar al 50%
  const withStart = new Set<'START' | 'MID' | 'END'>(['START']);
  assert.equal(resolveCourseNpsStage(0, 4, withStart), null);
  assert.equal(resolveCourseNpsStage(1, 4, withStart), null);
  assert.equal(resolveCourseNpsStage(2, 4, withStart), 'MID');

  // Curso de 1 sola lección: 0% -> START, 100% -> END (prioridad sobre MID)
  assert.equal(resolveCourseNpsStage(0, 1, empty), 'START');
  assert.equal(resolveCourseNpsStage(1, 1, empty), 'END');

  // Ya completado END: no vuelve a molestar
  assert.equal(resolveCourseNpsStage(4, 4, new Set(['END'])), null);
});

test('CourseNPS: validación Zod exige nota 0..10 al enviar y permite omitir cuando dismissed=true', () => {
  assert.equal(submitCourseNpsSchema.safeParse({ stage: 'START', npsScore: 10 }).success, true);
  assert.equal(submitCourseNpsSchema.safeParse({ stage: 'MID', npsScore: 0, comment: 'Bien' }).success, true);
  assert.equal(submitCourseNpsSchema.safeParse({ stage: 'END', dismissed: true }).success, true);

  assert.equal(submitCourseNpsSchema.safeParse({ stage: 'START' }).success, false);
  assert.equal(submitCourseNpsSchema.safeParse({ stage: 'START', npsScore: 11 }).success, false);
  assert.equal(submitCourseNpsSchema.safeParse({ stage: 'START', npsScore: -1 }).success, false);
  assert.equal(submitCourseNpsSchema.safeParse({ stage: 'OTHER', npsScore: 8 }).success, false);
});

test('CourseNPS: latestCourseNpsPerUser toma la etapa más avanzada por usuario y curso', () => {
  const rows: CourseNpsRow[] = [
    makeRow({ id: '1', userId: 'u1', courseId: 'c1', stage: 'START', npsScore: 5, updatedAt: day(1) }),
    makeRow({ id: '2', userId: 'u1', courseId: 'c1', stage: 'END', npsScore: 10, updatedAt: day(3) }),
    makeRow({ id: '3', userId: 'u1', courseId: 'c2', stage: 'START', npsScore: 7, updatedAt: day(2) }),
    makeRow({ id: '4', userId: 'u2', courseId: 'c1', stage: 'MID', npsScore: null, dismissed: true, updatedAt: day(2) }),
  ];

  assert.deepEqual(latestCourseNpsPerUser(rows).sort((a, b) => a - b), [7, 10]);
});

test('CourseNPS: summarizeCourseNps calcula NPS global, por etapa, por curso y delta Inicio->Final', () => {
  const rows: CourseNpsRow[] = [
    makeRow({ id: '1', userId: 'u1', courseId: 'c1', courseTitle: 'Curso A', stage: 'START', npsScore: 4, comment: 'Inicio flojo', updatedAt: day(1) }),
    makeRow({ id: '2', userId: 'u1', courseId: 'c1', courseTitle: 'Curso A', stage: 'MID', npsScore: 8, updatedAt: day(2) }),
    makeRow({ id: '3', userId: 'u1', courseId: 'c1', courseTitle: 'Curso A', stage: 'END', npsScore: 10, comment: 'Excelente cierre', updatedAt: day(3) }),
    makeRow({ id: '4', userId: 'u2', courseId: 'c1', courseTitle: 'Curso A', stage: 'START', npsScore: 9, updatedAt: day(2) }),
    makeRow({ id: '5', userId: 'u3', courseId: 'c1', courseTitle: 'Curso A', stage: 'END', npsScore: null, dismissed: true, updatedAt: day(4) }),
  ];

  const summary = summarizeCourseNps(rows);
  assert.equal(summary.totalResponses, 4);
  assert.equal(summary.dismissedCount, 1);
  // Global por usuario/curso: u1=10 (END), u2=9 (START) -> 2 promotores => NPS 100
  assert.equal(summary.overall.score, 100);
  // START: u1=4 (detractor), u2=9 (promotor) => (1-1)/2 = 0
  assert.equal(summary.byStage.START.score, 0);
  // MID: u1=8 (pasivo) => 0
  assert.equal(summary.byStage.MID.score, 0);
  // END: u1=10 (promotor) => 100
  assert.equal(summary.byStage.END.score, 100);

  assert.equal(summary.byCourse.length, 1);
  assert.equal(summary.byCourse[0].deltaStartToEnd, 100); // END(100) - START(0)
  assert.equal(summary.recentComments.length, 2);
  assert.equal(summary.recentComments[0].stage, 'END');
  assert.equal(summary.studentResponses.length, 4);
  assert.equal(summary.studentResponses.find((r) => r.stage === 'MID')?.comment, null);

  const students = extractCourseNpsStudents(rows);
  assert.equal(students.length, 2);
  assert.equal(students.find((s) => s.userId === 'u1')?.responses, 3);
  assert.equal(students.find((s) => s.userId === 'u2')?.responses, 1);
});

test('CourseNPS: courseNpsToCsv exporta con BOM y neutraliza fórmulas', () => {
  const csv = courseNpsToCsv([
    makeRow({
      stage: 'END',
      npsScore: 9,
      authorName: '=CMD()',
      comment: 'Muy "claro"',
      updatedAt: day(5),
    }),
  ]);
  assert.ok(csv.startsWith('\uFEFFfecha,curso,etapa,estudiante,correo,nps_0_a_10,grupo_nps,comentario'));
  assert.ok(csv.includes('Final'));
  assert.ok(csv.includes("'=CMD()"));
  assert.ok(csv.includes('"Muy ""claro"""'));
});
