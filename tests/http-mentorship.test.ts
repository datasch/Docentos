/**
 * Pruebas de extremo a extremo sobre HTTP — panel de mentoria.
 *
 * Las demas pruebas del proyecto llaman a las funciones de `server/` una a una.
 * Eso deja fuera lo que solo existe dentro de una ruta de Express: los
 * permisos, el codigo de estado, y sobre todo **que toca y que no toca** una
 * peticion. Aqui se levanta la aplicacion de verdad en un puerto efimero y se
 * le habla como le habla el navegador.
 *
 * El caso que las trajo: "Asignar Nuevo Mentee" hacia `role: 'MENTEE'` sobre
 * una cuenta que ya existia. A una cuenta VIP le retiraba la membresia —y con
 * ella el acceso a todos los cursos publicados— para darle uno solo, y de paso
 * le cambiaba el nombre por el que se hubiera tecleado en el formulario.
 * Ningun test de funcion pura puede ver eso: el dano esta en el efecto de la
 * ruta sobre la base, no en un valor devuelto.
 *
 * Cada prueba crea sus propias cuentas con un sufijo unico y las borra al
 * terminar. No se toca ninguna cuenta real de la base.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';

// Tiene que estar puesta ANTES de importar server.ts: el arranque automatico se
// decide al evaluar el modulo, no al llamar a nada.
process.env.DOCENTOS_SKIP_LISTEN = '1';

const { app } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');

const SUFIJO = `http-${Date.now()}`;
const creados: string[] = [];

/** Una cuenta de usar y tirar, con rol a medida. */
async function crearCuenta(nombre: string, rol: 'ADMIN' | 'VIP' | 'PUBLIC_USER' | 'MENTOR') {
  const user = await prisma.user.create({
    data: {
      name: nombre,
      email: `${rol.toLowerCase()}-${SUFIJO}@ejemplo.invalid`,
      role: rol,
      avatarUrl: '/logo.avif',
    },
  });
  creados.push(user.id);
  return user;
}

/**
 * La cookie de sesion de esa cuenta. `createUserSession` solo usa `req` para
 * guardar user-agent e IP, asi que basta con un doble que responda a las dos.
 */
async function cookieDe(userId: string) {
  const reqFalso = { get: () => undefined, ip: '127.0.0.1' } as unknown as Request;
  const { token } = await createUserSession(userId, reqFalso);
  return `${config.SESSION_COOKIE_NAME}=${token}`;
}

/** La aplicacion escuchando en un puerto que elige el sistema. */
async function levantar() {
  const servidor = app.listen(0);
  await new Promise<void>((listo) => servidor.once('listening', () => listo()));
  const { port } = servidor.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    cerrar: () => new Promise<void>((listo) => servidor.close(() => listo())),
  };
}

