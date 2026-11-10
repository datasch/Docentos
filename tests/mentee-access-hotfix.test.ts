import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';
process.env.DOCENTOS_SKIP_LISTEN = '1';
const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');

test('MENTEE: per-course access and explicit reassignments preserve scope and progress', async t => {
  const suffix = `hotfix-${Date.now()}`;
  const users: string[] = [];
  const courses: string[] = [];
  const account = async (role: 'ADMIN' | 'MENTOR' | 'MENTEE', label: string) => {
    const user = await prisma.user.create({ data: { role, name: label, email: `${label}-${suffix}@example.invalid` } });
    users.push(user.id);
    const { token } = await createUserSession(user.id, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
    return { ...user, cookie: `${config.SESSION_COOKIE_NAME}=${token}` };
  };
  const admin = await account('ADMIN', 'admin');
  const mentor = await account('MENTOR', 'mentor');
  const other = await account('MENTOR', 'other');
  const mentee = await account('MENTEE', 'mentee');
  await ensureLegacyInstanceConfig();
  for (const title of ['assigned', 'unassigned']) {
    const course = await prisma.course.create({ data: { title: `${title}-${suffix}`, description: 'Local test', price: 100, currency: 'PEN', coverImage: '/logo.avif', published: true } });
    courses.push(course.id);
  }
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await prisma.courseMentor.deleteMany({ where: { OR: [{ mentorId: { in: users } }, { courseId: { in: courses } }] } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.course.deleteMany({ where: { id: { in: courses } } });
    await prisma.$disconnect();
  });
  await prisma.courseMentor.create({ data: { mentorId: mentor.id, courseId: courses[0] } });
  const assignment = await prisma.menteeAssignment.create({ data: { menteeId: mentee.id, mentorId: mentor.id, courseId: courses[0], status: 'ACTIVE', courseProgress: 42, completedVideosCount: 3, totalVideosCount: 7 } });
  const call = async (path: string, cookie: string, body?: unknown, method = 'PUT') => {
    const res = await fetch(base + path, { method: body ? method : 'GET', headers: { cookie, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, json: await res.json() };
  };
  await t.test('assigned course is accessible, another published paid course is blocked', async () => {
    assert.equal((await call(`/api/courses/${courses[0]}`, mentee.cookie)).json.course.hasAccess, true);
    assert.equal((await call(`/api/courses/${courses[1]}`, mentee.cookie)).json.course.hasAccess, false);
  });
  const routes = [
    { path: `/api/mentor/courses/${courses[0]}/mentees`, body: { menteeIds: [mentee.id] }, method: 'PUT' },
    { path: `/api/mentor/mentees/${mentee.id}/courses`, body: { courseIds: [courses[0]] }, method: 'PUT' },
    { path: '/api/mentor/assign-mentee', body: { name: mentee.name, email: mentee.email, courseId: courses[0] }, method: 'POST' },
  ];
  for (const route of routes) {
    await t.test(`${route.path}: explicit reassignment reactivates and preserves progress`, async () => {
      await prisma.menteeAssignment.update({ where: { id: assignment.id }, data: { status: 'REVOKED' } });
      assert.equal((await call(`/api/courses/${courses[0]}`, mentee.cookie)).json.course.hasAccess, false);
      const result = await call(route.path, mentor.cookie, route.body, route.method);
      assert.equal(result.status, 200);
      assert.ok(result.json.reactivated);
      const row = await prisma.menteeAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
      assert.equal(row.status, 'ACTIVE');
      assert.equal(row.courseProgress, 42);
      assert.equal(row.completedVideosCount, 3);
      assert.equal((await call(`/api/courses/${courses[0]}`, mentee.cookie)).json.course.hasAccess, true);
    });
    await t.test(`${route.path}: GRADUATED stays graduated`, async () => {
      await prisma.menteeAssignment.update({ where: { id: assignment.id }, data: { status: 'GRADUATED' } });
      assert.equal((await call(route.path, mentor.cookie, route.body, route.method)).status, 200);
      assert.equal((await prisma.menteeAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).status, 'GRADUATED');
    });
    await t.test(`${route.path}: other mentor cannot reactivate or take assignment`, async () => {
      await prisma.menteeAssignment.update({ where: { id: assignment.id }, data: { status: 'REVOKED' } });
      const result = await call(route.path, other.cookie, route.body, route.method);
      assert.ok([200, 403].includes(result.status));
      const row = await prisma.menteeAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
      assert.equal(row.status, 'REVOKED');
      assert.equal(row.mentorId, mentor.id);
    });
  }
  await t.test('admin can explicitly reactivate an assignment from another mentor', async () => {
    const result = await call(routes[0].path, admin.cookie, routes[0].body);
    assert.equal(result.status, 200);
    assert.equal(result.json.reactivated, 1);
  });
});
