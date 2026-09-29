import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';

process.env.DOCENTOS_SKIP_LISTEN = '1';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');
const { saveQuizForModule } = await import('../server/quizService.js');

test('D1: reuniones, examen y certificado respetan permisos y aprobacion persistida', async (t) => {
  const admin = await prisma.user.create({ data: { email: `d1-admin-${Date.now()}@example.invalid`, name: 'Admin', role: 'ADMIN' } });
  await ensureLegacyInstanceConfig();
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const suffix = Date.now().toString();
  const outsider = await prisma.user.create({ data: { email: `d1-out-${suffix}@example.invalid`, name: 'Sin acceso', role: 'PUBLIC_USER' } });
  const learner = await prisma.user.create({ data: { email: `d1-in-${suffix}@example.invalid`, name: 'Matriculado', role: 'PUBLIC_USER' } });
  const course = await prisma.course.create({ data: { title: `D1 ${suffix}`, description: 'Prueba', price: 100, coverImage: '' } });
  const priorPlugin = await prisma.plugin.findUnique({ where: { id: 'interactive-quizzes' } });
  try {
    await prisma.plugin.upsert({
      where: { id: 'interactive-quizzes' },
      update: { enabled: true },
      create: { id: 'interactive-quizzes', name: 'Exámenes', description: 'Prueba', version: '1', enabled: true, category: 'learning' },
    });
    const module = await prisma.module.create({ data: { title: 'Evaluación', order: 1, courseId: course.id } });
    const video = await prisma.videoDriveLink.create({ data: { title: 'Lección', driveFileId: 'd1-test', embedUrl: 'https://example.invalid/video', order: 1, moduleId: module.id } });
    await prisma.courseEnrollment.create({ data: { userId: learner.id, courseId: course.id, status: 'ACTIVE', source: 'ADMIN' } });
    await prisma.meeting.createMany({ data: [
      { title: `Privada ${suffix}`, meetingUrl: 'https://example.invalid/privada', recordingUrl: 'https://example.invalid/grabacion', courseId: course.id, isLive: true },
      { title: `Solo módulo ${suffix}`, meetingUrl: 'https://example.invalid/modulo', moduleId: module.id, isLive: true },
      { title: `General ${suffix}`, meetingUrl: 'https://example.invalid/general', isLive: true },
    ] });
    const request = async (userId: string, path: string, body?: unknown) => {
      const { token } = await createUserSession(userId, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
      const response = await fetch(`${base}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Cookie: `${config.SESSION_COOKIE_NAME}=${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() as any };
    };

    await t.test('reuniones privadas ocultas y reuniones generales visibles', async () => {
    for (const path of ['/api/meetings', '/api/meetings/live']) {
      const response = await request(outsider.id, path);
      assert.equal(response.status, 200);
      assert.deepEqual(response.data.meetings.filter((meeting: any) => meeting.title.includes(suffix)).map((meeting: any) => meeting.title), [`General ${suffix}`]);
      assert.equal(response.data.meetings.some((meeting: any) => meeting.title === `Privada ${suffix}`), false);
      assert.equal(response.data.meetings.some((meeting: any) => meeting.title === `Solo módulo ${suffix}`), false);
      const staff = await request(admin.id, path);
      assert.equal(staff.data.meetings.some((meeting: any) => meeting.title === `Privada ${suffix}`), true);
      const student = await request(learner.id, path);
      assert.equal(student.data.meetings.some((meeting: any) => meeting.title === `Solo módulo ${suffix}`), true);
    }
    });

    await saveQuizForModule(module.id, [
      { id: 'q1', text: 'Primera', options: ['', 'Bien', 'Mal'], correctIndex: 1, explanation: 'Bien es correcta.' },
      { id: 'q2', text: 'Segunda', options: ['Mal', 'Bien'], correctIndex: 1, explanation: 'La segunda.' },
    ]);
    await t.test('preguntas y resumen no revelan respuestas ni cursos ajenos', async () => {
    assert.equal((await request(outsider.id, `/api/courses/${course.id}/quiz-summary`)).status, 403);
    const quiz = await request(learner.id, `/api/modules/${module.id}/quiz`);
    assert.equal(quiz.status, 200);
    assert.equal(quiz.data.questions[0].correctIndex, undefined);
    assert.equal(quiz.data.questions[0].explanation, undefined);
    assert.deepEqual(quiz.data.questions[0].options, ['Bien', 'Mal']);
    const staffQuiz = await request(admin.id, `/api/modules/${module.id}/quiz`);
    assert.equal(staffQuiz.data.questions[0].correctIndex, 0);
    });

    await t.test('videos completos sin examen aprobado no emiten certificado', async () => {
    const progress = await request(learner.id, '/api/progress', { videoId: video.id, completed: true });
    assert.equal(progress.status, 200);
    assert.equal(progress.data.progress.percentage, 100);
    assert.equal(progress.data.certificate, null);
    });

    await t.test('el servidor califica, persiste, restaura y limita intentos; aprobar emite certificado', async () => {
    const wrong = await request(learner.id, `/api/modules/${module.id}/quiz/attempts`, { answers: { 0: 1, 1: 0 } });
    assert.equal(wrong.status, 200);
    assert.deepEqual([wrong.data.scorePercentage, wrong.data.passed], [0, false]);
    assert.deepEqual(wrong.data, { scorePercentage: 0, passed: false, attemptsLeft: 2 });
    const restored = await request(learner.id, `/api/courses/${course.id}/quiz-attempts`);
    assert.equal(restored.data.attempts.length, 1);
    assert.equal(restored.data.attempts[0].passed, false);
    assert.equal((await request(outsider.id, `/api/courses/${course.id}/quiz-attempts`)).status, 403);
    assert.equal((await request(learner.id, '/api/progress')).data.certificates.length, 0);

    const correct = await request(learner.id, `/api/modules/${module.id}/quiz/attempts`, { answers: { 0: 0, 1: 1 } });
    assert.equal(correct.status, 200);
    assert.deepEqual([correct.data.scorePercentage, correct.data.passed], [100, true]);
    assert.deepEqual(correct.data.correctIndexes, { 0: 0, 1: 1 });
    assert.equal(correct.data.explanations[0], 'Bien es correcta.');
    assert.equal((await request(learner.id, '/api/progress')).data.certificates.length, 1);
    const third = await request(learner.id, `/api/modules/${module.id}/quiz/attempts`, { answers: {} });
    assert.equal(third.status, 200);
    assert.equal(third.data.attemptsLeft, 0);
    assert.deepEqual(third.data.correctIndexes, { 0: 0, 1: 1 });
    const fourth = await request(learner.id, `/api/modules/${module.id}/quiz/attempts`, { answers: {} });
    assert.equal(fourth.status, 429);
    assert.equal(await prisma.quizAttempt.count({ where: { userId: learner.id, moduleId: module.id } }), 3);
    });
    await t.test('sin plugin de exámenes, completar videos concede certificado', async () => {
      const other = await prisma.user.create({ data: { email: `d1-noquiz-${suffix}@example.invalid`, name: 'Sin examen', role: 'PUBLIC_USER' } });
      try {
        await prisma.plugin.update({ where: { id: 'interactive-quizzes' }, data: { enabled: false } });
        await prisma.courseEnrollment.create({ data: { userId: other.id, courseId: course.id, status: 'ACTIVE', source: 'ADMIN' } });
        const progress = await request(other.id, '/api/progress', { videoId: video.id, completed: true });
        assert.equal(progress.status, 200);
        assert.ok(progress.data.certificate);
      } finally {
        await prisma.plugin.update({ where: { id: 'interactive-quizzes' }, data: { enabled: true } });
        await prisma.user.delete({ where: { id: other.id } });
      }
    });
  } finally {
    if (priorPlugin) await prisma.plugin.update({ where: { id: priorPlugin.id }, data: { enabled: priorPlugin.enabled } });
    else await prisma.plugin.delete({ where: { id: 'interactive-quizzes' } });
    await prisma.user.deleteMany({ where: { id: { in: [outsider.id, learner.id, admin.id] } } });
    await prisma.meeting.deleteMany({ where: { title: { in: [`General ${suffix}`, `Solo módulo ${suffix}`] } } });
    await prisma.course.deleteMany({ where: { id: course.id } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
