/**
 * Pruebas de Ámbito y Seguridad de Cursos por Mentor (Scoped Mentorship & Multi-course Protection)
 *
 * Valida:
 * 1. Asignación de cursos a mentores por parte del Administrador (GET y PUT).
 * 2. Asignación de mentores a un curso por parte del Administrador (GET y PUT).
 * 3. Filtrado de cursos en el panel del mentor: solo ve los cursos asignados.
 * 4. Control de acceso en la gestión de roster del curso: 403 Forbidden si el curso no le pertenece.
 * 5. Protección Multicurso: un mentor no puede revocar cursos asignados al alumno por otros mentores.
 * 6. Alta de nuevo mentee: un mentor no puede dar de alta en cursos fuera de su competencia.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';

process.env.DOCENTOS_SKIP_LISTEN = '1';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');

const SUFIJO = `scope-${Date.now()}`;
const usersCreados: string[] = [];
const coursesCreados: string[] = [];

async function crearUsuario(nombre: string, rol: 'ADMIN' | 'MENTOR' | 'MENTEE') {
  const user = await prisma.user.create({
    data: {
      name: nombre,
      email: `${rol.toLowerCase()}-${nombre.toLowerCase().replace(/\s+/g, '-')}-${SUFIJO}@ejemplo.invalid`,
      role: rol,
      avatarUrl: '/logo.avif',
    },
  });
  usersCreados.push(user.id);
  return user;
}

async function crearCurso(titulo: string) {
  const course = await prisma.course.create({
    data: {
      title: `${titulo} ${SUFIJO}`,
      description: 'Curso de prueba para validación de scope de mentores',
      price: 99,
      coverImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97',
      category: 'Técnica',
      published: true,
      openToAllRegistered: false,
    },
  });
  coursesCreados.push(course.id);
  return course;
}

async function cookieDe(userId: string) {
  const reqFalso = { get: () => undefined, ip: '127.0.0.1' } as unknown as Request;
  const { token } = await createUserSession(userId, reqFalso);
  return `${config.SESSION_COOKIE_NAME}=${token}`;
}

test('Seguridad y Ámbito de Cursos por Mentor (RBAC & Protección Multicurso)', async (t) => {
  await ensureLegacyInstanceConfig();

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;

  // Actores de prueba
  const admin = await crearUsuario('Admin General', 'ADMIN');
  const mentorA = await crearUsuario('Sofia Ruiz', 'MENTOR');
  const mentorB = await crearUsuario('Carlos Mendoza', 'MENTOR');
  const mentee = await crearUsuario('Juan Perez Alumno', 'MENTEE');

  // Cursos de prueba
  const course1 = await crearCurso('Frontend React Pro');
  const course2 = await crearCurso('Backend Go Microservicios');

  // Cookies de sesión
  const cookieAdmin = await cookieDe(admin.id);
  const cookieMentorA = await cookieDe(mentorA.id);
  const cookieMentorB = await cookieDe(mentorB.id);

  t.after(async () => {
    server.close();
    // Limpieza de relaciones y entidades de prueba
    await prisma.courseMentor.deleteMany({
      where: {
        OR: [
          { mentorId: { in: usersCreados } },
          { courseId: { in: coursesCreados } },
        ],
      },
    });
    await prisma.menteeAssignment.deleteMany({
      where: {
        OR: [
          { menteeId: mentee.id },
          { courseId: { in: coursesCreados } },
        ],
      },
    });
    if (coursesCreados.length > 0) {
      await prisma.course.deleteMany({ where: { id: { in: coursesCreados } } });
    }
    if (usersCreados.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: usersCreados } } });
      await prisma.user.deleteMany({ where: { id: { in: usersCreados } } });
    }
  });

  await t.test('1. Admin asigna Course 1 a Mentor A (Sofia)', async () => {
    const res = await fetch(`${base}/api/admin/mentors/${mentorA.id}/courses`, {
      method: 'PUT',
      headers: { cookie: cookieAdmin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseIds: [course1.id] }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.deepEqual(data.courseIds, [course1.id]);

    // Verificar GET /api/admin/mentors/:mentorId/courses
    const getRes = await fetch(`${base}/api/admin/mentors/${mentorA.id}/courses`, {
      headers: { cookie: cookieAdmin },
    });
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.deepEqual(getData.courseIds, [course1.id]);

    // Verificar GET /api/admin/courses/:courseId/mentors
    const courseMentorsRes = await fetch(`${base}/api/admin/courses/${course1.id}/mentors`, {
      headers: { cookie: cookieAdmin },
    });
    assert.equal(courseMentorsRes.status, 200);
    const courseMentorsData = await courseMentorsRes.json();
    assert.ok(courseMentorsData.mentorIds.includes(mentorA.id));
  });

  await t.test('2. Mentor A solo ve Course 1 en GET /api/mentor/courses', async () => {
    const res = await fetch(`${base}/api/mentor/courses`, {
      headers: { cookie: cookieMentorA },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    const ids = data.courses.map((c: any) => c.id);
    assert.ok(ids.includes(course1.id), 'Debe incluir course1 asignado');
    assert.ok(!ids.includes(course2.id), 'NO debe incluir course2');
  });

  await t.test('3. Mentor A intentando asignar alumnos a Course 2 recibe 403 Forbidden', async () => {
    const res = await fetch(`${base}/api/mentor/courses/${course2.id}/mentees`, {
      method: 'PUT',
      headers: { cookie: cookieMentorA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ menteeIds: [mentee.id] }),
    });
    assert.equal(res.status, 403, 'Debe denegar acceso por estar fuera del ámbito del mentor');
    const data = await res.json();
    assert.ok(data.error.includes('No tienes asignado este curso'));
  });

  await t.test('4. Mentor A asigna mentee a Course 1, y Mentor B asigna mentee a Course 2', async () => {
    // Admin asigna Course 2 a Mentor B
    const adminAssign = await fetch(`${base}/api/admin/mentors/${mentorB.id}/courses`, {
      method: 'PUT',
      headers: { cookie: cookieAdmin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseIds: [course2.id] }),
    });
    assert.equal(adminAssign.status, 200);

    // Mentor A inscribe a mentee en Course 1
    const resA = await fetch(`${base}/api/mentor/courses/${course1.id}/mentees`, {
      method: 'PUT',
      headers: { cookie: cookieMentorA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ menteeIds: [mentee.id] }),
    });
    assert.equal(resA.status, 200);

    // Mentor B inscribe a mentee en Course 2
    const resB = await fetch(`${base}/api/mentor/courses/${course2.id}/mentees`, {
      method: 'PUT',
      headers: { cookie: cookieMentorB, 'Content-Type': 'application/json' },
      body: JSON.stringify({ menteeIds: [mentee.id] }),
    });
    assert.equal(resB.status, 200);

    // En la base de datos, el mentee tiene asignados AMBOS cursos
    const assignments = await prisma.menteeAssignment.findMany({
      where: { menteeId: mentee.id, status: 'ACTIVE' },
    });
    const cIds = assignments.map((a) => a.courseId);
    assert.ok(cIds.includes(course1.id), 'Mentee debe tener Course 1');
    assert.ok(cIds.includes(course2.id), 'Mentee debe tener Course 2');
  });

  await t.test('5. PROTECCIÓN MULTICURSO: Mentor A remueve sus cursos pero Course 2 de Mentor B permanece intacto', async () => {
    // Mentor A edita los cursos de Juan y envía courseIds: [] (desmarcando Course 1)
    const res = await fetch(`${base}/api/mentor/mentees/${mentee.id}/courses`, {
      method: 'PUT',
      headers: { cookie: cookieMentorA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseIds: [] }),
    });
    assert.equal(res.status, 200);

    // Verificación en la base de datos:
    // Course 1 (de Mentor A) fue retirado
    const assignC1 = await prisma.menteeAssignment.findUnique({
      where: { menteeId_courseId: { menteeId: mentee.id, courseId: course1.id } },
    });
    assert.equal(assignC1, null, 'Course 1 debió ser retirado por su mentor');

    // Course 2 (de Mentor B) NUNCA debe haber sido borrado ni revocado
    const assignC2 = await prisma.menteeAssignment.findUnique({
      where: { menteeId_courseId: { menteeId: mentee.id, courseId: course2.id } },
    });
    assert.ok(assignC2, 'Course 2 NO debió ser tocado por Mentor A');
    assert.equal(assignC2.status, 'ACTIVE', 'Course 2 debe seguir ACTIVE');
  });

  await t.test('6. POST /api/mentor/assign-mentee rechaza cursos fuera de ámbito', async () => {
    const resRechazo = await fetch(`${base}/api/mentor/assign-mentee`, {
      method: 'POST',
      headers: { cookie: cookieMentorA, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nuevo Alumno',
        email: `nuevo-${SUFIJO}@ejemplo.invalid`,
        courseId: course2.id, // Mentor A no imparte Course 2
      }),
    });
    assert.equal(resRechazo.status, 403);

    const resAceptado = await fetch(`${base}/api/mentor/assign-mentee`, {
      method: 'POST',
      headers: { cookie: cookieMentorA, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nuevo Alumno',
        email: `nuevo-${SUFIJO}@ejemplo.invalid`,
        courseId: course1.id, // Mentor A sí imparte Course 1
      }),
    });
    assert.equal(resAceptado.status, 200);
    const data = await resAceptado.json();
    assert.equal(data.success, true);
    usersCreados.push(data.mentee.id);
  });
});
