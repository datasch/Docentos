/**
 * Flujo completo por HTTP: un alumno pregunta en una lección y el mentor
 * asignado (y los administradores) reciben el aviso en vivo por SSE; el mentor
 * responde y el alumno recibe el suyo. Un mentor no asignado no se entera.
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
const { notificationHub } = await import('../server/notificationService.js');

interface SseEvent {
  event: string;
  data: any;
}

/** Abre el stream SSE y devuelve una función para esperar el siguiente evento de un tipo. */
async function openStream(url: string, cookie: string) {
  const controller = new AbortController();
  const res = await fetch(url, { headers: { Cookie: cookie, Accept: 'text/event-stream' }, signal: controller.signal });
  const events: SseEvent[] = [];
  const waiters: Array<{ event: string; resolve: (e: SseEvent) => void }> = [];
  let buffer = '';
  const pump = async () => {
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const name = /^event: (.+)$/m.exec(block)?.[1];
          const data = /^data: (.+)$/m.exec(block)?.[1];
          if (!name || !data) continue;
          const evt = { event: name, data: JSON.parse(data) };
          const waiter = waiters.findIndex((w) => w.event === name);
          if (waiter !== -1) waiters.splice(waiter, 1)[0].resolve(evt);
          else events.push(evt);
        }
      }
    } catch {
      // abortado al cerrar
    }
  };
  void pump();
  const next = (event: string, timeoutMs = 5000) =>
    new Promise<SseEvent>((resolve, reject) => {
      const queued = events.findIndex((e) => e.event === event);
      if (queued !== -1) return resolve(events.splice(queued, 1)[0]);
      const timer = setTimeout(() => reject(new Error(`sin evento ${event}`)), timeoutMs);
      waiters.push({ event, resolve: (e) => { clearTimeout(timer); resolve(e); } });
    });
  return { res, next, events, close: () => controller.abort() };
}

const settle = () => new Promise((r) => setTimeout(r, 300));

