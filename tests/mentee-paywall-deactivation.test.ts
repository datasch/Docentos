import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';

process.env.DOCENTOS_SKIP_LISTEN = '1';
const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');

test('MENTEE: Paywall modal deactivated, requiresPaywall is false, and assigned/course mentor provided on lock', async (t) => {
  const suffix = `mentee-paywall-${Date.now()}`;
  const users: string[] = [];
  const courses: string[] = [];

  const account = async (role: 'ADMIN' | 'MENTOR' | 'MENTEE' | 'PUBLIC_USER', label: string) => {
    const user = await prisma.user.create({
      data: { role, name: `User ${label}`, email: `${label}-${suffix}@example.invalid` },
    });
    users.push(user.id);
    const { token } = await createUserSession(user.id, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
    return { ...user, cookie: `${config.SESSION_COOKIE_NAME}=${token}` };
  };

  const mentor = await account('MENTOR', 'mentor');
  const mentee = await account('MENTEE', 'mentee');
  const publicUser = await account('PUBLIC_USER', 'public');

  await ensureLegacyInstanceConfig();

  // Create two courses: Course 1 (assigned to mentor in CourseMentor), Course 2 (without course mentor)
  const c1 = await prisma.course.create({
    data: {
      title: `Curso Mentoría 1 ${suffix}`,
      description: 'Curso con mentor asignado',
      price: 150,
      currency: 'USD',
      coverImage: '/logo.avif',
      published: true,
    },
  });
  courses.push(c1.id);

  const c2 = await prisma.course.create({
    data: {
      title: `Curso Sin Mentor Directo ${suffix}`,
      description: 'Curso sin mentor directo',
      price: 200,
      currency: 'USD',
      coverImage: '/logo.avif',
      published: true,
    },
  });
  courses.push(c2.id);

  // Assign mentor to Course 1 in CourseMentor
  await prisma.courseMentor.create({
    data: { courseId: c1.id, mentorId: mentor.id },
  });

  // Assign mentee to mentor in MenteeAssignment for a third course to test mentee's personal mentor resolution
  await prisma.menteeAssignment.create({
    data: {
      menteeId: mentee.id,
      mentorId: mentor.id,
      courseId: c1.id,
      status: 'REVOKED', // Not active access, but establishes mentor link
    },
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await prisma.menteeAssignment.deleteMany({ where: { OR: [{ menteeId: { in: users } }, { mentorId: { in: users } }] } });
    await prisma.courseMentor.deleteMany({ where: { OR: [{ mentorId: { in: users } }, { courseId: { in: courses } }] } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.course.deleteMany({ where: { id: { in: courses } } });
    await prisma.$disconnect();
  });

  const call = async (path: string, cookie: string) => {
    const res = await fetch(base + path, { headers: { cookie } });
    return { status: res.status, json: await res.json() };
  };

  await t.test('1. Para un MENTEE sin acceso a un curso, requiresPaywall es false y se incluye el mentor asignado', async () => {
    const res = await call(`/api/courses/${c1.id}`, mentee.cookie);
    assert.equal(res.status, 200);
    assert.equal(res.json.course.hasAccess, false);
    assert.equal(res.json.course.requiresPaywall, false, 'Mentee no debe tener requiresPaywall en true');
    assert.equal(res.json.requiresPaywall, false);
    assert.ok(res.json.course.assignedMentor, 'Debe incluir assignedMentor');
    assert.equal(res.json.course.assignedMentor.id, mentor.id);
    assert.equal(res.json.course.assignedMentor.name, mentor.name);
    assert.equal(res.json.course.assignedMentor.email, mentor.email);
  });

  await t.test('2. Para un PUBLIC_USER sin acceso a un curso, requiresPaywall sí es true', async () => {
    const res = await call(`/api/courses/${c1.id}`, publicUser.cookie);
    assert.equal(res.status, 200);
    assert.equal(res.json.course.hasAccess, false);
    assert.equal(res.json.course.requiresPaywall, true, 'Usuario público sin acceso debe tener requiresPaywall en true');
  });

  await t.test('3. En GET /api/courses el listado para MENTEE marca requiresPaywall en false en cursos no asignados', async () => {
    const res = await call('/api/courses', mentee.cookie);
    assert.equal(res.status, 200);
    const targetCourse = res.json.courses.find((c: any) => c.id === c1.id);
    assert.ok(targetCourse);
    assert.equal(targetCourse.hasAccess, false);
    assert.equal(targetCourse.requiresPaywall, false);
    assert.ok(targetCourse.assignedMentor);
    assert.equal(targetCourse.assignedMentor.id, mentor.id);
  });

  await t.test('4. Endpoint /api/mentee/my-mentor devuelve el mentor del mentee o del curso', async () => {
    const resCourse1 = await call(`/api/mentee/my-mentor?courseId=${c1.id}`, mentee.cookie);
    assert.equal(resCourse1.status, 200);
    assert.equal(resCourse1.json.success, true);
    assert.equal(resCourse1.json.mentor.id, mentor.id);

    const resCourse2 = await call(`/api/mentee/my-mentor?courseId=${c2.id}`, mentee.cookie);
    assert.equal(resCourse2.status, 200);
    assert.equal(resCourse2.json.success, true);
    assert.equal(resCourse2.json.mentor.id, mentor.id, 'Debe resolver el mentor establecido del mentee');
  });

  await t.test('5. Endpoint /api/courses/:courseId/access incluye datos de mentor para el mentee', async () => {
    const res = await call(`/api/courses/${c1.id}/access`, mentee.cookie);
    assert.equal(res.status, 200);
    assert.equal(res.json.hasAccess, false);
    assert.ok(res.json.mentor);
    assert.equal(res.json.mentor.id, mentor.id);
    assert.ok(Array.isArray(res.json.mentors));
    assert.equal(res.json.mentors.length, 1);
  });

  let accessRequestId = '';

  await t.test('6. Mentee puede solicitar acceso en 1 clic y queda registrada la solicitud interna PENDING', async () => {
    // Inicialmente no tiene solicitud pendiente
    const initialCheck = await call(`/api/courses/${c2.id}/access`, mentee.cookie);
    assert.equal(initialCheck.json.hasPendingRequest, false);

    // Envía la solicitud
    const postRes = await fetch(`${base}/api/mentee/request-access`, {
      method: 'POST',
      headers: { cookie: mentee.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: c2.id }),
    });
    assert.equal(postRes.status, 200);
    const postData = await postRes.json();
    assert.equal(postData.success, true);
    assert.equal(postData.status, 'PENDING');
    assert.ok(postData.assignmentId);
    accessRequestId = postData.assignmentId;

    // Ahora /access y /courses/:id reportan hasPendingRequest: true
    const accessCheck = await call(`/api/courses/${c2.id}/access`, mentee.cookie);
    assert.equal(accessCheck.json.hasPendingRequest, true);
    assert.equal(accessCheck.json.hasAccess, false);

    const courseCheck = await call(`/api/courses/${c2.id}`, mentee.cookie);
    assert.equal(courseCheck.json.course.hasPendingRequest, true);
    assert.equal(courseCheck.json.course.hasAccess, false);
  });

  await t.test('7. El mentor ve la solicitud pendiente en su bandeja interna de solicitudes de acceso', async () => {
    const res = await call('/api/mentor/access-requests', mentor.cookie);
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(Array.isArray(res.json.requests));
    const targetReq = res.json.requests.find((r: any) => r.id === accessRequestId);
    assert.ok(targetReq, 'El mentor debe ver la solicitud de acceso');
    assert.equal(targetReq.menteeId, mentee.id);
    assert.equal(targetReq.courseId, c2.id);
    assert.equal(targetReq.status, 'PENDING');
  });

  await t.test('8. El mentor aprueba la solicitud en 1 clic y el mentee obtiene acceso inmediato al curso', async () => {
    const approveRes = await fetch(`${base}/api/mentor/access-requests/${accessRequestId}/approve`, {
      method: 'POST',
      headers: { cookie: mentor.cookie },
    });
    assert.equal(approveRes.status, 200);
    const approveData = await approveRes.json();
    assert.equal(approveData.success, true);

    // Ahora la solicitud ya no sale como pendiente
    const pendingRes = await call('/api/mentor/access-requests', mentor.cookie);
    assert.equal(pendingRes.json.requests.some((r: any) => r.id === accessRequestId), false);

    // El mentee ahora TIENE acceso al curso
    const courseCheck = await call(`/api/courses/${c2.id}`, mentee.cookie);
    assert.equal(courseCheck.json.course.hasAccess, true);
    assert.equal(courseCheck.json.hasAccess, true);
  });
});