test('HTTP · POST /api/mentor/assign-mentee no toca la cuenta que ya existe', async (t) => {
  const { base, cerrar } = await levantar();
  const admin = await crearCuenta('Admin de prueba', 'ADMIN');
  const vip = await crearCuenta('Nombre Original', 'VIP');
  const cookie = await cookieDe(admin.id);

  const curso = await prisma.course.findFirst({ where: { published: true }, orderBy: { createdAt: 'asc' } });
  assert.ok(curso, 'La base de desarrollo debe tener algun curso publicado');

  const asignar = (email: string, name: string) =>
    fetch(`${base}/api/mentor/assign-mentee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ name, email, courseId: curso.id }),
    });

  t.after(async () => {
    await prisma.menteeAssignment.deleteMany({ where: { menteeId: { in: creados } } });
    await prisma.session.deleteMany({ where: { userId: { in: creados } } });
    await prisma.user.deleteMany({ where: { id: { in: creados } } });
    await cerrar();
  });

  await t.test('1. Una cuenta VIP conserva su rol y su nombre', async () => {
    const res = await asignar(vip.email, 'NOMBRE PISADO');
    assert.equal(res.status, 200);
    const cuerpo = await res.json();
    assert.equal(cuerpo.success, true);
    assert.equal(cuerpo.existed, true, 'El panel necesita saber que la cuenta ya estaba');

    const despues = await prisma.user.findUnique({ where: { id: vip.id } });
    assert.equal(despues?.role, 'VIP', 'Antes bajaba a MENTEE y perdia el acceso a los cursos publicados');
    assert.equal(despues?.name, 'Nombre Original', 'Antes se le pisaba el nombre con el del formulario');
  });

  await t.test('2. Y aun asi queda asignada al curso, que es lo que se pedia', async () => {
    const asignacion = await prisma.menteeAssignment.findUnique({
      where: { menteeId_courseId: { menteeId: vip.id, courseId: curso.id } },
    });
    assert.ok(asignacion, 'La asignacion es lo que concede el acceso, no el rol');
  });

  await t.test('3. Una cuenta que no existia se crea como MENTEE', async () => {
    const email = `nueva-${SUFIJO}@ejemplo.invalid`;
    const res = await asignar(email, 'Persona Nueva');
    assert.equal(res.status, 200);
    const cuerpo = await res.json();
    assert.equal(cuerpo.existed, false);

    const creada = await prisma.user.findUnique({ where: { email } });
    assert.ok(creada);
    creados.push(creada.id);
    assert.equal(creada.role, 'MENTEE', 'En una cuenta nueva no hay nada previo que destruir');
    assert.equal(creada.name, 'Persona Nueva');
  });

  await t.test('4. Una cuenta de mentor se sigue rechazando', async () => {
    const mentor = await crearCuenta('Mentor de prueba', 'MENTOR');
    const res = await asignar(mentor.email, 'da igual');
    assert.equal(res.status, 409);
    assert.match((await res.json()).error, /administrativa o de mentor/);
  });

  await t.test('5. Sin sesion no se llega a la ruta', async () => {
    const res = await fetch(`${base}/api/mentor/assign-mentee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x', email: 'x@ejemplo.invalid', courseId: curso.id }),
    });
    assert.ok(res.status === 401 || res.status === 403, `Esperaba 401/403 y llego ${res.status}`);
  });
});

test('HTTP · PUT /api/mentor/mentees/:id/courses alcanza a quien sale en la lista', async (t) => {
  const { base, cerrar } = await levantar();
  const admin = await crearCuenta('Admin roster', 'ADMIN');
  const cookie = await cookieDe(admin.id);

  // Una cuenta PUBLIC_USER con un curso asignado: exactamente el caso que
  // respondia "Mentee no encontrado" al pulsar «Editar cursos», porque esa ruta
  // exigia el rol MENTEE mientras la lista se arma desde las asignaciones.
  const publico = await prisma.user.create({
    data: {
      name: 'Publico con curso',
      email: `publico-roster-${SUFIJO}@ejemplo.invalid`,
      role: 'PUBLIC_USER',
      avatarUrl: '/logo.avif',
    },
  });
  creados.push(publico.id);

  const curso = await prisma.course.findFirst({ where: { published: true }, orderBy: { createdAt: 'asc' } });
  assert.ok(curso);
  await prisma.menteeAssignment.create({
    data: { menteeId: publico.id, mentorId: admin.id, courseId: curso.id, totalVideosCount: 0 },
  });

  t.after(async () => {
    await prisma.menteeAssignment.deleteMany({ where: { menteeId: { in: creados } } });
    await prisma.session.deleteMany({ where: { userId: { in: creados } } });
    await prisma.user.deleteMany({ where: { id: { in: creados } } });
    await cerrar();
  });

  await t.test('1. Ya no responde «Mentee no encontrado»', async () => {
    const res = await fetch(`${base}/api/mentor/mentees/${publico.id}/courses`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ courseIds: [curso.id] }),
    });
    assert.equal(res.status, 200, 'Antes devolvia 404 porque el rol no era MENTEE');
    const cuerpo = await res.json();
    assert.equal(cuerpo.success, true);
    assert.equal(cuerpo.added, 0, 'Mandar lo mismo que ya tenia no debe dar de alta nada');
    assert.equal(cuerpo.removed, 0, 'Ni retirar nada');
  });

  await t.test('2. Un id que no es de nadie sigue dando 404', async () => {
    const res = await fetch(`${base}/api/mentor/mentees/no-existe-esta-persona/courses`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ courseIds: [] }),
    });
    assert.equal(res.status, 404);
  });
});
