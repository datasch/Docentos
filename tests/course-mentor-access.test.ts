/**
 * Acceso del mentor asignado a un curso (CourseMentor).
 *
 * Antes solo contaba tener alumnos asignados (MenteeAssignment): un mentor
 * asignado al curso sin alumnos veía el curso en su panel pero recibía 403 al
 * abrir sus lecciones o responder consultas. Ahora el mentor del curso entra,
 * y nada más cambia: un mentor de otro curso, o alguien que dejó de ser mentor,
 * sigue sin acceso.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import type { AddressInfo } from 'node:net';
process.env.DOCENTOS_SKIP_LISTEN = '1';
const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');
const { getCourseAccessDecision, getCourseAccessDecisions, userHasVideoAccess } = await import('../server/courseAccess.js');

test('el mentor asignado al curso (CourseMentor) tiene acceso a su curso y solo a ese', async (t) => {
  const suffix = `cm-access-${Date.now()}`;
  const ids: string[] = [];
  const createUser = async (role: 'MENTOR' | 'MENTEE') => {
    const u = await prisma.user.create({ data: { name: `${role} ${suffix}`, role, email: `${role}-${ids.length}-${suffix}@example.invalid` } });
    ids.push(u.id);
    const { token } = await createUserSession(u.id, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
    return { ...u, cookie: `${config.SESSION_COOKIE_NAME}=${token}` };
  };
  await ensureLegacyInstanceConfig();
  const mentor = await createUser('MENTOR');
  const otherMentor = await createUser('MENTOR');
  const student = await createUser('MENTEE');

  // Curso privado (sin acceso para miembros) para que solo cuente la asignación.
  const course = await prisma.course.create({ data: { title: suffix, description: 'Test', price: 49, published: true, openToAllRegistered: false, coverImage: '' } });
  const otherCourse = await prisma.course.create({ data: { title: `${suffix}-otro`, description: 'Test', price: 49, published: true, openToAllRegistered: false, coverImage: '' } });
  const module = await prisma.module.create({ data: { courseId: course.id, title: 'M1', order: 1 } });
  const video = await prisma.videoDriveLink.create({ data: { moduleId: module.id, title: 'L1', driveFileId: suffix, embedUrl: 'https://example.invalid/video', order: 1 } });
  await prisma.courseMentor.create({ data: { courseId: course.id, mentorId: mentor.id } });
  await prisma.courseMentor.create({ data: { courseId: otherCourse.id, mentorId: otherMentor.id } });
  await prisma.courseEnrollment.create({ data: { userId: student.id, courseId: course.id, source: 'ADMIN' } });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await prisma.mentorshipComment.deleteMany({ where: { videoId: video.id } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.course.deleteMany({ where: { id: { in: [course.id, otherCourse.id] } } });
    await prisma.$disconnect();
  });

  const asUser = (u: { id: string; email: string; name: string; role: string }) =>
    ({ id: u.id, email: u.email, name: u.name, role: u.role }) as any;

  await t.test('decisión individual y por lotes coinciden: acceso como mentor del curso', async () => {
    const single = await getCourseAccessDecision(asUser(mentor), course.id);
    assert.equal(single.allowed, true);
    assert.equal(single.reason, 'mentor_assignment');
    const batch = await getCourseAccessDecisions(asUser(mentor), [
      { id: course.id, published: true, price: 49, openToAllRegistered: false },
      { id: otherCourse.id, published: true, price: 49, openToAllRegistered: false },
    ]);
    assert.equal(batch.get(course.id)?.allowed, true);
    assert.equal(batch.get(otherCourse.id)?.allowed, false, 'no entra al curso de otro mentor');
    assert.equal(await userHasVideoAccess(asUser(mentor), video.id), true);
  });

  await t.test('un mentor de otro curso no tiene acceso', async () => {
    assert.equal((await getCourseAccessDecision(asUser(otherMentor), course.id)).allowed, false);
    assert.equal(await userHasVideoAccess(asUser(otherMentor), video.id), false);
  });

  await t.test('por HTTP: el mentor del curso lee las consultas y responde; el otro recibe 403', async () => {
    const q = await fetch(`${base}/api/videos/${video.id}/comments`, {
      method: 'POST',
      headers: { Cookie: student.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Duda del alumno' }),
    });
    assert.equal(q.status, 200);
    const questionId = (await q.json()).comment.id;

    assert.equal((await fetch(`${base}/api/videos/${video.id}/comments`, { headers: { Cookie: mentor.cookie } })).status, 200);
    const reply = await fetch(`${base}/api/comments/${questionId}/reply`, {
      method: 'POST',
      headers: { Cookie: mentor.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Respuesta del mentor' }),
    });
    assert.equal(reply.status, 200);

    const foreign = await fetch(`${base}/api/comments/${questionId}/reply`, {
      method: 'POST',
      headers: { Cookie: otherMentor.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'No debería entrar' }),
    });
    assert.equal(foreign.status, 403);
  });

  await t.test('quien deja de ser mentor pierde el acceso aunque quede la asignación', async () => {
    await prisma.user.update({ where: { id: mentor.id }, data: { role: 'MENTEE' } });
    const demoted = { ...mentor, role: 'MENTEE' };
    assert.equal((await getCourseAccessDecision(asUser(demoted), course.id)).allowed, false);
    await prisma.user.update({ where: { id: mentor.id }, data: { role: 'MENTOR' } });
  });

  await t.test('al quitar la asignación del curso se pierde el acceso', async () => {
    await prisma.courseMentor.deleteMany({ where: { courseId: course.id, mentorId: mentor.id } });
    assert.equal((await getCourseAccessDecision(asUser(mentor), course.id)).allowed, false);
    assert.equal(await userHasVideoAccess(asUser(mentor), video.id), false);
  });
});