test('notificaciones en vivo de preguntas y respuestas de mentoría', async (t) => {
  const suffix = `notif-${Date.now()}`;
  const ids: string[] = [];
  const createUser = async (role: 'ADMIN' | 'MENTOR' | 'MENTEE') => {
    const u = await prisma.user.create({ data: { name: `${role} ${suffix}`, role, email: `${role}-${ids.length}-${suffix}@example.invalid` } });
    ids.push(u.id);
    const { token } = await createUserSession(u.id, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
    return { ...u, cookie: `${config.SESSION_COOKIE_NAME}=${token}` };
  };
  await ensureLegacyInstanceConfig();
  const admin = await createUser('ADMIN');
  const mentor = await createUser('MENTOR');
  const otherMentor = await createUser('MENTOR');
  const student = await createUser('MENTEE');

  const course = await prisma.course.create({ data: { title: suffix, description: 'Test', price: 0, published: true, coverImage: '' } });
  const module = await prisma.module.create({ data: { courseId: course.id, title: 'M1', order: 1 } });
  const video = await prisma.videoDriveLink.create({
    data: { moduleId: module.id, title: 'Lección con dudas', driveFileId: suffix, embedUrl: 'https://example.invalid/video', order: 1 },
  });
  await prisma.courseMentor.create({ data: { courseId: course.id, mentorId: mentor.id } });
  await prisma.courseEnrollment.create({ data: { userId: student.id, courseId: course.id, source: 'ADMIN' } });
  // El mentor está asignado al curso (CourseMentor) pero no tiene alumnos
  // asignados: aun así debe poder responder.

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const streams: Array<{ close: () => void }> = [];

  t.after(async () => {
    streams.forEach((s) => s.close());
    server.closeAllConnections?.();
    await new Promise<void>((r) => server.close(() => r()));
    await prisma.mentorshipComment.deleteMany({ where: { videoId: video.id } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.$disconnect();
  });

  const post = (path: string, cookie: string, body: unknown) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  await t.test('sin sesión el stream responde 401', async () => {
    const res = await fetch(`${base}/api/notifications/stream`);
    assert.equal(res.status, 401);
  });

  const mentorStream = await openStream(`${base}/api/notifications/stream`, mentor.cookie);
  const adminStream = await openStream(`${base}/api/notifications/stream`, admin.cookie);
  const otherStream = await openStream(`${base}/api/notifications/stream`, otherMentor.cookie);
  const studentStream = await openStream(`${base}/api/notifications/stream`, student.cookie);
  streams.push(mentorStream, adminStream, otherStream, studentStream);

  await t.test('el stream abre como SSE y anuncia el contador inicial', async () => {
    assert.equal(mentorStream.res.status, 200);
    assert.match(mentorStream.res.headers.get('content-type') || '', /text\/event-stream/);
    assert.equal(mentorStream.res.headers.get('content-encoding'), null, 'SSE no debe comprimirse');
    const ready = await mentorStream.next('ready');
    assert.equal(ready.data.unreadCount, 0);
    await adminStream.next('ready');
    await otherStream.next('ready');
    await studentStream.next('ready');
  });

  let questionId = '';
  await t.test('pregunta del alumno: aviso en vivo al mentor asignado y al admin', async () => {
    const res = await post(`/api/videos/${video.id}/comments`, student.cookie, { content: '¿Cómo se configura   el proxy?' });
    assert.equal(res.status, 200);
    questionId = (await res.json()).comment.id;

    const toMentor = await mentorStream.next('notification');
    assert.equal(toMentor.data.type, 'qna.question');
    assert.match(toMentor.data.title, /Nueva pregunta/);
    assert.equal(toMentor.data.body, '¿Cómo se configura el proxy?');
    assert.equal(toMentor.data.data.videoId, video.id);
    assert.equal(toMentor.data.data.courseId, course.id);
    assert.equal(toMentor.data.data.commentId, questionId);

    const toAdmin = await adminStream.next('notification');
    assert.equal(toAdmin.data.type, 'qna.question');
  });

  await t.test('un mentor no asignado al curso y el propio alumno no reciben nada', async () => {
    await settle();
    assert.equal(otherStream.events.filter((e) => e.event === 'notification').length, 0);
    assert.equal(studentStream.events.filter((e) => e.event === 'notification').length, 0);
    assert.equal(await prisma.notification.count({ where: { userId: otherMentor.id } }), 0);
    assert.equal(await prisma.notification.count({ where: { userId: student.id } }), 0);
  });

  await t.test('respuesta del mentor: aviso en vivo al autor de la pregunta', async () => {
    const res = await post(`/api/comments/${questionId}/reply`, mentor.cookie, { content: 'Revisa la variable TRUST_PROXY.' });
    assert.equal(res.status, 200);
    const toStudent = await studentStream.next('notification');
    assert.equal(toStudent.data.type, 'qna.answered');
    assert.equal(toStudent.data.title, 'Tu consulta fue respondida');
    assert.match(toStudent.data.body, /Revisa la variable TRUST_PROXY/);
    assert.equal(toStudent.data.data.commentId, questionId);
    // La lógica existente no cambia: la pregunta queda resuelta.
    const question = await prisma.mentorshipComment.findUniqueOrThrow({ where: { id: questionId } });
    assert.equal(question.isResolved, true);
  });

  await t.test('una réplica del alumno no avisa a nadie como respuesta', async () => {
    const before = await prisma.notification.count({ where: { userId: { in: ids } } });
    const res = await post(`/api/comments/${questionId}/reply`, student.cookie, { content: 'Gracias' });
    assert.equal(res.status, 200);
    await settle();
    assert.equal(await prisma.notification.count({ where: { userId: { in: ids } } }), before);
  });

  await t.test('bandeja: lista, contador y marcar como leído solo lo propio', async () => {
    const list = await (await fetch(`${base}/api/notifications`, { headers: { Cookie: mentor.cookie } })).json();
    assert.equal(list.unreadCount, 1);
    assert.equal(list.notifications.length, 1);
    const id = list.notifications[0].id;

    // El alumno no puede marcar avisos del mentor.
    const foreign = await (await post('/api/notifications/read', student.cookie, { ids: [id] })).json();
    assert.equal(foreign.updated, 0);

    const marked = await (await post('/api/notifications/read', mentor.cookie, { ids: [id] })).json();
    assert.equal(marked.updated, 1);
    assert.equal(marked.unreadCount, 0);
  });

  await t.test('las notificaciones también quedan guardadas para quien estaba desconectado', async () => {
    mentorStream.close();
    await settle();
    const res = await post(`/api/videos/${video.id}/comments`, student.cookie, { content: 'Otra duda' });
    assert.equal(res.status, 200);
    await settle();
    const list = await (await fetch(`${base}/api/notifications`, { headers: { Cookie: mentor.cookie } })).json();
    assert.equal(list.unreadCount, 1);
    assert.equal(list.notifications[0].body, 'Otra duda');
  });

  await t.test('límite de pestañas abiertas por usuario', async () => {
    const extra = [];
    for (let i = 0; i < 6; i++) {
      const s = await openStream(`${base}/api/notifications/stream`, otherMentor.cookie);
      streams.push(s);
      extra.push(s.res.status);
    }
    // otherStream ya ocupa una; caben 5 en total.
    assert.equal(extra.filter((s) => s === 200).length, 4);
    assert.equal(extra.filter((s) => s === 429).length, 2);
  });

  await t.test('cerrar sesión cierra sus streams', async () => {
    const before = notificationHub.count(student.id);
    assert.ok(before >= 1);
    const res = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: student.cookie } });
    assert.equal(res.status, 200);
    await settle();
    assert.equal(notificationHub.count(student.id), 0);
  });
});
